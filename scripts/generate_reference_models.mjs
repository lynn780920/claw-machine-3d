import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// GLTFExporter uses the browser FileReader interface for its binary buffers.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
  }
};
const out = new URL('../public/models/reference/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const material = (name, color, metalness = 0, roughness = 0.5) => {
  const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  m.name = name;
  return m;
};
const black = material('PowderCoatedSteel', 0x202222, 0.55, 0.48);
const trim = material('AnodizedAluminium', 0x5b6060, 0.8, 0.28);
const chrome = material('BrushedChrome', 0xc3c8c6, 0.94, 0.23);
const rubber = material('BlackRubber', 0x171918, 0, 0.85);
const paper = material('WarmWhitePanel', 0xe2e2d9, 0, 0.82);
const glass = new THREE.MeshPhysicalMaterial({ color: 0xf4fff9, transmission: 0.35, roughness: 0.08, thickness: 0.08, ior: 1.46, transparent: true, opacity: 0.07, depthWrite: false });
glass.name = 'CabinetGlass';
const light = material('CeilingDiffuser', 0xf5f5e9, 0, 0.4);
light.emissive.set(0xfff1d3);
light.emissiveIntensity = 1.2;

function box(parent, name, size, pos, mat, radius = 0.025) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 4))), mat);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, name, radius, length, pos, mat, orientation) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 20), mat);
  mesh.name = name;
  mesh.position.set(...pos);
  if (orientation === 'x') mesh.rotation.z = Math.PI / 2;
  if (orientation === 'z') mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}
async function save(root, filename) {
  if (process.argv.includes('--claw-only') && filename !== 'claw.glb') return;
  root.updateMatrixWorld(true);
  const binary = await new GLTFExporter().parseAsync(root, { binary: true });
  await fs.writeFile(new URL(filename, out), Buffer.from(binary));
  console.log(`${filename}: ${binary.byteLength} bytes`);
}

const cabinet = new THREE.Group();
cabinet.name = 'CabinetRoot';
cabinet.userData.referenceDimensions = [7.4, 6.6, 6.4];
for (const x of [-3.7, 3.7]) for (const z of [-3.2, 3.2]) {
  box(cabinet, `Frame_${x}_${z}`, [0.22, 6.8, 0.22], [x, 3.3, z], black);
  box(cabinet, `Seal_${x}_${z}`, [0.035, 6.4, 0.065], [x - Math.sign(x) * 0.13, 3.3, z], rubber, 0.008);
  for (const y of [0.22, 3.3, 6.35]) cylinder(cabinet, 'FrameScrew', 0.031, 0.028, [x, y, z + 0.125], chrome, 'z');
}
for (const y of [0, 6.6]) {
  for (const z of [-3.2, 3.2]) box(cabinet, 'HorizontalFrame', [7.6, 0.22, 0.22], [0, y, z], black);
  for (const x of [-3.7, 3.7]) box(cabinet, 'DepthFrame', [0.22, 0.22, 6.4], [x, y, 0], black);
}
box(cabinet, 'BaseCabinet', [7.6, 2.65, 6.5], [0, -1.58, 0], black);
box(cabinet, 'Roof', [7.65, 0.2, 6.6], [0, 6.72, 0], black);
box(cabinet, 'BackPanel', [7.2, 6.25, 0.08], [0, 3.3, -3.1], paper);
const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.95,4.55),paper);
sign.name = 'BackSign';
sign.position.set(0,2.93,-3.035);
cabinet.add(sign);
for (const x of [-3.55, 3.55]) box(cabinet, 'GlassSide', [0.035, 6.25, 6.12], [x, 3.3, 0], glass, 0.006);
box(cabinet, 'GlassFront', [7.1, 6.25, 0.025], [0, 3.3, 3.17], glass, 0.005);
for (const x of [-3.0, 3.0]) {
  cylinder(cabinet, 'RailZ', 0.055, 5.8, [x, 6.05, 0], chrome, 'z');
  box(cabinet, 'RailMount', [0.2, 0.3, 0.25], [x, 6.1, -2.95], trim);
}
cylinder(cabinet, 'RailX', 0.07, 6.5, [0, 5.95, -0.7], chrome, 'x');
box(cabinet, 'CeilingLight', [5.7, 0.08, 0.35], [0, 6.45, 0.3], light);
for (const name of ['FloorRight', 'FloorBack', 'FloorLeft', 'FloorFront']) box(cabinet, name, [1, 1, 1], [0, -0.15, 0], rubber, 0.008);
box(cabinet, 'Console', [3.4, 0.42, 1.35], [0, -0.15, 3.63], black, 0.09);
box(cabinet, 'ConsolePlate', [3.12, 0.045, 1.1], [0, 0.08, 3.63], trim);
for (const x of [-1.45, 1.45]) for (const z of [3.18, 4.08]) cylinder(cabinet, 'ConsoleScrew', 0.04, 0.025, [x, 0.12, z], chrome);
const joystick = new THREE.Group();
joystick.name = 'JoystickPivot';
joystick.position.set(-0.7, 0.11, 3.63);
cabinet.add(joystick);
cylinder(joystick, 'JoystickGaiter', 0.24, 0.08, [0, 0.03, 0], rubber);
cylinder(joystick, 'JoystickStem', 0.045, 0.45, [0, 0.25, 0], chrome);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), paper);
knob.name = 'JoystickKnob';
knob.position.y = 0.52;
joystick.add(knob);
cylinder(cabinet, 'ButtonRim', 0.29, 0.075, [0.72, 0.13, 3.63], chrome);
cylinder(cabinet, 'ActionButton', 0.24, 0.085, [0.72, 0.19, 3.63], rubber);
box(cabinet, 'CoinPlate', [0.85, 0.95, 0.05], [1.2, -0.85, 3.285], trim);
box(cabinet, 'CoinSlot', [0.35, 0.05, 0.02], [1.2, -0.65, 3.32], rubber, 0.006);
cylinder(cabinet, 'CoinReturn', 0.10, 0.06, [1.2, -1.02, 3.33], chrome, 'z');
box(cabinet, 'PrizeDoorFrame', [1.75, 1.35, 0.07], [-1.75, -1.6, 3.3], trim);
box(cabinet, 'PrizeDoor', [1.52, 1.1, 0.035], [-1.75, -1.6, 3.345], rubber);
box(cabinet, 'PrizeDoorHandle', [0.65, 0.045, 0.09], [-1.75, -1.12, 3.39], chrome);
await save(cabinet, 'cabinet.glb');

