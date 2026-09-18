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
    moveSpeed: 1.3,            // Setting: 1.3 (天車移動速度 1.3)
    dropSpeed: 2.0,            // Setting: 2.0
    swayScale: 1.2,            // Setting: 1.2
    raiseSpeed: 3.2,
    maxRopeLength: 9.0,        // Setting: 9.0 (線長調到 9)
    minRopeLength: 1.05,

    strongStiffness: 250.0,
    mediumStiffness: 175.0,
    weakStiffness: 150.0,       // Setting: 60% (弱爪 60%)

    antiSwingEnabled: false,
    topHitProbability: 0.18,
    weakHeightThreshold: 0.72, // Setting: 72% (上升 72%)
    topHitForce: 6.0,

    clawOpenAngle: 0.85,       // Wide open angle (~49 deg outward)
    clawCloseAngle: -0.22,     // Tight closed angle (~-13 deg inward wrap)

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
  private grabbedContactAngle = -0.22;

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

    // Smooth carriage velocity to eliminate discrete single-frame acceleration spikes (250 m/s^2 noise)
    const smoothFactor = Math.min(1.0, 16.0 * deltaTime);
    this.smoothCarrVelX += (rawCarrVelX - this.smoothCarrVelX) * smoothFactor;
    this.smoothCarrVelZ += (rawCarrVelZ - this.smoothCarrVelZ) * smoothFactor;

    const carrAccelX = (this.smoothCarrVelX - this.lastSmoothCarrVelX) / Math.max(0.0001, deltaTime);
    const carrAccelZ = (this.smoothCarrVelZ - this.lastSmoothCarrVelZ) / Math.max(0.0001, deltaTime);
    this.lastSmoothCarrVelX = this.smoothCarrVelX;
    this.lastSmoothCarrVelZ = this.smoothCarrVelZ;

    this.lastCarrX = carrPos.x;
    this.lastCarrZ = carrPos.z;

    const minBaseY = 1.1;

    // Visual pendulum swing arm scaled by swayScale (沉穩適中大甩幅)
    const baseVisualArm = 1.25;
    const visualSwingArm = baseVisualArm * (this.config.swayScale || 1.35);

    // Taiwanese arcade resonant pendulum frequency for authentic "正2拍" swing:
    // In IDLE: T = 1.95s (heavy solid metal claw pendulum cadence, calm, steady and responsive)
    // In DESCENDING: Mathematically tuned to 1.45*PI / dropDuration so it strictly completes 2 BEATS (外甩第1拍 + 回甩直插第2拍) without generating a 3rd swing!
    let omegaSq: number;
    let targetTrailAngleX = 0;
    let targetTrailAngleZ = 0;

    if (this.state === 'DESCENDING') {
      const dropDistance = Math.max(1.8, (this.carriageY - this.config.minRopeLength) - (minBaseY + 0.35));
      const dropDuration = dropDistance / Math.max(0.5, this.config.dropSpeed);
      // Exactly 2 beats over the descent duration (Swing 1 out, Swing 2 in, landing on 2nd beat arc):
      const omega = (Math.PI * 1.45) / dropDuration;
      omegaSq = omega * omega;
    } else {
      // Calm, heavy arcade pendulum cadence (T = 1.95s)
      const omegaIdle = (Math.PI * 2) / 1.95;
      omegaSq = omegaIdle * omegaIdle;
    }

    // Operator carriage movement coupling:
    // When moving, the claw promptly trails behind the carriage with authentic dynamic lag;
    // When reversing direction or stopping, momentum carries the claw across center into natural swing!
    if (this.state === 'IDLE') {
      const maxSpeed = Math.max(0.1, this.config.moveSpeed);
      const trailAngleMax = 0.36; // Dynamic trailing tilt angle (~20.6 degrees)
      const normVx = Math.max(-1.0, Math.min(1.0, rawCarrVelX / maxSpeed));
      const normVz = Math.max(-1.0, Math.min(1.0, rawCarrVelZ / maxSpeed));
      targetTrailAngleX = -normVx * trailAngleMax;
      targetTrailAngleZ = -normVz * trailAngleMax;

      const deltaVx = rawCarrVelX - this.lastCarrVelX;
      const deltaVz = rawCarrVelZ - this.lastCarrVelZ;
      const impulseCoeff = 0.38;
      this.swayVelX -= (deltaVx / Math.max(0.5, visualSwingArm)) * impulseCoeff;
      this.swayVelZ -= (deltaVz / Math.max(0.5, visualSwingArm)) * impulseCoeff;
    }
    this.lastCarrVelX = rawCarrVelX;
    this.lastCarrVelZ = rawCarrVelZ;

    // Restoring acceleration pulls towards the dynamic trailing angle equilibrium
    const swayAccelX = -omegaSq * Math.sin(this.swayAngleX - targetTrailAngleX);
    const swayAccelZ = -omegaSq * Math.sin(this.swayAngleZ - targetTrailAngleZ);

    this.swayVelX += swayAccelX * deltaTime;
    this.swayVelZ += swayAccelZ * deltaTime;

    // Air damping: steady resonance in IDLE; smooth momentum retention during descent
    let dampingFactor = this.config.antiSwingEnabled ? 0.88 : 0.9975;
    if (this.state === 'DESCENDING') {
      dampingFactor = 0.9990;
    }
    this.swayVelX *= dampingFactor;
    this.swayVelZ *= dampingFactor;

    this.swayAngleX += this.swayVelX * deltaTime;
    this.swayAngleZ += this.swayVelZ * deltaTime;

    // Authentic arcade max swing angle (~43 degrees / 0.75 rad for steady full swing)
    const maxAngle = 0.75;
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

    const swayQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-this.swayAngleZ * 0.70, 0, this.swayAngleX * 0.70, 'YXZ')
    );

    this.baseBody.setNextKinematicTranslation({ x: finalX, y: targetY, z: finalZ });
    this.baseBody.setNextKinematicRotation({ x: swayQuat.x, y: swayQuat.y, z: swayQuat.z, w: swayQuat.w });

    this.baseMesh.position.set(finalX, targetY, finalZ);
    this.baseMesh.quaternion.copy(swayQuat);

    // ── C. Cable Visual: Connects directly from carriage bottom to top eyelet ring ──
    const cableTop = new THREE.Vector3(carrPos.x, carrPos.y - 0.1, carrPos.z);
    const cableBottom = new THREE.Vector3(finalX, targetY + 0.44, finalZ);
    this.cableLine.geometry.setFromPoints([cableTop, cableBottom]);

    // ── D. Smooth Arm Angle Animation (Authentic arcade solenoid speed 7.5) ──
    // Clamps arm angle dynamically so metal prongs hug perimeter when carrying prize, or closes tightly when empty!
    let effectiveTargetAngle = this.targetArmAngle;
    if (this.grabbedBody && this.state !== 'OPENING' && this.state !== 'IDLE' && this.state !== 'DESCENDING') {
      effectiveTargetAngle = this.grabbedContactAngle;
    } else if (this.state === 'GRABBING') {
      const candidate = prizesManager ? this.findCandidatePrize(prizesManager) : null;
      if (candidate) {
        effectiveTargetAngle = this.getSafeContactAngle(candidate);
      } else {
        effectiveTargetAngle = this.config.clawCloseAngle;
      }
    } else if (this.state === 'ASCENDING' || this.state === 'TOP_HIT' || this.state === 'RETURNING') {
      if (!this.grabbedBody) {
        effectiveTargetAngle = this.config.clawCloseAngle;
      }
    }
    this.currentArmAngle += (effectiveTargetAngle - this.currentArmAngle) * 7.5 * deltaTime;

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

    // Sync 3 mechanical linkage push rods
    const sliderWorld = new THREE.Vector3();
    this.sliderGroup.getWorldPosition(sliderWorld);

    for (let i = 0; i < 3; i++) {
      const pivot = this.armPivots[i];
      const hinge = pivot.getObjectByName('armHinge');
      if (hinge && this.linkageMeshes[i]) {
        const armWorld = new THREE.Vector3();
        hinge.getWorldPosition(armWorld);

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

    // ── G. Solid Metal Arm Collision (全爪臂實體防穿透物理牆 & 合爪向外撥開非目標) ──
    if (prizesManager && prizesManager.bodies.length > 0) {
      const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
      const isClosing = (this.targetArmAngle === this.config.clawCloseAngle || this.state === 'GRABBING');
      const isOpening = (this.targetArmAngle === this.config.clawOpenAngle || this.state === 'OPENING');

      for (let i = 0; i < 3; i++) {
        const pivot = this.armPivots[i];
        const hinge = pivot ? pivot.getObjectByName('armHinge') : null;
        if (hinge) {
          const prongWorldPos = new THREE.Vector3();
          hinge.getWorldPosition(prongWorldPos);
          const outwardDir = prongWorldPos.clone().sub(this.baseMesh.position);
          outwardDir.y = 0;
          outwardDir.normalize();

          // 4 Continuous Collision Nodes along the curved blade (Hinge, Upper, Mid, Rubber Tip)
          const nodeHinge = prongWorldPos.clone();
          nodeHinge.y -= 0.05 * clawScale;

          const nodeUpper = prongWorldPos.clone().addScaledVector(outwardDir, 0.08 * clawScale);
          nodeUpper.y -= 0.22 * clawScale;

          const nodeMid = prongWorldPos.clone().addScaledVector(outwardDir, 0.22 * clawScale);
          nodeMid.y -= 0.46 * clawScale;

          const nodeTip = prongWorldPos.clone().addScaledVector(outwardDir, 0.26 * clawScale);
          nodeTip.y -= 0.72 * clawScale;

          const armNodes = [
            { pos: nodeHinge, radius: 0.26 * clawScale },
            { pos: nodeUpper, radius: 0.28 * clawScale },
            { pos: nodeMid,   radius: 0.32 * clawScale },
            { pos: nodeTip,   radius: 0.34 * clawScale }
          ];

          for (const node of armNodes) {
            for (const pBody of prizesManager.bodies) {
              if (pBody === this.grabbedBody) continue;

              const bPos = pBody.translation();
              const dx = bPos.x - node.pos.x;
              const dy = bPos.y - node.pos.y;
              const dz = bPos.z - node.pos.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

              if (dist < node.radius && dist > 0.0001) {
                pBody.wakeUp(true);
                const overlap = (node.radius - dist) / node.radius;

                let pushX = dx / dist;
                let pushY = dy / dist;
                let pushZ = dz / dist;

                if (isClosing) {
                  // 合爪時：溫柔向外撥開與向上微托，絕不將娃娃硬拉入金屬爪身深處
                  pushX = outwardDir.x * 0.45 + pushX * 0.55;
                  pushZ = outwardDir.z * 0.45 + pushZ * 0.55;
                  pushY = 0.35;
                } else if (isOpening) {
                  // 放爪時向外推開
                  pushX = outwardDir.x * 0.8 + pushX * 0.2;
                  pushZ = outwardDir.z * 0.8 + pushZ * 0.2;
                  pushY = 0.30;
                }

                // 強韌法向固體排斥力：徹底阻擋娃娃穿透爪臂模型
                const impulseMag = Math.min(1.8, overlap * 2.2 + 0.15);
                pBody.applyImpulse(
                  { x: pushX * impulseMag, y: pushY * impulseMag, z: pushZ * impulseMag },
                  true
                );
                pBody.applyTorqueImpulse(
                  { x: pushZ * impulseMag * 0.25, y: impulseMag * 0.15, z: -pushX * impulseMag * 0.25 },
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
          this.releasePrize(physics);
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
    const lowestTipY = basePos.y - 0.75 * clawScale;
    const maxDistXZ = 0.52 * clawScale;

    let candidateBody: RAPIER.RigidBody | null = null;
    let bestScore = -Infinity;

    for (const pBody of prizesManager.bodies) {
      if (pBody === this.grabbedBody) continue;
      const bPos = pBody.translation();
      const dx = bPos.x - basePos.x;
      const dz = bPos.z - basePos.z;
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      // 落在三爪包圍半徑內
      if (distXZ > maxDistXZ) continue;
      // 爪尖需低於物體或包圍在物體重心兩側
      if (lowestTipY > bPos.y + 0.35 * clawScale) continue;
      // 不高於爪頂天車筒
      if (bPos.y > basePos.y + 0.28 * clawScale) continue;

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
    // 自然包爪夾緊角度 (-0.16 ~ +0.02 rad)：爪尖向內收攏環抱娃娃，合爪感十足
    const normDist = Math.min(1.0, distXZ / (0.40 * clawScale));
    return -0.16 + normDist * 0.18;
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

  private releasePrize(physics: PhysicsSystem) {
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

      // 徹底重置阻尼
      body.setLinearDamping(0.20);
      body.setAngularDamping(0.35);

      for (let i = 0; i < body.numColliders(); i++) {
        const col = body.collider(i);
        col.setSensor(false);
        col.setFriction(0.65);
        col.setRestitution(0.06);
      }

      // 徹底喚醒剛體，給予微向下與向外分離速度，確保遵循重力自然落體
      body.wakeUp(true);
      const curVel = body.linvel();
      body.setLinvel({
        x: curVel.x * 0.6 + (Math.random() - 0.5) * 0.25,
        y: Math.min(-0.8, curVel.y - 0.6),
        z: curVel.z * 0.6 + (Math.random() - 0.5) * 0.25
      }, true);
    }

    physics.wakeUpAllDynamicBodies();
  }

  private maybeDropPrize(physics: PhysicsSystem, keepProbability: number) {
    if (!this.grabbedJoint) return;
    if (this.config.godMode) return; // 🌟 無敵保夾模式：絕不掉爪！

    const effectiveKeep = Math.min(1.0, keepProbability * this.config.superGripMultiplier);
    if (Math.random() > effectiveKeep) {
      this.releasePrize(physics);
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

    // 核心防串燒機制：下爪即時檢測下方是否有目標物，合爪角度貼合其外表面停止，杜絕刺穿！
    const candidate = this.findCandidatePrize(prizesManager);
    if (candidate) {
      this.grabbedContactAngle = this.getSafeContactAngle(candidate);
      this.targetArmAngle = this.grabbedContactAngle;
    } else {
      this.targetArmAngle = this.config.clawCloseAngle;
    }
  }

  private triggerTopHit(physics: PhysicsSystem) {
    this.state = 'TOP_HIT';
    this.stateTimer = 0;

    if (this.config.godMode) return; // 🌟 無敵保夾模式：撞天車絕不震落！

    const prob = this.config.topHitProbability / Math.max(1.0, this.config.superGripMultiplier);
    if (Math.random() < prob) {
      this.maybeDropPrize(physics, 0.3);
    }
  }
}