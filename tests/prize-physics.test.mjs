import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {build} from 'esbuild';
import {randomPrizeStock,prizePhysicsProfile,rotatedPrizeHalfHeight} from '../src/prizeStock.ts';
import {stepSuspension,suspensionOffset} from '../src/clawSuspension.ts';
import {PhysicsSystem} from '../src/physics.ts';

const seeded = seed => () => ((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const types = ['pikachu','eevee','milk_box','blindbox'];
const chute = {minX:-3.3,maxX:-1.1,minZ:0.85,maxZ:2.85};

test('random stocking changes positions, rotations and inventory order without losing stock', () => {
  const a = randomPrizeStock(42,types,4.8,chute,seeded(1));
  const b = randomPrizeStock(42,types,4.8,chute,seeded(2));
  assert.equal(a.length,42);
  assert.notDeepEqual(a.map(p=>[p.x,p.z]),b.map(p=>[p.x,p.z]));
  assert.notDeepEqual(a.map(p=>p.type),b.map(p=>p.type));
  assert.notDeepEqual(a.map(p=>p.ry),b.map(p=>p.ry));
  for (const stock of [a,b]) {
    for (const type of types) assert.ok(stock.some(p=>p.type===type));
    for (const p of stock) {
      assert.ok(Math.abs(p.x)<=4.8*0.52 && Math.abs(p.z)<=4.8*0.45);
      assert.ok(!(p.x>chute.minX-0.45 && p.x<chute.maxX+0.45 && p.z>chute.minZ-0.45 && p.z<chute.maxZ+0.45));
    }
  }
  assert.deepEqual(randomPrizeStock(0,types,4.8),[]);
});

test('weight and rolling resistance are independent, bounded settings', () => {
  const normal = prizePhysicsProfile('eevee',true);
  const heavy = prizePhysicsProfile('eevee',true,2);
  assert.equal(heavy.mass,normal.mass*2);
  assert.equal(heavy.angularDamping,normal.angularDamping);
  const steady = prizePhysicsProfile('eevee',true,1,2);
  assert.equal(steady.mass,normal.mass);
  assert.equal(steady.angularDamping,normal.angularDamping*2);
  assert.ok(normal.friction>=0.8 && normal.restitution<0.03);
});

test('dimension-aware mixed stocking vertically separates repeated stack slots below the cabinet roof',()=>{
  const dimensions={pikachu:{radius:0.85,height:1.95},eevee:{radius:0.9,height:2},milk_box:{radius:0.39,height:1.2},blindbox:{radius:0.4125,height:0.8775}};
  const stock=randomPrizeStock(42,types,4.8,chute,seeded(8),1.12,type=>dimensions[type]);
  assert.equal(stock.length,42);
  let highest=0;
  for (let i=0;i<stock.length;i++) {
    const a=stock[i],da=dimensions[a.type],ah=rotatedPrizeHalfHeight(da,a.rx,a.ry,a.rz);
    highest=Math.max(highest,a.y+ah);
    for (let j=0;j<i;j++) {
    const a=stock[i],b=stock[j],da=dimensions[a.type],db=dimensions[b.type];
    if (Math.hypot(a.x-b.x,a.z-b.z)>0.0001) continue;
    const ah=rotatedPrizeHalfHeight(da,a.rx,a.ry,a.rz),bh=rotatedPrizeHalfHeight(db,b.rx,b.ry,b.rz);
    assert.ok(a.y-ah>=b.y+bh+0.05 || b.y-bh>=a.y+ah+0.05,'same-slot stock envelopes intersect before physics starts');
    }
  }
  assert.ok(highest<6.55,`stock starts above the cabinet roof at ${highest}`);
});

test('saved tuning is restored after level initialization and before first stocking',async()=>{
  const source=await fs.readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  const initialization=source.indexOf('levelSystem = new LevelSystem(');
  const restore=source.indexOf('loadTuningConfigFromStorage();');
  assert.ok(restore>initialization);
  assert.ok(restore<source.indexOf('levelSystem.startLevel(0);',initialization));
});

test('Rapier mass changes immediately and rolling resistance dissipates rotation',async () => {
  await RAPIER.init();
  const world = new RAPIER.World({x:0,y:-22,z:0});
  try {
    world.timestep = 1/120;
    world.createCollider(RAPIER.ColliderDesc.cuboid(20,0.1,20).setTranslation(0,-0.1,0).setFriction(0.85));
    const profile = prizePhysicsProfile('eevee',true,2,2);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,0.41,0).setAngularDamping(profile.angularDamping));
    const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.4).setMass(profile.mass).setFriction(profile.friction).setRestitution(profile.restitution),body);
    body.recomputeMassPropertiesFromColliders();
    assert.ok(Math.abs(body.mass()-profile.mass)<0.0001);
    const normalMass = prizePhysicsProfile('eevee',true).mass;
    collider.setMass(normalMass); body.recomputeMassPropertiesFromColliders();
    assert.ok(Math.abs(body.mass()-normalMass)<0.0001);
    body.setAngvel({x:0,y:0,z:6},true);
    for (let i=0;i<240;i++) world.step();
    assert.ok(Math.abs(body.angvel().z)<0.5,'prize kept rolling excessively');
    assert.ok(body.translation().y>0.35);
  } finally {world.free();}
});

