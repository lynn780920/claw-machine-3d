import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function setupStudio(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.background = new THREE.Color(0x302434);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room,0.04).texture;
  scene.environmentIntensity = 0.28;
  room.dispose();
  pmrem.dispose();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function fitMachineCamera(camera: THREE.PerspectiveCamera, controls: {target:THREE.Vector3;update:()=>void}, dimensions: {width:number;height:number;depth:number}, side = false) {
  const {width,height,depth} = dimensions;
  const targetY = height * 0.38;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const verticalDistance = height * 1.12 / (2*Math.tan(fov/2));
  const horizontalDistance = width * 1.08 / (2*Math.tan(fov/2)*camera.aspect);
  const distance = Math.max(height * 1.59, camera.aspect < 1 ? horizontalDistance + depth/2 : verticalDistance);
  controls.target.set(0,targetY,0);
  camera.position.set(side ? -distance*0.65 : 0,targetY + height*0.29,side ? distance*0.78 : distance);
  controls.update();
}
