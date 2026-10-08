import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export type BedSection = [string, number, number, number, number];

/** Stable elastic contacts return impact energy without movable floor particles. */
export class ElasticBed {
  readonly meshes: THREE.Mesh[] = [];
  private bodies: RAPIER.RigidBody[] = [];
  private world:RAPIER.World;
  private material:THREE.Material;

  constructor(world:RAPIER.World, sections:BedSection[], material:THREE.Material) {
    this.world=world;this.material=material;
    for (const [,x0,x1,z0,z1] of sections) {
      const width=x1-x0,depth=z1-z0;
      if (width<=0 || depth<=0) continue;
      const x=(x0+x1)/2,z=(z0+z1)/2;
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,-0.075,z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(width/2,0.075,depth/2)
        .setFriction(0.2).setRestitution(0.90)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),body);
      this.bodies.push(body);
      const geometry=new THREE.PlaneGeometry(width,depth);
      geometry.rotateX(-Math.PI/2);
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,0.008,z);
      mesh.name='ElasticCloth'; mesh.receiveShadow=true;
      this.meshes.push(mesh);
    }
  }

  dispose() {
    for(const body of this.bodies) if(body.isValid()) this.world.removeRigidBody(body);
    for(const mesh of this.meshes) {mesh.removeFromParent();mesh.geometry.dispose();}
    this.material.dispose();
    this.bodies=[];this.meshes.length=0;
  }
}
