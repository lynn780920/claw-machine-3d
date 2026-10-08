var RECORD_SPREADSHEET_ID = '1VOVpscLtE5kj0MIl5hVEH0aWISu1UuTJxzIqNLl9y5w';
var RECORD_SHEET_ID = 0;

var STAGE_CONFIG_HEADERS = ['關卡','關卡名稱','機台模式','機台名稱','時限秒數','目標出貨數','清台模式','總鋪貨數量','獎品類型','難度','關卡說明','過關目標','攻略提示','強爪%','轉弱高度%','弱爪%','觸頂震落%','天車速度','下爪速度','甩幅','探爪長度','擋板高度','防甩','爪子倍率','生成範圍','重量倍率','滾動阻力','一般鋪貨數量','指定發光獎品數','最大下爪次數','彈跳台','觸頂強制釋放','物理子步數','關卡提示','爪子尺寸編號'];
var STAGE_CONFIG_KEYS = ['stageNum','name','machineMode','machineLabel','timeLimitSeconds','targetWins','isClearAll','dollCount','prizeType','difficulty','description','objectiveText','strategyHint','strong','weakenHeight','weak','topHit','carriageSpeed','dropSpeed','sway','cableLength','baffleHeight','antiSwing','clawScale','spawnSpread','weight','rollingResistance','basePrizeCount','targetPrizeCount','maxDrops','bounceFloor','forceTopRelease','physicsSubsteps','stageHint','clawSize'];
var STAGE_CLAW_SIZES = [2,3,1,4,2,2,2];
var STAGE_CONFIG_DEFAULTS = [
  [1,'第一關：經典街機 (初試身手)','medium','標準街機 (初試身手)',900,8,false,42,'mixed','簡單','最容易上手的暖身關卡！機台容錯率高，請在 15 分鐘內夾出 8 樣物品即可晉級！','夾出 8 樣娃娃','抓準下爪時機與二收合爪點，利用山頂滾落出貨口！',100,76,69,13,2,2,1.4,9.5,0.7,false,1,4.8,1,1,42,0,0,false,false,2,'',2],
  [2,'第二關：模型公仔 (技術進階)','large','大型機台 (技術進階)',600,4,false,25,'anime','普通','公仔重盒考驗卡爪甩幅！限時 10 分鐘內夾出 4 樣動漫模型盒即可進入清台挑戰！','夾出 4 樣公仔盒','利用甩爪角度或正二拍反擺，卡住外盒角位托出！',95,62,49,15,1.8,2,1.4,7.5,1,false,1.15,4.8,1,1,25,0,0,false,false,2,'',3],
  [3,'第三關：潮玩盲盒 (限時清台戰)','small','小型盲盒機 (清台戰)',480,5,true,5,'blindbox','困難','極速清台任務！盲盒必須在 8 分鐘內全部清空！','清台！(台內 5 盒盲盒全數清空)','台內共 5 盒盲盒，必須全數夾空！',86,68,57,23,3,2,1,9.5,0.1,false,0.85,2.2,0.6,0.35,5,0,0,false,false,2,'',1],
  [4,'第四關：K-霸巨無霸專區','kbasket','K霸直立機台 (魔王決戰)',480,3,false,18,'giant_appliances','地獄魔王','1.35x 霸王巨爪、出貨口無擋板，限時 8 分鐘內夾出 3 樣巨型家電！','夾出 3 樣巨型家電','75% 強爪與 2.0 天車速度，抓取重盒邊緣拉拔！',75,55,43,35,2,2,1.4,9.5,0,false,1.35,6,0.6,0.35,18,0,0,false,false,2,'',4],
  [5,'第五關：一爪翻盤台','medium','三爪撥物機台',600,3,false,18,'mixed','困難','限 30 次下爪出貨 3 樣。用爪子撥動獎品入洞。','30 次下爪內出貨 3 樣','不一定要夾起來；用爪子撥動獎品，讓它滑進洞口。',75,55,43,35,2,2,1.4,9.5,0.3,false,1,4.8,1,1,18,0,30,false,false,2,'剩餘下爪次數：30 次',2],
  [6,'第六關：尋寶台','medium','指定獎品尋寶機台',600,3,false,15,'mixed','困難','指定夾出 3 件微微發光的獎品。','指定夾出 3 件發光獎品','先移開擋住目標的獎品；其他物品出貨不計入尋寶進度。',88,76,65,20,2.6,2,1.6,9.5,0.6,false,1,4.8,0.6,0.35,12,3,0,false,false,2,'指定夾出 3 件微微發光的獎品',2],
  [7,'第七關：幸運彈跳台','medium','彈跳布機台',720,2,false,2,'onepiece','地獄魔王','兩盒一番賞、98% 強爪、100% 觸頂震落，讓彈跳布決定落點！','彈出兩盒一番賞','抓高後掉落，利用彈跳越過 0.7m 擋板，兩盒都出貨才過關。',98,76,98,100,2,2,1.4,9.5,0.7,false,1,3.8,1,1,2,0,0,true,true,8,'彈跳台：觸頂必掉，兩盒一番賞都出貨才過關',2]
];

function recordSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== RECORD_SPREADSHEET_ID) throw new Error('Wrong record workbook');
  var sheet = spreadsheet.getSheets().filter(function(s) { return s.getSheetId() === RECORD_SHEET_ID; })[0];
  if (!sheet) throw new Error('Record worksheet not found');
  return sheet;
}

function configSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== RECORD_SPREADSHEET_ID) throw new Error('Wrong record workbook');
  var sheets = spreadsheet.getSheets();
  if (sheets.length < 2) throw new Error('工作表2不存在');
  return sheets[1];
}

function announcementSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== RECORD_SPREADSHEET_ID) throw new Error('Wrong record workbook');
  var sheets = spreadsheet.getSheets();
  if (sheets.length < 3) throw new Error('工作表3不存在');
  return sheets[2];
}

function setupAnnouncementSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== RECORD_SPREADSHEET_ID) throw new Error('Wrong record workbook');
  while (spreadsheet.getSheets().length < 3) spreadsheet.insertSheet('工作表' + (spreadsheet.getSheets().length + 1));
  var sheet = spreadsheet.getSheets()[2];
  var values = [
    ['設定項目','設定內容'],
    ['啟用',true],
    ['公告版本','2026-10-08-machine-reset'],
    ['標題','開發者公告'],
    ['日期','2026/10/08'],
    ['公告內容','已全面更新機台參數，\n並且將所有挑戰者紀錄清零\n歡迎玩家重新挑戰至尊魔王寶座']
  ];
  sheet.clear();
  sheet.getRange(1,1,values.length,2).setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,2).setFontWeight('bold').setBackground('#17324d').setFontColor('#ffffff');
  sheet.getRange(2,1,values.length-1,1).setFontWeight('bold').setBackground('#e8f0f7');
  sheet.getRange(1,1,values.length,2).setVerticalAlignment('top');
  sheet.getRange(6,2).setWrap(true);
  sheet.setColumnWidth(1,140);
  sheet.setColumnWidth(2,520);
  sheet.setRowHeight(6,90);
  return '工作表3已建立開發者公告設定';
}

function readAnnouncement_() {
  var sheet = announcementSheet_();
  if (sheet.getLastRow() < 2) return null;
  var settings = {};
  sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().forEach(function(row) {
    settings[String(row[0]).trim()] = row[1];
  });
  var dateValue = settings['日期'];
  var dateText = Object.prototype.toString.call(dateValue) === '[object Date]' && !isNaN(dateValue.getTime())
    ? Utilities.formatDate(dateValue,Session.getScriptTimeZone() || 'Asia/Taipei','yyyy/MM/dd')
    : String(dateValue || '').slice(0,40);
  return {
    enabled: settings['啟用'] === true || String(settings['啟用']).toUpperCase() === 'TRUE',
    version: String(settings['公告版本'] || '').slice(0,80),
    title: String(settings['標題'] || '開發者公告').slice(0,80),
    date: dateText,
    message: String(settings['公告內容'] || '').slice(0,1000)
  };
}

function setupStageConfigSheet() {
  var sheet = configSheet_();
  var values = [STAGE_CONFIG_HEADERS].concat(STAGE_CONFIG_DEFAULTS);
  sheet.getRange(1,1,Math.max(sheet.getLastRow(),values.length),STAGE_CONFIG_HEADERS.length).clearContent();
  sheet.getRange(1,1,values.length,STAGE_CONFIG_HEADERS.length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,STAGE_CONFIG_HEADERS.length).setFontWeight('bold').setBackground('#17324d').setFontColor('#ffffff');
  sheet.autoResizeColumns(1,STAGE_CONFIG_HEADERS.length);
  return '工作表2已寫入七關參數';
}

function addStageClawSizeColumn() {
  var sheet = configSheet_();
  var column = STAGE_CONFIG_HEADERS.length;
  if (sheet.getMaxColumns() < column) sheet.insertColumnsAfter(sheet.getMaxColumns(),column-sheet.getMaxColumns());
  var currentHeader = String(sheet.getRange(1,column).getValue() || '').trim();
  if (currentHeader === '爪子尺寸編號') return '工作表2已有爪子尺寸編號';
  var columnData = sheet.getRange(1,column,Math.max(sheet.getLastRow(),1),1).getValues();
  if (columnData.some(function(row) {return row[0] !== '' && row[0] !== null;})) throw new Error('工作表2下一欄已有資料，為保留內容未新增');
  sheet.getRange(1,column).setValue('爪子尺寸編號');
  var stages = sheet.getRange(2,1,7,1).getValues();
  var sizeRange = sheet.getRange(2,column,7,1);
  sizeRange.setValues(stages.map(function(row) {
    var stageNum = Number(row[0]);
    return [STAGE_CLAW_SIZES[stageNum-1] || 2];
  }));
  sheet.getRange(1,column).setFontWeight('bold').setBackground('#17324d').setFontColor('#ffffff')
    .setNote('1=小爪 0.85x；2=標準爪 1.0x；3=大爪 1.15x；4=巨爪 1.35x');
  sizeRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['1','2','3','4'],true).setAllowInvalid(false).build());
  sheet.setColumnWidth(column,110);
  return '工作表2已新增爪子尺寸編號（1-4）';
}

