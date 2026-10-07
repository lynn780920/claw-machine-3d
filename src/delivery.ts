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
  const inset = 0.14;
  return position.x > chute.minX + inset && position.x < chute.maxX - inset
    && position.z > chute.minZ + inset && position.z < chute.maxZ - inset
    && position.y < 1.5 && bottomY < 0.12 && Math.abs(verticalSpeed) < 0.25;
}
