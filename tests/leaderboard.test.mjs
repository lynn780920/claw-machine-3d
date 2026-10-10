import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {LeaderboardManager,parseCloudLeaderboard,escapeLeaderboardText} from '../src/leaderboard.ts';

const originalFetch=globalThis.fetch;
let storage;
beforeEach(()=>{
  storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  globalThis.fetch=async()=>{throw new Error('Unexpected network request in test');};
});
afterEach(()=>{globalThis.fetch=originalFetch;delete globalThis.localStorage;});
const record=(name,time=60,plays=null)=>({recordKey:'stage-1',title:'第 1 關 最速紀錄',holderName:name,bestTimeSeconds:time,formattedTime:'01:00',wins:null,plays,date:'2026-10-07 08:00:00'});
const event=(name,date)=>({id:`sheet-${date}`,playerName:name,recordType:'第 1 關 最速紀錄',stageName:'第一關',timeFormatted:'01:00',date,plays:null});

test('fresh players do not see fictional record holders',()=>{
  const manager=new LeaderboardManager();
  assert.deepEqual(manager.getBestRecords(),[]);
  assert.deepEqual(manager.getRecentBreakEvents(),[]);
});

test('migration removes exact demo scores but retains actual player records',()=>{
  storage.set('claw_best_records_v2',JSON.stringify({'stage-1':{...record('娃娃達人',155),date:'2026-09-15 15:30'},
    'stage-2':{...record('實際玩家',70),recordKey:'stage-2'}}));
  const manager=new LeaderboardManager();
  assert.deepEqual(manager.getBestRecords().map(r=>r.holderName),['實際玩家']);
});

test('cloud refresh replaces stale local holders and shows latest events first',async()=>{
  storage.set('claw_best_records_v2',JSON.stringify({'stage-1':record('舊玩家',5)}));
  globalThis.fetch=async()=>({ok:true,json:async()=>({records:[record('雲端玩家')],events:[event('先前玩家','2026-10-06 08:00:00'),event('最新玩家','2026-10-07 08:00:00')]})});
  const manager=new LeaderboardManager();
  assert.equal(await manager.refreshFromGoogleSheets(),true);
  assert.equal(manager.cloudStatus,'connected');
  assert.equal(manager.getBestRecords()[0].holderName,'雲端玩家');
  assert.equal(manager.getRecentBreakEvents()[0].playerName,'最新玩家');
  assert.equal(new LeaderboardManager().getBestRecords()[0].holderName,'雲端玩家');
});

test('invalid cloud responses keep cached records instead of clearing the leaderboard',async()=>{
  storage.set('claw_best_records_v2',JSON.stringify({'stage-1':record('保留玩家')}));
  globalThis.fetch=async()=>({ok:true,json:async()=>({error:'Missing sheet'})});
  const manager=new LeaderboardManager();
  assert.equal(await manager.refreshFromGoogleSheets(),false);
  assert.equal(manager.cloudStatus,'unavailable');
  assert.equal(manager.getBestRecords()[0].holderName,'保留玩家');
  assert.throws(()=>parseCloudLeaderboard({records:[{...record('非法'),bestTimeSeconds:-1}],events:[]}));
});

