import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';

/**
 * 3D Arcade Claw Machine Cabinet
 * Modeled after Taiwanese Arcade & Online Claw Machines (e.g. 冠興 / 飛絡力 / 賞翻天 Kujiflip)
 * - Authentic textured non-slip playfield liner (菱格/防滑紋理底墊)
 * - Chute with acrylic baffle, safety bumper trim tube (防撞膠條) & metal corner clamp
 * - Slanted slide ramp inside prize chute (出貨導流滑梯)
 * - Back wall radiant arcade sunburst backdrop / mirror
 * - Vertical LED pillar glow bars
 * - Dynamic physical resizing across 4 scales (Small 7.6m, Medium 10.0m, Large 12.0m, K-Pa 14.6m)
 */
export class Cabinet {
  public mesh: THREE.Group;
  public width = 10.0;
  public depth = 10.0;
  public height = 8.5;

  public chuteMinX = -4.5;
  public chuteMaxX = -1.5;
  public chuteMinZ = 1.5;
  public chuteMaxZ = 4.5;
  public chuteWallHeight = 0.5;

  // Drop Target Indicator
  public dropIndicatorGroup: THREE.Group;
  private outerRing!: THREE.Mesh;
  private innerCircle!: THREE.Mesh;

  // Interactive 3D Joystick and Action Button
  public joystickGroup: THREE.Group;
  public joystickBall!: THREE.Mesh;
  public actionButtonMesh!: THREE.Mesh;

  public baffleGroup: THREE.Group;
  private baffleBodies: RAPIER.RigidBody[] = [];
  public staticBodies: RAPIER.RigidBody[] = [];

  public bodyMat!: THREE.MeshStandardMaterial;
  public bodyDarkMat!: THREE.MeshStandardMaterial;
  public accentMat!: THREE.MeshStandardMaterial;
  public baffleMat!: THREE.MeshStandardMaterial;
  public neonBorderMat!: THREE.MeshStandardMaterial;

  public floorMatTex!: THREE.CanvasTexture;
  public backdropCanvas!: HTMLCanvasElement;
  public backdropTex!: THREE.CanvasTexture;
  public marqueeCanvas!: HTMLCanvasElement;
  public marqueeTex!: THREE.CanvasTexture;

  private currentTheme: string = 'medium';

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.mesh = new THREE.Group();
    this.dropIndicatorGroup = new THREE.Group();
    this.baffleGroup = new THREE.Group();
    this.joystickGroup = new THREE.Group();

