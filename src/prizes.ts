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

  // Spawn a pile of dolls inside the cabinet with shape filter option (支援 100 個堆山山崩鋪貨)
  spawnPrizes(count = 40, typeFilter: string = 'mixed') {
    this.clearPrizes();

    for (let i = 0; i < count; i++) {
      let x = (Math.random() - 0.5) * 7.2; // -3.6 to 3.6
      let z = (Math.random() - 0.5) * 7.2; // -3.6 to 3.6
      
      // Avoid initial drop directly inside exit chute hole
      if (x < -1.2 && z > 1.2) {
        x += 3.2;
      }
      
      // Multi-tiered layered mountain stack (後高前低自然山坡)
      const tier = Math.floor(i / 12);
      // Items in the back (+Z or +X) stack higher into a natural mountain pile
      const heightOffset = Math.max(0, (z < 0 ? -z * 0.25 : 0));
      const y = 0.8 + tier * 0.75 + heightOffset + (Math.random() * 0.2);
      this.spawnPrizeByType(x, y, z, typeFilter);
    }
  }

  // Spawn single prize at target position (for manual stocking mode)
  spawnSinglePrize(x: number, y: number, z: number, prizeType: string) {
    this.spawnPrizeByType(x, y, z, prizeType);
  }

  // Spawn randomized classic barrier layout (槍位隨機擺台)
  spawnRandomPresetBarrier() {
    this.clearPrizes();

    // 1. Chute Barrier Bar/Box right next to the chute lip (槍位障礙)
    const barrierTypes = ['long_bar', 'long_flat_box', 'block', 'pouch'];
    const bType1 = barrierTypes[Math.floor(Math.random() * barrierTypes.length)];
    this.spawnSinglePrize(-1.2, 1.2, 3.0, bType1);

    const bType2 = barrierTypes[Math.floor(Math.random() * barrierTypes.length)];
    this.spawnSinglePrize(-3.0, 1.2, 1.2, bType2);

    // 2. Prize Stack behind the chute barrier
    const prizeList = ['bear', 'cat', 'pouch', 'block', 'long_flat_box', 'long_bar'];
    for (let i = 0; i < 16; i++) {
      const rx = (Math.random() - 0.3) * 4.5; // -1.2 to 3.2
      const rz = (Math.random() - 0.5) * 5.0;
      const ry = 1.0 + (i % 3) * 1.2;
      const type = prizeList[Math.floor(Math.random() * prizeList.length)];
      this.spawnSinglePrize(rx, ry, rz, type);
    }
  }

  private spawnPrizeByType(x: number, y: number, z: number, typeFilter: string) {
    let prizeType = typeFilter;
    if (typeFilter === 'mixed') {
      const types = ['bear', 'cat', 'pouch', 'block', 'long_flat_box', 'long_bar'];
      prizeType = types[Math.floor(Math.random() * types.length)];
    }

    switch (prizeType) {
      case 'bear':
        this.spawnPlushBear(x, y, z);
        break;
      case 'cat':
        this.spawnCatPlush(x, y, z);
        break;
      case 'pouch':
        this.spawnPouch(x, y, z);
        break;
      case 'long_bar':
        this.spawnLongCushion(x, y, z);
        break;
      case 'long_flat_box':
        this.spawnLongFlatBox(x, y, z);
        break;
      case 'block':
        this.spawnBlock(x, y, z);
        break;
      case 'sphere':
        this.spawnSphereToy(x, y, z);
        break;
      default:
        this.spawnPlushBear(x, y, z);
        break;
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
      // Dynamic Body with CCD enabled to prevent tunneling & mountain sliding
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);

      // Main Torso collider
      const bodyCollider = RAPIER.ColliderDesc.ball(0.4)
        .setTranslation(0, 0, 0)
        .setMass(0.2)
        .setFriction(0.4)
        .setRestitution(0.15);
      this.physics.world.createCollider(bodyCollider, body);

      // Head collider
      const headCollider = RAPIER.ColliderDesc.ball(0.32)
        .setTranslation(0, 0.65, 0)
        .setFriction(0.4)
        .setRestitution(0.15);
      this.physics.world.createCollider(headCollider, body);

      // Left Arm collider
      const leftArmCollider = RAPIER.ColliderDesc.capsule(0.2, 0.12)
        .setTranslation(-0.55, 0.2, 0)
        .setRotation({ w: Math.cos(Math.PI/6), x: 0, y: 0, z: Math.sin(Math.PI/6) })
        .setFriction(0.45)
        .setRestitution(0.15);
      this.physics.world.createCollider(leftArmCollider, body);

      // Right Arm collider
      const rightArmCollider = RAPIER.ColliderDesc.capsule(0.2, 0.12)
        .setTranslation(0.55, 0.2, 0)
        .setRotation({ w: Math.cos(-Math.PI/6), x: 0, y: 0, z: Math.sin(-Math.PI/6) })
        .setFriction(0.45)
        .setRestitution(0.15);
      this.physics.world.createCollider(rightArmCollider, body);

      // Left Leg collider
      const leftLegCollider = RAPIER.ColliderDesc.capsule(0.22, 0.15)
        .setTranslation(-0.35, -0.65, 0.15)
        .setRotation({ w: Math.cos(Math.PI/12), x: Math.sin(Math.PI/12), y: 0, z: 0 })
        .setFriction(0.45)
        .setRestitution(0.15);
      this.physics.world.createCollider(leftLegCollider, body);

      // Right Leg collider
      const rightLegCollider = RAPIER.ColliderDesc.capsule(0.22, 0.15)
        .setTranslation(0.35, -0.65, 0.15)
        .setRotation({ w: Math.cos(Math.PI/12), x: Math.sin(Math.PI/12), y: 0, z: 0 })
        .setFriction(0.45)
        .setRestitution(0.15);
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
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      
      const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setMass(0.35)
        .setFriction(0.38)
        .setRestitution(0.08);
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
        .setCcdEnabled(true)
        .setLinearDamping(0.25)
        .setAngularDamping(1.4);
      const body = this.physics.world.createRigidBody(bodyDesc);
      
      const colDesc = RAPIER.ColliderDesc.ball(r)
        .setMass(0.25)
        .setFriction(0.3)
        .setRestitution(0.35);
      this.physics.world.createCollider(colDesc, body);

      this.physics.registerBody(body, mesh);
      this.bodies.push(body);
    }
  }

  // 👛 Spawn Leather Pouch/Purse
  private spawnPouch(x: number, y: number, z: number) {
    const pouchGroup = new THREE.Group();
    pouchGroup.position.set(x, y, z);

    const colors = [0xf43f5e, 0xa855f7, 0x0ea5e9, 0xec4899, 0x14b8a6];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 });

    // Main pouch body
    const bodyGeo = new THREE.BoxGeometry(0.9, 0.6, 0.4);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.castShadow = true;
    pouchGroup.add(bodyMesh);

    // Zipper handle ring at top
    const ringGeo = new THREE.TorusGeometry(0.12, 0.03, 8, 16);
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.position.set(0, 0.35, 0);
    pouchGroup.add(ringMesh);

    this.scene.add(pouchGroup);
    this.prizes.push(pouchGroup);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true).setLinearDamping(0.35).setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.cuboid(0.45, 0.3, 0.2).setMass(0.25).setFriction(0.4);
      this.physics.world.createCollider(colDesc, body);
      this.physics.registerBody(body, pouchGroup);
      this.bodies.push(body);
    }
  }

  // 🐱 Spawn Cute Cat Plush
  private spawnCatPlush(x: number, y: number, z: number) {
    const catGroup = new THREE.Group();
    catGroup.position.set(x, y, z);

    const colors = [0xffedd5, 0xfed7aa, 0xe2e8f0, 0x334155, 0xfbcfe8];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    // Cat Body
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), mat);
    bodyMesh.castShadow = true;
    catGroup.add(bodyMesh);

    // Head
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), mat);
    headMesh.position.set(0, 0.55, 0);
    headMesh.castShadow = true;
    catGroup.add(headMesh);

    // Cat Ears (Pointy Cone)
    const earGeo = new THREE.ConeGeometry(0.14, 0.28, 4);
    const leftEar = new THREE.Mesh(earGeo, pinkMat);
    leftEar.position.set(-0.22, 0.88, 0);
    leftEar.rotation.z = 0.2;
    const rightEar = new THREE.Mesh(earGeo, pinkMat);
    rightEar.position.set(0.22, 0.88, 0);
    rightEar.rotation.z = -0.2;
    catGroup.add(leftEar);
    catGroup.add(rightEar);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const e1 = new THREE.Mesh(eyeGeo, blackMat);
    e1.position.set(-0.14, 0.62, 0.32);
    const e2 = new THREE.Mesh(eyeGeo, blackMat);
    e2.position.set(0.14, 0.62, 0.32);
    catGroup.add(e1);
    catGroup.add(e2);

    // Tail
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.5, 8), mat);
    tailMesh.position.set(0, 0.1, -0.45);
    tailMesh.rotation.x = Math.PI / 4;
    catGroup.add(tailMesh);

    this.scene.add(catGroup);
    this.prizes.push(catGroup);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true).setLinearDamping(0.35).setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const c1 = RAPIER.ColliderDesc.ball(0.42).setFriction(0.4);
      const c2 = RAPIER.ColliderDesc.ball(0.35).setTranslation(0, 0.55, 0).setFriction(0.4);
      this.physics.world.createCollider(c1, body);
      this.physics.world.createCollider(c2, body);
      this.physics.registerBody(body, catGroup);
      this.bodies.push(body);
    }
  }

  // 🥖 Spawn Long Cushion/Bar (槍位長條物/長枕)
  private spawnLongCushion(x: number, y: number, z: number) {
    const r = 0.28;
    const len = 1.8;
    const colors = [0xf59e0b, 0x10b981, 0x8b5cf6, 0xef4444, 0x06b6d4];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const geo = new THREE.CylinderGeometry(r, r, len, 16);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI / 2; // Horizontal bar
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.prizes.push(mesh);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true).setLinearDamping(0.35).setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.cylinder(len / 2, r).setMass(0.4).setFriction(0.38);
      this.physics.world.createCollider(colDesc, body);
      this.physics.registerBody(body, mesh);
      this.bodies.push(body);
    }
  }

  // 📦 Spawn Long Flat Box (槍位長扁盒)
  private spawnLongFlatBox(x: number, y: number, z: number) {
    const w = 1.8;
    const h = 0.38;
    const d = 0.9;
    const colors = [0x6366f1, 0x84cc16, 0xd946ef, 0x0284c7, 0xf97316];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.prizes.push(mesh);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true).setLinearDamping(0.35).setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setMass(0.4).setFriction(0.38);
      this.physics.world.createCollider(colDesc, body);
      this.physics.registerBody(body, mesh);
      this.bodies.push(body);
    }
  }
}
