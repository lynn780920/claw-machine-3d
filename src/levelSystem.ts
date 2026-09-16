/**
 * 4-Stage Challenge Progression System (破關制關卡系統)
 *
 * Level 1: 機台 02 (中型機台 · 最簡單) | 限時 15 分鐘 | 目標：夾到 8 樣過關
 * Level 2: 機台 03 (中大機台 · 技術型) | 限時 10 分鐘 | 目標：夾到 4 樣過關
 * Level 3: 機台 01 (小型機台 · 清台戰) | 限時 8 分鐘  | 目標：限時清台！(台內全數清空)
 * Level 4: 機台 04 (K-霸機台 · 魔王關) | 限時 8 分鐘  | 目標：夾到 3 樣巨型家電即全破
 */

export interface LevelConfig {
  id: number;
  stageNum: number;
  name: string;
  shortName: string;
  machineMode: 'small' | 'medium' | 'large' | 'kbasket';
  machineLabel: string;
  timeLimitSeconds: number;
  targetWins: number;
  isClearAll: boolean;
  dollCount: number;
  prizeType: string;
  difficulty: '簡單' | '普通' | '困難' | '地獄魔王';
  difficultyColor: string;
  description: string;
  objectiveText: string;
  strategyHint: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 1,
    stageNum: 1,
    name: '第一關：經典街機 (初試身手)',
    shortName: '第 1 關',
    machineMode: 'medium',
    machineLabel: '標準街機 (初試身手)',
    timeLimitSeconds: 15 * 60, // 15 分鐘 (900秒)
    targetWins: 8,
    isClearAll: false,
    dollCount: 40,
    prizeType: 'mixed',
    difficulty: '簡單',
    difficultyColor: '#10b981',
    description: '最容易上手的暖身關卡！機台容錯率高，請在 15 分鐘內夾出 8 樣物品即可晉級！',
    objectiveText: '夾出 8 樣娃娃',
    strategyHint: '抓準下爪時機與二收合爪點，利用山頂滾落出貨口！'
  },
  {
    id: 2,
    stageNum: 2,
    name: '第二關：模型公仔 (技術進階)',
    shortName: '第 2 關',
    machineMode: 'large',
    machineLabel: '大型機台 (技術進階)',
    timeLimitSeconds: 10 * 60, // 10 分鐘 (600秒)
    targetWins: 4,
    isClearAll: false,
    dollCount: 25,
    prizeType: 'anime',
    difficulty: '普通',
    difficultyColor: '#f59e0b',
    description: '公仔重盒考驗卡爪甩幅！限時 10 分鐘內夾出 4 樣動漫模型盒即可進入清台挑戰！',
    objectiveText: '夾出 4 樣公仔盒',
    strategyHint: '利用甩爪角度或正二拍反擺，卡住外盒角位托出！'
  },
  {
    id: 3,
    stageNum: 3,
    name: '第三關：潮玩盲盒 (限時清台戰)',
    shortName: '第 3 關',
    machineMode: 'small',
    machineLabel: '小型盲盒機 (清台戰)',
    timeLimitSeconds: 8 * 60, // 8 分鐘 (480秒)
    targetWins: 5, // 盲盒預設 5 盒，清空即過關
    isClearAll: true,
    dollCount: 5,
    prizeType: 'blindbox',
    difficulty: '困難',
    difficultyColor: '#ec4899',
    description: '極速清台任務！POP MART 盲盒必須在 8 分鐘內全部清空 (清台)！時間到即 GAME OVER！',
    objectiveText: '清台！(台內 5 盒盲盒全數清空)',
    strategyHint: '台內共 5 盒盲盒，必須全數夾空！動作要快，槍位先行！'
  },
  {
    id: 4,
    stageNum: 4,
    name: '第四關：K-霸巨無霸專區 (最終魔王關)',
    shortName: '第 4 關',
    machineMode: 'kbasket',
    machineLabel: 'K霸直立機台 (魔王決戰)',
    timeLimitSeconds: 8 * 60, // 8 分鐘 (480秒)
    targetWins: 3,
    isClearAll: false,
    dollCount: 12,
    prizeType: 'giant_appliances',
    difficulty: '地獄魔王',
    difficultyColor: '#ef4444',
    description: '終極魔王決戰！1.35x 霸王巨爪與 1.1m 高擋板，限時 8 分鐘內夾出 3 樣巨型家電即大獲全勝通關全破！',
    objectiveText: '夾出 3 樣巨型家電',
    strategyHint: '100% 強爪與 2.4 天車速度對抗 1.1m 擋板，抓取重盒邊緣拉拔！'
  }
];

export interface LevelCallbacks {
  onLevelStarted: (level: LevelConfig) => void;
  onTick: (remainingSeconds: number, formatted: string, isWarning: boolean) => void;
  onProgressUpdated: (currentWins: number, targetWins: number, isClearAll: boolean, remainingItems: number) => void;
  onStageClear: (level: LevelConfig, elapsedSeconds: number, stageWins: number) => void;
  onGameOver: (level: LevelConfig, elapsedSeconds: number, currentWins: number) => void;
  onGameVictory: (totalElapsedSeconds: number, totalWins: number) => void;
}

export class LevelSystem {
  public currentLevelIndex: number = 0;
  public remainingSeconds: number = 0;
  public stageWins: number = 0;
  public initialPrizeCount: number = 0;
  public isRunning: boolean = false;
  public isGameOver: boolean = false;
  public isGameVictory: boolean = false;
  
