import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';
import { PrizesManager } from './prizes';

export type ClawState =
  | 'IDLE'
  | 'DESCENDING'
  | 'GRABBING'
  | 'ASCENDING'
  | 'TOP_HIT'
  | 'RETURNING'
  | 'RELEASING'
  | 'RESETTING';

/**
 * Arcade 3D Claw Machine Simulation
 * - Authentic Mechanical Arm Close (6.0 speed):
 *   Closes arms with smooth solenoid speed matching real Taiwanese arcade claw machines, preventing infinite kinematic collision impulses.
 * - Plush Toy Soft Velocity Guard (防爆破噴飛):
 *   Clamps maximum dynamic doll velocity to <= 2.0 m/s so dolls move & tumble like soft plush toys without flying/spraying.
 * - Diagonal Momentum Drop (甩爪動量斜向飛出與空中二收):
 *   Carries swing velocity (swayVelX/Z) diagonally along the swing vector. Air close (二收) closes arms smoothly in mid-air.
 * - Dynamic Spherical Physics Grip (自然重力懸掛與滑落包爪):
 *   Uses Rapier Spherical Joint so grabbed toys hang & sway naturally under gravity from contact point.
 */
export class Claw {
  /* ── Visual Objects ── */
  public carriageMesh!: THREE.Mesh;
  public baseMesh!: THREE.Group;
  public cableLine!: THREE.Line;

  private armPivots: THREE.Group[] = [];
  private linkageMeshes: THREE.Mesh[] = [];
  private sliderGroup!: THREE.Group;

  /* ── Physics Bodies ── */
  public carriageBody!: RAPIER.RigidBody;
  public baseBody!: RAPIER.RigidBody;
  private physicsRef!: PhysicsSystem;

  // Currently grabbed prize
  private grabbedJoint: RAPIER.ImpulseJoint | null = null;
  private grabbedBody: RAPIER.RigidBody | null = null;

  /* ── Configuration ── */
  /* ── Configuration ── */
  public config = {
    moveSpeed: 2.0,            // Setting: 2.0 (天車平移速度 - 照片)
    dropSpeed: 2.0,            // Setting: 2.0
    swayScale: 1.4,            // Setting: 1.4 (甩爪甩幅 - 照片)
    raiseSpeed: 3.2,
    maxRopeLength: 9.0,        // Setting: 9.0 (下探極限線長 - 照片)
    minRopeLength: 1.05,

    strongStiffness: 250.0,     // 100% 強爪 (照片)
    mediumStiffness: 211.25,
    weakStiffness: 172.5,       // 69% 弱爪維持力 (照片)

    antiSwingEnabled: false,
    topHitProbability: 0.13,    // 13% 觸頂震落機率 (照片)
    weakHeightThreshold: 0.76,  // 76% 電壓轉弱高度 (照片)
    topHitForce: 6.0,

    clawOpenAngle: 0.85,       // Wide open angle (~49 deg outward)
    clawCloseAngle: -0.50,     // Tight closed angle (authentic 密爪: tips touch at center)

    // Admin / DIP Switch Overrides
    godMode: false,            // 100% win guarantee - never drops
    superGripMultiplier: 1.0,  // Scale grip strength up to 3.0x
  };

  /* ── State & Pendulum Dynamics ── */
  public state: ClawState = 'IDLE';
  public carriageY = 5.45;
  public ropeLength = 1.05;
  private targetRopeLength = 1.05;
  private stateTimer = 0;
  private descentDepth = 0;
  private hasTriggeredWeakForce = false;

  // Carriage velocity & acceleration tracking for zero-lag braking inertia
  private lastCarrX = 0;
  private lastCarrZ = 0;
  private lastCarrVelX = 0;
  private lastCarrVelZ = 0;
  private smoothCarrVelX = 0;
  private smoothCarrVelZ = 0;
  private lastSmoothCarrVelX = 0;
  private lastSmoothCarrVelZ = 0;
  private lastDirX = 0;
  private lastDirZ = 0;

  // Harmonic Pendulum variables (55° max sway)
  public swayAngleX = 0;
  public swayAngleZ = 0;
  private swayVelX = 0;
  private swayVelZ = 0;

