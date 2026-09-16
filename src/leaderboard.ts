/**
 * Leaderboard & Record-Breaking System (破紀錄紀錄榜與玩家暱稱系統)
 *
 * 專門記錄：
 * 1. 誰打破全破至尊最速紀錄
 * 2. 誰打破各關卡最速破關紀錄 (第一關至第四關)
 * 3. 即時破紀錄歷史流水帳 (紀錄誰、何時、破了什麼紀錄)
 * 4. Google Sheets 雲端即時同步寫入
 */

export interface BestRecordItem {
  recordKey: string; // 'campaign' | 'stage-1' | 'stage-2' | 'stage-3' | 'stage-4'
  title: string;
  holderName: string;
  bestTimeSeconds: number;
  formattedTime: string;
  wins: number;
  plays: number;
  date: string;
}

export interface RecordBreakEvent {
  id: string;
  playerName: string;
  recordType: string;
  stageName: string;
  timeFormatted: string;
  date: string;
}

const NICKNAME_KEY = 'claw_player_nickname';
const BEST_RECORDS_KEY = 'claw_best_records_v2';
const RECORD_EVENTS_KEY = 'claw_record_events_v2';

const DEFAULT_GSHEET_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxYVkvXwZ9X9mJN0DZwxh8Cq1tGIarXs1bCpfwytfQkR7VnraTz8YzDlwlV8OgRWqpa/exec';

export class LeaderboardManager {
  private currentPlayer: string = '';
  private bestRecords: Record<string, BestRecordItem> = {};
  private breakEvents: RecordBreakEvent[] = [];

  constructor() {
    this.loadPlayerName();
    this.loadRecords();
  }

  /* ── 1. 玩家暱稱管理 ── */
  public getPlayerName(): string {
    if (!this.currentPlayer) {
      this.currentPlayer = localStorage.getItem(NICKNAME_KEY) || '';
    }
    return this.currentPlayer;
  }

  public setPlayerName(name: string): string {
    const trimmed = name.trim().slice(0, 16) || '神秘玩家';
    this.currentPlayer = trimmed;
    try {
      localStorage.setItem(NICKNAME_KEY, trimmed);
    } catch (e) {
      console.warn('Failed to save nickname', e);
    }
    return trimmed;
  }

  private loadPlayerName() {
    const saved = localStorage.getItem(NICKNAME_KEY);
    if (saved) {
      this.currentPlayer = saved;
    }
  }

  /* ── 2. 破紀錄判定與存取 ── */
  private loadRecords() {
    try {
      const rawRecords = localStorage.getItem(BEST_RECORDS_KEY);
      if (rawRecords) {
        this.bestRecords = JSON.parse(rawRecords);
      } else {
        // 預設經典標竿紀錄
        this.bestRecords = {
          'stage-1': {
            recordKey: 'stage-1',
            title: '第 1 關 最速出貨紀錄',
            holderName: '娃娃達人',
            bestTimeSeconds: 155,
            formattedTime: '02:35',
            wins: 8,
            plays: 9,
            date: '2026-09-15 15:30'
          },
          'stage-2': {
            recordKey: 'stage-2',
            title: '第 2 關 最速出貨紀錄',
            holderName: '甩爪老手',
            bestTimeSeconds: 210,
            formattedTime: '03:30',
            wins: 4,
            plays: 6,
            date: '2026-09-15 16:10'
          },
          'stage-3': {
            recordKey: 'stage-3',
            title: '第 3 關 最速清台紀錄',
            holderName: '清台神手',
            bestTimeSeconds: 260,
            formattedTime: '04:20',
            wins: 5,
            plays: 8,
            date: '2026-09-15 18:40'
          },
          'stage-4': {
            recordKey: 'stage-4',
            title: '第 4 關 魔王決戰紀錄',
            holderName: 'K霸制霸者',
            bestTimeSeconds: 320,
            formattedTime: '05:20',
            wins: 3,
            plays: 5,
            date: '2026-09-15 20:05'
          },
          'campaign': {
            recordKey: 'campaign',
            title: '全破大通關 至尊夾王總紀錄',
            holderName: '至尊傳奇',
            bestTimeSeconds: 945,
            formattedTime: '15:45',
            wins: 20,
            plays: 28,
            date: '2026-09-15 20:10'
          }
        };
        this.saveRecords();
      }

      const rawEvents = localStorage.getItem(RECORD_EVENTS_KEY);
      if (rawEvents) {
        this.breakEvents = JSON.parse(rawEvents);
      } else {
        this.breakEvents = [
          {
            id: 'init-1',
            playerName: '至尊傳奇',
            recordType: '打破全破大通關紀錄',
            stageName: '全破四關',
            timeFormatted: '15:45',
            date: '2026-09-15 20:10'
          },
          {
            id: 'init-2',
            playerName: '清台神手',
            recordType: '打破第 3 關清台紀錄',
            stageName: '第 3 關 (盲盒清台)',
            timeFormatted: '04:20',
            date: '2026-09-15 18:40'
          }
        ];
        this.saveEvents();
      }
    } catch (e) {
      console.warn('Failed to load records from storage', e);
    }
  }

