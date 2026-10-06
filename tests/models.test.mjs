import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { isDelivered } from '../src/delivery.ts';

for (const type of ['pikachu','eevee','gengar','snorlax','psyduck']) {
  test(`${type} exports embedded textures and matte materials without Draco dependency`,async () => {
    const bytes = await fs.readFile(new URL(`../public/models/pokemon/${type}.glb`,import.meta.url));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(data.meshes.length);
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
