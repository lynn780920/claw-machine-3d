export function chuteWellWallSpecs(
  chute: {minX:number;maxX:number;minZ:number;maxZ:number},
  floorY: number,
  depth: number,
  thickness = 0.07
): {name:string;size:[number,number,number];position:[number,number,number]}[] {
  const width=chute.maxX-chute.minX, length=chute.maxZ-chute.minZ;
  const centerX=(chute.minX+chute.maxX)/2, centerZ=(chute.minZ+chute.maxZ)/2;
  const y=floorY-depth/2;
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
    right: {length:halfDepth-chute.minZ,center:(chute.minZ+halfDepth)/2},
    back: {length:chute.maxX+halfWidth,center:(chute.maxX-halfWidth)/2}
  };
}
