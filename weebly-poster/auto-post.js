/**
 * auto-post.js
 * ==============
 * 一體化自動發文腳本
 *
 * 正確流程（經過診斷確認）：
 *   1. 啟動瀏覽器 → 編輯器 → Blog → 新貼文
 *   2. 捲動 iframe 內容 → 點擊 Post Title 欄位 → 鍵盤輸入標題
 *   3. 拖曳左側「圖像」元件到「將元件拖到這裡」 → 上傳圖片
 *   4. 拖曳左側「內嵌程式碼 </>」元件到「將元件拖到這裡」 → 貼上 HTML
 *   5. 點擊「貼文」發布
 *
 * 重要發現：
 *   - 內容區域在 iframe#editor-frame 中
 *   - Post Title、drop zone 的 DOM 在 iframe 裡，需用 frame 操作
 *   - 左側面板元件在 parent frame，位置固定不隨捲動改變
 *   - 滑鼠座標使用螢幕座標（跨 iframe 有效）
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

// ===== 左側面板元件的固定螢幕座標（不會隨捲動改變）=====
const COORDS = {
  imageTool:  { x: 62, y: 203 },   // 「圖像」元件 (element_list_item_30621876)
  codeTool:   { x: 62, y: 431 },   // 「內嵌程式碼 </>」元件 (element_list_item_92495494)
  publishBtn: { x: 1170, y: 24 },  // 「貼文」按鈕（右上角）
};

// ===== 工具函式 =====
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

/**
 * 慢速拖曳：模擬真人從 (sx,sy) 拖到 (ex,ey)
 */
async function dragSlow(page, sx, sy, ex, ey, steps = 40) {
  console.log(`  🖱️ 拖曳: (${sx}, ${sy}) → (${ex}, ${ey})`);
  await page.mouse.move(sx, sy);
  await sleep(500);
  await page.mouse.down();
  await sleep(300);
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    await page.mouse.move(sx + (ex - sx) * p, sy + (ey - sy) * p);
    await sleep(30);
  }
  await sleep(200);
  await page.mouse.up();
}

/**
 * 取得 editor-frame iframe 物件
 */
async function getEditorFrame(page) {
  const frameHandle = await page.$('#editor-frame');
  if (!frameHandle) return null;
  return await frameHandle.contentFrame();
}

