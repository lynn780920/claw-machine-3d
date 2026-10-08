export interface BestRecordItem {
  recordKey:string;
  title:string;
  holderName:string;
  bestTimeSeconds:number;
  formattedTime:string;
  wins:number|null;
  plays:number|null;
  date:string;
}

export interface RecordBreakEvent {
  id:string;
  playerName:string;
  recordType:string;
  stageName:string;
  timeFormatted:string;
  date:string;
}

const NICKNAME_KEY = 'claw_player_nickname';
const BEST_RECORDS_KEY = 'claw_best_records_v2';
const RECORD_EVENTS_KEY = 'claw_record_events_v2';
const FICTIONAL_RECORDS:Record<string,string> = {
  'stage-1':'娃娃達人|155|2026-09-15 15:30','stage-2':'甩爪老手|210|2026-09-15 16:10',
  'stage-3':'清台神手|260|2026-09-15 18:40','stage-4':'K霸制霸者|320|2026-09-15 20:05',
  campaign:'至尊傳奇|945|2026-09-15 20:10'
};
const DEFAULT_GSHEET_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxYVkvXwZ9X9mJN0DZwxh8Cq1tGIarXs1bCpfwytfQkR7VnraTz8YzDlwlV8OgRWqpa/exec';

function isRecord(value:unknown):value is BestRecordItem {
  if (!value || typeof value!=='object') return false;
  const r = value as BestRecordItem;
  return /^(campaign|campaign-7|stage-[1-7])$/.test(r.recordKey) &&
    ['title','holderName','formattedTime','date'].every(k=>typeof r[k as keyof BestRecordItem]==='string') &&
    Number.isFinite(r.bestTimeSeconds) && r.bestTimeSeconds>=0 &&
    [r.wins,r.plays].every(n=>n===null || (typeof n==='number' && Number.isFinite(n) && n>=0));
}

function isEvent(value:unknown):value is RecordBreakEvent {
  return !!value && typeof value==='object' &&
    ['id','playerName','recordType','stageName','timeFormatted','date'].every(k=>typeof (value as Record<string,unknown>)[k]==='string');
}

export function parseCloudLeaderboard(value:unknown) {
  const data = value as {records?:unknown;events?:unknown;error?:unknown};
  if (!data || data.error || !Array.isArray(data.records) || !Array.isArray(data.events) ||
    !data.records.every(isRecord) || !data.events.every(isEvent)) throw new Error('Invalid cloud leaderboard response');
  return {records:data.records as BestRecordItem[],events:data.events as RecordBreakEvent[]};
}

export function escapeLeaderboardText(value:string):string {
  return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
}

export class LeaderboardManager {
  private currentPlayer = '';
  private bestRecords:Record<string,BestRecordItem> = {};
  private breakEvents:RecordBreakEvent[] = [];
  private cloudRecords:Record<string,BestRecordItem>|null = null;
  private cloudEvents:RecordBreakEvent[]|null = null;
  private refreshTask:Promise<boolean>|null = null;
  private pendingRecords:Record<string,BestRecordItem> = {};
  public cloudStatus:'loading'|'connected'|'unavailable' = 'unavailable';
  public onRecordsUpdated?:()=>void;

  constructor() {
    try {
      this.currentPlayer = localStorage.getItem(NICKNAME_KEY) || '';
      const pending = JSON.parse(localStorage.getItem('claw_pending_records_v1') || '{}');
      if (pending && typeof pending === 'object') for (const r of Object.values(pending)) {
        if (isRecord(r)) this.pendingRecords[r.recordKey] = r;
      }
      const stored:unknown = JSON.parse(localStorage.getItem(BEST_RECORDS_KEY) || '{}');
      if (stored && typeof stored==='object' && !Array.isArray(stored)) {
        for (const record of Object.values(stored)) {
          // Migrate the fictional starter records, retaining real player scores.
          if (isRecord(record) && FICTIONAL_RECORDS[record.recordKey]!==`${record.holderName}|${record.bestTimeSeconds}|${record.date}`) {
            this.bestRecords[record.recordKey] = record;
          }
        }
      }
      const events:unknown = JSON.parse(localStorage.getItem(RECORD_EVENTS_KEY) || '[]');
      if (Array.isArray(events)) this.breakEvents = events.filter(isEvent).filter(e=>!['init-1','init-2'].includes(e.id));
    } catch (error) {console.warn('Failed to load cached leaderboard',error);}
  }

  public getPlayerName() {return this.currentPlayer;}

  public setPlayerName(name:string) {
    this.currentPlayer = name.trim().slice(0,16) || '神秘玩家';
    try {localStorage.setItem(NICKNAME_KEY,this.currentPlayer);} catch (error) {console.warn(error);}
    return this.currentPlayer;
  }

  private saveRecords() {
    try {
      localStorage.setItem(BEST_RECORDS_KEY,JSON.stringify(this.bestRecords));
      localStorage.setItem('claw_pending_records_v1',JSON.stringify(this.pendingRecords));
      this.breakEvents = this.breakEvents.slice(-50);
      localStorage.setItem(RECORD_EVENTS_KEY,JSON.stringify(this.breakEvents));
    } catch (error) {console.warn(error);}
  }

  public getBestRecords():BestRecordItem[] {
    const records = {...(this.cloudRecords ?? this.bestRecords),...this.pendingRecords};
    return ['campaign-7','campaign','stage-1','stage-2','stage-3','stage-4','stage-5','stage-6','stage-7'].map(key=>records[key]).filter(Boolean)
      .map(record=>record.recordKey==='campaign' ? {...record,title:'舊版四關全破紀錄'} : record);
  }

