/**
 * diagnose.js — 診斷腳本
 * 目的：進入新貼文頁面，在不同捲動位置截圖，並掃描 DOM 找出所有關鍵元素的位置。
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function shot(page, label) {
  const f = path.join(SCREENSHOT_DIR, `diag_${label}.png`);
  await page.screenshot({ path: f });
  console.log(`📸 ${f}`);
}

(async () => {
  console.log('🚀 啟動診斷...');
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900']
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  try {
    // 進入編輯器
    console.log('\n📍 進入編輯器...');
    await page.goto('https://www.weebly.com/editor/main.php#/', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(8000);
    await shot(page, '01_editor_loaded');

    // 進入 Blog
    console.log('\n📍 尋找並點擊 Blog...');
    await page.evaluate(() => {
      const items = document.querySelectorAll('a, span, button, li, [class*="nav"], [class*="tab"]');
      for (const el of items) {
        const txt = el.textContent.trim();
        if (txt === '頁面' || txt === 'Pages') { el.click(); return; }
      }
    });
    await sleep(2000);
    await page.evaluate(() => {
      const items = document.querySelectorAll('a, span, li, div, [class*="page"]');
      for (const el of items) {
        const txt = el.textContent.trim();
        if (txt === 'Blog' || txt === '部落格') { el.click(); return; }
      }
    });
    await sleep(3000);
    await shot(page, '02_blog_page');

    // 新貼文
    console.log('\n📍 點擊新貼文...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"]');
      for (const b of btns) {
        const txt = b.textContent.trim();
        if (txt.includes('新貼文') || txt === 'New Post') { b.click(); return; }
      }
    });
    await sleep(5000);
    await shot(page, '03_new_post_initial');

    // 掃描左側面板所有可拖曳元素
    console.log('\n📍 掃描左側面板元素...');
    const leftPanelElements = await page.evaluate(() => {
      const results = [];
      // 找所有 li 元素（Weebly 的元素通常是 li）
      const items = document.querySelectorAll('li[class*="element"], li[class*="draggable"], li.ui-draggable-handle, [class*="element_list_item"]');
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          results.push({
            index: i,
            className: el.className.substring(0, 100),
            text: (el.textContent || '').trim().substring(0, 30),
            dataType: el.getAttribute('data-type') || el.getAttribute('data-element') || '',
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
            width: Math.round(r.width),
            height: Math.round(r.height)
          });
        }
      });
      return results;
    });
    console.log('\n📋 左側面板元素清單:');
    leftPanelElements.forEach(e => {
      console.log(`  [${e.index}] class="${e.className}" text="${e.text}" data="${e.dataType}" center=(${e.x}, ${e.y}) size=${e.width}x${e.height}`);
    });

    // 掃描所有可拖曳元素 (ui-draggable)
    console.log('\n📍 掃描所有 ui-draggable 元素...');
    const draggables = await page.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('.ui-draggable, .ui-draggable-handle');
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.x < 220) { // 只看左側面板的
          results.push({
            index: i,
            tag: el.tagName,
            className: el.className.substring(0, 120),
            text: (el.textContent || '').trim().substring(0, 30),
            id: el.id || '',
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2)
          });
        }
      });
      return results;
    });
    console.log('\n📋 可拖曳元素清單:');
    draggables.forEach(e => {
      console.log(`  [${e.index}] <${e.tag}> id="${e.id}" class="${e.className}" text="${e.text}" center=(${e.x}, ${e.y})`);
    });

    // 掃描 Post Title 欄位
    console.log('\n📍 掃描 Post Title 欄位...');
    const titleInfo = await page.evaluate(() => {
      const results = [];
      // 找所有 contenteditable 和 input
      const els = document.querySelectorAll('[contenteditable="true"], input, textarea');
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
          results.push({
            index: i,
            tag: el.tagName,
            type: el.type || '',
            placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '',
            text: (el.textContent || el.value || '').trim().substring(0, 50),
            className: (el.className || '').substring(0, 80),
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2)
          });
        }
      });
      return results;
    });
    console.log('\n📋 可輸入欄位清單:');
    titleInfo.forEach(e => {
      console.log(`  [${e.index}] <${e.tag}> type="${e.type}" placeholder="${e.placeholder}" text="${e.text}" class="${e.className}" center=(${e.x}, ${e.y})`);
    });

    // 捲動頁面往下
    console.log('\n📍 捲動內容區域往下...');
    // 先在內容區域內滾動
    await page.mouse.move(640, 500);
    await page.mouse.wheel({ deltaY: 500 });
    await sleep(2000);
    await shot(page, '04_scrolled_500');

    // 再掃描一次輸入欄位
    const titleInfo2 = await page.evaluate(() => {
      const results = [];
      const els = document.querySelectorAll('[contenteditable="true"], input, textarea');
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width > 50 && r.height > 5) {
          results.push({
            index: i,
            tag: el.tagName,
            placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '',
            text: (el.textContent || el.value || '').trim().substring(0, 50),
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
            visible: r.y > 0 && r.y < 900
          });
        }
      });
      return results;
    });
    console.log('\n📋 捲動後可輸入欄位:');
    titleInfo2.forEach(e => {
      console.log(`  [${e.index}] <${e.tag}> placeholder="${e.placeholder}" text="${e.text}" center=(${e.x}, ${e.y}) visible=${e.visible}`);
    });

    // 掃描放置區
    console.log('\n📍 掃描「將元件拖到這裡」放置區...');
    const dropZones = await page.evaluate(() => {
      const results = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const txt = (el.textContent || '').trim();
        const cls = el.className || '';
        if ((typeof cls === 'string' && (cls.includes('drop') || cls.includes('placeholder') || cls.includes('empty-container'))) ||
            txt.includes('將元件拖到這裡') || txt.includes('拖曳') || txt.includes('Drag')) {
          const r = el.getBoundingClientRect();
          if (r.width > 50 && r.height > 10 && r.x > 200) {
            results.push({
              tag: el.tagName,
              className: (typeof cls === 'string' ? cls : '').substring(0, 100),
              text: txt.substring(0, 40),
              x: Math.round(r.x + r.width / 2),
              y: Math.round(r.y + r.height / 2),
              width: Math.round(r.width),
              height: Math.round(r.height)
            });
          }
        }
      }
      return results;
    });
    console.log('\n📋 放置區清單:');
    dropZones.forEach(e => {
      console.log(`  <${e.tag}> class="${e.className}" text="${e.text}" center=(${e.x}, ${e.y}) size=${e.width}x${e.height}`);
    });

    // 繼續捲動
    await page.mouse.wheel({ deltaY: 500 });
    await sleep(2000);
    await shot(page, '05_scrolled_1000');

    // 再掃描一次放置區
    const dropZones2 = await page.evaluate(() => {
      const results = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const txt = (el.textContent || '').trim();
        const cls = el.className || '';
        if ((typeof cls === 'string' && (cls.includes('drop') || cls.includes('placeholder') || cls.includes('empty-container'))) ||
            txt.includes('將元件拖到這裡') || txt.includes('拖曳') || txt.includes('Drag')) {
          const r = el.getBoundingClientRect();
          if (r.width > 50 && r.height > 10 && r.x > 200) {
            results.push({
              tag: el.tagName,
              className: (typeof cls === 'string' ? cls : '').substring(0, 100),
              text: txt.substring(0, 40),
              x: Math.round(r.x + r.width / 2),
              y: Math.round(r.y + r.height / 2),
              width: Math.round(r.width),
              height: Math.round(r.height)
            });
          }
        }
      }
      return results;
    });
    console.log('\n📋 捲動後放置區清單:');
    dropZones2.forEach(e => {
      console.log(`  <${e.tag}> class="${e.className}" text="${e.text}" center=(${e.x}, ${e.y}) size=${e.width}x${e.height}`);
    });

    // 檢查是否有 iframe
    console.log('\n📍 檢查 iframe...');
    const iframes = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('iframe').forEach((f, i) => {
        const r = f.getBoundingClientRect();
        results.push({
          index: i,
          id: f.id || '',
          name: f.name || '',
          src: (f.src || '').substring(0, 80),
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height)
        });
      });
      return results;
    });
    console.log('\n📋 Iframe 清單:');
    iframes.forEach(e => {
      console.log(`  [${e.index}] id="${e.id}" name="${e.name}" src="${e.src}" pos=(${e.x}, ${e.y}) size=${e.width}x${e.height}`);
    });

    console.log('\n✅ 診斷完成！請查看截圖和上方的 DOM 分析結果。');
    console.log('⚠️ 瀏覽器保持開啟，確認後手動關閉。');

  } catch (err) {
    console.error('\n❌ 錯誤:', err.message);
    await shot(page, 'error').catch(() => {});
  }

  browser.on('disconnected', () => process.exit(0));
})();
