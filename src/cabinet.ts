import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';
import { instantiateModel, disposeModel } from './modelAssets';
import { CABINET_PALETTES, colorCabinetModel } from './cabinetPalette';
import { ElasticBed } from './elasticBed';
import { chuteWellWallSpecs, compactChuteBaffleSpans } from './chuteWell';

/**
 * 3D Arcade Claw Machine Cabinet
 * Modeled after Taiwanese Arcade & Online Claw Machines (e.g. 冠興 / 飛絡力 / 賞翻天 Kujiflip)
 * - Authentic textured non-slip playfield liner (菱格/防滑紋理底墊)
 * - Chute with acrylic baffle, safety bumper trim tube (防撞膠條) & metal corner clamp
 * - Slanted slide ramp inside prize chute (出貨導流滑梯)
 * - Back wall radiant arcade sunburst backdrop / mirror
 * - Vertical LED pillar glow bars
 * - Dynamic physical resizing across 4 scales (Small 7.6m, Medium 10.0m, Large 12.0m, K-Pa 14.6m)
 */
export class Cabinet {
  public mesh: THREE.Group;
  public width = 10.0;
  public depth = 10.0;
  public height = 8.5;

  public chuteMinX = -4.5;
  public chuteMaxX = -1.5;
  public chuteMinZ = 1.5;
  public chuteMaxZ = 4.5;
  public chuteWallHeight = 0.5;
  public playfieldScale = 1;
  public compactStage8 = false;
  public floorY = 0;
  private stageEightFeltTex: THREE.CanvasTexture | null = null;

  // Drop Target Indicator
  public dropIndicatorGroup: THREE.Group;
  private outerRing!: THREE.Mesh;
  private innerCircle!: THREE.Mesh;

  // Interactive 3D Joystick and Action Button
  public joystickGroup: THREE.Group;
  public joystickBall!: THREE.Mesh;
  public actionButtonMesh!: THREE.Mesh;

  public baffleGroup: THREE.Group;
  private baffleBodies: RAPIER.RigidBody[] = [];
  public staticBodies: RAPIER.RigidBody[] = [];

  public bodyMat!: THREE.MeshStandardMaterial;
  public bodyDarkMat!: THREE.MeshStandardMaterial;
  public accentMat!: THREE.MeshStandardMaterial;
  public baffleMat!: THREE.MeshStandardMaterial;
  public neonBorderMat!: THREE.MeshStandardMaterial;

  public floorMatTex!: THREE.CanvasTexture;
  public bounceFloor = false;
  public elasticBed?: ElasticBed;
  private bounceClothTex?: THREE.CanvasTexture;
  public backdropCanvas!: HTMLCanvasElement;
  public backdropTex!: THREE.CanvasTexture;
  public marqueeCanvas!: HTMLCanvasElement;
  public marqueeTex!: THREE.CanvasTexture;

  private currentTheme: string = 'medium';
  private modelRoot?: THREE.Group;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.mesh = new THREE.Group();
    this.dropIndicatorGroup = new THREE.Group();
    this.baffleGroup = new THREE.Group();
    this.joystickGroup = new THREE.Group();

