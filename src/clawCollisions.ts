import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export class ClawFinger {
  readonly body: RAPIER.RigidBody;
  readonly colliders: RAPIER.Collider[] = [];
  private parts: {collider:RAPIER.Collider;position:THREE.Vector3;rotation:THREE.Quaternion}[] = [];
  angle = 0.85;
  private world: RAPIER.World;
  readonly hinge: THREE.Object3D;

  constructor(world: RAPIER.World, hinge: THREE.Object3D) {
    this.world = world;
    this.hinge = hinge;
    hinge.rotation.z = this.angle;
    hinge.updateWorldMatrix(true,true);
    const position = hinge.getWorldPosition(new THREE.Vector3());
    const rotation = hinge.getWorldQuaternion(new THREE.Quaternion());
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x,position.y,position.z).setRotation(rotation).setCcdEnabled(true));
    this.rebuild();
  }

  rebuild() {
    for (const collider of this.colliders) this.world.removeCollider(collider,true);
    this.colliders.length = 0;
    this.parts.length = 0;
    this.hinge.updateWorldMatrix(true,true);
    const inverse = new THREE.Matrix4().compose(
      this.hinge.getWorldPosition(new THREE.Vector3()),
      this.hinge.getWorldQuaternion(new THREE.Quaternion()),new THREE.Vector3(1,1,1)).invert();
    this.hinge.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const vertices = object.geometry.attributes.position;
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
      // The exported GLB tube has 33 rings of 11 vertices. Short capsules
      // preserve the curved finger's empty interior instead of filling it in.
      const tube = object.name.startsWith('Prong_') && vertices.count === 363;
      const add = (shape:RAPIER.ColliderDesc,position:THREE.Vector3,rotation:THREE.Quaternion) => {
        const collider = this.world.createCollider(shape.setTranslation(position.x,position.y,position.z)
          .setRotation(rotation).setFriction(1.1).setRestitution(0).setContactSkin(0.003),this.body);
        this.colliders.push(collider);
        this.parts.push({collider,position,rotation});
      };
      if (tube) {
        const centers:THREE.Vector3[] = [];
        let radius = 0;
        for (let ring=0;ring<33;ring++) {
          const center = new THREE.Vector3();
          const points:THREE.Vector3[] = [];
          for (let i=0;i<10;i++) {
            const point = new THREE.Vector3().fromBufferAttribute(vertices,ring*11+i).applyMatrix4(matrix);
            points.push(point); center.add(point);
          }
          center.divideScalar(10);
          centers.push(center);
          for (const point of points) radius = Math.max(radius,point.distanceTo(center));
        }
        for (let i=0;i<32;i+=2) {
          const a = centers[i], b = centers[i+2];
          const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
          add(RAPIER.ColliderDesc.capsule(a.distanceTo(b)/2,radius+0.003),a.clone().add(b).multiplyScalar(0.5),rotation);
        }
      } else {
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox!;
        const position = bounds.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
        const rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
        matrix.decompose(new THREE.Vector3(),rotation,scale);
        const half = bounds.getSize(new THREE.Vector3()).multiply(scale).multiplyScalar(0.5);
        add(RAPIER.ColliderDesc.cuboid(half.x,half.y,half.z),position,rotation);
      }
    });
  }

  move(angle: number, obstacles: RAPIER.RigidBody[]) {
    const previous = this.angle;
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion();
    const blockedAt = (candidate: number) => {
      this.hinge.rotation.z = candidate;
      this.hinge.updateWorldMatrix(true,true);
      this.hinge.getWorldPosition(position);
      this.hinge.getWorldQuaternion(rotation);
      return obstacles.some(body => {
        const p = body.translation();
        if (position.distanceToSquared(new THREE.Vector3(p.x,p.y,p.z)) > 9) return false;
        for (let i=0;i<body.numColliders();i++) {
          for (const part of this.parts) {
            const shapePosition = part.position.clone().applyQuaternion(rotation).add(position);
            const shapeRotation = rotation.clone().multiply(part.rotation);
            const contact = body.collider(i).contactShape(part.collider.shape,shapePosition,shapeRotation,0.006);
            if (contact && contact.distance < 0.003) {
              body.wakeUp();
              return true;
            }
          }
        }
        return false;
      });
    };
    if (angle < previous && blockedAt(angle)) {
      let blocked = angle, safe = previous;
      for (let i=0;i<7;i++) {
        const middle = (blocked+safe)/2;
        if (blockedAt(middle)) blocked = middle;
        else safe = middle;
      }
      angle = safe;
    }
    this.hinge.rotation.z = angle;
    this.hinge.updateWorldMatrix(true,true);
    this.hinge.getWorldPosition(position);
    this.hinge.getWorldQuaternion(rotation);
    this.angle = angle;
    this.body.setNextKinematicTranslation(position);
    this.body.setNextKinematicRotation(rotation);
  }

  contact(body: RAPIER.RigidBody): RAPIER.ShapeContact | null {
    for (let i=0;i<body.numColliders();i++) {
      for (const finger of this.colliders) {
        const contact = finger.contactCollider(body.collider(i),0.025);
        if (contact && contact.distance <= 0.008) return contact;
      }
    }
    return null;
  }
}