const machineClaw = new THREE.Group();
machineClaw.name = 'MachineClaw';
const carriage = new THREE.Group();
carriage.name = 'CarriageRoot';
machineClaw.add(carriage);
box(carriage, 'CarriagePlate', [0.95, 0.14, 0.8], [0, 0, 0], chrome);
cylinder(carriage, 'CarriageMotor', 0.18, 0.32, [0, 0.2, 0], black);
for (const x of [-0.38, 0.38]) cylinder(carriage, 'CarriageWheel', 0.09, 0.09, [x, 0.04, 0], rubber, 'x');
const claw = new THREE.Group();
claw.name = 'ClawRoot';
machineClaw.add(claw);
cylinder(claw, 'Solenoid', 0.2, 0.38, [0, 0.21, 0], chrome);
cylinder(claw, 'TopPlate', 0.39, 0.075, [0, 0, 0], chrome);
cylinder(claw, 'CentralShaft', 0.035, 0.3, [0, -0.14, 0], chrome);
const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), chrome);
eyelet.name = 'CableAnchor';
eyelet.position.y = 0.44;
claw.add(eyelet);
const slider = new THREE.Group();
slider.name = 'Slider';
cylinder(slider, 'SliderCollar', 0.1, 0.06, [0, 0, 0], chrome);
claw.add(slider);
for (let i = 0; i < 3; i++) {
  const angle = i * Math.PI * 2 / 3;
  const pivot = new THREE.Group();
  pivot.name = `ArmPivot_${i + 1}`;
  pivot.position.set(Math.cos(angle) * 0.44, -0.02, Math.sin(angle) * 0.44);
  pivot.rotation.y = -angle;
  claw.add(pivot);
  const hinge = new THREE.Group();
  hinge.name = `ArmHinge_${i + 1}`;
  pivot.add(hinge);
  cylinder(hinge, 'HingePin', 0.025, 0.1, [0, 0, 0], chrome, 'z');
  const curve = new THREE.CatmullRomCurve3([[0,0,0],[0.17,-0.05,0],[0.36,-0.20,0],[0.40,-0.44,0],[0.40,-0.90,0],[0.30,-1.30,0]].map(p => new THREE.Vector3(...p)));
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.024, 10, false), chrome);
  arm.name = `Prong_${i + 1}`;
  hinge.add(arm);
  box(hinge, 'ClawTip', [0.10, 0.22, 0.08], [0.30, -1.24, 0], chrome, 0.012).rotation.z = -0.38;
  const anchor = new THREE.Object3D();
  anchor.name = `LinkBracket_${i + 1}`;
  anchor.position.set(0.10, -0.16, 0);
  hinge.add(anchor);
}
await save(machineClaw, 'claw.glb');

for (const [name, size, color] of [
  ['tea_box', [0.85, 1.45, 0.72], 0x4b7535],
  ['fruit_box', [1.0, 1.6, 0.78], 0xcb493e],
  ['milk_box', [0.75, 1.65, 0.7], 0xe8e3cc]
]) {
  const root = new THREE.Group();
  root.name = 'PrizeRoot';
  root.userData.dimensions = size;
  const mat = material('PrintedCarton', color, 0, 0.6);
  box(root, 'Carton', size, [0, 0, 0], mat, 0.02);
  const [w,h,d] = size;
  const face = (name, width, height, pos, rotation) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), paper);
    m.name = name;
    m.position.set(...pos);
    m.rotation.set(...rotation);
    root.add(m);
  };
  face('LabelFront', w-0.015, h-0.015, [0,0,d/2+0.002], [0,0,0]);
  face('LabelBack', w-0.015, h-0.015, [0,0,-d/2-0.002], [0,Math.PI,0]);
  face('LabelRight', d-0.015, h-0.015, [w/2+0.002,0,0], [0,Math.PI/2,0]);
  face('LabelLeft', d-0.015, h-0.015, [-w/2-0.002,0,0], [0,-Math.PI/2,0]);
  face('LabelTop', w-0.015, d-0.015, [0,h/2+0.002,0], [-Math.PI/2,0,0]);
  face('LabelBottom', w-0.015, d-0.015, [0,-h/2-0.002,0], [Math.PI/2,0,0]);
  await save(root, `${name}.glb`);
}
