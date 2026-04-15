/**
 * post-to-weebly-v3.js
 * =====================
 * 自動發文腳本 — 連接到已開啟的瀏覽器，尋找現有 Weebly 編輯器分頁
 *
 * 前置條件：
 *   1. 先執行 node open-login.js 開啟瀏覽器
 *   2. 手動登入 Weebly → 進入轉職故事庫 → 編輯網站 → Blog → 新貼文
 *   3. 保持瀏覽器開啟，執行本腳本
 *
 * 用法：
 *   node post-to-weebly-v3.js --title "標題" --html "HTML內文" [--image "圖片路徑"] [--seoDesc "描述"]
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const WS_FILE = path.join(__dirname, 'ws-endpoint.txt');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ===== 工具函式 =====
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    params[args[i].replace('--', '')] = args[i + 1];
  }
  return params;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function shot(page, label) {
  const f = path.join(SCREENSHOT_DIR, `${ts()}_${label}.png`);
  await page.screenshot({ path: f, fullPage: false });
  console.log(`  📸 ${f}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===== 連接到現有瀏覽器 =====
async function connectToExistingBrowser() {
  // 方法 1：使用儲存的 WebSocket endpoint 檔案
  if (fs.existsSync(WS_FILE)) {
    const wsEndpoint = fs.readFileSync(WS_FILE, 'utf-8').trim();
    console.log('📌 找到 ws-endpoint.txt，嘗試連接...');
    console.log(`   Endpoint: ${wsEndpoint}`);
    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
      console.log('  ✅ 已透過 WebSocket 連接到瀏覽器！');
      return browser;
    } catch (e) {
      console.log(`  ⚠️ WebSocket 連接失敗: ${e.message}`);
    }
  }

  // 方法 2：透過 Remote Debugging Port 連接
  console.log('📌 嘗試透過 http://127.0.0.1:9222 連接...');
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    console.log('  ✅ 已透過 Debugging Port 連接到瀏覽器！');
    return browser;
  } catch (e) {
    console.log(`  ⚠️ Debugging Port 連接失敗: ${e.message}`);
  }

  return null;
}

// ===== 在所有分頁中尋找 Weebly 編輯器 =====
async function findWeeblyEditorPage(browser) {
  const pages = await browser.pages();
  console.log(`\n🔍 掃描所有分頁（共 ${pages.length} 個）...`);

  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].url();
    console.log(`   [${i}] ${url}`);
    if (url.includes('weebly.com/editor')) {
      console.log(`  ✅ 找到 Weebly 編輯器分頁！（第 ${i} 個）`);
      return pages[i];
    }
  }

  return null;
}

// ===== 主流程 =====
(async () => {
  const { title, html, image, seoDesc } = parseArgs();
  if (!title || !html) {
    console.error('❌ 用法: node post-to-weebly-v3.js --title "標題" --html "HTML" [--image "路徑"] [--seoDesc "描述"]');
    process.exit(1);
  }

  console.log('🚀 第四階段：自動發佈到 Weebly');
  console.log('=' .repeat(50));

  // ── 連接到現有瀏覽器 ──
  const browser = await connectToExistingBrowser();
  if (!browser) {
    console.error('\n❌ 找不到已開啟的瀏覽器！');
    console.error('   請先執行: node open-login.js');
    console.error('   然後手動登入 Weebly 並開啟編輯器。');
    process.exit(1);
  }

  // ── 尋找 Weebly 編輯器分頁 ──
  const page = await findWeeblyEditorPage(browser);
  if (!page) {
    console.error('\n❌ 找不到已開啟的 Weebly 編輯器分頁，請先手動開啟並登入。');
    console.error('   需要的 URL 格式: https://www.weebly.com/editor/main.php#/...');
    process.exit(1);
  }

  // 確保分頁在前景
  await page.bringToFront();
  await sleep(1000);
  await shot(page, '00_connected');
  console.log('\n✅ 已連接到 Weebly 編輯器分頁！開始發文...\n');

  try {
    // ── Step 1: 填入標題 ──
    console.log('📍 Step 1: 填入標題...');
    // 嘗試用 DOM 找到標題欄位
    const titleFilled = await page.evaluate((titleText) => {
      // 方法 A: 找 contenteditable 的標題區域
      const editables = document.querySelectorAll(
        '.blog-post-title, .post-title, [class*="title"][contenteditable], ' +
        'h2[contenteditable="true"], [placeholder*="Title"], [placeholder*="標題"]'
      );
      for (const el of editables) {
        el.focus();
        el.click();
        if (el.isContentEditable || el.contentEditable === 'true') {
          el.textContent = titleText;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return 'contenteditable';
        }
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = titleText;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return 'input';
        }
      }
      // 方法 B: 找包含 "Post Title" 的 placeholder
      const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
      for (const inp of inputs) {
        const ph = inp.getAttribute('placeholder') || '';
        const txt = inp.textContent || inp.value || '';
        if (ph.includes('Title') || ph.includes('標題') || txt.includes('Post Title')) {
          inp.focus();
          if (inp.isContentEditable) {
            inp.textContent = titleText;
          } else {
            inp.value = titleText;
          }
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          return 'placeholder-match';
        }
      }
      return null;
    }, title);

    if (titleFilled) {
      console.log(`  ✅ 標題已填入 (${titleFilled}): ${title.substring(0, 40)}...`);
    } else {
      console.log('  ⚠️ DOM 方式未成功，嘗試座標點擊標題欄位...');
      // 新貼文的標題通常在畫面中央偏下
      await page.mouse.click(640, 660);
      await sleep(500);
      await page.evaluate((t) => document.execCommand('insertText', false, t), title);
      console.log('  ✅ 已用 execCommand 插入標題');
    }
    await sleep(1000);
    await shot(page, '01_title');

    // ── Step 2: 拖曳 </> 嵌入程式碼元件到正文區 ──
    console.log('\n📍 Step 2: 拖曳「嵌入程式碼 </>」元件...');

    // 先找左側面板的 </> 元件位置
    const codeToolPos = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="element"], [class*="widget"], [class*="tool"]');
      for (const el of elements) {
        const text = el.textContent.trim();
        const dataType = el.getAttribute('data-type') || '';
        if (text === '</>' || text.includes('嵌入程式碼') || text.includes('Embed Code') ||
            dataType === 'CustomHTML' || dataType === 'code') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    const toolX = codeToolPos ? codeToolPos.x : 50;
    const toolY = codeToolPos ? codeToolPos.y : 355;
    const dropX = 640;
    const dropY = 750;

    console.log(`  📌 元件位置: (${toolX}, ${toolY}) → 拖曳到 (${dropX}, ${dropY})`);

    await page.mouse.move(toolX, toolY);
    await sleep(300);
    await page.mouse.down();
    await sleep(200);
    // 慢慢拖曳（模擬真人）
    for (let step = 1; step <= 30; step++) {
      const progress = step / 30;
      const cx = toolX + (dropX - toolX) * progress;
      const cy = toolY + (dropY - toolY) * progress;
      await page.mouse.move(cx, cy);
      await sleep(30);
    }
    await page.mouse.up();
    await sleep(3000);
    await shot(page, '02_code_dragged');

    // ── Step 3: 在彈出的 HTML 編輯區域中貼上內容 ──
    console.log('\n📍 Step 3: 貼上 HTML 內容...');
    const htmlPasted = await page.evaluate((htmlContent) => {
      // 尋找剛彈出的 textarea 或 code editor
      const targets = document.querySelectorAll(
        'textarea, .custom-html-edit textarea, [class*="code"] textarea, ' +
        '[class*="html-editor"], [class*="CodeMirror"] textarea, .CodeMirror'
      );
      for (const t of targets) {
        if (t.tagName === 'TEXTAREA') {
          t.focus();
          t.value = htmlContent;
          t.dispatchEvent(new Event('input', { bubbles: true }));
          t.dispatchEvent(new Event('change', { bubbles: true }));
          return 'textarea';
        }
        // CodeMirror 編輯器
        if (t.classList.contains('CodeMirror') && t.CodeMirror) {
          t.CodeMirror.setValue(htmlContent);
          return 'codemirror';
        }
      }
      return null;
    }, html);

    if (htmlPasted) {
      console.log(`  ✅ HTML 已貼入 (${htmlPasted})`);
    } else {
      console.log('  ⚠️ 未找到 HTML 編輯區，嘗試 execCommand...');
      await page.evaluate((h) => document.execCommand('insertText', false, h), html);
    }
    await sleep(2000);
    await shot(page, '03_html_pasted');

    // ── Step 4: 上傳封面圖（如有提供） ──
    if (image && fs.existsSync(image)) {
      console.log('\n📍 Step 4: 上傳封面圖...');

      // 拖曳圖片元件到標題下方
      const imgToolPos = await page.evaluate(() => {
        const elements = document.querySelectorAll('[class*="element"], [class*="widget"], [class*="tool"]');
        for (const el of elements) {
          const dataType = el.getAttribute('data-type') || '';
          if (dataType === 'image' || dataType === 'Image') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
        return null;
      });

      const imgToolX = imgToolPos ? imgToolPos.x : 50;
      const imgToolY = imgToolPos ? imgToolPos.y : 165;

      await page.mouse.move(imgToolX, imgToolY);
      await sleep(300);
      await page.mouse.down();
      for (let step = 1; step <= 30; step++) {
        await page.mouse.move(
          imgToolX + (640 - imgToolX) * (step / 30),
          imgToolY + (700 - imgToolY) * (step / 30)
        );
        await sleep(30);
      }
      await page.mouse.up();
      await sleep(3000);

      // 找到 file input 並上傳
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        await fileInputs[fileInputs.length - 1].uploadFile(image);
        console.log(`  ✅ 圖片已上傳: ${path.basename(image)}`);
        await sleep(5000);
      } else {
        console.log('  ⚠️ 找不到上傳欄位，請手動上傳圖片');
      }
      await shot(page, '04_image');
    } else {
      console.log('\n📍 Step 4: 跳過（無圖片或路徑不存在）');
    }

    // ── Step 5: 點擊「貼文」發布 ──
    console.log('\n📍 Step 5: 發布...');
    const published = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"], [class*="publish"], [class*="post-btn"]');
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (txt === '貼文' || txt === 'Post' || txt === 'Publish') {
          btn.click();
          return txt;
        }
      }
      return null;
    });

    if (published) {
      console.log(`  ✅ 已點擊「${published}」按鈕！`);
    } else {
      console.log('  ⚠️ DOM 找不到發布按鈕，嘗試座標...');
      await page.mouse.click(1230, 22);
    }
    await sleep(5000);
    await shot(page, '05_published');

    console.log('\n🎉 ====== 發文流程完成！ ======');
    console.log('📁 截圖目錄：' + SCREENSHOT_DIR);
    console.log('⚠️  請到瀏覽器中確認文章是否成功發布。');

  } catch (err) {
    console.error('\n❌ 錯誤：', err.message);
    await shot(page, 'error');
  }

  // 不關閉瀏覽器，讓使用者繼續操作
  console.log('\n✅ 腳本執行完畢（瀏覽器保持開啟）。');
  process.exit(0);
})();
