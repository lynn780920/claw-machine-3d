import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { isDelivered, isWedgedInChute, isPrizeEnteringChute } from '../src/delivery.ts';
import { LEVEL_CONFIGS } from '../src/levelSystem.ts';
import { fitMachineCamera } from '../src/renderSetup.ts';
import { withTimeout } from '../src/modelAssets.ts';
import { PRIZE_TYPES } from '../src/modelAssets.ts';
import { APPLIANCE_TYPES, MIXED_PRIZE_TYPES, prizeStockScale } from '../src/modelAssets.ts';
import { collectHullPoints, centerAndScaleHullPoints } from '../src/prizeGeometry.ts';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { ClawFinger, moveCoupledFingers } from '../src/clawCollisions.ts';
import { LARGE_POKEMON_DIMENSIONS, POKEMON_TYPES, FEATURED_POKEMON_TYPES, applyPlushMaterial } from '../src/modelAssets.ts';
import { CABINET_PALETTES, colorCabinetModel } from '../src/cabinetPalette.ts';

test('each machine palette colors the GLB shell and base differently', () => {
  assert.equal(new Set(Object.values(CABINET_PALETTES).map(palette => palette.shell)).size, 4);
  for (const palette of Object.values(CABINET_PALETTES)) {
    const root = new THREE.Group();
    for (const name of ['Frame_1_1', 'BaseCabinet', 'BackPanel']) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      mesh.name = name;
      root.add(mesh);
    }
    colorCabinetModel(root, palette);
    assert.equal(root.getObjectByName('Frame_1_1').material.color.getHex(), palette.shell);
    assert.equal(root.getObjectByName('BaseCabinet').material.color.getHex(), palette.base);
    assert.equal(root.getObjectByName('BackPanel').material.color.getHex(), palette.panel);
  }
});

test('Snorlax and Eevee have independent full-size plush dimensions', () => {
  assert.ok(LARGE_POKEMON_DIMENSIONS.snorlax.height > 2);
  assert.ok(LARGE_POKEMON_DIMENSIONS.snorlax.radius > 0.9);
  assert.equal(LARGE_POKEMON_DIMENSIONS.eevee.height,2);
  assert.ok(LARGE_POKEMON_DIMENSIONS.eevee.radius >= 0.9);
});

test('Psyduck and Gengar use full-size plush dimensions', () => {
  for (const type of ['psyduck','gengar']) {
    assert.ok(LARGE_POKEMON_DIMENSIONS[type].height >= 1.9);
    assert.ok(LARGE_POKEMON_DIMENSIONS[type].radius >= 1.0);
  }
});

test('resized skinned Pokemon collider bounds match their visible GLB bounds', async () => {
  const originalSelf = globalThis.self;
  const originalBitmap = globalThis.createImageBitmap;
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({width:1,height:1,close(){}});
  try {
    for (const type of ['psyduck','gengar','eevee']) {
      const bytes = await fs.readFile(new URL(`../public/models/pokemon/${type}.glb`,import.meta.url));
      const visual = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
      const sourceHull = collectHullPoints(visual);
      const bounds = new THREE.Box3().setFromObject(visual);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const {radius,height} = LARGE_POKEMON_DIMENSIONS[type];
      const ratio = Math.min(height/size.y,radius*2/Math.max(size.x,size.z));
      const hull = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(centerAndScaleHullPoints(sourceHull,center,ratio),3));
      visual.scale.setScalar(ratio);
      visual.position.copy(center).multiplyScalar(-ratio);
      const visible = new THREE.Box3().setFromObject(visual,true);
      if (type === 'psyduck') assert.ok(visible.getSize(new THREE.Vector3()).y > 1.7);
      if (type === 'gengar') assert.ok(visible.getSize(new THREE.Vector3()).y > 1.25);
      assert.ok(hull.min.distanceTo(visible.min)<0.06,`${type} hull bottom is displaced`);
      assert.ok(hull.max.distanceTo(visible.max)<0.06,`${type} hull top is displaced`);
    }
  } finally {
    if (originalSelf === undefined) delete globalThis.self; else globalThis.self = originalSelf;
    if (originalBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = originalBitmap;
  }
});

test('first-stage mixed stock excludes appliances and retains all Pokemon', () => {
  for (const type of APPLIANCE_TYPES) {
    assert.ok(!MIXED_PRIZE_TYPES.includes(type));
    assert.ok(PRIZE_TYPES.includes(type));
  }
  for (const type of POKEMON_TYPES) {
    assert.ok(MIXED_PRIZE_TYPES.includes(type));
    assert.equal(prizeStockScale(type,'mixed'),1);
  }
});

