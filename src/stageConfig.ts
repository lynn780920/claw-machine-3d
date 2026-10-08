import { LEVEL_CONFIGS } from './levelSystem.ts';

export const STAGE_CONFIG_URL = 'https://script.google.com/macros/s/AKfycbxYVkvXwZ9X9mJN0DZwxh8Cq1tGIarXs1bCpfwytfQkR7VnraTz8YzDlwlV8OgRWqpa/exec';

export interface StageRuntimeConfig {
  stageNum: number;
  strong: number;
  weakenHeight: number;
  weak: number;
  topHit: number;
  carriageSpeed: number;
  dropSpeed: number;
  sway: number;
  cableLength: number;
  baffleHeight: number;
  antiSwing: boolean;
  clawSize: number;
  clawScale: number;
  spawnSpread: number;
  weight: number;
  rollingResistance: number;
  basePrizeCount: number;
  targetPrizeCount: number;
  maxDrops: number;
  bounceFloor: boolean;
  forceTopRelease: boolean;
  physicsSubsteps: number;
  stageHint: string;
}

export const STAGE_RUNTIME_CONFIGS: StageRuntimeConfig[] = [
  {stageNum:1,strong:100,weakenHeight:76,weak:69,topHit:13,carriageSpeed:2,dropSpeed:2,sway:1.4,cableLength:9.5,baffleHeight:0.7,antiSwing:false,clawSize:2,clawScale:1,spawnSpread:4.8,weight:1,rollingResistance:1,basePrizeCount:42,targetPrizeCount:0,maxDrops:0,bounceFloor:false,forceTopRelease:false,physicsSubsteps:2,stageHint:''},
  {stageNum:2,strong:95,weakenHeight:62,weak:49,topHit:15,carriageSpeed:1.8,dropSpeed:2,sway:1.4,cableLength:7.5,baffleHeight:1,antiSwing:false,clawSize:3,clawScale:1.15,spawnSpread:4.8,weight:1,rollingResistance:1,basePrizeCount:25,targetPrizeCount:0,maxDrops:0,bounceFloor:false,forceTopRelease:false,physicsSubsteps:2,stageHint:''},
  {stageNum:3,strong:86,weakenHeight:68,weak:57,topHit:23,carriageSpeed:3,dropSpeed:2,sway:1,cableLength:9.5,baffleHeight:0.1,antiSwing:false,clawSize:1,clawScale:0.85,spawnSpread:2.2,weight:0.6,rollingResistance:0.35,basePrizeCount:5,targetPrizeCount:0,maxDrops:0,bounceFloor:false,forceTopRelease:false,physicsSubsteps:2,stageHint:''},
  {stageNum:4,strong:75,weakenHeight:55,weak:43,topHit:35,carriageSpeed:2,dropSpeed:2,sway:1.4,cableLength:9.5,baffleHeight:0,antiSwing:false,clawSize:4,clawScale:1.35,spawnSpread:6,weight:0.6,rollingResistance:0.35,basePrizeCount:18,targetPrizeCount:0,maxDrops:0,bounceFloor:false,forceTopRelease:false,physicsSubsteps:2,stageHint:''},
  {stageNum:5,strong:75,weakenHeight:55,weak:43,topHit:35,carriageSpeed:2,dropSpeed:2,sway:1.4,cableLength:9.5,baffleHeight:0.3,antiSwing:false,clawSize:2,clawScale:1,spawnSpread:4.8,weight:1,rollingResistance:1,basePrizeCount:18,targetPrizeCount:0,maxDrops:30,bounceFloor:false,forceTopRelease:false,physicsSubsteps:2,stageHint:'剩餘下爪次數：30 次'},
  {stageNum:6,strong:88,weakenHeight:76,weak:65,topHit:20,carriageSpeed:2.6,dropSpeed:2,sway:1.6,cableLength:9.5,baffleHeight:0.6,antiSwing:false,clawSize:2,clawScale:1,spawnSpread:4.8,weight:0.6,rollingResistance:0.35,basePrizeCount:12,targetPrizeCount:3,maxDrops:0,bounceFloor:false,forceTopRelease:false,physicsSubsteps:2,stageHint:'指定夾出 3 件微微發光的獎品'},
  {stageNum:7,strong:98,weakenHeight:76,weak:98,topHit:100,carriageSpeed:2,dropSpeed:2,sway:1.4,cableLength:9.5,baffleHeight:0.7,antiSwing:false,clawSize:2,clawScale:1,spawnSpread:3.8,weight:1,rollingResistance:1,basePrizeCount:2,targetPrizeCount:0,maxDrops:0,bounceFloor:true,forceTopRelease:true,physicsSubsteps:8,stageHint:'彈跳台：觸頂必掉，兩盒一番賞都出貨才過關'}
];