  private totalCampaignWins: number = 0;
  private totalCampaignSeconds: number = 0;
  private timerInterval: number | null = null;
  private callbacks: LevelCallbacks;

  constructor(callbacks: LevelCallbacks) {
    this.callbacks = callbacks;
  }

  public getCurrentConfig(): LevelConfig {
    return LEVEL_CONFIGS[this.currentLevelIndex];
  }

  public getFormattedTime(totalSeconds: number): string {
    const mins = Math.floor(Math.max(0, totalSeconds) / 60);
    const secs = Math.max(0, totalSeconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private stageEndTime: number = 0;

  public startLevel(levelIndex: number, initialPrizeCount?: number) {
    this.stopTimer();
    this.currentLevelIndex = Math.max(0, Math.min(levelIndex, LEVEL_CONFIGS.length - 1));
    const config = this.getCurrentConfig();

    this.remainingSeconds = config.timeLimitSeconds;
    this.stageWins = 0;
    this.initialPrizeCount = initialPrizeCount ?? config.dollCount;
    this.isGameOver = false;
    this.isGameVictory = false;

    this.callbacks.onLevelStarted(config);
    this.updateProgressUI();
    this.callbacks.onTick(this.remainingSeconds, this.getFormattedTime(this.remainingSeconds), false);

    this.startTimer();
  }

  public restartCurrentLevel(initialPrizeCount?: number) {
    this.startLevel(this.currentLevelIndex, initialPrizeCount);
  }

  public restartCampaign() {
    this.totalCampaignWins = 0;
    this.totalCampaignSeconds = 0;
    this.startLevel(0);
  }

  public nextLevel() {
    if (this.currentLevelIndex < LEVEL_CONFIGS.length - 1) {
      this.startLevel(this.currentLevelIndex + 1);
    } else {
      this.triggerGameVictory();
    }
  }

  private startTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = true;
    this.stageEndTime = Date.now() + this.remainingSeconds * 1000;

    this.timerInterval = window.setInterval(() => {
      if (!this.isRunning || this.isGameOver || this.isGameVictory) return;

      const now = Date.now();
      const left = Math.max(0, Math.ceil((this.stageEndTime - now) / 1000));
      this.remainingSeconds = left;
      this.totalCampaignSeconds++;

      const isWarning = this.remainingSeconds <= 60 && this.remainingSeconds > 0;
      this.callbacks.onTick(this.remainingSeconds, this.getFormattedTime(this.remainingSeconds), isWarning);

      if (this.remainingSeconds <= 0) {
        this.triggerGameOver();
      }
    }, 1000);
  }

  public pauseTimer() {
    this.isRunning = false;
  }

  public resumeTimer() {
    if (!this.isGameOver && !this.isGameVictory) {
      this.isRunning = true;
      this.stageEndTime = Date.now() + this.remainingSeconds * 1000;
    }
  }

  public stopTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Called whenever a prize falls into the chute
   */
  public onItemWon(remainingItemsInMachine: number): boolean {
    if (this.isGameOver || this.isGameVictory) return false;

    this.stageWins++;
    this.totalCampaignWins++;
    const config = this.getCurrentConfig();

    this.updateProgressUI(remainingItemsInMachine);

    // Check clear condition
    let isCleared = false;
    if (config.isClearAll) {
      // Third level: clear the table (either 0 remaining or won all initial prizes)
      isCleared = remainingItemsInMachine <= 0 || this.stageWins >= this.initialPrizeCount;
    } else {
      isCleared = this.stageWins >= config.targetWins;
    }

    if (isCleared) {
      this.triggerStageClear();
      return true;
    }

    return false;
  }

  public setPrizeCount(count: number) {
    this.initialPrizeCount = count;
    this.updateProgressUI(count);
  }

  private updateProgressUI(remainingCount?: number) {
    const config = this.getCurrentConfig();
    const remaining = remainingCount !== undefined ? remainingCount : (this.initialPrizeCount - this.stageWins);
    this.callbacks.onProgressUpdated(
      this.stageWins,
      config.isClearAll ? this.initialPrizeCount : config.targetWins,
      config.isClearAll,
      Math.max(0, remaining)
    );
  }

  private triggerStageClear() {
    this.stopTimer();
    const config = this.getCurrentConfig();
    const elapsedSeconds = config.timeLimitSeconds - this.remainingSeconds;

    if (this.currentLevelIndex === LEVEL_CONFIGS.length - 1) {
      // Final level cleared! Grand Victory!
      this.isGameVictory = true;
      this.callbacks.onGameVictory(this.totalCampaignSeconds, this.totalCampaignWins);
    } else {
      this.callbacks.onStageClear(config, elapsedSeconds, this.stageWins);
    }
  }

  private triggerGameOver() {
    this.stopTimer();
    this.isGameOver = true;
    const config = this.getCurrentConfig();
    const elapsedSeconds = config.timeLimitSeconds;
    this.callbacks.onGameOver(config, elapsedSeconds, this.stageWins);
  }

  private triggerGameVictory() {
    this.stopTimer();
    this.isGameVictory = true;
    this.callbacks.onGameVictory(this.totalCampaignSeconds, this.totalCampaignWins);
  }
}
