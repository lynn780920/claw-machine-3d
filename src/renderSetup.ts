import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function setupStudio(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.background = new THREE.Color(0x090812);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room,0.04).texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x191321,roughness:0.42,metalness:0.25}));
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -3.85;
  floor.receiveShadow = true;
  scene.add(floor);
  for (let i = -6; i <= 6; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.025,0.02,45), new THREE.MeshBasicMaterial({color:i % 2 ? 0xff168e : 0x00d9e8}));
    strip.position.set(i * 3,-3.83,-10);
    scene.add(strip);
  }
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