test('a sleeping prize resumes falling after its supporting body is removed',async()=>{
  const physics=new PhysicsSystem();
  await physics.init();
  try {
    const support=physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1,0.1,1),support);
    const prize=physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,0));
    physics.world.createCollider(RAPIER.ColliderDesc.ball(0.25).setMass(0.13),prize);
    physics.registerBody(prize,new THREE.Object3D());
    prize.sleep();
    physics.world.removeRigidBody(support);
    for(let i=0;i<60;i++) physics.step();
    assert.ok(prize.translation().y<1.5,'unsupported sleeping prize remained suspended');
  } finally {physics.clear();}
});

const bundle = await build({stdin:{contents:await fs.readFile(new URL('../src/claw.ts',import.meta.url),'utf8'),loader:'ts',sourcefile:'claw.ts'},
  bundle:true,write:false,format:'esm',platform:'node',plugins:[{
    name:'claw-fixture',setup(builder) {
      builder.onResolve({filter:/^(three|@dimforge\/rapier3d-compat)$/},args=>({path:import.meta.resolve(args.path),external:true}));
      builder.onResolve({filter:/^\.\//},args=>({path:args.path,namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},async args=>args.path==='./modelAssets'
        ? {contents:'export const instantiateModel = () => globalThis.clawTestModel.clone(true);'}
        : {contents:await fs.readFile(new URL(`../src/${args.path.slice(2)}.ts`,import.meta.url),'utf8'),loader:'ts'});
    }
  }]});
const {Claw} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('small cabinet keeps open swinging fingers ahead of its backboard',async () => {
  await RAPIER.init();
  const bytes = await fs.readFile(new URL('../public/models/reference/claw.glb',import.meta.url));
  globalThis.clawTestModel = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
  const world = new RAPIER.World({x:0,y:0,z:0});
  try {
    const physics = {world,wakeUpAllDynamicBodies(){},wakeUpNear(){}};
    const claw = new Claw(new THREE.Scene(),physics);
    claw.setClawScale(0.85);
    claw.setMachineBounds(-1.605,1.265,2.05,6);
    claw.setPlayfieldBounds(5.3,4.6);
    world.step();
    claw.moveCarriage(100,-100,1);
    world.step();
    claw.swayAngleX = 0.35;
    claw.swayAngleZ = -0.35;
    claw.update(1/120,physics);
    const bounds = new THREE.Box3().setFromObject(claw.baseMesh);
    assert.ok(bounds.min.z > -4.6*3.035/6.4,'open claw penetrated backboard');
    assert.ok(bounds.max.x < 5.3/2,'open claw penetrated side wall');
  } finally {world.free();delete globalThis.clawTestModel;}
});

test('actual claw stops descending on finger contact and then raises instead of sinking',async () => {
  await RAPIER.init();
  const bytes = await fs.readFile(new URL('../public/models/reference/claw.glb',import.meta.url));
  globalThis.clawTestModel = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
  const world = new RAPIER.World({x:0,y:0,z:0});
  try {
    world.timestep = 1/120;
    const physics = {world,wakeUpAllDynamicBodies(){},wakeUpNear(){}};
    const claw = new Claw(new THREE.Scene(),physics);
    claw.swayAngleX = 0.18; claw.swayAngleZ = -0.12;
    claw.update(1/120,physics);world.step();
    const anchor = claw.baseMesh.getObjectByName('CableAnchor').getWorldPosition(new THREE.Vector3());
    const end = new THREE.Vector3().fromBufferAttribute(claw.cableLine.geometry.getAttribute('position'),1);
    assert.ok(anchor.distanceTo(end)<0.00001,'cable detached from rotated eyelet');
    claw.reset();claw.update(1/120,physics);world.step();
    const tip = claw.baseMesh.getObjectByName('ArmHinge_1').localToWorld(new THREE.Vector3(0.1,-0.79,0));
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(tip.x,tip.y-1,tip.z));
    world.createCollider(RAPIER.ColliderDesc.ball(0.2),prize);
    const stock = {bodies:[prize]};
    claw.actionButtonPressed(stock);
    for (let i=0;i<300 && claw.state==='DESCENDING';i++) {claw.update(1/120,physics,stock);world.step();}
    assert.equal(claw.state,'GRABBING');
    const stopped = claw.ropeLength, height = claw.baseMesh.position.y;
    assert.ok(height>2.5,'claw sank to the bottom before closing');
    for (let i=0;i<25;i++) {claw.update(1/120,physics,stock);world.step();}
    assert.equal(claw.ropeLength,stopped,'cable kept extending after contact');
    for (let i=0;i<100;i++) {claw.update(1/120,physics,stock);world.step();}
    assert.ok(claw.baseMesh.position.y>height+0.3,'claw did not raise after closing');
  } finally {world.free();delete globalThis.clawTestModel;}
});