test('Eevee replaces Charizard in every selectable Pokemon stock pool', () => {
  for (const pool of [POKEMON_TYPES,FEATURED_POKEMON_TYPES,MIXED_PRIZE_TYPES]) {
    assert.ok(!pool.includes('charizard'));
    assert.equal(pool.filter(type=>type==='eevee').length,1);
  }
});

test('plush shading preserves the original color map and reduces white sheen', () => {
  const map = new THREE.Texture();
  const material = new THREE.MeshPhysicalMaterial({map,color:0x9c6030,sheen:1});
  const originalColor = material.color.clone();
  applyPlushMaterial(material);
  assert.equal(material.map,map);
  assert.ok(material.color.equals(originalColor));
  assert.equal(material.sheen,0.12);
  assert.equal(material.metalness,0);
  assert.ok(material.roughness>0.9);
  assert.ok(material.bumpMap);
  assert.equal(material.bumpMap.colorSpace,THREE.NoColorSpace);
  const second = new THREE.MeshPhysicalMaterial();
  applyPlushMaterial(second);
  assert.equal(second.bumpMap,material.bumpMap);
});

test('mixed stock boxes are 25 percent smaller without changing other stages', () => {
  for (const type of ['tea_box','fruit_box','milk_box','dragonball','onepiece','mug_box','cookie_box','blindbox','ssr_glowing_labubu']) {
    assert.equal(prizeStockScale(type,'mixed'),0.75);
    assert.equal(prizeStockScale(type,'blindbox'),1);
    assert.equal(prizeStockScale(type,'anime'),1);
  }
  for (const type of APPLIANCE_TYPES) assert.equal(prizeStockScale(type,'giant_appliances'),1);
});

test('legacy bear and capybara models are not selectable or stocked',()=> {
  for(const type of ['giant_bear','capybara','ssr_golden_capybara','chiikawa','kirby','my_cat']) assert.ok(!PRIZE_TYPES.includes(type));
});

test('a model-shaped prize falls onto the floor without an invisible support gap',async ()=> {
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-22,z:0});
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(10,0.1,10).setTranslation(0,-0.1,0));
    const root=new THREE.Group(); root.add(new THREE.Mesh(new THREE.TetrahedronGeometry(1)));
    const points=collectHullPoints(root);
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,5,0));
    world.createCollider(RAPIER.ColliderDesc.convexHull(points),body);
    for(let i=0;i<400;i++) world.step();
    const q=body.rotation(),p=body.translation();
    const quaternion=new THREE.Quaternion(q.x,q.y,q.z,q.w);
    let bottom=Infinity;
    for(let i=0;i<points.length;i+=3) {
      const vertex=new THREE.Vector3(points[i],points[i+1],points[i+2]).applyQuaternion(quaternion);
      bottom=Math.min(bottom,vertex.y+p.y);
    }
    assert.ok(Math.abs(bottom)<0.03,`prize bottom is ${bottom} above the floor`);
  } finally { world.free(); }
});

test('prize hull vertices are body-local, independent of spawn position and rotation',()=> {
  const root=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,4,6));
  root.add(mesh);
  root.position.set(20,30,40); root.rotation.set(0.3,1.2,0.4);
  const bounds=new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(collectHullPoints(root),3));
  assert.ok(bounds.min.distanceTo(new THREE.Vector3(-1,-2,-3))<0.0001);
  assert.ok(bounds.max.distanceTo(new THREE.Vector3(1,2,3))<0.0001);
});

test('asset watchdog returns completed work and rejects a stalled operation',async () => {
  assert.equal(await withTimeout(Promise.resolve('ready'),100,'Model'),'ready');
  await assert.rejects(withTimeout(new Promise(()=>{}),10,'Model'),/Model: timeout/);
});

test('desktop camera frames the playfield at the original arcade distance', () => {
  const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100);
  const controls={target:new THREE.Vector3(),update:()=>{}};
  fitMachineCamera(camera,controls,{width:7.4,height:6.6,depth:6.4});
  assert.ok(camera.position.z>10 && camera.position.z<11);
});

test('first stage stocks a playable mixed assortment without changing later stage counts', () => {
  assert.equal(LEVEL_CONFIGS[0].prizeType,'mixed');
  assert.deepEqual(LEVEL_CONFIGS.map(level=>level.dollCount),[42,25,5,12,18,15,13]);
});

for (const type of ['pikachu','eevee','gengar','snorlax','psyduck','charizard','squirtle','bulbasaur']) {
  test(`${type} exports embedded textures and matte materials without Draco dependency`,async () => {
    const bytes = await fs.readFile(new URL(`../public/models/pokemon/${type}.glb`,import.meta.url));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(data.meshes.length);
    if (FEATURED_POKEMON_TYPES.includes(type)) assert.ok(!data.skins?.length,'prize bounds must not depend on an unevaluated armature');
    assert.ok(data.images.every(image=>Number.isInteger(image.bufferView)));
    assert.ok(!data.extensionsRequired?.includes('KHR_draco_mesh_compression'));
    assert.ok(data.materials.every(material=>material.pbrMetallicRoughness.roughnessFactor>0.8));
  });
}