  private saveRecords() {
    try {
      localStorage.setItem(BEST_RECORDS_KEY, JSON.stringify(this.bestRecords));
    } catch (e) {
      console.warn(e);
    }
  }

  private saveEvents() {
    try {
      localStorage.setItem(RECORD_EVENTS_KEY, JSON.stringify(this.breakEvents.slice(-50)));
    } catch (e) {
      console.warn(e);
    }
  }

  public getBestRecords(): BestRecordItem[] {
    return [
      this.bestRecords['campaign'],
      this.bestRecords['stage-1'],
      this.bestRecords['stage-2'],
      this.bestRecords['stage-3'],
      this.bestRecords['stage-4']
    ].filter(Boolean);
  }

  public getRecentBreakEvents(): RecordBreakEvent[] {
    return [...this.breakEvents].reverse();
  }

  /**
   * 檢查並紀錄單關破紀錄
   */
  public checkAndRecordStageWin(
    stageNum: number,
    stageName: string,
    elapsedSeconds: number,
    formattedTime: string,
    wins: number,
    plays: number
  ): { isNewRecord: boolean; recordTitle: string; previousBest: string } {
    const key = `stage-${stageNum}`;
    const prev = this.bestRecords[key];
    const playerName = this.getPlayerName() || '無名英雄';
    const nowStr = this.getNowString();

    const isBetter = !prev || (elapsedSeconds < prev.bestTimeSeconds);

    if (isBetter) {
      const title = `第 ${stageNum} 關 最速紀錄`;
      const prevTime = prev ? prev.formattedTime : '無前次紀錄';

      this.bestRecords[key] = {
        recordKey: key,
        title,
        holderName: playerName,
        bestTimeSeconds: elapsedSeconds,
        formattedTime,
        wins,
        plays,
        date: nowStr
      };
      this.saveRecords();

      const eventItem: RecordBreakEvent = {
        id: `${Date.now()}`,
        playerName,
        recordType: `刷新第 ${stageNum} 關最速紀錄`,
        stageName,
        timeFormatted: formattedTime,
        date: nowStr
      };
      this.breakEvents.push(eventItem);
      this.saveEvents();

      // 同步到 Google Sheet
      this.sendToGoogleSheets({
        event: '打破單關紀錄',
        player: playerName,
        recordName: title,
        stage: stageName,
        time: formattedTime,
        date: nowStr
      });

      return { isNewRecord: true, recordTitle: title, previousBest: prevTime };
    }

    return { isNewRecord: false, recordTitle: '', previousBest: prev ? prev.formattedTime : '' };
  }

  /**
   * 檢查並紀錄全破大通關紀錄
   */
  public checkAndRecordGrandVictory(
    totalSeconds: number,
    formattedTime: string,
    totalWins: number,
    totalPlays: number
  ): { isNewRecord: boolean; previousBest: string } {
    const key = 'campaign';
    const prev = this.bestRecords[key];
    const playerName = this.getPlayerName() || '無名英雄';
    const nowStr = this.getNowString();

    const isBetter = !prev || (totalSeconds < prev.bestTimeSeconds);

    if (isBetter) {
      const prevTime = prev ? prev.formattedTime : '無前次紀錄';

      this.bestRecords[key] = {
        recordKey: key,
        title: '全破大通關 至尊夾王總紀錄',
        holderName: playerName,
        bestTimeSeconds: totalSeconds,
        formattedTime,
        wins: totalWins,
        plays: totalPlays,
        date: nowStr
      };
      this.saveRecords();

      const eventItem: RecordBreakEvent = {
        id: `${Date.now()}`,
        playerName,
        recordType: '榮登全破大通關至尊夾王紀錄保持人',
        stageName: '全破 4 大關卡',
        timeFormatted: formattedTime,
        date: nowStr
      };
      this.breakEvents.push(eventItem);
      this.saveEvents();

      // 同步到 Google Sheet
      this.sendToGoogleSheets({
        event: '打破全破總紀錄',
        player: playerName,
        recordName: '全破至尊夾王紀錄',
        stage: '4大關全破',
        time: formattedTime,
        date: nowStr
      });

      return { isNewRecord: true, previousBest: prevTime };
    }

    // 即使未破總時間紀錄，也送出全破紀錄到 Google Sheets
    this.sendToGoogleSheets({
      event: '通關全破',
      player: playerName,
      recordName: '通關完成',
      stage: '4大關全破',
      time: formattedTime,
      date: nowStr
    });

    return { isNewRecord: false, previousBest: prev ? prev.formattedTime : '' };
  }

  private getNowString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /* ── 3. Google Sheets 雲端即時連動 (純後端自動寫入) ── */
  public async sendToGoogleSheets(payload: {
    event: string;
    player: string;
    recordName: string;
    stage: string;
    time: string;
    date: string;
  }): Promise<boolean> {
    try {
      await fetch(DEFAULT_GSHEET_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return true;
    } catch (e) {
      console.warn('Google Sheet sync failed', e);
      return false;
    }
  }
}
