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
  public config = {
    moveSpeed: 4.0,
    dropSpeed: 3.8,
    raiseSpeed: 3.0,
    maxRopeLength: 13.5,
    minRopeLength: 1.0,

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
  public ropeLength = 1.0;
  private targetRopeLength = 1.0;
  private stateTimer = 0;
  private descentDepth = 0;
  private hasTriggeredWeakForce = false;

  // Carriage velocity & acceleration tracking for zero-lag braking inertia
  private lastCarrX = 0;
  private lastCarrZ = 0;
  private lastCarrVelX = 0;
  private lastCarrVelZ = 0;
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

  public setClawScale(scaleRatio: number) {
    if (this.baseMesh) {
      this.baseMesh.scale.set(scaleRatio, scaleRatio, scaleRatio);
    }
  }

  /* ================================================================
     BUILD PATENT-ACCURATE ARCADE CLAW 3D MODEL
     ================================================================ */
  private build(scene: THREE.Scene, physics: PhysicsSystem) {
    const CARRIAGE_Y = 7.0;

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
    const carrVelX = (carrPos.x - this.lastCarrX) / Math.max(0.0001, deltaTime);
    const carrVelZ = (carrPos.z - this.lastCarrZ) / Math.max(0.0001, deltaTime);

    // Compute carriage acceleration (braking deceleration when stopping)
    const carrAccelX = (carrVelX - this.lastCarrVelX) / Math.max(0.0001, deltaTime);
    const carrAccelZ = (carrVelZ - this.lastCarrVelZ) / Math.max(0.0001, deltaTime);

    this.lastCarrX = carrPos.x;
    this.lastCarrZ = carrPos.z;
    this.lastCarrVelX = carrVelX;
    this.lastCarrVelZ = carrVelZ;

    // 1. Instantaneous Braking Inertia Kick (When stopping rightward movement, inertia kicks claw RIGHT immediately with zero lag!)
    if (Math.abs(carrVelX) < 0.1 && Math.abs(this.lastCarrVelX) > 0.8) {
      const lastDirX = Math.sign(this.lastCarrVelX);
      this.swayVelX += lastDirX * 1.8;
    }
    if (Math.abs(carrVelZ) < 0.1 && Math.abs(this.lastCarrVelZ) > 0.8) {
      const lastDirZ = Math.sign(this.lastCarrVelZ);
      this.swayVelZ += lastDirZ * 1.8;
    }

    // 2. Direction Reversal Flicking (Pumping)
    if (Math.abs(carrVelX) > 0.4) {
      const dirX = Math.sign(carrVelX);
      if (this.lastDirX !== 0 && dirX !== this.lastDirX) {
        this.swayVelX += dirX * 1.5;
      }
      this.lastDirX = dirX;
    } else {
      this.lastDirX = 0;
    }

    if (Math.abs(carrVelZ) > 0.4) {
      const dirZ = Math.sign(carrVelZ);
      if (this.lastDirZ !== 0 && dirZ !== this.lastDirZ) {
        this.swayVelZ += dirZ * 1.5;
      }
      this.lastDirZ = dirZ;
    } else {
      this.lastDirZ = 0;
    }

    const g = 14.0;
    const L = Math.max(0.6, this.ropeLength);
    const omegaSq = g / L;

    // Non-inertial frame fictitious inertia acceleration: -carrAccel
    const inertiaAccelX = -carrAccelX * 0.08;
    const inertiaAccelZ = -carrAccelZ * 0.08;

    const swayAccelX = -omegaSq * Math.sin(this.swayAngleX) + inertiaAccelX;
    const swayAccelZ = -omegaSq * Math.sin(this.swayAngleZ) + inertiaAccelZ;

    this.swayVelX += swayAccelX * deltaTime;
    this.swayVelZ += swayAccelZ * deltaTime;

    // Cable stabilization damping when descending to prevent vertical stuttering
    const isDropping = (this.state === 'DESCENDING');
    const dampingFactor = this.config.antiSwingEnabled ? 0.80 : (isDropping ? 0.94 : 0.982);
    this.swayVelX *= dampingFactor;
    this.swayVelZ *= dampingFactor;

    this.swayAngleX += this.swayVelX * deltaTime;
    this.swayAngleZ += this.swayVelZ * deltaTime;

    // Realistic Arcade Max Swing Angle (~22 degrees / 0.38 rad)
    const maxAngle = 0.38;
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

    // Physical Pendulum Offset clamped to realistic 0.85m max displacement
    const maxOffset = 0.85;
    const swayOffsetX = Math.max(-maxOffset, Math.min(maxOffset, L * Math.sin(this.swayAngleX)));
    const swayOffsetZ = Math.max(-maxOffset, Math.min(maxOffset, L * Math.sin(this.swayAngleZ)));
    const dropFactor = Math.cos(this.swayAngleX) * Math.cos(this.swayAngleZ);

    const minBaseY = 1.1;
    const rawTargetY = carrPos.y - (this.ropeLength * dropFactor);
    const targetY = Math.max(minBaseY, rawTargetY);

    // Enforce Glass Cabinet Interior Physical Collision Bounds (Cabinet Glass is at +/- 4.4)
    const minClawX = -4.2;
    const maxClawX = 4.2;
    const minClawZ = -4.2;
    const maxClawZ = 4.2;

    let finalX = carrPos.x + swayOffsetX;
    let finalZ = carrPos.z + swayOffsetZ;

    if (finalX < minClawX) {
      finalX = minClawX;
      this.swayVelX = Math.abs(this.swayVelX) * 0.3; // Soft bounce off glass wall
    } else if (finalX > maxClawX) {
      finalX = maxClawX;
      this.swayVelX = -Math.abs(this.swayVelX) * 0.3;
    }

    if (finalZ < minClawZ) {
      finalZ = minClawZ;
      this.swayVelZ = Math.abs(this.swayVelZ) * 0.3; // Soft bounce off glass wall
    } else if (finalZ > maxClawZ) {
      finalZ = maxClawZ;
      this.swayVelZ = -Math.abs(this.swayVelZ) * 0.3;
    }

    const swayQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-this.swayAngleZ, 0, this.swayAngleX, 'YXZ')
    );

    this.baseBody.setNextKinematicTranslation({ x: finalX, y: targetY, z: finalZ });
    this.baseBody.setNextKinematicRotation({ x: swayQuat.x, y: swayQuat.y, z: swayQuat.z, w: swayQuat.w });

    this.baseMesh.position.set(finalX, targetY, finalZ);
    this.baseMesh.quaternion.copy(swayQuat);

    // ── C. Cable Visual ──
    this.cableLine.geometry.setFromPoints([
      this.carriageMesh.position.clone(),
      this.baseMesh.position.clone()
    ]);

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

    // ── G. 3-Prong Physical Contact & Corner Nudging Physics (三爪單爪實體觸碰推角落與撥動翻滾物理) ──
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

          const tipWorldPos = prongWorldPos.clone();
          tipWorldPos.addScaledVector(outwardDir, 0.28 * clawScale);
          tipWorldPos.y -= 0.65 * clawScale;

          const contactRadius = 0.38 * clawScale;

          for (const pBody of prizesManager.bodies) {
            if (pBody === this.grabbedBody) continue;

            const bPos = pBody.translation();
            const dx = bPos.x - tipWorldPos.x;
            const dy = bPos.y - tipWorldPos.y;
            const dz = bPos.z - tipWorldPos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < contactRadius && dist > 0.001) {
              const overlap = (contactRadius - dist) / contactRadius;
              
              let pushX = dx / dist;
              let pushY = dy / dist;
              let pushZ = dz / dist;

              let forceMag = overlap * 0.55;
              if (isClosing) {
                pushX = -outwardDir.x;
                pushZ = -outwardDir.z;
                pushY = 0.35;
                forceMag *= 1.8;
              } else if (isOpening) {
                pushX = outwardDir.x;
                pushZ = outwardDir.z;
                pushY = 0.25;
                forceMag *= 1.4;
              }

              pBody.applyImpulse(
                { x: pushX * forceMag, y: pushY * forceMag, z: pushZ * forceMag },
                true
              );
              pBody.applyTorqueImpulse(
                { x: pushZ * forceMag * 0.4, y: forceMag * 0.2, z: -pushX * forceMag * 0.4 },
                true
              );
            }
          }
        }
      }
    }

    // ── E. State Machine with Touch-Stop ──
    switch (this.state) {
      case 'DESCENDING':
        const touchedFloor = targetY <= minBaseY + 0.05;
        let touchedPrize = false;

        if (prizesManager && prizesManager.bodies.length > 0) {
          const clawTipY = targetY - 0.70;
          for (const pBody of prizesManager.bodies) {
            const pos = pBody.translation();
            const dx = pos.x - finalX;
            const dy = pos.y - clawTipY;
            const dz = pos.z - finalZ;
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            // Touch-stop only when claw base plate physically touches/rests on top of a prize body
            if (distXZ < 0.28 && (dy >= -0.20 && dy <= 0.25)) {
              touchedPrize = true;
              break;
            }
          }
        }

        if (touchedFloor || touchedPrize || this.stateTimer > 2.8) {
          this.targetRopeLength = this.ropeLength;
          this.triggerGrab();
        }
        break;

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
        const homeX = -3.0;
        const homeZ = 3.0;
        const pos = this.carriageBody.translation();
        const dx = homeX - pos.x;
        const dz = homeZ - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.05) {
          const step = this.config.moveSpeed * deltaTime;
          const nx = pos.x + (dx / dist) * Math.min(dist, step);
          const nz = pos.z + (dz / dz ? (dz / dist) * Math.min(dist, step) : 0);
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
    nx = Math.max(-4.2, Math.min(4.2, nx));
    nz = Math.max(-4.2, Math.min(4.2, nz));
    this.carriageBody.setNextKinematicTranslation({ x: nx, y: pos.y, z: nz });
    this.carriageMesh.position.set(nx, pos.y, nz);
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