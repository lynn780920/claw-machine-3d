import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEVEL_CONFIGS} from '../src/levelSystem.ts';
import {applyRemoteStageConfigs,STAGE_RUNTIME_CONFIGS} from '../src/stageConfig.ts';

test('Google Sheet stage rows update all eight stages and reject incomplete data',()=>{
  const originalLevel=structuredClone(LEVEL_CONFIGS);
  const originalRuntime=structuredClone(STAGE_RUNTIME_CONFIGS);
  const configs=LEVEL_CONFIGS.map((level,index)=>({
    ...level,
    stageNum:index+1,
    timeLimitSeconds:level.timeLimitSeconds+1,
    strong:80+index,weakenHeight:70,weak:60,topHit:20,carriageSpeed:2,dropSpeed:2,sway:1.2,
    cableLength:9,baffleHeight:0.5,antiSwing:false,clawScale:1,spawnSpread:4.5,weight:1,
    rollingResistance:1,basePrizeCount:level.dollCount,targetPrizeCount:0,maxDrops:0,bounceFloor:false,
    forceTopRelease:false,physicsSubsteps:2,stageHint:`第${index+1}關提示`
  }));
  assert.equal(applyRemoteStageConfigs({configs}),true);
  assert.equal(LEVEL_CONFIGS[0].timeLimitSeconds,originalLevel[0].timeLimitSeconds+1);
  assert.equal(STAGE_RUNTIME_CONFIGS[6].stageHint,'第7關提示');
  configs[0].clawSize=4;
  assert.equal(applyRemoteStageConfigs({configs}),true);
  assert.equal(STAGE_RUNTIME_CONFIGS[0].clawScale,1.35);
  assert.equal(STAGE_RUNTIME_CONFIGS[0].clawSize,4);
  configs[7].clawSize=5;
  configs[7].strong=40;
  configs[7].baffleHeight=1.1;
  assert.equal(applyRemoteStageConfigs({configs}),true);
  assert.equal(STAGE_RUNTIME_CONFIGS[7].clawScale,0.45);
  assert.equal(STAGE_RUNTIME_CONFIGS[7].strong,40);
  assert.equal(STAGE_RUNTIME_CONFIGS[7].baffleHeight,1.1);
  assert.equal(applyRemoteStageConfigs({configs:configs.slice(0,7)}),true,'old seven-row endpoint keeps stage eight defaults');
  assert.equal(applyRemoteStageConfigs({configs:configs.slice(0,6)}),false);
  LEVEL_CONFIGS.splice(0,LEVEL_CONFIGS.length,...originalLevel);
  STAGE_RUNTIME_CONFIGS.splice(0,STAGE_RUNTIME_CONFIGS.length,...originalRuntime);
});
