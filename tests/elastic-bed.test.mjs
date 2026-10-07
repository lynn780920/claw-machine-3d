import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {ElasticBed} from '../src/elasticBed.ts';

async function drop(height,tilt=0) {
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-22,z:0});
  world.timestep=1/480;
  world.integrationParameters.numSolverIterations=20;
  const bed=new ElasticBed(world,[['test',-2,2,-2,2]],new THREE.MeshStandardMaterial());
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,tilt/2));
  const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.12,height,0.1).setRotation(rotation).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.35,0.4,0.3).setMass(0.5).setRestitution(0),box);
  let compressed=false,launched=false,peak=-Infinity,minY=Infinity,maxSpin=0;
  try {
    for(let i=0;i<1440;i++) {
      world.step();
      const y=box.translation().y,v=box.linvel().y;
      minY=Math.min(minY,y);
      if(y<0.4) compressed=true;
      if(compressed && v>0.5) launched=true;
      if(launched) peak=Math.max(peak,y);
      maxSpin=Math.max(maxSpin,Math.hypot(...Object.values(box.angvel())));
      if(launched && y>0.6 && v<0) break;
    }
    bed.updateVisuals();
    const positions=bed.meshes[0].geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    return {peak,minY,maxSpin,launched};
  } finally {bed.dispose();world.free();}
}

test('spring bed compresses and returns drop energy without a scripted launch',async () => {
  const low=await drop(1.4),high=await drop(3.4);
  assert.ok(high.launched && high.minY<0.4);
  assert.ok(high.peak>1.6,'insufficient rebound');
  assert.ok(high.peak<3.5,'rebound creates energy');
  assert.ok(high.peak>low.peak+0.5,'rebound ignores incoming energy');
});

test('off-center spring contacts transfer rotation to a tilted box',async () => {
  const result=await drop(3,0.28);
  assert.ok(result.launched);
  assert.ok(result.maxSpin>0.5);
});

test('cloth leaves the chute open and disposes all spring bodies',async () => {
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-22,z:0});
  world.timestep=1/480;
  const bed=new ElasticBed(world,[['right',0,2,-2,2],['back',-2,0,-2,0]],new THREE.MeshStandardMaterial());
  const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-1,1,1));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.2,0.2,0.2).setMass(0.5),box);
  for(let i=0;i<240;i++) world.step();
  assert.ok(box.translation().y < -1,'cloth blocked chute');
  bed.dispose();
  assert.equal(world.bodies.len(),1);
  world.free();
});
