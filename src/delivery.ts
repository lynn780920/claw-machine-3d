export interface ChuteBounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function isDelivered(position: {x:number;y:number;z:number}, chute: ChuteBounds): boolean {
  return position.y < -0.45 && position.x >= chute.minX && position.x <= chute.maxX && position.z >= chute.minZ && position.z <= chute.maxZ;
}

export function isWedgedInChute(
  position: {x:number;y:number;z:number},
  bottomY: number,
  verticalSpeed: number,
  chute: ChuteBounds
): boolean {
  const inset = 0.02;
  return position.x > chute.minX + inset && position.x < chute.maxX - inset
    && position.z > chute.minZ + inset && position.z < chute.maxZ - inset
    && position.y < 1.5 && bottomY < 0.12 && Math.abs(verticalSpeed) < 0.25;
}

export function isPrizeEnteringChute(
  bounds: {min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}},
  chute: ChuteBounds
): boolean {
  const overlapX=Math.max(0,Math.min(bounds.max.x,chute.maxX)-Math.max(bounds.min.x,chute.minX));
  const overlapZ=Math.max(0,Math.min(bounds.max.z,chute.maxZ)-Math.max(bounds.min.z,chute.minZ));
  const width=Math.max(0.001,bounds.max.x-bounds.min.x);
  const depth=Math.max(0.001,bounds.max.z-bounds.min.z);
  return bounds.min.y<0.05 && overlapX*overlapZ/(width*depth)>0.45;
}
