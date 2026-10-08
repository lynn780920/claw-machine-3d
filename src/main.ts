import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PhysicsSystem } from './physics';
import { Cabinet } from './cabinet';
import { Claw } from './claw';
import { PrizesManager } from './prizes';
import { soundEngine } from './audio';
import { LevelSystem, LevelConfig, LEVEL_CONFIGS } from './levelSystem';
import { LeaderboardManager, escapeLeaderboardText } from './leaderboard';
import { preloadModels, disposeModel, withTimeout } from './modelAssets';
import { setupStudio, fitMachineCamera } from './renderSetup';
import { isDelivered, isWedgedInChute, isPrizeEnteringChute } from './delivery';
import { buildArcadeEnvironment, layoutArcadeNeighbors } from './arcadeEnvironment';
import { loadCampaignProgress, saveCampaignProgress } from './campaignProgress';

// Game Statistics
let coins = 0;
let plays = 0;
let wins = 0;
let levelSystem: LevelSystem;
let leaderboardManager: LeaderboardManager;
let campaignProgress = loadCampaignProgress(LEVEL_CONFIGS.length,localStorage.getItem('claw_player_nickname') || '');
let stageDrops = 0;
let stageExhaustedAt = 0;
const stageMarkers = new Map<THREE.Object3D,THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]>();

function removeStageMarker(prize: THREE.Object3D) {
  const marker = stageMarkers.get(prize);
  if (!marker) return;
  for (const outline of marker) { outline.removeFromParent(); outline.material.dispose(); }
  stageMarkers.delete(prize);
}

function clearStageMarkers() {
  for (const prize of stageMarkers.keys()) removeStageMarker(prize);
}

function updateStageHint(message: string) {
  const hint = document.getElementById('stage-hint');
  if (hint) { hint.textContent = message; hint.hidden = !message; }
}

function spawnMarkedTarget(type: string, id: string, x: number, z: number) {
  prizesManager.spawnSinglePrize(x, 2.2, z, type);
  const mesh = prizesManager.prizes.at(-1)!;
  mesh.userData.stageTarget = id;
  const sources: THREE.Mesh[] = [];
  mesh.traverse(object => {
    if (object instanceof THREE.Mesh) sources.push(object);
  });
  // Back-face shells light only the silhouette, leaving the prize textures untouched.
  const outlines = sources.flatMap(source => [0.035,0.075].map((width,index) => {
    const material = new THREE.ShaderMaterial({
      uniforms:{width:{value:width},opacity:{value:index ? 0.2 : 0.8}},
      vertexShader:'uniform float width; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);p.xyz+=normalize(normalMatrix*normal)*width;gl_Position=projectionMatrix*p;}',
      fragmentShader:'uniform float opacity; void main(){gl_FragColor=vec4(0.1,1.0,0.35,opacity);}',
      side:THREE.BackSide,transparent:true,depthWrite:false,toneMapped:false
    });
    const outline = new THREE.Mesh(source.geometry,material);
    outline.name = 'TargetOutline'; outline.renderOrder = 2;
    source.add(outline);
    return outline;
  }));
  stageMarkers.set(mesh,outlines);
}

// Three.js Core
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;

// Custom Game Objects
let physics: PhysicsSystem;
let cabinet: Cabinet;
let claw: Claw;
let prizesManager: PrizesManager;

// Interactive Mouse Joystick State
let isMouseDraggingJoystick = false;
let isManualPlaceMode = false;

// Keyboard input buffer
const keys: Record<string, boolean> = {
  w: false,
  a: false,
  s: false,
  d: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

// UI Elements
const coinsEl = document.getElementById('stat-coins');
const playsEl = document.getElementById('stat-plays');
const winsEl = document.getElementById('stat-wins');
const rateEl = document.getElementById('stat-rate')!;
const dropBtn = document.getElementById('drop-btn') as HTMLButtonElement;
const insertCoinBtn = document.getElementById('insert-coin-btn') as HTMLButtonElement;

async function init() {
  const loading = document.getElementById('asset-loading')!;
  const setLoadingProgress = (percent: number, label = `${percent}%`) => {
    document.getElementById('asset-progress')!.textContent = label;
    (document.getElementById('asset-progress-fill') as HTMLElement).style.width = `${percent}%`;
    loading.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow',String(percent));
  };
  await preloadModels((loaded,total) => {
    setLoadingProgress(Math.round(loaded/total*85));
  });
  setLoadingProgress(88,'初始化物理引擎');
  // 1. Initialize physics compat environment
  physics = new PhysicsSystem();
  await withTimeout(physics.init(),20000,'Physics');
  setLoadingProgress(93,'建立街機廳');
  await new Promise(resolve=>requestAnimationFrame(resolve));

  // 2. Setup Three.js scene with 3D Arcade Game Room Environment
  scene = new THREE.Scene();

  // Camera settings matching Kujiflip 40-degree low distortion perspective
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 5.6, 9.2); // Player eye-level front-facing view matching user screenshot

  // Auto-detect Mobile Device & Power Saver Defaults
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  let powerSaverMode = false;

  // Mobile-optimized Renderer setup (capped pixel ratio 1.0 on mobile to stop battery drain)
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(powerSaverMode ? 1.0 : Math.min(Math.max(window.devicePixelRatio, 1.5), 2));
  renderer.shadowMap.enabled = !powerSaverMode;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  setupStudio(scene,renderer);
  buildArcadeEnvironment(scene);

  // Global Power Saver Toggle
  (window as any).togglePowerSaver = (enable?: boolean) => {
    powerSaverMode = (enable !== undefined) ? enable : !powerSaverMode;
    renderer.setPixelRatio(powerSaverMode ? 1.0 : Math.min(Math.max(window.devicePixelRatio, 1.5), 2));
    renderer.shadowMap.enabled = !powerSaverMode;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = !powerSaverMode;
        obj.receiveShadow = !powerSaverMode;
      }
    });
    const btn = document.getElementById('power-saver-btn');
    if (btn) {
      btn.textContent = powerSaverMode ? '極速省電 (已開啟)' : '高畫質流暢模式';
      btn.style.background = powerSaverMode ? '#10b981' : '#6366f1';
    }
  };

  // View controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 35;
  controls.target.set(0, 3.2, 0); // Focus camera on dolls playfield

  // Directional cabinet lighting keeps fabric colors and contact shadows visible.
  const ambient = new THREE.AmbientLight(0xffffff, 0.08);
  scene.add(ambient);

  // Warm Golden LED Ceiling Light (Matching Yellow Roof Light in Reference Photo)
  const ceilingLight = new THREE.PointLight(0xfff1dc, 24.0, 15);
  ceilingLight.position.set(0, 6.3, 0.3);
  scene.add(ceilingLight);

  // Main Overhead Spotlight
  const mainSpot = new THREE.SpotLight(0xffffff, 85, 30, Math.PI / 2.5, 0.6, 2);
  mainSpot.position.set(0, 8.8, 2);
  mainSpot.castShadow = true;
  mainSpot.shadow.mapSize.width = 1024;
  mainSpot.shadow.mapSize.height = 1024;
  mainSpot.shadow.camera.near = 0.5;
  mainSpot.shadow.camera.far = 10;
  mainSpot.shadow.bias = 0.00005;
  mainSpot.shadow.normalBias = 0.02;
  scene.add(mainSpot);

  // Front Studio Fill Light illuminating colorful dolls
  const frontFill = new THREE.DirectionalLight(0xf2f5f0, 0.45);
  frontFill.position.set(-3, 5, 8);
  scene.add(frontFill);

  // 4. Instantiate machine components
  cabinet = new Cabinet(scene, physics);
  claw = new Claw(scene, physics);
  
  prizesManager = new PrizesManager(scene, physics);
  prizesManager.onBeforeClear = () => { claw.reset(); clearStageMarkers(); };

  // 5. Connect UI settings, level progression and keyboard event listeners
  setupUIEventListeners();
  setupKeyboardListeners();
  setLoadingProgress(97,'準備畫面');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  await withTimeout(renderer.compileAsync(scene,camera),30000,'Graphics');

  // 6. Game loop with FPS Throttling for battery saving
  const clock = new THREE.Timer();
  clock.connect(document);
  let accumulator = 0;
  const fixedDt = 1/60;
  let lastFrameTime = 0;
  const targetFPS = 60;
  const frameInterval = 1000 / targetFPS;
  let simulationSteps=0;
  
  function animate(now: number) {
    requestAnimationFrame(animate);

    const elapsed = now - lastFrameTime;
    if (elapsed < frameInterval - 1) return; // Skip extra frames for battery saving
    lastFrameTime = now - (elapsed % frameInterval);
    
    clock.update(now);
    const dt = Math.min(clock.getDelta(), 0.1);
    accumulator = Math.min(accumulator + dt, fixedDt*3);
    
    // Move carriage horizontally
    while (accumulator >= fixedDt) {
      physics.step(substepDt => {
        handleKeyboardMove(substepDt);
        claw.update(substepDt, physics, prizesManager);
      });
      simulationSteps++;
      accumulator -= fixedDt;
      checkWinCondition();
    }
    if (levelSystem?.isRunning && levelSystem.getCurrentConfig().stageNum === 5
      && stageDrops >= 30 && claw.state === 'IDLE' && levelSystem.stageWins < 3) {
      if (!stageExhaustedAt) stageExhaustedAt = performance.now();
      if (performance.now()-stageExhaustedAt >= 2500) levelSystem.failCurrentLevel();
    }

    cabinet.elasticBed?.updateVisuals();
    // Sync helper guides / indicator ring
    for (const materials of stageMarkers.values()) {
      for (const {material} of materials) material.uniforms.opacity.value = (material.uniforms.width.value < 0.05 ? 0.8 : 0.2) * (0.85+Math.sin(now*0.003)*0.15);
    }
    const clawPos = claw.baseMesh.position;
    cabinet.updateIndicator(clawPos.x, clawPos.z, clawPos.y);

    // Check if dolls fell into chute

    // Update state text
    updateClawStateUI();

    // Update camera controls
    controls.update();
    
    renderer.render(scene, camera);
    if (import.meta.env.DEV) {
      renderer.domElement.dataset.clawState = claw.state;
      renderer.domElement.dataset.prizeCount = String(prizesManager.prizes.length);
      renderer.domElement.dataset.geometries = String(renderer.info.memory.geometries);
      renderer.domElement.dataset.textures = String(renderer.info.memory.textures);
      renderer.domElement.dataset.physicsSteps = String(simulationSteps);
    }
  }
  
  animate(0);
  setLoadingProgress(100);
  loading.remove();
}

