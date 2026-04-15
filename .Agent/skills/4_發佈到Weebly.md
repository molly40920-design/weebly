---
name: 4_發佈到Weebly
description: 呼叫發布腳本，將完成的文章與封面圖自動發布到 Weebly 網站（支援 siteID 切換）
---
# 發佈到Weebly
你現在是這個系統的自動化執行者。

前三個階段已經完成了「HTML 格式的 SEO 文章」、「SEO 標題與描述」以及「16:9 的封面圖」。
現在的任務是將這些內容推送到 Weebly 上。

## 目標網站設定
- **siteID**：`36681328872592520107`（轉職故事庫）
- 所有設定集中在 `weebly-poster/config.json` 中管理，包括 siteId、視窗大小與拖曳座標。
- 若要切換到其他網站，只需修改 `config.json` 中的 `siteId` 欄位即可。

## 執行步驟：
1. 準備好以下欄位內容：
   - `--title`：階段二產生的 `seo_title`
   - `--seoDesc`：階段二產生的 `seo_description`
   - `--html`：階段二產生的 `html_content`
   - `--image`：階段三產生的 16:9 圖片絕對路徑
2. 執行自動發文腳本：
   ```bash
   cd d:\Anti\Weebly\weebly-poster
   node post-to-weebly-v3.js --title "標題" --seoDesc "SEO描述" --html "HTML內文" --image "圖片路徑"
   ```
3. 該腳本會自動：
   - 使用 `browser-data/` 的已保存登入狀態開啟瀏覽器
   - 根據 `config.json` 中的 `siteId` 先導航至目標網站 Dashboard
   - 點擊「編輯網站」進入編輯器
   - 自動建立新貼文 → 填入標題 → 拖曳圖片元件上傳封面圖 → 拖曳文字元件貼上 HTML → 設定 SEO → 發布
   - 每一步都會在 `screenshots/` 資料夾產出截圖供事後查看
4. 如果過程中出現錯誤或座標偏差，系統會自動截圖。請查看 `screenshots/` 資料夾裡最新的 `error` 截圖來判斷原因。
5. 完成發文後，確認發布截圖，並提供該篇文章的公開連結。

## 自動化座標設定（集中管理於 config.json）
座標已從 `config.json` 的 `coordinates` 物件中讀取，當前設定：
- **文字元件 (T)**：水平 40px，垂直 150px
- **圖片元件 (🖼️)**：水平 40px，垂直 240px
- **圖片拖曳目標**：水平 640px，垂直 450px（正文中央）
- **文字拖曳目標**：水平 640px，垂直 600px（圖片下方）

> ⚠️ 若校準後座標有偏差，請修改 `config.json` 中的座標數值，不需要動腳本本身。
