/**
 * auto-post.js
 * ==============
 * 一體化自動發文腳本：啟動瀏覽器 → 導航到編輯器 → 新貼文 → 填入內容 → 發布
 *
 * 流程：
 *   1. 啟動瀏覽器（使用已保存的登入 cookie）
 *   2. 進入轉職故事庫 Dashboard
 *   3. 點擊「編輯網站」進入編輯器
 *   4. 進入 Blog → 新貼文
 *   5. 填入標題、拖曳 </> 嵌入 HTML、上傳圖片
 *   6. 點擊「貼文」發布
 *
 * 用法:
 *   node auto-post.js --title "標題" --html "HTML" [--image "路徑"]
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DASHBOARD_URL = 'https://www.weebly.com/app/home/users/154293684/sites/504508816679558579/dashboard';

function parseArgs() {
  const args = process.argv.slice(2);
  const p = {};
  for (let i = 0; i < args.length; i += 2) p[args[i].replace('--', '')] = args[i + 1];
  return p;
}
function ts() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function shot(page, label) {
  const f = path.join(SCREENSHOT_DIR, `${ts()}_${label}.png`);
  await page.screenshot({ path: f });
  console.log(`  📸 ${f}`);
}

(async () => {
  const { title, html, image } = parseArgs();
  if (!title || !html) {
    console.error('❌ 用法: node auto-post.js --title "標題" --html "HTML" [--image "路徑"]');
    process.exit(1);
  }

  // ===== 啟動瀏覽器 =====
  console.log('🚀 啟動瀏覽器...');
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900']
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  try {
    // ===== Step 1: Dashboard =====
    console.log('\n📍 Step 1: 進入 Dashboard...');
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(3000);
    await shot(page, '01_dashboard');
    const dashUrl = page.url();
    console.log(`  📌 URL: ${dashUrl}`);

    // 檢查是否被導向登入頁
    if (dashUrl.includes('signin') || dashUrl.includes('login')) {
      console.log('\n⚠️ 需要登入！請在瀏覽器中手動完成 Google 登入。');
      console.log('   登入完成後，腳本會自動繼續...');
      // 等待使用者登入（最多等 2 分鐘）
      await page.waitForNavigation({ timeout: 120000, waitUntil: 'networkidle2' }).catch(() => {});
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(3000);
    }
    console.log('  ✅ Dashboard 已載入');

    // ===== Step 2: 點擊「編輯網站」=====
    console.log('\n📍 Step 2: 點擊「編輯網站」...');
    const editClicked = await page.evaluate(() => {
      // 掃描所有可點擊元素
      const all = document.querySelectorAll('a, button, [role="button"], [class*="btn"]');
      for (const el of all) {
        const txt = el.textContent.trim();
        const href = el.getAttribute('href') || '';
        if (txt.includes('編輯網站') || txt.includes('Edit Site') ||
            txt === 'Edit' || href.includes('editor')) {
          el.click();
          return txt || href;
        }
      }
      return null;
    });
    if (editClicked) {
      console.log(`  ✅ 已點擊: ${editClicked}`);
    } else {
      console.log('  ⚠️ 找不到按鈕，直接導航到編輯器...');
      await page.goto('https://www.weebly.com/editor/main.php#/', { waitUntil: 'networkidle2', timeout: 45000 });
    }
    await sleep(6000);
    await shot(page, '02_editor');

    // 等待編輯器完全載入（等 iframe 或左側面板出現）
    console.log('  ⏳ 等待編輯器載入...');
    await sleep(5000);

    // ===== Step 3: 切到 Blog 頁面 =====
    console.log('\n📍 Step 3: 找到 Blog 頁面...');

    // 點擊頂部的「頁面」Tab
    await page.evaluate(() => {
      const items = document.querySelectorAll('a, span, button, li, [class*="nav"], [class*="tab"]');
      for (const el of items) {
        if (el.textContent.trim() === '頁面' || el.textContent.trim() === 'Pages') {
          el.click();
          return;
        }
      }
    });
    await sleep(2000);

    // 點擊 Blog
    await page.evaluate(() => {
      const items = document.querySelectorAll('a, span, li, div, [class*="page"]');
      for (const el of items) {
        const txt = el.textContent.trim();
        if (txt === 'Blog' || txt === '部落格') {
          el.click();
          return;
        }
      }
    });
    await sleep(3000);
    await shot(page, '03_blog');

    // ===== Step 4: 新貼文 =====
    console.log('\n📍 Step 4: 點擊「新貼文」...');
    let newPostOk = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"]');
      for (const b of btns) {
        if (b.textContent.trim().includes('新貼文') || b.textContent.trim() === 'New Post') {
          b.click();
          return true;
        }
      }
      return false;
    });
    if (!newPostOk) {
      // 座標 fallback：右下角
      await page.mouse.click(1200, 850);
    }
    await sleep(5000);
    await shot(page, '04_new_post');
    console.log('  ✅ 新貼文');

    // ===== Step 5: 填入標題 =====
    console.log('\n📍 Step 5: 填入標題...');
    const titleOk = await page.evaluate((t) => {
      // 找所有 contenteditable 元素
      const els = document.querySelectorAll('[contenteditable="true"]');
      for (const el of els) {
        const ph = el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || el.textContent;
        if (ph && (ph.includes('Title') || ph.includes('標題') || ph.includes('Post Title'))) {
          el.focus();
          el.textContent = t;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      // 找 input
      const inputs = document.querySelectorAll('input[class*="title"], input[placeholder*="Title"]');
      for (const inp of inputs) {
        inp.focus();
        inp.value = t;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }, title);

    if (!titleOk) {
      // 座標 fallback
      await page.mouse.click(640, 660);
      await sleep(500);
      await page.evaluate((t) => document.execCommand('insertText', false, t), title);
    }
    console.log(`  ✅ 標題: ${title.substring(0, 50)}...`);
    await sleep(1000);
    await shot(page, '05_title');

    // ===== Step 6: 拖曳 </> 嵌入程式碼 =====
    console.log('\n📍 Step 6: 拖曳「</>」嵌入程式碼元件...');

    // 找到 </> 的 DOM 位置
    const codePos = await page.evaluate(() => {
      const all = document.querySelectorAll('[class*="element"], [class*="widget"], [data-type]');
      for (const el of all) {
        const dt = el.getAttribute('data-type') || '';
        const txt = el.textContent.trim();
        if (dt === 'CustomHTML' || dt === 'code' || txt === '</>' || txt.includes('嵌入')) {
          const r = el.getBoundingClientRect();
          if (r.width > 5) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });

    const sx = codePos ? codePos.x : 50;
    const sy = codePos ? codePos.y : 355;

    // 慢速拖曳
    await page.mouse.move(sx, sy);
    await sleep(500);
    await page.mouse.down();
    await sleep(300);
    for (let i = 1; i <= 40; i++) {
      await page.mouse.move(sx + (640 - sx) * i / 40, sy + (750 - sy) * i / 40);
      await sleep(25);
    }
    await page.mouse.up();
    await sleep(4000);
    await shot(page, '06_code_dropped');

    // ===== Step 7: 貼上 HTML =====
    console.log('\n📍 Step 7: 貼上 HTML...');
    const htmlOk = await page.evaluate((h) => {
      // 找 textarea（嵌入程式碼的編輯區）
      const tas = document.querySelectorAll('textarea');
      for (const ta of tas) {
        if (ta.offsetHeight > 30) {
          ta.focus();
          ta.value = h;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          return 'textarea';
        }
      }
      // CodeMirror
      const cms = document.querySelectorAll('.CodeMirror');
      for (const cm of cms) {
        if (cm.CodeMirror) {
          cm.CodeMirror.setValue(h);
          return 'codemirror';
        }
      }
      return null;
    }, html);
    console.log(`  ${htmlOk ? '✅ HTML 已貼入 (' + htmlOk + ')' : '⚠️ 未找到編輯區'}`);
    await sleep(2000);
    await shot(page, '07_html');

    // ===== Step 8: 上傳圖片 =====
    if (image && fs.existsSync(image)) {
      console.log('\n📍 Step 8: 上傳封面圖...');
      // 拖曳圖片元件
      await page.mouse.move(50, 165);
      await sleep(300);
      await page.mouse.down();
      for (let i = 1; i <= 40; i++) {
        await page.mouse.move(50 + (640 - 50) * i / 40, 165 + (700 - 165) * i / 40);
        await sleep(25);
      }
      await page.mouse.up();
      await sleep(3000);

      const fis = await page.$$('input[type="file"]');
      if (fis.length > 0) {
        await fis[fis.length - 1].uploadFile(image);
        console.log(`  ✅ 已上傳: ${path.basename(image)}`);
        await sleep(5000);
      } else {
        console.log('  ⚠️ 找不到上傳欄位');
      }
      await shot(page, '08_image');
    }

    // ===== Step 9: 發布 =====
    console.log('\n📍 Step 9: 點擊「貼文」發布...');
    const pubOk = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"]');
      for (const b of btns) {
        const t = b.textContent.trim();
        if (t === '貼文' || t === 'Post' || t === 'Publish') { b.click(); return t; }
      }
      return null;
    });
    console.log(`  ${pubOk ? '✅ 已點擊: ' + pubOk : '⚠️ 座標 fallback'}`);
    if (!pubOk) await page.mouse.click(1230, 22);
    await sleep(5000);
    await shot(page, '09_done');

    console.log('\n🎉 ====== 自動發文流程完成！ ======');
    console.log('📁 截圖: ' + SCREENSHOT_DIR);

  } catch (err) {
    console.error('\n❌ 錯誤:', err.message);
    await shot(page, 'error').catch(() => {});
  }

  console.log('\n瀏覽器保持開啟，請確認後手動關閉。');
  browser.on('disconnected', () => process.exit(0));
})();
