import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { isDelivered } from '../src/delivery.ts';
import { LEVEL_CONFIGS } from '../src/levelSystem.ts';
import { fitMachineCamera } from '../src/renderSetup.ts';
import { withTimeout } from '../src/modelAssets.ts';
import { collectHullPoints } from '../src/prizeGeometry.ts';
import * as RAPIER from '@dimforge/rapier3d-compat';

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

test('first stage stocks 42 mixed prizes without changing later stage counts', () => {
  assert.equal(LEVEL_CONFIGS[0].prizeType,'mixed');
  assert.deepEqual(LEVEL_CONFIGS.map(level=>level.dollCount),[42,25,5,12]);
});

for (const type of ['pikachu','eevee','gengar','snorlax','psyduck','charizard','squirtle','bulbasaur']) {
  test(`${type} exports embedded textures and matte materials without Draco dependency`,async () => {
    const bytes = await fs.readFile(new URL(`../public/models/pokemon/${type}.glb`,import.meta.url));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(data.meshes.length);
    if (['pikachu','charizard','squirtle','bulbasaur'].includes(type)) assert.ok(!data.skins?.length,'prize bounds must not depend on an unevaluated armature');
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

test('all three GLB hinges animate their tips and belong to the claw root',async () => {
  const asset = await load('claw');
  const claw = asset.getObjectByName('ClawRoot');
  assert.ok(claw);
  for(let i=1;i<=3;i++) {
    const pivot = claw.getObjectByName(`ArmPivot_${i}`);
    const hinge = pivot.getObjectByName(`ArmHinge_${i}`);
    const prong = hinge.getObjectByName(`Prong_${i}`);
    assert.ok(hinge.getObjectByName(`LinkBracket_${i}`));
    hinge.rotation.z=0.85;
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

const chute={minX:-3.3,maxX:-1.1,minZ:0.85,maxZ:2.85};
test('a prize must pass below the actual chute footprint before it scores',() => {
  assert.equal(isDelivered({x:-2,y:-0.5,z:2},chute),true);
  assert.equal(isDelivered({x:-2,y:0.1,z:2},chute),false);
  assert.equal(isDelivered({x:0,y:-2,z:2},chute),false);
  assert.equal(isDelivered({x:-2,y:-2,z:3.2},chute),false);
  assert.equal(isDelivered({x:-2,y:-2,z:0.2},chute),false);
});