  public getRecentBreakEvents():RecordBreakEvent[] {
    const events = [...(this.cloudEvents ?? this.breakEvents)];
    for (const record of Object.values(this.pendingRecords)) {
      if (!events.some(e=>e.recordType===record.title && e.date===record.date && e.playerName===record.holderName)) {
        events.push({id:`pending-${record.recordKey}`,playerName:record.holderName,recordType:record.title,
          stageName:record.title,timeFormatted:record.formattedTime,date:record.date});
      }
    }
    return events.sort((a,b)=>b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  public get hasPendingRecords() {return Object.keys(this.pendingRecords).length>0;}

  public refreshFromGoogleSheets():Promise<boolean> {
    if (this.refreshTask) return this.refreshTask;
    this.cloudStatus = 'loading';
    this.onRecordsUpdated?.();
    this.refreshTask = (async()=>{
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),10000);
      try {
        const response = await fetch(`${DEFAULT_GSHEET_WEBHOOK_URL}?action=leaderboard`,{signal:controller.signal,cache:'no-store'});
        if (!response.ok) throw new Error('Cloud leaderboard unavailable');
        const data = parseCloudLeaderboard(await response.json());
        this.cloudRecords = Object.fromEntries(data.records.map(r=>[r.recordKey,r]));
        for (const [key,pending] of Object.entries(this.pendingRecords)) {
          if (this.cloudRecords[key]?.bestTimeSeconds <= pending.bestTimeSeconds) delete this.pendingRecords[key];
        }
        this.cloudEvents = data.events;
        this.bestRecords = {...this.cloudRecords};
        this.breakEvents = [...data.events];
        this.saveRecords();
        this.cloudStatus = 'connected';
        return true;
      } catch (error) {
        this.cloudStatus = 'unavailable';
        console.warn('Cloud leaderboard read failed',error);
        return false;
      } finally {clearTimeout(timeout);this.onRecordsUpdated?.();}
    })().finally(()=>{this.refreshTask=null;});
    return this.refreshTask;
  }

  private recordWin(key:string,title:string,stageName:string,elapsedSeconds:number,formattedTime:string,wins:number,plays:number,eventName:string) {
    const prev = this.getBestRecords().find(record=>record.recordKey===key);
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds<0 || (prev && elapsedSeconds>=prev.bestTimeSeconds)) {
      return {isNewRecord:false,recordTitle:'',previousBest:prev?.formattedTime || ''};
    }
    const playerName = this.getPlayerName() || '無名英雄';
    const date = this.getNowString();
    this.bestRecords[key] = {recordKey:key,title,holderName:playerName,bestTimeSeconds:elapsedSeconds,formattedTime,wins,plays,date};
    this.pendingRecords[key] = this.bestRecords[key];
    this.breakEvents.push({id:crypto.randomUUID(),playerName,recordType:title,stageName,timeFormatted:formattedTime,date});
    this.saveRecords();
    this.onRecordsUpdated?.();
    void this.sendToGoogleSheets({event:eventName,player:playerName,recordName:title,stage:stageName,time:formattedTime,date,
      recordKey:key,elapsedSeconds,wins,plays}).then(async sent=>{
        if (sent) {if (this.refreshTask) await this.refreshTask; await this.refreshFromGoogleSheets();}
      });
    return {isNewRecord:true,recordTitle:title,previousBest:prev?.formattedTime || '無前次紀錄'};
  }

  public checkAndRecordStageWin(stageNum:number,stageName:string,elapsedSeconds:number,formattedTime:string,wins:number,plays:number) {
    if (!Number.isInteger(stageNum) || stageNum<1 || stageNum>7) return {isNewRecord:false,recordTitle:'',previousBest:''};
    return this.recordWin(`stage-${stageNum}`,`第 ${stageNum} 關 最速紀錄`,stageName,elapsedSeconds,formattedTime,wins,plays,'打破單關紀錄');
  }

  public checkAndRecordGrandVictory(totalSeconds:number,formattedTime:string,totalWins:number,totalPlays:number) {
    const result = this.recordWin('campaign-7','七關全破 最速總紀錄','7大關全破',totalSeconds,formattedTime,totalWins,totalPlays,'打破全破總紀錄');
    if (!result.isNewRecord && Number.isFinite(totalSeconds) && totalSeconds>=0) {
      const playerName = this.getPlayerName() || '無名英雄';
      const date = this.getNowString();
      this.breakEvents.push({id:crypto.randomUUID(),playerName,recordType:'七關全破',stageName:'7大關全破',timeFormatted:formattedTime,date});
      this.saveRecords();
      this.onRecordsUpdated?.();
      void this.sendToGoogleSheets({event:'通關全破',player:playerName,recordName:'通關完成',stage:'7大關全破',time:formattedTime,date})
        .then(async sent=>{if (sent) {if (this.refreshTask) await this.refreshTask; await this.refreshFromGoogleSheets();}});
    }
    return result;
  }

  private getNowString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  }

  public async sendToGoogleSheets(payload:{event:string;player:string;recordName:string;stage:string;time:string;date:string;recordKey?:string;elapsedSeconds?:number;wins?:number;plays?:number}):Promise<boolean> {
    if (import.meta.env?.DEV) return false;
    try {
      await fetch(DEFAULT_GSHEET_WEBHOOK_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)});
      // An opaque POST is not an acknowledgement; the follow-up read confirms it.
      return true;
    } catch (error) {console.warn('Google Sheet write failed',error);return false;}
  }
}