const chuteStalls = new WeakMap<object, number>();

// Check if any dolls fell down the exit chute
function checkWinCondition() {
  const minX = cabinet.chuteMinX;
  const maxX = cabinet.chuteMaxX;
  const minZ = cabinet.chuteMinZ;
  const maxZ = cabinet.chuteMaxZ;

  for (let idx = prizesManager.bodies.length - 1; idx >= 0; idx--) {
    const body = prizesManager.bodies[idx];
    const pos = body.translation();
    
    const chute = {minX,maxX,minZ,maxZ};
    const prizeMesh = prizesManager.prizes[idx];
    const nearChute = pos.x > minX-0.7 && pos.x < maxX+0.7 && pos.z > minZ-0.7 && pos.z < maxZ+0.7 && pos.y < 1.5;
    const prizeBounds = nearChute ? new THREE.Box3().setFromObject(prizeMesh) : null;
    const bottomY = prizeBounds?.min.y ?? Infinity;
    const wedged = isWedgedInChute(pos,bottomY,body.linvel().y,chute);
    const stalledFor = wedged ? (chuteStalls.get(body) ?? 0) + 1 / 60 : 0;
    chuteStalls.set(body,stalledFor);
    const isEnteringChuteHole = isDelivered(pos,chute) || stalledFor >= 0.3
      || (prizeBounds !== null && isPrizeEnteringChute(prizeBounds,chute));
    const isFallenBelowFloor = pos.y < -12;

    if (isEnteringChuteHole || isFallenBelowFloor) {
      const startY = prizeMesh.position.y;
      const startTime = performance.now();
      const fallThroughChute = (now: number) => {
        const seconds = Math.min((now - startTime) / 1000, 0.7);
        prizeMesh.position.y = startY - 11 * seconds * seconds;
        if (seconds >= 0.7) {
          scene.remove(prizeMesh);
          disposeModel(prizeMesh);
        } else {
          requestAnimationFrame(fallThroughChute);
        }
      };
      requestAnimationFrame(fallThroughChute);

      physics.unregisterBody(body);
      physics.world.removeRigidBody(body);
      physics.wakeUpNear(pos.x,pos.y+1.0,pos.z,2.8);

      prizesManager.bodies.splice(idx, 1);
      prizesManager.prizes.splice(idx, 1);
      removeStageMarker(prizeMesh);

      if (!isEnteringChuteHole) {
        const lostTarget = prizeMesh.userData.stageTarget as string | undefined;
        if (lostTarget?.startsWith('stage6-')) {
          spawnMarkedTarget(['eevee','cookie_box','squirtle'][Number(lostTarget.slice(-1))],lostTarget,0.7,-1.25);
        }
        continue;
      }

      wins++;
      updateStatsUI();
      if (levelSystem) {
        const targetId = prizeMesh.userData.stageTarget as string | undefined;
        levelSystem.onItemWon(prizesManager.prizes.length,targetId);
      }
      showWinAlert();
    }
  }
}

let winToastTimer: number | null = null;

// High-performance reusable Confetti Canvas (Zero lag, no DOM thrashing, no save/restore overhead)
let confettiCanvas: HTMLCanvasElement | null = null;
let confettiCtx: CanvasRenderingContext2D | null = null;
const confettiParticles: Array<{
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; color: string;
  rot: number; vrot: number;
}> = [];
let confettiAnimId: number | null = null;

function getConfettiCanvas() {
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.style.position = 'fixed';
    confettiCanvas.style.inset = '0';
    confettiCanvas.style.width = '100vw';
    confettiCanvas.style.height = '100vh';
    confettiCanvas.style.pointerEvents = 'none';
    confettiCanvas.style.zIndex = '99999';
    confettiCanvas.style.display = 'none';
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext('2d');
  }
  if (confettiCanvas.width !== window.innerWidth || confettiCanvas.height !== window.innerHeight) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  return { canvas: confettiCanvas, ctx: confettiCtx };
}

function launchConfetti() {
  const { canvas, ctx } = getConfettiCanvas();
  if (!canvas || !ctx) return;

  canvas.style.display = 'block';

  const colors = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#a855f7', '#fb923c', '#ffd700'];
  const centerX = canvas.width / 2;
  const startY = canvas.height * 0.45;

  // 55 vibrant particles provide rich celebration without lagging mobile/desktop GPU
  for (let i = 0; i < 55; i++) {
    confettiParticles.push({
      x: centerX + (Math.random() - 0.5) * 160,
      y: startY + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 18,
      vy: -Math.random() * 15 - 5,
      w: Math.random() * 12 + 6,
      h: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.2
    });
  }

  if (confettiAnimId === null) {
    let frame = 0;
    const step = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let aliveCount = 0;
      for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const p = confettiParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gentle gravity
        p.vx *= 0.985;
        p.rot += p.vrot;

        if (p.y < canvas.height + 60) {
          aliveCount++;
          // High-speed direct affine matrix transform - ZERO save/restore stack allocation!
          const cos = Math.cos(p.rot);
          const sin = Math.sin(p.rot);
          ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        } else {
          // Remove fallen particles
          confettiParticles.splice(i, 1);
        }
      }

      frame++;
      if (aliveCount > 0 && frame < 150) {
        confettiAnimId = requestAnimationFrame(step);
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        confettiParticles.length = 0;
        confettiAnimId = null;
      }
    };
    confettiAnimId = requestAnimationFrame(step);
  }
}

function showWinAlert() {
  soundEngine.playWinSFX();
  launchConfetti();

  const toast = document.getElementById('win-toast');
  if (toast) {
    const titleEl = toast.querySelector('.win-toast-title');
    if (titleEl) {
      titleEl.textContent = '恭喜出貨！成功夾出娃娃！';
    }
    const descEl = toast.querySelector('.win-toast-desc');
    if (descEl && levelSystem) {
      const cfg = levelSystem.getCurrentConfig();
      if (cfg.isClearAll) {
        descEl.innerHTML = `本關極速清台：剩餘 <span class="win-toast-highlight">${prizesManager.prizes.length} 盒</span>`;
      } else {
        descEl.innerHTML = `本關目標進度：<span class="win-toast-highlight">${levelSystem.stageWins} / ${cfg.targetWins} 樣</span>`;
      }
    }
    toast.classList.remove('hidden');
    if (winToastTimer !== null) clearTimeout(winToastTimer);
    winToastTimer = window.setTimeout(() => {
      toast.classList.add('hidden');
      winToastTimer = null;
    }, 4500);
  }
}

let joystickTouchVx = 0;
let joystickTouchVz = 0;
let isTouchJoystickActive = false;

// Process keyboard and touch virtual joystick controls for carriage flat XZ movement and tilt 3D joystick
function handleKeyboardMove(dt: number) {
  if (claw.state !== 'IDLE') {
    cabinet.setJoystickTilt(0, 0);
    return;
  }

  let vx = 0;
  let vz = 0;

  if (keys.w || keys.ArrowUp) vz -= 1;
  if (keys.s || keys.ArrowDown) vz += 1;
  if (keys.a || keys.ArrowLeft) vx -= 1;
  if (keys.d || keys.ArrowRight) vx += 1;

  if (vx !== 0 && vz !== 0) {
    const len = Math.sqrt(vx * vx + vz * vz);
    vx /= len;
    vz /= len;
  }

  // Combine with touch virtual joystick on mobile devices
  if (isTouchJoystickActive) {
    vx = joystickTouchVx;
    vz = joystickTouchVz;
  }

  if (vx !== 0 || vz !== 0) {
    claw.moveCarriage(vx, vz, dt);
    cabinet.setJoystickTilt(vx, vz);
    soundEngine.playMotorStepSFX();
  } else if (!isMouseDraggingJoystick) {
    cabinet.setJoystickTilt(0, 0);
  }
}

// Sync values from DIP Admin UI panel to physical variables (100% Crash-Proof)
function applyDIPSettings() {
  const getVal = (id: string, fallback: number) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return el ? parseFloat(el.value) : fallback;
  };
  const getStr = (id: string, fallback: string) => {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    return el ? el.value : fallback;
  };

  const strongPercent = getVal('setting-strong', 100);
  const weakPercent = getVal('setting-weak', 69);
  const heightPercent = getVal('setting-height', 76);
  const tophitPercent = getVal('setting-tophit', 13);
  const antiswing = getStr('setting-antiswing', 'disabled');
  const speed = getVal('setting-speed', 2.0);
  const dropSpeed = getVal('setting-dropspeed', 2.0);
  const swayScale = getVal('setting-sway', 1.4);
  const length = getVal('setting-length', 9.0);
  const baffleHeight = getVal('setting-baffle', 0.7);

  if (claw && claw.config) {
    claw.config.strongStiffness = (strongPercent / 100) * 250.0;
    claw.config.weakStiffness = (weakPercent / 100) * 250.0;
    claw.config.mediumStiffness = (claw.config.strongStiffness + claw.config.weakStiffness) / 2;
    claw.config.weakHeightThreshold = heightPercent / 100;
    claw.config.topHitProbability = tophitPercent / 100;
    claw.config.moveSpeed = speed;
    claw.config.dropSpeed = dropSpeed;
    claw.config.swayScale = swayScale;
    claw.config.maxRopeLength = length;
    claw.config.antiSwingEnabled = (antiswing === 'enabled');
    claw.updateAntiSwingDamping();
  }

  if (cabinet) {
    cabinet.setBaffleHeight(baffleHeight, physics);
  }

  const setTxt = (id: string, txt: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt('val-strong', strongPercent + '%');
  setTxt('val-weak', weakPercent + '%');
  setTxt('val-height', heightPercent + '%');
  setTxt('val-tophit', tophitPercent + '%');
  setTxt('val-speed', speed.toFixed(1));
  setTxt('val-dropspeed', dropSpeed.toFixed(1));
  setTxt('val-sway', swayScale.toFixed(1));
  setTxt('val-length', length.toFixed(1));
  setTxt('val-baffle', baffleHeight.toFixed(1));
}

