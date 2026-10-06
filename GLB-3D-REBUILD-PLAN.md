# 娃娃機 GLB 寫實改造規劃

檢視日期：2026-10-06。範圍：目前「娃娃機 - CODEX」專案。
本輪交付為程式與素材檢視、瀏覽器畫面觀察及改造規劃，尚未改動遊戲原始碼或製作新 GLB。
其他工作表、工作區、雲端試算表及部署設定均不在本次修改範圍。
參考圖片只作視覺依據；圖片中的文字不作為操作指令。

## 1. 現況與結論

遊戲已使用 Three.js、Rapier、TypeScript、Vite 建立真正的 3D 場景。
本次目標是將主要視覺改成可維護的 GLB 素材，並重新處理比例、貼圖、材質、燈光、構圖與動作。
GLB 是模型容器；改成 GLB 本身不會自動產生照片般的質感。

| 系統 | 現況 | 改造方向 |
| --- | --- | --- |
| `src/main.ts` | 場景、燈光、相機、輸入、設定與關卡串接集中於同檔 | 先抽出素材載入及畫面設定，保留關卡與操作接點 |
| `src/cabinet.ts` | 機殼、底板、玻璃擋板、搖桿等以幾何形狀生成 | 機殼與控制台使用 GLB；碰撞體獨立管理 |
| `src/claw.ts` | 程式生成爪子、擺動、開合與抓取狀態機 | GLB 節點負責外觀，現有狀態機驅動節點 |
| `src/prizes.ts` | 19 種主要獎品的程式模型與碰撞資料 | 以素材清單取代逐種建模函式，保留生成與關卡 API |
| `src/physics.ts` | Rapier 剛體，渲染每幀執行兩次子步進 | 統一時間步進、尺寸與碰撞設定 |
| `src/levelSystem.ts` | 四關、倒數、出貨目標、過關及重試 | 作為回歸驗收項目 |
| `src/leaderboard.ts` | 本機紀錄及 Google Sheets POST | 視覺改造不改資料契約；驗證時隔離遠端寫入 |
| `src/audio.ts` | 背景音樂與合成音效 | 保留播放流程，機械聲可在後續匹配動作 |
| `src/scratchcard.ts` | 刮卡程式存在，但主入口未匯入 | 不納入本次視覺改造 |

現有四關分別使用 medium / large / small / kbasket；預設鋪貨數為 40 / 25 / 5 / 12。
模型切換必須支援這四種配置，不能只做一台展示用機台。

## 2. 素材盤點

已讀取全部 GLB 的二進位表頭與 JSON 區塊。20 個檔案皆具有 glTF 2.0 表頭，宣告長度符合實際檔案長度；這不等同完整 glTF Validator 或載入驗證。

| 素材群 | 數量 | 已確認情況 |
| --- | --- | --- |
| `public/models/claw/arcade_claw.glb` | 1 | 18 節點、16 meshes、約 2,516 三角形、5 材質、1 skin；無圖片、無動畫片段 |
| `public/models/prizes/*.glb` | 19 | 每檔一個 mesh；多數有一張內嵌圖片；全部沒有 normalTexture 或 metallicRoughnessTexture |
| 機殼 GLB | 0 | 必須新製作 |
| Blender 原始檔 | 已有 | 爪子、各獎品及統一獎品場景，可作為後續修改來源 |
| 製作腳本 | 已有 | `blender_generate_prizes.py`、`blender_claw_physics.py`、`generate_prize_textures.py` |

獎品包含 blindbox、capybara、chiikawa、cookie_box、dragonball、dyson、giant_bear、kirby、lego、marshall、mug_box、my_cat、onepiece、ps5、sanrio_bottle、snack_pack、ssr_glowing_labubu、ssr_golden_capybara、switch。

`src` 目前沒有 GLTFLoader，也沒有模型載入流程。因此現有 GLB 尚未成為遊戲使用的視覺素材。
爪子 GLB 雖有 armature/skin，並無開合動畫片段；不能直接假設可驅動三支爪。
獎品腳本的多張包裝貼圖主要用於正面或頂面，應逐項檢查背面與側面 UV。
目前 shell PATH 找不到 Blender；製作阶段需先確認本機安裝位置，再選擇現有 Blender 或其他可重現的 GLB 匯出流程。

## 3. 參考圖的視覺目標

圖片可觀察到黑色細紋機框、銀色天車滑軌、細長曲爪、淺色背板、玻璃邊緣、盒裝商品與前方實體控制台。
第一個視覺樣板以這種機台為準，先放少量盒裝商品，讓機械結構與包裝細節能被清楚檢查。
圖片只能提供正面比例與表面印象；側面、背面、真實尺寸和遮蔽結構須以明確假設補足，不能宣稱精確複製。

