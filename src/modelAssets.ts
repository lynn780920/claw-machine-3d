import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const PRIZE_TYPES = ['battle_top_cx13', 'battle_top_bx50', 'blindbox', 'cookie_box', 'dragonball', 'dyson', 'lego', 'marshall', 'mug_box', 'onepiece', 'ps5', 'sanrio_bottle', 'snack_pack', 'ssr_glowing_labubu', 'switch', 'tea_box', 'fruit_box', 'milk_box'] as const;
const reference = new Set(['tea_box', 'fruit_box', 'milk_box']);
export const FEATURED_POKEMON_TYPES = ['pikachu', 'eevee', 'squirtle', 'bulbasaur'];
export const POKEMON_TYPES = [...FEATURED_POKEMON_TYPES, 'gengar', 'snorlax', 'psyduck'];
export const APPLIANCE_TYPES = ['ps5', 'switch', 'dyson', 'marshall', 'lego'];
export const LARGE_POKEMON_DIMENSIONS: Record<string,{radius:number;height:number}> = {
  eevee: {radius:0.9,height:2.0},
  snorlax: {radius:0.95,height:2.15},
  gengar: {radius:1.05,height:2.0},
  psyduck: {radius:1.0,height:1.9}
};
export const MIXED_PRIZE_TYPES = [...PRIZE_TYPES.filter(type => !type.startsWith('battle_top_') && !APPLIANCE_TYPES.includes(type)), ...POKEMON_TYPES];
const boxedPrizes = new Set(['blindbox', 'cookie_box', 'dragonball', 'mug_box', 'onepiece', 'ssr_glowing_labubu', 'tea_box', 'fruit_box', 'milk_box']);

export function prizeStockScale(type: string, stock: string): number {
  return stock === 'mixed' && boxedPrizes.has(type) ? 0.75 : 1;
}
const templates = new Map<string, THREE.Group>();
const labels = new Map<string, THREE.Texture>();
let fabricBump: THREE.DataTexture | undefined;
let loading: Promise<void> | undefined;

function plushFabricBump(): THREE.DataTexture {
  if (fabricBump) return fabricBump;
  const size = 128, pixels = new Uint8Array(size*size*4);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const offset = (y*size+x)*4;
    const grain = ((x*1973+y*9277) ^ (x*y*26699)) & 31;
    const value = 105+grain+((x+y)%2)*28;
    pixels[offset] = pixels[offset+1] = pixels[offset+2] = value;
    pixels[offset+3] = 255;
  }
  fabricBump = new THREE.DataTexture(pixels,size,size);
  fabricBump.wrapS = fabricBump.wrapT = THREE.RepeatWrapping;
  fabricBump.repeat.set(18,18);
  fabricBump.magFilter = fabricBump.minFilter = THREE.LinearFilter;
  fabricBump.needsUpdate = true;
  return fabricBump;
}

export function applyPlushMaterial(material: THREE.MeshStandardMaterial) {
  material.metalness = 0;
  material.roughness = 0.94;
  material.envMapIntensity = 0.45;
  material.bumpMap = plushFabricBump();
  material.bumpScale = 0.006;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.sheen = 0.12;
    material.sheenColor.setRGB(0.5,0.5,0.5);
    material.sheenRoughness = 0.9;
    material.specularIntensity = 0.25;
  }
}

export async function withTimeout<T>(operation: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation,new Promise<never>((_,reject)=> {
      timer=setTimeout(()=>reject(new Error(`${label}: timeout`)),milliseconds);
    })]);
  } finally { clearTimeout(timer!); }
}

export function preloadModels(progress: (loaded: number, total: number) => void): Promise<void> {
  if (loading) return loading;
  const entries = [
    ['cabinet', 'reference/cabinet.glb'], ['claw', 'reference/claw.glb'],
    ...POKEMON_TYPES.map(type => [type, `pokemon/${type}.glb`]),
    ...PRIZE_TYPES.map(type => [type, `${reference.has(type) ? 'reference' : 'prizes'}/${type}.glb`])
  ];
  let loaded = 0, next = 0;
  progress(0,entries.length);
  const worker = async () => {
    while (next < entries.length) {
      const [key,path] = entries[next++];
      if (!templates.has(key)) {
        const url = `${import.meta.env.BASE_URL}models/${path}`;
        const response = await fetch(url,{signal:AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const gltf = await withTimeout(new GLTFLoader().parseAsync(bytes,url.slice(0,url.lastIndexOf('/')+1)),20000,path);
        templates.set(key,gltf.scene);
      }
      progress(++loaded,entries.length);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  };
  loading = Promise.all([worker(),worker(),worker()]).then(() => undefined).catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function instantiateModel(key: string): THREE.Group {
  const template = templates.get(key);
  if (!template) throw new Error(`Model not loaded: ${key}`);
  const instance = clone(template) as THREE.Group;
  instance.userData.assetInstance = true;
  instance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
    if (POKEMON_TYPES.includes(key)) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) applyPlushMaterial(material);
      });
    }
    object.castShadow = !object.name.startsWith('Glass');
    object.receiveShadow = !object.name.startsWith('Glass');
  });
  return instance;
}

