import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsSystem } from './physics';

export class PrizesManager {
  public prizes: THREE.Object3D[] = [];
  public bodies: RAPIER.RigidBody[] = [];
  private scene: THREE.Scene;
  private physics: PhysicsSystem;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.scene = scene;
    this.physics = physics;
  }

  spawnPrizes(count = 40, typeFilter: string = 'mixed') {
    this.clearPrizes();
    for (let i = 0; i < count; i++) {
      let x = (Math.random() - 0.5) * 7.2;
      let z = (Math.random() - 0.5) * 7.2;
      if (x < -1.2 && z > 1.2) x += 3.2;
      const tier = Math.floor(i / 12);
      const heightOffset = Math.max(0, (z < 0 ? -z * 0.25 : 0));
      const y = 0.8 + tier * 0.75 + heightOffset + (Math.random() * 0.2);
      this.spawnPrizeByType(x, y, z, typeFilter);
    }
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
    for (let i = 0; i < 16; i++) {
      const rx = (Math.random() - 0.3) * 4.5;
      const rz = (Math.random() - 0.5) * 5.0;
      const ry = 1.0 + (i % 3) * 1.2;
      this.spawnSinglePrize(rx, ry, rz, prizeList[Math.floor(Math.random() * prizeList.length)]);
    }
  }

  private spawnPrizeByType(x: number, y: number, z: number, typeFilter: string) {
    let prizeType = typeFilter;
    if (typeFilter === 'mixed') {
      const types = ['chiikawa', 'dragonball', 'onepiece', 'mug_box', 'sanrio_bottle', 'cookie_box', 'my_cat', 'chiikawa', 'my_cat'];
      prizeType = types[Math.floor(Math.random() * types.length)];
    }
    switch (prizeType) {
      case 'chiikawa':    this.spawnChiikawa(x, y, z); break;
      case 'dragonball':  this.spawnDragonBallBox(x, y, z); break;
      case 'onepiece':    this.spawnOnePieceBox(x, y, z); break;
      case 'mug_box':     this.spawnMugBox(x, y, z); break;
      case 'sanrio_bottle': this.spawnSanrioBottle(x, y, z); break;
      case 'cookie_box':  this.spawnCookieBox(x, y, z); break;
      case 'my_cat':      this.spawnCalicoCat(x, y, z); break;
      // legacy
      case 'bear': case 'cat': this.spawnChiikawa(x, y, z); break;
      case 'block': this.spawnDragonBallBox(x, y, z); break;
      case 'long_flat_box': this.spawnMugBox(x, y, z); break;
      case 'long_bar': this.spawnSanrioBottle(x, y, z); break;
      case 'pouch': this.spawnCookieBox(x, y, z); break;
      default: this.spawnChiikawa(x, y, z); break;
    }
  }

  clearPrizes() {
    this.prizes.forEach(p => this.scene.remove(p));
    this.bodies.forEach(b => { this.physics.unregisterBody(b); this.physics.world.removeRigidBody(b); });
    this.prizes = [];
    this.bodies = [];
  }

  // ── Helper: make a canvas texture ──────────────────────────────
  private makeCanvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    return new THREE.CanvasTexture(c);
  }

  // ── Helper: create dynamic rigid body ──────────────────────────
  private makeDynBody(x: number, y: number, z: number) {
    return this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z)
        .setCcdEnabled(true).setLinearDamping(0.35).setAngularDamping(1.8)
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  🐾  CHIIKAWA  (吉依卡哇) — Accurate round white plush doll
  //  Reference: white round body, tiny round ears, large black eyes
  //  with white highlight, pink oval cheeks, tiny nose dot
  // ══════════════════════════════════════════════════════════════
  private spawnChiikawa(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Character variants: Chiikawa (white), Hachiware (blue stripe), Usagi (yellow+long ears)
    const charIdx = Math.floor(Math.random() * 3);
    const bodyColor  = [0xf5f5f0, 0xe8eef8, 0xfff3b0][charIdx];
    const cheekColor = 0xffb3ba;

    const bodyMat  = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85, metalness: 0 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const cheekMat = new THREE.MeshStandardMaterial({ color: cheekColor, roughness: 0.9, transparent: true, opacity: 0.75 });
    const noseMat  = new THREE.MeshStandardMaterial({ color: 0xcc7788, roughness: 0.8 });

    // ── Body (big round, slightly flattened at bottom) ──
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 20), bodyMat);
    body.scale.set(1, 0.95, 1);
    body.castShadow = true;
    group.add(body);

    // ── Head (seamlessly joins body at top) ──
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 20), bodyMat);
    head.position.set(0, 0.56, 0);
    head.castShadow = true;
    group.add(head);

    // ── Hachiware blue stripe on forehead ──
    if (charIdx === 1) {
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x6699cc, roughness: 0.8 });
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.06), stripeMat);
      sl.position.set(-0.08, 0.7, 0.3);
      sl.rotation.z = 0.15;
      group.add(sl);
      const sr = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.06), stripeMat);
      sr.position.set(0.08, 0.7, 0.3);
      sr.rotation.z = -0.15;
      group.add(sr);
    }

    // ── Ears: Chiikawa/Hachiware=small round, Usagi=long rabbit ──
    if (charIdx === 2) {
      // Usagi long rabbit ears
      const earMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85 });
      const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xffccd5, roughness: 0.9 });
      const le = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.38, 6, 10), earMat);
      le.position.set(-0.22, 1.08, 0); le.rotation.z = 0.15;
      const re = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.38, 6, 10), earMat);
      re.position.set(0.22, 1.08, 0); re.rotation.z = -0.15;
      const li = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 6, 8), innerEarMat);
      li.position.set(-0.22, 1.08, 0.04); li.rotation.z = 0.15;
      const ri = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 6, 8), innerEarMat);
      ri.position.set(0.22, 1.08, 0.04); ri.rotation.z = -0.15;
      group.add(le, re, li, ri);
    } else {
      // Small round ears
      const le = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), bodyMat);
      le.position.set(-0.3, 0.88, 0);
      const re = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), bodyMat);
      re.position.set(0.3, 0.88, 0);
      group.add(le, re);
    }

    // ── Large eyes: white sclera + big black iris + small shine ──
    const eyeW = new THREE.SphereGeometry(0.085, 14, 14);
    const lew = new THREE.Mesh(eyeW, whiteMat); lew.position.set(-0.145, 0.64, 0.33);
    const rew = new THREE.Mesh(eyeW, whiteMat); rew.position.set(0.145, 0.64, 0.33);
    group.add(lew, rew);

    const eyeB = new THREE.SphereGeometry(0.068, 14, 14);
    const leb = new THREE.Mesh(eyeB, blackMat); leb.position.set(-0.145, 0.64, 0.37);
    const reb = new THREE.Mesh(eyeB, blackMat); reb.position.set(0.145, 0.64, 0.37);
    group.add(leb, reb);

    // Eye glint
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glintG = new THREE.SphereGeometry(0.024, 6, 6);
    const lg = new THREE.Mesh(glintG, glintMat); lg.position.set(-0.13, 0.655, 0.41);
    const rg = new THREE.Mesh(glintG, glintMat); rg.position.set(0.157, 0.655, 0.41);
    group.add(lg, rg);

    // ── Pink oval cheeks ──
    const cheekG = new THREE.SphereGeometry(0.075, 10, 10);
    const lc = new THREE.Mesh(cheekG, cheekMat); lc.position.set(-0.245, 0.588, 0.31); lc.scale.set(1.3, 0.75, 0.45);
    const rc = new THREE.Mesh(cheekG, cheekMat); rc.position.set(0.245, 0.588, 0.31); rc.scale.set(1.3, 0.75, 0.45);
    group.add(lc, rc);

    // ── Tiny oval nose ──
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), noseMat);
    nose.position.set(0, 0.605, 0.395); nose.scale.set(1.4, 1, 0.6);
    group.add(nose);

    // ── Tiny arms (nubbins sticking out sides) ──
    const armG = new THREE.SphereGeometry(0.11, 10, 10);
    const la = new THREE.Mesh(armG, bodyMat); la.position.set(-0.48, 0.05, 0.1); la.scale.set(0.72, 0.9, 0.75); la.castShadow = true;
    const ra = new THREE.Mesh(armG, bodyMat); ra.position.set(0.48, 0.05, 0.1); ra.scale.set(0.72, 0.9, 0.75); ra.castShadow = true;
    group.add(la, ra);

    // ── Small round feet ──
    const footG = new THREE.SphereGeometry(0.12, 10, 10);
    const lf = new THREE.Mesh(footG, bodyMat); lf.position.set(-0.2, -0.5, 0.14); lf.scale.set(1, 0.58, 1.15);
    const rf = new THREE.Mesh(footG, bodyMat); rf.position.set(0.2, -0.5, 0.14); rf.scale.set(1, 0.58, 1.15);
    group.add(lf, rf);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const body2 = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.42).setMass(0.18).setFriction(0.42).setRestitution(0.12), body2);
      this.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.36).setTranslation(0, 0.56, 0).setFriction(0.42), body2);
      this.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.11).setTranslation(-0.48, 0.05, 0.1).setFriction(0.45), body2);
      this.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.11).setTranslation(0.48, 0.05, 0.1).setFriction(0.45), body2);
      this.physics.registerBody(body2, group);
      this.bodies.push(body2);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  🐉  DRAGON BALL BOX  (七龍珠 公仔盒)
  //  Reference: Banpresto DXF style — white/orange packaging
  //  with bold kanji title, star ball graphic, character artwork panel
  // ══════════════════════════════════════════════════════════════
  private spawnDragonBallBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const W = 0.82, H = 1.08, D = 0.68;

    // ── Front face canvas texture ──
    const frontTex = this.makeCanvasTex(256, 336, ctx => {
      // Orange gradient background (DBZ box color)
      const g = ctx.createLinearGradient(0, 0, 0, 336);
      g.addColorStop(0, '#ff8c00'); g.addColorStop(0.55, '#ff6000'); g.addColorStop(1, '#cc3a00');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 336);

      // Top black banner bar
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 256, 52);

      // "ドラゴンボール" white bold text in banner
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 19px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 6;
      ctx.fillText('DRAGON BALL', 128, 22);
      ctx.font = 'bold 14px sans-serif';
      ctx.shadowBlur = 0;
      ctx.fillText('DXF FIGURE', 128, 42);

      // Gold star ball circle in center
      const ballX = 128, ballY = 150, ballR = 55;
      const ballG = ctx.createRadialGradient(ballX - 18, ballY - 18, 4, ballX, ballY, ballR);
      ballG.addColorStop(0, '#fffde7'); ballG.addColorStop(0.4, '#ffca28'); ballG.addColorStop(1, '#f57f17');
      ctx.fillStyle = ballG;
      ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2); ctx.fill();
      // Ball shine
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(ballX - 20, ballY - 20, 20, 14, -0.5, 0, Math.PI * 2); ctx.fill();
      // 4 stars on ball
      ctx.fillStyle = '#e53935';
      const starPos = [[-18, -18], [18, -14], [-14, 18], [18, 18]];
      starPos.forEach(([sx, sy]) => {
        ctx.beginPath(); ctx.arc(ballX + sx, ballY + sy, 8, 0, Math.PI * 2); ctx.fill();
        // tiny cross
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ballX + sx - 4, ballY + sy); ctx.lineTo(ballX + sx + 4, ballY + sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ballX + sx, ballY + sy - 4); ctx.lineTo(ballX + sx, ballY + sy + 4); ctx.stroke();
      });

      // Bottom info strip
      ctx.fillStyle = '#111'; ctx.fillRect(0, 268, 256, 68);
      ctx.fillStyle = '#ffca28';
      ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('孫悟空 Super Saiyan', 128, 290);
      ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif';
      ctx.fillText('©BIRD STUDIO / SHUEISHA  BANDAI SPIRITS', 128, 325);
    });

    // ── Side canvas texture ──
    const sideTex = this.makeCanvasTex(128, 336, ctx => {
      const g = ctx.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, '#cc3a00'); g.addColorStop(1, '#ff6000');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 336);
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 40); ctx.fillRect(0, 296, 128, 40);
      ctx.save(); ctx.translate(64, 168); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#ffca28'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('DRAGON BALL', 0, 5); ctx.restore();
    });

    // ── Top canvas ──
    const topTex = this.makeCanvasTex(128, 104, ctx => {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 104);
      ctx.fillStyle = '#ffca28'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BANDAI SPIRITS', 64, 52); ctx.fillText('バンプレスト', 64, 72);
    });

    const faceMats = [
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.45 }),   // +X right
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.45 }),   // -X left
      new THREE.MeshStandardMaterial({ map: topTex,  roughness: 0.4 }),    // +Y top
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }), // -Y bottom
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4 }),   // +Z front
      new THREE.MeshStandardMaterial({ map: sideTex,  roughness: 0.45 }),  // -Z back
    ];

    const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), faceMats);
    box.castShadow = true;
    group.add(box);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const body = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(W / 2, H / 2, D / 2).setMass(0.35).setFriction(0.38).setRestitution(0.08), body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  ☠️  ONE PIECE BOX  (海賊王 路飛 公仔盒)
  //  Reference: Banpresto — black/red with gold trim, straw hat icon
  //  character name large, series logo top banner
  // ══════════════════════════════════════════════════════════════
  private spawnOnePieceBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const W = 0.80, H = 1.06, D = 0.66;

    const frontTex = this.makeCanvasTex(256, 330, ctx => {
      // Deep black/dark navy bg
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, 256, 330);

      // Red diagonal swoosh
      ctx.save();
      ctx.beginPath(); ctx.moveTo(0, 100); ctx.lineTo(256, 60); ctx.lineTo(256, 180); ctx.lineTo(0, 220); ctx.closePath();
      ctx.fillStyle = '#cc1111'; ctx.fill();
      ctx.restore();

      // ONE PIECE logo at top
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 28px serif'; ctx.textAlign = 'center';
      ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 12;
      ctx.fillText('ONE PIECE', 128, 48);
      ctx.shadowBlur = 0;

      // Straw hat drawing
      const hx = 128, hy = 148;
      // Brim
      ctx.fillStyle = '#e6b800';
      ctx.beginPath(); ctx.ellipse(hx, hy + 14, 52, 14, 0, 0, Math.PI * 2); ctx.fill();
      // Top dome
      ctx.fillStyle = '#f0c800';
      ctx.beginPath(); ctx.ellipse(hx, hy, 34, 26, 0, Math.PI, 0); ctx.fill();
      // Red band
      ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(hx, hy + 2, 36, 8, 0, 0.1, Math.PI - 0.1); ctx.stroke();

      // Character name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('モンキー・D・ルフィ', 128, 258);
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Monkey D. Luffy', 128, 278);

      // Bottom bar
      ctx.fillStyle = '#cc1111'; ctx.fillRect(0, 295, 256, 35);
      ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
      ctx.fillText('©Eiichiro Oda / Shueisha  BANDAI SPIRITS', 128, 318);
    });

    const sideTex = this.makeCanvasTex(128, 330, ctx => {
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, 128, 330);
      ctx.fillStyle = '#cc1111'; ctx.fillRect(0, 0, 128, 36); ctx.fillRect(0, 294, 128, 36);
      ctx.save(); ctx.translate(64, 165); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 16px serif'; ctx.textAlign = 'center';
      ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8;
      ctx.fillText('ONE PIECE', 0, 5); ctx.restore();
    });

    const topTex = this.makeCanvasTex(128, 104, ctx => {
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, 128, 104);
      ctx.fillStyle = '#cc1111'; ctx.fillRect(16, 16, 96, 72);
      ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 12px serif'; ctx.textAlign = 'center';
      ctx.fillText('BANDAI', 64, 52); ctx.fillText('SPIRITS', 64, 68);
    });

    const mats = [
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: topTex,  roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ map: sideTex,  roughness: 0.4 }),
    ];

    const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats);
    box.castShadow = true;
    group.add(box);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const body = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(W / 2, H / 2, D / 2).setMass(0.35).setFriction(0.38).setRestitution(0.08), body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  ☕  MUG BOX  (馬克杯盒裝)
  //  Reference: gift box with window cutout showing mug handle,
  //  kraft paper + pastel color with product photo front
  // ══════════════════════════════════════════════════════════════
  private spawnMugBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const variants = [
      { bg: '#fff0f8', accent: '#ff6eb4', mugColor: '#ff80ab', name: 'My Melody Mug' },
      { bg: '#f0f8ff', accent: '#4fc3f7', mugColor: '#81d4fa', name: 'Cinnamoroll Mug' },
      { bg: '#fffde7', accent: '#ffd54f', mugColor: '#ffee58', name: 'Pompompurin Mug' },
      { bg: '#f3e5f5', accent: '#ce93d8', mugColor: '#ba68c8', name: 'Kuromi Mug' },
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const W = 1.0, H = 0.78, D = 0.78;

    const frontTex = this.makeCanvasTex(312, 242, ctx => {
      // Base color
      ctx.fillStyle = v.bg; ctx.fillRect(0, 0, 312, 242);
      // Border
      ctx.strokeStyle = v.accent; ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 304, 234);
      ctx.strokeStyle = v.accent + '66'; ctx.lineWidth = 3;
      ctx.strokeRect(12, 12, 288, 218);

      // Window showing mug illustration
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.roundRect(60, 30, 192, 142, 12); ctx.fill();
      ctx.strokeStyle = v.accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(60, 30, 192, 142, 12); ctx.stroke();

      // Draw mug inside window
      const mx = 156, my = 112;
      // Mug body
      ctx.fillStyle = v.mugColor;
      ctx.beginPath(); ctx.roundRect(mx - 44, my - 44, 88, 80, 8); ctx.fill();
      // Mug handle (D shape)
      ctx.strokeStyle = v.mugColor; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(mx + 44, my - 10, 22, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      // Mug rim
      ctx.fillStyle = v.accent;
      ctx.beginPath(); ctx.ellipse(mx, my - 44, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
      // Steam
      ctx.strokeStyle = v.accent + 'aa'; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(mx + i * 14, my - 54);
        ctx.quadraticCurveTo(mx + i * 14 + 8, my - 68, mx + i * 14, my - 78);
        ctx.stroke();
      }

      // Product name
      ctx.fillStyle = v.accent; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(v.name, 156, 196);
      ctx.fillStyle = '#888'; ctx.font = '12px sans-serif';
      ctx.fillText('Sanrio Characters Mug 350ml', 156, 216);
      ctx.fillText('© 2024 SANRIO CO.,LTD.', 156, 234);
    });

    const sideTex = this.makeCanvasTex(242, 242, ctx => {
      ctx.fillStyle = v.bg; ctx.fillRect(0, 0, 242, 242);
      ctx.strokeStyle = v.accent; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 236, 236);
      ctx.fillStyle = v.accent; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(121, 121); ctx.rotate(-Math.PI / 2);
      ctx.fillText('SANRIO × Mug Gift Box', 0, 5); ctx.restore();
    });

    const topTex = this.makeCanvasTex(312, 242, ctx => {
      ctx.fillStyle = v.accent; ctx.fillRect(0, 0, 312, 242);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px serif'; ctx.textAlign = 'center';
      ctx.fillText('🎁 Gift Box', 156, 130);
    });

    const mats = [
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: topTex,  roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4 }),
    ];

    const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats);
    box.castShadow = true;
    group.add(box);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const body = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(W / 2, H / 2, D / 2).setMass(0.4).setFriction(0.38).setRestitution(0.07), body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  🌸  SANRIO BOTTLE  (三麗鷗 保溫水壺)
  //  Reference: stainless steel thermos, character face + name,
  //  pastel body + contrasting lid, strap loop on top
  // ══════════════════════════════════════════════════════════════
  private spawnSanrioBottle(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const chars = [
      { bodyHex: 0xffb6c8, lidHex: 0xff4d80, face: 'melody',   name: 'My Melody'    },
      { bodyHex: 0xddeeff, lidHex: 0x5bb8f5, face: 'kitty',    name: 'Hello Kitty'  },
      { bodyHex: 0xfffacd, lidHex: 0xf5a623, face: 'pompom',   name: 'Pompompurin'  },
      { bodyHex: 0xe8d5f0, lidHex: 0x7b2cbf, face: 'kuromi',   name: 'Kuromi'       },
    ];
    const ch = chars[Math.floor(Math.random() * chars.length)];

    const R = 0.26, BH = 1.1;

    // Body canvas
    const bodyTex = this.makeCanvasTex(256, 512, ctx => {
      // Metallic body gradient
      const mg = ctx.createLinearGradient(0, 0, 256, 0);
      const hc = '#' + ch.bodyHex.toString(16).padStart(6, '0');
      mg.addColorStop(0, '#ccc'); mg.addColorStop(0.2, hc);
      mg.addColorStop(0.5, '#fff'); mg.addColorStop(0.8, hc); mg.addColorStop(1, '#aaa');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, 256, 512);

      // Character name belt stripe near bottom
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 370, 256, 60);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(ch.name, 128, 407);
      ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('© SANRIO  保溫 500ml', 128, 424);

      // Character face in center
      const fx = 128, fy = 200;
      if (ch.face === 'kitty') {
        // Hello Kitty face: white oval head, no mouth, bow
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(fx, fy, 62, 58, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; // eyes
        ctx.beginPath(); ctx.ellipse(fx - 20, fy - 10, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx + 20, fy - 10, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8800'; // nose
        ctx.beginPath(); ctx.ellipse(fx + 10, fy + 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
        // Yellow bow top right
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(fx + 40, fy - 48, 16, 10, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx + 58, fy - 48, 16, 10, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 49, fy - 48, 6, 0, Math.PI * 2); ctx.fill();

      } else if (ch.face === 'melody') {
        // My Melody: pink hood, big oval eyes, tiny X nose
        ctx.fillStyle = '#ff80a0'; ctx.beginPath(); ctx.ellipse(fx, fy - 20, 65, 62, 0, 0, Math.PI); ctx.fill(); // hood
        ctx.fillStyle = '#ffe0e8'; ctx.beginPath(); ctx.ellipse(fx, fy + 8, 46, 44, 0, 0, Math.PI * 2); ctx.fill(); // face
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(fx - 18, fy, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx + 18, fy, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff4466'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(fx - 5, fy + 14); ctx.lineTo(fx, fy + 10); ctx.lineTo(fx + 5, fy + 14); ctx.stroke();
        // Pink inner ear dots
        ctx.fillStyle = '#ff6090';
        ctx.beginPath(); ctx.arc(fx - 46, fy - 50, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 46, fy - 50, 8, 0, Math.PI * 2); ctx.fill();

      } else if (ch.face === 'pompom') {
        // Pompompurin: golden beret + pudding face
        ctx.fillStyle = '#f5a623'; ctx.beginPath(); ctx.ellipse(fx, fy - 26, 64, 28, 0, Math.PI, 0); ctx.fill(); // beret
        ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(fx, fy + 8, 52, 48, 0, 0, Math.PI * 2); ctx.fill(); // face
        ctx.fillStyle = '#5c3a00';
        ctx.beginPath(); ctx.arc(fx - 18, fy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 18, fy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5c3a00'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(fx, fy + 14, 14, 0.1, Math.PI - 0.1); ctx.stroke();

      } else {
        // Kuromi: skull jester hat
        ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.ellipse(fx, fy + 4, 52, 50, 0, 0, Math.PI * 2); ctx.fill(); // head
        ctx.fillStyle = '#fff'; // skull on hat
        ctx.beginPath(); ctx.arc(fx, fy - 32, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath(); ctx.arc(fx - 7, fy - 35, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 7, fy - 35, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(fx - 16, fy + 2, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx + 16, fy + 2, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath(); ctx.arc(fx - 16, fy + 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 16, fy + 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff00aa'; // pink bow
        ctx.beginPath(); ctx.ellipse(fx - 8, fy + 24, 12, 8, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx + 8, fy + 24, 12, 8, -0.3, 0, Math.PI * 2); ctx.fill();
      }
    });

    const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.2, metalness: 0.45 });
    const lidMat  = new THREE.MeshStandardMaterial({ color: ch.lidHex, roughness: 0.2, metalness: 0.55 });
    const strapMat= new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.6 });

    // Body cylinder
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, BH, 24), bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Shoulder taper
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R, 0.18, 18), lidMat);
    shoulder.position.y = BH / 2 + 0.06;
    group.add(shoulder);

    // Lid
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.68, R * 0.72, 0.22, 16), lidMat);
    lid.position.y = BH / 2 + 0.22;
    group.add(lid);

    // Loop strap on top
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 12), strapMat);
    strap.position.y = BH / 2 + 0.36;
    group.add(strap);

    // Bottom rubber ring
    const botRing = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R + 0.01, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 }));
    botRing.position.y = -BH / 2 - 0.02;
    group.add(botRing);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const body = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(RAPIER.ColliderDesc.cylinder(BH / 2 + 0.2, R).setMass(0.3).setFriction(0.38).setRestitution(0.1), body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  🍪  COOKIE TIN  (餅乾鐵盒)
  //  Reference: Danisa / LU butter cookies tin — round blue tin
  //  with gold filigree lid, brand name embossed, colourful variants
  // ══════════════════════════════════════════════════════════════
  private spawnCookieBox(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const variants = [
      { body: 0x1a3a8a, lid: 0xf5e642, name: 'Butter Cookies',   brand: 'DANISA'   },
      { body: 0xb22222, lid: 0xffd700, name: 'Royal Assorted',    brand: 'ROYAL'    },
      { body: 0x1a5c2a, lid: 0xffe066, name: "Lady's Choice",     brand: "LADY'S"   },
      { body: 0x5c1a8a, lid: 0xf9c6f0, name: 'Sanrio Cookies',   brand: 'SANRIO'   },
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];

    const R = 0.40, TH = 0.30;

    // Side canvas (wraps around tin body)
    const sideTex = this.makeCanvasTex(512, 192, ctx => {
      const bg = '#' + v.body.toString(16).padStart(6, '0');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 192);

      // Gold decorative border stripes top & bottom
      ctx.fillStyle = '#' + v.lid.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, 512, 22); ctx.fillRect(0, 170, 512, 22);

      // Filigree floral band (simplified as arc decorations)
      ctx.strokeStyle = '#' + v.lid.toString(16).padStart(6, '0');
      ctx.lineWidth = 1.5; ctx.globalAlpha = 0.55;
      for (let bx = 20; bx < 512; bx += 40) {
        ctx.beginPath(); ctx.arc(bx, 96, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - 14, 96); ctx.lineTo(bx + 14, 96); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, 82); ctx.lineTo(bx, 110); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Brand name
      ctx.fillStyle = '#' + v.lid.toString(16).padStart(6, '0');
      ctx.font = 'bold 38px serif'; ctx.textAlign = 'center';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(v.brand, 256, 110);
      ctx.font = '18px serif';
      ctx.fillText(v.name, 256, 148);
      ctx.shadowBlur = 0;
    });
    sideTex.wrapS = THREE.RepeatWrapping;
    sideTex.repeat.set(1, 1);

    // Lid canvas
    const lidTex = this.makeCanvasTex(256, 256, ctx => {
      const lg = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
      const lc = '#' + v.lid.toString(16).padStart(6, '0');
      lg.addColorStop(0, '#fff'); lg.addColorStop(0.3, lc); lg.addColorStop(1, '#b8960c');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, 256, 256);

      // Concentric decorative rings
      const rc = '#' + v.body.toString(16).padStart(6, '0');
      [90, 110, 118].forEach(r => {
        ctx.strokeStyle = rc; ctx.lineWidth = r === 90 ? 3 : 1.5; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Brand in center
      ctx.fillStyle = '#' + v.body.toString(16).padStart(6, '0');
      ctx.font = 'bold 28px serif'; ctx.textAlign = 'center';
      ctx.fillText(v.brand, 128, 118);
      ctx.font = '14px serif';
      ctx.fillText(v.name, 128, 148);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#666';
      ctx.fillText('BUTTER COOKIES  100g', 128, 185);
    });

    const bodyMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.25, metalness: 0.65 });
    const lidMat  = new THREE.MeshStandardMaterial({ map: lidTex,  roughness: 0.15, metalness: 0.75 });
    const botMat  = new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.3,  metalness: 0.6 });

    // Body
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TH, 28), bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Lid (slightly larger, sits on top)
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.022, R + 0.022, 0.055, 28), lidMat);
    lidMesh.position.y = TH / 2 + 0.015;
    group.add(lidMesh);

    // Lid top face
    const lidTop = new THREE.Mesh(new THREE.CircleGeometry(R + 0.022, 28), lidMat);
    lidTop.rotation.x = -Math.PI / 2;
    lidTop.position.y = TH / 2 + 0.042;
    group.add(lidTop);

    // Bottom face
    const bot = new THREE.Mesh(new THREE.CircleGeometry(R, 28), botMat);
    bot.rotation.x = Math.PI / 2;
    bot.position.y = -TH / 2;
    group.add(bot);

    // Small handle knob on lid
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.85, roughness: 0.15 });
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.05, 12), knobMat);
    knob.position.y = TH / 2 + 0.07;
    group.add(knob);

    this.scene.add(group);
    this.prizes.push(group);

    if (this.physics.world) {
      const body = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(RAPIER.ColliderDesc.cylinder(TH / 2 + 0.04, R + 0.025).setMass(0.5).setFriction(0.42).setRestitution(0.05), body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  🐱  MY CAT — 三花貓 Calico Cat Plush Doll
  //  Based on owner's real cat photo:
  //  - LEFT face: solid black
  //  - RIGHT face: orange/cream with black patches
  //  - White chin & chest
  //  - Big round green eyes with black pupils
  //  - Black nose, white whiskers
  //  - Pointy triangle ears (black left, orange+black right)
  // ══════════════════════════════════════════════════════════════
  private spawnCalicoCat(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    // ── Face canvas texture (front of head) ──────────────────────
    // Paint the distinctive calico split-face pattern
    const faceTex = this.makeCanvasTex(512, 512, ctx => {
      // Base cream/beige face
      ctx.fillStyle = '#f0dcc0';
      ctx.beginPath(); ctx.arc(256, 256, 245, 0, Math.PI * 2); ctx.fill();

      // LEFT half: solid BLACK patch
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(256, 256, 245, Math.PI * 0.5, Math.PI * 1.5);
      ctx.lineTo(256, 11);
      ctx.closePath();
      ctx.fill();

      // Right side orange patch around eye
      ctx.fillStyle = '#c87030';
      ctx.beginPath();
      ctx.ellipse(320, 210, 85, 70, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Black patch on right side (above right eye)
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(330, 155, 62, 45, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Black patch under right eye
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(360, 290, 38, 28, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // White chin / muzzle area (bottom center)
      ctx.fillStyle = '#f5f0e8';
      ctx.beginPath();
      ctx.ellipse(256, 370, 110, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // White lower chin
      ctx.beginPath();
      ctx.ellipse(256, 440, 90, 70, 0, 0, Math.PI * 2);
      ctx.fill();

      // ── LEFT EYE (green, on black side) ──
      // Eye white / sclera
      ctx.fillStyle = '#e8ffe8';
      ctx.beginPath(); ctx.ellipse(168, 235, 52, 46, 0.1, 0, Math.PI * 2); ctx.fill();
      // Iris: bright green
      const lIrisG = ctx.createRadialGradient(168, 235, 4, 168, 235, 38);
      lIrisG.addColorStop(0, '#2dd4a0'); lIrisG.addColorStop(0.5, '#16a34a'); lIrisG.addColorStop(1, '#065f46');
      ctx.fillStyle = lIrisG;
      ctx.beginPath(); ctx.ellipse(168, 235, 38, 40, 0.1, 0, Math.PI * 2); ctx.fill();
      // Pupil (vertical slit)
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.ellipse(168, 235, 10, 34, 0.1, 0, Math.PI * 2); ctx.fill();
      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(155, 220, 12, 8, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(178, 246, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      // Eye outline
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(168, 235, 52, 46, 0.1, 0, Math.PI * 2); ctx.stroke();

      // ── RIGHT EYE (green, on orange/black side) ──
      ctx.fillStyle = '#e8ffe8';
      ctx.beginPath(); ctx.ellipse(340, 230, 50, 46, -0.1, 0, Math.PI * 2); ctx.fill();
      const rIrisG = ctx.createRadialGradient(340, 230, 4, 340, 230, 37);
      rIrisG.addColorStop(0, '#2dd4a0'); rIrisG.addColorStop(0.5, '#16a34a'); rIrisG.addColorStop(1, '#065f46');
      ctx.fillStyle = rIrisG;
      ctx.beginPath(); ctx.ellipse(340, 230, 37, 40, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.ellipse(340, 230, 9, 34, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(326, 215, 12, 8, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(350, 240, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(340, 230, 50, 46, -0.1, 0, Math.PI * 2); ctx.stroke();

      // ── NOSE (dark brownish-black, slightly heart shaped) ──
      ctx.fillStyle = '#2a1a1a';
      ctx.beginPath();
      ctx.moveTo(256, 318);
      ctx.bezierCurveTo(240, 300, 220, 308, 230, 326);
      ctx.bezierCurveTo(238, 338, 256, 340, 256, 340);
      ctx.bezierCurveTo(256, 340, 274, 338, 282, 326);
      ctx.bezierCurveTo(292, 308, 272, 300, 256, 318);
      ctx.fill();

      // ── MOUTH line ──
      ctx.strokeStyle = '#4a2a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(256, 340); ctx.lineTo(256, 360); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(256, 360); ctx.quadraticCurveTo(232, 375, 220, 370); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(256, 360); ctx.quadraticCurveTo(280, 375, 292, 370); ctx.stroke();

      // ── WHISKERS (white) ──
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      // Left whiskers
      ctx.beginPath(); ctx.moveTo(220, 340); ctx.lineTo(50, 320); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(218, 352); ctx.lineTo(45, 358); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(222, 365); ctx.lineTo(55, 385); ctx.stroke();
      // Right whiskers
      ctx.beginPath(); ctx.moveTo(292, 340); ctx.lineTo(462, 320); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(294, 352); ctx.lineTo(467, 358); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(290, 365); ctx.lineTo(457, 385); ctx.stroke();

      // ── Forehead crease lines (subtle) ──
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(200, 130); ctx.quadraticCurveTo(230, 110, 256, 130); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(256, 130); ctx.quadraticCurveTo(282, 110, 310, 130); ctx.stroke();
    });

    // ── Body canvas (front of torso) ─────────────────────────────
    const bodyTex = this.makeCanvasTex(512, 512, ctx => {
      // White/cream belly base
      ctx.fillStyle = '#f5f0e8';
      ctx.beginPath(); ctx.ellipse(256, 280, 230, 240, 0, 0, Math.PI * 2); ctx.fill();

      // Black collar / neck band
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.ellipse(256, 95, 150, 55, 0, 0, Math.PI * 2); ctx.fill();

      // Left side body: black
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(120, 280, 120, 200, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Right side: orange
      ctx.fillStyle = '#c87030';
      ctx.beginPath();
      ctx.ellipse(390, 260, 115, 185, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Orange patches on right
      ctx.fillStyle = '#c87030';
      ctx.beginPath(); ctx.ellipse(350, 430, 80, 60, 0.3, 0, Math.PI * 2); ctx.fill();

      // Center white belly stripe
      ctx.fillStyle = '#f8f4ee';
      ctx.beginPath(); ctx.ellipse(256, 320, 100, 165, 0, 0, Math.PI * 2); ctx.fill();

      // Subtle fur texture lines
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1.5;
      for (let fy = 150; fy < 480; fy += 18) {
        ctx.beginPath();
        ctx.moveTo(100, fy);
        ctx.quadraticCurveTo(256, fy - 8, 412, fy);
        ctx.stroke();
      }
    });

    // ── Back of head (simple black) ──────────────────────────────
    const backHeadMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

    // ── Materials ─────────────────────────────────────────────────
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.82, metalness: 0 });
    const bodyFrontMat = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.85, metalness: 0 });

    // ── HEAD (round sphere, face texture on front) ────────────────
    const headGeo = new THREE.SphereGeometry(0.40, 24, 24);
    const headMats: THREE.Material[] = [];
    // Use face texture on front-facing segments
    const headMesh = new THREE.Mesh(headGeo, faceMat);
    headMesh.position.set(0, 0.60, 0);
    headMesh.castShadow = true;
    group.add(headMesh);

    // ── BODY ──────────────────────────────────────────────────────
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 20), bodyFrontMat);
    bodyMesh.scale.set(1, 1.05, 0.95);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // ── EARS ─────────────────────────────────────────────────────
    // Left ear: BLACK (matches cat's black left side)
    const leftEarMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    const leftEarInnerMat = new THREE.MeshStandardMaterial({ color: 0x3a1a1a, roughness: 0.9 });
    const rightEarMat = new THREE.MeshStandardMaterial({ color: 0xc87030, roughness: 0.85 });
    const rightEarInnerMat = new THREE.MeshStandardMaterial({ color: 0xffcca0, roughness: 0.9 });
    const earGeo = new THREE.ConeGeometry(0.155, 0.30, 3);
    // Left ear
    const le = new THREE.Mesh(earGeo, leftEarMat);
    le.position.set(-0.28, 0.95, 0.02);
    le.rotation.z = 0.18;
    group.add(le);
    const lei = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 3), leftEarInnerMat);
    lei.position.set(-0.26, 0.96, 0.06);
    lei.rotation.z = 0.18;
    group.add(lei);
    // Right ear: orange with black tip
    const re = new THREE.Mesh(earGeo, rightEarMat);
    re.position.set(0.28, 0.95, 0.02);
    re.rotation.z = -0.18;
    group.add(re);
    const rei = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 3), rightEarInnerMat);
    rei.position.set(0.26, 0.96, 0.06);
    rei.rotation.z = -0.18;
    group.add(rei);
    // Black tip on right ear
    const retip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 }));
    retip.position.set(0.30, 1.08, 0.02);
    retip.rotation.z = -0.18;
    group.add(retip);

    // ── TINY ARMS / PAWS ─────────────────────────────────────────
    const leftPawMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.88 });
    const rightPawMat = new THREE.MeshStandardMaterial({ color: 0xd08848, roughness: 0.88 });
    const la = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), leftPawMat);
    la.position.set(-0.50, 0.0, 0.08); la.scale.set(0.75, 0.9, 0.75); la.castShadow = true;
    const ra = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), rightPawMat);
    ra.position.set(0.50, 0.0, 0.08); ra.scale.set(0.75, 0.9, 0.75); ra.castShadow = true;
    group.add(la, ra);

    // ── FEET ─────────────────────────────────────────────────────
    const leftFootMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    const rightFootMat = new THREE.MeshStandardMaterial({ color: 0xc87030, roughness: 0.85 });
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), leftFootMat);
    lf.position.set(-0.22, -0.52, 0.12); lf.scale.set(1.1, 0.6, 1.2);
    const rf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), rightFootMat);
    rf.position.set(0.22, -0.52, 0.12); rf.scale.set(1.1, 0.6, 1.2);
    group.add(lf, rf);

    // ── TAIL ─────────────────────────────────────────────────────
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    const tail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 10), tailMat);
    tail1.position.set(0.1, -0.2, -0.45); tail1.rotation.x = -0.9; tail1.rotation.z = 0.2;
    group.add(tail1);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.85 }));
    tailTip.position.set(0.2, 0.12, -0.72);
    group.add(tailTip);

    // ── NAME TAG ribbon (optional cute touch) ────────────────────
    const tagMat = new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.5 });
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.04), tagMat);
    tag.position.set(0, 0.20, 0.46);
    group.add(tag);
    const tagTex = this.makeCanvasTex(128, 64, ctx => {
      ctx.fillStyle = '#ff80ab'; ctx.fillRect(0, 0, 128, 64);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 120, 56);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🐱 我的貓', 64, 38);
    });
    const tagLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.14),
      new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }));
    tagLabel.position.set(0, 0.20, 0.49);
    group.add(tagLabel);

    this.scene.add(group);
    this.prizes.push(group);

    // Physics
    if (this.physics.world) {
      const body = this.makeDynBody(x, y, z);
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.ball(0.44).setMass(0.2).setFriction(0.42).setRestitution(0.12), body);
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.ball(0.38).setTranslation(0, 0.60, 0).setFriction(0.42), body);
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.ball(0.13).setTranslation(-0.50, 0.0, 0.08).setFriction(0.45), body);
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.ball(0.13).setTranslation(0.50, 0.0, 0.08).setFriction(0.45), body);
      this.physics.registerBody(body, group);
      this.bodies.push(body);
    }
  }
}

