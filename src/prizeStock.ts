export type ChuteBounds = {minX:number;maxX:number;minZ:number;maxZ:number};

function shuffled<T>(items: readonly T[], random:()=>number): T[] {
  const result = [...items];
  for (let i=result.length-1;i>0;i--) {
    const j = Math.floor(random()*(i+1));
    [result[i],result[j]] = [result[j],result[i]];
  }
  return result;
}

export function randomPrizeStock(count:number, types:readonly string[], spread:number, chute?:ChuteBounds, random = Math.random) {
  if (count<=0) return [];
  if (!types.length) throw new RangeError('Prize stock requires at least one type');
  const slots:{x:number;z:number}[] = [];
  for (let i=0;i<Math.min(count,16);i++) {
    let best = {x:spread*0.35,z:-spread*0.35}, score = -Infinity;
    for (let attempt=0;attempt<50;attempt++) {
      const candidate = {x:(random()*2-1)*spread*0.52,z:(random()*2-1)*spread*0.45};
      if (chute && candidate.x>chute.minX-0.45 && candidate.x<chute.maxX+0.45 && candidate.z>chute.minZ-0.45 && candidate.z<chute.maxZ+0.45) continue;
      const distance = slots.length ? Math.min(...slots.map(p=>(p.x-candidate.x)**2+(p.z-candidate.z)**2)) : random();
      if (distance>score) {best=candidate;score=distance;}
    }
    slots.push(best);
  }
  const inventory:string[] = [];
  while (inventory.length<count) inventory.push(...shuffled(types,random));
  const stock = [];
  for (let layer=0;stock.length<count;layer++) {
    for (const slot of shuffled(slots,random)) {
      if (stock.length>=count) break;
      stock.push({type:inventory[stock.length],x:slot.x,y:0.95+layer*1.15,z:slot.z,
        rx:-0.75-random()*0.8,ry:random()*Math.PI*2,rz:(random()-0.5)*0.7});
    }
  }
  return stock;
}

export function prizePhysicsProfile(type:string, plush:boolean, weight=1, rolling=1) {
  // Kilogram estimates for stuffed fabric, filled cartons and packaged retail prizes.
  const estimates:Record<string,number> = {pikachu:0.18,eevee:0.18,squirtle:0.2,bulbasaur:0.2,
    gengar:0.22,snorlax:0.32,psyduck:0.18,milk_box:0.25,tea_box:0.35,fruit_box:0.35,
    blindbox:0.12,ssr_glowing_labubu:0.12,sanrio_bottle:0.16,mug_box:0.38,cookie_box:0.2,
    snack_pack:0.1,dragonball:0.22,onepiece:0.22,ps5:2.6,switch:0.8,dyson:1.1,marshall:1.4,lego:0.45};
  const mass = estimates[type] ?? (plush ? 0.18 : 0.25);
  return {mass:mass*Math.max(0.25,Math.min(3,weight)),friction:plush ? 0.85 : 0.65,restitution:0.015,
    linearDamping:0.25,angularDamping:(plush ? 1.8 : 1.2)*Math.max(0.25,Math.min(3,rolling))};
}