export function disposeModel(instance: THREE.Object3D) {
  instance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(m => m.dispose());
  });
}

export function cartonLabel(type: string, face: string): THREE.Texture {
  const key = `${type}/${face}`;
  const cached = labels.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const palettes: Record<string, [string, string, string, string]> = {
    tea_box: ['#4d733a', '#e9efcc', '山霧綠茶', 'GREEN TEA'],
    fruit_box: ['#c64d41', '#fff0dd', '草莓果飲', 'STRAWBERRY'],
    milk_box: ['#e9e4d4', '#344338', '牧場鮮奶', 'FRESH MILK']
  };
  const [color, ink, title, subtitle] = palettes[type];
  ctx.fillStyle = color;
  ctx.fillRect(0,0,512,768);
  ctx.fillStyle = ink;
  ctx.fillRect(24,24,464,9);
  ctx.fillRect(24,730,464,9);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = '24px sans-serif';
  ctx.fillText('DAILY COLLECTION',256,80);
  if (face === 'LabelFront') {
    ctx.font = 'bold 63px "Microsoft JhengHei", sans-serif';
    ctx.fillText(title,256,200);
    ctx.font = '22px sans-serif';
    ctx.fillText(subtitle,256,246);
    if (type === 'fruit_box') {
      ctx.fillStyle = '#f9cebf';
      ctx.beginPath(); ctx.ellipse(256,443,108,144,-0.1,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4b6438';
      for (let i=0;i<5;i++) {ctx.beginPath(); ctx.ellipse(256+(i-2)*19,310,19,48,(i-2)*0.35,0,Math.PI*2); ctx.fill();}
      ctx.fillStyle = '#a9453b';
      for(let i=0;i<35;i++){ctx.beginPath();ctx.ellipse(181+(i%7)*24,360+Math.floor(i/7)*40,3,6,0,0,Math.PI*2);ctx.fill();}
    } else if(type === 'tea_box') {
      ctx.fillStyle = '#c1d9a0';
      for(let i=0;i<6;i++){ctx.beginPath();ctx.ellipse(225+(i%2)*65,350+Math.floor(i/2)*75,36,69,i%2?0.65:-0.65,0,Math.PI*2);ctx.fill();}
      ctx.strokeStyle = ink; ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(256,565);ctx.lineTo(256,330);ctx.stroke();
    } else {
      ctx.fillStyle = '#92aaa0';ctx.fillRect(95,322,322,237);
      ctx.fillStyle = '#f4f2e6';ctx.fillRect(110,340,292,195);
      ctx.fillStyle = '#344338';ctx.font='bold 100px serif';ctx.fillText('MILK',256,475);
    }
    ctx.fillStyle=ink;ctx.font='23px sans-serif';ctx.fillText('6 PACK / 250 ml',256,674);
  } else if (face === 'LabelBack' || face === 'LabelRight' || face === 'LabelLeft') {
    ctx.font='bold 38px "Microsoft JhengHei", sans-serif';ctx.fillText(title,256,164);
    ctx.font='20px sans-serif';ctx.fillText(subtitle,256,210);
    ctx.textAlign='left';ctx.font='18px sans-serif';
    for(const [i,text] of ['NUTRITION INFORMATION','Serving size 250 ml','Energy        120 kcal','Protein         3.2 g','Fat             2.4 g','Carbohydrate   18.0 g','Store in a cool dry place'].entries()) ctx.fillText(text,52,290+i*45);
    ctx.fillStyle='#faf8f0';ctx.fillRect(52,624,408,78);
    ctx.fillStyle='#272c29';
    for(let i=0,x=70;i<80;i++){const w=(i%4===0?4:2);ctx.fillRect(x,635,w,53);x+=w+2;}
  } else {
    ctx.font='bold 48px "Microsoft JhengHei", sans-serif';ctx.fillText(title,256,310);
    ctx.font='22px sans-serif';ctx.fillText('250 ml x 6',256,382);
    ctx.strokeStyle=ink;ctx.globalAlpha=0.35;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,520);ctx.lineTo(512,520);ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 4;
  labels.set(key, texture);
  return texture;
}

