var RECORD_SPREADSHEET_ID = '1VOVpscLtE5kj0MIl5hVEH0aWISu1UuTJxzIqNLl9y5w';
var RECORD_SHEET_ID = 0;

function recordSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== RECORD_SPREADSHEET_ID) throw new Error('Wrong record workbook');
  var sheet = spreadsheet.getSheets().filter(function(s) { return s.getSheetId() === RECORD_SHEET_ID; })[0];
  if (!sheet) throw new Error('Record worksheet not found');
  return sheet;
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
function doGet() {
  try {
    var sheet = recordSheet_();
    var count = sheet.getLastRow();
    var best = {};
    var events = [];
    if (count > 1) {
      var rows = sheet.getRange(2,1,count-1,6).getDisplayValues();
      rows.forEach(function(row,index) {
        var event = row[2];
        var match = String(row[3]).match(/第\s*([1-7])\s*關/);
        var key = event === '打破全破總紀錄' ? (/7大關全破/.test(row[4]) ? 'campaign-7' : 'campaign') : event === '打破單關紀錄' && match ? 'stage-'+match[1] : null;
        var seconds = durationSeconds_(row[5]);
        if (event === '通關全破' && /7大關全破/.test(row[4]) && seconds !== null && row[1]) {
          events.push({id:'sheet-'+String(index+2).padStart(10,'0'),playerName:row[1],recordType:'七關全破',
            stageName:row[4],timeFormatted:row[5],date:row[0]});
          return;
        }
        if (!key || seconds === null || !row[1]) return;
        if (best[key] && seconds >= best[key].bestTimeSeconds) return;
        best[key] = {recordKey:key,title:row[3],holderName:row[1],bestTimeSeconds:seconds,
          formattedTime:row[5],wins:null,plays:null,date:row[0]};
        events.push({id:'sheet-'+String(index+2).padStart(10,'0'),playerName:row[1],recordType:row[3],
          stageName:row[4],timeFormatted:row[5],date:row[0]});
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
    if (sheet.getLastRow() === 0) sheet.appendRow(['記錄時間','玩家暱稱','事件類型','紀錄項目','關卡','成績耗時']);
    sheet.appendRow([data.date,data.player,data.event,data.recordName,data.stage,data.time].map(safeCell_));
    return ContentService.createTextOutput('OK');
  } finally {lock.releaseLock();}
}