// ===== 主流程 =====
(async () => {
  const { title, html, image } = parseArgs();
  if (!title || !html) {
    console.error('❌ 用法: node auto-post.js --title "標題" --html "HTML" [--image "路徑"]');
    process.exit(1);
  }

  console.log('🚀 啟動瀏覽器...');
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900']
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  try {
    // ===== Step 1: 進入編輯器 =====
    console.log('\n📍 Step 1: 進入編輯器...');
    await page.goto('https://www.weebly.com/editor/main.php#/', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(8000);

    const currentUrl = page.url();
    if (currentUrl.includes('signin') || currentUrl.includes('login')) {
      console.log('  ⚠️ 需要登入，等待手動登入...');
      await page.waitForNavigation({ timeout: 120000, waitUntil: 'networkidle2' }).catch(() => {});
      await page.goto('https://www.weebly.com/editor/main.php#/', { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(8000);
    }
    await shot(page, '01_editor');
    console.log('  ✅ 編輯器已載入');

    // ===== Step 2: 進入 Blog → 新貼文 =====
    console.log('\n📍 Step 2: 進入 Blog → 新貼文...');

    // 點擊「頁面」Tab
    await page.evaluate(() => {
      const items = document.querySelectorAll('a, span, button, li');
      for (const el of items) {
        const txt = el.textContent.trim();
        if (txt === '頁面' || txt === 'Pages') { el.click(); return; }
      }
    });
    await sleep(2000);

    // 點擊 Blog
    await page.evaluate(() => {
      const items = document.querySelectorAll('a, span, li, div');
      for (const el of items) {
        const txt = el.textContent.trim();
        if (txt === 'Blog' || txt === '部落格') { el.click(); return; }
      }
    });
    await sleep(3000);

    // 點擊新貼文
    let newPostOk = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"]');
      for (const b of btns) {
        const txt = b.textContent.trim();
        if (txt.includes('新貼文') || txt === 'New Post') { b.click(); return true; }
      }
      return false;
    });
    if (!newPostOk) {
      await page.mouse.click(1200, 850);
    }
    await sleep(5000);
    await shot(page, '02_new_post');
    console.log('  ✅ 新貼文頁面已開啟');

    // ===== Step 3: 捲動 iframe，填入 Post Title =====
    console.log('\n📍 Step 3: 填入 Post Title...');

    // 將滑鼠移到 iframe 區域，捲動讓 Post Title 可見
    // iframe 位於 (234, 50) ~ (1280, 901)
    await page.mouse.move(640, 500);
    await sleep(300);
    await page.mouse.wheel({ deltaY: 500 });
    await sleep(2000);
    await shot(page, '03a_scrolled');

    // Post Title 捲動後大約在螢幕座標 (620, 310)
    // 點擊 Post Title 欄位
    console.log('  📍 點擊 Post Title 欄位...');
    await page.mouse.click(620, 310);
    await sleep(1000);

    // 使用鍵盤輸入標題（全選後輸入）
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await sleep(200);
    await page.keyboard.type(title, { delay: 30 });
    await sleep(1000);
    await shot(page, '03b_title_filled');
    console.log(`  ✅ 標題已填入: ${title.substring(0, 50)}...`);

    // ===== Step 4: 拖曳「圖像」元件 → 上傳圖片 =====
    if (image && fs.existsSync(image)) {
      console.log('\n📍 Step 4: 拖曳「圖像」元件到「將元件拖到這裡」...');

      // 先捲動讓 drop zone 完全可見（在 Post Title 下方）
      // 捲動後 drop zone 大約在 (620, 495)
      const dropX = 620;
      const dropY = 495;

      await dragSlow(page, COORDS.imageTool.x, COORDS.imageTool.y, dropX, dropY);
      await sleep(4000);
      await shot(page, '04a_image_dropped');

      // 上傳圖片
      console.log('  📍 尋找 file input 上傳圖片...');
      
      // 先在 parent frame 找
      let fileInputs = await page.$$('input[type="file"]');
      
      // 也在 iframe 裡找
      const editorFrame = await getEditorFrame(page);
      if (editorFrame) {
        const iframeInputs = await editorFrame.$$('input[type="file"]');
        if (iframeInputs.length > 0) {
          fileInputs = fileInputs.concat(iframeInputs);
        }
      }

      if (fileInputs.length > 0) {
        // 使用最後一個 file input（通常是最新出現的）
        await fileInputs[fileInputs.length - 1].uploadFile(image);
        console.log(`  ✅ 圖片已上傳: ${path.basename(image)}`);
        await sleep(8000); // 等待上傳完成
      } else {
        console.log('  ⚠️ 找不到 file input，嘗試點擊圖片區域...');
        // 點擊剛放好的元件可能會觸發上傳對話框
        await page.mouse.click(dropX, dropY);
        await sleep(2000);

        fileInputs = await page.$$('input[type="file"]');
        if (editorFrame) {
          const iframeInputs2 = await editorFrame.$$('input[type="file"]');
          fileInputs = fileInputs.concat(iframeInputs2);
        }
        if (fileInputs.length > 0) {
          await fileInputs[fileInputs.length - 1].uploadFile(image);
          console.log(`  ✅ 圖片已上傳 (重試): ${path.basename(image)}`);
          await sleep(8000);
        } else {
          console.log('  ❌ 仍找不到上傳欄位');
        }
      }
      await shot(page, '04b_image_uploaded');

      // 點擊空白處取消選取
      await page.mouse.click(620, 200);
      await sleep(1000);
    } else {
      console.log('\n📍 Step 4: 跳過圖片（無圖片或路徑不存在）');
    }

    // ===== Step 5: 拖曳「內嵌程式碼 </>」元件到圖片下方 → 貼上 HTML =====
    console.log('\n📍 Step 5: 拖曳「內嵌程式碼 </>」到圖片下方...');

    // 先點擊空白處取消任何已選取的元件（避免圖片 popup 干擾）
    await page.mouse.click(100, 50);
    await sleep(500);

    // 圖片上傳後佔據很大面積（~550px 高），需要大幅捲動才能看到圖片下方的 drop zone
    // 捲動 900px（500初始 + 400額外），讓圖片完全離開畫面
    await page.mouse.move(640, 400);
    await sleep(300);
    await page.mouse.wheel({ deltaY: 900 });
    await sleep(2000);
    await shot(page, '05a_scrolled_to_drop_zone');

    // 此時圖片應已在畫面上方，下方的 drop zone / 「0 評論」區域可見
    // 拖曳 code 元件到畫面中央（drop zone 位置）
    const codeDropX = 620;
    const codeDropY = 400;  // 畫面中央，此時應為圖片下方 drop zone

    await dragSlow(page, COORDS.codeTool.x, COORDS.codeTool.y, codeDropX, codeDropY);
    await sleep(4000);
    await shot(page, '05b_code_dropped_below_image');

    // 拖入後，「Click to set custom HTML」文字出現在圖片正下方
    // 從多次截圖確認：文字固定在螢幕座標 y≈725
    console.log('  📍 點擊「Click to set custom HTML」文字...');
    await page.mouse.click(380, 725);  // "Click to set custom HTML" 的精確位置
    await sleep(3000);
    await shot(page, '05c_click_custom_html');

    // 現在應出現「個人化HTML」popup，含「編輯個人化HTML」按鈕
    console.log('  📍 點擊「編輯個人化HTML」按鈕...');

    // 先用 DOM 搜尋
    let clickedEditBtn = await page.evaluate(() => {
      const allEls = document.querySelectorAll('a, button, span, div, [role="button"]');
      for (const el of allEls) {
        const txt = (el.textContent || '').trim();
        if (txt === '編輯個人化HTML' || txt === 'Edit Custom HTML') {
          el.click();
          return txt;
        }
      }
      return null;
    });

    if (!clickedEditBtn) {
      const editorFrame2b = await getEditorFrame(page);
      if (editorFrame2b) {
        clickedEditBtn = await editorFrame2b.evaluate(() => {
          const allEls = document.querySelectorAll('a, button, span, div, [role="button"]');
          for (const el of allEls) {
            const txt = (el.textContent || '').trim();
            if (txt === '編輯個人化HTML' || txt === 'Edit Custom HTML') {
              el.click();
              return txt;
            }
          }
          return null;
        });
      }
    }

    if (clickedEditBtn) {
      console.log(`  ✅ 已點擊「${clickedEditBtn}」`);
    } else {
      // 從之前截圖看到 popup 出現時，「編輯個人化HTML」按鈕在 popup 中央偏上
      // popup 中心大約在 (617, 336)
      console.log('  ⚠️ DOM 找不到按鈕，用座標點擊...');
      await page.mouse.click(617, 336);
    }
    await sleep(3000);
    await shot(page, '05d_edit_html_clicked');

    // 現在應該彈出了 HTML 編輯的 textarea
    console.log('  📍 尋找 HTML textarea 並貼入內容...');

    // 在 parent frame 找最大的可見 textarea
    let htmlPasted = await page.evaluate((htmlContent) => {
      const textareas = document.querySelectorAll('textarea');
      let bestTa = null;
      let bestArea = 0;
      for (const ta of textareas) {
        const area = ta.offsetWidth * ta.offsetHeight;
        if (area > bestArea && ta.offsetWidth > 100 && ta.offsetHeight > 50) {
          bestTa = ta;
          bestArea = area;
        }
      }
      if (bestTa) {
        bestTa.focus();
        bestTa.value = htmlContent;
        bestTa.dispatchEvent(new Event('input', { bubbles: true }));
        bestTa.dispatchEvent(new Event('change', { bubbles: true }));
        return 'parent-textarea';
      }
      const cms = document.querySelectorAll('.CodeMirror');
      for (const cm of cms) {
        if (cm.CodeMirror) { cm.CodeMirror.setValue(htmlContent); return 'parent-codemirror'; }
      }
      return null;
    }, html);

    // 如果 parent 找不到，試 iframe
    if (!htmlPasted) {
      const editorFrame3 = await getEditorFrame(page);
      if (editorFrame3) {
        htmlPasted = await editorFrame3.evaluate((htmlContent) => {
          const textareas = document.querySelectorAll('textarea');
          let bestTa = null;
          let bestArea = 0;
          for (const ta of textareas) {
            const area = ta.offsetWidth * ta.offsetHeight;
            if (area > bestArea && ta.offsetWidth > 100 && ta.offsetHeight > 50) {
              bestTa = ta;
              bestArea = area;
            }
          }
          if (bestTa) {
            bestTa.focus();
            bestTa.value = htmlContent;
            bestTa.dispatchEvent(new Event('input', { bubbles: true }));
            bestTa.dispatchEvent(new Event('change', { bubbles: true }));
            return 'iframe-textarea';
          }
          return null;
        }, html);
      }
    }

    if (htmlPasted) {
      console.log(`  ✅ HTML 已貼入 (${htmlPasted})`);
    } else {
      console.log('  ❌ 找不到 textarea');
    }
    await sleep(1000);
    await shot(page, '05e_html_pasted');

    // 點擊確認/儲存按鈕關閉 HTML 編輯器
    if (htmlPasted) {
      console.log('  📍 尋找確認/儲存按鈕...');
      const saved = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]');
        for (const b of btns) {
          const txt = (b.textContent || b.value || '').trim();
          if (txt === '儲存' || txt === 'Save' || txt === '確定' || txt === 'OK' ||
              txt === 'Done' || txt === '完成' || txt === 'Apply' || txt === '套用') {
            b.click();
            return txt;
          }
        }
        return null;
      });
      if (saved) {
        console.log(`  ✅ 已點擊「${saved}」關閉編輯器`);
      } else {
        console.log('  ⚠️ 找不到儲存按鈕，嘗試按 Escape 關閉...');
        await page.keyboard.press('Escape');
      }
    }
    await sleep(2000);
    await shot(page, '05f_html_saved');

    // ===== Step 6: 點擊「貼文」發布 =====
    console.log('\n📍 Step 6: 點擊「貼文」發布...');

    // 先試 DOM 方式（parent frame）
    const published = await page.evaluate(() => {
      // 右上角的「貼文」按鈕
      const btns = document.querySelectorAll('button, a, [role="button"], .weebly-button');
      for (const b of btns) {
        const txt = b.textContent.trim();
        if (txt === '貼文' || txt === 'Post' || txt === 'Publish') {
          b.click();
          return txt;
        }
      }
      return null;
    });

    if (published) {
      console.log(`  ✅ 已點擊「${published}」！`);
    } else {
      console.log('  ⚠️ DOM 找不到，用座標點擊...');
      await page.mouse.click(COORDS.publishBtn.x, COORDS.publishBtn.y);
    }
    await sleep(5000);
    await shot(page, '06_published');

    console.log('\n🎉 ====== 自動發文流程完成！ ======');
    console.log('📁 截圖目錄: ' + SCREENSHOT_DIR);
    console.log('⚠️  請到瀏覽器中確認文章是否成功發布。');

  } catch (err) {
    console.error('\n❌ 錯誤:', err.message);
    await shot(page, 'error').catch(() => {});
  }

  console.log('\n瀏覽器保持開啟，請確認後手動關閉。');
  browser.on('disconnected', () => process.exit(0));
})();
