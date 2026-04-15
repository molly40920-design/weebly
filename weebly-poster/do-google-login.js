const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function shot(page, label) {
  const f = path.join(SCREENSHOT_DIR, `stealth_login_${label}.png`);
  await page.screenshot({ path: f });
  console.log(`📸 Saved screenshot: ${f}`);
}

(async () => {
  console.log('🚀 啟動 Stealth 瀏覽器進行 Google 自動登入...');
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  try {
    console.log('📍 前往 Weebly 登入頁...');
    await page.goto('https://www.weebly.com/login', { waitUntil: 'networkidle2' });
    await sleep(3000);

    console.log('📍 點擊 Google 登入...');
    const googleBtnClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"], span');
      for (const btn of btns) {
        if (btn.textContent.includes('Google') || btn.textContent.includes('google')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!googleBtnClicked) {
      console.log('❌ 找不到 Google 登入按鈕');
      await browser.close();
      return;
    }

    console.log('📍 等待跳轉到 accounts.google.com...');
    await sleep(5000);
    
    const pages = await browser.pages();
    let loginPage = page;
    for (const p of pages) {
      if (p.url().includes('google.com') || p.url().includes('accounts')) {
        loginPage = p;
        break;
      }
    }

    console.log('📍 輸入 Google 帳號...');
    const emailInput = await loginPage.waitForSelector('input[type="email"]', { timeout: 10000 }).catch(()=>null);
    if (emailInput) {
      await emailInput.type('igs.old.ts.mia@gmail.com', { delay: 60 });
      await sleep(1000);
      await loginPage.keyboard.press('Enter');
      await sleep(4000);

      console.log('📍 輸入 Google 密碼...');
      const pwInput = await loginPage.waitForSelector('input[type="password"]', { timeout: 10000 }).catch(()=>null);
      if (pwInput) {
        await pwInput.type('22995048Igs', { delay: 60 });
        await sleep(1000);
        await loginPage.keyboard.press('Enter');
        console.log('\n🔔 已經送出密碼！');
        console.log('📱 請檢查您的手機 (iPhone)。Google 傳送了「兩步驟驗證」通知，請點擊「是 (Yes)」。');
        console.log('⏳ 腳本將等待您完成驗證...');
        
        await sleep(15000);
        await shot(loginPage, '05_waiting_2fa');
      } else {
         console.log('❌ 找不到密碼輸入框');
      }
    } else {
       console.log('❌ 找不到 Email 輸入框 (可能已記錄登入狀態)');
       await loginPage.mouse.click(640, 450); 
    }

    console.log('\n✅ 登入動作完成！瀏覽器將保持開啟狀態供您接續後續操作。');
    console.log('⚠️ 請確認網頁已成功回到 Weebly 畫面後，再執行發文腳本。');

  } catch (e) {
    console.error('❌ 發生錯誤:', e);
  }
  // 故意不呼叫 browser.close() 以免切斷使用者的連線
})();
