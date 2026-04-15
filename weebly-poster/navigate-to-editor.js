/**
 * navigate-to-editor.js
 * ======================
 * 連接到已開啟的瀏覽器，自動導航到指定網站的 Blog 編輯器並建立新貼文。
 * 完成後印出提示，讓使用者接著執行 post-to-weebly-v3.js。
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const WS_FILE = path.join(__dirname, 'ws-endpoint.txt');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // 連接到已開啟的瀏覽器
  let browser;
  if (fs.existsSync(WS_FILE)) {
    const ws = fs.readFileSync(WS_FILE, 'utf-8').trim();
    console.log('📌 連接到瀏覽器...');
    browser = await puppeteer.connect({ browserWSEndpoint: ws });
  } else {
    try {
      browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    } catch (e) {
      console.error('❌ 找不到瀏覽器，請先執行 node open-login.js');
      process.exit(1);
    }
  }

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  await page.bringToFront();

  // Step 1: 進入 Dashboard
  console.log('\n📍 Step 1: 進入轉職故事庫 Dashboard...');
  await page.goto('https://www.weebly.com/app/home/users/154293684/sites/504508816679558579/dashboard', {
    waitUntil: 'networkidle2', timeout: 30000
  });
  await sleep(3000);
  console.log('  ✅ Dashboard 已載入');

  // Step 2: 點擊「編輯網站」
  console.log('\n📍 Step 2: 點擊「編輯網站」...');
  const clicked = await page.evaluate(() => {
    const links = document.querySelectorAll('a, button, [role="button"]');
    for (const l of links) {
      const txt = l.textContent.trim();
      if (txt.includes('編輯網站') || txt.includes('Edit Site') || txt.includes('Edit')) {
        l.click();
        return txt;
      }
    }
    // Fallback: 找 href 含 editor 的連結
    const editorLinks = document.querySelectorAll('a[href*="editor"]');
    if (editorLinks.length > 0) {
      editorLinks[0].click();
      return 'editor-link';
    }
    return null;
  });

  if (clicked) {
    console.log(`  ✅ 已點擊: ${clicked}`);
  } else {
    console.log('  ⚠️ 找不到按鈕，直接導航到編輯器...');
    await page.goto('https://www.weebly.com/editor/main.php#/', {
      waitUntil: 'networkidle2', timeout: 30000
    });
  }
  await sleep(5000);

  // Step 3: 確認在編輯器中，找到 Blog 頁面
  console.log('\n📍 Step 3: 切換到 Blog 頁面...');
  const currentUrl = page.url();
  console.log(`  📌 目前 URL: ${currentUrl}`);

  // 點擊上方「頁面」Tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('a, button, span, [class*="tab"], [class*="nav"]');
    for (const t of tabs) {
      const txt = t.textContent.trim();
      if (txt === '頁面' || txt === 'Pages') {
        t.click();
        return true;
      }
    }
    return false;
  });
  await sleep(2000);

  // 在頁面列表點擊 Blog
  await page.evaluate(() => {
    const items = document.querySelectorAll('li, a, span, div');
    for (const item of items) {
      const txt = item.textContent.trim();
      if (txt === 'Blog' || txt === '部落格' || txt === 'blog') {
        item.click();
        return true;
      }
    }
    return false;
  });
  await sleep(3000);

  // Step 4: 點擊「新貼文」
  console.log('\n📍 Step 4: 點擊「新貼文」...');
  const newPostClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a, [role="button"]');
    for (const btn of btns) {
      const txt = btn.textContent.trim();
      if (txt === '新貼文' || txt === 'New Post' || txt.includes('新貼文')) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (!newPostClicked) {
    console.log('  ⚠️ DOM 找不到，用座標點擊右下角...');
    // 新貼文按鈕通常在右下角
    const viewport = page.viewport() || { width: 1280, height: 900 };
    await page.mouse.click(viewport.width - 80, viewport.height - 50);
  }
  await sleep(5000);

  console.log('  ✅ 新貼文編輯器應已開啟');
  console.log('\n✅ 導航完成！目前 URL: %s', page.url());
  console.log('\n🟢 現在可以執行發文腳本了！');
  process.exit(0);
})();
