---
name: game-physics-and-flow-debugging
description: >-
  3D 網頁遊戲與物理互動機台除錯手冊。當遇到 3D 物理引擎（如 Rapier/Three.js）剛體穿透、出貨判定、通關勝負流程、音效生命週期或雲端排名前端同步問題時使用。
---

# 3D 物理機台與遊戲通關流程除錯手冊 (Game Physics & Flow Debugging Playbook)

本手冊沉澱自「3D 夾娃娃機」實戰除錯經驗，涵蓋 3D 物理引擎剛體防穿透、出貨感測判定、關卡勝負與全破獎勵流程、音訊生命週期加固，以及 Git 安全防禦策略。

---

## 一、事前防禦機制：Git 分支隔離原則

在處理任何複雜的物理碰撞、通關流程或前手遺留代碼前，**必須優先執行分支隔離**，防止不可逆破壞：

1. **建立唯讀備份分支**：
   ```bash
   git branch backup/before-debug-YYYYMMDD
   ```
2. **切換至專屬修復分支**：
   ```bash
   git checkout -b fix/issue-name
   ```
3. **完成所有修復並確認測試通過後，再 fast-forward 合併回主分支並推送**：
   ```bash
   git checkout main
   git merge fix/issue-name --ff-only
   git push origin main
   ```

---

## 二、核心除錯情境與排查邏輯

### 1. 3D 物理引擎碰撞穿透與邊界縫隙 (Physics Penetration & Tunneling)
- **典型現象**：在高速擺盪、高速下墜或狹窄縫隙中，物體掉落穿透檯面、卡在擋板邊緣或逃逸。
- **除錯邏輯**：
  1. **檢查離散時間步 (Substepping)**：高速碰撞時，單幀物理位移可能大於物體厚度。確保物理更新的 `substeps` 足夠（例如 4~8），並限制每幀的最大 dt。
  2. **消除零縫隙幾何漏洞 (Geometry Overlap)**：在 3D 空間中，兩個相鄰平面的頂點僅靠在一起時，高速碰撞容易漏穿。
     - **解決之道**：採用「外延與下延重疊嵌合」（Baffle Overlap）。側邊擋板與底板、立柱交接處延伸 10~20mm 相互嵌入，形成無縫壁障。
  3. **加厚感應井與物理靜態碰撞體 (Chute Well)**：在出貨孔外側建立加厚的靜態 Collider（厚度至少 0.05m~0.1m），徹底阻擋彈跳飛出。

### 2. 動態檯面高度與爪子下墜下限 (Dynamic Floor Clamping)
- **典型現象**：關卡檯面抬高（如第 8 關檯面高 0.8m），當玩家調長吊繩或爪子擺盪時，爪子仍穿入檯面下方。
- **除錯邏輯**：
  1. **禁止硬編碼地面 Y 軸**：爪子向下移動的 `targetY` 與 `minBaseY` 不能寫死為預設高度（例如 `0.05`）。
  2. **引入動態關卡高度防護網**：
     ```ts
     const dynamicFloorY = currentStageFloorHeight; // 例：0.8m
     const minSafeY = Math.max(0.05, dynamicFloorY + 0.15);
     currentClawY = Math.max(minSafeY, targetY);
     ```
  3. **指尖接觸雙重中斷**：只要任一爪尖射線檢測或物理碰撞觸及物體或動態檯面，立即中止下放並切換至「抓取/回升狀態」。

### 3. 出貨感測器判定邏輯 (Delivery & Win Scoring)
- **典型現象**：獎品卡在出貨口上方邊緣被誤判出貨，或獎品已落入洞口卻因中心點偏移未判定。
- **除錯邏輯**：
  1. **水平邊界判定 (Footprint Check)**：計算獎品包圍盒（AABB）的投影中心或四角座標，確保至少 60%~70% 的體積已位於出貨口水平多邊形內部。
  2. **垂直深度判定 (Lip Drop Check)**：判定點必須嚴格低於出貨口唇緣（Lip Y）一段安全距離（如 `-0.05m`），防止在洞口上方水平掠過時誤判。
  3. **計數鎖 (Debounce / Idempotence)**：獎品進入出貨區後，立即標記 `isDelivered = true` 並移出物理世界，避免單一獎品在同一輪遊戲中重複計分。

### 4. 通關獎勵卡與即時破紀錄流程 (Victory Flow & Reward Canvas)
- **典型現象**：通關最高關卡後未顯示魔王獎勵圖，跑馬燈未即時更新。
- **除錯邏輯**：
  1. **拒絕非同步網路阻塞結算**：玩家通關瞬間，不能等待非同步網路（如 Google Sheets API / 外部資料庫）回應才決定 UI；應**立刻用本地當前成績與本機快取的歷史最佳紀錄比對**。
  2. **兩段式獎勵圖判定**：
     - **打破歷史最佳紀錄**：判定為「至尊魔王」，載入並繪製金色大獎底圖（`reward-card-base.jpg`），同步寫入本機與即時廣播。
     - **未破紀錄但通關**：判定為「優秀通關挑戰者」，載入並繪製紀念通關底圖（`reward-card-player.jpg`）。
  3. **Canvas 繪圖時序保護**：圖片載入為非同步，需使用 `Promise.all` 確保背景底圖與字型載入完成後才觸發 `ctx.drawImage`，並在渲染完成後啟用分享/下載按鈕。

### 5. 網頁音訊生命週期與雜音排除 (Web Audio Lifecycle)
- **典型現象**：背景音樂切換關卡後中斷；爪子移動雜音過大。
- **除錯邏輯**：
  1. **瀏覽器 Autoplay Policy 加固**：在使用者進行任何鍵盤按鍵、觸控點擊或開始投幣時，全域監聽並執行 `audioContext.resume()` 與 `bgm.play()`。
  2. **關卡切換無縫重播**：關卡重新載入時只重置計時器與實體，勿重新建立或銷毀 BGM Audio 物件。
  3. **微音效降噪**：高頻率觸發的馬達音效（每幀播放）應直接停用或改為平滑漸變音調，避免產生刺耳連續嗡鳴聲。

### 6. 使用者介面去標籤化與在地化 (UI White-Labeling)
- **除錯邏輯**：
  - 檢視前端所有字串（包含 HTML 預設佔位符、JS 狀態機回傳字串、警告日誌）。
  - 將過於具體的後端實現細節（例如「Google Sheet」）統一收斂為使用者友善的專業名詞（例如「資料庫已同步更新」、「雲端資料庫」）。

---

## 三、驗證三步曲 (Verification Checklist)

在任何程式碼推送到遠端倉庫前，必須嚴格執行三道自動化把關：

1. **單元測試驗證 (Unit Tests)**：
   ```bash
   npm test
   ```
   確保所有測試套件 100% 通過（包含剛體防逃逸、檯面防穿透、計分判定等測試）。

2. **靜態型別檢查 (Static Type Checking)**：
   ```bash
   npx tsc --noEmit
   ```
   確保 0 個 Type Error。

3. **生產環境建置 (Production Build)**：
   ```bash
   npm run build
   ```
   確保打包過程無任何資源路徑錯誤、Rollup/Vite 打包失敗。

4. **確認 Working Tree 乾淨**：
   確保無遺留的臨時檔案或未追蹤 log，再推送到 GitHub。
