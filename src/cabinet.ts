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

    this.updateMarqueeText('TOY STORY', '👑 中型機台 · 經典標準街機', '#dc2626', '#ffe600', '#ffcc00');
    this.updateBackdrop('medium');

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

  // ── Arcade Sunburst Radiant Backdrop (Matching Kujiflip rM()) ──
  public updateBackdrop(theme: string) {
    if (!this.backdropCanvas) return;
    const ctx = this.backdropCanvas.getContext('2d');
    if (!ctx) return;

    let cTop = '#0b1424', cMid = '#14253d', cBottom = '#070d18', accentHex = '#00f0ff', labelText = 'TOY STORY ARCADE';
    if (theme === 'small' || theme === 'sanrio') {
      cTop = '#2a1138'; cMid = '#451a5c'; cBottom = '#170820'; accentHex = '#f472b6'; labelText = '★ POP MART 潮玩盲盒旗艦店 ★';
    } else if (theme === 'large' || theme === 'anime') {
      cTop = '#1c152a'; cMid = '#2e2145'; cBottom = '#0f0b17'; accentHex = '#f59e0b'; labelText = '⚡ ANIME FIGURE 動漫一番賞 ⚡';
    } else if (theme === 'kbasket') {
      cTop = '#1a080c'; cMid = '#331018'; cBottom = '#0d0406'; accentHex = '#ff0033'; labelText = '🥊 MEGA CLAW 霸王家電展 🥊';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, cTop);
    grad.addColorStop(0.55, cMid);
    grad.addColorStop(1, cBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Radiant arcade sunburst rays from center
    ctx.save();
    ctx.translate(512, 420);
    for (let i = 0; i < 28; i++) {
      ctx.rotate((Math.PI * 2) / 28);
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-70, -700);
      ctx.lineTo(70, -700);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Center circular radiant glow badge
    const rg = ctx.createRadialGradient(512, 420, 20, 512, 420, 280);
    rg.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    rg.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(512, 420, 280, 0, Math.PI * 2);
    ctx.fill();

    // Backdrop Emblem Frame
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(120, 720, 784, 120);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(124, 724, 776, 112);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 18;
    ctx.fillText(labelText, 512, 796);
    ctx.shadowBlur = 0;

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

    // 3. Set machine dimensions
    if (mode === 'sanrio' || mode === 'small') {
      this.width = 7.6;
      this.depth = 7.6;
      this.height = 7.6;
      this.chuteMinX = -3.5;
      this.chuteMaxX = -1.1;
      this.chuteMinZ = 1.1;
      this.chuteMaxZ = 3.5;
    } else if (mode === 'anime' || mode === 'large') {
      this.width = 12.0;
      this.depth = 12.0;
      this.height = 9.2;
      this.chuteMinX = -5.5;
      this.chuteMaxX = -1.9;
      this.chuteMinZ = 1.9;
      this.chuteMaxZ = 5.5;
    } else if (mode === 'kbasket') {
      this.width = 14.6;
      this.depth = 14.6;
      this.height = 10.5;
      this.chuteMinX = -6.7;
      this.chuteMaxX = -2.3;
      this.chuteMinZ = 2.3;
      this.chuteMaxZ = 6.7;
    } else {
      // Standard medium
      this.width = 10.0;
      this.depth = 10.0;
      this.height = 8.5;
      this.chuteMinX = -4.5;
      this.chuteMaxX = -1.5;
      this.chuteMinZ = 1.5;
      this.chuteMaxZ = 4.5;
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
    const colSize = 0.38;
    const addColumn = (x: number, z: number) => {
      const geo = new THREE.BoxGeometry(colSize, this.height, colSize);
      const m = new THREE.Mesh(geo, this.bodyMat);
      m.position.set(x, this.height / 2 - floorThickness, z);
      m.castShadow = true;
      this.mesh.add(m);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, this.height / 2 - floorThickness, z);
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
    const neonBarGeo = new THREE.BoxGeometry(0.08, this.height - 1.8, 0.08);
    const leftNeon = new THREE.Mesh(neonBarGeo, this.neonBorderMat);
    leftNeon.position.set(-halfW + 0.24, (this.height - 1.8) / 2, halfD - 0.24);
    this.mesh.add(leftNeon);

    const rightNeon = new THREE.Mesh(neonBarGeo, this.neonBorderMat);
    rightNeon.position.set(halfW - 0.24, (this.height - 1.8) / 2, halfD - 0.24);
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

    const sideWallGeo = new THREE.BoxGeometry(0.1, this.height - 1.5, this.depth - 0.4);
    const addSideWall = (x: number) => {
      const wall = new THREE.Mesh(sideWallGeo, sideGlassMat);
      wall.position.set(x, (this.height - 1.5) / 2, 0);
      this.mesh.add(wall);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, (this.height - 1.5) / 2, 0);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(0.5 / 2, (this.height - 1.5) / 2, this.depth / 2)
          .setFriction(0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
        this.staticBodies.push(body);
      }
    };

    addSideWall(-halfW);
    addSideWall(halfW);

    // Lower Base Cabinet Box
    const baseCabinetGeo = new THREE.BoxGeometry(this.width + 0.6, 2.5, this.depth + 0.6);
    const baseCabinetMesh = new THREE.Mesh(baseCabinetGeo, this.bodyMat);
    baseCabinetMesh.position.set(0, -1.5, 0);
    this.mesh.add(baseCabinetMesh);

    // 4 Base Swivel Wheels at Bottom Corners
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
    const addWheel = (wx: number, wz: number) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, -2.85, wz);
      this.mesh.add(wheel);
    };
    const wheelDistX = halfW - 0.5;
    const wheelDistZ = halfD - 0.5;
    addWheel(-wheelDistX, -wheelDistZ);
    addWheel(wheelDistX, -wheelDistZ);
    addWheel(-wheelDistX, wheelDistZ);
    addWheel(wheelDistX, wheelDistZ);

    // ── 6. Outer Glass Panes (Front & Back) ──
    const wallThick = 0.1;
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
    addGlassPane(this.width, this.height - 1.5, wallThick, 0, (this.height - 1.5) / 2, -halfD, this.width, physThick);
    // Front glass pane
    addGlassPane(this.width, this.height - 2.5, wallThick, 0, (this.height + 0.5) / 2, halfD, this.width, physThick);

    // High-End Radiant Arcade Backdrop Inside Cabinet (Matching Kujiflip rM())
    const backWallPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width - 0.2, this.height - 1.0),
      new THREE.MeshStandardMaterial({
        map: this.backdropTex,
        roughness: 0.25,
        metalness: 0.35
      })
    );
    backWallPlane.position.set(0, (this.height - 1.0) / 2, -halfD + 0.1);
    this.mesh.add(backWallPlane);

    // ── 7. Top Marquee Banner ──
    const marqueeGeo = new THREE.BoxGeometry(this.width + 0.6, 1.8, 0.4);
    const marqueeMat = new THREE.MeshStandardMaterial({ map: this.marqueeTex, roughness: 0.2 });
    const marqueeMesh = new THREE.Mesh(marqueeGeo, marqueeMat);
    marqueeMesh.position.set(0, this.height + 0.2, halfD + 0.1);
    this.mesh.add(marqueeMesh);

    // Roof Top Cap
    const roofGeo = new THREE.BoxGeometry(this.width + 0.8, 0.5, this.depth + 0.8);
    const roofMesh = new THREE.Mesh(roofGeo, this.bodyDarkMat);
    roofMesh.position.set(0, this.height + 0.8, 0);
    this.mesh.add(roofMesh);

    // Warm Golden LED Ceiling Light Grille
    const ceilingLightGeo = new THREE.BoxGeometry(this.width - 0.8, 0.2, this.depth - 0.8);
    const ceilingLightMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });
    const ceilingLightMesh = new THREE.Mesh(ceilingLightGeo, ceilingLightMat);
    ceilingLightMesh.position.set(0, this.height - 0.2, 0);
    this.mesh.add(ceilingLightMesh);

    // ── 8. Arcade Console Board & Coin Slot Box ──
    const consoleW = Math.min(5.2, this.width * 0.52);
    const consoleGeo = new THREE.BoxGeometry(consoleW, 1.4, 2.0);
    const consoleMesh = new THREE.Mesh(consoleGeo, this.bodyMat);
    consoleMesh.position.set(halfW * 0.3, 1.1, halfD + 0.8);
    this.mesh.add(consoleMesh);

    // Protruding Coin Slot Insert Box
    const coinBoxGeo = new THREE.BoxGeometry(2.4, 1.2, 0.3);
    const coinBoxMesh = new THREE.Mesh(coinBoxGeo, this.bodyDarkMat);
    coinBoxMesh.position.set(0, 0.3, halfD + 1.9);
    this.mesh.add(coinBoxMesh);

    const coinBorder = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.1), this.accentMat);
    coinBorder.position.set(0, 0.3, halfD + 1.8);
    this.mesh.add(coinBorder);

    // Coin Entry Slots & Lock Detail
    const lockMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16),
      chromeMat
    );
    lockMesh.rotation.x = Math.PI / 2;
    lockMesh.position.set(0, 0.3, halfD + 2.08);
    this.mesh.add(lockMesh);

    // Interactive Joystick Group
    this.joystickGroup.position.set(halfW * 0.04, 1.8, halfD + 0.8);

    const stickBaseMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.5, roughness: 0.2 });
    const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.08, 24), stickBaseMat);
    stickBase.position.y = 0.04;
    this.joystickGroup.add(stickBase);

    const stickGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 16);
    const stick = new THREE.Mesh(stickGeo, chromeMat);
    stick.position.y = 0.3;
    stick.castShadow = true;
    this.joystickGroup.add(stick);

    // Red Ball Top Joystick
    const ballGeo = new THREE.SphereGeometry(0.22, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.2,
      metalness: 0.2,
      roughness: 0.1
    });
    this.joystickBall = new THREE.Mesh(ballGeo, ballMat);
    this.joystickBall.position.y = 0.58;
    this.joystickBall.castShadow = true;
    this.joystickBall.name = 'joystickBall';
    this.joystickGroup.add(this.joystickBall);

    // Glowing Green Action Button
    const btnGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 24);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x16a34a, emissiveIntensity: 0.5 });
    this.actionButtonMesh = new THREE.Mesh(btnGeo, btnMat);
    this.actionButtonMesh.position.set(halfW * 0.44, 1.8, halfD + 0.8);
    this.actionButtonMesh.name = 'actionButton';
    this.mesh.add(this.actionButtonMesh);

    // Target Indicator (Sleek Cyan Neon Glow Ring)
    const outerIndicatorGeo = new THREE.RingGeometry(0.55, 0.6, 32);
    const outerIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.outerRing = new THREE.Mesh(outerIndicatorGeo, outerIndicatorMat);
    this.outerRing.rotation.x = -Math.PI / 2;
    this.dropIndicatorGroup.add(this.outerRing);

    const innerIndicatorGeo = new THREE.RingGeometry(0.08, 0.12, 16);
    const innerIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
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

    // Neon borders top & bottom
    mctx.fillStyle = shadowColor;
    mctx.fillRect(0, 0, 1024, 18);
    mctx.fillRect(0, 238, 1024, 18);

    // Subtitle capsule badge
    mctx.fillStyle = shadowColor;
    mctx.beginPath();
    mctx.roundRect(260, 20, 504, 40, 8);
    mctx.fill();

    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 22px sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText(subTitle, 512, 48);

    // Main big title
    mctx.shadowColor = shadowColor;
    mctx.shadowBlur = 14;
    mctx.fillStyle = textColor;
    mctx.font = '900 96px "Arial Black", sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText(mainTitle, 512, 178);
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
      this.updateMarqueeText('MEGA CLAW', '🥊 K-霸機台 · 巨無霸家電霸王爪', '#ffffff', '#ff0033', '#111116');
    } else if (theme === 'sanrio' || theme === 'small') {
      // 🌸 小型機台 (POP MART 潮玩盲盒精品台 · 夢幻粉紫)
      this.bodyMat.color.setHex(0xf472b6);
      this.bodyDarkMat.color.setHex(0xdb2777);
      this.accentMat.color.setHex(0xa855f7);
      this.baffleMat.color.setHex(0x38bdf8);
      this.neonBorderMat.color.setHex(0xec4899);
      this.neonBorderMat.emissive.setHex(0xec4899);
      this.updateMarqueeText('POP MART', '🌸 小型機台 · POP MART 潮玩盲盒大賞', '#ffffff', '#ec4899', '#831843');
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
      // 👑 中型機台 (經典黃色 TOY STORY 娃娃機)
      this.bodyMat.color.setHex(0xffcc00);
      this.bodyDarkMat.color.setHex(0xe6b800);
      this.accentMat.color.setHex(0xdc2626);
      this.baffleMat.color.setHex(0x00f0ff);
      this.neonBorderMat.color.setHex(0x00f0ff);
      this.neonBorderMat.emissive.setHex(0x00f0ff);
      this.updateMarqueeText('TOY STORY', '👑 中型機台 · 經典標準街機', '#dc2626', '#ffe600', '#ffcc00');
    }
  }
}
