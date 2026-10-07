const KEY = 'claw_campaign_progress_v1';
const storageKey = (playerName: string) => `${KEY}:${encodeURIComponent(playerName.trim().toLocaleLowerCase() || 'guest')}`;

export interface CampaignProgress {
  unlockedStage: number;
  completed: boolean;
}

export function loadCampaignProgress(stageCount: number, playerName = ''): CampaignProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(playerName)) || '{}');
    const unlockedStage = Number.isInteger(saved.unlockedStage)
      ? Math.max(1, Math.min(stageCount, saved.unlockedStage)) : 1;
    return {unlockedStage, completed: saved.completed === true};
  } catch {
    return {unlockedStage: 1, completed: false};
  }
}

export function saveCampaignProgress(progress: CampaignProgress, playerName = '') {
  try { localStorage.setItem(storageKey(playerName), JSON.stringify(progress)); } catch { /* Private browsing may block storage. */ }
}