test('a genuinely gripped prize rises with the claw and keeps its damping after release',async () => {
  await RAPIER.init();
  const bytes = await fs.readFile(new URL('../public/models/reference/claw.glb',import.meta.url));
  globalThis.clawTestModel = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
  const world = new RAPIER.World({x:0,y:-22,z:0});
  try {
    world.timestep = 1/120;
    const physics = {world,wakeUpAllDynamicBodies(){},wakeUpNear(){}};
    const claw = new Claw(new THREE.Scene(),physics);
    claw.config.godMode = true;
    claw.ropeLength = claw.targetRopeLength = 2.4;
    claw.update(1/120,physics);world.step();
    world.createCollider(RAPIER.ColliderDesc.cuboid(2,0.1,2).setTranslation(0,2,0));
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2.45,0).setAngularDamping(1.8).setCcdEnabled(true));
    const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.35).setMass(0.38).setFriction(0.85),prize);
    const stock = {bodies:[prize]};
    claw.actionButtonPressed(stock);claw.actionButtonPressed(stock);
    for (let i=0;i<60;i++) {claw.update(1/120,physics,stock);world.step();}
    assert.equal(claw.grabbedBody,prize,'two contacting fingers did not establish a grip');
    for (let i=0;i<100;i++) {claw.update(1/120,physics,stock);world.step();}
    assert.ok(prize.translation().y>2.95,'gripped prize sank instead of rising');
    claw.reset();
    assert.ok(Math.abs(prize.angularDamping()-1.8)<0.0001);
    assert.ok(Math.abs(collider.friction()-0.85)<0.0001);
  } finally {world.free();delete globalThis.clawTestModel;}
});

test('plush estimates are lighter than filled cartons and appliances',()=>{
  assert.ok(prizePhysicsProfile('eevee',true).mass<prizePhysicsProfile('milk_box',false).mass);
  assert.ok(prizePhysicsProfile('snorlax',true).mass<prizePhysicsProfile('marshall',false).mass);
  assert.ok(prizePhysicsProfile('pikachu',true).mass<0.25);
  assert.ok(prizePhysicsProfile('psyduck',true).mass<prizePhysicsProfile('milk_box',false).mass*0.6);
  assert.ok(prizePhysicsProfile('snorlax',true).mass<prizePhysicsProfile('mug_box',false).mass);
});

test('taut suspension preserves cable length while swinging and at cabinet bounds',()=>{
  for (const length of [0.5,1,3]) {
    const p = suspensionOffset(length,0.3,-0.25,[-0.1,0.1],[-0.2,0.2]);
    assert.ok(Math.abs(Math.hypot(p.x,p.y,p.z)-length)<1e-8);
    assert.ok(Math.abs(p.x)<=0.1 && Math.abs(p.z)<=0.2);
  }
});

test('braking excites a damped swing, longer cables restore more slowly, steady velocity adds no lean',()=>{
  const short = stepSuspension(0.2,0,0,0.5,1/120,1.4,false);
  const long = stepSuspension(0.2,0,0,3,1/120,1.4,false);
  assert.ok(Math.abs(short.velocity)>Math.abs(long.velocity));
  let p = stepSuspension(0,0,-2,1,1/120,1.4,false);
  assert.ok(p.velocity>0);
  for (let i=0;i<1200;i++) p=stepSuspension(p.angle,p.velocity,0,1,1/120,1.4,false);
  assert.ok(Math.abs(p.angle)<0.01 && Math.abs(p.velocity)<0.02);
  assert.deepEqual(stepSuspension(0,0,0,1,1/120,1.4,false),{angle:0,velocity:0});
});
