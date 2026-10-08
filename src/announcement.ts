import { STAGE_CONFIG_URL } from './stageConfig.ts';

export interface SiteAnnouncement {
  enabled: boolean;
  version: string;
  title: string;
  date: string;
  message: string;
}

export const DEFAULT_ANNOUNCEMENT: SiteAnnouncement = {
  enabled: true,
  version: '2026-10-08-machine-reset',
  title: '開發者公告',
  date: '2026/10/08',
  message: '已全面更新機台參數，\n並且將所有挑戰者紀錄清零\n歡迎玩家重新挑戰至尊魔王寶座'
};

export function parseAnnouncement(value: unknown): SiteAnnouncement | null {
  const raw = (value as {announcement?: unknown})?.announcement;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const announcement: SiteAnnouncement = {
    enabled: row.enabled === true || String(row.enabled).toUpperCase() === 'TRUE',
    version: String(row.version || DEFAULT_ANNOUNCEMENT.version).slice(0,80),
    title: String(row.title || DEFAULT_ANNOUNCEMENT.title).slice(0,80),
    date: String(row.date || '').slice(0,40),
    message: String(row.message || '').slice(0,1000)
  };
  return announcement.message ? announcement : null;
}

export async function loadAnnouncementFromGoogleSheets(): Promise<SiteAnnouncement> {
  const controller = new AbortController();
  const timeout = window.setTimeout(()=>controller.abort(),6000);
  try {
    const response = await fetch(`${STAGE_CONFIG_URL}?action=announcement&t=${Date.now()}`,{
      cache:'no-store',signal:controller.signal
    });
    if (!response.ok) return DEFAULT_ANNOUNCEMENT;
    return parseAnnouncement(await response.json()) || DEFAULT_ANNOUNCEMENT;
  } catch (error) {
    console.warn('Using built-in announcement because Google Sheet configuration is unavailable',error);
    return DEFAULT_ANNOUNCEMENT;
  } finally {
    clearTimeout(timeout);
  }
}