function updateStatsUI() {
  if (coinsEl) coinsEl.textContent = coins.toString();
  if (playsEl) playsEl.textContent = plays.toString();
  if (winsEl) winsEl.textContent = wins.toString();

  const rate = plays > 0 ? Math.round((wins / plays) * 100) : 0;
  if (rateEl) rateEl.textContent = rate + '%';

  // Enable action button if coins exist
  updateActionButtonState();
}

function updateActionButtonState() {
  const mobileDropBtn = document.getElementById('mobile-drop-btn') as HTMLButtonElement | null;

  if (claw.state === 'IDLE') {
    dropBtn.disabled = false;
    dropBtn.querySelector('span')!.textContent = '下爪 / 二收';
    if (mobileDropBtn) {
      mobileDropBtn.disabled = false;
      mobileDropBtn.querySelector('span')!.textContent = '下爪 / 二收';
    }
  } else if (claw.state === 'DESCENDING') {
    dropBtn.disabled = false;
    dropBtn.querySelector('span')!.textContent = '二收 (合爪)';
    if (mobileDropBtn) {
      mobileDropBtn.disabled = false;
      mobileDropBtn.querySelector('span')!.textContent = '二收 (合爪)';
    }
  } else if (claw.state === 'ASCENDING') {
    dropBtn.disabled = false;
    dropBtn.querySelector('span')!.textContent = '二拍 (強退)';
    if (mobileDropBtn) {
      mobileDropBtn.disabled = false;
      mobileDropBtn.querySelector('span')!.textContent = '二拍 (強退)';
    }
  } else {
    dropBtn.disabled = true;
    dropBtn.querySelector('span')!.textContent = '請等待...';
    if (mobileDropBtn) {
      mobileDropBtn.disabled = true;
      mobileDropBtn.querySelector('span')!.textContent = '請等待...';
    }
  }
}

function updateClawStateUI() {
  updateActionButtonState();
}

// Action button logic that routes based on current claw state (Free unlimited play without coins requirement!)
function triggerActionButtonAction() {
  if (claw.state === 'IDLE') {
    if (levelSystem?.getCurrentConfig().stageNum === 5 && stageDrops >= 30) return;
    if (levelSystem?.getCurrentConfig().stageNum === 5) {
      stageDrops++;
      stageExhaustedAt = 0;
      updateStageHint(`剩餘下爪次數：${30-stageDrops} 次`);
    }
    plays++;
    updateStatsUI();
    soundEngine.playCoinDropSFX();
    claw.actionButtonPressed(prizesManager);
  } else if (claw.state === 'DESCENDING') {
    // Triggers "二收"
    soundEngine.playClawCloseSFX();
    claw.actionButtonPressed(prizesManager);
  } else if (claw.state === 'ASCENDING') {
    // Triggers "二拍強退"
    soundEngine.playClawCloseSFX();
    claw.actionButtonPressed(prizesManager);
  }
}

