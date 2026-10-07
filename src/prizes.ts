import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';
import { instantiateModel, disposeModel, cartonLabel, APPLIANCE_TYPES, MIXED_PRIZE_TYPES, prizeStockScale, LARGE_POKEMON_DIMENSIONS, FEATURED_POKEMON_TYPES, POKEMON_TYPES } from './modelAssets';
import { collectHullPoints, centerAndScaleHullPoints } from './prizeGeometry';
import { randomPrizeStock, prizePhysicsProfile } from './prizeStock';

export class PrizesManager {
  public prizes: THREE.Object3D[] = [];
  public bodies: RAPIER.RigidBody[] = [];
  private scene: THREE.Scene;
  private physics: PhysicsSystem;
  public onBeforeClear?: () => void;
  public weightMultiplier = 1;
  public rollingResistance = 1;
  public applianceLightweight = false;
  private pendingStock: ReturnType<typeof setTimeout>[] = [];

  applyPrizePhysics() {
    this.bodies.forEach((body,index) => {
      const type = this.prizes[index].userData.prizeType as string;
      const profile = prizePhysicsProfile(type,POKEMON_TYPES.includes(type),this.weightMultiplier,this.rollingResistance);
      const mass = profile.mass*(this.applianceLightweight && APPLIANCE_TYPES.includes(type) ? 0.4 : 1);
      body.setAdditionalMass(0,true);
      for (let i=0;i<body.numColliders();i++) {
        body.collider(i).setMass(mass/body.numColliders());
      }
      body.recomputeMassPropertiesFromColliders();
      body.setLinearDamping(profile.linearDamping);
      body.setAngularDamping(profile.angularDamping);
      body.wakeUp();
    });
  }

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.scene = scene;
    this.physics = physics;
  }

  private getPrizeDimensions(prizeType: string): { radius: number; height: number } {
    if (LARGE_POKEMON_DIMENSIONS[prizeType]) return LARGE_POKEMON_DIMENSIONS[prizeType];
    switch (prizeType) {
      case 'pikachu': return { radius: 0.85, height: 1.95 };
      case 'squirtle': return { radius: 0.82, height: 1.7 };
      case 'bulbasaur': return { radius: 0.88, height: 1.65 };
      case 'tea_box': return { radius: 0.87, height: 2.18 };
      case 'fruit_box': return { radius: 0.98, height: 2.4 };
      case 'milk_box': return { radius: 0.52, height: 1.6 };
      case 'chiikawa':
        return { radius: 0.68, height: 1.4 };
      case 'kirby':
        return { radius: 0.60, height: 1.1 };
      case 'my_cat':
        return { radius: 0.56, height: 1.2 };
      case 'capybara':
      case 'ssr_golden_capybara':
        return { radius: 0.58, height: 0.9 };
      case 'dragonball':
      case 'onepiece':
        return { radius: 0.85, height: 1.95 };
      case 'mug_box':
        return { radius: 0.85, height: 1.63 };
      case 'cookie_box':
        return { radius: 0.88, height: 0.85 };
      case 'sanrio_bottle':
        return { radius: 0.45, height: 1.2 };
      case 'blindbox':
      case 'ssr_glowing_labubu':
        return { radius: 0.55, height: 1.17 };
      case 'snack_pack':
        return { radius: 0.46, height: 0.95 };
      case 'ps5':
      case 'switch':
      case 'dyson':
      case 'marshall':
      case 'lego':
      case 'giant_bear':
        return { radius: 0.95, height: 1.6 };
      default:
        return { radius: 0.60, height: 1.2 };
    }
  }

  private resolvePrizeType(typeFilter: string): string {
    if (typeFilter === 'charizard') return 'eevee';
    if (typeFilter === 'mixed') {
      const types = MIXED_PRIZE_TYPES;
      return types[Math.floor(Math.random() * types.length)];
    } else if (typeFilter === 'giant_appliances') {
      const types = APPLIANCE_TYPES;
      return types[Math.floor(Math.random() * types.length)];
    } else if (typeFilter === 'anime') {
      const types = ['dragonball', 'onepiece', 'blindbox', 'ssr_glowing_labubu'];
      return types[Math.floor(Math.random() * types.length)];
    }
    return typeFilter;
  }

  spawnPrizes(
    count = 16,
    typeFilter: string = 'mixed',
    spreadRadius: number = 5.2,
    chuteBounds?: { minX: number; maxX: number; minZ: number; maxZ: number }
  ) {
    this.clearPrizes();
    if (typeFilter === 'pokemon' || typeFilter === 'mixed') {
      const types = typeFilter === 'mixed' ? MIXED_PRIZE_TYPES : FEATURED_POKEMON_TYPES;
      const chuteClearance = Math.max(...types.map(type => this.getPrizeDimensions(type).radius))+0.12;
      const stockDimensions = (type:string) => {
        const scale=prizeStockScale(type,typeFilter),dimensions=this.getPrizeDimensions(type);
        return {radius:dimensions.radius*scale,height:dimensions.height*scale};
      };
      const stock=randomPrizeStock(count,types,spreadRadius,chuteBounds,Math.random,chuteClearance,stockDimensions);
      if (typeFilter === 'mixed' && count === 42) {
        stock.forEach((item,index) => {
          const timer=setTimeout(() => {
            this.pendingStock=this.pendingStock.filter(pending => pending !== timer);
            this.spawnModelPrize(item.x,Math.max(4.65,item.y+0.35),item.z,item.type,new THREE.Euler(item.rx,item.ry,item.rz),prizeStockScale(item.type,typeFilter));
          },index*105);
          this.pendingStock.push(timer);
        });
        return;
      }
      for (let index=0;index<stock.length;index++) {
        const item=stock[index];
        const dropY=Math.min(2.25,Math.max(item.y,1.35+(index%3)*0.12));
        this.spawnModelPrize(item.x,dropY,item.z,item.type,new THREE.Euler(item.rx,item.ry,item.rz),prizeStockScale(item.type,typeFilter));
        this.physics.prewarmSimulation(45);
      }
      this.physics.prewarmSimulation(120);
      return;
    }
    if (typeFilter === 'blindbox') {
      this.spawnStagedBlindBoxes(chuteBounds, count);
      return;
    }

    const cMinX = chuteBounds ? chuteBounds.minX : -4.5;
    const cMaxX = chuteBounds ? chuteBounds.maxX : -1.5;
    const cMinZ = chuteBounds ? chuteBounds.minZ : 1.5;
    const cMaxZ = chuteBounds ? chuteBounds.maxZ : 4.5;

    // Track placed prize footprints to guarantee non-overlapping positions
    const placed: { x: number; y: number; z: number; radius: number; height: number }[] = [];

    // Half span of playable machine floor
    const halfSpanX = spreadRadius * 0.72;
    const halfSpanZ = spreadRadius * 0.70;

    for (let i = 0; i < count; i++) {
      const prizeType = this.resolvePrizeType(typeFilter);
      const { radius, height } = this.getPrizeDimensions(prizeType);

      let bestX = 0;
      let bestZ = 0;
      let bestY = 999;
      let foundCandidate = false;

      // Search for candidate positions with minimal elevation / zero overlap
      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Bias slightly rearward to prevent items pressing against front glass
        const candX = (Math.random() * 2 - 1) * (halfSpanX - radius);
        const candZ = (Math.random() * 2 - 1) * (halfSpanZ - radius) - 0.25;

        // Skip if candidate falls within chute area (plus safety clearance)
        if (
          candX >= cMinX - radius - 0.25 &&
          candX <= cMaxX + radius + 0.25 &&
          candZ >= cMinZ - radius - 0.25 &&
          candZ <= cMaxZ + radius + 0.25
        ) {
          continue;
        }

        // Check horizontal overlap against previously placed prizes
        let highestUnderneath = 0.0;
        let hasHorizontalOverlap = false;

        for (const p of placed) {
          const dx = candX - p.x;
          const dz = candZ - p.z;
          const dist2D = Math.sqrt(dx * dx + dz * dz);
          const reqDist2D = radius + p.radius + 0.10; // 10cm safety gap between neighbor dolls

          if (dist2D < reqDist2D) {
            hasHorizontalOverlap = true;
            const topOfP = p.y + p.height * 0.5;
            if (topOfP > highestUnderneath) {
              highestUnderneath = topOfP;
            }
          }
        }

        let candY: number;
        if (!hasHorizontalOverlap) {
          // Bottom layer on floor pad: no dolls beneath
          candY = height * 0.5 + 0.08 + Math.random() * 0.05;
        } else {
          // Natural pile layer: spawn with clean clearance ABOVE highest underlying doll
          candY = highestUnderneath + height * 0.5 + 0.18 + Math.random() * 0.10;
        }

        if (candY < bestY) {
          bestY = candY;
          bestX = candX;
          bestZ = candZ;
          foundCandidate = true;

          // Found clean floor spot without any overlap: accept immediately!
          if (!hasHorizontalOverlap) {
            break;
          }
        }
      }

      if (!foundCandidate) {
        bestX = 1.0 + Math.random() * 1.5;
        bestZ = -1.0 + Math.random() * 1.5;
        bestY = 1.0 + Math.floor(i / 10) * 0.8;
      }

      this.spawnPrizeByType(bestX, bestY, bestZ, prizeType);
      placed.push({ x: bestX, y: bestY, z: bestZ, radius, height });
    }

    // Prewarm physics simulation: drops all stacked dolls and settles them into rock-solid, zero-penetration rest
    this.physics.prewarmSimulation(25);
  }

  spawnSinglePrize(x: number, y: number, z: number, prizeType: string) {
    this.spawnPrizeByType(x, y, z, prizeType);
  }

  spawnRandomPresetBarrier() {
    this.clearPrizes();
    const barrierTypes = ['mug_box', 'cookie_box', 'sanrio_bottle', 'onepiece'];
    this.spawnSinglePrize(-1.2, 1.2, 3.0, barrierTypes[Math.floor(Math.random() * barrierTypes.length)]);
    this.spawnSinglePrize(-3.0, 1.2, 1.2, barrierTypes[Math.floor(Math.random() * barrierTypes.length)]);

    const prizeList = ['chiikawa', 'dragonball', 'onepiece', 'mug_box', 'sanrio_bottle', 'cookie_box'];
    const placed: { x: number; y: number; z: number; radius: number; height: number }[] = [
      { x: -1.2, y: 1.2, z: 3.0, radius: 0.65, height: 1.3 },
      { x: -3.0, y: 1.2, z: 1.2, radius: 0.65, height: 1.3 }
    ];

    for (let i = 0; i < 16; i++) {
      const pType = prizeList[Math.floor(Math.random() * prizeList.length)];
      const { radius, height } = this.getPrizeDimensions(pType);
      let candX = 0, candZ = 0, candY = 1.0;
      for (let attempt = 0; attempt < 35; attempt++) {
        candX = (Math.random() - 0.3) * 4.5;
        candZ = (Math.random() - 0.5) * 5.0;
        let maxUnder = 0;
        let overlap = false;
        for (const p of placed) {
          const dist = Math.hypot(candX - p.x, candZ - p.z);
          if (dist < radius + p.radius + 0.1) {
            overlap = true;
            if (p.y + p.height * 0.5 > maxUnder) maxUnder = p.y + p.height * 0.5;
          }
        }
        candY = overlap ? maxUnder + height * 0.5 + 0.2 : height * 0.5 + 0.1;
        if (!overlap || attempt > 25) break;
      }
      this.spawnSinglePrize(candX, candY, candZ, pType);
      placed.push({ x: candX, y: candY, z: candZ, radius, height });
    }
    this.physics.prewarmSimulation(25);
  }

  private spawnPrizeByType(x: number, y: number, z: number, typeFilter: string) {
    const prizeType = this.resolvePrizeType(typeFilter);
    const aliases: Record<string,string> = {bear:'snorlax',cat:'eevee',chiikawa:'pikachu',capybara:'psyduck',kirby:'gengar',my_cat:'eevee',giant_bear:'snorlax',block:'dragonball',long_flat_box:'mug_box',long_bar:'sanrio_bottle',pouch:'cookie_box'};
    this.spawnModelPrize(x,y,z,aliases[prizeType] ?? prizeType);
  }

  private spawnModelPrize(x: number, y: number, z: number, type: string, rotation = new THREE.Euler(0,(Math.random()-0.5)*0.5,0), scale = 1) {
    const visual = instantiateModel(type);
    const plush = POKEMON_TYPES.includes(type);
    const sourceHull = plush ? collectHullPoints(visual) : null;
    const originalBounds = new THREE.Box3().setFromObject(visual);
    const size = originalBounds.getSize(new THREE.Vector3());
    const center = originalBounds.getCenter(new THREE.Vector3());
    const dims = this.getPrizeDimensions(type);
    const ratio = Math.min(dims.height / size.y, dims.radius * 2 / Math.max(size.x,size.z)) * scale;
    visual.scale.setScalar(ratio);
    visual.position.copy(center).multiplyScalar(-ratio);
    const group = new THREE.Group();
    group.userData.assetInstance = true;
    group.userData.prizeType = type;
    group.add(visual);
    group.position.set(x,y,z);
    group.rotation.copy(rotation);
    if (['tea_box','fruit_box','milk_box'].includes(type)) {
      visual.traverse(object => {
        if (object instanceof THREE.Mesh && object.name.startsWith('Label')) {
          const material = object.material as THREE.MeshStandardMaterial;
          material.map = cartonLabel(type,object.name);
          material.roughness = 0.72;
        }
      });
    }
    const body = this.makeDynBodyWithRotation(x,y,z,rotation.x,rotation.y,rotation.z);
    const half = size.multiplyScalar(ratio/2);
    const capsuleRadius = Math.min(half.x,half.y,half.z);
    let shape = RAPIER.ColliderDesc.cuboid(half.x,half.y,half.z);
    if (sourceHull) {
      shape=RAPIER.ColliderDesc.convexHull(centerAndScaleHullPoints(sourceHull,center,ratio))
        ?? RAPIER.ColliderDesc.capsule(Math.max(0,half.y-capsuleRadius),capsuleRadius);
    }
    const profile = prizePhysicsProfile(type,plush,this.weightMultiplier,this.rollingResistance);
    const mass = profile.mass*(this.applianceLightweight && APPLIANCE_TYPES.includes(type) ? 0.4 : 1);
    body.setLinearDamping(profile.linearDamping);
    body.setAngularDamping(profile.angularDamping);
    body.setSoftCcdPrediction(plush ? 0.12 : 0.06);
    body.setAdditionalSolverIterations(plush ? 4 : 2);
    shape.setMass(mass).setFriction(profile.friction).setRestitution(profile.restitution).setContactSkin(plush ? 0.025 : 0.012);
    this.physics.world.createCollider(shape,body);
    this.physics.registerBody(body,group);
    this.scene.add(group);
    this.prizes.push(group);
    this.bodies.push(body);
  }

  clearPrizes() {
    this.pendingStock.forEach(clearTimeout);
    this.pendingStock=[];
    this.onBeforeClear?.();
    this.prizes.forEach(p => { disposeModel(p); this.scene.remove(p); });
    this.bodies.forEach(b => { this.physics.unregisterBody(b); this.physics.world.removeRigidBody(b); });
    this.prizes = [];
    this.bodies = [];
  }

  private makeDynBodyWithRotation(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    const body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCcdEnabled(true)
        .setLinearDamping(0.25)
        .setAngularDamping(0.45)
    );
    body.enableCcd(true);
    return body;
  }

  private spawnSingleBlindBoxWithRotation(
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    seriesIdx?: number
  ) {
    this.spawnModelPrize(x,y,z,'blindbox',new THREE.Euler(rx,ry,rz));
  }

  // ── Taiwanese Claw Machine Realistic Staged Blind Box Arrangement (Matching Kujiflip 1:1) ──
  private spawnStagedBlindBoxes(
    chuteBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
    targetCount = 5
  ) {
    const cx = chuteBounds ? chuteBounds.maxX : -0.95;
    const cz = chuteBounds ? chuteBounds.minZ : 0.75;

    let boxIdx = 0;

    // 1. 大槍位盒 (Corner Tip Flip Box - Right at Acrylic Baffle Corner)
    this.spawnSingleBlindBoxWithRotation(cx + 0.28, 0.52, cz + 0.15, 0, 0.18, 0, boxIdx++);

    // 2. 側擋攻防盒 (Chute Side Guard - Lying along the right baffle)
    this.spawnSingleBlindBoxWithRotation(cx + 0.28, 0.32, cz + 0.95, 0, 0, Math.PI / 2, boxIdx++);

    // 3. 前排迎賓盒 (Center Front Feature Box - Standing upright facing player)
    this.spawnSingleBlindBoxWithRotation(0.35, 0.52, 0.95, 0, 0, 0, boxIdx++);

    // 4. 後排左展位盒 (Back-Left Showcase Box)
    this.spawnSingleBlindBoxWithRotation(-0.35, 0.52, -0.55, 0, 0.05, 0, boxIdx++);

    // 5. 後排右展位盒 (Back-Right Showcase Box)
    this.spawnSingleBlindBoxWithRotation(1.05, 0.52, -0.45, 0, -0.15, 0, boxIdx++);

    // If higher count requested in DIP settings, add extra rear fillers
    if (targetCount > 5) {
      const extraCount = Math.min(targetCount - 5, 8);
      for (let i = 0; i < extraCount; i++) {
        const ex = -0.5 + (i % 4) * 0.75;
        const ez = -1.25 - Math.floor(i / 4) * 0.75;
        this.spawnSingleBlindBoxWithRotation(ex, 0.52, ez, 0, (Math.random() - 0.5) * 0.1, 0, boxIdx++);
      }
    }
  }
}

