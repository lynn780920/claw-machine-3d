import test from 'node:test';
import assert from 'node:assert/strict';
import {LevelSystem, LEVEL_CONFIGS} from '../src/levelSystem.ts';
import {loadCampaignProgress, saveCampaignProgress} from '../src/campaignProgress.ts';

test('browser progress restores an unlocked stage and ignores corrupt data', () => {
  const values = new Map();
  globalThis.localStorage = {getItem:key => values.get(key) ?? null,setItem:(key,value) => values.set(key,value)};
  assert.deepEqual(loadCampaignProgress(7),{unlockedStage:1,currentStage:1,completed:false});
  saveCampaignProgress({unlockedStage:5,completed:false},'Lynn');
  assert.deepEqual(loadCampaignProgress(7,'Lynn'),{unlockedStage:5,currentStage:5,completed:false});
  saveCampaignProgress({unlockedStage:5,currentStage:3,completed:false},'Lynn');
  assert.deepEqual(loadCampaignProgress(7,'Lynn'),{unlockedStage:5,currentStage:3,completed:false});
  assert.deepEqual(loadCampaignProgress(7,'Someone Else'),{unlockedStage:1,currentStage:1,completed:false});
  saveCampaignProgress({unlockedStage:7,completed:true},'Champion');
  assert.deepEqual(loadCampaignProgress(7,'Champion'),{unlockedStage:7,currentStage:7,completed:true});
  assert.deepEqual(loadCampaignProgress(8,'Champion'),{unlockedStage:8,currentStage:8,completed:false});
  values.set('claw_campaign_progress_v1:lynn','{');
  assert.deepEqual(loadCampaignProgress(7),{unlockedStage:1,currentStage:1,completed:false});
  delete globalThis.localStorage;
});

test('stage six counts only marked prizes, then seven unlocks eight and eight needs two boxes', () => {
  globalThis.window = {setInterval};
  let clears = 0, victories = 0;
  const game = new LevelSystem({
    onLevelStarted:()=>{},onTick:()=>{},onProgressUpdated:()=>{},
    onStageClear:()=>{clears++;},onGameOver:()=>{},onGameVictory:()=>{victories++;}
  });
  game.startLevel(5);
  game.onItemWon(12);
  assert.equal(game.stageWins,0);
  for (let i=0;i<3;i++) game.onItemWon(11-i,`stage6-${i}`);
  assert.equal(clears,1);
  game.startLevel(6);
  assert.equal(game.getFullCampaignSeconds(),null);
  assert.equal(game.getCurrentConfig().dollCount,2);
  game.onItemWon(1);
  assert.equal(game.stageWins,1);
  assert.equal(victories,0);
  game.onItemWon(0);
  assert.equal(victories,0);
  assert.equal(clears,2);
  game.nextLevel();
  assert.equal(game.getCurrentConfig().stageNum,8);
  assert.equal(game.getCurrentConfig().dollCount,8);
  game.onItemWon(7);
  assert.equal(victories,0);
  game.onItemWon(6);
  assert.equal(victories,1);
  assert.equal(game.getFullCampaignSeconds(),null,'replaying the last stage must not submit a full-campaign time');
  assert.equal(LEVEL_CONFIGS.length,8);
  game.stopTimer();
  delete globalThis.window;
});

test('admin clear is marked assisted through the clear callback and resets on a fresh stage', () => {
  globalThis.window = {setInterval};
  let assistedAtClear = false;
  const game = new LevelSystem({
    onLevelStarted:()=>{},onTick:()=>{},onProgressUpdated:()=>{},
    onStageClear:()=>{assistedAtClear = game.isAssistedClear;},onGameOver:()=>{},onGameVictory:()=>{}
  });
  game.startLevel(2);
  game.forceStageClear();
  assert.equal(assistedAtClear,true);
  assert.equal(game.isAssistedCampaign,true);
  game.nextLevel();
  assert.equal(game.isAssistedClear,false);
  assert.equal(game.isAssistedCampaign,true);
  game.startLevel(0);
  assert.equal(game.isAssistedCampaign,false);
  game.stopTimer();
  delete globalThis.window;
});

test('adding a ninth stage moves the final victory beyond stage eight',()=>{
  globalThis.window={setInterval};
  LEVEL_CONFIGS.push({...LEVEL_CONFIGS.at(-1),id:9,stageNum:9,shortName:'第 9 關',targetWins:1});
  let clears=0,victories=0;
  const game=new LevelSystem({onLevelStarted:()=>{},onTick:()=>{},onProgressUpdated:()=>{},
    onStageClear:()=>{clears++;},onGameOver:()=>{},onGameVictory:()=>{victories++;}});
  try {
    game.startLevel(7);
    game.onItemWon(7);
    game.onItemWon(6);
    assert.equal(clears,1);
    assert.equal(victories,0);
    game.nextLevel();
    game.onItemWon(0);
    assert.equal(victories,1);
  } finally {
    game.stopTimer();
    LEVEL_CONFIGS.pop();
    delete globalThis.window;
  }
});
