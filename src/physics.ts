import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsSystem {
  public world!: RAPIER.World;
  private bodies: Map<RAPIER.RigidBody, THREE.Object3D> = new Map();
  private isInitialized = false;
  private supportAuditStep = 0;
  public substeps = 2;

  async init() {
    await RAPIER.init();
    // Preserve the existing arcade world scale while migrating its visual assets.
    const gravity = { x: 0.0, y: -22.0, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    // High precision solver iterations to eliminate interpenetration and tunneling
    this.world.integrationParameters.numSolverIterations = 20;
    this.world.integrationParameters.maxCcdSubsteps = 4;

    this.isInitialized = true;
  }

  // Pre-settles stacked prizes synchronously so they never start in an interpenetrating state
  prewarmSimulation(steps = 25) {
    if (!this.isInitialized || !this.world) return;
    const originalDt = this.world.integrationParameters.dt;
    this.world.integrationParameters.dt = originalDt / 2;
    for (let i = 0; i < steps; i++) {
      this.world.step();
    }
    this.world.integrationParameters.dt = originalDt;
    
    // Sync Rapier positions/rotations with Three.js meshes
    this.bodies.forEach((mesh, body) => {
      if (body.bodyType() !== RAPIER.RigidBodyType.Dynamic) return;
      const trans = body.translation();
      const rot = body.rotation();
      mesh.position.set(trans.x, trans.y, trans.z);
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    });
  }

  step(beforeSubstep?: (dt: number) => void) {
    if (!this.isInitialized) return;

    // The compliant bed uses finer substeps; ordinary stages retain their existing cost.
    const originalDt = this.world.integrationParameters.dt;
    const substepDt = originalDt / this.substeps;
    this.world.integrationParameters.dt = substepDt;

    for (let i=0;i<this.substeps;i++) {
      beforeSubstep?.(substepDt);
      this.world.step();
    }

    // Removing a supporting prize does not always wake a sleeping body above it.
    // Periodically wake only genuinely unsupported sleepers so gravity can resume.
    if (++this.supportAuditStep % 30 === 0) {
      this.bodies.forEach((_,body) => {
        if (body.bodyType() !== RAPIER.RigidBodyType.Dynamic || !body.isSleeping()) return;
        let hasContact = false;
        for (let i=0;i<body.numColliders() && !hasContact;i++) {
          this.world.contactPairsWith(body.collider(i),() => { hasContact = true; });
        }
        if (!hasContact) body.wakeUp();
      });
    }

    this.world.integrationParameters.dt = originalDt;
    
    // Sync Rapier positions/rotations with Three.js meshes
    this.bodies.forEach((mesh, body) => {
      // Sync only dynamic bodies (toys, etc.) back to Three.js
      if (body.bodyType() !== RAPIER.RigidBodyType.Dynamic) return;
      const trans = body.translation();
      const rot = body.rotation();
      mesh.position.set(trans.x, trans.y, trans.z);
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    });
  }

  // Wake up dynamic bodies in an area (used when claw drops, hits or releases)
  wakeUpNear(x: number, y: number, z: number, radius: number) {
    if (!this.isInitialized || !this.world) return;
    const rSq = radius * radius;
    this.bodies.forEach((_, body) => {
      if (body.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        const p = body.translation();
        const dx = p.x - x;
        const dy = p.y - y;
        const dz = p.z - z;
        if (dx * dx + dy * dy + dz * dz <= rSq) {
          body.wakeUp();
        }
      }
    });
  }

  wakeUpAllDynamicBodies() {
    if (!this.isInitialized || !this.world) return;
    this.bodies.forEach((_, body) => {
      if (body.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        body.wakeUp();
      }
    });
  }

  registerBody(body: RAPIER.RigidBody, mesh: THREE.Object3D) {
    this.bodies.set(body, mesh);
  }

  unregisterBody(body: RAPIER.RigidBody) {
    this.bodies.delete(body);
  }

  clear() {
    this.bodies.clear();
    this.supportAuditStep = 0;
    if (this.world) {
      this.world.free();
    }
    this.isInitialized = false;
  }
}
