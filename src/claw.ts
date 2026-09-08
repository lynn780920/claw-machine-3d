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
    moveSpeed: 2.6,            // Steady Taiwanese arcade carriage speed (沉穩適中平移速度)
    dropSpeed: 2.0,            // Steady 2-beat drop speed (沉穩正二拍下探速度)
    swayScale: 1.35,           // Authentic balanced arcade swing scale (擬真沉穩甩幅)
    raiseSpeed: 3.2,
    maxRopeLength: 13.5,
    minRopeLength: 1.05,

    strongStiffness: 250.0,
    mediumStiffness: 100.0,
    weakStiffness: 40.0,

    antiSwingEnabled: false, // Default: false (允許甩爪 擬真大擺幅)
    topHitProbability: 0.25,
    weakHeightThreshold: 0.60, // 60%
    topHitForce: 6.0,

    clawOpenAngle: 0.85,       // Wide open angle (~49 deg outward)
    clawCloseAngle: -0.22,     // Tight closed angle (~-13 deg inward wrap)
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

    // Central Shaft (中軸/炮筒)
    const rodGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.42, 16);
    const rod = new THREE.Mesh(rodGeo, chromeMat);
    rod.position.y = -0.21;
    rod.castShadow = true;
    this.baseMesh.add(rod);

    // Bottom Stop Bumper
    const bottomBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), goldAccentMat);
    bottomBumper.position.y = -0.42;
    this.baseMesh.add(bottomBumper);

    // Component 2 in Patent: Sliding Collar (中環/滑塊)
    this.sliderGroup = new THREE.Group();
    this.sliderGroup.position.y = -0.3;
    this.baseMesh.add(this.sliderGroup);

    const slideMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 24), purpleAnodizedMat);
    slideMesh.castShadow = true;
    this.sliderGroup.add(slideMesh);

    const slideRing = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.015, 8, 24), chromeMat);
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

    // Component 14 in Patent: Single Continuous Smooth Curved Metal Blade!
    const prongShape = new THREE.Shape();
    prongShape.moveTo(0, 0);
    prongShape.bezierCurveTo(0.14, -0.15, 0.25, -0.42, 0.11, -0.82);
    prongShape.lineTo(0.04, -0.84);
    prongShape.bezierCurveTo(0.18, -0.44, 0.09, -0.18, -0.03, 0);
    prongShape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 3,
    };

    const prongGeo = new THREE.ExtrudeGeometry(prongShape, extrudeSettings);
    prongGeo.translate(0, 0, -0.018);

    const prongMesh = new THREE.Mesh(prongGeo, chrome);
    prongMesh.castShadow = true;
    armHinge.add(prongMesh);

    // Fitted Red Rubber Sleeve Tip Cap
    const sleeveShape = new THREE.Shape();
    sleeveShape.moveTo(0.09, -0.66);
    sleeveShape.bezierCurveTo(0.13, -0.73, 0.19, -0.78, 0.11, -0.82);
    sleeveShape.lineTo(0.04, -0.84);
    sleeveShape.bezierCurveTo(0.13, -0.78, 0.10, -0.71, 0.06, -0.66);
    sleeveShape.closePath();

    const sleeveGeo = new THREE.ExtrudeGeometry(sleeveShape, {
      steps: 1,
      depth: 0.042,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    sleeveGeo.translate(0, 0, -0.021);

    const sleeveMesh = new THREE.Mesh(sleeveGeo, rubber);
    sleeveMesh.castShadow = true;
    armHinge.add(sleeveMesh);

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

    // ── D. Smooth Arm Angle Animation (Controlled solenoid closing speed 6.0) ──
    this.currentArmAngle += (this.targetArmAngle - this.currentArmAngle) * 6.0 * deltaTime;

    for (let i = 0; i < 3; i++) {
      const pivot = this.armPivots[i];
      const hinge = pivot.getObjectByName('armHinge');
      if (hinge) {
        hinge.rotation.z = this.currentArmAngle;
      }
    }

    // Mechanical Collar Movement
    const t = (this.currentArmAngle - this.config.clawCloseAngle) /
      (this.config.clawOpenAngle - this.config.clawCloseAngle);
    const sliderY = -0.12 - t * 0.24;
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

    // ── F. Soft Contact Velocity Guard (防爆破噴飛 - 限制周圍娃娃最高實體速度 <= 1.8 m/s) ──
    if (prizesManager && prizesManager.bodies.length > 0) {
      for (const pBody of prizesManager.bodies) {
        if (pBody !== this.grabbedBody) {
          const vel = pBody.linvel();
          const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
          if (speedSq > 3.24) { // speed > 1.8 m/s
            const factor = 1.8 / Math.sqrt(speedSq);
            pBody.setLinvel({ x: vel.x * factor, y: vel.y * factor, z: vel.z * factor }, true);
          }
        }
      }
    }

    // ── G. Full-Blade 3-Node Physical Solid Arm Collision (全爪臂 3 點實體防穿越碰撞體) ──
    if (prizesManager && prizesManager.bodies.length > 0) {
      const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
      const isClosing = (this.targetArmAngle === this.config.clawCloseAngle);
      const isOpening = (this.targetArmAngle === this.config.clawOpenAngle);

      for (let i = 0; i < 3; i++) {
        const pivot = this.armPivots[i];
        const hinge = pivot ? pivot.getObjectByName('armHinge') : null;
        if (hinge) {
          const prongWorldPos = new THREE.Vector3();
          hinge.getWorldPosition(prongWorldPos);
          const outwardDir = prongWorldPos.clone().sub(this.baseMesh.position);
          outwardDir.y = 0;
          outwardDir.normalize();

          // 3 Collision Nodes along the entire curved metal arm blade (Upper, Mid, Tip)
          const nodeUpper = prongWorldPos.clone().addScaledVector(outwardDir, 0.05 * clawScale);
          nodeUpper.y -= 0.15 * clawScale;

          const nodeMid = prongWorldPos.clone().addScaledVector(outwardDir, 0.22 * clawScale);
          nodeMid.y -= 0.42 * clawScale;

          const nodeTip = prongWorldPos.clone().addScaledVector(outwardDir, 0.28 * clawScale);
          nodeTip.y -= 0.68 * clawScale;

          const armNodes = [
            { pos: nodeUpper, radius: 0.32 * clawScale },
            { pos: nodeMid,   radius: 0.36 * clawScale },
            { pos: nodeTip,   radius: 0.38 * clawScale }
          ];

          for (const node of armNodes) {
            for (const pBody of prizesManager.bodies) {
              if (pBody === this.grabbedBody) continue;

              const bPos = pBody.translation();
              const dx = bPos.x - node.pos.x;
              const dy = bPos.y - node.pos.y;
              const dz = bPos.z - node.pos.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

              if (dist < node.radius && dist > 0.001) {
                const overlap = (node.radius - dist) / node.radius;

                let pushX = dx / dist;
                let pushY = dy / dist;
                let pushZ = dz / dist;

                let forceMag = overlap * 1.4;
                if (isClosing) {
                  pushX = -outwardDir.x;
                  pushZ = -outwardDir.z;
                  pushY = 0.40;
                  forceMag *= 2.5;
                } else if (isOpening) {
                  pushX = outwardDir.x;
                  pushZ = outwardDir.z;
                  pushY = 0.30;
                  forceMag *= 2.0;
                }

                // Smooth solid physical separation & corner torque without explosive velocity jumps
                const impulseMag = Math.min(0.25, overlap * 0.18 * (isClosing ? 1.5 : 1.0));
                pBody.applyImpulse(
                  { x: pushX * impulseMag, y: pushY * impulseMag * 0.5, z: pushZ * impulseMag },
                  true
                );
                pBody.applyTorqueImpulse(
                  { x: pushZ * impulseMag * 0.2, y: impulseMag * 0.1, z: -pushX * impulseMag * 0.2 },
                  true
                );
              }
            }
          }
        }
      }
    }

    // ── E. State Machine with Touch-Stop ──
    switch (this.state) {
      case 'DESCENDING': {
        const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
        const touchedFloor = targetY <= minBaseY + 0.05;
        let touchedPrize = false;

        if (prizesManager && prizesManager.bodies.length > 0) {
          const clawTipY = targetY - 0.70 * clawScale;
          const stopRadiusXZ = 0.48 * clawScale;

          for (const pBody of prizesManager.bodies) {
            const pos = pBody.translation();
            const dx = pos.x - finalX;
            const dy = pos.y - clawTipY;
            const dz = pos.z - finalZ;
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            // Scale-aware pile stop: triggers cleanly when claw rests on top of prize pile
            if (distXZ <= stopRadiusXZ && (dy >= -0.35 * clawScale && dy <= 0.45 * clawScale)) {
              touchedPrize = true;
              break;
            }
          }
        }

        if (touchedFloor || touchedPrize || this.stateTimer > 4.5) {
          this.targetRopeLength = this.ropeLength;
          this.triggerGrab();
        }
        break;
      }

      case 'GRABBING':
        if (this.stateTimer > 0.4) {
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

            if (dist < 1.25) {
              const nx = dx / (dist || 1);
              const nz = dz / (dist || 1);
              const pushForce = 0.28 * (1.25 - dist);

              // Apply outward impulse & rotational flip torque
              pBody.applyImpulse({ x: nx * pushForce, y: pushForce * 0.45, z: nz * pushForce }, true);
              pBody.applyTorqueImpulse({ x: nz * pushForce * 0.25, y: pushForce * 0.15, z: -nx * pushForce * 0.25 }, true);
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
  }

  /* ================================================================
     DYNAMIC SPHERICAL PHYSICS GRIP LOGIC (NATURAL GRAVITY SWAY & SLIP)
     ================================================================ */

  private attemptGrab(physics: PhysicsSystem, prizesManager?: PrizesManager) {
    const basePos = this.baseMesh.position;
    const clawScale = this.baseMesh ? this.baseMesh.scale.x : 1.0;
    // Claw center cup volume Y (-0.75 * scale below base plate)
    const clawTipPos = { x: basePos.x, y: basePos.y - 0.75 * clawScale, z: basePos.z };

    let nearestBody: RAPIER.RigidBody | null = null;
    let nearestDist = Infinity;

    // Scale-aware grab envelope (0.44m * scale radius for 3-prong cup)
    const maxDistXZ = 0.44 * clawScale;
    const maxAbsDY = 0.60 * clawScale;

    if (prizesManager && prizesManager.bodies.length > 0) {
      for (const pBody of prizesManager.bodies) {
        const bPos = pBody.translation();
        const dx = bPos.x - clawTipPos.x;
        const dy = bPos.y - clawTipPos.y;
        const dz = bPos.z - clawTipPos.z;
        
        const distXZ = Math.sqrt(dx * dx + dz * dz);
        const absDY = Math.abs(dy);

        // Scale-aware envelope check matching physical claw arm dimensions
        if (distXZ <= maxDistXZ && absDY <= maxAbsDY) {
          const totalDist = Math.sqrt(distXZ * distXZ + dy * dy);
          if (totalDist < nearestDist) {
            nearestDist = totalDist;
            nearestBody = pBody;
          }
        }
      }
    }

    if (nearestBody) {
      const targetBody = nearestBody as RAPIER.RigidBody;
      const bPos = targetBody.translation();

      // Attach joint at prize's current physical location relative to claw base
      const localAnchorX = bPos.x - basePos.x;
      const localAnchorY = bPos.y - basePos.y;
      const localAnchorZ = bPos.z - basePos.z;

      for (let i = 0; i < targetBody.numColliders(); i++) {
        const col = targetBody.collider(i);
        col.setSensor(false);
        col.setFriction(0.85);
        col.setRestitution(0.02);
      }

      // Add stabilization damping during lift
      targetBody.setLinearDamping(0.8);
      targetBody.setAngularDamping(0.8);

      // Spherical Joint anchors prize securely at current physical position relative to claw base
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
    }
  }

  private releasePrize(physics: PhysicsSystem) {
    if (this.grabbedJoint) {
      physics.world.removeImpulseJoint(this.grabbedJoint, true);
      if (this.grabbedBody) {
        for (let i = 0; i < this.grabbedBody.numColliders(); i++) {
          const col = this.grabbedBody.collider(i);
          col.setSensor(false);
          col.setFriction(0.7);
        }
        this.grabbedBody.setLinvel({ x: 0, y: -0.3, z: 0 }, true);
      }
      this.grabbedJoint = null;
      this.grabbedBody = null;
    }
  }

  private maybeDropPrize(physics: PhysicsSystem, keepProbability: number) {
    if (!this.grabbedJoint) return;
    if (Math.random() > keepProbability) {
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

  actionButtonPressed() {
    if (this.state === 'IDLE') {
      this.state = 'DESCENDING';
      this.stateTimer = 0;
      this.targetArmAngle = this.config.clawOpenAngle;
      this.targetRopeLength = this.config.maxRopeLength;
    } else if (this.state === 'DESCENDING') {
      this.triggerGrab();
    } else if (this.state === 'ASCENDING') {
      this.releasePrize(this.physicsRef);
    }
  }

  private triggerGrab() {
    this.state = 'GRABBING';
    this.stateTimer = 0;
    this.descentDepth = this.ropeLength;
    this.targetRopeLength = this.ropeLength;
    this.targetArmAngle = this.config.clawCloseAngle;
  }

  private triggerTopHit(physics: PhysicsSystem) {
    this.state = 'TOP_HIT';
    this.stateTimer = 0;

    if (Math.random() < this.config.topHitProbability) {
      this.maybeDropPrize(physics, 0.3);
    }
  }
}