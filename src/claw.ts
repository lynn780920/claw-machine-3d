import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';
import { PrizesManager } from './prizes';
import { instantiateModel } from './modelAssets';
import { ClawFinger } from './clawCollisions';
import { stepSuspension, suspensionOffset } from './clawSuspension';

export type ClawState =
  | 'IDLE'
  | 'DESCENDING'
  | 'GRABBING'
  | 'ASCENDING'
  | 'TOP_HIT'
  | 'RETURNING'
  | 'RELEASING'
  | 'RESETTING'
  | 'OPENING';

/**
 * Arcade 3D Claw Machine Simulation
 * - Authentic Mechanical Arm Close (6.0 speed):
 *   Closes arms with smooth solenoid speed matching real Taiwanese arcade claw machines, preventing infinite kinematic collision impulses.
 * - GLB-shaped metal fingers stop closing against prize surfaces.
 *   Rapier contacts transfer momentum without scripted pushes or velocity clamps.
 * - Diagonal Momentum Drop (甩爪動量斜向飛出與空中二收):
 *   Carries swing velocity (swayVelX/Z) diagonally along the swing vector. Air close (二收) closes arms smoothly in mid-air.
 * - Dynamic Spherical Physics Grip (自然重力懸掛與滑落包爪):
 *   Uses Rapier Spherical Joint so grabbed toys hang & sway naturally under gravity from contact point.
 */
export class Claw {
  /* ── Visual Objects ── */
  public carriageMesh!: THREE.Object3D;
  public baseMesh!: THREE.Group;
  public cableLine!: THREE.Line;

  private armPivots: THREE.Group[] = [];
  private fingers: ClawFinger[] = [];
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
  private smoothCarrVelX = 0;
  private smoothCarrVelZ = 0;
  private lastSmoothCarrVelX = 0;
  private lastSmoothCarrVelZ = 0;
  private lastDirX = 0;
  private lastDirZ = 0;

  // Damped suspension angles, driven by carriage acceleration.
  public swayAngleX = 0;
  public swayAngleZ = 0;
  private swayVelX = 0;
  private swayVelZ = 0;