test('player text cannot inject HTML into the record hall or timeline',()=>{
  assert.equal(escapeLeaderboardText('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('stages five to seven persist and remain visible while cloud confirmation is pending',async()=>{
  globalThis.fetch=async()=>({ok:true,json:async()=>({records:[],events:[]})});
  const manager=new LeaderboardManager();
  manager.sendToGoogleSheets=async()=>false;
  await manager.refreshFromGoogleSheets();
  for(const n of [5,6,7]) assert.equal(manager.checkAndRecordStageWin(n,`第${n}關`,60,'01:00',2,3).isNewRecord,true);
  assert.deepEqual(manager.getBestRecords().map(r=>r.recordKey),['stage-5','stage-6','stage-7']);
  await manager.refreshFromGoogleSheets();
  assert.equal(manager.getBestRecords().length,3);
  assert.equal(new LeaderboardManager().getBestRecords().length,3);
  assert.equal(manager.getRecentBreakEvents().length,3);
});

test('stage eight and its full-campaign record use time then coin count',async()=>{
  const manager=new LeaderboardManager();
  manager.sendToGoogleSheets=async()=>false;
  assert.equal(manager.checkAndRecordStageWin(8,'第八關',60,'01:00',2,4).isNewRecord,true);
  assert.equal(manager.checkAndRecordStageWin(8,'第八關',60,'01:00',2,5).isNewRecord,false);
  assert.equal(manager.checkAndRecordStageWin(8,'第八關',60,'01:00',2,3).isNewRecord,true);
  assert.equal(manager.checkAndRecordGrandVictory(600,'10:00',20,28).isNewRecord,true);
  assert.deepEqual(manager.getBestRecords().map(r=>r.recordKey),['campaign-8','stage-8']);
});

test('only the current campaign is ranked and trophy requires cloud confirmation',async()=>{
  const old={...record('舊七關冠軍',420,12),recordKey:'campaign-7',title:'七關全破紀錄'};
  let champion={...record('原冠軍',600,30),recordKey:'campaign-8',title:'八關全破紀錄'};
  globalThis.fetch=async()=>({ok:true,json:async()=>({records:[old,champion],events:[
    {...event('舊七關冠軍','2026-10-08 12:00:00'),stageName:'7大關全破'},
    {...event('原冠軍','2026-10-09 12:00:00'),stageName:'8大關全破'}
  ]})});
  const manager=new LeaderboardManager();
  manager.sendToGoogleSheets=async()=>false;
  await manager.refreshFromGoogleSheets();
  assert.deepEqual(manager.getBestRecords().map(item=>item.recordKey),['campaign-8']);
  assert.deepEqual(manager.getRecentBreakEvents().map(item=>item.playerName),['原冠軍']);
  assert.equal(manager.getConfirmedGrandChampion().holderName,'原冠軍');
  manager.setPlayerName('挑戰者');
  assert.equal(manager.checkAndRecordGrandVictory(590,'09:50',20,28).isNewRecord,true);
  assert.equal(await manager.confirmCurrentCampaignChampion('挑戰者'),false);
  champion={...champion,holderName:'挑戰者',bestTimeSeconds:590,formattedTime:'09:50',plays:28};
  assert.equal(await manager.confirmCurrentCampaignChampion('挑戰者'),true);
});

test('record detection uses cloud scores, rejects ties and invalid times',async()=>{
  globalThis.fetch=async()=>({ok:true,json:async()=>({records:[record('保持人',10,8)],events:[]})});
  const manager=new LeaderboardManager();
  manager.sendToGoogleSheets=async()=>false;
  await manager.refreshFromGoogleSheets();
  manager.setPlayerName('新玩家');
  assert.equal(manager.checkAndRecordStageWin(1,'第一關',10,'00:10',8,9).isNewRecord,false);
  assert.equal(manager.checkAndRecordStageWin(1,'第一關',10,'00:10',8,7).isNewRecord,true);
  assert.equal(manager.checkAndRecordStageWin(1,'第一關',NaN,'00:00',8,9).isNewRecord,false);
  assert.equal(manager.checkAndRecordStageWin(1,'第一關',9,'00:09',8,9).isNewRecord,true);
});

const backend=await fs.readFile(new URL('../scripts/google-sheet-leaderboard.gs',import.meta.url),'utf8');
function scriptFixture(rows) {
  const writes=[];
  const sheet={getSheetId:()=>0,getLastRow:()=>rows.length+1,getRange:(row,col,count,width)=>{
    if(row===1 && col===7) return {getValue:()=>rows.length ? '投幣數' : '',setValue:value=>writes.push(['header',value])};
    assert.deepEqual([row,col,count,width],[2,1,rows.length,7]);
    return {getDisplayValues:()=>rows.map(r=>[...r,''].slice(0,7))};
  },appendRow:values=>writes.push(values)};
  const context=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet:()=>{
    return {getId:()=>'1VOVpscLtE5kj0MIl5hVEH0aWISu1UuTJxzIqNLl9y5w',getSheets:()=>[{getSheetId:()=>12345,appendRow(){throw new Error('Wrong worksheet touched');}},sheet]};
  }},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
  vm.runInContext(backend,context);
  return {context,writes};
}

test('Apps Script GET reads only gid 0, recomputes global winners and performs no writes',()=>{
  const {context,writes}=scriptFixture([
    ['2026-10-06 12:00','甲','打破單關紀錄','第 1 關 最速紀錄','第一關','02:00'],
    ['2026-10-07 12:00','乙','打破單關紀錄','第 1 關 最速紀錄','第一關','01:00'],
    ['2026-10-07 12:01','丙','打破單關紀錄','第 1 關 最速紀錄','第一關','01:30'],
    ['2026-10-07 12:02','丁','通關全破','通關完成','4大關全破','15:00'],
    ['2026-10-07 12:03','戊','打破全破總紀錄','全破至尊夾王紀錄','4大關全破','14:00']]);
  const data=JSON.parse(context.doGet().text);
  assert.equal(data.records.find(r=>r.recordKey==='stage-1').holderName,'乙');
  assert.equal(data.records.find(r=>r.recordKey==='campaign').holderName,'戊');
  assert.deepEqual(data.events.map(e=>e.playerName),['甲','乙','戊']);
  assert.equal(writes.length,0);
  assert.doesNotThrow(()=>parseCloudLeaderboard(data));
});

test('Apps Script POST adds coin count, locks writes and neutralizes spreadsheet formulas',()=>{
  const {context,writes}=scriptFixture([]);
  const response=context.doPost({postData:{contents:JSON.stringify({date:'2026-10-07 12:00:00',player:'=IMPORTXML("x")',event:'打破單關紀錄',recordName:'第 1 關 最速紀錄',stage:'第一關',time:'00:59',plays:12})}});
  assert.equal(response.text,'OK');
  const recordRow=writes.find(row=>row.length===7);
  assert.equal(recordRow.length,7);
  assert.equal(recordRow[6],12);
  assert.ok(recordRow[1].startsWith("'="));
});

test('cloud returns stages five to seven and separates four-stage and seven-stage totals',()=>{
  const {context,writes}=scriptFixture([
    ...[5,6,7].map(n=>['2026-10-08 12:00','玩家','打破單關紀錄',`第 ${n} 關 最速紀錄`,`第${n}關`,'01:00']),
    ['2026-10-08 12:00','舊玩家','打破全破總紀錄','全破紀錄','4大關全破','04:00'],
    ['2026-10-08 12:00','新玩家','打破全破總紀錄','七關全破紀錄','7大關全破','07:00']]);
  const data=JSON.parse(context.doGet().text);
  assert.equal(data.schemaVersion,2);
  assert.deepEqual(data.records.map(r=>r.recordKey),['stage-5','stage-6','stage-7','campaign','campaign-7']);
  assert.doesNotThrow(()=>parseCloudLeaderboard(data));
  assert.equal(writes.length,0);
});

test('cloud exposes only genuine seven-stage completions for the champion ticker',()=>{
  const {context,writes}=scriptFixture([
    ['2026-10-08 12:00','舊關玩家','通關全破','通關完成','4大關全破','04:00'],
    ['2026-10-08 12:01','新玩家','打破全破總紀錄','七關全破 最速總紀錄','7大關全破','07:00'],
    ['2026-10-08 12:02','最新玩家','通關全破','通關完成','7大關全破','09:00']]);
  const data=JSON.parse(context.doGet().text);
  assert.equal(data.records.find(r=>r.recordKey==='campaign-7').holderName,'新玩家');
  assert.deepEqual(data.events.map(e=>e.playerName),['新玩家','最新玩家']);
  assert.equal(data.events.at(-1).recordType,'7關全破');
  assert.equal(writes.length,0);
});

test('Apps Script reads eighth-stage and eight-stage total without changing sheet columns',()=>{
  const {context,writes}=scriptFixture([
    ['2026-10-08 13:00','玩家甲','打破單關紀錄','第 8 關 最速紀錄','第八關','01:10',5],
    ['2026-10-08 13:01','玩家乙','打破單關紀錄','第 8 關 最速紀錄','第八關','01:10',4],
    ['2026-10-08 13:02','玩家乙','打破全破總紀錄','八關全破 最速總紀錄','8大關全破','12:00',26]
  ]);
  const data=JSON.parse(context.doGet().text);
  assert.equal(data.records.find(r=>r.recordKey==='stage-8').holderName,'玩家乙');
  assert.equal(data.records.find(r=>r.recordKey==='campaign-8').plays,26);
  assert.equal(writes.length,0);
});
