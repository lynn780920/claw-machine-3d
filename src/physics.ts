import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsSystem {
  public world!: RAPIER.World;
  private bodies: Map<RAPIER.RigidBody, THREE.Object3D> = new Map();
  private isInitialized = false;

  async init() {
    await RAPIER.init();
    // Realistic arcade gravity (-22.0 m/s2) for realistic drops & kinetic stability
    const gravity = { x: 0.0, y: -22.0, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    // High precision solver iterations to eliminate interpenetration and tunneling
    this.world.integrationParameters.numSolverIterations = 16;
    this.world.integrationParameters.numAdditionalSolverIterations = 8;
    this.world.integrationParameters.contactSkin = 0.008;

    this.isInitialized = true;
  }

  step() {
    if (!this.isInitialized) return;

    // Substepping: 2 micro-steps per frame (1/120s each) for ultra-accurate collision response and zero tunneling
    const originalDt = this.world.integrationParameters.dt;
    const substepDt = originalDt / 2;
    this.world.integrationParameters.dt = substepDt;

    this.world.step();
    this.world.step();

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
          body.wakeUp(true);
        }
      }
    });
  }

  wakeUpAllDynamicBodies() {
    if (!this.isInitialized || !this.world) return;
    this.bodies.forEach((_, body) => {
      if (body.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        body.wakeUp(true);
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
    if (this.world) {
      this.world.free();
    }
    this.isInitialized = false;
  }
}