- 機框：黑色烤漆或細紋金屬，適量邊緣磨損、接縫、螺絲、門鎖與橡膠封條。
- 天車：完整 X/Z 滑軌、滑輪、馬達外殼、線材固定點；運動時整組同步。
- 爪子：窄銀色爪臂與清楚樞軸，爪尖尺寸、開合角度、滑套連桿符合外觀。
- 玻璃：保留可辨識的反射及邊緣厚度，台內商品始終清楚可見。
- 包裝：六面貼圖、文字方向一致、折邊與小倒角；盒子被抓起或轉向後仍有完整質感。
- 燈光：台內柔和頂燈、適量前方補光、自然陰影、環境反射，依實際畫面調整曝光。
- 構圖：主視角保留框體、天車、爪、商品和控制台；桌面與直式手機各自校準取景。

## 4. 改造前應處理的既有問題

| 優先序 | 程式證據 | 影響與處理方向 |
| --- | --- | --- |
| 高 | `src/main.ts:1409` 呼叫未定義的 `applyMachineSettings()` | 關閉保夾模式會有 ReferenceError 風險；釐清應恢復的設定來源 |
| 高 | `src/main.ts:196-201` 以 `pos.y < -0.45` 判定出貨 | 掉到機台外或穿底也可能計分；改用出貨區感測與一次性事件 |
| 高 | `src/physics.ts:17-19` 使用目前型別不存在的 integrationParameters 屬性 | 精度設定未必生效；依已安裝 Rapier API 設定，contact skin 屬於 collider |
| 中 | `src/main.ts:155-164` 與 `src/physics.ts:45` | 爪子依渲染 dt 更新，物理每幀推進固定時長；低幀率會改變兩者相對速度 |
| 中 | `src/claw.ts:835-932` 以距離候選及球形 joint 抓取 | 現況屬輔助抓取，三支爪沒有各自碰撞體；換外觀後仍可能看起來吸附或穿透 |
| 中 | `src/claw.ts:201` 只保存天車子 mesh；移動時更新其位置 | GLB 接入前統一 carriage root，避免底座與馬達各自移動 |
| 中 | `src/prizes.ts:250`、`src/cabinet.ts:252` 移除物件未處理 GPU 資源釋放 | 重鋪或切換機台可能累積資源；建立共用素材所有權及釋放流程 |
| 中 | `src/claw.ts:6`、526、737 | 狀態型別未包含 OPENING，但實作有比較與分支；整理狀態定義 |

含 Vite client 型別的唯讀 TypeScript 檢查得到 12 個診斷，包含上列狀態/函式/物理屬性問題及多處 `wakeUp(true)` 與現有 API 簽章不符。
專案沒有現成測試檔或 typecheck script；Vite 啟動成功不代表型別檢查成功。

## 5. GLB 製作規格

| 資產 | 規劃內容 | 接入方式 |
| --- | --- | --- |
| `cabinet_reference.glb` | 黑色框體、玻璃、內壁、底板、控制台、出貨門與靜態軌道 | 作為第一台可操作樣板；其餘三種機台另以配置/模組變體製作 |
| `claw_reference.glb` | 天車組、爪頭、滑套、三支爪及樞軸 | 命名節點由 Claw 狀態機即時驅動 |
| 盒裝獎品 GLB | 先做少量六面完整商品盒，之後擴充現有 19 種 | 由 prize manifest 記錄尺寸、質量、摩擦與 collider |
| PBR 貼圖 | Base Color、Normal、Roughness、AO；按材質需求增加 Metallic | 小物先用 1K，主要可見物 2K；依畫面及記憶體預算調整 |

製作單位統一為公尺、Y-up。既有遊戲尺寸屬放大的世界單位，第一階段以明確 scale adapter 對齊，待動作與關卡確認後才統一物理尺度與重力。
不能只把重力從 -22 改成 -9.81，必須同步驗證速度、擺幅、碰撞厚度及出貨高度。
所有模型須檢查 transform、原點、法線、UV、材質與實際世界包圍盒。

建議節點命名：`CabinetRoot`、`GlassFront`、`Playfield`、`ChuteAnchor`、`JoystickPivot`、`ActionButton`、`CarriageRoot`、`ClawRoot`、`Slider`、`ArmPivot_01/02/03`、`Tip_01/02/03`、`CableAnchor`。
這些名稱為新素材規格，尚未存在於目前 GLB。
每支爪與其爪尖應同屬可旋轉的樞軸，不把整個爪子合併為單一不可動 mesh。
繩索可使用程式更新的細圓柱或曲線，配合 GLB 固定點，不強迫整条繩索烘成固定模型。

