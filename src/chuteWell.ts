export function chuteWellWallSpecs(
  chute: {minX:number;maxX:number;minZ:number;maxZ:number},
  floorY: number,
  depth: number,
  thickness = 0.07,
  halfWidth?: number,
  halfDepth?: number
): {name:string;size:[number,number,number];position:[number,number,number]}[] {
  const width=chute.maxX-chute.minX, length=chute.maxZ-chute.minZ;
  const centerX=(chute.minX+chute.maxX)/2, centerZ=(chute.minZ+chute.maxZ)/2;
  const y=floorY-depth/2;

  // In compact stage 8, seal the chute well all the way to the playfield edge rails
  if (halfWidth !== undefined && halfDepth !== undefined) {
    const rightLen = halfDepth - chute.minZ;
    const rightCenterZ = (chute.minZ + halfDepth) / 2;
    const backLen = chute.maxX + halfWidth;
    const backCenterX = (chute.maxX - halfWidth) / 2;
    return [
      {name:'ChuteWellSide',size:[thickness,depth,length],position:[chute.minX,y,centerZ]},
      {name:'ChuteWellSideRight',size:[thickness,depth,rightLen],position:[chute.maxX,y,rightCenterZ]},
      {name:'ChuteWellBack',size:[backLen,depth,thickness],position:[backCenterX,y,chute.minZ]},
      {name:'ChuteWellFront',size:[width,depth,thickness],position:[centerX,y,chute.maxZ]}
    ];
  }

  return [
    {name:'ChuteWellSide',size:[thickness,depth,length],position:[chute.minX,y,centerZ]},
    {name:'ChuteWellSide',size:[thickness,depth,length],position:[chute.maxX,y,centerZ]},
    {name:'ChuteWellBack',size:[width,depth,thickness],position:[centerX,y,chute.minZ]},
    {name:'ChuteWellFront',size:[width,depth,thickness],position:[centerX,y,chute.maxZ]}
  ];
}

export function compactChuteBaffleSpans(
  chute: {minX:number;maxX:number;minZ:number;maxZ:number},
  halfWidth: number,
  halfDepth: number
) {
  return {
    right: {length:halfDepth-chute.minZ+0.05,center:(chute.minZ+halfDepth)/2},
    back: {length:chute.maxX+halfWidth+0.05,center:(chute.maxX-halfWidth)/2}
  };
}