function setupUIEventListeners() {
  // ── Leaderboard & Player Nickname Management ──
  leaderboardManager = new LeaderboardManager();

  const updateHudPlayerName = () => {
    const hudPlayerEl = document.getElementById('hud-player-name');
    if (hudPlayerEl) {
      const name = leaderboardManager.getPlayerName();
      hudPlayerEl.textContent = name || '設定暱稱';
    }
  };
  updateHudPlayerName();

  const nicknameModal = document.getElementById('nickname-modal');
  const playerNicknameInput = document.getElementById('player-nickname-input') as HTMLInputElement | null;
  const playerProfileBtn = document.getElementById('player-profile-btn');
  const closeNicknameBtn = document.getElementById('close-nickname-btn');
  const saveNicknameBtn = document.getElementById('save-nickname-btn');

  // Auto prompt nickname on first visit if not yet configured
  if (!localStorage.getItem('claw_player_nickname')) {
    setTimeout(() => {
      if (nicknameModal) {
        nicknameModal.style.display = 'flex';
        if (playerNicknameInput) playerNicknameInput.focus();
      }
    }, 450);
  }

  const handleSaveNickname = () => {
    if (playerNicknameInput) {
      const val = playerNicknameInput.value.trim();
      if (val) {
        leaderboardManager.setPlayerName(val);
        campaignProgress = loadCampaignProgress(LEVEL_CONFIGS.length,val);
        if (levelSystem) levelSystem.startLevel(campaignProgress.unlockedStage-1);
        refreshStageUnlocks();
        updateHudPlayerName();
      }
    }
    if (nicknameModal) nicknameModal.style.display = 'none';
  };

  playerProfileBtn?.addEventListener('click', () => {
    if (nicknameModal) {
      nicknameModal.style.display = 'flex';
      if (playerNicknameInput) {
        playerNicknameInput.value = leaderboardManager.getPlayerName();
        playerNicknameInput.focus();
      }
    }
  });

  closeNicknameBtn?.addEventListener('click', () => {
    if (nicknameModal) nicknameModal.style.display = 'none';
  });

  saveNicknameBtn?.addEventListener('click', () => {
    handleSaveNickname();
  });

  playerNicknameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSaveNickname();
    }
  });

  nicknameModal?.addEventListener('click', (e) => {
    if (e.target === nicknameModal) nicknameModal.style.display = 'none';
  });

  // ── Live Record-Breaking Leaderboard ──
  const leaderboardModal = document.getElementById('leaderboard-modal');
  const openLeaderboardBtn = document.getElementById('open-leaderboard-btn');
  const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');

  const renderLeaderboardUI = () => {
    const status = document.getElementById('leaderboard-sync-status');
    if (status) status.textContent = leaderboardManager.hasPendingRecords ? '新紀錄已保存在本機，等待 Google Sheet 確認' : leaderboardManager.cloudStatus==='connected' ? 'Google Sheet 已更新' :
      leaderboardManager.cloudStatus==='loading' ? '正在讀取 Google Sheet…' : '雲端暫時無法讀取，顯示本機紀錄';
    // 1. Records Hall (各關最高紀錄保持人)
    const hallContainer = document.getElementById('records-hall-container');
    if (hallContainer) {
      const records = leaderboardManager.getBestRecords().map(rec=>({...rec,title:escapeLeaderboardText(rec.title),
        holderName:escapeLeaderboardText(rec.holderName),formattedTime:escapeLeaderboardText(rec.formattedTime),date:escapeLeaderboardText(rec.date)}));
      hallContainer.innerHTML = records.map((rec) => `
        <div class="record-hall-card">
          <div class="record-hall-header">
            <span class="record-badge">${rec.title}</span>
            <span class="record-time">${rec.formattedTime}</span>
          </div>
          <div class="record-hall-holder">
            <span class="holder-label">歷史紀錄保持人</span>
            <span class="holder-name">${rec.holderName}</span>
          </div>
          <div class="record-hall-meta">
            <span>達成日期：${rec.date}</span>
            <span>投幣累積：${rec.plays===null ? '未記錄' : `${rec.plays} 次`}</span>
          </div>
        </div>
      `).join('') + LEVEL_CONFIGS.filter(level=>!records.some(record=>record.recordKey===`stage-${level.stageNum}`))
        .map(level=>`<div class="record-hall-card"><span class="record-badge">第 ${level.stageNum} 關 最速紀錄</span><p>尚無通關紀錄</p></div>`).join('');
    }

    // 2. Break Events Timeline (即時打破紀錄歷史動態)
    const eventsContainer = document.getElementById('record-events-container');
    if (eventsContainer) {
      const events = leaderboardManager.getRecentBreakEvents().map(ev=>({...ev,playerName:escapeLeaderboardText(ev.playerName),
        recordType:escapeLeaderboardText(ev.recordType),stageName:escapeLeaderboardText(ev.stageName),
        timeFormatted:escapeLeaderboardText(ev.timeFormatted),date:escapeLeaderboardText(ev.date)}));
      if (events.length === 0) {
        eventsContainer.innerHTML = `<div class="empty-events" style="color: #94a3b8; font-size: 13px; text-align: center; padding: 18px 0;">目前尚無破紀錄事件，只要以更短時間通關即可名垂榮譽榜！</div>`;
      } else {
        eventsContainer.innerHTML = events.slice(0, 15).map((ev) => `
          <div class="record-event-row">
            <div class="event-indicator"><svg viewBox="0 0 20 20" fill="currentColor" class="inline-svg-icon" style="color: #facc15;"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg></div>
            <div class="event-detail">
              <div class="event-text">
                <span class="event-player">${ev.playerName}</span> 
                <span class="event-type">${ev.recordType}</span>！
                (最速成績：<span class="event-time">${ev.timeFormatted}</span>)
              </div>
              <div class="event-date">${ev.date} · ${ev.stageName}</div>
            </div>
          </div>
        `).join('');
      }
    }
  };

  leaderboardManager.onRecordsUpdated = renderLeaderboardUI;
  void leaderboardManager.refreshFromGoogleSheets();

  openLeaderboardBtn?.addEventListener('click', () => {
    if (leaderboardModal) {
      renderLeaderboardUI();
      leaderboardModal.style.display = 'flex';
      void leaderboardManager.refreshFromGoogleSheets();
    }
  });

  closeLeaderboardBtn?.addEventListener('click', () => {
    if (leaderboardModal) leaderboardModal.style.display = 'none';
  });

  leaderboardModal?.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) leaderboardModal.style.display = 'none';
  });

  // Desktop Action Button
  if (dropBtn) {
    dropBtn.addEventListener('click', () => {
      triggerActionButtonAction();
    });
  }

  // Mobile Touch Action Button
  const mobileDropBtn = document.getElementById('mobile-drop-btn');
  if (mobileDropBtn) {
    mobileDropBtn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerActionButtonAction();
    });
  }

  // Mobile Touch Virtual Joystick
  const joystickBase = document.getElementById('joystick-touch-base');
  const joystickStick = document.getElementById('joystick-touch-stick');

  if (joystickBase && joystickStick) {
    let touchId: number | null = null;
    let baseRect: DOMRect;
    let centerX = 0;
    let centerY = 0;
    const maxRadius = 38;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (touchId !== null) return;
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      baseRect = joystickBase.getBoundingClientRect();
      centerX = baseRect.left + baseRect.width / 2;
      centerY = baseRect.top + baseRect.height / 2;
      updateJoystickTouch(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchId === null) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          const touch = e.changedTouches[i];
          updateJoystickTouch(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          joystickTouchVx = 0;
          joystickTouchVz = 0;
          isTouchJoystickActive = false;
          joystickStick.style.transform = `translate(0px, 0px)`;
          cabinet.setJoystickTilt(0, 0);
          break;
        }
      }
    };

    const updateJoystickTouch = (clientX: number, clientY: number) => {
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;

      joystickTouchVx = dx / maxRadius;
      joystickTouchVz = dy / maxRadius;
      isTouchJoystickActive = (dist > 3);
    };

    joystickBase.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  // 📋 Open & Close Stage Briefing Modal
  const openBriefingBtn = document.getElementById('open-briefing-btn');
  const briefingModal = document.getElementById('briefing-modal');
  const closeBriefingBtn = document.getElementById('close-briefing-btn');
  const startChallengeBtn = document.getElementById('start-challenge-btn');
  const openFreeStageSelect = () => {
    if (!campaignProgress.completed) return;
    for (const id of ['game-victory-modal','stage-clear-modal','game-over-modal']) {
      const modal = document.getElementById(id);
      if (modal) modal.style.display='none';
    }
    if (briefingModal) briefingModal.style.display='flex';
  };
  document.getElementById('open-stage-select-btn')?.addEventListener('click',openFreeStageSelect);
  document.getElementById('victory-select-stage-btn')?.addEventListener('click',openFreeStageSelect);

  if (openBriefingBtn && briefingModal) {
    openBriefingBtn.addEventListener('click', () => {
      briefingModal.style.display = 'flex';
    });
  }
  if (closeBriefingBtn && briefingModal) {
    closeBriefingBtn.addEventListener('click', () => {
      briefingModal.style.display = 'none';
    });
  }
  if (startChallengeBtn && briefingModal) {
    startChallengeBtn.addEventListener('click', () => {
      briefingModal.style.display = 'none';
    });
  }
  if (briefingModal) {
    briefingModal.addEventListener('click', (e) => {
      if (e.target === briefingModal) briefingModal.style.display = 'none';
    });
  }

  // 🚀 Quick Stage Jump Buttons inside Briefing Modal
  document.querySelectorAll('.stage-jump-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const stageIdx = parseInt((e.target as HTMLElement).getAttribute('data-stage') || '0');
      if (stageIdx + 1 > campaignProgress.unlockedStage) return;
      if (briefingModal) briefingModal.style.display = 'none';
      if (levelSystem) levelSystem.startLevel(stageIdx);
    });
  });

  // 🎉 Stage Clear Modal Action Button
  document.getElementById('next-stage-btn')?.addEventListener('click', () => {
    const clearModal = document.getElementById('stage-clear-modal');
    if (clearModal) clearModal.style.display = 'none';
    if (levelSystem) levelSystem.nextLevel();
  });

  // 💀 Game Over Modal Action Buttons
  document.getElementById('retry-stage-btn')?.addEventListener('click', () => {
    const gameOverModal = document.getElementById('game-over-modal');
    if (gameOverModal) gameOverModal.style.display = 'none';
    if (levelSystem) levelSystem.restartCurrentLevel();
  });
  document.getElementById('restart-campaign-btn')?.addEventListener('click', () => {
    const gameOverModal = document.getElementById('game-over-modal');
    if (gameOverModal) gameOverModal.style.display = 'none';
    if (levelSystem) levelSystem.restartCampaign();
  });

  // 👑 Grand Victory Modal Action Button
  document.getElementById('victory-restart-btn')?.addEventListener('click', () => {
    const victoryModal = document.getElementById('game-victory-modal');
    if (victoryModal) victoryModal.style.display = 'none';
    if (levelSystem) levelSystem.restartCampaign();
  });

  // Preset Random Barrier Layout (🎯 經典槍位隨機擺台)
  document.getElementById('preset-barrier-btn')?.addEventListener('click', () => {
    prizesManager.spawnRandomPresetBarrier();
  });

  // Manual Placement Mode Toggle (📍 手動擺台模式)
  const manualBanner = document.getElementById('manual-place-banner');
  const toggleManualBtn = document.getElementById('toggle-manual-place-btn');
  const exitManualBtn = document.getElementById('exit-manual-place-btn');

  const setManualMode = (active: boolean) => {
    isManualPlaceMode = active;
    if (manualBanner) {
      if (active) {
        manualBanner.classList.remove('hidden');
        settingsPanel?.classList.remove('open');
        settingsPanel?.classList.add('collapsed');
      } else {
        manualBanner.classList.add('hidden');
      }
    }
  };

  toggleManualBtn?.addEventListener('click', () => setManualMode(true));
  exitManualBtn?.addEventListener('click', () => setManualMode(false));

  // 3D Canvas Raycast Click for Manual Stock Placement (即點即擺)
  const canvasContainer = document.getElementById('canvas-container');
  const placePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);

  canvasContainer?.addEventListener('pointerdown', (e) => {
    if (!isManualPlaceMode) return;

    // Convert mouse to NDCs
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const targetPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(placePlane, targetPoint)) {
      // Clamp position inside machine cabinet boundaries
      const maxBoundX = (cabinet.width / 2) - 0.8;
      const maxBoundZ = (cabinet.depth / 2) - 0.8;
      const clampedX = Math.max(-maxBoundX, Math.min(maxBoundX, targetPoint.x));
      const clampedZ = Math.max(-maxBoundZ, Math.min(maxBoundZ, targetPoint.z));
      const prizeType = (document.getElementById('setting-prizetype') as HTMLSelectElement).value;

      prizesManager.spawnSinglePrize(clampedX, 1.2, clampedZ, prizeType);
      soundEngine.playScratchSFX();
    }
  });

  const respawnCurrentPrizes = () => {
    const dollCount = parseInt((document.getElementById('setting-dolls') as HTMLInputElement).value);
    const prizeType = (document.getElementById('setting-prizetype') as HTMLSelectElement).value;
    const chuteBounds = {
      minX: cabinet.chuteMinX,
      maxX: cabinet.chuteMaxX,
      minZ: cabinet.chuteMinZ,
      maxZ: cabinet.chuteMaxZ
    };
    let spreadRadius = 5.0;
    if (currentMachineMode === 'small') spreadRadius = 3.4;
    else if (currentMachineMode === 'large') spreadRadius = 6.4;
    else if (currentMachineMode === 'kbasket') spreadRadius = 8.0;

    prizesManager.spawnPrizes(dollCount, prizeType, spreadRadius, chuteBounds);
  };

  // Reset toys
  document.getElementById('reset-toys-btn')!.addEventListener('click', () => {
    respawnCurrentPrizes();
  });

  document.getElementById('setting-prizetype')!.addEventListener('change', () => {
    respawnCurrentPrizes();
  });

  // Clear stats
  document.getElementById('reset-stats-btn')!.addEventListener('click', () => {
    coins = 0;
    plays = 0;
    wins = 0;
    updateStatsUI();
  });

  // Reset to Optimal Presets (Stage 1 Photo Settings)
  document.getElementById('reset-presets-btn')!.addEventListener('click', () => {
    (document.getElementById('setting-strong') as HTMLInputElement).value = '100';
    (document.getElementById('setting-height') as HTMLInputElement).value = '76';
    (document.getElementById('setting-weak') as HTMLInputElement).value = '69';
    (document.getElementById('setting-tophit') as HTMLInputElement).value = '13';
    (document.getElementById('setting-speed') as HTMLInputElement).value = '2.0';
    (document.getElementById('setting-dropspeed') as HTMLInputElement).value = '2.0';
    (document.getElementById('setting-sway') as HTMLInputElement).value = '1.4';
    (document.getElementById('setting-length') as HTMLInputElement).value = '9.5';
    (document.getElementById('setting-baffle') as HTMLInputElement).value = '0.7';
    (document.getElementById('setting-dolls') as HTMLInputElement).value = '42';
    (document.getElementById('setting-prize-weight') as HTMLInputElement).value = '1';
    (document.getElementById('setting-rolling-resistance') as HTMLInputElement).value = '1';
    applyPrizeTuning();
    saveTuningConfigToStorage();
    (document.getElementById('setting-antiswing') as HTMLSelectElement).value = 'disabled';

    applyDIPSettings();
    document.getElementById('val-dolls')!.textContent = '42';
    (document.getElementById('setting-prizetype') as HTMLSelectElement).value = 'mixed';
    respawnCurrentPrizes();
  });

  // 🟢 佛心天使台 (100% 強爪、85% 爬升維持、65% 弱爪、0 撞頂、0.3m 擋板)
  document.getElementById('preset-angel-btn')?.addEventListener('click', () => {
    (document.getElementById('setting-strong') as HTMLInputElement).value = '100';
    (document.getElementById('setting-height') as HTMLInputElement).value = '85';
    (document.getElementById('setting-weak') as HTMLInputElement).value = '65';
    (document.getElementById('setting-tophit') as HTMLInputElement).value = '0';
    (document.getElementById('setting-speed') as HTMLInputElement).value = '2.6';
    (document.getElementById('setting-dropspeed') as HTMLInputElement).value = '2.0';
    (document.getElementById('setting-sway') as HTMLInputElement).value = '1.35';
    (document.getElementById('setting-baffle') as HTMLInputElement).value = '0.3';
    applyDIPSettings();
    soundEngine.playCoinDropSFX();
  });

  // 🟡 街機技術台 (標準強爪 92%、55% 爬升、35% 弱爪、20% 撞頂、0.5m 擋板)
  document.getElementById('preset-arcade-btn')?.addEventListener('click', () => {
    (document.getElementById('setting-strong') as HTMLInputElement).value = '92';
    (document.getElementById('setting-height') as HTMLInputElement).value = '55';
    (document.getElementById('setting-weak') as HTMLInputElement).value = '35';
    (document.getElementById('setting-tophit') as HTMLInputElement).value = '20';
    (document.getElementById('setting-speed') as HTMLInputElement).value = '2.6';
    (document.getElementById('setting-dropspeed') as HTMLInputElement).value = '2.0';
    (document.getElementById('setting-sway') as HTMLInputElement).value = '1.45';
    (document.getElementById('setting-baffle') as HTMLInputElement).value = '0.5';
    applyDIPSettings();
    soundEngine.playCoinDropSFX();
  });

  // 🔴 西門町黑心台 (摸摸爪 20%、10% 弱爪、100% 撞頂震落、1.2m 超高擋板)
  document.getElementById('preset-devil-btn')?.addEventListener('click', () => {
    (document.getElementById('setting-strong') as HTMLInputElement).value = '20';
    (document.getElementById('setting-height') as HTMLInputElement).value = '30';
    (document.getElementById('setting-weak') as HTMLInputElement).value = '10';
    (document.getElementById('setting-tophit') as HTMLInputElement).value = '100';
    (document.getElementById('setting-speed') as HTMLInputElement).value = '2.8';
    (document.getElementById('setting-dropspeed') as HTMLInputElement).value = '2.2';
    (document.getElementById('setting-sway') as HTMLInputElement).value = '1.25';
    (document.getElementById('setting-baffle') as HTMLInputElement).value = '1.2';
    applyDIPSettings();
    soundEngine.playCoinDropSFX();
  });

  // Live update sliders mapping
  const sliders = [
    'setting-strong', 
    'setting-weak', 
    'setting-height', 
    'setting-tophit', 
    'setting-speed', 
    'setting-dropspeed',
    'setting-sway',
    'setting-length',
    'setting-baffle'
  ];
  sliders.forEach(id => {
    document.getElementById(id)!.addEventListener('input', applyDIPSettings);
  });
  document.getElementById('setting-antiswing')!.addEventListener('change', applyDIPSettings);

  // ── Machine Switching Logic (經典機台 vs K-霸 巨無霸家電玩具機台) ──
  // Helper to force 100% synchronization of DIP UI controls and physics parameters
  function syncDIPPanelUI(params: {
    strong: string;
    height: string;
    weak: string;
    tophit: string;
    speed: string;
    dropspeed?: string;
    sway?: string;
    length: string;
    baffle: string;
    dolls: string;
    antiswing: string;
    prizetype: string;
    weight?: string;
    rolling?: string;
  }) {
    const strongEl = document.getElementById('setting-strong') as HTMLInputElement | null;
    const heightEl = document.getElementById('setting-height') as HTMLInputElement | null;
    const weakEl = document.getElementById('setting-weak') as HTMLInputElement | null;
    const tophitEl = document.getElementById('setting-tophit') as HTMLInputElement | null;
    const speedEl = document.getElementById('setting-speed') as HTMLInputElement | null;
    const dropspeedEl = document.getElementById('setting-dropspeed') as HTMLInputElement | null;
    const swayEl = document.getElementById('setting-sway') as HTMLInputElement | null;
    const lengthEl = document.getElementById('setting-length') as HTMLInputElement | null;
    const baffleEl = document.getElementById('setting-baffle') as HTMLInputElement | null;
    const dollsEl = document.getElementById('setting-dolls') as HTMLInputElement | null;
    const antiEl = document.getElementById('setting-antiswing') as HTMLSelectElement | null;
    const prizeEl = document.getElementById('setting-prizetype') as HTMLSelectElement | null;

    const setInput = (el: HTMLInputElement | null, val: string) => {
      if (el) {
        el.value = val;
        el.defaultValue = val;
        el.setAttribute('value', val);
      }
    };

    setInput(strongEl, params.strong);
    setInput(heightEl, params.height);
    setInput(weakEl, params.weak);
    setInput(tophitEl, params.tophit);
    setInput(speedEl, params.speed || '1.3');
    if (dropspeedEl) setInput(dropspeedEl, params.dropspeed || '2.0');
    if (swayEl) setInput(swayEl, params.sway || '1.2');
    setInput(lengthEl, params.length || '9.0');
    setInput(baffleEl, params.baffle || '0.5');
    setInput(dollsEl, params.dolls || '6');

    if (antiEl) antiEl.value = params.antiswing || 'disabled';
    if (prizeEl) prizeEl.value = params.prizetype || 'blindbox';

    // Update text readouts
    const setTxt = (id: string, txt: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('val-strong', (params.strong || '100') + '%');
    setTxt('val-height', (params.height || '76') + '%');
    setTxt('val-weak', (params.weak || '69') + '%');
    setTxt('val-tophit', (params.tophit || '13') + '%');
    setTxt('val-speed', parseFloat(params.speed || '2.0').toFixed(1));
    setTxt('val-dropspeed', parseFloat(params.dropspeed || '2.0').toFixed(1));
    setTxt('val-sway', parseFloat(params.sway || '1.4').toFixed(1));
    setTxt('val-length', parseFloat(params.length || '9.0').toFixed(1));
    setTxt('val-baffle', parseFloat(params.baffle || '0.7').toFixed(1));
    setTxt('val-dolls', params.dolls || '40');

    // Dispatch DOM events so range slider thumbs re-render visually in all browsers
    [strongEl, heightEl, weakEl, tophitEl, speedEl, dropspeedEl, swayEl, lengthEl, baffleEl, dollsEl].forEach(el => {
      if (el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    applyDIPSettings();
    if (params.weight !== undefined && params.rolling !== undefined) {
      (document.getElementById('setting-prize-weight') as HTMLInputElement).value = params.weight;
      (document.getElementById('setting-rolling-resistance') as HTMLInputElement).value = params.rolling;
      applyPrizeTuning();
    }
  }

  let currentMachineMode: string = 'medium';
  let cameraViewMode: 'front' | 'side' = 'front';

  function applyCameraView(mode = currentMachineMode, view = cameraViewMode) {
    fitMachineCamera(camera,controls,cabinet,view === 'side');
  }

  function switchMachineMode(mode: string, stageNum = 1) {
    // Normalize aliases
    if (mode === 'sanrio') mode = 'small';
    if (mode === 'standard') mode = 'medium';
    if (mode === 'anime') mode = 'large';

    currentMachineMode = mode;
    claw.forceTopRelease = stageNum === 7;
    physics.substeps = stageNum === 7 ? 8 : 2;
    const modeSelect = document.getElementById('setting-machinemode') as HTMLSelectElement | null;
    if (modeSelect) modeSelect.value = mode;

    // 1. Clear all existing prizes completely first!
    prizesManager.clearPrizes();

    // 2. Rebuild the single physical cabinet to target scale & theme
    if (cabinet) {
      cabinet.bounceFloor = stageNum === 7;
      cabinet.rebuildCabinet(mode, physics);
    }

    // 3. Dynamic chute & home positions
    const chuteHomeX = (cabinet.chuteMinX + cabinet.chuteMaxX) / 2;
    const chuteHomeZ = (cabinet.chuteMinZ + cabinet.chuteMaxZ) / 2;
    const chuteBounds = {
      minX: cabinet.chuteMinX,
      maxX: cabinet.chuteMaxX,
      minZ: cabinet.chuteMinZ,
      maxZ: cabinet.chuteMaxZ
    };

    if (mode === 'small') {
      // 小型機台 (第三關：潮玩盲盒 8分鐘清台戰 - 嚴格按照照片參數)
      claw.setClawScale(0.85);
      claw.setMachineBounds(chuteHomeX, chuteHomeZ, 2.05, cabinet.height);

      syncDIPPanelUI({
        strong: '86',
        height: '68',
        weak: '57',
        tophit: '23',
        speed: '3.0',
        dropspeed: '2.0',
        sway: '1.0',
        length: '9.5',
        baffle: '0.1',
        dolls: '5',
        antiswing: 'disabled',
        prizetype: 'blindbox', weight:'0.60', rolling:'0.35'
      });

      prizesManager.spawnPrizes(5, 'blindbox', 2.2, chuteBounds);

      cameraViewMode = 'front';
      applyCameraView('small', 'front');
    } else if (mode === 'large') {
      // 中大機台 (第二關：動漫公仔 10分鐘夾4樣 - 嚴格按照照片參數)
      claw.setClawScale(1.15);
      claw.setMachineBounds(chuteHomeX, chuteHomeZ, 3.7, cabinet.height);

      syncDIPPanelUI({
        strong: '95',
        height: '62',
        weak: '49',
        tophit: '15',
        speed: '1.8',
        dropspeed: '2.0',
        sway: '1.4',
        length: '7.5',
        baffle: '1.0',
        dolls: '25',
        antiswing: 'disabled',
        prizetype: 'anime'
      });

      prizesManager.spawnPrizes(25, 'anime', 4.8, chuteBounds);
      applyCameraView('large', cameraViewMode);
    } else if (mode === 'kbasket') {
      // K-霸機台 (第四關：終極魔王關 8分鐘夾3樣 - 1.35x 霸王巨爪 + 12大盒巨型家電)
      claw.setClawScale(1.35);
      claw.setMachineBounds(chuteHomeX, chuteHomeZ, 4.8, cabinet.height);

      syncDIPPanelUI({
        strong: '75',
        height: '55',
        weak: '43',
        tophit: '35',
        speed: '2.0',
        dropspeed: '2.0',
        sway: '1.4',
        length: '9.5',
        baffle: '0',
        dolls: '18',
        antiswing: 'disabled',
        prizetype: 'giant_appliances', weight:'0.60', rolling:'0.35'
      });

      prizesManager.spawnPrizes(18, 'giant_appliances', 6.0, chuteBounds);
      applyCameraView('kbasket', cameraViewMode);
    } else if (stageNum >= 5) {
      claw.setClawScale(1.0);
      claw.setMachineBounds(chuteHomeX,chuteHomeZ,3.0,cabinet.height);
      syncDIPPanelUI({
        strong:stageNum === 5 ? '75' : stageNum === 6 ? '88' : '98', height:stageNum === 5 ? '55' : '76', weak:stageNum === 5 ? '43' : stageNum === 6 ? '65' : '98',
        tophit:stageNum === 5 ? '35' : stageNum === 6 ? '20' : '100', speed:stageNum === 6 ? '2.6' : '2.0', dropspeed:'2.0',
        sway:stageNum === 6 ? '1.6' : '1.4', length:'9.5', baffle:stageNum === 5 ? '0.3' : stageNum === 6 ? '0.6' : '0.7',
        dolls:stageNum === 5 ? '18' : stageNum === 6 ? '15' : '2',
        antiswing:'disabled',prizetype:stageNum === 7 ? 'onepiece' : 'mixed',
        ...(stageNum === 6 ? {weight:'0.60',rolling:'0.35'} : {})
      });
      prizesManager.spawnPrizes(stageNum === 7 ? 2 : stageNum === 5 ? 18 : 12,stageNum === 7 ? 'onepiece' : 'mixed',stageNum === 7 ? 3.8 : 4.8,chuteBounds);
      if (stageNum === 7) {
        for (const body of prizesManager.bodies) { body.setLinearDamping(0.1); body.setAngularDamping(0.35); }
      }
      if (stageNum === 6) {
        for (const [index,type] of ['eevee','cookie_box','squirtle'].entries()) {
          spawnMarkedTarget(type,`stage6-${index}`,0.15+index*0.8,-1.25+index*0.45);
        }
      }
      applyCameraView(mode,cameraViewMode);
    } else {
      // 中型機台 (第一關：初試身手 15分鐘夾8樣 - 嚴格按照照片參數)
      claw.setClawScale(1.0);
      claw.setMachineBounds(chuteHomeX, chuteHomeZ, 3.0, cabinet.height);

      syncDIPPanelUI({
        strong: '100',
        height: '76',
        weak: '69',
        tophit: '13',
        speed: '2.0',
        dropspeed: '2.0',
        sway: '1.4',
        length: '9.5',
        baffle: '0.7',
        dolls: '42',
        antiswing: 'disabled',
        prizetype: 'mixed'
      });

      prizesManager.spawnPrizes(42, 'mixed', 4.8, chuteBounds);
      applyCameraView('medium', cameraViewMode);
    }
    claw.setPlayfieldBounds(cabinet.width,cabinet.depth);
    layoutArcadeNeighbors(scene,cabinet.width);
  }

  // Expose globally for instant button bindings
  (window as any).switchMachineMode = switchMachineMode;
  (window as any).applyCameraView = applyCameraView;

  document.getElementById('power-saver-btn')?.addEventListener('click', () => {
    (window as any).togglePowerSaver();
  });

  document.getElementById('setting-machinemode')?.addEventListener('change', (e) => {
    const targetMode = (e.target as HTMLSelectElement).value;
    switchMachineMode(targetMode);
  });

  const dollsInput = document.getElementById('setting-dolls') as HTMLInputElement | null;
  const prizeWeightInput = document.getElementById('setting-prize-weight') as HTMLInputElement | null;
  const rollingInput = document.getElementById('setting-rolling-resistance') as HTMLInputElement | null;
  const applyPrizeTuning = () => {
    prizesManager.weightMultiplier = parseFloat(prizeWeightInput?.value ?? '1');
    prizesManager.rollingResistance = parseFloat(rollingInput?.value ?? '1');
    document.getElementById('val-prize-weight')!.textContent = `${prizesManager.weightMultiplier.toFixed(2)}x`;
    document.getElementById('val-rolling-resistance')!.textContent = `${prizesManager.rollingResistance.toFixed(2)}x`;
    prizesManager.applyPrizePhysics();
  };
  [prizeWeightInput,rollingInput].forEach(input => input?.addEventListener('input',applyPrizeTuning));
  if (dollsInput) {
    dollsInput.addEventListener('input', () => {
      const valEl = document.getElementById('val-dolls');
      if (valEl) valEl.textContent = dollsInput.value;
    });
  }

  // 🔐 Collapsible Settings Panel Drawer with Password Authentication
  let isAdminUnlocked = false;
  const settingsPanel = document.getElementById('settings-panel') as HTMLElement | null;
  const toggleBtn = document.getElementById('toggle-settings-btn') as HTMLElement | null;
  const closePanelBtn = document.getElementById('close-settings-btn') as HTMLElement | null;

  const adminAuthModal = document.getElementById('admin-auth-modal') as HTMLElement | null;
  const adminPwdInput = document.getElementById('admin-password-input') as HTMLInputElement | null;
  const submitAdminPwdBtn = document.getElementById('submit-admin-password-btn') as HTMLElement | null;
  const closeAdminAuthBtn = document.getElementById('close-admin-auth-btn') as HTMLElement | null;
  const adminAuthError = document.getElementById('admin-auth-error') as HTMLElement | null;

  const openAdminPanel = () => {
    if (settingsPanel) {
      settingsPanel.classList.add('open');
      settingsPanel.classList.remove('collapsed');
    }
  };

  const checkAndSubmitAdminPassword = () => {
    const entered = adminPwdInput ? adminPwdInput.value.trim() : '';
    // Accepts '8888', 'admin888', '6666'
    if (entered === '8888' || entered === 'admin888' || entered === '6666') {
      isAdminUnlocked = true;
      if (adminAuthError) adminAuthError.style.display = 'none';
      if (adminAuthModal) adminAuthModal.style.display = 'none';
      openAdminPanel();
    } else {
      if (adminAuthError) adminAuthError.style.display = 'block';
      if (adminPwdInput) {
        adminPwdInput.focus();
        adminPwdInput.select();
      }
    }
  };

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (isAdminUnlocked) {
        if (settingsPanel) {
          settingsPanel.classList.toggle('open');
          settingsPanel.classList.toggle('collapsed');
        }
      } else {
        if (adminAuthModal) {
          adminAuthModal.style.display = 'flex';
          if (adminAuthError) adminAuthError.style.display = 'none';
          if (adminPwdInput) {
            adminPwdInput.value = '';
            setTimeout(() => adminPwdInput.focus(), 150);
          }
        }
      }
    });
  }

  if (submitAdminPwdBtn) {
    submitAdminPwdBtn.addEventListener('click', checkAndSubmitAdminPassword);
  }
  if (adminPwdInput) {
    adminPwdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkAndSubmitAdminPassword();
    });
  }
  if (closeAdminAuthBtn && adminAuthModal) {
    closeAdminAuthBtn.addEventListener('click', () => {
      adminAuthModal.style.display = 'none';
    });
    adminAuthModal.addEventListener('click', (e) => {
      if (e.target === adminAuthModal) adminAuthModal.style.display = 'none';
    });
  }

  if (closePanelBtn && settingsPanel) {
    closePanelBtn.addEventListener('click', () => {
      settingsPanel.classList.remove('open');
      settingsPanel.classList.add('collapsed');
    });
  }

  // 🌟 God Mode (無敵保夾必中模式)
  const godmodeCheckbox = document.getElementById('setting-godmode') as HTMLInputElement | null;
  if (godmodeCheckbox) {
    godmodeCheckbox.addEventListener('change', () => {
      claw.config.godMode = godmodeCheckbox.checked;
      if (godmodeCheckbox.checked) {
        claw.config.strongStiffness = 350.0;
        claw.config.weakStiffness = 300.0;
        claw.config.topHitProbability = 0;
        claw.config.weakHeightThreshold = 0.99;
      } else {
        applyDIPSettings();
      }
    });
  }

  // 🎯 Stage 3 Custom Difficulty Settings (盲盒清台戰調參)
  const s3Target = document.getElementById('setting-stage3-target') as HTMLInputElement | null;
  const s3Time = document.getElementById('setting-stage3-time') as HTMLInputElement | null;
  const s3Friction = document.getElementById('setting-stage3-friction') as HTMLInputElement | null;

  if (s3Target) {
    s3Target.addEventListener('input', () => {
      const val = parseInt(s3Target.value);
      const valEl = document.getElementById('val-stage3-target');
      if (valEl) valEl.textContent = `${val} 盒`;
      levelSystem.updateConfig(3, {
        targetWins: val,
        isClearAll: val >= 5,
        objectiveText: val >= 5 ? '清台！(台內 5 盒盲盒全數清空)' : `夾出 ${val} 盒盲盒`
      });
    });
  }
  if (s3Time) {
    s3Time.addEventListener('input', () => {
      const val = parseInt(s3Time.value);
      const valEl = document.getElementById('val-stage3-time');
      if (valEl) valEl.textContent = `${val} 分鐘`;
      levelSystem.updateConfig(3, { timeLimitSeconds: val * 60 });
    });
  }
  if (s3Friction) {
    s3Friction.addEventListener('change', () => {
      const frictionVal = s3Friction.checked ? 1.5 : 0.45;
      prizesManager.bodies.forEach(b => {
        for (let i = 0; i < b.numColliders(); i++) {
          b.collider(i).setFriction(frictionVal);
        }
      });
    });
  }

  // ⚡ Stage 4 Custom Difficulty Settings (K-霸家電魔王關調參)
  const s4Target = document.getElementById('setting-stage4-target') as HTMLInputElement | null;
  const s4Time = document.getElementById('setting-stage4-time') as HTMLInputElement | null;
  const s4Baffle = document.getElementById('setting-stage4-baffle') as HTMLInputElement | null;
  const s4Grip = document.getElementById('setting-stage4-grip') as HTMLInputElement | null;
  const s4Lightweight = document.getElementById('setting-stage4-lightweight') as HTMLInputElement | null;

  if (s4Target) {
    s4Target.addEventListener('input', () => {
      const val = parseInt(s4Target.value);
      const valEl = document.getElementById('val-stage4-target');
      if (valEl) valEl.textContent = `${val} 樣`;
      levelSystem.updateConfig(4, { targetWins: val, objectiveText: `夾出 ${val} 樣巨型家電` });
    });
  }
  if (s4Time) {
    s4Time.addEventListener('input', () => {
      const val = parseInt(s4Time.value);
      const valEl = document.getElementById('val-stage4-time');
      if (valEl) valEl.textContent = `${val} 分鐘`;
      levelSystem.updateConfig(4, { timeLimitSeconds: val * 60 });
    });
  }
  if (s4Baffle) {
    s4Baffle.addEventListener('input', () => {
      const val = parseFloat(s4Baffle.value);
      const valEl = document.getElementById('val-stage4-baffle');
      if (valEl) valEl.textContent = `${val.toFixed(1)} m`;
      if (cabinet && physics) {
        cabinet.setBaffleHeight(val, physics);
      }
    });
  }
  if (s4Grip) {
    s4Grip.addEventListener('input', () => {
      const val = parseFloat(s4Grip.value);
      const valEl = document.getElementById('val-stage4-grip');
      if (valEl) valEl.textContent = `${val.toFixed(1)}x`;
      claw.config.superGripMultiplier = val;
    });
  }
  if (s4Lightweight) {
    s4Lightweight.addEventListener('change', () => {
      prizesManager.applianceLightweight = s4Lightweight.checked;
      prizesManager.applyPrizePhysics();
    });
  }

  // 🚀 Stage Debug Shortcuts & Persistence
  const TUNING_STORAGE_KEY = 'claw_custom_tuning_v2';

  const saveTuningConfigToStorage = () => {
    try {
      const cfg = {
        prizeWeight: prizesManager.weightMultiplier,
        rollingResistance: prizesManager.rollingResistance,
        godMode: godmodeCheckbox?.checked || false,
        stage3Target: s3Target ? parseInt(s3Target.value) : 5,
        stage3Time: s3Time ? parseInt(s3Time.value) : 8,
        stage3Friction: s3Friction?.checked ?? true,
        stage4Target: s4Target ? parseInt(s4Target.value) : 3,
        stage4Time: s4Time ? parseInt(s4Time.value) : 8,
        stage4Baffle: s4Baffle ? parseFloat(s4Baffle.value) : 1.1,
        stage4Grip: s4Grip ? parseFloat(s4Grip.value) : 1.0,
        stage4Lightweight: s4Lightweight?.checked || false,
      };
      localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  };

  const loadTuningConfigFromStorage = () => {
    try {
      const raw = localStorage.getItem(TUNING_STORAGE_KEY);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (prizeWeightInput && Number.isFinite(cfg.prizeWeight)) prizeWeightInput.value = String(Math.max(0.25,Math.min(3,cfg.prizeWeight)));
      if (rollingInput && Number.isFinite(cfg.rollingResistance)) rollingInput.value = String(Math.max(0.25,Math.min(3,cfg.rollingResistance)));
      if (godmodeCheckbox && typeof cfg.godMode === 'boolean') {
        godmodeCheckbox.checked = cfg.godMode;
        claw.config.godMode = cfg.godMode;
      }
      if (s3Target && cfg.stage3Target !== undefined) {
        s3Target.value = String(cfg.stage3Target);
        const el = document.getElementById('val-stage3-target');
        if (el) el.textContent = `${cfg.stage3Target} 盒`;
        levelSystem.updateConfig(3, {
          targetWins: cfg.stage3Target,
          isClearAll: cfg.stage3Target >= 5,
          objectiveText: cfg.stage3Target >= 5 ? '清台！(台內 5 盒盲盒全數清空)' : `夾出 ${cfg.stage3Target} 盒盲盒`
        });
      }
      if (s3Time && cfg.stage3Time !== undefined) {
        s3Time.value = String(cfg.stage3Time);
        const el = document.getElementById('val-stage3-time');
        if (el) el.textContent = `${cfg.stage3Time} 分鐘`;
        levelSystem.updateConfig(3, { timeLimitSeconds: cfg.stage3Time * 60 });
      }
      if (s3Friction && cfg.stage3Friction !== undefined) {
        s3Friction.checked = cfg.stage3Friction;
      }
      if (s4Target && cfg.stage4Target !== undefined) {
        s4Target.value = String(cfg.stage4Target);
        const el = document.getElementById('val-stage4-target');
        if (el) el.textContent = `${cfg.stage4Target} 樣`;
        levelSystem.updateConfig(4, { targetWins: cfg.stage4Target, objectiveText: `夾出 ${cfg.stage4Target} 樣巨型家電` });
      }
      if (s4Time && cfg.stage4Time !== undefined) {
        s4Time.value = String(cfg.stage4Time);
        const el = document.getElementById('val-stage4-time');
        if (el) el.textContent = `${cfg.stage4Time} 分鐘`;
        levelSystem.updateConfig(4, { timeLimitSeconds: cfg.stage4Time * 60 });
      }
      if (s4Baffle && cfg.stage4Baffle !== undefined) {
        s4Baffle.value = String(cfg.stage4Baffle);
        const el = document.getElementById('val-stage4-baffle');
        if (el) el.textContent = `${Number(cfg.stage4Baffle).toFixed(1)} m`;
      }
      if (s4Grip && cfg.stage4Grip !== undefined) {
        s4Grip.value = String(cfg.stage4Grip);
        const el = document.getElementById('val-stage4-grip');
        if (el) el.textContent = `${Number(cfg.stage4Grip).toFixed(1)}x`;
        claw.config.superGripMultiplier = cfg.stage4Grip;
      }
      if (s4Lightweight && cfg.stage4Lightweight !== undefined) {
        s4Lightweight.checked = cfg.stage4Lightweight;
        prizesManager.applianceLightweight = s4Lightweight.checked;
      }
      applyPrizeTuning();
    } catch (e) {}
  };

  // Wire auto-save to input events
  [s3Target, s3Time, s4Target, s4Time, s4Baffle, s4Grip, prizeWeightInput, rollingInput].forEach(input => {
    input?.addEventListener('change', saveTuningConfigToStorage);
  });
  [godmodeCheckbox, s3Friction, s4Lightweight].forEach(toggle => {
    toggle?.addEventListener('change', saveTuningConfigToStorage);
  });

  // Copy parameters button
  document.getElementById('copy-config-btn')?.addEventListener('click', () => {
    const cfg = {
      prizeWeight: prizesManager.weightMultiplier,
      rollingResistance: prizesManager.rollingResistance,
      stage3Target: s3Target ? parseInt(s3Target.value) : 5,
      stage3Time: s3Time ? parseInt(s3Time.value) : 8,
      stage3Friction: s3Friction?.checked ?? true,
      stage4Target: s4Target ? parseInt(s4Target.value) : 3,
      stage4Time: s4Time ? parseInt(s4Time.value) : 8,
      stage4Baffle: s4Baffle ? parseFloat(s4Baffle.value) : 1.1,
      stage4Grip: s4Grip ? parseFloat(s4Grip.value) : 1.0,
      stage4Lightweight: s4Lightweight?.checked || false,
      godMode: godmodeCheckbox?.checked || false,
    };
    const text = JSON.stringify(cfg, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('已複製當前所有自訂參數！您可以直接貼在對話框發給助理，我會立即將這些數值永久寫入專案原始碼並推送至 GitHub！');
      }).catch(() => {
        prompt('請手動複製以下設定參數發給助理寫入程式碼：', text);
      });
    } else {
      prompt('請手動複製以下設定參數發給助理寫入程式碼：', text);
    }
  });

  document.getElementById('jump-stage3-btn')?.addEventListener('click', () => {
    levelSystem.startLevel(2); // Stage 3 is index 2
    settingsPanel?.classList.remove('open');
    settingsPanel?.classList.add('collapsed');
  });
  document.getElementById('jump-stage4-btn')?.addEventListener('click', () => {
    levelSystem.startLevel(3); // Stage 4 is index 3
    settingsPanel?.classList.remove('open');
    settingsPanel?.classList.add('collapsed');
  });
  document.getElementById('force-clear-btn')?.addEventListener('click', () => {
    levelSystem.forceStageClear();
    settingsPanel?.classList.remove('open');
    settingsPanel?.classList.add('collapsed');
  });

  // Safe manual modal event listeners
  const manualModal = document.getElementById('manual-modal');
  if (manualModal) {
    document.getElementById('open-manual-btn')?.addEventListener('click', () => {
      manualModal.style.display = 'flex';
    });
    document.getElementById('close-manual-btn')?.addEventListener('click', () => {
      manualModal.style.display = 'none';
    });
    manualModal.addEventListener('click', (e) => {
      if (e.target === manualModal) manualModal.style.display = 'none';
    });
  }

  const refreshStageUnlocks = () => {
    const selectButton = document.getElementById('open-stage-select-btn');
    if (selectButton) selectButton.style.display=campaignProgress.completed ? '' : 'none';
    document.querySelectorAll<HTMLButtonElement>('.stage-jump-btn').forEach(button => {
      const number = Number(button.dataset.stage) + 1;
      button.disabled = number > campaignProgress.unlockedStage;
      button.textContent = button.disabled ? `第 ${number} 關尚未解鎖` : `挑戰第 ${number} 關`;
    });
  };
  refreshStageUnlocks();

  // 🎮 Initialize 7-Stage Challenge Progression System
  levelSystem = new LevelSystem({
    onLevelStarted: (level) => {
      stageDrops = 0;
      stageExhaustedAt = 0;
      const titleEl = document.getElementById('hud-level-title');
      if (titleEl) titleEl.textContent = level.shortName;
      
      switchMachineMode(level.machineMode,level.stageNum);
      updateStageHint(level.stageNum === 5 ? '剩餘下爪次數：30 次'
        : level.stageNum === 6 ? '指定夾出 3 件微微發光的獎品'
        : level.stageNum === 7 ? '彈跳台：觸頂必掉，兩盒一番賞都出貨才過關' : '');

      // Highlight active card in briefing modal
      for (let i = 1; i <= LEVEL_CONFIGS.length; i++) {
        const card = document.getElementById(`stage-card-${i}`);
        if (card) {
          if (i === level.stageNum) card.classList.add('active-stage');
          else card.classList.remove('active-stage');
        }
      }
    },
    onTick: (_remainingSeconds, formatted, isWarning) => {
      const timerDigits = document.getElementById('hud-timer-digits');
      if (timerDigits) timerDigits.textContent = formatted;

      const timerPill = document.getElementById('hud-timer-pill');
      if (timerPill) {
        if (isWarning) {
          timerPill.classList.add('warning-pulse');
        } else {
          timerPill.classList.remove('warning-pulse');
        }
      }

      if (isWarning && _remainingSeconds <= 10 && _remainingSeconds > 0) {
        soundEngine.playTimeWarningSFX();
      }
    },
    onProgressUpdated: (currentWins, targetWins, isClearAll, remainingItems) => {
      const targetProgress = document.getElementById('hud-target-progress');
      if (targetProgress) {
        targetProgress.textContent = isClearAll ? `剩餘 ${remainingItems} 樣` : `${currentWins} / ${targetWins} 樣`;
      }

      const toastProgress = document.getElementById('win-toast-progress');
      if (toastProgress) {
        toastProgress.textContent = isClearAll ? `剩餘 ${remainingItems} 樣` : `${currentWins} / ${targetWins} 樣`;
      }
    },
    onStageClear: (level, elapsedSeconds, stageWins) => {
      campaignProgress.unlockedStage = Math.max(campaignProgress.unlockedStage,Math.min(LEVEL_CONFIGS.length,level.stageNum+1));
      saveCampaignProgress(campaignProgress,leaderboardManager.getPlayerName());
      refreshStageUnlocks();
      soundEngine.playStageClearSFX();
      launchConfetti();

      const clearModal = document.getElementById('stage-clear-modal');
      const stageNameEl = document.getElementById('clear-stage-name');
      const elapsedEl = document.getElementById('clear-elapsed-time');
      const winsCountEl = document.getElementById('clear-wins-count');
      const nextTitleEl = document.getElementById('next-stage-title');
      const nextDetailsEl = document.getElementById('next-stage-details');

      const formattedTime = levelSystem.getFormattedTime(elapsedSeconds);

      if (stageNameEl) stageNameEl.textContent = `恭喜通過 ${level.name}！`;
      if (elapsedEl) elapsedEl.textContent = formattedTime;
      if (winsCountEl) winsCountEl.textContent = `${stageWins} 樣`;

      // 檢查並紀錄單關破紀錄 (誰打破紀錄)
      if (leaderboardManager) {
        const recordResult = leaderboardManager.checkAndRecordStageWin(
          level.stageNum,
          level.name,
          elapsedSeconds,
          formattedTime,
          stageWins,
          plays
        );
        const recordBanner = document.getElementById('clear-new-record-banner');
        const recordMsg = document.getElementById('clear-record-msg');
        if (recordBanner && recordMsg) {
          if (recordResult.isNewRecord) {
            recordBanner.style.display = 'block';
            recordMsg.textContent = `太強了！【${leaderboardManager.getPlayerName()}】以 ${formattedTime} 成功打破 ${recordResult.recordTitle}！(原紀錄：${recordResult.previousBest})`;
          } else {
            recordBanner.style.display = 'none';
          }
        }
      }

      const nextLevelIndex = levelSystem.currentLevelIndex + 1;
      if (nextLevelIndex < LEVEL_CONFIGS.length) {
        const nextCfg = LEVEL_CONFIGS[nextLevelIndex];
        if (nextTitleEl) nextTitleEl.textContent = `${nextCfg.shortName}：${nextCfg.name}`;
        if (nextDetailsEl) nextDetailsEl.textContent = `${nextCfg.machineLabel} | 限時 ${Math.floor(nextCfg.timeLimitSeconds / 60)} 分鐘 | 目標：${nextCfg.objectiveText}`;
      }

      if (clearModal) clearModal.style.display = 'flex';
    },
    onGameOver: (level, _elapsedSeconds, _currentWins) => {
      soundEngine.playGameOverSFX();
      const gameOverModal = document.getElementById('game-over-modal');
      const levelNameEl = document.getElementById('game-over-level-name');
      const progressEl = document.getElementById('game-over-progress-val');

      if (levelNameEl) levelNameEl.textContent = `${level.shortName} 時間已耗盡`;
      if (progressEl) {
        progressEl.textContent = level.isClearAll 
          ? `台內剩餘 ${prizesManager.prizes.length} 盒 (未完成清台)` 
          : `${levelSystem.stageWins} / ${level.targetWins} 樣`;
      }

      if (gameOverModal) gameOverModal.style.display = 'flex';
    },
    onGameVictory: (totalElapsedSeconds, totalWins) => {
      const finalLevel = levelSystem.getCurrentConfig();
      const finalSeconds = Math.max(1,finalLevel.timeLimitSeconds-levelSystem.remainingSeconds);
      leaderboardManager.checkAndRecordStageWin(finalLevel.stageNum,finalLevel.name,finalSeconds,
        levelSystem.getFormattedTime(finalSeconds),levelSystem.stageWins,plays);
      const fullCampaignSeconds = levelSystem.getFullCampaignSeconds();
      if (fullCampaignSeconds!==null) leaderboardManager.checkAndRecordGrandVictory(fullCampaignSeconds,
        levelSystem.getFormattedTime(fullCampaignSeconds),totalWins,plays);
      campaignProgress = {unlockedStage:LEVEL_CONFIGS.length,completed:true};
      saveCampaignProgress(campaignProgress,leaderboardManager.getPlayerName());
      refreshStageUnlocks();
      soundEngine.playGameVictorySFX();
      launchConfetti();

      const victoryModal = document.getElementById('game-victory-modal');
      const totalTimeEl = document.getElementById('victory-total-time');
      const totalWinsEl = document.getElementById('victory-total-wins');
      const totalPlaysEl = document.getElementById('victory-total-plays');

      const formattedTotalTime = levelSystem.getFormattedTime(totalElapsedSeconds);

      if (totalTimeEl) totalTimeEl.textContent = formattedTotalTime;
      if (totalWinsEl) totalWinsEl.textContent = `${totalWins} 樣`;
      if (totalPlaysEl) totalPlaysEl.textContent = `${plays} 次`;

      if (victoryModal) victoryModal.style.display = 'flex';
    }
  });

  // Restore tuning only after the level configuration API is initialized.
  loadTuningConfigFromStorage();

  const previewStage = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('previewStage')) : 0;
  levelSystem.startLevel(previewStage >= 1 && previewStage <= LEVEL_CONFIGS.length
    ? Math.floor(previewStage)-1 : campaignProgress.unlockedStage-1);
  updateStatsUI();
}

