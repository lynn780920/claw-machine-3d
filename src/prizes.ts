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

  // Spawn a pile of prizes inside the cabinet with shape filter option
  spawnPrizes(count = 40, typeFilter: string = 'mixed') {
    this.clearPrizes();

    for (let i = 0; i < count; i++) {
      let x = (Math.random() - 0.5) * 7.2;
      let z = (Math.random() - 0.5) * 7.2;

      // Avoid initial drop directly inside exit chute hole
      if (x < -1.2 && z > 1.2) {
        x += 3.2;
      }

      // Multi-tiered layered mountain stack
      const tier = Math.floor(i / 12);
      const heightOffset = Math.max(0, (z < 0 ? -z * 0.25 : 0));
      const y = 0.8 + tier * 0.75 + heightOffset + (Math.random() * 0.2);
      this.spawnPrizeByType(x, y, z, typeFilter);
    }
  }

  // Spawn single prize at target position (for manual stocking mode)
  spawnSinglePrize(x: number, y: number, z: number, prizeType: string) {
    this.spawnPrizeByType(x, y, z, prizeType);
  }

  // Spawn randomized classic barrier layout
  spawnRandomPresetBarrier() {
    this.clearPrizes();

    const barrierTypes = ['mug_box', 'cookie_box', 'sanrio_bottle', 'onepiece'];
    const bType1 = barrierTypes[Math.floor(Math.random() * barrierTypes.length)];
    this.spawnSinglePrize(-1.2, 1.2, 3.0, bType1);

    const bType2 = barrierTypes[Math.floor(Math.random() * barrierTypes.length)];
    this.spawnSinglePrize(-3.0, 1.2, 1.2, bType2);

    const prizeList = ['chiikawa', 'dragonball', 'onepiece', 'mug_box', 'sanrio_bottle', 'cookie_box'];
    for (let i = 0; i < 16; i++) {
      const rx = (Math.random() - 0.3) * 4.5;
      const rz = (Math.random() - 0.5) * 5.0;
      const ry = 1.0 + (i % 3) * 1.2;
      const type = prizeList[Math.floor(Math.random() * prizeList.length)];
      this.spawnSinglePrize(rx, ry, rz, type);
    }
  }

  private spawnPrizeByType(x: number, y: number, z: number, typeFilter: string) {
    let prizeType = typeFilter;
    if (typeFilter === 'mixed') {
      const types = ['chiikawa', 'dragonball', 'onepiece', 'mug_box', 'sanrio_bottle', 'cookie_box', 'chiikawa', 'dragonball'];
      prizeType = types[Math.floor(Math.random() * types.length)];
    }

    switch (prizeType) {
      case 'chiikawa':
        this.spawnChiikawa(x, y, z);
        break;
      case 'dragonball':
        this.spawnDragonBallBox(x, y, z);
        break;
      case 'onepiece':
        this.spawnOnePieceBox(x, y, z);
        break;
      case 'mug_box':
        this.spawnMugBox(x, y, z);
        break;
      case 'sanrio_bottle':
        this.spawnSanrioBottle(x, y, z);
        break;
      case 'cookie_box':
        this.spawnCookieBox(x, y, z);
        break;
      // Legacy types for backward compatibility
      case 'bear':
        this.spawnChiikawa(x, y, z);
        break;
      case 'cat':
        this.spawnChiikawa(x, y, z);
        break;
      case 'block':
        this.spawnDragonBallBox(x, y, z);
        break;
      case 'long_flat_box':
        this.spawnMugBox(x, y, z);
        break;
      case 'long_bar':
        this.spawnSanrioBottle(x, y, z);
        break;
      case 'pouch':
        this.spawnCookieBox(x, y, z);
        break;
      default:
        this.spawnChiikawa(x, y, z);
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

  // ======================================================
  //  🐾 CHIIKAWA (吉依卡哇) 娃娃
  //  圓滾滾白色小人，粉紅臉頰，大黑眼睛，小短手
  // ======================================================
  private spawnChiikawa(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Random chiikawa character color variant
    const variants = [
      { body: 0xf5f5f5, cheek: 0xffb3c6, ear: 0xf5f5f5 }, // Classic white Chiikawa
      { body: 0xfff3cd, cheek: 0xffa0b4, ear: 0xfff3cd }, // Hachiware (cream striped)
      { body: 0xe8d5f0, cheek: 0xff8fab, ear: 0xe8d5f0 }, // Usagi (lavender)
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];

    const bodyMat = new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.7 });
    const cheekMat = new THREE.MeshStandardMaterial({ color: v.cheek, roughness: 0.8 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xffb3c6, roughness: 0.8 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // Big round body (身體)
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16), bodyMat);
    bodyMesh.scale.set(1, 1.05, 1);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Round head (頭，幾乎跟身體黏在一起)
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.40, 16, 16), bodyMat);
    headMesh.position.set(0, 0.6, 0);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Big round eyes (大眼睛)
    const eyeGeo = new THREE.SphereGeometry(0.075, 12, 12);
    const eyeWhiteGeo = new THREE.SphereGeometry(0.095, 12, 12);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    leftEyeWhite.position.set(-0.14, 0.65, 0.33);
    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rightEyeWhite.position.set(0.14, 0.65, 0.33);
    group.add(leftEyeWhite);
    group.add(rightEyeWhite);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.14, 0.65, 0.37);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.14, 0.65, 0.37);
    group.add(leftEye);
    group.add(rightEye);

    // Tiny eye shine highlights
    const shineGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ls = new THREE.Mesh(shineGeo, shineMat);
    ls.position.set(-0.12, 0.67, 0.40);
    const rs = new THREE.Mesh(shineGeo, shineMat);
    rs.position.set(0.16, 0.67, 0.40);
    group.add(ls);
    group.add(rs);

    // Round cheeks (粉紅臉頰)
    const cheekGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.24, 0.58, 0.32);
    leftCheek.scale.set(1.2, 0.7, 0.5);
    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.24, 0.58, 0.32);
    rightCheek.scale.set(1.2, 0.7, 0.5);
    group.add(leftCheek);
    group.add(rightCheek);

    // Tiny nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), noseMat);
    nose.position.set(0, 0.60, 0.39);
    group.add(nose);

    // Small round ears
    const earGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.3, 0.92, 0);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.3, 0.92, 0);
    group.add(leftEar);
    group.add(rightEar);

    // Tiny cute arms (小短手)
    const armGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.48, 0.05, 0.1);
    leftArm.scale.set(0.7, 1, 0.8);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.48, 0.05, 0.1);
    rightArm.scale.set(0.7, 1, 0.8);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Tiny feet
    const footGeo = new THREE.SphereGeometry(0.13, 8, 8);
    const leftFoot = new THREE.Mesh(footGeo, bodyMat);
    leftFoot.position.set(-0.2, -0.52, 0.12);
    leftFoot.scale.set(1, 0.6, 1.2);
    group.add(leftFoot);
    const rightFoot = new THREE.Mesh(footGeo, bodyMat);
    rightFoot.position.set(0.2, -0.52, 0.12);
    rightFoot.scale.set(1, 0.6, 1.2);
    group.add(rightFoot);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);

      const torsoCol = RAPIER.ColliderDesc.ball(0.44).setTranslation(0, 0, 0).setMass(0.2).setFriction(0.4).setRestitution(0.15);
      this.physics.world.createCollider(torsoCol, body);
      const headCol = RAPIER.ColliderDesc.ball(0.38).setTranslation(0, 0.6, 0).setFriction(0.4).setRestitution(0.15);
      this.physics.world.createCollider(headCol, body);
      const lArmCol = RAPIER.ColliderDesc.ball(0.12).setTranslation(-0.48, 0.05, 0.1).setFriction(0.45);
      this.physics.world.createCollider(lArmCol, body);
      const rArmCol = RAPIER.ColliderDesc.ball(0.12).setTranslation(0.48, 0.05, 0.1).setFriction(0.45);
      this.physics.world.createCollider(rArmCol, body);

      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ======================================================
  //  🐉 DRAGON BALL 七龍珠 公仔盒
  //  橙色包裝盒，盒面印有星星徽，內有水晶球
  // ======================================================
  private spawnDragonBallBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    // Box dimensions
    const w = 0.85, h = 1.05, d = 0.75;

    // Main box body (橙色)
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xff6d00, roughness: 0.45, metalness: 0.1 });
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat);
    boxMesh.castShadow = true;
    group.add(boxMesh);

    // Front face panel (darker orange with yellow stripe)
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xff8c00, roughness: 0.4 });
    const faceMesh = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.02), faceMat);
    faceMesh.position.set(0, 0, d / 2 + 0.01);
    group.add(faceMesh);

    // Yellow stripe band
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffd600, metalness: 0.3, roughness: 0.3 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.18, d + 0.02), stripeMat);
    stripe.position.set(0, 0.2, 0);
    group.add(stripe);

    // Orange crystal ball on top (龍珠)
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffab40, metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.85 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), ballMat);
    ball.position.set(0, h / 2 + 0.18, 0);
    group.add(ball);

    // Stars on ball (4-star: 四星龍珠)
    const starMat = new THREE.MeshBasicMaterial({ color: 0xd32f2f });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), starMat);
      const angle = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(angle) * 0.1, h / 2 + 0.2, Math.sin(angle) * 0.1 + 0.18);
      group.add(s);
    }

    // Gold top lid edge
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xffd600, metalness: 0.8, roughness: 0.2 });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.06, d + 0.05), lidMat);
    lid.position.set(0, h / 2, 0);
    group.add(lid);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const col = RAPIER.ColliderDesc.cuboid(w / 2, (h + 0.38) / 2, d / 2)
        .setMass(0.35).setFriction(0.38).setRestitution(0.08);
      this.physics.world.createCollider(col, body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ======================================================
  //  ☠️ ONE PIECE 海賊王 公仔盒 (路飛款)
  //  紅色盒裝，草帽造型頂飾，黑色草帽邊
  // ======================================================
  private spawnOnePieceBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const w = 0.8, h = 1.0, d = 0.7;

    // Main box (紅色)
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.45, metalness: 0.1 });
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat);
    boxMesh.castShadow = true;
    group.add(boxMesh);

    // Blue stripe
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.4 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.15, d + 0.02), stripeMat);
    stripe.position.set(0, -0.25, 0);
    group.add(stripe);

    // Gold foil effect border
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xffd600, metalness: 0.9, roughness: 0.1 });
    const topBorder = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04), borderMat);
    topBorder.position.set(0, h / 2, 0);
    group.add(topBorder);
    const botBorder = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04), borderMat);
    botBorder.position.set(0, -h / 2, 0);
    group.add(botBorder);

    // Straw Hat on top (草帽 - Luffy's signature)
    const hatBrimMat = new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.6 });
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 16), hatBrimMat);
    hatBrim.position.set(0, h / 2 + 0.08, 0);
    group.add(hatBrim);

    const hatTopMat = new THREE.MeshStandardMaterial({ color: 0xf5d060, roughness: 0.6 });
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 16), hatTopMat);
    hatTop.position.set(0, h / 2 + 0.22, 0);
    group.add(hatTop);

    // Red hat band
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.5 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.06, 16), bandMat);
    band.position.set(0, h / 2 + 0.14, 0);
    group.add(band);

    // Small skull & crossbones (骷髏旗) on front
    const skullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skullMat);
    skull.position.set(0, 0.1, d / 2 + 0.01);
    skull.scale.set(1, 0.85, 0.5);
    group.add(skull);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const col = RAPIER.ColliderDesc.cuboid(w / 2, (h + 0.35) / 2, d / 2)
        .setMass(0.35).setFriction(0.38).setRestitution(0.08);
      this.physics.world.createCollider(col, body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ======================================================
  //  ☕ MUG BOX 馬克杯盒裝
  //  扁方形包裝盒，一側有把手外露，繽紛配色
  // ======================================================
  private spawnMugBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const colors = [
      { box: 0xce93d8, accent: 0xffd54f },  // Purple + Gold
      { box: 0x80deea, accent: 0xff8a65 },  // Cyan + Coral
      { box: 0xf48fb1, accent: 0xb2ff59 },  // Pink + Lime
      { box: 0xffcc02, accent: 0xe53935 },  // Yellow + Red
    ];
    const c = colors[Math.floor(Math.random() * colors.length)];

    const w = 1.0, h = 0.75, d = 0.75;

    // Box body
    const boxMat = new THREE.MeshStandardMaterial({ color: c.box, roughness: 0.4, metalness: 0.05 });
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat);
    boxMesh.castShadow = true;
    group.add(boxMesh);

    // Accent band around middle
    const accentMat = new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.35, metalness: 0.1 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.16, d + 0.02), accentMat);
    band.position.set(0, 0, 0);
    group.add(band);

    // White window/label on front face
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.02), labelMat);
    label.position.set(0, 0, d / 2 + 0.01);
    group.add(label);

    // Mug handle peeking out the right side
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const handleOuter = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 12), handleMat);
    handleOuter.rotation.y = Math.PI / 2;
    handleOuter.position.set(w / 2 + 0.12, 0.0, 0);
    group.add(handleOuter);

    // Top lid (金色)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xffd600, metalness: 0.7, roughness: 0.2 });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.06, d + 0.06), lidMat);
    lid.position.set(0, h / 2, 0);
    group.add(lid);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      // Include handle in collider
      const col = RAPIER.ColliderDesc.cuboid((w + 0.3) / 2, h / 2, d / 2)
        .setMass(0.4).setFriction(0.38).setRestitution(0.08);
      this.physics.world.createCollider(col, body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ======================================================
  //  🌸 SANRIO BOTTLE 三麗鷗水壺
  //  圓柱保溫水壺，My Melody / Hello Kitty 配色
  //  粉/藍/白 + 卡通臉版面
  // ======================================================
  private spawnSanrioBottle(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const variants = [
      { body: 0xff80ab, top: 0xfce4ec, accent: 0xffffff },  // My Melody pink
      { body: 0xe1f5fe, top: 0xffffff, accent: 0xff80ab },  // Hello Kitty blue
      { body: 0xfff9c4, top: 0xffe082, accent: 0xff6f00 },  // Pompompurin yellow
      { body: 0xf3e5f5, top: 0xce93d8, accent: 0xffffff },  // Kuromi purple
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];

    const r = 0.28, bottleH = 1.1;

    // Main bottle body
    const bodyMat = new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.2, metalness: 0.35 });
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, bottleH, 18), bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Top cap
    const topMat = new THREE.MeshStandardMaterial({ color: v.top, roughness: 0.25, metalness: 0.4 });
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, 0.22, 14), topMat);
    topCap.position.set(0, bottleH / 2 + 0.08, 0);
    group.add(topCap);

    // Carry strap ring
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 10), strapMat);
    strap.position.set(0, bottleH / 2 + 0.28, 0);
    group.add(strap);

    // Cute face on front
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const le = new THREE.Mesh(eyeGeo, eyeMat);
    le.position.set(-0.1, 0.1, r + 0.005);
    const re = new THREE.Mesh(eyeGeo, eyeMat);
    re.position.set(0.1, 0.1, r + 0.005);
    group.add(le);
    group.add(re);

    // Pink oval cheeks
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xffb3c6 });
    const cheekGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const lc = new THREE.Mesh(cheekGeo, cheekMat);
    lc.position.set(-0.14, 0.03, r + 0.005);
    lc.scale.set(1.2, 0.7, 0.3);
    const rc = new THREE.Mesh(cheekGeo, cheekMat);
    rc.position.set(0.14, 0.03, r + 0.005);
    rc.scale.set(1.2, 0.7, 0.3);
    group.add(lc);
    group.add(rc);

    // Bow/ribbon on top for My Melody style
    const ribbonMat = new THREE.MeshStandardMaterial({ color: v.accent, roughness: 0.5 });
    const lbow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), ribbonMat);
    lbow.position.set(-0.1, bottleH / 2 + 0.23, 0);
    lbow.scale.set(1.3, 0.7, 0.6);
    const rbow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), ribbonMat);
    rbow.position.set(0.1, bottleH / 2 + 0.23, 0);
    rbow.scale.set(1.3, 0.7, 0.6);
    const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), ribbonMat);
    bowCenter.position.set(0, bottleH / 2 + 0.23, 0);
    group.add(lbow);
    group.add(rbow);
    group.add(bowCenter);

    // Accent color stripe around middle
    const stripeMat = new THREE.MeshStandardMaterial({ color: v.accent, roughness: 0.3, metalness: 0.2 });
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.005, r + 0.005, 0.14, 18), stripeMat);
    stripe.position.set(0, -0.2, 0);
    group.add(stripe);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0.35)
        .setAngularDamping(1.8);
      const body = this.physics.world.createRigidBody(bodyDesc);
      const col = RAPIER.ColliderDesc.cylinder(bottleH / 2 + 0.15, r)
        .setMass(0.3).setFriction(0.38).setRestitution(0.12);
      this.physics.world.createCollider(col, body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ======================================================
  //  🍪 COOKIE TIN BOX 餅乾鐵盒
  //  扁圓形或扁方形鐵盒，金色蓋子，花紋浮雕感
  // ======================================================
  private spawnCookieBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const variants = [
      { body: 0x3b82f6, lid: 0xffd700 },   // Royal blue + gold
      { body: 0xdc2626, lid: 0xfbbf24 },   // Christmas red + gold
      { body: 0x16a34a, lid: 0xfde68a },   // Forest green + pale gold
      { body: 0x7c3aed, lid: 0xf0abfc },   // Purple + lavender
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];

    // Decide tin shape (round or square)
    const isRound = Math.random() > 0.5;

    if (isRound) {
      // Round cookie tin
      const r = 0.42, h = 0.32;

      const bodyMat = new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.3, metalness: 0.6 });
      const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), bodyMat);
      bodyMesh.castShadow = true;
      group.add(bodyMesh);

      // Lid
      const lidMat = new THREE.MeshStandardMaterial({ color: v.lid, metalness: 0.75, roughness: 0.15 });
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.06, 24), lidMat);
      lid.position.set(0, h / 2 + 0.01, 0);
      group.add(lid);

      // Decorative groove rings
      const grooveMat = new THREE.MeshStandardMaterial({ color: v.lid, metalness: 0.6, roughness: 0.2 });
      for (let i = 0; i < 3; i++) {
        const groove = new THREE.Mesh(new THREE.TorusGeometry(r - 0.06 - i * 0.1, 0.015, 6, 24), grooveMat);
        groove.rotation.x = Math.PI / 2;
        groove.position.set(0, h / 2 + 0.04, 0);
        group.add(groove);
      }

      // Small handle on lid
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8, roughness: 0.2 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), handleMat);
      handle.position.set(0, h / 2 + 0.09, 0);
      group.add(handle);

      if (this.physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setCcdEnabled(true)
          .setLinearDamping(0.35)
          .setAngularDamping(1.8);
        const body = this.physics.world.createRigidBody(bodyDesc);
        const col = RAPIER.ColliderDesc.cylinder(h / 2 + 0.06, r + 0.03)
          .setMass(0.5).setFriction(0.42).setRestitution(0.05);
        this.physics.world.createCollider(col, body);
        this.physics.registerBody(body, group);
        this.bodies.push(body);
      }
    } else {
      // Square cookie tin
      const w = 0.82, h = 0.30, d = 0.82;

      const bodyMat = new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.3, metalness: 0.6 });
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
      bodyMesh.castShadow = true;
      group.add(bodyMesh);

      // Lid
      const lidMat = new THREE.MeshStandardMaterial({ color: v.lid, metalness: 0.75, roughness: 0.15 });
      const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.06, d + 0.05), lidMat);
      lid.position.set(0, h / 2 + 0.01, 0);
      group.add(lid);

      // Embossed pattern (floral groove lines)
      const grooveMat = new THREE.MeshStandardMaterial({ color: v.lid, metalness: 0.5, roughness: 0.25 });
      const gx = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.01, 0.04), grooveMat);
      gx.position.set(0, h / 2 + 0.04, 0.1);
      const gz = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, d - 0.1), grooveMat);
      gz.position.set(0.1, h / 2 + 0.04, 0);
      group.add(gx);
      group.add(gz);

      if (this.physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setCcdEnabled(true)
          .setLinearDamping(0.35)
          .setAngularDamping(1.8);
        const body = this.physics.world.createRigidBody(bodyDesc);
        const col = RAPIER.ColliderDesc.cuboid((w + 0.05) / 2, (h + 0.08) / 2, (d + 0.05) / 2)
          .setMass(0.5).setFriction(0.42).setRestitution(0.05);
        this.physics.world.createCollider(col, body);
        this.physics.registerBody(body, group);
        this.bodies.push(body);
      }
    }

    this.scene.add(group);
    this.prizes.push(group);
  }
}
