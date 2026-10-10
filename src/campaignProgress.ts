// Bump this key when a new campaign season must invalidate every browser's saved progress.
const KEY = 'claw_campaign_progress_v2';
const storageKey = (playerName: string) => `${KEY}:${encodeURIComponent(playerName.trim().toLocaleLowerCase() || 'guest')}`;

export interface CampaignProgress {
  unlockedStage: number;
  currentStage: number;
  completed: boolean;
}

export function loadCampaignProgress(stageCount: number, playerName = ''): CampaignProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(playerName)) || '{}');
    const completed = saved.completed === true && Number(saved.unlockedStage) >= stageCount;
    const previouslyCompleted = saved.completed === true && Number(saved.unlockedStage) === stageCount - 1;
    const unlockedStage = completed || previouslyCompleted ? stageCount : Number.isInteger(saved.unlockedStage)
      ? Math.max(1, Math.min(stageCount, saved.unlockedStage)) : 1;
    const currentStage = previouslyCompleted ? stageCount : Number.isInteger(saved.currentStage)
      ? Math.max(1, Math.min(unlockedStage, saved.currentStage)) : unlockedStage;
    return {unlockedStage, currentStage, completed};
  } catch {
    return {unlockedStage: 1, currentStage: 1, completed: false};
  }
}

export function saveCampaignProgress(progress: CampaignProgress, playerName = '') {
  try { localStorage.setItem(storageKey(playerName), JSON.stringify(progress)); } catch { /* Private browsing may block storage. */ }
}
