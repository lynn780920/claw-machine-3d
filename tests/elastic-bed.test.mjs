import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {ElasticBed} from '../src/elasticBed.ts';
import {PhysicsSystem} from '../src/physics.ts';

async function drop(height,tilt=0,timestep=1/480,iterations=20) {
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-22,z:0});
  world.timestep=timestep;
  world.integrationParameters.numSolverIterations=iterations;
  const bed=new ElasticBed(world,[['test',-2,2,-2,2]],new THREE.MeshStandardMaterial());
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,tilt/2));
  const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.12,height,0.1).setRotation(rotation).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.35,0.4,0.3).setMass(0.5).setRestitution(0),box);
  let descending=false,launched=false,peak=-Infinity,minY=Infinity,maxSpin=0;
  try {
    for(let i=0;i<1440;i++) {
      world.step();
      const y=box.translation().y,v=box.linvel().y;
      minY=Math.min(minY,y);
      if(v < -0.5) descending=true;
      if(descending && v>0.5) launched=true;
      if(launched) peak=Math.max(peak,y);
      maxSpin=Math.max(maxSpin,Math.hypot(...Object.values(box.angvel())));
      if(launched && y>0.6 && v<0) break;
    }
    const positions=bed.meshes[0].geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    return {peak,minY,maxSpin,launched};
  } finally {bed.dispose();world.free();}
}

test('elastic contacts return drop energy without a scripted launch',async () => {
  const low=await drop(1.4),high=await drop(3.4);
  assert.ok(high.launched && high.minY>0.3,'prize tunneled through the bed');
  assert.ok(high.peak>1.6,'insufficient rebound');
  assert.ok(high.peak<3.5,`rebound creates energy: ${JSON.stringify(high)}`);
  assert.ok(high.peak>low.peak+0.5,'rebound ignores incoming energy');
});

test('off-center elastic contacts transfer rotation to a tilted box',async () => {
  const result=await drop(3,0.28);
  assert.ok(result.launched);
  assert.ok(result.maxSpin>0.5);
});

test('mobile solver budget still rebounds a dropped prize',async () => {
  const result=await drop(3.4,0,1/120,8);
  assert.ok(result.launched && result.peak>1.6,'mobile cloth lost its bounce');
});

test('stage setup preserves a fixed cloth surface and restores its timestep',async () => {
  const physics = new PhysicsSystem();
  await physics.init();
  physics.substeps = 2;
  physics.world.integrationParameters.numSolverIterations = 8;
  const bed = new ElasticBed(physics.world,[['test',-3,3,-3,3]],new THREE.MeshStandardMaterial());
  const box = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1.5,0).setCcdEnabled(true));
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.85,0.975,0.6).setMass(0.22),box);
  const timestep = physics.world.timestep;
  try {
    physics.prewarmSimulation(25);
    assert.equal(physics.world.timestep,timestep);
    const positions = bed.meshes[0].geometry.getAttribute('position');
    for (let i=0;i<positions.count;i++) assert.ok(Number.isFinite(positions.getY(i)) && Math.abs(positions.getY(i)) < 2);
  } finally {bed.dispose();physics.clear();}
});

test('cloth leaves the chute open and disposes all surface bodies',async () => {
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

test('repeated kinematic claw impacts cannot stretch the elastic surface',async () => {
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-22,z:0});
  world.timestep=1/120;
  world.integrationParameters.numSolverIterations=8;
  const bed=new ElasticBed(world,[['test',-3,3,-3,3]],new THREE.MeshStandardMaterial());
  for(const [x,z,hx,hz] of [[-3,0,0.1,3],[3,0,0.1,3],[0,-3,3,0.1],[0,3,3,0.1]]) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx,5,hz).setTranslation(x,5,z));
  }
  const mesh=bed.meshes[0];
  const vertices=Array.from(mesh.geometry.getAttribute('position').array);
  const claw=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,3,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.25,0.2,0.25),claw);
  const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,0).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.85,0.975,0.6).setMass(0.22),box);
  try {
    for(let cycle=0;cycle<20;cycle++) {
      box.setTranslation({x:1.5,y:3,z:0},true);
      box.setLinvel({x:0,y:0,z:0},true);
      box.setAngvel({x:0,y:0,z:0},true);
      for(let i=0;i<360;i++) {
        claw.setNextKinematicTranslation({x:0,y:1.4+1.8*Math.cos(i*Math.PI/180),z:0});
        world.step();
        assert.ok(Object.values(box.translation()).every(Number.isFinite));
        assert.ok(Math.abs(box.translation().y)<10,'unbounded prize motion');
      }
    }
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),vertices);
    assert.equal(mesh.position.y,0.008);
    assert.equal(world.bodies.len(),3);
    assert.equal(world.impulseJoints.len(),0);
  } finally {bed.dispose();world.free();}
});
