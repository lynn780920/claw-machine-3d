import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsSystem {
  public world!: RAPIER.World;
  private bodies: Map<RAPIER.RigidBody, THREE.Object3D> = new Map();
  private isInitialized = false;

  async init() {
    await RAPIER.init();
    // Realistic 2.2x game gravity (-22.0 m/s2) for snappy drops & kinetic stability without bouncing explosion
    const gravity = { x: 0.0, y: -22.0, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    // Increase solver iterations for maximum stability and zero interpenetration/merging
    this.world.integrationParameters.numSolverIterations = 16;
    this.world.integrationParameters.numAdditionalSolverIterations = 8;

    this.isInitialized = true;
  }

  step() {
    if (!this.isInitialized) return;
    this.world.step();
    
    // Sync Rapier positions/rotations with Three.js meshes
    this.bodies.forEach((mesh, body) => {
      // Sync only dynamic bodies (toys, claw) back to Three.js
      if (body.bodyType() !== RAPIER.RigidBodyType.Dynamic) return;
      const trans = body.translation();
      const rot = body.rotation();
      mesh.position.set(trans.x, trans.y, trans.z);
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
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
