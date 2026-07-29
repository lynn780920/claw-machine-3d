import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';

/**
 * 1:1 Replica of Taiwanese Classic "TOY STORY" Yellow Arcade Claw Machine (冠興黃色經典娃娃機)
 * - Bright Arcade Yellow Cabinet Body & Frame Pillars
 * - Yellow "TOY STORY" Header Marquee Banner
 * - Yellow Front Console & Coin Slot Box with Red Joystick Ball & Green/Red Buttons
 * - Cartoon Decal Side Panels & 4 Base Wheels
 */
export class Cabinet {
  public mesh: THREE.Group;
  public width = 10;
  public depth = 10;
  public height = 8.5;

  public chuteMinX = -4.5;
  public chuteMaxX = -1.5;
  public chuteMinZ = 1.5;
  public chuteMaxZ = 4.5;
  public chuteWallHeight = 1.2;

  // Drop Target Indicator
  public dropIndicatorGroup: THREE.Group;
  private outerRing!: THREE.Mesh;
  private innerCircle!: THREE.Mesh;

  // Interactive 3D Joystick and Action Button
  public joystickGroup: THREE.Group;
  public joystickBall!: THREE.Mesh;
  public actionButtonMesh!: THREE.Mesh;

  private baffleGroup: THREE.Group;
  private baffleBodies: RAPIER.RigidBody[] = [];
  private baffleMat: THREE.MeshStandardMaterial;
  private neonBorderMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.mesh = new THREE.Group();
    this.dropIndicatorGroup = new THREE.Group();
    this.baffleGroup = new THREE.Group();
    this.joystickGroup = new THREE.Group();
    this.mesh.add(this.baffleGroup);

