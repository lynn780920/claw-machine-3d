import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export type BedSection = [string, number, number, number, number];

/** Distributed compliant surface. Rapier solves contact, spring energy and torque. */
export class ElasticBed {
  readonly meshes: THREE.Mesh[] = [];
  private bodies: RAPIER.RigidBody[] = [];
  private patches: {mesh:THREE.Mesh; cells:RAPIER.RigidBody[]; nx:number; nz:number}[] = [];
  private world:RAPIER.World;
  private material:THREE.Material;

  constructor(world:RAPIER.World, sections:BedSection[], material:THREE.Material) {
    this.world=world;this.material=material;
    const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.bodies.push(anchor);
    const nodes: {body:RAPIER.RigidBody;x:number;z:number;w:number;d:number}[] = [];
    for (const [,x0,x1,z0,z1] of sections) {
      const nx=Math.max(1,Math.ceil((x1-x0)/0.8)), nz=Math.max(1,Math.ceil((z1-z0)/0.8));
      const w=(x1-x0)/nx, d=(z1-z0)/nz;
      const cells:RAPIER.RigidBody[]=[];
      for (let iz=0;iz<nz;iz++) for (let ix=0;ix<nx;ix++) {
        const x=x0+(ix+0.5)*w, z=z0+(iz+0.5)*d;
        const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x,-0.025,z).setGravityScale(0).setCcdEnabled(true));
        body.setEnabledTranslations(false,true,false,true);
        body.setEnabledRotations(false,false,false,true);
        world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,0.025,d/2)
          .setMass(0.012*w*d).setFriction(0.15).setRestitution(0)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min),body);
        // Nonzero resting length gives the vertical spring a defined axis at rest.
        world.createImpulseJoint(RAPIER.JointData.spring(0.525,110*w*d,0.06*w*d,
          {x,y:0.5,z},{x:0,y:0,z:0}),anchor,body,true);
        cells.push(body); this.bodies.push(body); nodes.push({body,x,z,w,d});
      }
      const geometry=new THREE.PlaneGeometry(x1-x0,z1-z0,nx,nz);
      geometry.rotateX(-Math.PI/2);
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set((x0+x1)/2,0,(z0+z1)/2);
      mesh.name='ElasticCloth'; mesh.receiveShadow=true; mesh.frustumCulled=false;
      this.meshes.push(mesh); this.patches.push({mesh,cells,nx,nz});
    }
    // Neighbor springs transfer tension between loaded and unloaded cloth regions.
    for (let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) {
      const a=nodes[i],b=nodes[j],dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);
      const adjacent=(Math.abs(dx-(a.w+b.w)/2)<0.001 && dz<(a.d+b.d)/2-0.001)
        || (Math.abs(dz-(a.d+b.d)/2)<0.001 && dx<(a.w+b.w)/2-0.001);
      if (!adjacent) continue;
      const joint=world.createImpulseJoint(RAPIER.JointData.spring(Math.hypot(dx,dz),35,0.025,
        {x:0,y:0,z:0},{x:0,y:0,z:0}),a.body,b.body,true);
      joint.setContactsEnabled(false);
    }
  }

  updateVisuals() {
    for (const {mesh,cells,nx,nz} of this.patches) {
      const positions=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let iz=0;iz<=nz;iz++) for (let ix=0;ix<=nx;ix++) {
        let y=0,count=0;
        for(const dz of [-1,0]) for(const dx of [-1,0]) {
          const x=ix+dx,z=iz+dz;
          if(x>=0 && x<nx && z>=0 && z<nz) { y+=cells[z*nx+x].translation().y+0.025; count++; }
        }
        positions.setY(iz*(nx+1)+ix,y/Math.max(1,count));
      }
      positions.needsUpdate=true; mesh.geometry.computeVertexNormals();
    }
  }

  dispose() {
    for(const body of this.bodies) if(body.isValid()) this.world.removeRigidBody(body);
    for(const mesh of this.meshes) {mesh.removeFromParent();mesh.geometry.dispose();}
    this.material.dispose();
    this.bodies=[];this.patches=[];
  }
}