    // 1. Crystal Clear Acrylic Chute Baffle Material
    this.baffleMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      opacity: 0.35,
      transparent: true,
      roughness: 0.02,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    // 2. Safety Bumper Trim Material (防撞膠條 / 螢光護邊條)
    this.neonBorderMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.85,
      roughness: 0.3
    });

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.1,
      roughness: 0.25
    });

    this.bodyDarkMat = new THREE.MeshStandardMaterial({
      color: 0xe6b800,
      metalness: 0.1,
      roughness: 0.3
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.2,
      roughness: 0.2
    });

    // 3. Create Textured Anti-Slip Floor Mat Texture (Matching Kujiflip / Taiwanese Arcades)
    this.floorMatTex = this.createFloorMatTex();

    // 4. Create Radiant Backdrop Texture
    this.backdropCanvas = document.createElement('canvas');
    this.backdropCanvas.width = 1024;
    this.backdropCanvas.height = 1024;
    this.backdropTex = new THREE.CanvasTexture(this.backdropCanvas);

    // 5. Marquee Canvas
    this.marqueeCanvas = document.createElement('canvas');
    this.marqueeCanvas.width = 1024;
    this.marqueeCanvas.height = 256;
    this.marqueeTex = new THREE.CanvasTexture(this.marqueeCanvas);

    this.updateMarqueeText('賭博就是不歸路', '', '#fef08a', '#f59e0b', '#101014');
    this.updateBackdrop('small');

    this.build(physics);
    scene.add(this.mesh);
  }

  // ── Authentic Arcade Non-Slip Playfield Mat Texture ──
  private createFloorMatTex(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    // Deep dark slate/graphite base
    ctx.fillStyle = '#222836';
    ctx.fillRect(0, 0, 512, 512);

    // Fine woven crosshatch grid lines
    for (let i = 0; i < 512; i += 8) {
      ctx.fillStyle = (i % 16 === 0) ? 'rgba(255, 255, 255, 0.038)' : 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(i, 0, 3, 512);
      ctx.fillRect(0, i, 512, 3);
    }

    // Anti-slip rubber grip micro-dots
    for (let i = 0; i < 220; i++) {
      const radius = 2.5 + (i % 4) * 1.5;
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.05)';
      ctx.beginPath();
      ctx.arc((i * 113) % 512, (i * 227) % 512, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  }

  // ── Arcade Japanese Prize Machine Backdrop (Matching Kujiflip 1:1) ──
  public updateBackdrop(theme: string) {
    if (!this.backdropCanvas) return;
    const ctx = this.backdropCanvas.getContext('2d');
    if (!ctx) return;

    let mainTitle = '賭博就是不歸路';
    let subTitle = '景品コーナー';
    let enTitle = 'PRIZE MACHINE';
    let accentHex = '#f59e0b';
    let bgTop = '#141c2b';
    let bgBot = '#0c111a';

    if (theme === 'large' || theme === 'anime') {
      mainTitle = '一番賞';
      subTitle = 'フィギュアコーナー';
      enTitle = 'ANIME MASTERPIECE';
      accentHex = '#fbbf24';
    } else if (theme === 'kbasket') {
      mainTitle = 'K - 霸';
      subTitle = '超巨大景品專區';
      enTitle = 'MEGA CLAW MACHINE';
      accentHex = '#ef4444';
      bgTop = '#1c0d12';
      bgBot = '#0f0508';
    } else {
      mainTitle = '賭博就是不歸路';
      subTitle = '謹慎理財 · 遠離沉迷';
      enTitle = 'PRIZE MACHINE';
      accentHex = '#f59e0b';
    }

    // Deep slate navy background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    bgGrad.addColorStop(0, bgTop);
    bgGrad.addColorStop(1, bgBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle dark radial vignette
    const vig = ctx.createRadialGradient(512, 480, 50, 512, 480, 480);
    vig.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 1024, 1024);

    // Outer Framed Box (Gold double-border)
    const fx = 100, fy = 120, fw = 824, fh = 640;
    ctx.fillStyle = 'rgba(10, 15, 24, 0.65)';
    ctx.fillRect(fx, fy, fw, fh);

    // Outer gold rim
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.strokeRect(fx, fy, fw, fh);

    // Inner gold fine line
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(fx + 12, fy + 12, fw - 24, fh - 24);

    // Main Gold Title: 賭博就是不歸路
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fef08a';
    const mainFontSize = mainTitle.length > 5 ? 70 : 92;
    ctx.font = `900 ${mainFontSize}px "Hiragino Kaku Gothic Pro", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(mainTitle, 512, fy + 240);

    // Japanese Subtitle: 景品コーナー
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 10;
    ctx.fillStyle = accentHex;
    ctx.font = 'bold 44px "Hiragino Kaku Gothic Pro", "Microsoft JhengHei", sans-serif';
    ctx.fillText(subTitle, 512, fy + 340);

    // English Subtitle: PRIZE MACHINE
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 28px "Arial Black", sans-serif';
    ctx.fillText(enTitle, 512, fy + 410);

    // Decorative divider line with diamond
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx + 180, fy + 460);
    ctx.lineTo(fx + fw - 180, fy + 460);
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(512, fy + 460, 6, 0, Math.PI * 2);
    ctx.fill();

    if (this.backdropTex) this.backdropTex.needsUpdate = true;
  }

  public rebuildCabinet(mode: string, physics: PhysicsSystem) {
    this.currentTheme = mode;

    // 1. Remove all static rigid bodies from physics world
    this.staticBodies.forEach(b => {
      if (physics && physics.world) {
        physics.unregisterBody(b);
        physics.world.removeRigidBody(b);
      }
    });
    this.staticBodies = [];

    this.baffleBodies.forEach(b => {
      if (physics && physics.world) {
        physics.unregisterBody(b);
        physics.world.removeRigidBody(b);
      }
    });
    this.baffleBodies = [];

    // 2. Clear Three.js meshes
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }
    while (this.baffleGroup.children.length > 0) {
      this.baffleGroup.remove(this.baffleGroup.children[0]);
    }
    while (this.dropIndicatorGroup.children.length > 0) {
      this.dropIndicatorGroup.remove(this.dropIndicatorGroup.children[0]);
    }
    while (this.joystickGroup.children.length > 0) {
      this.joystickGroup.remove(this.joystickGroup.children[0]);
    }

    // 3. Set machine dimensions (Authentic Taiwanese Street Claw Machine Aspect Ratios)
    if (mode === 'sanrio' || mode === 'small') {
      // 🌸 小型機台 (真實標準街機比例 寬6.0m x 深5.2m x 櫥窗高6.0m, 底座高5.0m)
      this.width = 6.0;
      this.depth = 5.2;
      this.height = 6.0;
      this.chuteMinX = -2.70;
      this.chuteMaxX = -0.90;
      this.chuteMinZ = 0.65;
      this.chuteMaxZ = 2.25;
    } else if (mode === 'anime' || mode === 'large') {
      // ⚡ 中大機台 (寬闊修長大型機台)
      this.width = 8.8;
      this.depth = 7.6;
      this.height = 7.4;
      this.chuteMinX = -4.00;
      this.chuteMaxX = -1.35;
      this.chuteMinZ = 1.10;
      this.chuteMaxZ = 3.45;
    } else if (mode === 'kbasket') {
      // 🥊 K-霸機台 (超巨無霸直立機台)
      this.width = 11.2;
      this.depth = 9.8;
      this.height = 8.4;
      this.chuteMinX = -5.10;
      this.chuteMaxX = -1.70;
      this.chuteMinZ = 1.45;
      this.chuteMaxZ = 4.45;
    } else {
      // 👑 Standard medium (標準街機黃金比例)
      this.width = 7.4;
      this.depth = 6.4;
      this.height = 6.6;
      this.chuteMinX = -3.30;
      this.chuteMaxX = -1.10;
      this.chuteMinZ = 0.85;
      this.chuteMaxZ = 2.85;
    }

    // 4. Update theme materials & backdrop
    this.setTheme(mode);
    this.updateBackdrop(mode);

    // 5. Rebuild visual meshes & physics
    this.build(physics);
  }

  private build(physics: PhysicsSystem) {
    const floorThickness = 0.5;
    const halfW = this.width / 2;
    const halfD = this.depth / 2;

    // Attach sub-groups
    this.mesh.add(this.baffleGroup);
    this.mesh.add(this.dropIndicatorGroup);
    this.mesh.add(this.joystickGroup);

    // ── 1. Materials ──
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      opacity: 0.12,
      transparent: true,
      roughness: 0.0,
      metalness: 0.1
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.08
    });

    // Textured Non-Slip Playfield Floor Mat
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.floorMatTex,
      roughness: 0.65,
      metalness: 0.12
    });

    const holeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9, metalness: 0.1 });
    const holeRimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });

    // ── 2. Cabinet Base Floor (Parametric with hole for prize chute) ──
    const addFloorSection = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      if (w <= 0.01 || d <= 0.01) return;
      const x = minX + w / 2;
      const z = minZ + d / 2;

      const geo = new THREE.BoxGeometry(w, floorThickness, d);
      const m = new THREE.Mesh(geo, floorMat);
      m.position.set(x, -floorThickness / 2, z);
      m.receiveShadow = true;
      this.mesh.add(m);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, -0.5, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, 0.5, d / 2)
          .setFriction(0.75)
          .setRestitution(0.02);
        physics.world.createCollider(colDesc, body);
        this.staticBodies.push(body);
      }
    };

    // 4 seamless non-overlapping sections around the chute opening
    addFloorSection(this.chuteMaxX, halfW, -halfD, halfD);
    addFloorSection(-halfW, this.chuteMaxX, -halfD, this.chuteMinZ);
    addFloorSection(-halfW, this.chuteMinX, this.chuteMinZ, halfD);
    addFloorSection(this.chuteMinX, this.chuteMaxX, this.chuteMaxZ, halfD);

    // Floor Metal Perimeter Trim (鋁合金壓邊收口條)
    const trimThick = 0.06;
    const addFloorTrim = (tw: number, td: number, tx: number, tz: number) => {
      const trimMesh = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.04, td), chromeMat);
      trimMesh.position.set(tx, 0.01, tz);
      this.mesh.add(trimMesh);
    };
    addFloorTrim(this.width, trimThick, 0, -halfD + trimThick / 2);
    addFloorTrim(this.width, trimThick, 0, halfD - trimThick / 2);
    addFloorTrim(trimThick, this.depth, -halfW + trimThick / 2, 0);
    addFloorTrim(trimThick, this.depth, halfW - trimThick / 2, 0);

    // ── 3. Chute Baffles & Slanted Slide Ramp ──
    this.rebuildBaffles(this.chuteWallHeight, physics);

    const chuteW = this.chuteMaxX - this.chuteMinX;
    const chuteD = this.chuteMaxZ - this.chuteMinZ;
    const chuteCenterX = (this.chuteMinX + this.chuteMaxX) / 2;
    const chuteCenterZ = (this.chuteMinZ + this.chuteMaxZ) / 2;

    // Chute Pit Hole Visual Dark Box (出貨口深坑)
    const holeGeo = new THREE.BoxGeometry(chuteW, 1.2, chuteD);
    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
    holeMesh.position.set(chuteCenterX, -0.85, chuteCenterZ);
    this.mesh.add(holeMesh);

    // Slanted Prize Slide Ramp inside Chute Pit (真實出貨導流滑梯)
    const rampLen = Math.hypot(chuteD + 0.2, 0.8);
    const rampAngle = Math.atan2(0.8, chuteD + 0.2);
    const rampGeo = new THREE.BoxGeometry(chuteW - 0.08, 0.03, rampLen);
    const rampMesh = new THREE.Mesh(rampGeo, chromeMat);
    rampMesh.position.set(chuteCenterX, -0.65, chuteCenterZ + 0.1);
    rampMesh.rotation.x = rampAngle;
    this.mesh.add(rampMesh);

    // Dark Rim Frame around the chute hole
    const rimGeo = new THREE.BoxGeometry(chuteW + 0.08, 0.04, chuteD + 0.08);
    const rimMesh = new THREE.Mesh(rimGeo, holeRimMat);
    rimMesh.position.set(chuteCenterX, -0.01, chuteCenterZ);
    this.mesh.add(rimMesh);

    // ── 4. Frame Pillars (Matching theme color & scaled bounds) ──
    // ── 4. Frame Pillars (Matching theme color & scaled bounds) ──
    const colSize = 0.35;
    const addColumn = (x: number, z: number) => {
      const geo = new THREE.BoxGeometry(colSize, this.height, colSize);
      const m = new THREE.Mesh(geo, this.bodyMat);
      m.position.set(x, this.height / 2, z);
      m.castShadow = true;
      this.mesh.add(m);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, this.height / 2, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(colSize / 2, this.height / 2, colSize / 2);
        physics.world.createCollider(colDesc, body);
        this.staticBodies.push(body);
      }
    };

    addColumn(-halfW, -halfD);
    addColumn(halfW, -halfD);
    addColumn(-halfW, halfD);
    addColumn(halfW, halfD);

    // Front Pillars Vertical Neon LED Glow Bars (立柱全彩氛圍燈條)
    const neonBarGeo = new THREE.BoxGeometry(0.08, this.height - 0.4, 0.08);
    const leftNeon = new THREE.Mesh(neonBarGeo, this.neonBorderMat);
    leftNeon.position.set(-halfW + 0.22, this.height / 2, halfD - 0.22);
    this.mesh.add(leftNeon);

    const rightNeon = new THREE.Mesh(neonBarGeo, this.neonBorderMat);
    rightNeon.position.set(halfW - 0.22, this.height / 2, halfD - 0.22);
    this.mesh.add(rightNeon);

    // ── 5. Transparent Side Glass Windows ──
    const sideGlassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      opacity: 0.15,
      transparent: true,
      roughness: 0.0,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const sideWallGeo = new THREE.BoxGeometry(0.08, this.height, this.depth - 0.1);
    const addSideWall = (x: number) => {
      const wall = new THREE.Mesh(sideWallGeo, sideGlassMat);
      wall.position.set(x, this.height / 2, 0);
      this.mesh.add(wall);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, this.height / 2, 0);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(0.5 / 2, this.height / 2, this.depth / 2)
          .setFriction(0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
        this.staticBodies.push(body);
      }
    };

    addSideWall(-halfW);
    addSideWall(halfW);

    // ── 5B. Real Street Arcade Tall Base Cabinet (約佔總機身高 42%~45%) ──
    const baseHeight = Math.max(4.8, this.height * 0.82);
    const baseCabinetGeo = new THREE.BoxGeometry(this.width + 0.35, baseHeight, this.depth + 0.35);
    const baseCabinetMesh = new THREE.Mesh(baseCabinetGeo, this.bodyMat);
    baseCabinetMesh.position.set(0, -floorThickness - baseHeight / 2, 0);
    this.mesh.add(baseCabinetMesh);

    // 4 Base Swivel Wheels at Bottom Corners
    const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.20, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
    const addWheel = (wx: number, wz: number) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, -floorThickness - baseHeight - 0.25, wz);
      this.mesh.add(wheel);
    };
    const wheelDistX = halfW - 0.4;
    const wheelDistZ = halfD - 0.4;
    addWheel(-wheelDistX, -wheelDistZ);
    addWheel(wheelDistX, -wheelDistZ);
    addWheel(-wheelDistX, wheelDistZ);
    addWheel(wheelDistX, wheelDistZ);

    // ── 6. Outer Glass Panes (Front & Back) ──
    const wallThick = 0.08;
    const physThick = 0.5;
    const addGlassPane = (visualW: number, visualH: number, visualD: number, x: number, y: number, z: number, physW = visualW, physD = visualD) => {
      const geo = new THREE.BoxGeometry(visualW, visualH, visualD);
      const m = new THREE.Mesh(geo, glassMat);
      m.position.set(x, y, z);
      this.mesh.add(m);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(physW / 2, visualH / 2, physD / 2)
          .setFriction(0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
        this.staticBodies.push(body);
      }
    };

    // Back glass pane
    addGlassPane(this.width - 0.1, this.height, wallThick, 0, this.height / 2, -halfD, this.width, physThick);
    // Front glass pane
    addGlassPane(this.width - 0.1, this.height, wallThick, 0, this.height / 2, halfD, this.width, physThick);

    // Japanese Arcade Prize Machine Backdrop Inside Cabinet
    const backWallPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width - 0.2, this.height - 0.1),
      new THREE.MeshStandardMaterial({
        map: this.backdropTex,
        roughness: 0.25,
        metalness: 0.35
      })
    );
    backWallPlane.position.set(0, this.height / 2, -halfD + 0.08);
    this.mesh.add(backWallPlane);

    // ── 7. Freestanding Top Marquee (Matching Kujiflip Rounded Neon Signboard) ──
    const marqueeW = Math.min(4.5, this.width * 0.72);
    const marqueeH = 1.30;
    const marqueeD = 0.32;
    const marqueeGeo = new THREE.BoxGeometry(marqueeW, marqueeH, marqueeD);
    const marqueeMat = new THREE.MeshStandardMaterial({ map: this.marqueeTex, roughness: 0.2 });
    const marqueeMesh = new THREE.Mesh(marqueeGeo, marqueeMat);
    marqueeMesh.position.set(0, this.height + 0.85, 0);
    this.mesh.add(marqueeMesh);

    // Marquee Glowing Neon Outer Rim
    const marqueeRimGeo = new THREE.BoxGeometry(marqueeW + 0.12, marqueeH + 0.12, marqueeD - 0.05);
    const marqueeRimMesh = new THREE.Mesh(marqueeRimGeo, this.neonBorderMat);
    marqueeRimMesh.position.set(0, this.height + 0.85, 0);
    this.mesh.add(marqueeRimMesh);

    // Roof Top Cap
    const roofGeo = new THREE.BoxGeometry(this.width + 0.6, 0.35, this.depth + 0.6);
    const roofMesh = new THREE.Mesh(roofGeo, this.bodyDarkMat);
    roofMesh.position.set(0, this.height + 0.18, 0);
    this.mesh.add(roofMesh);

    // Warm Golden LED Ceiling Light Grille
    const ceilingLightGeo = new THREE.BoxGeometry(this.width - 0.6, 0.15, this.depth - 0.6);
    const ceilingLightMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });
    const ceilingLightMesh = new THREE.Mesh(ceilingLightGeo, ceilingLightMat);
    ceilingLightMesh.position.set(0, this.height - 0.15, 0);
    this.mesh.add(ceilingLightMesh);

    // ── 8. Front Protruding Control Console Deck (Matching Kujiflip 1:1) ──
    const consoleW = Math.min(3.4, this.width * 0.55);
    const consoleD = 1.35;
    const consoleH = 0.36;
    const consoleZ = halfD + consoleD / 2 - 0.12;

    // Beveled Console Shelf Base
    const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(consoleW, consoleH, consoleD), this.bodyMat);
    consoleMesh.position.set(0, 0.12, consoleZ);
    consoleMesh.castShadow = true;
    this.mesh.add(consoleMesh);

    // Console Dark Inset Plate
    const consolePlate = new THREE.Mesh(
      new THREE.BoxGeometry(consoleW - 0.2, 0.04, consoleD - 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 })
    );
    consolePlate.position.set(0, 0.31, consoleZ);
    this.mesh.add(consolePlate);

    // Protruding Coin Slot Unit (Right of Lower Cabinet at Waist Height)
    const coinPlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
    );
    coinPlate.position.set(0.65, -floorThickness - baseHeight * 0.25, halfD + 0.05);
    this.mesh.add(coinPlate);

    // Chrome Coin Insertion Slot & Return Button
    const coinSlotMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.06), chromeMat);
    coinSlotMesh.position.set(0.65, -floorThickness - baseHeight * 0.22, halfD + 0.11);
    this.mesh.add(coinSlotMesh);

    const coinBtnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), chromeMat);
    coinBtnMesh.rotation.x = Math.PI / 2;
    coinBtnMesh.position.set(0.65, -floorThickness - baseHeight * 0.33, halfD + 0.11);
    this.mesh.add(coinBtnMesh);

    // Prize Retrieval Door with Vibrant Orange Door Flap (Left of Lower Cabinet near Knees)
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.9, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 })
    );
    doorFrame.position.set(-1.45, -floorThickness - baseHeight * 0.65, halfD + 0.04);
    this.mesh.add(doorFrame);

    const doorFlap = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.15, roughness: 0.35 })
    );
    doorFlap.position.set(-1.45, -floorThickness - baseHeight * 0.65, halfD + 0.07);
    this.mesh.add(doorFlap);

    // 🕹️ Interactive Joystick Group (Left Side of Console Deck)
    this.joystickGroup.position.set(-0.65, 0.32, consoleZ);

    const stickBaseMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.3, roughness: 0.5 });
    const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.08, 24), stickBaseMat);
    stickBase.position.y = 0.04;
    this.joystickGroup.add(stickBase);

    const stickGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.46, 16);
    const stick = new THREE.Mesh(stickGeo, chromeMat);
    stick.position.y = 0.28;
    stick.castShadow = true;
    this.joystickGroup.add(stick);

    // Red Ball Top Knob
    const ballGeo = new THREE.SphereGeometry(0.20, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.25,
      metalness: 0.2,
      roughness: 0.1
    });
    this.joystickBall = new THREE.Mesh(ballGeo, ballMat);
    this.joystickBall.position.y = 0.52;
    this.joystickBall.castShadow = true;
    this.joystickBall.name = 'joystickBall';
    this.joystickGroup.add(this.joystickBall);

    // 🔴 Big Red Arcade Action Push Button (Right Side of Console Deck)
    const btnBaseGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.08, 24);
    const btnBaseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
    const btnBaseMesh = new THREE.Mesh(btnBaseGeo, btnBaseMat);
    btnBaseMesh.position.set(0.65, 0.34, consoleZ);
    this.mesh.add(btnBaseMesh);

    const btnGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.12, 24);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.15
    });
    this.actionButtonMesh = new THREE.Mesh(btnGeo, btnMat);
    this.actionButtonMesh.position.set(0.65, 0.40, consoleZ);
    this.actionButtonMesh.name = 'actionButton';
    this.mesh.add(this.actionButtonMesh);

    // Target Indicator (Sleek Cyan Neon Glow Ring)
    const outerIndicatorGeo = new THREE.RingGeometry(0.55, 0.6, 32);
    const outerIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.outerRing = new THREE.Mesh(outerIndicatorGeo, outerIndicatorMat);
    this.outerRing.rotation.x = -Math.PI / 2;
    this.dropIndicatorGroup.add(this.outerRing);

    const innerIndicatorGeo = new THREE.RingGeometry(0.08, 0.12, 16);
    const innerIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.innerCircle = new THREE.Mesh(innerIndicatorGeo, innerIndicatorMat);
    this.innerCircle.rotation.x = -Math.PI / 2;
    this.dropIndicatorGroup.add(this.innerCircle);

    this.dropIndicatorGroup.position.set(0, 0.05, 0);
  }

  /* ── Dynamic Chute Baffle Height & Guard Rail Update ── */
  public setBaffleHeight(height: number, physics: PhysicsSystem) {
    this.chuteWallHeight = Math.max(0.3, Math.min(3.0, height));
    this.rebuildBaffles(this.chuteWallHeight, physics);
  }

  private rebuildBaffles(height: number, physics: PhysicsSystem) {
    // Clear old visual baffle meshes & physics rigidbodies
    while (this.baffleGroup.children.length > 0) {
      const child = this.baffleGroup.children[0];
      this.baffleGroup.remove(child);
    }
    this.baffleBodies.forEach(b => {
      if (physics && physics.world) {
        physics.unregisterBody(b);
        physics.world.removeRigidBody(b);
      }
    });
    this.baffleBodies = [];

    const wallThick = 0.08;
    const chuteW = this.chuteMaxX - this.chuteMinX;
    const chuteD = this.chuteMaxZ - this.chuteMinZ;
    const chuteCenterX = (this.chuteMinX + this.chuteMaxX) / 2;
    const chuteCenterZ = (this.chuteMinZ + this.chuteMaxZ) / 2;

    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });

    const addBaffleWall = (w: number, d: number, x: number, z: number, isRightWall: boolean) => {
      const geo = new THREE.BoxGeometry(w, height, d);
      const mesh = new THREE.Mesh(geo, this.baffleMat);
      mesh.position.set(x, height / 2, z);
      this.baffleGroup.add(mesh);

      // Rounded Safety Bumper Trim Tube (防撞膠條 / 護邊圓條)
      const len = isRightWall ? d : w;
      const bumperGeo = new THREE.CylinderGeometry(0.045, 0.045, len, 16);
      const bumperMesh = new THREE.Mesh(bumperGeo, this.neonBorderMat);
      if (isRightWall) {
        bumperMesh.rotation.x = Math.PI / 2;
      } else {
        bumperMesh.rotation.z = Math.PI / 2;
      }
      bumperMesh.position.set(x, height + 0.02, z);
      this.baffleGroup.add(bumperMesh);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, height / 2, d / 2)
          .setFriction(0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
        this.baffleBodies.push(body);
      }
    };

    // Right baffle wall of the chute
    addBaffleWall(wallThick, chuteD, this.chuteMaxX, chuteCenterZ, true);
    // Back baffle wall of the chute
    addBaffleWall(chuteW, wallThick, chuteCenterX, this.chuteMinZ, false);

    // Chrome Metal Corner Bracket Post (金屬固定角柱)
    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, height + 0.08, 16);
    const postMesh = new THREE.Mesh(postGeo, chromeMat);
    postMesh.position.set(this.chuteMaxX, (height + 0.08) / 2, this.chuteMinZ);
    this.baffleGroup.add(postMesh);
  }

  // Update target indicator position
  public updateIndicator(x: number, z: number, y: number = 0.05) {
    this.dropIndicatorGroup.position.set(x, 0.05, z);
  }

  // Tilt 3D Joystick
  public setJoystickTilt(tiltX: number, tiltZ: number) {
    const maxTilt = 0.35; // ~20 degrees max tilt
    this.joystickGroup.rotation.z = -tiltX * maxTilt;
    this.joystickGroup.rotation.x = tiltZ * maxTilt;
  }

  public updateMarqueeText(mainTitle: string, subTitle: string, textColor: string, shadowColor: string, bgHex: string) {
    if (!this.marqueeCanvas) return;
    const mctx = this.marqueeCanvas.getContext('2d');
    if (!mctx) return;

    mctx.fillStyle = bgHex;
    mctx.fillRect(0, 0, 1024, 256);

    // Glowing Neon Rounded Border
    mctx.strokeStyle = shadowColor;
    mctx.lineWidth = 14;
    mctx.shadowColor = shadowColor;
    mctx.shadowBlur = 18;
    mctx.beginPath();
    mctx.roundRect(24, 24, 976, 208, 36);
    mctx.stroke();
    mctx.shadowBlur = 0;

    // Golden Main Big Title: 賭博就是不歸路
    mctx.fillStyle = textColor;
    const fontSize = mainTitle.length > 5 ? 84 : 108;
    mctx.font = `900 ${fontSize}px "Hiragino Kaku Gothic Pro", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.shadowColor = shadowColor;
    mctx.shadowBlur = 18;
    mctx.fillText(mainTitle, 512, 128);
    mctx.shadowBlur = 0;

    if (this.marqueeTex) this.marqueeTex.needsUpdate = true;
  }

  // Dynamic Theme Switching for 4 Machine Types
  public setTheme(theme: string) {
    if (theme === 'kbasket') {
      // 🥊 K-霸機台 (酷炫極致電競黑紅 + 霸王巨爪)
      this.bodyMat.color.setHex(0x111116);
      this.bodyDarkMat.color.setHex(0x22222d);
      this.accentMat.color.setHex(0xff0033);
      this.baffleMat.color.setHex(0xff0033);
      this.neonBorderMat.color.setHex(0xff0033);
      this.neonBorderMat.emissive.setHex(0xff0033);
      this.updateMarqueeText('K - 霸', '', '#ffffff', '#ff0033', '#111116');
    } else if (theme === 'sanrio' || theme === 'small') {
      // 🌸 小型機台 (1:1 還原 Kujiflip 經典象牙白日系街機 + 金色霓虹招牌)
      this.bodyMat.color.setHex(0xf8fafc);
      this.bodyDarkMat.color.setHex(0xe2e8f0);
      this.accentMat.color.setHex(0xf59e0b);
      this.baffleMat.color.setHex(0xffffff);
      this.baffleMat.opacity = 0.22;
      this.baffleMat.transparent = true;
      this.neonBorderMat.color.setHex(0xf59e0b);
      this.neonBorderMat.emissive.setHex(0xf59e0b);
      this.updateMarqueeText('賭博就是不歸路', '', '#fef08a', '#f59e0b', '#101014');
    } else if (theme === 'anime' || theme === 'large') {
      // ⚡ 中大機台 (動漫模型黑金尊爵 + 加大強爪)
      this.bodyMat.color.setHex(0x1a1625);
      this.bodyDarkMat.color.setHex(0x2d2438);
      this.accentMat.color.setHex(0xf59e0b);
      this.baffleMat.color.setHex(0xf59e0b);
      this.neonBorderMat.color.setHex(0xfcb316);
      this.neonBorderMat.emissive.setHex(0xfcb316);
      this.updateMarqueeText('BIG PRIZE', '⚡ 中大機台 · 動漫模型大賞', '#ffffff', '#f59e0b', '#1a1625');
    } else {
      // 👑 中型機台 (經典黃色街機)
      this.bodyMat.color.setHex(0xffcc00);
      this.bodyDarkMat.color.setHex(0xe6b800);
      this.accentMat.color.setHex(0xdc2626);
      this.baffleMat.color.setHex(0x00f0ff);
      this.neonBorderMat.color.setHex(0x00f0ff);
      this.neonBorderMat.emissive.setHex(0x00f0ff);
      this.updateMarqueeText('賭博就是不歸路', '', '#fef08a', '#f59e0b', '#101014');
    }
  }
}