    // Crystal Clear Cyan Acrylic Chute Baffle Material
    this.baffleMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      opacity: 0.35,
      transparent: true,
      roughness: 0.0,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    this.neonBorderMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9
    });

    this.build(physics);
    scene.add(this.mesh);
  }

  private build(physics: PhysicsSystem) {
    const floorThickness = 0.5;

    // ── 1. Classic Taiwanese Yellow Toy Story Machine Materials ──
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      opacity: 0.1,
      transparent: true,
      roughness: 0.0,
      metalness: 0.1
    });

    // Bright Arcade Yellow Body & Frame
    const yellowBodyMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.1,
      roughness: 0.25
    });

    const yellowDarkMat = new THREE.MeshStandardMaterial({
      color: 0xe6b800,
      metalness: 0.1,
      roughness: 0.3
    });

    const redAccentMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.2,
      roughness: 0.2
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.1
    });

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xfffae6,
      roughness: 0.3
    });

    const holeMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

    // ── 2. Cabinet Base Floor (with hole for prize chute) ──
    const addFloorSection = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const x = minX + w / 2;
      const z = minZ + d / 2;

      const geo = new THREE.BoxGeometry(w, floorThickness, d);
      const m = new THREE.Mesh(geo, floorMat);
      m.position.set(x, -floorThickness / 2, z);
      m.receiveShadow = true;
      this.mesh.add(m);

      if (physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, -floorThickness / 2, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, floorThickness / 2, d / 2);
        physics.world.createCollider(colDesc, body);
      }
    };

    // Build floor around the exit hole
    addFloorSection(-1.5, 5.0, -5.0, 5.0);
    addFloorSection(-5.0, -1.5, -5.0, 1.5);
    addFloorSection(-5.0, -4.5, 1.5, 5.0);
    addFloorSection(-4.5, -1.5, 4.5, 5.0);

    // ── 3. Chute Baffles ──
    this.rebuildBaffles(this.chuteWallHeight, physics);

    // Chute Pit Hole Visual Black Box
    const holeGeo = new THREE.BoxGeometry(3.0, 0.4, 3.0);
    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
    holeMesh.position.set(-3.0, -0.45, 3.0);
    this.mesh.add(holeMesh);

    // ── 4. Bright Yellow Frame Pillars ──
    const colSize = 0.38;
    const addColumn = (x: number, z: number) => {
      const geo = new THREE.BoxGeometry(colSize, this.height, colSize);
      const m = new THREE.Mesh(geo, yellowBodyMat);
      m.position.set(x, this.height / 2 - floorThickness, z);
      m.castShadow = true;
      this.mesh.add(m);

      if (physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, this.height / 2 - floorThickness, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(colSize / 2, this.height / 2, colSize / 2);
        physics.world.createCollider(colDesc, body);
      }
    };

    addColumn(-5, -5);
    addColumn(5, -5);
    addColumn(-5, 5);
    addColumn(5, 5);

    // ── 5. Yellow Side Panels with Cartoon Art Decals ──
    const sideCanvas = document.createElement('canvas');
    sideCanvas.width = 512;
    sideCanvas.height = 512;
    const sctx = sideCanvas.getContext('2d')!;
    sctx.fillStyle = '#ffcc00';
    sctx.fillRect(0, 0, 512, 512);

    // Cartoon Circles and Character Decal Shapes
    sctx.fillStyle = '#ff0055';
    sctx.beginPath(); sctx.arc(120, 150, 70, 0, Math.PI * 2); sctx.fill();
    sctx.fillStyle = '#00ccff';
    sctx.beginPath(); sctx.arc(380, 320, 90, 0, Math.PI * 2); sctx.fill();
    sctx.fillStyle = '#ffeedd';
    sctx.font = '900 48px sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('TOY STORY', 256, 260);

    const sideTex = new THREE.CanvasTexture(sideCanvas);
    const sideDecalMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.3 });

    const sideWallGeo = new THREE.BoxGeometry(0.3, this.height - 1.5, 10);
    const addSideWall = (x: number) => {
      const wall = new THREE.Mesh(sideWallGeo, sideDecalMat);
      wall.position.set(x, (this.height - 1.5) / 2, 0);
      this.mesh.add(wall);

      if (physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, (this.height - 1.5) / 2, 0);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(0.5 / 2, (this.height - 1.5) / 2, 10 / 2)
          .setFriction(0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
      }
    };

    addSideWall(-5.0);
    addSideWall(5.0);

    // Lower Base Yellow Cabinet Box
    const baseCabinetGeo = new THREE.BoxGeometry(10.6, 2.5, 10.6);
    const baseCabinetMesh = new THREE.Mesh(baseCabinetGeo, yellowBodyMat);
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
    addWheel(-4.5, -4.5);
    addWheel(4.5, -4.5);
    addWheel(-4.5, 4.5);
    addWheel(4.5, 4.5);

    // ── 6. Outer Glass Panes (Front & Back) ──
    const wallThick = 0.1;
    const addGlassPane = (visualW: number, visualH: number, visualD: number, x: number, y: number, z: number, physW = visualW, physD = visualD) => {
      const geo = new THREE.BoxGeometry(visualW, visualH, visualD);
      const m = new THREE.Mesh(geo, glassMat);
      m.position.set(x, y, z);
      this.mesh.add(m);

      if (physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(physW / 2, visualH / 2, physD / 2)
          .setFriction(0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
      }
    };

    const physThick = 0.5;
    addGlassPane(10, this.height - 1.5, wallThick, 0, (this.height - 1.5) / 2, -5, 10, physThick);
    addGlassPane(10, this.height - 2.5, wallThick, 0, (this.height + 0.5) / 2, 5, 10, physThick);

    // Soft Sky Blue Back Wall Panel Inside Cabinet
    const backWallPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(9.8, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.3 })
    );
    backWallPlane.position.set(0, 3.75, -4.9);
    this.mesh.add(backWallPlane);

    // ── 7. Top Yellow "TOY STORY" Marquee Banner (Matching Reference Photo) ──
    const marqueeCanvas = document.createElement('canvas');
    marqueeCanvas.width = 1024;
    marqueeCanvas.height = 256;
    const mctx = marqueeCanvas.getContext('2d')!;
    
    // Yellow Header Background with Red Decorative Borders
    mctx.fillStyle = '#ffcc00';
    mctx.fillRect(0, 0, 1024, 256);
    mctx.fillStyle = '#dc2626';
    mctx.fillRect(0, 0, 1024, 20);
    mctx.fillRect(0, 236, 1024, 20);

    // Red Cartoon Typography "TOY STORY"
    mctx.shadowColor = '#ffe600';
    mctx.shadowBlur = 10;
    mctx.fillStyle = '#dc2626';
    mctx.font = '900 110px "Arial Black", sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('TOY STORY', 512, 170);

    const marqueeTex = new THREE.CanvasTexture(marqueeCanvas);

    const marqueeGeo = new THREE.BoxGeometry(10.6, 1.8, 0.4);
    const marqueeMat = new THREE.MeshStandardMaterial({ map: marqueeTex, roughness: 0.2 });
    const marqueeMesh = new THREE.Mesh(marqueeGeo, marqueeMat);
    marqueeMesh.position.set(0, this.height + 0.2, 5.1);
    this.mesh.add(marqueeMesh);

    // Yellow Roof Top Cap
    const roofGeo = new THREE.BoxGeometry(10.8, 0.5, 10.8);
    const roofMesh = new THREE.Mesh(roofGeo, yellowDarkMat);
    roofMesh.position.set(0, this.height + 0.8, 0);
    this.mesh.add(roofMesh);

    // Warm Golden LED Ceiling Light Grille (Matching Photo Inner Yellow Roof Light)
    const ceilingLightGeo = new THREE.BoxGeometry(9.2, 0.2, 9.2);
    const ceilingLightMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    const ceilingLightMesh = new THREE.Mesh(ceilingLightGeo, ceilingLightMat);
    ceilingLightMesh.position.set(0, this.height - 0.2, 0);
    this.mesh.add(ceilingLightMesh);

    // ── 8. Yellow Arcade Console Board & Coin Slot Box (Matching Reference Photo) ──
    const consoleGeo = new THREE.BoxGeometry(5.2, 1.4, 2.0);
    const consoleMesh = new THREE.Mesh(consoleGeo, yellowBodyMat);
    consoleMesh.position.set(1.5, 1.1, 5.8);
    this.mesh.add(consoleMesh);

    // Protruding Yellow Coin Slot Insert Box
    const coinBoxGeo = new THREE.BoxGeometry(2.4, 1.2, 0.3);
    const coinBoxMesh = new THREE.Mesh(coinBoxGeo, yellowDarkMat);
    coinBoxMesh.position.set(0, 0.3, 6.9);
    this.mesh.add(coinBoxMesh);

    const coinBorder = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.1), redAccentMat);
    coinBorder.position.set(0, 0.3, 6.8);
    this.mesh.add(coinBorder);

    // Coin Entry Slots & Lock Detail
    const lockMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16),
      chromeMat
    );
    lockMesh.rotation.x = Math.PI / 2;
    lockMesh.position.set(0, 0.3, 7.08);
    this.mesh.add(lockMesh);

    // Interactive Joystick Group
    this.joystickGroup.position.set(0.2, 1.8, 5.8);
    this.mesh.add(this.joystickGroup);

    const stickBaseMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.5, roughness: 0.2 });
    const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.08, 24), stickBaseMat);
    stickBase.position.y = 0.04;
    this.joystickGroup.add(stickBase);

    const stickGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 16);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = 0.3;
    stick.castShadow = true;
    this.joystickGroup.add(stick);

    // Red Ball Top Joystick (Matching Reference Photo)
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
    this.actionButtonMesh.position.set(2.2, 1.8, 5.8);
    this.actionButtonMesh.name = 'actionButton';
    this.mesh.add(this.actionButtonMesh);

    // Target Indicator
    const outerIndicatorGeo = new THREE.RingGeometry(0.55, 0.6, 32);
    const outerIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    this.outerRing = new THREE.Mesh(outerIndicatorGeo, outerIndicatorMat);
    this.outerRing.rotation.x = -Math.PI / 2;
    this.dropIndicatorGroup.add(this.outerRing);

    const innerIndicatorGeo = new THREE.RingGeometry(0.08, 0.12, 8);
    const innerIndicatorMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    this.innerCircle = new THREE.Mesh(innerIndicatorGeo, innerIndicatorMat);
    this.innerCircle.rotation.x = -Math.PI / 2;
    this.dropIndicatorGroup.add(this.innerCircle);

    this.dropIndicatorGroup.position.set(0, 0.05, 0);
    this.mesh.add(this.dropIndicatorGroup);
  }

  /* ── Dynamic Chute Baffle Height Update ── */
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
      physics.unregisterBody(b);
      physics.world.removeRigidBody(b);
    });
    this.baffleBodies = [];

    const wallThick = 0.08;

    const addBaffleWall = (w: number, d: number, x: number, z: number) => {
      const geo = new THREE.BoxGeometry(w, height, d);
      const mesh = new THREE.Mesh(geo, this.baffleMat);
      mesh.position.set(x, height / 2, z);
      this.baffleGroup.add(mesh);

      // Glowing Neon Cyan Top Edge Highlight
      const borderGeo = new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02);
      const borderMesh = new THREE.Mesh(borderGeo, this.neonBorderMat);
      borderMesh.position.set(x, height, z);
      this.baffleGroup.add(borderMesh);

      if (physics.world) {
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
    addBaffleWall(wallThick, 3.0, -1.5, 3.0);
    // Back baffle wall of the chute
    addBaffleWall(3.0, wallThick, -3.0, 1.5);
  }

  // Update target indicator position
  public updateIndicator(x: number, z: number) {
    this.dropIndicatorGroup.position.set(x, 0.05, z);
  }

  // Tilt 3D Joystick
  public setJoystickTilt(tiltX: number, tiltZ: number) {
    const maxTilt = 0.35; // ~20 degrees max tilt
    this.joystickGroup.rotation.z = -tiltX * maxTilt;
    this.joystickGroup.rotation.x = tiltZ * maxTilt;
  }
}
