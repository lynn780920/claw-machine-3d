import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';

export class PrizesManager {
  public prizes: THREE.Object3D[] = [];
  public bodies: RAPIER.RigidBody[] = [];
  private scene: THREE.Scene;
  private physics: PhysicsSystem;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.scene = scene;
    this.physics = physics;
  }

  // Spawn a pile of dolls inside the cabinet with shape filter option
  spawnPrizes(count = 20, typeFilter: string = 'mixed') {
    this.clearPrizes();

    for (let i = 0; i < count; i++) {
      // Keep toys inside boundaries: X: -3 to 3, Z: -3 to 1 (avoiding the chute at X:-4.5 to -1.5, Z:1.5 to 4.5)
      let x = (Math.random() - 0.5) * 6; // -3 to 3
      let z = (Math.random() - 0.5) * 6; // -3 to 3
      
      // If it falls near the chute, nudge it away
      if (x < -1.0 && z > 1.0) {
        x += 3.0;
      }
      
      // Stack them on top of each other
      const y = 1.0 + (i % 4) * 1.5;

      let prizeType = typeFilter;
      if (typeFilter === 'mixed') {
        // Mixed: 60% Plush Bears, 40% Figurine Boxes (NO SPHERES BY DEFAULT!)
        prizeType = Math.random() < 0.6 ? 'bear' : 'block';
      }

      if (prizeType === 'bear') {
        this.spawnPlushBear(x, y, z);
      } else if (prizeType === 'block') {
        this.spawnBlock(x, y, z);
      } else if (prizeType === 'sphere') {
        this.spawnSphereToy(x, y, z);
      } else {
        this.spawnPlushBear(x, y, z);
      }
    }
  }

  // Clear all toys
  clearPrizes() {
    this.prizes.forEach(p => this.scene.remove(p));
    this.bodies.forEach(b => {
      this.physics.unregisterBody(b);
      this.physics.world.removeRigidBody(b);
    });
    this.prizes = [];
    this.bodies = [];
  }

  // Spawn a Bear Plush Doll (using Rapier Compound Colliders to make limbs that can be hooked!)
  private spawnPlushBear(x: number, y: number, z: number) {
    const bearGroup = new THREE.Group();
    bearGroup.position.set(x, y, z);
    
    // Vivid plush bear colors matching reference photo
    const colors = [0xd90429, 0x00b4d8, 0xff007f, 0xffb703, 0x7b2cbf, 0x70e000, 0xff4d6d];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.1
    });

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, roughness: 0.8 });

    // Torso (身體) - main body
    const bodyGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.scale.set(1, 1.2, 1);
    bodyMesh.castShadow = true;
    bearGroup.add(bodyMesh);

    // Head (頭)
    const headGeo = new THREE.SphereGeometry(0.4, 12, 12);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 0.65, 0);
    headMesh.castShadow = true;
    bearGroup.add(headMesh);

    // Snout
    const snoutGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const snoutMesh = new THREE.Mesh(snoutGeo, snoutMat);
    snoutMesh.position.set(0, 0.62, 0.3);
    bearGroup.add(snoutMesh);

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const noseMesh = new THREE.Mesh(noseGeo, blackMat);
    noseMesh.position.set(0, 0.66, 0.4);
    bearGroup.add(noseMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, blackMat);
    leftEye.position.set(-0.15, 0.72, 0.32);
    const rightEye = new THREE.Mesh(eyeGeo, blackMat);
    rightEye.position.set(0.15, 0.72, 0.32);
    bearGroup.add(leftEye);
    bearGroup.add(rightEye);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const leftEar = new THREE.Mesh(earGeo, mat);
    leftEar.position.set(-0.32, 0.95, 0);
    const rightEar = new THREE.Mesh(earGeo, mat);
    rightEar.position.set(0.32, 0.95, 0);
    bearGroup.add(leftEar);
    bearGroup.add(rightEar);

    // Limbs (手腳 - 這些突出部非常適合被爪子「勾腳/勾手」！)
    const armGeo = new THREE.CapsuleGeometry(0.12, 0.4, 4, 8);
    const legGeo = new THREE.CapsuleGeometry(0.15, 0.45, 4, 8);

    // Arms
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-0.55, 0.2, 0);
    leftArm.rotation.z = Math.PI / 3;
    leftArm.castShadow = true;
    bearGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(0.55, 0.2, 0);
    rightArm.rotation.z = -Math.PI / 3;
    rightArm.castShadow = true;
    bearGroup.add(rightArm);

    // Legs
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-0.35, -0.65, 0.15);
    leftLeg.rotation.x = Math.PI / 6;
    leftLeg.castShadow = true;
    bearGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(0.35, -0.65, 0.15);
    rightLeg.rotation.x = Math.PI / 6;
    rightLeg.castShadow = true;
    bearGroup.add(rightLeg);

    this.scene.add(bearGroup);
    this.prizes.push(bearGroup);

    // Physics Compound Body
    if (this.physics.world) {
      // Dynamic Body with CCD enabled to prevent tunneling
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.4)
        .setAngularDamping(0.4);
      const body = this.physics.world.createRigidBody(bodyDesc);

      // Main Torso collider
      const bodyCollider = RAPIER.ColliderDesc.ball(0.4)
        .setTranslation(0, 0, 0)
        .setMass(0.2)
        .setFriction(0.7)
        .setRestitution(0.1);
      this.physics.world.createCollider(bodyCollider, body);

      // Head collider
      const headCollider = RAPIER.ColliderDesc.ball(0.32)
        .setTranslation(0, 0.65, 0)
        .setFriction(0.7)
        .setRestitution(0.1);
      this.physics.world.createCollider(headCollider, body);

      // Left Arm collider
      const leftArmCollider = RAPIER.ColliderDesc.capsule(0.2, 0.12)
        .setTranslation(-0.55, 0.2, 0)
        .setRotation({ w: Math.cos(Math.PI/6), x: 0, y: 0, z: Math.sin(Math.PI/6) })
        .setFriction(0.8)
        .setRestitution(0.1);
      this.physics.world.createCollider(leftArmCollider, body);

      // Right Arm collider
      const rightArmCollider = RAPIER.ColliderDesc.capsule(0.2, 0.12)
        .setTranslation(0.55, 0.2, 0)
        .setRotation({ w: Math.cos(-Math.PI/6), x: 0, y: 0, z: Math.sin(-Math.PI/6) })
        .setFriction(0.8)
        .setRestitution(0.1);
      this.physics.world.createCollider(rightArmCollider, body);

      // Left Leg collider
      const leftLegCollider = RAPIER.ColliderDesc.capsule(0.22, 0.15)
        .setTranslation(-0.35, -0.65, 0.15)
        .setRotation({ w: Math.cos(Math.PI/12), x: Math.sin(Math.PI/12), y: 0, z: 0 })
        .setFriction(0.8)
        .setRestitution(0.1);
      this.physics.world.createCollider(leftLegCollider, body);

      // Right Leg collider
      const rightLegCollider = RAPIER.ColliderDesc.capsule(0.22, 0.15)
        .setTranslation(0.35, -0.65, 0.15)
        .setRotation({ w: Math.cos(Math.PI/12), x: Math.sin(Math.PI/12), y: 0, z: 0 })
        .setFriction(0.8)
        .setRestitution(0.1);
      this.physics.world.createCollider(rightLegCollider, body);

      this.physics.registerBody(body, bearGroup);
      this.bodies.push(body);
    }
  }

  // Spawn simple toy block (can rub corners - 磨角)
  private spawnBlock(x: number, y: number, z: number) {
    const w = 0.8 + Math.random() * 0.4;
    const h = 0.8 + Math.random() * 0.4;
    const d = 0.8 + Math.random() * 0.4;

    const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x1a535c, 0xf7fff7];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.prizes.push(mesh);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.2)
        .setAngularDamping(0.2);
      const body = this.physics.world.createRigidBody(bodyDesc);
      
      const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setMass(0.35)
        .setFriction(0.4) // lower friction so claw can slip / rub corner (磨角)
        .setRestitution(0.05);
      this.physics.world.createCollider(colDesc, body);

      this.physics.registerBody(body, mesh);
      this.bodies.push(body);
    }
  }

  // Spawn a round ball toy
  private spawnSphereToy(x: number, y: number, z: number) {
    const r = 0.5 + Math.random() * 0.2;

    const colors = [0xff007f, 0x7f00ff, 0x00ffff, 0x39ff14, 0xffa500];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const geo = new THREE.SphereGeometry(r, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.2,
      metalness: 0.4
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.prizes.push(mesh);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.1)
        .setAngularDamping(0.1);
      const body = this.physics.world.createRigidBody(bodyDesc);
      
      const colDesc = RAPIER.ColliderDesc.ball(r)
        .setMass(0.25)
        .setFriction(0.5)
        .setRestitution(0.6); // springy ball
      this.physics.world.createCollider(colDesc, body);

      this.physics.registerBody(body, mesh);
      this.bodies.push(body);
    }
  }
}