function setupLeaderboardCoinColumn() {
  var sheet = recordSheet_();
  if (!sheet.getRange(1,7).getValue()) sheet.getRange(1,7).setValue('投幣數');
  return '排行榜已新增投幣數欄位';
}

function readStageConfigs_() {
  var sheet = configSheet_();
  if (sheet.getLastRow() < 2) return [];
  var columnCount = Math.min(sheet.getLastColumn(),STAGE_CONFIG_KEYS.length);
  return sheet.getRange(2,1,sheet.getLastRow()-1,columnCount).getValues().map(function(row) {
    var config = {};
    STAGE_CONFIG_KEYS.forEach(function(key,index) {config[key] = row[index];});
    return config;
  }).filter(function(config) {return Number(config.stageNum) >= 1 && Number(config.stageNum) <= 7;});
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function durationSeconds_(time) {
  var match = String(time).trim().match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  return match[3] === undefined ? Number(match[1])*60+Number(match[2]) : Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
}

// Read only the existing six leaderboard columns; no sheet mutations in GET.
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'stage-config') {
      return jsonOutput_({schemaVersion:1,configs:readStageConfigs_()});
    }
    if (e && e.parameter && e.parameter.action === 'announcement') {
      return jsonOutput_({schemaVersion:1,announcement:readAnnouncement_()});
    }
    var sheet = recordSheet_();
    var count = sheet.getLastRow();
    var best = {};
    var events = [];
    if (count > 1) {
      var rows = sheet.getRange(2,1,count-1,7).getDisplayValues();
      rows.forEach(function(row,index) {
        var event = row[2];
        var match = String(row[3]).match(/第\s*([1-7])\s*關/);
        var key = event === '打破全破總紀錄' ? (/7大關全破/.test(row[4]) ? 'campaign-7' : 'campaign') : event === '打破單關紀錄' && match ? 'stage-'+match[1] : null;
        var seconds = durationSeconds_(row[5]);
        var plays = /^\d+$/.test(String(row[6])) ? Number(row[6]) : null;
        if (event === '通關全破' && /7大關全破/.test(row[4]) && seconds !== null && row[1]) {
          events.push({id:'sheet-'+String(index+2).padStart(10,'0'),playerName:row[1],recordType:'七關全破',
            stageName:row[4],timeFormatted:row[5],date:row[0],plays:plays});
          return;
        }
        if (!key || seconds === null || !row[1]) return;
        if (best[key] && (seconds > best[key].bestTimeSeconds ||
          (seconds === best[key].bestTimeSeconds && (plays === null || plays >= (best[key].plays === null ? Infinity : best[key].plays))))) return;
        best[key] = {recordKey:key,title:row[3],holderName:row[1],bestTimeSeconds:seconds,
          formattedTime:row[5],wins:null,plays:plays,date:row[0]};
        events.push({id:'sheet-'+String(index+2).padStart(10,'0'),playerName:row[1],recordType:row[3],
          stageName:row[4],timeFormatted:row[5],date:row[0],plays:plays});
      });
    }
    return jsonOutput_({schemaVersion:2,records:Object.keys(best).map(function(key) {return best[key];}),events:events.slice(-50)});
  } catch (error) {return jsonOutput_({error:String(error.message)});}
}

function safeCell_(value) {
  var text = String(value === undefined ? '' : value).slice(0,200);
  return /^[=+\-@]/.test(text) ? "'"+text : text;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    if (!['打破單關紀錄','打破全破總紀錄','通關全破'].includes(data.event) ||
      typeof data.player !== 'string' || !data.player.trim() || durationSeconds_(data.time) === null) {
      return jsonOutput_({error:'Invalid record'});
    }
    var sheet = recordSheet_();
    if (sheet.getLastRow() === 0) sheet.appendRow(['記錄時間','玩家暱稱','事件類型','紀錄項目','關卡','成績耗時','投幣數']);
    if (!sheet.getRange(1,7).getValue()) sheet.getRange(1,7).setValue('投幣數');
    var row = [data.date,data.player,data.event,data.recordName,data.stage,data.time].map(safeCell_);
    row.push(Number.isFinite(Number(data.plays)) ? Math.max(0,Math.round(Number(data.plays))) : '');
    sheet.appendRow(row);
    return ContentService.createTextOutput('OK');
  } finally {lock.releaseLock();}
}