  // Arm animation angle
  private currentArmAngle = 0.85;
  private targetArmAngle = 0.85;
  private grabbedContactAngle = -0.50;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.physicsRef = physics;
    this.build(scene, physics);
  }

  public carriageLimit = 4.2;
  public homeX = -3.0;
  public homeZ = 3.0;

  public setMachineBounds(homeX: number, homeZ: number, limit: number, machineHeight: number = 6.0, resetPosition: boolean = true) {
    this.homeX = homeX;
    this.homeZ = homeZ;
    this.carriageLimit = limit;
    this.carriageY = machineHeight - 0.55;
    this.ropeLength = (machineHeight >= 7.5) ? 1.25 : 1.05;
    this.config.minRopeLength = this.ropeLength;
    this.targetRopeLength = this.ropeLength;

    if (resetPosition && this.carriageBody) {
      this.carriageBody.setNextKinematicTranslation({ x: homeX, y: this.carriageY, z: homeZ });
      this.carriageMesh.position.set(homeX, this.carriageY, homeZ);
      if (this.baseBody) {
        this.baseBody.setNextKinematicTranslation({ x: homeX, y: this.carriageY - this.ropeLength, z: homeZ });
      }
      if (this.baseMesh) {
        this.baseMesh.position.set(homeX, this.carriageY - this.ropeLength, homeZ);
      }
      this.swayAngleX = 0;
      this.swayAngleZ = 0;
      this.swayVelX = 0;
      this.swayVelZ = 0;
      this.smoothCarrVelX = 0;
      this.smoothCarrVelZ = 0;
      this.lastSmoothCarrVelX = 0;
      this.lastSmoothCarrVelZ = 0;
    }
  }

  public setClawScale(scaleRatio: number) {
    if (this.baseMesh) {
      this.baseMesh.scale.set(scaleRatio, scaleRatio, scaleRatio);
    }
  }

  /* ================================================================
     BUILD PATENT-ACCURATE ARCADE CLAW 3D MODEL
     ================================================================ */
  private build(scene: THREE.Scene, physics: PhysicsSystem) {
    const CARRIAGE_Y = 5.45;
    this.carriageY = CARRIAGE_Y;

    // ── High Grade Arcade Materials ──
    const purpleAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.25
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.96,
      roughness: 0.05
    });

    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.88,
      roughness: 0.22
    });

    const rubberRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.88,
      metalness: 0.05
    });

    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      metalness: 0.92,
      roughness: 0.12
    });

    /* ─── 1. Carriage (天車) ─── */
    const carrGroup = new THREE.Group();
    const carrBaseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 1.2), chromeMat);
    carrBaseMesh.castShadow = true;
    carrGroup.add(carrBaseMesh);

    const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 16), darkSteelMat);
    motorCap.position.y = 0.18;
    carrGroup.add(motorCap);

    carrGroup.position.set(0, CARRIAGE_Y, 0);
    scene.add(carrGroup);
    this.carriageMesh = carrBaseMesh;

    const carrDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, CARRIAGE_Y, 0);
    this.carriageBody = physics.world.createRigidBody(carrDesc);
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.11, 0.6), this.carriageBody);
    physics.registerBody(this.carriageBody, carrGroup);

    /* ─── 2. Base Group ─── */
    this.baseMesh = new THREE.Group();
    this.baseMesh.position.set(0, CARRIAGE_Y - this.ropeLength, 0);
    scene.add(this.baseMesh);

    // Component 1 in Patent: Vertical Solenoid Housing
    const solenoidGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.42, 32);
    const solenoidMesh = new THREE.Mesh(solenoidGeo, darkSteelMat);
    solenoidMesh.position.y = 0.21;
    solenoidMesh.castShadow = true;
    this.baseMesh.add(solenoidMesh);

    const solenoidRing = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.02, 8, 32), goldAccentMat);
    solenoidRing.rotation.x = Math.PI / 2;
    solenoidRing.position.y = 0.08;
    this.baseMesh.add(solenoidRing);

    // Top Bezel Hinge Plate
    const topPlateGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.1, 24);
    const topPlate = new THREE.Mesh(topPlateGeo, purpleAnodizedMat);
    topPlate.position.y = 0.0;
    topPlate.castShadow = true;
    this.baseMesh.add(topPlate);

    // Eyelet Cable Hook Ring
    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16), chromeMat);
    eyelet.position.y = 0.44;
    this.baseMesh.add(eyelet);

    // Central Shaft (中軸/炮筒) - 緊湊修身設計，避免過度下凸
    const rodGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 16);
    const rod = new THREE.Mesh(rodGeo, chromeMat);
    rod.position.y = -0.08;
    rod.castShadow = true;
    this.baseMesh.add(rod);

    // Bottom Stop Bumper (底部精緻限位卡榫)
    const bottomBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), goldAccentMat);
    bottomBumper.position.y = -0.16;
    this.baseMesh.add(bottomBumper);

    // Component 2 in Patent: Sliding Collar (中環/滑塊) - 精巧緊實
    this.sliderGroup = new THREE.Group();
    this.sliderGroup.position.y = -0.10;
    this.baseMesh.add(this.sliderGroup);

    const slideMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 24), purpleAnodizedMat);
    slideMesh.castShadow = true;
    this.sliderGroup.add(slideMesh);

    const slideRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.01, 8, 24), chromeMat);
    slideRing.rotation.x = Math.PI / 2;
    this.sliderGroup.add(slideRing);

    /* ─── 3. Three Continuous Curved Metal Prongs ─── */
    for (let i = 0; i < 3; i++) {
      const yAngle = (i * Math.PI * 2) / 3;
      this.buildPatentCurvedArm(i, yAngle, chromeMat, darkSteelMat, rubberRedMat, goldAccentMat);
    }

    /* ─── 4. Kinematic Base Body ─── */
    const baseDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, CARRIAGE_Y - this.ropeLength, 0);
    this.baseBody = physics.world.createRigidBody(baseDesc);

    physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.1, 0.45),
      this.baseBody
    );
    physics.registerBody(this.baseBody, this.baseMesh);

    /* ─── 5. Cable Line Rendering ─── */
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, -1, 0)
    ]);
    this.cableLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2.5 })
    );
    scene.add(this.cableLine);
  }

  /* ─── Build One Patent Curved Arm ─── */
  private buildPatentCurvedArm(
    index: number,
    yAngle: number,
    chrome: THREE.Material,
    darkSteel: THREE.Material,
    rubber: THREE.Material,
    gold: THREE.Material
  ) {
    const HINGE_R = 0.38;

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(
      Math.cos(yAngle) * HINGE_R,
      -0.02,
      Math.sin(yAngle) * HINGE_R
    );
    pivotGroup.rotation.y = -yAngle;
    this.baseMesh.add(pivotGroup);
    this.armPivots.push(pivotGroup);

    const armHinge = new THREE.Group();
    armHinge.name = 'armHinge';
    pivotGroup.add(armHinge);

    // Linkage Anchor Bracket for push rod connection
    const linkBracket = new THREE.Object3D();
    linkBracket.name = 'linkBracket';
    linkBracket.position.set(0.10, -0.16, 0);
    armHinge.add(linkBracket);

    // Hinge Pin Bolt
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 12), gold);
    pin.rotation.x = Math.PI / 2;
    armHinge.add(pin);

    // ── Authentic Taiwanese/Japanese Arcade 3D Curved Tubular Metal Prongs (圓管金屬曲爪) ──
    // Smooth Catmull-Rom 3D Curve forming the elegant curved claw arm:
    const curvePoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.12, -0.20, 0),
      new THREE.Vector3(0.24, -0.45, 0),
      new THREE.Vector3(0.20, -0.68, 0),
      new THREE.Vector3(0.08, -0.84, 0)
    ];
    const armCurve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(armCurve, 24, 0.034, 16, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, chrome);
    tubeMesh.castShadow = true;
    armHinge.add(tubeMesh);

    // ── Bright Red Anti-Slip Rubber Sleeve Tip Cap (紅色防滑膠套爪尖) ──
    const tipCurvePoints = [
      new THREE.Vector3(0.16, -0.72, 0),
      new THREE.Vector3(0.08, -0.84, 0)
    ];
    const tipCurve = new THREE.CatmullRomCurve3(tipCurvePoints);
    const tipSleeveGeo = new THREE.TubeGeometry(tipCurve, 10, 0.042, 16, false);
    const tipSleeveMesh = new THREE.Mesh(tipSleeveGeo, rubber);
    tipSleeveMesh.castShadow = true;
    armHinge.add(tipSleeveMesh);

    // Smooth rounded rubber hemisphere end tip (杜絕尖銳串燒穿刺感)
    const endCapGeo = new THREE.SphereGeometry(0.042, 14, 14);
    const endCap = new THREE.Mesh(endCapGeo, rubber);
    endCap.position.set(0.08, -0.84, 0);
    armHinge.add(endCap);

    // Component 12 in Patent: Linkage Push Rod
    const linkage = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 8), chrome);
    linkage.castShadow = true;
    this.baseMesh.add(linkage);
    this.linkageMeshes.push(linkage);
  }

  /* ================================================================
     UPDATE LOOP (DIAGONAL MOMENTUM DROP + SOFT CONTACT VELOCITY GUARD)
     ================================================================ */
  update(deltaTime: number, physics: PhysicsSystem, prizesManager?: PrizesManager) {
    this.stateTimer += deltaTime;

    const carrPos = this.carriageBody.translation();
    const rawCarrVelX = (carrPos.x - this.lastCarrX) / Math.max(0.0001, deltaTime);
    const rawCarrVelZ = (carrPos.z - this.lastCarrZ) / Math.max(0.0001, deltaTime);

    // Natural carriage velocity smoothing for momentum calculations
    const smoothFactor = Math.min(1.0, 16.0 * deltaTime);
    this.smoothCarrVelX += (rawCarrVelX - this.smoothCarrVelX) * smoothFactor;
    this.smoothCarrVelZ += (rawCarrVelZ - this.smoothCarrVelZ) * smoothFactor;

    // Detect sudden velocity change (急停煞車頓甩 / 換向頓甩):
    const deltaVx = rawCarrVelX - this.lastCarrVelX;
    const deltaVz = rawCarrVelZ - this.lastCarrVelZ;
    this.lastCarrVelX = rawCarrVelX;
    this.lastCarrVelZ = rawCarrVelZ;

    this.lastCarrX = carrPos.x;
    this.lastCarrZ = carrPos.z;

    const minBaseY = 1.1;

    // Visual pendulum swing arm scaled by swayScale and dynamically lengthened with cable
    const baseVisualArm = 1.15;
    const extraRope = Math.max(0, this.ropeLength - this.config.minRopeLength);
    const visualSwingArm = (baseVisualArm + extraRope * 0.35) * (this.config.swayScale || 1.25);

    // ── Taiwanese Arcade Natural Pendulum Dynamics ──
    // Authentic gravity pendulum frequency: omega = sqrt(g / L) -> T ~ 1.7s
    const g = 9.81;
    const omegaSq = g / Math.max(0.5, visualSwingArm);

    // Steady trailing angle when moving continuously (~5 degrees lag, no frantic shaking while moving)
    const maxSpeed = Math.max(0.1, this.config.moveSpeed);
    const trailAngleMax = 0.09;
    const normVx = Math.max(-1.0, Math.min(1.0, rawCarrVelX / maxSpeed));
    const normVz = Math.max(-1.0, Math.min(1.0, rawCarrVelZ / maxSpeed));
    const targetEquilibriumX = -normVx * trailAngleMax;
    const targetEquilibriumZ = -normVz * trailAngleMax;

    // 煞車頓甩衝量轉移：當天車急停或反向切換時，天車速度變化量瞬間轉化為鐘擺初角速度
    if (this.state === 'IDLE' && (Math.abs(deltaVx) > 0.08 || Math.abs(deltaVz) > 0.08)) {
      const impulseCoeff = 0.50;
      this.swayVelX -= (deltaVx / visualSwingArm) * impulseCoeff;
      this.swayVelZ -= (deltaVz / visualSwingArm) * impulseCoeff;
    }

    // 重力回復力矩引導鐘擺往動態平衡點振盪
    const swayAccelX = -omegaSq * Math.sin(this.swayAngleX - targetEquilibriumX);
    const swayAccelZ = -omegaSq * Math.sin(this.swayAngleZ - targetEquilibriumZ);

    this.swayVelX += swayAccelX * deltaTime;
    this.swayVelZ += swayAccelZ * deltaTime;

    // 真實空氣與鋼索摩擦阻尼：非防甩狀態下可流暢擺盪 4~5 個週期，防甩片開啟時 0.8s 內平穩消擺
    const dampingRate = this.config.antiSwingEnabled ? 3.0 : (this.state === 'DESCENDING' ? 0.08 : 0.38);
    const dampingFactor = Math.exp(-dampingRate * deltaTime);
    this.swayVelX *= dampingFactor;
    this.swayVelZ *= dampingFactor;

    this.swayAngleX += this.swayVelX * deltaTime;
    this.swayAngleZ += this.swayVelZ * deltaTime;

    // 真實機台合理擺幅上限：約 21 度 (0.36 rad)，保證自然不破綻
    const maxAngle = 0.36;
    this.swayAngleX = Math.max(-maxAngle, Math.min(maxAngle, this.swayAngleX));
    this.swayAngleZ = Math.max(-maxAngle, Math.min(maxAngle, this.swayAngleZ));

    // ── B. Cable Length Animation ──
    if (Math.abs(this.ropeLength - this.targetRopeLength) > 0.01) {
      const speed = this.targetRopeLength > this.ropeLength
        ? this.config.dropSpeed
        : this.config.raiseSpeed;
      const step = speed * deltaTime;
      this.ropeLength = this.ropeLength < this.targetRopeLength
        ? Math.min(this.targetRopeLength, this.ropeLength + step)
        : Math.max(this.targetRopeLength, this.ropeLength - step);
    }

    // Physical Pendulum Horizontal Offset
    const maxOffset = this.carriageLimit * 1.05;
    const swayOffsetX = Math.max(-maxOffset, Math.min(maxOffset, visualSwingArm * Math.sin(this.swayAngleX)));
    const swayOffsetZ = Math.max(-maxOffset, Math.min(maxOffset, visualSwingArm * Math.sin(this.swayAngleZ)));

    // Stable vertical height: cable tension holds height steady, eliminating vertical bobbing ("上下上")
    const verticalSwayDisplacement = (1.0 - Math.cos(this.swayAngleX) * Math.cos(this.swayAngleZ)) * 0.15;
    const rawTargetY = carrPos.y - this.ropeLength + verticalSwayDisplacement;
    const targetY = Math.max(minBaseY, rawTargetY);

    // Enforce Glass Cabinet Interior Physical Collision Bounds
    const minClawX = -this.carriageLimit;
    const maxClawX = this.carriageLimit;
    const minClawZ = -this.carriageLimit;
    const maxClawZ = this.carriageLimit;

    let finalX = carrPos.x + swayOffsetX;
    let finalZ = carrPos.z + swayOffsetZ;

    if (finalX < minClawX) {
      finalX = minClawX;
      this.swayVelX = Math.abs(this.swayVelX) * 0.35; // Soft bounce off glass wall
      this.swayAngleX = (minClawX - carrPos.x) / visualSwingArm;
    } else if (finalX > maxClawX) {
      finalX = maxClawX;
      this.swayVelX = -Math.abs(this.swayVelX) * 0.35;
      this.swayAngleX = (maxClawX - carrPos.x) / visualSwingArm;
    }

    if (finalZ < minClawZ) {
      finalZ = minClawZ;
      this.swayVelZ = Math.abs(this.swayVelZ) * 0.35; // Soft bounce off glass wall
      this.swayAngleZ = (minClawZ - carrPos.z) / visualSwingArm;
    } else if (finalZ > maxClawZ) {
      finalZ = maxClawZ;
      this.swayVelZ = -Math.abs(this.swayVelZ) * 0.35;
      this.swayAngleZ = (maxClawZ - carrPos.z) / visualSwingArm;
    }

    // 重力自然垂直懸掛：爪身主要垂直下垂，僅隨鋼索微幅傾斜
    const tiltMultiplier = 0.35;
    const swayQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-this.swayAngleZ * tiltMultiplier, 0, this.swayAngleX * tiltMultiplier, 'YXZ')
    );

    this.baseBody.setNextKinematicTranslation({ x: finalX, y: targetY, z: finalZ });
    this.baseBody.setNextKinematicRotation({ x: swayQuat.x, y: swayQuat.y, z: swayQuat.z, w: swayQuat.w });

    this.baseMesh.position.set(finalX, targetY, finalZ);
    this.baseMesh.quaternion.copy(swayQuat);

    // ── C. Cable Visual: Connects directly from carriage bottom to top eyelet ring ──
    const cableTop = new THREE.Vector3(carrPos.x, carrPos.y - 0.1, carrPos.z);
    const cableBottom = new THREE.Vector3(finalX, targetY + 0.44, finalZ);
    this.cableLine.geometry.setFromPoints([cableTop, cableBottom]);

    // ── D. Smooth Arm Angle Animation (Authentic arcade solenoid speed 9.5) ──
    // Clamps arm angle dynamically: closes tightly into 密爪 when empty/grabbing, or hugs perimeter when grasping prize!
    let effectiveTargetAngle = this.targetArmAngle;
    if (this.grabbedBody && this.state !== 'OPENING' && this.state !== 'IDLE' && this.state !== 'DESCENDING') {
      effectiveTargetAngle = this.grabbedContactAngle;
    } else if (this.state === 'GRABBING') {
      // 下爪到底合爪瞬間：電磁閥通電，確實全力收緊至密爪！
      effectiveTargetAngle = this.config.clawCloseAngle;
    } else if (this.state === 'ASCENDING' || this.state === 'TOP_HIT' || this.state === 'RETURNING') {
      if (!this.grabbedBody) {
        effectiveTargetAngle = this.config.clawCloseAngle;
      }
    }
    this.currentArmAngle += (effectiveTargetAngle - this.currentArmAngle) * 9.5 * deltaTime;

    for (let i = 0; i < 3; i++) {
      const pivot = this.armPivots[i];
      const hinge = pivot.getObjectByName('armHinge');
      if (hinge) {
        hinge.rotation.z = this.currentArmAngle;
      }
    }

    // Mechanical Collar Movement (精簡行程，緊貼頂盤內側，滑塊絕不上凸下露)
    const t = (this.currentArmAngle - this.config.clawCloseAngle) /
      (this.config.clawOpenAngle - this.config.clawCloseAngle);
    const sliderY = -0.04 - t * 0.08;
    this.sliderGroup.position.y = sliderY;

    // Sync 3 mechanical linkage push rods connected to linkBracket
    const sliderWorld = new THREE.Vector3();
    this.sliderGroup.getWorldPosition(sliderWorld);

    for (let i = 0; i < 3; i++) {
      const pivot = this.armPivots[i];
      const hinge = pivot.getObjectByName('armHinge');
      if (hinge && this.linkageMeshes[i]) {
        const linkBracket = hinge.getObjectByName('linkBracket') || hinge;
        const armWorld = new THREE.Vector3();
        linkBracket.getWorldPosition(armWorld);

        const midPoint = new THREE.Vector3().addVectors(sliderWorld, armWorld).multiplyScalar(0.5);
        const linkage = this.linkageMeshes[i];
        linkage.position.copy(midPoint);
        linkage.lookAt(armWorld);
        linkage.rotation.x += Math.PI / 2;
        const dist = sliderWorld.distanceTo(armWorld);
        linkage.scale.set(1, dist / 0.38, 1);
      }
    }

    // ── F. Soft Contact Velocity Guard (防爆破噴飛 - 保持物體運動逼真穩定) ──
    if (prizesManager && prizesManager.bodies.length > 0) {
      for (const pBody of prizesManager.bodies) {
        if (pBody !== this.grabbedBody) {
          const vel = pBody.linvel();
          const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
          if (speedSq > 9.0) { // speed > 3.0 m/s
            const factor = 3.0 / Math.sqrt(speedSq);
            pBody.setLinvel({ x: vel.x * factor, y: vel.y * factor, z: vel.z * factor }, true);
          }
        }
      }
    }

    // ── G. Solid Metal Arm Collision (圓管曲爪動態旋轉物理牆 - 跟隨爪臂旋轉防穿透) ──
    if (prizesManager && prizesManager.bodies.length > 0) {
      const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
      const currentCandidate = (this.state === 'GRABBING') ? this.findCandidatePrize(prizesManager) : null;

      const localArmPts = [
        new THREE.Vector3(0, 0, 0),        // Hinge
        new THREE.Vector3(0.12, -0.22, 0), // Upper
        new THREE.Vector3(0.24, -0.45, 0), // Elbow
        new THREE.Vector3(0.08, -0.84, 0)  // Tip
      ];

      for (let i = 0; i < 3; i++) {
        const pivot = this.armPivots[i];
        const hinge = pivot ? pivot.getObjectByName('armHinge') : null;
        if (hinge) {
          const armNodes = localArmPts.map((pt, idx) => {
            const worldPos = pt.clone();
            hinge.localToWorld(worldPos);
            const radius = (idx === 3 ? 0.085 : 0.075) * clawScale;
            return { pos: worldPos, radius };
          });

          for (const node of armNodes) {
            for (const pBody of prizesManager.bodies) {
              if (pBody === this.grabbedBody || pBody === currentCandidate) continue;

              const bPos = pBody.translation();
              const dx = bPos.x - node.pos.x;
              const dy = bPos.y - node.pos.y;
              const dz = bPos.z - node.pos.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

              const hitLimit = node.radius + 0.12 * clawScale;
              if (dist < hitLimit && dist > 0.0001) {
                pBody.wakeUp(true);
                const overlap = hitLimit - dist;

                const pushX = dx / dist;
                const pushY = Math.max(0.15, dy / dist);
                const pushZ = dz / dist;

                const impulseMag = Math.min(0.8, overlap * 1.5 + 0.05);
                pBody.applyImpulse(
                  { x: pushX * impulseMag, y: pushY * impulseMag, z: pushZ * impulseMag },
                  true
                );
              }
            }
          }
        }
      }
    }

    // ── E. State Machine with Realistic Impact Dynamics ──
    switch (this.state) {
      case 'DESCENDING': {
        const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
        const touchedFloor = targetY <= minBaseY + 0.05;
        let hitPrizeBody: RAPIER.RigidBody | null = null;

        if (prizesManager && prizesManager.bodies.length > 0) {
          const clawTipY = targetY - 0.70 * clawScale;
          const stopRadiusXZ = 0.48 * clawScale;

          for (const pBody of prizesManager.bodies) {
            const pos = pBody.translation();
            const dx = pos.x - finalX;
            const dy = pos.y - clawTipY;
            const dz = pos.z - finalZ;
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            // 接觸娃娃頂面或斜面
            if (distXZ <= stopRadiusXZ && (dy >= -0.35 * clawScale && dy <= 0.45 * clawScale)) {
              hitPrizeBody = pBody;
              break;
            }
          }
        }

        if (touchedFloor || hitPrizeBody || this.stateTimer > 4.5) {
          // 猛一爪下砸動能傳遞 (真實街機下砸震盪力學)
          if (hitPrizeBody && prizesManager) {
            const dropVel = this.config.dropSpeed || 2.0;
            const impactX = this.swayVelX * 1.2;
            const impactZ = this.swayVelZ * 1.2;
            
            // 喚醒周圍所有沉睡剛體
            physics.wakeUpNear(finalX, targetY - 0.5 * clawScale, finalZ, 2.0);

            // 施加猛烈向下壓迫與橫向甩動衝量，使娃娃自然翻滾受力
            hitPrizeBody.applyImpulse(
              {
                x: impactX * 0.45 + (Math.random() - 0.5) * 0.25,
                y: -Math.min(1.2, dropVel * 0.45),
                z: impactZ * 0.45 + (Math.random() - 0.5) * 0.25
              },
              true
            );
            hitPrizeBody.applyTorqueImpulse(
              {
                x: (Math.random() - 0.5) * 0.4,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.4
              },
              true
            );

            // 爪身受到下砸反作用力微幅反彈停頓
            this.ropeLength = Math.max(this.config.minRopeLength, this.ropeLength - 0.06);
          }

          this.targetRopeLength = this.ropeLength;
          this.triggerGrab(prizesManager);
        }
        break;
      }

      case 'GRABBING':
        if (this.stateTimer > 0.45) {
          this.attemptGrab(physics, prizesManager);
          this.state = 'ASCENDING';
          this.stateTimer = 0;
          this.hasTriggeredWeakForce = false;
          this.targetRopeLength = this.config.minRopeLength;
        }
        break;

      case 'ASCENDING': {
        const totalAscent = this.descentDepth - this.config.minRopeLength;
        if (totalAscent > 0.3 && !this.hasTriggeredWeakForce) {
          const progress = (this.descentDepth - this.ropeLength) / totalAscent;
          if (progress >= this.config.weakHeightThreshold) {
            this.hasTriggeredWeakForce = true;
            this.maybeDropPrize(physics, this.config.weakStiffness / this.config.strongStiffness);
          }
        }
        if (this.ropeLength <= this.config.minRopeLength + 0.05) {
          this.triggerTopHit(physics);
        }
        break;
      }

      case 'TOP_HIT':
        if (this.stateTimer > 0.4) {
          this.state = 'RETURNING';
          this.stateTimer = 0;
        }
        break;

      case 'OPENING':
        // Outward physical push force & flip torque on nearby prize corners when opening (放爪推角翻肉物理)
        if (prizesManager && prizesManager.bodies.length > 0) {
          const clawPos = this.baseMesh.position;
          const clawTipY = clawPos.y - 0.7;
          for (const pBody of prizesManager.bodies) {
            const pos = pBody.translation();
            const dx = pos.x - clawPos.x;
            const dy = pos.y - clawTipY;
            const dz = pos.z - clawPos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 1.35) {
              pBody.wakeUp(true);
              const nx = dx / (dist || 1);
              const nz = dz / (dist || 1);
              const pushForce = 0.45 * (1.35 - dist);

              // Apply outward impulse & rotational flip torque
              pBody.applyImpulse({ x: nx * pushForce, y: pushForce * 0.45, z: nz * pushForce }, true);
              pBody.applyTorqueImpulse({ x: nz * pushForce * 0.3, y: pushForce * 0.2, z: -nx * pushForce * 0.3 }, true);
            }
          }
        }

        if (this.stateTimer > 0.6) {
          this.state = 'RETURNING';
          this.stateTimer = 0;
        }
        break;

      case 'RETURNING': {
        const homeX = this.homeX;
        const homeZ = this.homeZ;
        const pos = this.carriageBody.translation();
        const dx = homeX - pos.x;
        const dz = homeZ - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.05) {
          const step = this.config.moveSpeed * deltaTime;
          const nx = pos.x + (dx / dist) * Math.min(dist, step);
          const nz = pos.z + (dz / dist) * Math.min(dist, step);
          this.carriageBody.setNextKinematicTranslation({ x: nx, y: pos.y, z: nz });
          this.carriageMesh.position.set(nx, pos.y, nz);
        } else {
          this.state = 'RELEASING';
          this.stateTimer = 0;
          this.releasePrize(physics, 'CHUTE_RELEASE');
          this.targetArmAngle = this.config.clawOpenAngle;
        }
        break;
      }

      case 'RELEASING':
        if (this.stateTimer > 1.2) {
          this.state = 'IDLE';
          this.stateTimer = 0;
        }
        break;
    }

    // Emergency Safety Reset Guard: Prevent getting stuck on "請等待" forever
    if (this.state !== 'IDLE' && this.stateTimer > 15.0) {
      this.releasePrize(physics);
      this.targetRopeLength = this.config.minRopeLength;
      this.targetArmAngle = this.config.clawOpenAngle;
      this.state = 'IDLE';
      this.stateTimer = 0;
    }

    // ── Anti-Floating Guard: 確保非抓取狀態下沒有任何剛體因休眠或阻尼殘留黏在空中 ──
    if (this.state !== 'GRABBING' && this.state !== 'ASCENDING' && this.state !== 'TOP_HIT' && this.state !== 'RETURNING') {
      if (prizesManager && prizesManager.bodies.length > 0) {
        for (const pBody of prizesManager.bodies) {
          const trans = pBody.translation();
          // 如果物體懸在空中且速度幾乎為0，強制還原正常阻尼並喚醒
          if (trans.y > 1.1) {
            const vel = pBody.linvel();
            if (vel.x * vel.x + vel.y * vel.y + vel.z * vel.z < 0.04) {
              pBody.setLinearDamping(0.20);
              pBody.setAngularDamping(0.35);
              pBody.wakeUp(true);
            }
          }
        }
      }
    }
  }

  /* ================================================================
     GEOMETRIC WRAP & SOLID CARRY LOGIC (AUTHENTIC GRIP WITHOUT PENETRATION)
     ================================================================ */

  /* ================================================================
     GEOMETRIC WRAP & SOLID CARRY LOGIC (AUTHENTIC GRIP WITHOUT PENETRATION)
     ================================================================ */

  public findCandidatePrize(prizesManager?: PrizesManager): RAPIER.RigidBody | null {
    if (!prizesManager || prizesManager.bodies.length === 0) return null;
    const basePos = this.baseMesh.position;
    const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
    const lowestTipY = basePos.y - 0.78 * clawScale;
    const maxDistXZ = 0.38 * clawScale;

    let candidateBody: RAPIER.RigidBody | null = null;
    let bestScore = -Infinity;

    for (const pBody of prizesManager.bodies) {
      if (pBody === this.grabbedBody) continue;
      const bPos = pBody.translation();
      const dx = bPos.x - basePos.x;
      const dz = bPos.z - basePos.z;
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      // 落在三爪有效包覆抓取半徑內
      if (distXZ > maxDistXZ) continue;
      // 爪尖需能包圍或低於物體重心
      if (lowestTipY > bPos.y + 0.20 * clawScale) continue;
      // 不高於爪頂天車筒
      if (bPos.y > basePos.y + 0.15 * clawScale) continue;

      const depthUnderCenter = bPos.y - lowestTipY;
      const score = depthUnderCenter * 2.0 - distXZ * 1.5;
      if (score > bestScore) {
        bestScore = score;
        candidateBody = pBody;
      }
    }
    return candidateBody;
  }

  public getSafeContactAngle(pBody: RAPIER.RigidBody): number {
    const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
    const bPos = pBody.translation();
    const basePos = this.baseMesh.position;
    const dx = bPos.x - basePos.x;
    const dz = bPos.z - basePos.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);
    // 自然包爪夾緊角度：爪尖向內收攏緊緊抱住娃娃！
    // 依娃娃重心距離動態算出貼合爪尖半徑 targetR (0.048m~0.28m)
    const targetR = Math.max(0.048 * clawScale, Math.min(0.28 * clawScale, distXZ + 0.02 * clawScale));
    const safeAngle = (targetR / clawScale - 0.46) / 0.84;
    return Math.max(this.config.clawCloseAngle, Math.min(-0.16, safeAngle));
  }

  private attemptGrab(physics: PhysicsSystem, prizesManager?: PrizesManager) {
    const basePos = this.baseMesh.position;
    const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;

    const candidateBody = this.findCandidatePrize(prizesManager);

    if (candidateBody) {
      const targetBody = candidateBody;
      const bPos = targetBody.translation();

      const localAnchorX = bPos.x - basePos.x;
      const localAnchorY = bPos.y - basePos.y;
      const localAnchorZ = bPos.z - basePos.z;

      // 嚴格計算外圍貼合角，抱住物體外殼
      this.grabbedContactAngle = this.getSafeContactAngle(targetBody);
      this.targetArmAngle = this.grabbedContactAngle;

      for (let i = 0; i < targetBody.numColliders(); i++) {
        const col = targetBody.collider(i);
        col.setSensor(false);
        col.setFriction(0.95);
        col.setRestitution(0.01);
      }

      // 提起時保持合理阻尼
      targetBody.setLinearDamping(0.35);
      targetBody.setAngularDamping(0.40);
      targetBody.wakeUp(true);

      // Spherical Joint 錨定接觸點，並啟用碰撞與接觸響應
      const sphericalJointData = RAPIER.JointData.spherical(
        { x: localAnchorX, y: localAnchorY, z: localAnchorZ },
        { x: 0, y: 0, z: 0 }
      );

      const joint = physics.world.createImpulseJoint(
        sphericalJointData,
        this.baseBody,
        targetBody,
        true
      ) as RAPIER.ImpulseJoint;

      joint.setContactsEnabled(true);

      this.grabbedJoint = joint;
      this.grabbedBody = targetBody;
    } else {
      // 未抓到物體：爪子確實緊密合爪！
      this.targetArmAngle = this.config.clawCloseAngle;
    }
  }

  private releasePrize(physics: PhysicsSystem, reason: 'NORMAL' | 'WEAK_DROP' | 'TOP_HIT' | 'CHUTE_RELEASE' = 'NORMAL') {
    this.grabbedContactAngle = this.config.clawCloseAngle;
    this.targetArmAngle = this.config.clawCloseAngle;
    if (this.grabbedJoint) {
      try {
        physics.world.removeImpulseJoint(this.grabbedJoint, true);
      } catch (e) {
        // Safe joint remove
      }
      this.grabbedJoint = null;
    }
    if (this.grabbedBody) {
      const body = this.grabbedBody;
      this.grabbedBody = null;

      // 重置阻尼至真實空氣阻力數值
      body.setLinearDamping(0.15);
      body.setAngularDamping(0.25);

      for (let i = 0; i < body.numColliders(); i++) {
        const col = body.collider(i);
        col.setSensor(false);
        col.setFriction(0.65);
        col.setRestitution(0.08);
      }

      body.wakeUp(true);

      // ── 真正的 3D 甩爪動量轉移 (Authentic Fling & Drop Momentum) ──
      // 1. 爪頭鐘擺切線瞬時速度 (Tangential Swing Velocity)
      const baseVisualArm = 1.15;
      const extraRope = Math.max(0, this.ropeLength - this.config.minRopeLength);
      const visualSwingArm = (baseVisualArm + extraRope * 0.35) * (this.config.swayScale || 1.25);

      const swingLinVelX = visualSwingArm * Math.cos(this.swayAngleX) * this.swayVelX;
      const swingLinVelZ = visualSwingArm * Math.cos(this.swayAngleZ) * this.swayVelZ;
      const swingLinVelY = -visualSwingArm * (
        Math.sin(this.swayAngleX) * this.swayVelX +
        Math.sin(this.swayAngleZ) * this.swayVelZ
      );

      // 2. 天車平移速度 (Carriage Velocity)
      const carrVx = this.smoothCarrVelX;
      const carrVz = this.smoothCarrVelZ;

      // 3. 爪子整體 3D 合成速度（完全保留玩家大甩甩幅之強大慣性！）
      let throwVx = carrVx + swingLinVelX * 1.18;
      let throwVz = carrVz + swingLinVelZ * 1.18;
      let throwVy = swingLinVelY;

      // 4. 依照掉落情境精準賦予物理向量
      if (reason === 'TOP_HIT') {
        // 撞天車震落：強烈向下反衝震波 + 沿當前天車傾角反彈
        throwVy = -1.8;
        throwVx += Math.sin(this.swayAngleX) * 1.35;
        throwVz += Math.sin(this.swayAngleZ) * 1.35;
      } else if (reason === 'WEAK_DROP') {
        // 電壓轉弱滑落：在上升途中脫鉤，保留部分上升慣性後呈自然拋物線下墜
        const ascentVel = (this.state === 'ASCENDING') ? 0.9 : 0;
        throwVy = Math.max(-0.6, ascentVel + swingLinVelY * 0.5);
      } else if (reason === 'CHUTE_RELEASE') {
        // 到達洞口正常放爪：輕輕順勢落入出貨口
        throwVy = Math.min(-0.35, swingLinVelY);
      } else {
        throwVy = Math.min(-0.45, swingLinVelY);
      }

      // 5. 三爪張開時機械推力 (放爪推角推肉，沿物體相對於爪中心方向微推並賦予旋轉)
      const bPos = body.translation();
      const cPos = this.baseMesh.position;
      const pushDx = bPos.x - cPos.x;
      const pushDz = bPos.z - cPos.z;
      const pushDist = Math.hypot(pushDx, pushDz);
      if (pushDist > 0.02) {
        throwVx += (pushDx / pushDist) * 0.30;
        throwVz += (pushDz / pushDist) * 0.30;
      }

      // 6. 賦予精確線速度，徹底移除人工削弱與隨機打散，保持自然拋物線
      body.setLinvel({ x: throwVx, y: throwVy, z: throwVz }, true);

      // 7. 轉移自然角動量（翻滾旋轉）
      body.setAngvel({
        x: -this.swayVelZ * 0.85 + (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.5,
        z: this.swayVelX * 0.85 + (Math.random() - 0.5) * 0.3
      }, true);
    }

    physics.wakeUpAllDynamicBodies();
  }

  private maybeDropPrize(physics: PhysicsSystem, keepProbability: number) {
    if (!this.grabbedJoint) return;
    if (this.config.godMode) return; // 🌟 無敵保夾模式：絕不掉爪！

    const effectiveKeep = Math.min(1.0, keepProbability * this.config.superGripMultiplier);
    if (Math.random() > effectiveKeep) {
      this.releasePrize(physics, 'WEAK_DROP');
    }
  }

  /* ================================================================
     PUBLIC API
     ================================================================ */

  updateAntiSwingDamping() {
    // Handled natively
  }

  moveCarriage(vx: number, vz: number, deltaTime: number) {
    if (this.state !== 'IDLE') return;
    const pos = this.carriageBody.translation();
    let nx = pos.x + vx * this.config.moveSpeed * deltaTime;
    let nz = pos.z + vz * this.config.moveSpeed * deltaTime;
    nx = Math.max(-this.carriageLimit, Math.min(this.carriageLimit, nx));
    nz = Math.max(-this.carriageLimit, Math.min(this.carriageLimit, nz));
    this.carriageBody.setNextKinematicTranslation({ x: nx, y: this.carriageY, z: nz });
    this.carriageMesh.position.set(nx, this.carriageY, nz);
  }

  actionButtonPressed(prizesManager?: PrizesManager) {
    if (this.state === 'IDLE') {
      this.state = 'DESCENDING';
      this.stateTimer = 0;
      this.targetArmAngle = this.config.clawOpenAngle;
      this.targetRopeLength = this.config.maxRopeLength;
    } else if (this.state === 'DESCENDING') {
      this.triggerGrab(prizesManager);
    } else if (this.state === 'ASCENDING') {
      this.releasePrize(this.physicsRef);
    }
  }

  private triggerGrab(prizesManager?: PrizesManager) {
    this.state = 'GRABBING';
    this.stateTimer = 0;
    this.descentDepth = this.ropeLength;
    this.targetRopeLength = this.ropeLength;

    // 下爪合爪：電磁閥通電，三爪全力向內緊閉 (密爪)！
    this.targetArmAngle = this.config.clawCloseAngle;
  }

  private triggerTopHit(physics: PhysicsSystem) {
    this.state = 'TOP_HIT';
    this.stateTimer = 0;

    if (this.config.godMode) return; // 🌟 無敵保夾模式：撞天車絕不震落！

    const prob = this.config.topHitProbability / Math.max(1.0, this.config.superGripMultiplier);
    if (Math.random() < prob) {
      this.releasePrize(physics, 'TOP_HIT');
    }
  }
}