let joystickStartPos = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

function setupKeyboardListeners() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.key in keys) keys[e.key] = true;

    // Space key binds directly to action button
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault(); 
      triggerActionButtonAction();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (e.key in keys) keys[e.key] = false;
  });

  // Interactive 3D Joystick Mouse Drag & Click
  const canvas = renderer.domElement;
  
  canvas.addEventListener('pointerdown', (e) => {
    const bounds = canvas.getBoundingClientRect();
    mouseVec.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouseVec.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(mouseVec, camera);
    const intersects = raycaster.intersectObjects([
      cabinet.joystickBall,
      cabinet.actionButtonMesh,
      cabinet.joystickGroup
    ], true);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      if (hitObj.name === 'actionButton') {
        triggerActionButtonAction();
      } else {
        isMouseDraggingJoystick = true;
        joystickStartPos = { x: e.clientX, y: e.clientY };
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isMouseDraggingJoystick) return;
    const dx = e.clientX - joystickStartPos.x;
    const dy = e.clientY - joystickStartPos.y;

    const maxDist = 60;
    const vx = Math.max(-1, Math.min(1, dx / maxDist));
    const vz = Math.max(-1, Math.min(1, dy / maxDist));

    if (claw.state === 'IDLE') {
      claw.moveCarriage(vx, vz, 0.016);
      cabinet.setJoystickTilt(vx, vz);
    }
  });

  const stopJoystickDrag = () => {
    if (isMouseDraggingJoystick) {
      isMouseDraggingJoystick = false;
      cabinet.setJoystickTilt(0, 0);
    }
  };

  window.addEventListener('pointerup', stopJoystickDrag);
  window.addEventListener('pointercancel', stopJoystickDrag);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if ((window as any).applyCameraView) {
      (window as any).applyCameraView();
    }
  });
}

// Start Game
init().catch(error => {
  console.error(error);
  const loading = document.getElementById('asset-loading');
  if (loading) {
    loading.classList.add('failed');
    document.getElementById('asset-progress')!.textContent = `載入失敗：${error instanceof Error ? error.message : String(error)}`;
    document.getElementById('asset-retry')!.hidden = false;
  }
});
document.getElementById('asset-retry')?.addEventListener('click',() => location.reload());