const load = async name => {
  const bytes = await fs.readFile(new URL(`../public/models/reference/${name}.glb`,import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  return gltf.scene;
};

test('GLB fingers stop closing at a prize surface instead of penetrating it',async () => {
  await RAPIER.init();
  const world = new RAPIER.World({x:0,y:0,z:0});
  try {
    world.timestep = 1/120;
    const asset = await load('claw');
    const root = asset.getObjectByName('ClawRoot');
    root.position.y = 2;
    const finger = new ClawFinger(world,root.getObjectByName('ArmHinge_1'));
    assert.ok(finger.colliders.length >= 16);
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.36,1.38,0));
    const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.16),prize);
    for (let i=0;i<180;i++) {
      finger.move(Math.max(-0.5,finger.angle-0.015),[prize]);
      world.step();
    }
    assert.ok(finger.angle > -0.45,'finger closed through the prize');
    assert.ok(finger.contact(prize),'finger never reached the prize surface');
    for (const part of finger.colliders) {
      const contact = part.contactCollider(collider,0.03);
      if (contact) assert.ok(contact.distance >= -0.004,`penetration ${contact.distance}`);
    }
    root.scale.setScalar(1.35);
    finger.rebuild();
    assert.ok(finger.colliders.length >= 16);
    finger.move(finger.angle,[]);
    world.step();
    const prong = finger.hinge.getObjectByName('Prong_1');
    const vertices = prong.geometry.attributes.position;
    for (let i=0;i<vertices.count;i+=11) {
      const point = prong.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices,i));
      assert.ok(finger.colliders.some(part => {
        const projection = part.projectPoint(point,true);
        return projection && point.distanceTo(new THREE.Vector3(projection.point.x,projection.point.y,projection.point.z))<0.01;
      }),'scaled GLB finger surface is outside its collision shape');
    }
  } finally {world.free();}
});

test('a shared collar keeps all three rigid claws level when one finger meets a box',async()=>{
  await RAPIER.init();
  const world = new RAPIER.World({x:0,y:0,z:0});
  try {
    const asset = await load('claw');
    const root = asset.getObjectByName('ClawRoot');
    root.position.y = 2;
    const fingers = [1,2,3].map(i=>new ClawFinger(world,root.getObjectByName(`ArmHinge_${i}`)));
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.36,1.38,0));
    world.createCollider(RAPIER.ColliderDesc.ball(0.16),prize);
    let angle = fingers[0].angle;
    for(let i=0;i<150;i++) {
      angle = moveCoupledFingers(fingers,Math.max(-0.5,angle-0.015),[prize]);
      world.step();
    }
    assert.ok(angle > -0.45,'collar passed through a rigid box');
    assert.ok(fingers.every(finger=>Math.abs(finger.angle-angle)<1e-6),'prongs did not follow one collar');
    assert.ok(fingers[0].contact(prize),'blocked prong lost contact');
    moveCoupledFingers(fingers,ClawFinger.MAX_ANGLE,[]);
    for(const finger of fingers) {
      const hinge = finger.hinge.getWorldPosition(new THREE.Vector3());
      const tip = finger.hinge.localToWorld(new THREE.Vector3(0.23,-0.86,0));
      assert.ok(hinge.y-tip.y>0.70,'open prong hangs too high');
      assert.ok(Math.hypot(tip.x,tip.z)<0.96,'open prong spreads too far sideways');
    }
  } finally {world.free();}
});

test('moving metal fingers transfer momentum and unsupported prizes fall under gravity',async () => {
  await RAPIER.init();
  const world = new RAPIER.World({x:0,y:0,z:0});
  try {
    world.timestep = 1/120;
    const asset = await load('claw');
    const root = asset.getObjectByName('ClawRoot');
    root.position.y = 2.5;
    const hinge = root.getObjectByName('ArmHinge_1');
    const finger = new ClawFinger(world,hinge);
    const tip = hinge.localToWorld(new THREE.Vector3(0.23,-0.86,0));
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true)
      .setTranslation(tip.x+0.18,tip.y,tip.z));
    world.createCollider(RAPIER.ColliderDesc.ball(0.12).setMass(0.35),prize);
    const initial = prize.translation().x;
    for (let i=0;i<240;i++) {
      root.position.x = i/300;
      finger.move(finger.angle,[prize]);
      world.step();
    }
    assert.ok(prize.translation().x > initial+0.35,'prize did not react to finger contact');
    const height = prize.translation().y;
    root.position.x = -5;
    finger.move(finger.angle,[]);
    world.gravity = {x:0,y:-9.81,z:0};
    for (let i=0;i<120;i++) world.step();
    assert.ok(prize.translation().y < height-4);
    assert.ok(prize.linvel().y < -9);
  } finally {world.free();}
});