const numberFields: Array<keyof StageRuntimeConfig> = [
  'strong','weakenHeight','weak','topHit','carriageSpeed','dropSpeed','sway','cableLength','baffleHeight',
  'clawScale','spawnSpread','weight','rollingResistance','basePrizeCount','targetPrizeCount','maxDrops','physicsSubsteps'
];
const clawSizeScales = [0.85,1,1.15,1.35] as const;
const CONFIG_CACHE_KEY = 'claw_stage_config_cache_v1';
export let stageConfigSource: 'sheet' | 'cache' | 'default' = 'default';

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function applyRemoteStageConfigs(value: unknown): boolean {
  const rows = (value as {configs?: unknown})?.configs;
  if (!Array.isArray(rows) || rows.length !== LEVEL_CONFIGS.length) return false;
  const seen = new Set<number>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') return false;
    const row = raw as Record<string, unknown>;
    const stageNum = Number(row.stageNum);
    if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > LEVEL_CONFIGS.length || seen.has(stageNum)) return false;
    seen.add(stageNum);
  }
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const stageNum = Number(row.stageNum);
    const level = LEVEL_CONFIGS[stageNum - 1];
    const runtime = STAGE_RUNTIME_CONFIGS[stageNum - 1];
    level.name = String(row.name || level.name).slice(0,80);
    level.machineMode = ['small','medium','large','kbasket'].includes(String(row.machineMode)) ? row.machineMode as typeof level.machineMode : level.machineMode;
    level.machineLabel = String(row.machineLabel || level.machineLabel).slice(0,80);
    level.timeLimitSeconds = Math.max(30,Math.round(finiteNumber(row.timeLimitSeconds,level.timeLimitSeconds)));
    level.targetWins = Math.max(1,Math.round(finiteNumber(row.targetWins,level.targetWins)));
    level.isClearAll = row.isClearAll === true || String(row.isClearAll).toUpperCase() === 'TRUE';
    level.dollCount = Math.max(1,Math.round(finiteNumber(row.dollCount,level.dollCount)));
    level.prizeType = String(row.prizeType || level.prizeType).slice(0,40);
    level.description = String(row.description || level.description).slice(0,240);
    level.objectiveText = String(row.objectiveText || level.objectiveText).slice(0,120);
    level.strategyHint = String(row.strategyHint || level.strategyHint).slice(0,240);
    const runtimeValues = runtime as unknown as Record<string,unknown>;
    for (const field of numberFields) runtimeValues[field] = finiteNumber(row[field],Number(runtimeValues[field]));
    const requestedClawSize = Math.round(finiteNumber(row.clawSize,0));
    if (requestedClawSize >= 1 && requestedClawSize <= 4) {
      runtime.clawSize = requestedClawSize;
      runtime.clawScale = clawSizeScales[requestedClawSize-1];
    } else {
      runtime.clawSize = clawSizeScales.reduce((best,scale,index) =>
        Math.abs(scale-runtime.clawScale)<Math.abs(clawSizeScales[best-1]-runtime.clawScale) ? index+1 : best,1);
    }
    runtime.stageHint = String(row.stageHint ?? runtime.stageHint).slice(0,120);
    runtime.antiSwing = row.antiSwing === true || String(row.antiSwing).toUpperCase() === 'TRUE';
    runtime.bounceFloor = row.bounceFloor === true || String(row.bounceFloor).toUpperCase() === 'TRUE';
    runtime.forceTopRelease = row.forceTopRelease === true || String(row.forceTopRelease).toUpperCase() === 'TRUE';
  }
  return seen.size === LEVEL_CONFIGS.length;
}

export async function loadStageConfigsFromGoogleSheets(): Promise<boolean> {
  // Keep the last verified settings through temporary network failures.
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || 'null');
    if (applyRemoteStageConfigs(cached)) stageConfigSource = 'cache';
  } catch { /* Storage may be unavailable or contain invalid data. */ }
  const controller = new AbortController();
  const timeout = window.setTimeout(()=>controller.abort(),15000);
  try {
    const response = await fetch(`${STAGE_CONFIG_URL}?action=stage-config&t=${Date.now()}`,{cache:'no-store',signal:controller.signal});
    if (!response.ok) return false;
    const data = await response.json();
    if (!applyRemoteStageConfigs(data)) return false;
    stageConfigSource = 'sheet';
    try { localStorage.setItem(CONFIG_CACHE_KEY,JSON.stringify(data)); } catch { /* Settings still apply without storage. */ }
    return true;
  } catch (error) {
    console.warn('Google Sheet unavailable; using last verified or built-in stage settings',error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function getStageRuntimeConfig(stageNum: number) {
  return STAGE_RUNTIME_CONFIGS[Math.max(0,Math.min(STAGE_RUNTIME_CONFIGS.length-1,stageNum-1))];
}