  // Arm animation angle
  private currentArmAngle = 0.85;
  private targetArmAngle = 0.85;
  private gripContactLostTime = 0;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.physicsRef = physics;
    this.build(scene, physics);
  }

  public carriageLimit = 4.2;
  public forceTopRelease = false;
  private xBounds: [number, number] = [-4.2, 4.2];
  private zBounds: [number, number] = [-4.2, 4.2];
  public homeX = -3.0;
  public homeZ = 3.0;

  public setPlayfieldBounds(width: number, depth: number) {
    // Reserve the open fingers and their tilted sweep, not just the claw center.
    const reach = 1.4 * this.baseMesh.scale.x + 0.08;
    const xLimit = Math.max(0.2, Math.min(this.carriageLimit, width / 2 - reach));
    const rearLimit = Math.max(0.2, Math.min(this.carriageLimit, depth * 3.035 / 6.4 - reach));
    const frontLimit = Math.max(0.2, Math.min(this.carriageLimit, depth / 2 - reach));
    this.setMachineBounds(
      Math.max(-xLimit, Math.min(xLimit, this.homeX)),
      Math.max(-rearLimit, Math.min(frontLimit, this.homeZ)),
      this.carriageLimit, this.carriageY + 0.55
    );
    this.xBounds = [-xLimit, xLimit];
    this.zBounds = [-rearLimit, frontLimit];
  }

  public setMachineBounds(homeX: number, homeZ: number, limit: number, machineHeight: number = 6.0, resetPosition: boolean = true) {
    this.homeX = homeX;
    this.homeZ = homeZ;
    this.carriageLimit = limit;
    this.xBounds = [-limit, limit];
    this.zBounds = [-limit, limit];
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
        for (const finger of this.fingers) finger.move(this.config.clawOpenAngle,[]);
      }
      this.swayAngleX = 0;
      this.swayAngleZ = 0;
      this.swayVelX = 0;
      this.swayVelZ = 0;
      this.smoothCarrVelX = 0;
      this.smoothCarrVelZ = 0;
      this.lastSmoothCarrVelX = 0;
      this.lastSmoothCarrVelZ = 0;
      this.lastCarrX = homeX;
      this.lastCarrZ = homeZ;
    }
  }

  public setClawScale(scaleRatio: number) {
    if (this.baseMesh) {
      this.baseMesh.scale.set(scaleRatio, scaleRatio, scaleRatio);
      for (const finger of this.fingers) finger.rebuild();
      this.baseBody.collider(0).setShape(new RAPIER.Cylinder(0.22*scaleRatio,0.39*scaleRatio));
      this.baseBody.collider(0).setTranslationWrtParent({x:0,y:0.17*scaleRatio,z:0});
    }
  }

  /* ================================================================
     BUILD PATENT-ACCURATE ARCADE CLAW 3D MODEL
     ================================================================ */
  private build(scene: THREE.Scene, physics: PhysicsSystem) {
    const asset = instantiateModel('claw');
    this.carriageMesh = asset.getObjectByName('CarriageRoot')!;
    this.baseMesh = asset.getObjectByName('ClawRoot') as THREE.Group;
    scene.add(this.carriageMesh, this.baseMesh);
    this.carriageMesh.position.set(0,this.carriageY,0);
    this.baseMesh.position.set(0,this.carriageY-this.ropeLength,0);
    this.sliderGroup = this.baseMesh.getObjectByName('Slider') as THREE.Group;
    for (let i=1;i<=3;i++) {
      this.armPivots.push(this.baseMesh.getObjectByName(`ArmPivot_${i}`) as THREE.Group);
      const linkage = new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.38,10),new THREE.MeshStandardMaterial({color:0xbec5c1,metalness:0.9,roughness:0.25}));
      scene.add(linkage);
      this.linkageMeshes.push(linkage);
    }
    this.carriageBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,this.carriageY,0));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.48,0.07,0.4),this.carriageBody);
    this.baseBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,this.carriageY-this.ropeLength,0));
    physics.world.createCollider(RAPIER.ColliderDesc.cylinder(0.22,0.39).setTranslation(0,0.17,0).setFriction(0.7),this.baseBody);
    this.fingers = this.armPivots.map((pivot,i) => new ClawFinger(physics.world,pivot.getObjectByName(`ArmHinge_${i+1}`)!));
    this.cableLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-1,0)]),new THREE.LineBasicMaterial({color:0x929990}));
    scene.add(this.cableLine);
  }

  public reset() {
    this.releasePrize(this.physicsRef);
    this.state = 'IDLE';
    this.stateTimer = 0;
    this.swayAngleX = this.swayAngleZ = this.swayVelX = this.swayVelZ = 0;
    this.ropeLength = this.config.minRopeLength;
    this.targetRopeLength = this.ropeLength;
    this.targetArmAngle = this.config.clawOpenAngle;
    this.currentArmAngle = this.targetArmAngle;
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

    const deltaVx = this.smoothCarrVelX - this.lastSmoothCarrVelX;
    const deltaVz = this.smoothCarrVelZ - this.lastSmoothCarrVelZ;
    this.lastSmoothCarrVelX = this.smoothCarrVelX;
    this.lastSmoothCarrVelZ = this.smoothCarrVelZ;

    this.lastCarrX = carrPos.x;
    this.lastCarrZ = carrPos.z;

    const minBaseY = 1.1;

    // ── B. Cable Length Animation ──
    if (this.state === 'DESCENDING' && prizesManager) {
      const touchedBody=prizesManager.bodies.find(body =>
        this.fingers.some(finger => finger.contact(body)) ||
        Array.from({length:body.numColliders()},(_,i)=>i).some(i=> {
          const contact=this.baseBody.collider(0).contactCollider(body.collider(i),0.025);
          return !!contact && contact.distance<=0.008;
        }));
      if (touchedBody) {
        touchedBody.wakeUp();
        const point=touchedBody.translation();
        const clawPoint=this.baseBody.translation();
        touchedBody.applyImpulse({x:(point.x-clawPoint.x)*0.045,y:-0.035,z:(point.z-clawPoint.z)*0.045},true);
        physics.wakeUpNear(point.x,point.y,point.z,1.6*this.baseMesh.scale.x);
        this.triggerGrab(prizesManager);
      }
    }
    if (Math.abs(this.ropeLength - this.targetRopeLength) > 0.01) {
      const speed = this.targetRopeLength > this.ropeLength
        ? this.config.dropSpeed
        : this.config.raiseSpeed;
      const step = speed * deltaTime;
      this.ropeLength = this.ropeLength < this.targetRopeLength
        ? Math.min(this.targetRopeLength, this.ropeLength + step)
        : Math.max(this.targetRopeLength, this.ropeLength - step);
    }

    const anchor = this.baseMesh.getObjectByName('CableAnchor');
    const anchorLocal = anchor
      ? this.baseMesh.worldToLocal(anchor.getWorldPosition(new THREE.Vector3())).multiplyScalar(this.baseMesh.scale.x)
      : new THREE.Vector3(0,0.44*this.baseMesh.scale.x,0);
    // A taut suspension changes period with payout, not with an imposed animation beat.
    this.ropeLength = Math.min(this.ropeLength,carrPos.y-minBaseY);
    const length = Math.max(0.2,this.ropeLength-0.1-anchorLocal.y);
    const swingX = stepSuspension(this.swayAngleX,this.swayVelX,deltaVx,length,deltaTime,this.config.swayScale,this.config.antiSwingEnabled);
    const swingZ = stepSuspension(this.swayAngleZ,this.swayVelZ,deltaVz,length,deltaTime,this.config.swayScale,this.config.antiSwingEnabled);
    this.swayAngleX = swingX.angle; this.swayVelX = swingX.velocity;
    this.swayAngleZ = swingZ.angle; this.swayVelZ = swingZ.velocity;
    const swayQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-this.swayAngleZ * 0.70, 0, this.swayAngleX * 0.70, 'YXZ')
    );
    const anchorOffset = anchorLocal.clone().applyQuaternion(swayQuat);
    const offset = suspensionOffset(length,this.swayAngleX,this.swayAngleZ,
      [this.xBounds[0]-carrPos.x+anchorOffset.x,this.xBounds[1]-carrPos.x+anchorOffset.x],
      [this.zBounds[0]-carrPos.z+anchorOffset.z,this.zBounds[1]-carrPos.z+anchorOffset.z]);
    const cableTop = new THREE.Vector3(carrPos.x,carrPos.y-0.1,carrPos.z);
    const cableBottom = cableTop.clone().add(new THREE.Vector3(offset.x,offset.y,offset.z));
    const finalX = cableBottom.x-anchorOffset.x;
    const finalZ = cableBottom.z-anchorOffset.z;
    const targetY = cableBottom.y-anchorOffset.y;
    this.baseBody.setNextKinematicTranslation({ x: finalX, y: targetY, z: finalZ });
    this.baseBody.setNextKinematicRotation({ x: swayQuat.x, y: swayQuat.y, z: swayQuat.z, w: swayQuat.w });

    this.baseMesh.position.set(finalX, targetY, finalZ);
    this.baseMesh.quaternion.copy(swayQuat);

    // ── C. Cable Visual: Connects directly from carriage bottom to top eyelet ring ──
    this.cableLine.geometry.setFromPoints([cableTop, cableBottom]);

    // ── D. Smooth Arm Angle Animation (Authentic arcade solenoid speed 9.5) ──
    // Clamps arm angle dynamically: closes tightly into 密爪 when empty/grabbing, or hugs perimeter when grasping prize!
    let effectiveTargetAngle = this.targetArmAngle;
    if (this.grabbedBody || this.state === 'GRABBING') {
      // 下爪到底合爪瞬間：電磁閥通電，確實全力收緊至密爪！
      effectiveTargetAngle = this.config.clawCloseAngle;
    }
    for (const finger of this.fingers) {
      const angle = finger.angle + (effectiveTargetAngle-finger.angle)*Math.min(1,9.5*deltaTime);
      finger.move(angle,prizesManager?.bodies ?? []);
    }
    this.currentArmAngle = this.fingers.reduce((sum,finger)=>sum+finger.angle,0)/3;
    if (this.grabbedBody) {
      const contacts = this.fingers.filter(finger=>finger.contact(this.grabbedBody!));
      this.gripContactLostTime = contacts.length < 2 ? this.gripContactLostTime + deltaTime : 0;
      // The helper joint must not carry a prize after it slips clear of the fingers.
      if (this.gripContactLostTime > 0.18) this.releasePrize(physics);
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
      const hinge = pivot.getObjectByName(`ArmHinge_${i+1}`);
      if (hinge && this.linkageMeshes[i]) {
        const linkBracket = hinge.getObjectByName(`LinkBracket_${i+1}`) || hinge;
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


    // ── E. State Machine with Realistic Impact Dynamics ──
    switch (this.state) {
      case 'DESCENDING': {
        const touchedFloor = targetY <= minBaseY + 0.05;
        let hitPrizeBody: RAPIER.RigidBody | null = null;

        if (prizesManager) {
          const head = this.baseBody.collider(0);
          hitPrizeBody = prizesManager.bodies.find(body => {
            for (let i=0;i<body.numColliders();i++) {
              const contact = head.contactCollider(body.collider(i),0.01);
              if (contact && contact.distance<=0.008) return true;
            }
            return false;
          }) ?? null;
        }

        if (touchedFloor || hitPrizeBody || this.stateTimer > 4.5) {
          this.targetRopeLength = this.ropeLength;
          this.triggerGrab(prizesManager);
        }
        break;
      }

      case 'GRABBING':
        if (this.stateTimer > 0.65) {
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
    const maxDistXZ = 0.85 * clawScale;

    let candidateBody: RAPIER.RigidBody | null = null;
    let bestScore = -Infinity;

    for (const pBody of prizesManager.bodies) {
      if (pBody === this.grabbedBody) continue;
      const grippingFingers = this.fingers.filter(finger =>
        finger.angle <= this.config.clawOpenAngle - 0.15 && finger.contact(pBody));
      if (grippingFingers.length < 2) continue;
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


  private attemptGrab(physics: PhysicsSystem, prizesManager?: PrizesManager) {
    const candidateBody = this.findCandidatePrize(prizesManager);

    if (candidateBody) {
      const targetBody = candidateBody;
      const bPos = targetBody.translation();

      const contacts = this.fingers.map(finger => finger.contact(targetBody)).filter(contact => contact !== null);
      const anchor = contacts.reduce((point,contact) => point.add(new THREE.Vector3(contact.point2.x,contact.point2.y,contact.point2.z)),new THREE.Vector3()).divideScalar(contacts.length);
      const baseAnchor = anchor.clone().sub(new THREE.Vector3().copy(this.baseBody.translation()))
        .applyQuaternion(new THREE.Quaternion().copy(this.baseBody.rotation()).invert());
      const prizeAnchor = anchor.clone().sub(new THREE.Vector3(bPos.x,bPos.y,bPos.z))
        .applyQuaternion(new THREE.Quaternion().copy(targetBody.rotation()).invert());

      // Maintain inward solenoid pressure while the rigid fingers follow contacts.
      this.targetArmAngle = this.config.clawCloseAngle;
      this.gripContactLostTime = 0;


      for (let i = 0; i < targetBody.numColliders(); i++) {
        const col = targetBody.collider(i);
        col.setSensor(false);
      }

      // 提起時保持合理阻尼
      targetBody.wakeUp();

      // Spherical Joint 錨定接觸點，並啟用碰撞與接觸響應
      const sphericalJointData = RAPIER.JointData.spherical(
        baseAnchor,
        prizeAnchor
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

  private releasePrize(physics: PhysicsSystem, _reason: 'NORMAL' | 'WEAK_DROP' | 'TOP_HIT' | 'CHUTE_RELEASE' = 'NORMAL') {
    this.gripContactLostTime = 0;
    this.targetArmAngle = this.config.clawOpenAngle;
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

      for (let i = 0; i < body.numColliders(); i++) {
        const col = body.collider(i);
        col.setSensor(false);
      }

      body.wakeUp();

      // Rapier already carries the prize's linear and angular momentum.
      // Opening fingers and gravity determine the release, not a velocity override.
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
    nx = Math.max(this.xBounds[0], Math.min(this.xBounds[1], nx));
    nz = Math.max(this.zBounds[0], Math.min(this.zBounds[1], nz));
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

    if (this.forceTopRelease) {
      this.releasePrize(physics, 'TOP_HIT');
      return;
    }

    if (this.config.godMode) return; // 🌟 無敵保夾模式：撞天車絕不震落！

    const prob = this.config.topHitProbability / Math.max(1.0, this.config.superGripMultiplier);
    if (Math.random() < prob) {
      this.releasePrize(physics, 'TOP_HIT');
    }
  }
}
