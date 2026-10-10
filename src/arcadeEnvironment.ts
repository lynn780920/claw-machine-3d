import * as THREE from 'three';
import { instantiateModel, FEATURED_POKEMON_TYPES } from './modelAssets';
import { CABINET_PALETTES, colorCabinetModel } from './cabinetPalette';

function signTexture(title: string, color: string) {
  const canvas=document.createElement('canvas');
  canvas.width=1024; canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#15121c'; ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle=color; ctx.lineWidth=8; ctx.strokeRect(12,12,1000,232);
  ctx.fillStyle=color; ctx.font='900 100px Arial'; ctx.textAlign='center';
  ctx.fillText(title,512,165);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  return texture;
}

export function layoutArcadeNeighbors(scene: THREE.Scene, cabinetWidth: number) {
  const room = scene.getObjectByName('CyberpunkArcade');
  if (!room) return;
  for (const side of [-1, 1]) {
    let edge = cabinetWidth / 2 + 0.9;
    for (let row = 0; row < 2; row++) {
      const machine = room.getObjectByName(`Neighbor_${side}_${row}`);
      if (!machine) continue;
      machine.position.x = 0;
      machine.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(machine);
      machine.position.x = side < 0 ? -edge - bounds.max.x : edge - bounds.min.x;
      edge += bounds.max.x - bounds.min.x + 0.9;
    }
  }
}

export function buildArcadeEnvironment(scene: THREE.Scene, compact = false) {
  const room=new THREE.Group(); room.name='CyberpunkArcade';
  const metal=new THREE.MeshStandardMaterial({color:0x33343b,metalness:0.55,roughness:0.55});
  const wall=new THREE.MeshStandardMaterial({color:0x34303c,roughness:0.85});
  const addBox=(name:string,size:number[],position:number[],material:THREE.Material) => {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),material);
    mesh.name=name; mesh.position.set(...position as [number,number,number]); room.add(mesh);
    return mesh;
  };
  const tile=document.createElement('canvas'); tile.width=512; tile.height=512;
  const ctx=tile.getContext('2d')!;
  ctx.fillStyle='#222329'; ctx.fillRect(0,0,512,512);
  for(let row=0;row<4;row++) for(let col=0;col<4;col++) {
    ctx.fillStyle=(row+col)%2 ? '#45444b' : '#373940';
    ctx.fillRect(col*128+3,row*128+3,122,122);
    ctx.strokeStyle='#585861'; ctx.strokeRect(col*128+5,row*128+5,118,118);
  }
  for(let i=0;i<5000;i++) {
    ctx.fillStyle=i%2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.035)';
    ctx.fillRect((i*131)%512,(i*197)%512,2,2);
  }
  const tiles=new THREE.CanvasTexture(tile); tiles.colorSpace=THREE.SRGBColorSpace;
  tiles.wrapS=tiles.wrapT=THREE.RepeatWrapping; tiles.repeat.set(12,12); tiles.anisotropy=8;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({map:tiles,roughness:0.65,metalness:0.15}));
  floor.name='ArcadeTileFloor'; floor.rotation.x=-Math.PI/2; floor.position.y=-3.85;
  floor.receiveShadow=true; room.add(floor);
  addBox('RearWall',[80,16,0.4],[0,3.5,-15],wall);
  addBox('LeftWall',[0.4,16,60],[-28,3.5,-10],wall);
  addBox('RightWall',[0.4,16,60],[28,3.5,-10],wall);
  const banner=new THREE.Mesh(new THREE.PlaneGeometry(24,6),new THREE.MeshBasicMaterial({map:signTexture('NEON ARCADE','#00e5ee'),toneMapped:false}));
  banner.position.set(0,6,-14.75); room.add(banner);
  for(let i=-4;i<=4;i++) {
    const color=i%2 ? 0xff2189 : 0x00dbe8;
    const neon=new THREE.MeshBasicMaterial({color,toneMapped:false});
    addBox('WallNeon',[0.10,10,0.1],[i*6,2.5,-14.6],neon);
  }
  const ceilingZPositions = [-12, -7, -2, 3, 8];
  for(let j=0; j<ceilingZPositions.length; j++) {
    const z = ceilingZPositions[j];
    const color = j%2 ? 0xff2189 : 0x00dbe8;
    const neon = new THREE.MeshBasicMaterial({color,toneMapped:false});
    addBox('CeilingBeam',[56,0.14,0.14],[0,10,z],metal);
    addBox('CeilingLight',[52,0.06,0.10],[0,9.8,z],neon);
  }
  const fill=new THREE.HemisphereLight(0xdce7ed,0x35303a,0.4); room.add(fill);
  for(const side of [-1,1]) {
    const lamp=new THREE.PointLight(side<0 ? 0xff408f : 0x3af2ed,100,30,2);
    lamp.position.set(side*10,6,-6); room.add(lamp);
    for(let row=0;row<(compact ? 1 : 2);row++) {
      const machine=instantiateModel('cabinet'); machine.name=`Neighbor_${side}_${row}`;
      const palette = side < 0
        ? (row === 0 ? CABINET_PALETTES.small : CABINET_PALETTES.large)
        : (row === 0 ? CABINET_PALETTES.kbasket : CABINET_PALETTES.medium);
      colorCabinetModel(machine, palette);
      machine.position.set(side*(8.2+row*8),0,-2-row*4);
      machine.rotation.y=side*-0.10;
      machine.traverse(object=> {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow=false;
        if(object.name.startsWith('Floor')) (object.material as THREE.MeshStandardMaterial).color.set(0xb7c6c5);
        if (object.name.startsWith('Glass')) { (object.material as THREE.Material).dispose(); object.material=new THREE.MeshBasicMaterial({transparent:true,opacity:0.018,depthWrite:false}); }
        if(object.name==='BackSign') {
          (object.material as THREE.Material).dispose();
          object.material=new THREE.MeshBasicMaterial({map:signTexture('賭博就是不歸路',side<0?'#ff428f':'#35e9ec'),toneMapped:false});
        }
      });
      for(let i=0;i<4;i++) {
        const prize=instantiateModel(FEATURED_POKEMON_TYPES[i]);
        const bounds=new THREE.Box3().setFromObject(prize), size=bounds.getSize(new THREE.Vector3());
        const scale=1.3/Math.max(size.x,size.y,size.z);
        prize.scale.setScalar(scale); prize.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
        const placement=new THREE.Group(); placement.add(prize); placement.position.set(-2.1+i*1.4,0.75,-0.4);
        machine.add(placement);
      }
      const header=new THREE.Mesh(new THREE.PlaneGeometry(6.8,1),new THREE.MeshBasicMaterial({map:signTexture('賭博就是不歸路',side<0?'#ff428f':'#35e9ec'),toneMapped:false}));
      header.position.set(0,6.8,3.2); machine.add(header);
      const edgeMaterial=new THREE.MeshBasicMaterial({color:palette.trim,toneMapped:false});
      for(const x of [-3.55,3.55]) {
        const led=new THREE.Mesh(new THREE.BoxGeometry(0.045,6.3,0.045),edgeMaterial);
        led.position.set(x,3.2,3.22); machine.add(led);
      }
      room.add(machine);
    }
  }
  scene.add(room);
}
