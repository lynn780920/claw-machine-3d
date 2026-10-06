export interface ChuteBounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function isDelivered(position: {x:number;y:number;z:number}, chute: ChuteBounds): boolean {
  return position.y < -0.45 && position.x >= chute.minX && position.x <= chute.maxX && position.z >= chute.minZ && position.z <= chute.maxZ;
}