    // 1. Crystal Clear Acrylic Chute Baffle Material
    this.baffleMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      opacity: 0.35,
      transparent: true,
      roughness: 0.02,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    // 2. Safety Bumper Trim Material (防撞膠條 / 螢光護邊條)
    this.neonBorderMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.85,
      roughness: 0.3
    });

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.1,
      roughness: 0.25
    });

    this.bodyDarkMat = new THREE.MeshStandardMaterial({
      color: 0xe6b800,
      metalness: 0.1,
      roughness: 0.3
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.2,
      roughness: 0.2
    });

    // 3. Create Textured Anti-Slip Floor Mat Texture (Matching Kujiflip / Taiwanese Arcades)
    this.floorMatTex = this.createFloorMatTex();

    // 4. Create Radiant Backdrop Texture
    this.backdropCanvas = document.createElement('canvas');
    this.backdropCanvas.width = 1024;
    this.backdropCanvas.height = 1024;
    this.backdropTex = new THREE.CanvasTexture(this.backdropCanvas);

    // 5. Marquee Canvas
    this.marqueeCanvas = document.createElement('canvas');
    this.marqueeCanvas.width = 1024;
    this.marqueeCanvas.height = 256;
    this.marqueeTex = new THREE.CanvasTexture(this.marqueeCanvas);

    this.updateMarqueeText('賭博就是不歸路', '', '#fef08a', '#f59e0b', '#101014');
    this.updateBackdrop('small');

    this.build(physics);
    scene.add(this.mesh);
  }

  // ── Authentic Arcade Non-Slip Playfield Mat Texture ──
  private createFloorMatTex(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    // Light woven liner keeps prizes and the chute edge readable under cabinet lighting.
    ctx.fillStyle = '#a4b2b6';
    ctx.fillRect(0, 0, 512, 512);

    // Fine woven crosshatch grid lines
    for (let i = 0; i < 512; i += 8) {
      ctx.fillStyle = (i % 16 === 0) ? 'rgba(255, 255, 255, 0.13)' : 'rgba(31, 52, 60, 0.11)';
      ctx.fillRect(i, 0, 3, 512);
      ctx.fillRect(0, i, 512, 3);
    }

    // Anti-slip rubber grip micro-dots
    for (let i = 0; i < 220; i++) {
      const radius = 2.5 + (i % 4) * 1.5;
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(31, 52, 60, 0.09)';
      ctx.beginPath();
      ctx.arc((i * 113) % 512, (i * 227) % 512, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  }

  // ── Arcade Japanese Prize Machine Backdrop (Matching Kujiflip 1:1) ──
  public updateBackdrop(theme: string) {
    this.drawReferenceBackdrop(theme);
  }

  private drawReferenceBackdrop(theme: string) {
    if (!this.backdropCanvas) return;
    const ctx = this.backdropCanvas.getContext('2d');
    if (!ctx) return;

    let mainTitle = '賭博就是不歸路';
    let subTitle = '景品コーナー';
    let enTitle = 'PRIZE MACHINE';
    let accentHex = '#f59e0b';
    let bgTop = '#141c2b';
    let bgBot = '#0c111a';

    if (theme === 'large' || theme === 'anime') {
      mainTitle = '賭博就是不歸路';
      subTitle = 'フィギュアコーナー';
      enTitle = 'ANIME MASTERPIECE';
      accentHex = '#fbbf24';
    } else if (theme === 'kbasket') {
      mainTitle = '賭博就是不歸路';
      subTitle = '超巨大景品專區';
      enTitle = 'MEGA CLAW MACHINE';
      accentHex = '#ef4444';
      bgTop = '#1c0d12';
      bgBot = '#0f0508';
    } else {
      mainTitle = '賭博就是不歸路';
      subTitle = '謹慎理財 · 遠離沉迷';
      enTitle = 'PRIZE MACHINE';
      accentHex = '#f59e0b';
    }

    // Deep slate navy background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    bgGrad.addColorStop(0, bgTop);
    bgGrad.addColorStop(1, bgBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle dark radial vignette
    const vig = ctx.createRadialGradient(512, 480, 50, 512, 480, 480);
    vig.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 1024, 1024);

    // Outer Framed Box (Gold double-border)
    const fx = 100, fy = 120, fw = 824, fh = 640;
    ctx.fillStyle = 'rgba(10, 15, 24, 0.65)';
    ctx.fillRect(fx, fy, fw, fh);

    // Outer gold rim
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.strokeRect(fx, fy, fw, fh);

    // Inner gold fine line
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(fx + 12, fy + 12, fw - 24, fh - 24);

    // Main Gold Title: 賭博就是不歸路
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fef08a';
    const mainFontSize = mainTitle.length > 5 ? 70 : 92;
    ctx.font = `900 ${mainFontSize}px "Hiragino Kaku Gothic Pro", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(mainTitle, 512, fy + 240);

    // Japanese Subtitle: 景品コーナー
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 10;
    ctx.fillStyle = accentHex;
    ctx.font = 'bold 44px "Hiragino Kaku Gothic Pro", "Microsoft JhengHei", sans-serif';
    ctx.fillText(subTitle, 512, fy + 340);

    // English Subtitle: PRIZE MACHINE
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 28px "Arial Black", sans-serif';
    ctx.fillText(enTitle, 512, fy + 410);

    // Decorative divider line with diamond
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx + 180, fy + 460);
    ctx.lineTo(fx + fw - 180, fy + 460);
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(512, fy + 460, 6, 0, Math.PI * 2);
    ctx.fill();

    if (this.backdropTex) this.backdropTex.needsUpdate = true;
  }

  public rebuildCabinet(mode: string, physics: PhysicsSystem) {
    this.currentTheme = mode;
    this.elasticBed?.dispose();
    this.elasticBed = undefined;
    if (this.modelRoot) disposeModel(this.modelRoot);
    this.disposeBaffleMeshes();

    // 1. Remove all static rigid bodies from physics world
    this.staticBodies.forEach(b => {
      if (physics && physics.world) {
        physics.unregisterBody(b);
        physics.world.removeRigidBody(b);
      }
    });
    this.staticBodies = [];

    this.baffleBodies.forEach(b => {
      if (physics && physics.world) {
        physics.unregisterBody(b);
        physics.world.removeRigidBody(b);
      }
    });
    this.baffleBodies = [];

    // 2. Clear Three.js meshes
    for (const child of this.mesh.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }
    while (this.baffleGroup.children.length > 0) {
      this.baffleGroup.remove(this.baffleGroup.children[0]);
    }
    while (this.dropIndicatorGroup.children.length > 0) {
      this.dropIndicatorGroup.remove(this.dropIndicatorGroup.children[0]);
    }
    while (this.joystickGroup.children.length > 0) {
      this.joystickGroup.remove(this.joystickGroup.children[0]);
    }

    // 3. Set machine dimensions (Authentic Taiwanese Street Claw Machine Aspect Ratios)
    if (mode === 'sanrio' || mode === 'small') {
      // 小型機台 (真實標準街機比例 寬6.0m x 深5.2m x 櫥窗高6.0m, 底座高5.0m)
      this.width = 5.3;
      this.depth = 4.6;
      this.height = 6.0;
      this.chuteMinX = -2.38;
      this.chuteMaxX = -0.83;
      this.chuteMinZ = 0.55;
      this.chuteMaxZ = 1.98;
    } else if (mode === 'anime' || mode === 'large') {
      // 中大機台 (寬闊修長大型機台)
      this.width = 8.8;
      this.depth = 7.6;
      this.height = 7.4;
      this.chuteMinX = -4.00;
      this.chuteMaxX = -1.35;
      this.chuteMinZ = 1.10;
      this.chuteMaxZ = 3.45;
    } else if (mode === 'kbasket') {
      // K-霸機台 (超巨無霸直立機台)
      this.width = 11.2;
      this.depth = 9.8;
      this.height = 8.4;
      this.chuteMinX = -5.10;
      this.chuteMaxX = -1.70;
      this.chuteMinZ = 1.45;
      this.chuteMaxZ = 4.45;
    } else {
      // Standard medium (標準街機黃金比例)
      this.width = 7.4;
      this.depth = 6.4;
      this.height = 6.6;
      this.chuteMinX = -3.30;
      this.chuteMaxX = -1.10;
      this.chuteMinZ = 0.85;
      this.chuteMaxZ = 2.85;
    }
    if (this.compactStage8) {
      this.width = 4.8;
      this.depth = 4.16;
      this.height = 4.9;
      this.chuteMinX = -2.14;
      this.chuteMaxX = -0.71;
      this.chuteMinZ = 0.55;
      this.chuteMaxZ = 1.85;
    }
    this.floorY = this.compactStage8 ? 0.8 : 0;
    if (this.playfieldScale !== 1) {
      this.chuteMinX *= this.playfieldScale;
      this.chuteMaxX *= this.playfieldScale;
      this.chuteMinZ *= this.playfieldScale;
      this.chuteMaxZ *= this.playfieldScale;
    }

    // 4. Update theme materials & backdrop
    this.setTheme(mode);
    this.updateBackdrop(mode);

    // 5. Rebuild visual meshes & physics
    this.build(physics);
  }

  private build(physics: PhysicsSystem) {
    this.buildReferenceCabinet(physics);
  }

  private buildReferenceCabinet(physics: PhysicsSystem) {
    const root = instantiateModel('cabinet');
    this.modelRoot = root;
    const palette = CABINET_PALETTES[this.currentTheme as keyof typeof CABINET_PALETTES] ?? CABINET_PALETTES.medium;
    colorCabinetModel(root, palette);
    const sx = this.width / 7.4, sy = this.height / 6.6, sz = this.depth / 6.4;
    root.scale.set(sx, sy, sz);
    this.mesh.add(root, this.baffleGroup, this.dropIndicatorGroup);
    this.joystickGroup = root.getObjectByName('JoystickPivot') as THREE.Group;
    this.joystickBall = root.getObjectByName('JoystickKnob') as THREE.Mesh;
    this.actionButtonMesh = root.getObjectByName('ActionButton') as THREE.Mesh;
    const sign = root.getObjectByName('BackSign') as THREE.Mesh;
    (sign.material as THREE.Material).dispose();
    sign.material = new THREE.MeshBasicMaterial({map:this.backdropTex,toneMapped:false});
    this.backdropTex.anisotropy = 8;
    // The GLB's solid base has a top face directly beneath the chute; replace it
    // with an open shell so prizes visibly enter the same hole used by physics.
    const solidBase = root.getObjectByName('BaseCabinet') as THREE.Mesh;
    solidBase.visible = false;
    const steelTexture = this.floorMatTex;
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name.startsWith('Glass')) {
        (object.material as THREE.Material).dispose();
        object.material = new THREE.MeshBasicMaterial({color:0x92dcdf,transparent:true,opacity:0.018,depthWrite:false});
        return;
      }
      const material = object.material as THREE.MeshStandardMaterial;
      if(object.name.startsWith('Floor')) {
        material.color.set(0xe6eeee);
        material.map=this.floorMatTex;
        material.bumpMap=this.floorMatTex;
        material.bumpScale=0.012;
        material.roughness=0.82;
      }
      if (material.name === 'PowderCoatedSteel') {
        material.bumpMap = steelTexture;
        material.bumpScale = 0.018;
      }
    });
    const addCollider = (size: number[], pos: number[], friction = 0.45) => {
      const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]));
      const shape = RAPIER.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setFriction(friction).setRestitution(0.02);
      physics.world.createCollider(shape, body);
      this.staticBodies.push(body);
    };
    const halfW = this.width * this.playfieldScale / 2, halfD = this.depth * this.playfieldScale / 2;
    const baseHeight = 2.65 * sy;
    const baseY = -1.58 * sy;
    const shellMaterial = new THREE.MeshStandardMaterial({ color: palette.base, metalness: 0.32, roughness: 0.48 });
    const wellMaterial = new THREE.MeshStandardMaterial({ color: palette.panel, metalness: 0.12, roughness: 0.7 });
    const rimMaterial = new THREE.MeshStandardMaterial({ color: palette.trim, metalness: 0.55, roughness: 0.32 });
    const addVisualBox = (name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.name = name;
      mesh.position.set(...position);
      mesh.receiveShadow = true;
      this.mesh.add(mesh);
    };
    const shellThickness = 0.12;
    for (const x of [-halfW, halfW]) addVisualBox('BaseSide', [shellThickness, baseHeight, this.depth], [x, baseY, 0], shellMaterial);
    for (const z of [-halfD, halfD]) addVisualBox('BaseFace', [this.width, baseHeight, shellThickness], [0, baseY, z], shellMaterial);
    const chuteW = this.chuteMaxX - this.chuteMinX;
    const chuteD = this.chuteMaxZ - this.chuteMinZ;
    const chuteX = (this.chuteMinX + this.chuteMaxX) / 2;
    const chuteZ = (this.chuteMinZ + this.chuteMaxZ) / 2;
    const wellDepth = Math.min(2.3, baseHeight * 0.88);
    for (const wall of chuteWellWallSpecs({
      minX:this.chuteMinX,maxX:this.chuteMaxX,minZ:this.chuteMinZ,maxZ:this.chuteMaxZ
    },this.floorY,wellDepth,this.compactStage8 ? 0.12 : 0.07)) {
      if (wall.name === 'ChuteWellFront' && !this.compactStage8) continue;
      addVisualBox(wall.name,wall.size,wall.position,wellMaterial);
      if (this.compactStage8) addCollider(wall.size,wall.position,0.55);
    }
    // These two exposed edges frame the opening; the opposite edges already have baffles.
    addVisualBox('ChuteLipLeft', [0.055, 0.035, chuteD], [this.chuteMinX, this.floorY+0.018, chuteZ], rimMaterial);
    addVisualBox('ChuteLipFront', [chuteW, 0.035, 0.055], [chuteX, this.floorY+0.018, this.chuteMaxZ], rimMaterial);
    const sections: [string, number, number, number, number][] = [
      ['FloorRight', this.chuteMaxX, halfW, -halfD, halfD],
      ['FloorBack', -halfW, this.chuteMaxX, -halfD, this.chuteMinZ],
      ['FloorLeft', -halfW, this.chuteMinX, this.chuteMinZ, halfD],
      ['FloorFront', this.chuteMinX, this.chuteMaxX, this.chuteMaxZ, halfD]
    ];
    for (const [name,minX,maxX,minZ,maxZ] of sections) {
      const w = maxX-minX, d = maxZ-minZ;
      const floor = root.getObjectByName(name) as THREE.Mesh;
      floor.scale.set(w/sx,0.3/sy,d/sz);
      floor.position.set((minX+maxX)/2/sx,(this.floorY-0.15)/sy,(minZ+maxZ)/2/sz);
      const mat = floor.material as THREE.MeshStandardMaterial;
      if (this.bounceFloor && !this.bounceClothTex) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#17242b'; ctx.fillRect(0,0,256,256);
        for (let i=0;i<256;i+=8) {
          ctx.fillStyle = '#334048'; ctx.fillRect(i,0,3,256);
          ctx.fillStyle = '#233239'; ctx.fillRect(0,i,256,3);
        }
        this.bounceClothTex = new THREE.CanvasTexture(canvas);
        this.bounceClothTex.colorSpace = THREE.SRGBColorSpace;
        this.bounceClothTex.wrapS=this.bounceClothTex.wrapT=THREE.RepeatWrapping;
        this.bounceClothTex.repeat.set(3,3);
        this.bounceClothTex.anisotropy=8;
      }
      if (this.compactStage8 && !this.stageEightFeltTex) {
        const felt = document.createElement('canvas'); felt.width = felt.height = 128;
        const ctx = felt.getContext('2d')!;
        ctx.fillStyle = '#376d4b'; ctx.fillRect(0,0,128,128);
        for (let i=0;i<1100;i++) {
          ctx.fillStyle = i%3 ? 'rgba(190,231,158,0.12)' : 'rgba(6,42,33,0.16)';
          ctx.fillRect((i*73)%128,(i*47)%128,1,2);
        }
        this.stageEightFeltTex = new THREE.CanvasTexture(felt);
        this.stageEightFeltTex.colorSpace = THREE.SRGBColorSpace;
        this.stageEightFeltTex.wrapS = this.stageEightFeltTex.wrapT = THREE.RepeatWrapping;
        this.stageEightFeltTex.repeat.set(3,3);
      }
      mat.map = this.bounceFloor ? this.bounceClothTex! : this.compactStage8 ? this.stageEightFeltTex : this.floorMatTex;
      mat.bumpMap = mat.map;
      mat.bumpScale = this.bounceFloor ? 0.025 : this.compactStage8 ? 0.012 : 0.005;
      if (this.bounceFloor) { mat.color.setHex(0xffffff); mat.metalness = 0; mat.roughness = 0.95; }
      if (this.compactStage8) { mat.color.setHex(0xffffff); mat.metalness = 0; mat.roughness = 0.94; }
      mat.needsUpdate = true;
      if (this.bounceFloor) floor.visible=false;
      else addCollider([w,0.3,d],[(minX+maxX)/2,this.floorY-0.15,(minZ+maxZ)/2],0.65);
    }
    if (this.bounceFloor) {
      const material=new THREE.MeshStandardMaterial({map:this.bounceClothTex,roughness:0.95,side:THREE.DoubleSide});
      this.elasticBed=new ElasticBed(physics.world,sections,material);
      for(const mesh of this.elasticBed.meshes) this.mesh.add(mesh);
    }
    for (const x of [-this.width/2,this.width/2]) addCollider([0.12,this.height,this.depth],[x,this.height/2,0]);
    for (const z of [-this.depth/2,this.depth/2]) addCollider([this.width,this.height,0.12],[0,this.height/2,z]);
    if (this.playfieldScale !== 1) {
      const insetMaterial = new THREE.MeshStandardMaterial({color:palette.trim,metalness:0.5,roughness:0.42});
      const insetGlass = new THREE.MeshBasicMaterial({color:0x9defff,transparent:true,opacity:0.06,depthWrite:false,side:THREE.DoubleSide});
      for (const x of [-halfW,halfW]) {
        addVisualBox('PlayfieldSideRail',[0.09,0.08,halfD*2],[x,0.04,0],insetMaterial);
        addVisualBox('PlayfieldSideGlass',[0.025,3,halfD*2],[x,1.5,0],insetGlass);
        addCollider([0.09,3,halfD*2],[x,1.5,0]);
      }
      for (const z of [-halfD,halfD]) {
        addVisualBox('PlayfieldEndRail',[halfW*2,0.08,0.09],[0,0.04,z],insetMaterial);
        addVisualBox('PlayfieldEndGlass',[halfW*2,3,0.025],[0,1.5,z],insetGlass);
        addCollider([halfW*2,3,0.09],[0,1.5,z]);
      }
    }
    addCollider([this.width,0.15,this.depth],[0,this.height+0.075,0]);
    this.rebuildBaffles(this.chuteWallHeight, physics);
    if (!this.outerRing) {
      const guideMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      this.outerRing = new THREE.Mesh(new THREE.RingGeometry(0.46,0.52,48),guideMaterial);
      this.outerRing.rotation.x = -Math.PI/2;
      this.innerCircle = new THREE.Mesh(new THREE.CircleGeometry(0.09,32),guideMaterial);
      this.innerCircle.rotation.x = -Math.PI/2;
    }
    this.dropIndicatorGroup.add(this.outerRing,this.innerCircle);
    root.updateMatrixWorld(true);
  }

  /* ── Dynamic Chute Baffle Height & Guard Rail Update ── */
  public setBaffleHeight(height: number, physics: PhysicsSystem) {
    this.chuteWallHeight = Math.max(0, Math.min(3.0, height));
    this.rebuildBaffles(this.chuteWallHeight, physics);
  }

  private rebuildBaffles(height: number, physics: PhysicsSystem) {
    this.disposeBaffleMeshes();
    // Clear old visual baffle meshes & physics rigidbodies
    while (this.baffleGroup.children.length > 0) {
      const child = this.baffleGroup.children[0];
      this.baffleGroup.remove(child);
    }
    this.baffleBodies.forEach(b => {
      if (physics && physics.world) {
        physics.unregisterBody(b);
        physics.world.removeRigidBody(b);
      }
    });
    this.baffleBodies = [];
    if (height === 0) return;

    const wallThick = this.compactStage8 ? 0.18 : 0.08;
    const chuteW = this.chuteMaxX - this.chuteMinX;
    const chuteD = this.chuteMaxZ - this.chuteMinZ;
    const chuteCenterX = (this.chuteMinX + this.chuteMaxX) / 2;
    const chuteCenterZ = (this.chuteMinZ + this.chuteMaxZ) / 2;

    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });

    const addBaffleWall = (w: number, d: number, x: number, z: number, isRightWall: boolean) => {
      const geo = new THREE.BoxGeometry(w, height, d);
      const mesh = new THREE.Mesh(geo, this.baffleMat);
      mesh.position.set(x, this.floorY+height / 2, z);
      this.baffleGroup.add(mesh);

      // Rounded Safety Bumper Trim Tube (防撞膠條 / 護邊圓條)
      const len = isRightWall ? d : w;
      const bumperGeo = new THREE.CylinderGeometry(0.045, 0.045, len, 16);
      const bumperMesh = new THREE.Mesh(bumperGeo, this.neonBorderMat);
      if (isRightWall) {
        bumperMesh.rotation.x = Math.PI / 2;
      } else {
        bumperMesh.rotation.z = Math.PI / 2;
      }
      bumperMesh.position.set(x, this.floorY+height + 0.02, z);
      this.baffleGroup.add(bumperMesh);

      if (physics && physics.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, this.floorY+height / 2, z);
        const body = physics.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(w / 2, height / 2, d / 2)
          .setFriction(this.compactStage8 ? 0.5 : 0.1)
          .setRestitution(0.2);
        physics.world.createCollider(colDesc, body);
        this.baffleBodies.push(body);
      }
    };

    // On the compact playfield, join both baffles to the inset rails so a box
    // cannot slip around an exposed end and appear to pass through the wall.
    const halfW = this.width * this.playfieldScale / 2;
    const halfD = this.depth * this.playfieldScale / 2;
    const spans = this.compactStage8 ? compactChuteBaffleSpans({
      minX:this.chuteMinX,maxX:this.chuteMaxX,minZ:this.chuteMinZ,maxZ:this.chuteMaxZ
    },halfW,halfD) : null;
    addBaffleWall(wallThick, spans?.right.length ?? chuteD,
      this.chuteMaxX, spans?.right.center ?? chuteCenterZ, true);
    addBaffleWall(spans?.back.length ?? chuteW, wallThick,
      spans?.back.center ?? chuteCenterX, this.chuteMinZ, false);

    // Chrome Metal Corner Bracket Post (金屬固定角柱)
    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, height + 0.08, 16);
    const postMesh = new THREE.Mesh(postGeo, chromeMat);
    postMesh.position.set(this.chuteMaxX, this.floorY+(height + 0.08) / 2, this.chuteMinZ);
    this.baffleGroup.add(postMesh);
  }

  // Update target indicator position
  private disposeBaffleMeshes() {
    this.baffleGroup.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (object.material !== this.baffleMat && object.material !== this.neonBorderMat) {
        (object.material as THREE.Material).dispose();
      }
    });
    this.baffleGroup.clear();
  }

  public updateIndicator(x: number, z: number, y: number = 0.05) {
    this.dropIndicatorGroup.position.set(x, this.floorY+0.05, z);
    this.dropIndicatorGroup.visible = x < this.chuteMinX || x > this.chuteMaxX || z < this.chuteMinZ || z > this.chuteMaxZ;
  }

  // Tilt 3D Joystick
  public setJoystickTilt(tiltX: number, tiltZ: number) {
    const maxTilt = 0.35; // ~20 degrees max tilt
    this.joystickGroup.rotation.z = -tiltX * maxTilt;
    this.joystickGroup.rotation.x = tiltZ * maxTilt;
  }

  public updateMarqueeText(mainTitle: string, subTitle: string, textColor: string, shadowColor: string, bgHex: string) {
    if (!this.marqueeCanvas) return;
    const mctx = this.marqueeCanvas.getContext('2d');
    if (!mctx) return;

    mctx.fillStyle = bgHex;
    mctx.fillRect(0, 0, 1024, 256);

    // Glowing Neon Rounded Border
    mctx.strokeStyle = shadowColor;
    mctx.lineWidth = 14;
    mctx.shadowColor = shadowColor;
    mctx.shadowBlur = 18;
    mctx.beginPath();
    mctx.roundRect(24, 24, 976, 208, 36);
    mctx.stroke();
    mctx.shadowBlur = 0;

    // Golden Main Big Title: 賭博就是不歸路
    mctx.fillStyle = textColor;
    const fontSize = mainTitle.length > 5 ? 84 : 108;
    mctx.font = `900 ${fontSize}px "Hiragino Kaku Gothic Pro", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.shadowColor = shadowColor;
    mctx.shadowBlur = 18;
    mctx.fillText(mainTitle, 512, 128);
    mctx.shadowBlur = 0;

    if (this.marqueeTex) this.marqueeTex.needsUpdate = true;
  }

  // Dynamic Theme Switching for 4 Machine Types
  public setTheme(theme: string) {
    const palette = CABINET_PALETTES[theme as keyof typeof CABINET_PALETTES] ?? CABINET_PALETTES.medium;
    this.bodyMat.color.setHex(palette.shell);
    this.bodyDarkMat.color.setHex(palette.base);
    this.accentMat.color.setHex(palette.trim);
    this.baffleMat.color.setHex(0xf2faf4);
    this.baffleMat.opacity = 0.14;
    this.baffleMat.depthWrite = false;
    this.neonBorderMat.color.setHex(palette.trim);
    this.neonBorderMat.emissive.setHex(palette.trim);
    this.neonBorderMat.emissiveIntensity = 0.22;
    this.updateMarqueeText('賭博就是不歸路', '', '#ffffff', '#26343d', '#27333c');
  }
}