test('all three GLB hinges animate their tips and belong to the claw root',async () => {
  const asset = await load('claw');
  const claw = asset.getObjectByName('ClawRoot');
  assert.ok(claw);
  for(let i=1;i<=3;i++) {
    const pivot = claw.getObjectByName(`ArmPivot_${i}`);
    const hinge = pivot.getObjectByName(`ArmHinge_${i}`);
    const prong = hinge.getObjectByName(`Prong_${i}`);
    assert.ok(hinge.getObjectByName(`LinkBracket_${i}`));
    hinge.rotation.z=ClawFinger.MAX_ANGLE;
    asset.updateMatrixWorld(true);
    const open = prong.localToWorld(new THREE.Vector3(0.08,-0.84,0));
    hinge.rotation.z=-0.5;
    asset.updateMatrixWorld(true);
    const closed = prong.localToWorld(new THREE.Vector3(0.08,-0.84,0));
    assert.ok(open.distanceTo(closed)>0.5,`arm ${i} does not move`);
  }
  assert.ok(asset.getObjectByName('CarriageRoot').getObjectByName('CarriageMotor'));
});

test('cabinet contains controls, glass and four separately adjustable floor sections',async () => {
  const asset=await load('cabinet');
  for(const name of ['JoystickPivot','JoystickKnob','ActionButton','GlassFront','BackSign','FloorRight','FloorBack','FloorLeft','FloorFront']) assert.ok(asset.getObjectByName(name),name);
  assert.ok(asset.getObjectByName('BackSign').geometry.attributes.uv);
});

for(const type of ['tea_box','fruit_box','milk_box']) {
  test(`${type} has six package faces and a centered collider reference`,async () => {
    const asset=await load(type);
    for(const face of ['Front','Back','Left','Right','Top','Bottom']) assert.ok(asset.getObjectByName(`Label${face}`));
    const bounds=new THREE.Box3().setFromObject(asset);
    assert.ok(bounds.getCenter(new THREE.Vector3()).length()<0.0001);
    assert.ok(bounds.getSize(new THREE.Vector3()).y>1.4);
  });

}

test('claw finger respects rigid mechanical end stops',async()=>{
  await RAPIER.init();
  const world = new RAPIER.World({x:0,y:-9.81,z:0});
  try {
    const asset = await load('claw');
    const root = asset.getObjectByName('ClawRoot');
    root.updateWorldMatrix(true,true);
    const finger = new ClawFinger(world,root.getObjectByName('ArmHinge_1'));
    finger.move(-4,[]);
    assert.equal(finger.angle,ClawFinger.MIN_ANGLE);
    finger.move(4,[]);
    assert.equal(finger.angle,ClawFinger.MAX_ANGLE);
  } finally {world.free();}
});

const chute={minX:-3.3,maxX:-1.1,minZ:0.85,maxZ:2.85};
test('a prize must pass below the actual chute footprint before it scores',() => {
  assert.equal(isDelivered({x:-2,y:-0.5,z:2},chute),true);
  assert.equal(isDelivered({x:-2,y:0.1,z:2},chute),false);
  assert.equal(isDelivered({x:0,y:-2,z:2},chute),false);
  assert.equal(isDelivered({x:-2,y:-2,z:3.2},chute),false);
  assert.equal(isDelivered({x:-2,y:-2,z:0.2},chute),false);
});

test('a prize wedged across the chute mouth can be captured without scoring a flyover', () => {
  assert.equal(isWedgedInChute({x:-2,y:0.8,z:2},0.03,0.01,chute),true);
  assert.equal(isWedgedInChute({x:-2,y:2,z:2},0.03,0,chute),false);
  assert.equal(isWedgedInChute({x:-2,y:0.8,z:2},0.8,0,chute),false);
  assert.equal(isWedgedInChute({x:-2,y:0.8,z:2},0.03,-2,chute),false);
  assert.equal(isWedgedInChute({x:-3.25,y:0.8,z:2},0.03,0,chute),true);
});

test('a prize mostly inside the chute opening is delivered even when its center is near the rim',()=>{
  const chute={minX:-3.3,maxX:-1.1,minZ:0.85,maxZ:2.85};
  assert.equal(isPrizeEnteringChute({min:{x:-3.15,y:-0.05,z:1.1},max:{x:-0.95,y:1.4,z:2.5}},chute),true);
  assert.equal(isPrizeEnteringChute({min:{x:-1.35,y:-0.05,z:1.1},max:{x:0.85,y:1.4,z:2.5}},chute),false);
  assert.equal(isPrizeEnteringChute({min:{x:-3.15,y:0.3,z:1.1},max:{x:-0.95,y:1.4,z:2.5}},chute),false);
});
