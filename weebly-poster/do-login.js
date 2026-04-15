const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function shot(page, label) {
  const f = path.join(SCREENSHOT_DIR, `login_${label}.png`);
  await page.screenshot({ path: f });
  console.log(`📸 Saved screenshot: ${f}`);
}

(async () => {
  console.log('🚀 啟動瀏覽器進行自動登入...');
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900']
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  try {
    console.log('📍 前往 Weebly 登入頁...');
    await page.goto('https://www.weebly.com/login', { waitUntil: 'networkidle2' });
    await sleep(3000);
    await shot(page, '01_login_page');

    // 填寫電子郵件
    const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"], input[type="text"]');
    if (emailInput) {
      console.log('📍 輸入電子郵件...');
      await emailInput.type('igs.old.ts.mia@gmail.com', { delay: 100 });
      await sleep(1000);
      await shot(page, '02_email_entered');

      // 點擊下一步或尋找密碼欄位
      const nextBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('下一步') || b.textContent.includes('Next') || b.textContent.includes('Continue'));
      });

      if (nextBtn) {
         console.log('📍 點擊下一步...');
         await nextBtn.click();
         await sleep(3000);
      } else {
         console.log('⚠️ 找不到下一步按鈕，嘗試按 Enter');
         await page.keyboard.press('Enter');
         await sleep(3000);
      }
      await shot(page, '03_after_next');

      // 等待並尋找密碼輸入框
      const pwInput = await page.$('input[type="password"], input[name="password"]');
      if (pwInput) {
        console.log('📍 輸入密碼...');
        await pwInput.type('22995048Igs', { delay: 100 });
        await sleep(1000);
        await shot(page, '04_password_entered');

        const submitBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.find(b => b.textContent.includes('登入') || b.textContent.includes('Sign In') || b.textContent.includes('Log In'));
        });

        if (submitBtn) {
           console.log('📍 點擊登入...');
           await submitBtn.click();
        } else {
           console.log('⚠️ 找不到登入按鈕，嘗試按 Enter');
           await page.keyboard.press('Enter');
        }
        await sleep(8000); // 等待登入完成跳轉
        await shot(page, '05_after_login');

        console.log('✅ 登入嘗試完成！現在的 URL: ' + page.url());
      } else {
        console.log('❌ 找不到密碼輸入框。');
      }
    } else {
      console.log('❌ 找不到電子郵件輸入框。');
    }

  } catch (e) {
    console.error('❌ 登入過程中發生錯誤:', e);
  } finally {
    console.log('關閉瀏覽器，準備執行自動發文腳本...');
    await browser.close();
  }
})();
