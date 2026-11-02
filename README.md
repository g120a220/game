# 國小冒險學院

台灣國小遊戲化學習平台的第一階段可執行版本。繁體中文、Next.js App Router、React、TypeScript、Tailwind CSS、Phaser、Zod、SQLite、Vitest、Playwright。另提供可驗證的 Supabase/PostgreSQL 基礎 migration。

**目前是本機原創示範，不是正式出版社課程，也沒有完成雲端部署。** 不需要付費服務或帳密即可測試真實資料持久化與角色流程。

## 雙擊啟動（不用輸入指令）

先將整個 ZIP **解壓縮**，再進入專案資料夾：

- Windows：雙擊 **啟動國小冒險學院-Windows.cmd**。
- Mac：雙擊 **啟動國小冒險學院-Mac.command**。若 macOS 首次阻擋未知來源，請在 Finder 對此檔案按右鍵 → 開啟；系統限制無法由程式略過。

啟動器會使用電腦現有的 Node.js 24+（需含 npm），或從 Node.js 官方下載並核對 SHA-256，保存在本資料夾的 `.runtime`，不要求系統管理員權限。第一次會連網安裝依賴，可能需要幾分鐘；準備好後才自動開啟瀏覽器。日後套件未改變就直接啟動。請保留終端機視窗；關閉視窗或按 Ctrl+C 可停止服務。

不覆蓋既有 `.env.local` 與學習資料；3000 埠被其他服務使用時會自動選擇附近可用埠。這是本機網站，不是公開部署。需支援 Node.js 24 的 Windows／macOS 系統；第一次需要網路連線。

## 開始開發

需要 Node.js 24+、npm 與 Chromium。使用現有 checkout；雲端任務本身已隔離，不建立額外 worktree。

```sh
npm ci
cp .env.example .env.local  # 已有本機設定時不要覆蓋
npm run db:init
npm run dev
```

瀏覽器開啟本機 3000 埠。伺服器僅綁定 127.0.0.1；示範角色切換僅允許 localhost／loopback Host，且必須設定 `LOCAL_DEMO_MODE=true`。不要將本模式透過公開反向代理對外提供。未啟用本模式時 API 關閉存取，不自動降級成匿名帳戶。

1. 進入「家長專區」，閱讀說明並同意本地示範資料保存。
2. 可設定家庭約定，例如一起讀一本故事書、需要 10 顆星星。
3. 切換「學生示範」，完成五題原創小任務。第一次完整任務發放 10 顆星星，與答對率無關。
4. 在學習紀錄檢視錯題、解說與知識點觀察。資料不依賴 localStorage，重新整理或重啟服務仍保留。
5. 在「我的夥伴」提出家庭約定，再由家長確認履行。不可兌現。
6. 「教材管理」可匯入草稿，另切換審查員查核；教材來源不會由程式自動認定為真實。

## 驗證

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E 自行在 3100 埠啟動伺服器，僅重置 `.data/e2e.sqlite`，不修改 `.data/academy.sqlite`。測試使用系統 `/usr/bin/chromium`；其他位置透過 `PLAYWRIGHT_CHROMIUM_PATH` 指定。畫面證據輸出至 `/tmp/academy-qa`。正式建置驗證後可使用 `LOCAL_DEMO_MODE=true npm start`；這仍是本機示範服務。

本環境 Turbopack 的 IPC 及新版 Next.js TypeScript CLI 子程序輸出存在相容問題，因此使用官方支援的 webpack 及 TypeScript compiler API。沒有略過型別檢查。版本鎖定於 `package-lock.json`。

## 資料與模組

- `src/lib/db.ts`：SQLite 檔案、交易、初始化及原創示範 seed。
- `src/lib/auth.ts`：本地不透明 session、雜湊儲存、Host／Origin 邊界。
- `src/lib/academy.ts`：伺服器判分、任務、掌握紀錄、獎勵交易與教材審核。
- `src/lib/catalog*.ts`：可擴充的教材架構與參照約束。
- `src/components/adventure-map.tsx`：client-only Phaser 場景、正式圖像素材、DOM 等價操作。
- `src/app/api/academy/route.ts`：Zod 驗證及角色授權入口。
- `supabase/migrations/`：課綱、教科書、題庫版本、學習、家庭、會員及贊助結構；RLS 預設拒絕直接寫入。
- `.agents/skills/`：官方技能與四個經驗證的專案 Skills。

本地檔案在 `.data/academy.sqlite`，包含示範角色、家長授權、答題與家庭約定，不含真實兒童資料。備份時先停止服務或使用 SQLite backup API，不單獨複製仍寫入中的 WAL 主檔。

## 教材架構匯入

後台選擇「課綱與教材架構」的資料種類，介面顯示必要欄位與已保存內容。可以在一個交易匯入多表資料，依被參照資料在前排序。全部成功才保存；重複代碼、缺少參照或前置知識循環會回滾。

```json
{"records":[
  {"table":"subjects","id":"original-math","values":{"code":"original-math","name":"原創數學示範"}},
  {"table":"learning_objectives","id":"original-objective","values":{"subject_id":"original-math","code":"original-objective","title":"原創知識點","description":"待人工查核的示範知識點"}}
]}
```

新題可以填入新建的 `objectiveId`，以 `additionalObjectiveIds` 對應其他知識點，無需修改程式或資料模型。題目版本保留原始內容，不覆寫已存在版本。

## 後續階段與限制

見 [架構與階段驗收](docs/architecture.md)、[教材政策](docs/content-policy.md)、[安全邊界](docs/security.md)、[驗證紀錄](docs/validation.md)。完整出版社版本、正式 Supabase Auth／Storage、帳戶生命週期、支付、廣告與學校功能都未宣稱已完成。
