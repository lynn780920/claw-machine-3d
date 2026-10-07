export function stepSuspension(angle:number, velocity:number, deltaVelocity:number, length:number, dt:number, sway:number, antiSwing:boolean) {
  const arm = Math.max(0.3,length);
  velocity -= deltaVelocity/arm*Math.max(0,Math.min(3,sway))*0.28;
  velocity += -9.81/arm*Math.sin(angle)*dt;
  velocity *= Math.exp(-(antiSwing ? 4 : 0.85)*dt);
  const next = angle+velocity*dt;
  const limit = 0.35;
  return {angle:Math.max(-limit,Math.min(limit,next)),velocity:Math.abs(next)>limit ? 0 : velocity};
}

export function suspensionOffset(length:number, angleX:number, angleZ:number, xBounds:[number,number], zBounds:[number,number]) {
  const x = Math.max(xBounds[0],Math.min(xBounds[1],length*Math.sin(angleX)));
  const z = Math.max(zBounds[0],Math.min(zBounds[1],length*Math.sin(angleZ)*Math.cos(angleX)));
  return {x,y:-Math.sqrt(Math.max(0,length*length-x*x-z*z)),z};
}
