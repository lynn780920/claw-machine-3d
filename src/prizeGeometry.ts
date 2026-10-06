import * as THREE from 'three';

export function collectHullPoints(root: THREE.Object3D): Float32Array {
  root.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const localMatrix=new THREE.Matrix4(), point=new THREE.Vector3();
  const points:number[]=[];
  root.traverse(object=> {
    if (!(object instanceof THREE.Mesh)) return;
    const vertices=object.geometry.attributes.position;
    const step=Math.max(1,Math.floor(vertices.count/256));
    localMatrix.multiplyMatrices(inverse,object.matrixWorld);
    for(let i=0;i<vertices.count;i+=step) {
      object.getVertexPosition(i,point).applyMatrix4(localMatrix);
      points.push(point.x,point.y,point.z);
    }
  });
  return new Float32Array(points);
}
