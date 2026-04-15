/**
 * open-login.js
 * ==============
 * 開啟帶有 Remote Debugging 的瀏覽器，讓後續腳本可以直接連接。
 * 登入完成後**不要關閉瀏覽器**，直接在上面操作 Weebly 編輯器，
 * 然後執行 post-to-weebly-v3.js 即可自動接續。
 *
 * 用法: node open-login.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const WS_FILE = path.join(__dirname, 'ws-endpoint.txt');
const DEBUG_PORT = 9222;

(async () => {
  console.log('🚀 正在啟動瀏覽器（Remote Debugging Port: %d）...', DEBUG_PORT);
  console.log('📂 使用者資料目錄: %s\n', USER_DATA_DIR);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${DEBUG_PORT}`
    ]
  });

  // 儲存 WebSocket endpoint，供 post 腳本連線
  const wsEndpoint = browser.wsEndpoint();
  fs.writeFileSync(WS_FILE, wsEndpoint, 'utf-8');
  console.log('✅ 瀏覽器已啟動！');
  console.log('📌 WebSocket Endpoint 已儲存至: %s', WS_FILE);
  console.log('📌 Endpoint: %s\n', wsEndpoint);

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  await page.goto('https://www.weebly.com/login', { waitUntil: 'networkidle2' });

  console.log('📋 請在瀏覽器中完成以下操作：');
  console.log('   1. 登入 Weebly（使用 Google 帳號）');
  console.log('   2. 進入「轉職故事庫」網站');
  console.log('   3. 點擊「編輯網站」進入編輯器');
  console.log('   4. 在 Blog 頁面點擊「新貼文」');
  console.log('');
  console.log('⚠️  完成後【不要關閉瀏覽器】！');
  console.log('   直接執行: node post-to-weebly-v3.js --title "..." --html "..."');
  console.log('   腳本會自動找到您開好的編輯器分頁並接續操作。\n');

  // 持續等待，直到使用者手動關閉
  browser.on('disconnected', () => {
    console.log('\n瀏覽器已關閉。');
    // 清除 ws endpoint 檔案
    if (fs.existsSync(WS_FILE)) fs.unlinkSync(WS_FILE);
    process.exit(0);
  });
})();
