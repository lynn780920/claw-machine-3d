export type ChuteBounds = {minX:number;maxX:number;minZ:number;maxZ:number};
export type PrizeStockDimensions = {radius:number;height:number};

function shuffled<T>(items: readonly T[], random:()=>number): T[] {
  const result = [...items];
  for (let i=result.length-1;i>0;i--) {
    const j = Math.floor(random()*(i+1));
    [result[i],result[j]] = [result[j],result[i]];
  }
  return result;
}

export function rotatedPrizeHalfHeight(dimensions:PrizeStockDimensions,rx:number,ry:number,rz:number) {
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const worldYFromX=cx*sz+sx*cz*sy;
  const worldYFromY=cx*cz-sx*sz*sy;
  const worldYFromZ=-sx*cy;
  return Math.abs(worldYFromX)*dimensions.radius
    +Math.abs(worldYFromY)*dimensions.height*0.5
    +Math.abs(worldYFromZ)*dimensions.radius;
}

export function randomPrizeStock(
  count:number,
  types:readonly string[],
  spread:number,
  chute?:ChuteBounds,
  random = Math.random,
  chuteClearance = 0.45,
  dimensions?: (type:string)=>PrizeStockDimensions
) {
  if (count<=0) return [];
  if (!types.length) throw new RangeError('Prize stock requires at least one type');
  const slots:{x:number;z:number}[] = [];
  for (let i=0;i<Math.min(count,24);i++) {
    let best = {x:spread*0.35,z:-spread*0.35}, score = -Infinity;
    for (let attempt=0;attempt<50;attempt++) {
      const candidate = {x:(random()*2-1)*spread*0.52,z:(random()*2-1)*spread*0.45};
      if (chute && candidate.x>chute.minX-chuteClearance && candidate.x<chute.maxX+chuteClearance
        && candidate.z>chute.minZ-chuteClearance && candidate.z<chute.maxZ+chuteClearance) continue;
      const distance = slots.length ? Math.min(...slots.map(p=>(p.x-candidate.x)**2+(p.z-candidate.z)**2)) : random();
      if (distance>score) {best=candidate;score=distance;}
    }
    slots.push(best);
  }
  const inventory:string[] = [];
  while (inventory.length<count) inventory.push(...shuffled(types,random));

  if (dimensions) {
    const stock:{type:string;x:number;y:number;z:number;rx:number;ry:number;rz:number}[]=[];
    const slotTops=slots.map(()=>0);
    const layers=Math.ceil(count/slots.length);
    for (let layer=0;layer<layers && stock.length<count;layer++) {
      const available=shuffled(slots.map((_,index)=>index),random);
      const layerItems:{x:number;z:number;radius:number}[]=[];
      while (available.length && stock.length<count) {
        const type=inventory[stock.length];
        const dim=dimensions(type);
        const rx=(random()-0.5)*0.35,ry=random()*Math.PI*2,rz=(random()-0.5)*0.35;
        const halfHeight=rotatedPrizeHalfHeight(dim,rx,ry,rz);
        const footprint=Math.max(dim.radius,Math.min(dim.height*0.5,dim.radius*1.25));
        let bestAt=0,bestTop=Infinity,bestClearance=-Infinity;
        for (let candidate=0;candidate<available.length;candidate++) {
          const slot=slots[available[candidate]];
          let clearance=Infinity;
          for (const item of layerItems) {
            const distance=Math.hypot(slot.x-item.x,slot.z-item.z);
            clearance=Math.min(clearance,distance-item.radius-footprint);
          }
          const top=slotTops[available[candidate]]+halfHeight*2+0.055;
          if (top<bestTop-0.001 || (Math.abs(top-bestTop)<0.001 && clearance>bestClearance)) {
            bestAt=candidate;bestTop=top;bestClearance=clearance;
          }
        }
        const slotIndex=available.splice(bestAt,1)[0],slot=slots[slotIndex];
        const y=slotTops[slotIndex]+halfHeight+0.055;
        slotTops[slotIndex]=bestTop;
        stock.push({type,x:slot.x,y,z:slot.z,rx,ry,rz});
        layerItems.push({x:slot.x,z:slot.z,radius:footprint});
      }
    }
    return stock;
  }

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
  const estimates:Record<string,number> = {pikachu:0.12,eevee:0.12,squirtle:0.13,bulbasaur:0.14,
    gengar:0.15,snorlax:0.22,psyduck:0.13,milk_box:0.25,tea_box:0.35,fruit_box:0.35,
    blindbox:0.12,ssr_glowing_labubu:0.12,sanrio_bottle:0.16,mug_box:0.38,cookie_box:0.2,
    snack_pack:0.1,dragonball:0.22,onepiece:0.22,ps5:2.6,switch:0.8,dyson:1.1,marshall:1.4,lego:0.45};
  const mass = estimates[type] ?? (plush ? 0.13 : 0.25);
  return {mass:mass*Math.max(0.25,Math.min(3,weight)),friction:plush ? 0.85 : 0.65,restitution:0.015,
    linearDamping:0.25,angularDamping:(plush ? 1.8 : 1.2)*Math.max(0.25,Math.min(3,rolling))};
}
