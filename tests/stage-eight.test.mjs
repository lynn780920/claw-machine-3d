import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {randomCompactBoxStock} from '../src/prizeStock.ts';
import {LEVEL_CONFIGS} from '../src/levelSystem.ts';
import {STAGE_RUNTIME_CONFIGS} from '../src/stageConfig.ts';
import {isPrizeEnteringChute,isBoxBelowRaisedChuteLip} from '../src/delivery.ts';
import {chuteWellWallSpecs,compactChuteBaffleSpans} from '../src/chuteWell.ts';
import {modelPreloadEntries} from '../src/modelAssets.ts';

const chute={minX:-2.145,maxX:-0.715,minZ:0.5525,maxZ:1.8525};

test('new players do not wait for the two stage-eight models',()=>{
  const startup=modelPreloadEntries(false).map(([key])=>key);
  const stageEight=modelPreloadEntries(true).map(([key])=>key);
  assert.equal(startup.includes('battle_top_cx13'),false);
  assert.equal(startup.includes('battle_top_bx50'),false);
  assert.ok(stageEight.includes('battle_top_cx13'));
  assert.ok(stageEight.includes('battle_top_bx50'));
});

test('stage eight has eight randomly placed boxed prizes inside the compact playfield',()=>{
  const level=LEVEL_CONFIGS[7],runtime=STAGE_RUNTIME_CONFIGS[7];
  assert.equal(level.prizeType,'battle_top_box');
  assert.equal(level.dollCount,8);
  assert.equal(level.targetWins,2);
  assert.equal(runtime.strong,40);
  assert.equal(runtime.baffleHeight,1.1);
  assert.equal(runtime.clawSize,5);
  assert.equal(runtime.clawScale,0.45);
  let seed=123456789;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const stock=randomCompactBoxStock(8,['battle_top_cx13','battle_top_bx50'],random);
  assert.equal(stock.length,8);
  assert.equal(stock.filter(item=>item.type==='battle_top_cx13').length,4);
  assert.equal(stock.filter(item=>item.type==='battle_top_bx50').length,4);
  for(const item of stock) {
    assert.ok(['battle_top_cx13','battle_top_bx50'].includes(item.type));
    assert.ok(Math.abs(item.x)+0.54<4.8/2);
    assert.ok(Math.abs(item.z)+0.54<4.16/2);
    assert.ok(item.x<=chute.minX-0.66 || item.x>=chute.maxX+0.66 ||
      item.z<=chute.minZ-0.66 || item.z>=chute.maxZ+0.66);
  }
  for(let i=0;i<stock.length;i++) for(let j=i+1;j<stock.length;j++)
    assert.ok(Math.hypot(stock[i].x-stock[j].x,stock[i].z-stock[j].z)>1.05);
});

test('both supplied retail GLBs retain wedge geometry and embedded package artwork',async()=>{
  for (const type of ['battle_top_cx13','battle_top_bx50']) {
    const bytes=await fs.readFile(new URL(`../public/models/prizes/${type}.glb`,import.meta.url));
    assert.equal(bytes.toString('utf8',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    const jsonLength=bytes.readUInt32LE(12);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
    const names=new Set(gltf.nodes.map(node=>node.name));
    for(const name of ['body','header','body_front','header_front','left_body','right_body','back_body']) {
      assert.ok(names.has(name),`${type}: ${name} missing from GLB`);
    }
    assert.equal(gltf.images.length,2);
    assert.ok(gltf.images.every(image=>Number.isInteger(image.bufferView)));
    const face=name=>gltf.meshes[gltf.nodes.find(node=>node.name===name).mesh].primitives[0];
    assert.equal(face('back_body').material,face('body_front').material);
    assert.equal(face('back_header').material,face('header_front').material);
    assert.equal(face('back_body').attributes.TEXCOORD_0,face('body_front').attributes.TEXCOORD_0);
    assert.equal(face('left_body').material,undefined);
  }
});

test('raised stage-eight chute accepts a box at its elevated lip',()=>{
  const bounds={min:{x:-1.8,y:0.73,z:0.8},max:{x:-1.1,y:1.05,z:1.5}};
  assert.equal(isPrizeEnteringChute(bounds,chute),false);
  assert.equal(isPrizeEnteringChute({min:{...bounds.min,y:bounds.min.y-0.8},max:bounds.max},chute),true);
});

test('stage-eight box must fall below the lip inside the opening before scoring',()=>{
  assert.equal(isBoxBelowRaisedChuteLip({x:-1.4,y:0.8,z:1.2},0.8,chute),false);
  assert.equal(isBoxBelowRaisedChuteLip({x:-0.72,y:0.4,z:1.2},0.8,chute),false);
  assert.equal(isBoxBelowRaisedChuteLip({x:-1.4,y:0.4,z:1.2},0.8,chute),true);
});

test('stage-eight chute well physically blocks a box from escaping under the baffle',async()=>{
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:0,z:0});
  try {
    for(const wall of chuteWellWallSpecs(chute,0.8,1.6,0.12)) {
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...wall.position));
      world.createCollider(RAPIER.ColliderDesc.cuboid(...wall.size.map(v=>v/2)),body);
    }
    const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-1.35,0.3,1.2).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.22,0.22,0.22),box);
    box.setLinvel({x:9,y:0,z:0},true);
    for(let i=0;i<30;i++) world.step();
    assert.ok(box.translation().x<chute.maxX-0.18,'box escaped through the right wall below the baffle');
  } finally {world.free();}
});

test('compact side baffle blocks a box at the former gap beside the front rail',async()=>{
  await RAPIER.init();
  const bounds={minX:-2.14*0.65,maxX:-0.71*0.65,minZ:0.55*0.65,maxZ:1.85*0.65};
  const spans=compactChuteBaffleSpans(bounds,4.8*0.65/2,4.16*0.65/2);
  const world=new RAPIER.World({x:0,y:0,z:0});
  try {
    const wall=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(bounds.maxX,1.35,spans.right.center));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.09,0.55,spans.right.length/2),wall);
    const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-0.9,1.3,1.25).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.1,0.1,0.1),box);
    box.setLinvel({x:9,y:0,z:0},true);
    for(let i=0;i<20;i++) world.step();
    assert.ok(box.translation().x<bounds.maxX-0.08,'box slipped around the side baffle');
  } finally {world.free();}
});

test('a boxed prize collider rests on the floor and responds to a second box',async()=>{
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-22,z:0});
  const floor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-0.1,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(2.405,0.1,2.08),floor);
  const boxes=[0,1].map(i=>{
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1+i,0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3,0.5,0.15).setMass(0.16).setFriction(1.05),body);
    return body;
  });
  for(let i=0;i<180;i++) world.step();
  assert.ok(boxes[0].translation().y>0.12);
  assert.ok(boxes[1].translation().y>0.12);
  const a=boxes[0].translation(),b=boxes[1].translation();
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>0.29);
  world.free();
});