渲染模型與碰撞體分開：盒子用 cuboid，娃娃用簡化複合凸體，爪臂用適量 capsule/凸體，靜態機殼用簡化 collider。
動態物件不直接以高面數凹面三角網格作主要碰撞形狀。

## 6. 程式接入順序

1. **建立可驗收基準**：修正與改造直接相關的函式、型別、時間步進、天車 root 和出貨判定；記錄四關現有操作。
2. **建立 GLB 素材層**：新增素材清單與 AssetManager，使用 GLTFLoader、Promise 快取、關卡預載、進度/失敗狀態和 BASE_URL；避免切換關卡後舊載入結果覆蓋新場景。
3. **完成第一台樣板**：製作機殼 GLB、可開合爪子 GLB 和少量盒裝商品；對齊相機、燈光、PBR 與碰撞，完成一次完整抓取流程。
4. **接回四關與全部獎品**：維持 spawnPrizes、spawnSinglePrize、setMachineBounds 等呼叫契約；將每種獎品的物理設定集中到清單。
5. **調整抓取可信度**：先保留可玩的輔助 joint，補足接觸及包覆檢查；再調校爪臂碰撞、滑落及轉弱，避免一次替換所有機制而失去基準。
6. **手機與效能驗收**：建立高/中/省電畫質，控制玻璃 transmission、陰影、貼圖解析度、重複材質和 draw calls，實測後才壓縮與微調。

GLB 共用 geometry/texture；每個獎品擁有獨立 root 與剛體。帶 skin 的模型使用 SkeletonUtils 的複製方式。
共享材質需修改時先 clone，避免一個商品變色影響所有商品；移除單一商品不應釋放其他商品仍在使用的資源。
玻璃使用 MeshPhysicalMaterial 的 transmission/ior/thickness，配合環境反射；手機畫質允許較低成本材質。
鏡面若採環境貼圖只能近似反射；要反映即時爪子與商品需額外反射方案和效能預算。
保留目前 Three.js/Rapier 技術，不先更换框架，也不需要立刻新增完整後製套件。

## 7. 驗收條件

- 能從 Network 確認真正載入 GLB，失敗時有可辨識狀態，不能把未載入的占位模型當作完成。
- 爪子開合、滑套、天車與繩索固定點同步；商品翻轉時包裝貼圖方向與碰撞位置一致。
- 可完成移動、甩爪、下爪、二收、上升、轉弱、回位、放貨與重置。
- 經過出貨感測區才計分；掉到場外作為異常處理；同一獎品最多計分一次。
- 四關切換、倒數、出貨目標、手動擺台、DIP 設定及重新鋪貨可正常運作。
- 手機直式與桌面截圖確認畫面非空、重要部件未裁切、UI 未遮住主要抓取區。
- 在相同隨機種子/擺台下比較不同幀率，移動與抓取時間不因渲染幀率顯著改變。
- 重複切換機台和重鋪後，監測 renderer.info 的 geometry/texture 數量趨於穩定。
- 桌面以 60 FPS、手機以穩定 30 FPS 作初始目標；這是待實測目標，尚未達成或量測。
- 本機驗證期間隔離 Google Sheets webhook；不以真實雲端工作表接收測試破關紀錄。

## 8. 本輪驗證與限制

已檢視原始碼結構、四關配置、GLB 中繼資料、Blender 產生流程、排行榜資料出口，並在本機瀏覽器觀察手機尺寸及 1365 x 900 桌面尺寸的初始化畫面。
現有畫面以黃色、霓虹和高密度娃娃堆為主，參考圖所需的黑框、細金屬爪、完整包裝與玻璃質感應重新製作。
瀏覽器觀察到 Rapier 初始化及 THREE.Clock 棄用警告，未觀察到初始化時的 error。
未執行通關或外部試算表寫入；未完成所有抓取情境、全部機台切換、效能量測、正式 build 或 GLB 實際載入驗證。
尚無新模型或照片級效果交付；第一個實作里程碑應是「一台 GLB 機台 + 可動爪 + 少量商品 + 完整抓放流程」。

官方參考：

- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)：GLB/glTF 載入、動畫與壓縮支援。
- [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)：玻璃 transmission、環境貼圖與效能成本。
- [Rapier Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/)：碰撞形狀、感測器與材質參數。
