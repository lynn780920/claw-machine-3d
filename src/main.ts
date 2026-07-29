import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PhysicsSystem } from './physics';
import { Cabinet } from './cabinet';
import { Claw } from './claw';
import { PrizesManager } from './prizes';

// Game Statistics
let coins = 0;
let plays = 0;
let wins = 0;

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
const clawStatusEl = document.getElementById('claw-status')!;
const coinsEl = document.getElementById('stat-coins')!;
const playsEl = document.getElementById('stat-plays')!;
const winsEl = document.getElementById('stat-wins')!;
const rateEl = document.getElementById('stat-rate')!;
const dropBtn = document.getElementById('drop-btn') as HTMLButtonElement;
const insertCoinBtn = document.getElementById('insert-coin-btn') as HTMLButtonElement;

async function init() {
  // 1. Initialize physics compat environment
  physics = new PhysicsSystem();
  await physics.init();

  // 2. Setup Three.js scene with 3D Arcade Game Room Environment
  scene = new THREE.Scene();
  createArcadeEnvironment(scene);

  // Camera settings matching User's preferred screenshot camera angle
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 5.6, 9.2); // Player eye-level front-facing view matching user screenshot

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas') as HTMLCanvasElement, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // View controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 18;
  controls.target.set(0, 3.2, 0); // Focus camera on dolls playfield

  // Studio High-Key Lighting matching Reference Photo
  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambient);

  // Warm Golden LED Ceiling Light (Matching Yellow Roof Light in Reference Photo)
  const ceilingLight = new THREE.PointLight(0xffb703, 6.0, 15);
  ceilingLight.position.set(0, 7.8, 0);
  scene.add(ceilingLight);

  // Main Overhead Spotlight
  const mainSpot = new THREE.SpotLight(0xffffff, 3.5, 25, Math.PI / 2.5, 0.6, 1);
  mainSpot.position.set(0, 8.8, 2);
  mainSpot.castShadow = true;
  mainSpot.shadow.mapSize.width = 1024;
  mainSpot.shadow.mapSize.height = 1024;
  mainSpot.shadow.camera.near = 0.5;
  mainSpot.shadow.camera.far = 10;
  mainSpot.shadow.bias = -0.0005;
  scene.add(mainSpot);

  // Front Studio Fill Light illuminating colorful dolls
  const frontFill = new THREE.DirectionalLight(0xffffff, 1.6);
  frontFill.position.set(0, 5, 8);
  scene.add(frontFill);

  // 4. Instantiate machine components
  cabinet = new Cabinet(scene, physics);
  claw = new Claw(scene, physics);
  
  prizesManager = new PrizesManager(scene, physics);
  const dollCount = parseInt((document.getElementById('setting-dolls') as HTMLInputElement).value);
  prizesManager.spawnPrizes(dollCount);

  // 5. Connect UI settings and keyboard event listeners
  setupUIEventListeners();
  setupKeyboardListeners();

  // 6. Game loop
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.03); // cap delta to keep physics stable
    
    // Move carriage horizontally
    handleKeyboardMove(dt);

    // Update claw state machine
    claw.update(dt, physics, prizesManager);
    
    // Step Rapier3D physics simulation
    physics.step();

    // Sync helper guides / indicator ring
    const clawPos = claw.baseMesh.position;
    cabinet.updateIndicator(clawPos.x, clawPos.z, clawPos.y);

    // Check if dolls fell into chute
    checkWinCondition();

    // Update state text
    updateClawStateUI();

    // Update camera controls
    controls.update();
    
    renderer.render(scene, camera);
  }
  
  animate();
}

// Check if any dolls fell down the exit chute
function checkWinCondition() {
  const minX = cabinet.chuteMinX;
  const maxX = cabinet.chuteMaxX;
  const minZ = cabinet.chuteMinZ;
  const maxZ = cabinet.chuteMaxZ;

  prizesManager.bodies.forEach((body, idx) => {
    const pos = body.translation();
    
    // If prize fell below floor level inside the chute footprint
    if (pos.x >= minX && pos.x <= maxX && 
        pos.z >= minZ && pos.z <= maxZ && 
        pos.y < -0.3) {
      
      const prizeMesh = prizesManager.prizes[idx];
      
      // Visual shrink-and-delete animation
      let scale = 1.0;
      const shrink = setInterval(() => {
        scale -= 0.1;
        if (scale <= 0.1) {
          clearInterval(shrink);
          scene.remove(prizeMesh);
        } else {
          prizeMesh.scale.set(scale, scale, scale);
        }
      }, 50);

      physics.unregisterBody(body);
      physics.world.removeRigidBody(body);

      prizesManager.bodies.splice(idx, 1);
      prizesManager.prizes.splice(idx, 1);

      wins++;
      updateStatsUI();
      showWinAlert();
    }
  });
}

function showWinAlert() {
  clawStatusEl.textContent = '🎉 恭喜出貨！ 🎉';
  clawStatusEl.classList.add('highlight');
  setTimeout(() => {
    clawStatusEl.classList.remove('highlight');
  }, 3000);
}

// Process keyboard controls for carriage flat XZ movement and tilt 3D joystick
function handleKeyboardMove(dt: number) {
  if (claw.state !== 'IDLE') {
    cabinet.setJoystickTilt(0, 0);
    return;
  }

  let vx = 0;
  let vz = 0;

  if (keys.w || keys.ArrowUp) vz = -1;
  if (keys.s || keys.ArrowDown) vz = 1;
  if (keys.a || keys.ArrowLeft) vx = -1;
  if (keys.d || keys.ArrowRight) vx = 1;

  if (vx !== 0 && vz !== 0) {
    const len = Math.sqrt(vx * vx + vz * vz);
    vx /= len;
    vz /= len;
  }

  if (vx !== 0 || vz !== 0) {
    claw.moveCarriage(vx, vz, dt);
    cabinet.setJoystickTilt(vx, vz);
  } else if (!isMouseDraggingJoystick) {
    cabinet.setJoystickTilt(0, 0);
  }
}

// Sync values from DIP Admin UI panel to physical variables
function applyDIPSettings() {
  const strongPercent = parseFloat((document.getElementById('setting-strong') as HTMLInputElement).value);
  const weakPercent = parseFloat((document.getElementById('setting-weak') as HTMLInputElement).value);
  const heightPercent = parseFloat((document.getElementById('setting-height') as HTMLInputElement).value);
  const tophitPercent = parseFloat((document.getElementById('setting-tophit') as HTMLInputElement).value);
  
  const antiswing = (document.getElementById('setting-antiswing') as HTMLSelectElement).value;
  const speed = parseFloat((document.getElementById('setting-speed') as HTMLInputElement).value);
  const length = parseFloat((document.getElementById('setting-length') as HTMLInputElement).value);
  const baffleHeight = parseFloat((document.getElementById('setting-baffle') as HTMLInputElement).value);

  // Map percentages to physical motor stiffness coefficients
  // Strong stiffness: 100% = 250.0
  claw.config.strongStiffness = (strongPercent / 100) * 250.0;
  
  // Weak stiffness: 100% = 25.0, 30% = 7.5
  claw.config.weakStiffness = (weakPercent / 100) * 25.0;

  // Medium stiffness is halfway in between
  claw.config.mediumStiffness = (claw.config.strongStiffness + claw.config.weakStiffness) / 2;

  // Height trigger ratio
  claw.config.weakHeightThreshold = heightPercent / 100;

  // Top hit drop probability (0.0 to 1.0)
  claw.config.topHitProbability = tophitPercent / 100;

  // Carriage speed and cable length
  claw.config.moveSpeed = speed;
  claw.config.maxRopeLength = length;

  // Update Chute Baffle Height in real time
  cabinet.setBaffleHeight(baffleHeight, physics);

  // Anti swing damping toggle
  claw.config.antiSwingEnabled = (antiswing === 'enabled');
  claw.updateAntiSwingDamping();

  // Update DIP readouts
  document.getElementById('val-strong')!.textContent = strongPercent + '%';
  document.getElementById('val-weak')!.textContent = weakPercent + '%';
  document.getElementById('val-height')!.textContent = heightPercent + '%';
  document.getElementById('val-tophit')!.textContent = tophitPercent + '%';
  document.getElementById('val-speed')!.textContent = speed.toFixed(1);
  document.getElementById('val-length')!.textContent = length.toFixed(1);
  document.getElementById('val-baffle')!.textContent = baffleHeight.toFixed(1);
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
  if (clawStatusEl.textContent?.includes('恭喜')) return;

  let stateStr = '狀態: ';
  switch (claw.state) {
    case 'IDLE':
      stateStr += '準備就緒，請操控下爪';
      break;
    case 'DESCENDING':
      stateStr += '爪子下降中 (可按空白鍵 二收)...';
      break;
    case 'GRABBING':
      stateStr += '⚡ 電磁閥收攏 (一拍強爪)';
      break;
    case 'ASCENDING':
      stateStr += '爪子上升中 (可按空白鍵 二拍強退)...';
      break;
    case 'TOP_HIT':
      stateStr += '💥 觸頂撞擊！';
      break;
    case 'RETURNING':
      stateStr += '天車歸位中...';
      break;
    case 'RELEASING':
      stateStr += '鬆爪出貨';
      break;
    case 'RESETTING':
      stateStr += '復位中...';
      break;
  }
  clawStatusEl.textContent = stateStr;
  updateActionButtonState();
}

// Action button logic that routes based on current claw state (Free unlimited play without coins requirement!)
function triggerActionButtonAction() {
  if (claw.state === 'IDLE') {
    plays++;
    updateStatsUI();
    claw.actionButtonPressed();
  } else if (claw.state === 'DESCENDING' || claw.state === 'ASCENDING') {
    // Triggers "二收" or "二拍強退"
    claw.actionButtonPressed();
  }
}

function setupUIEventListeners() {
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
      e.preventDefault();
      if (touchId === null) return;
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

      const vx = dx / maxRadius;
      const vz = dy / maxRadius;

      if (claw.state === 'IDLE') {
        claw.moveCarriage(vx, vz, 0.016);
        cabinet.setJoystickTilt(vx, vz);
      }
    };

    joystickBase.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  // Reset toys
  document.getElementById('reset-toys-btn')!.addEventListener('click', () => {
    const dollCount = parseInt((document.getElementById('setting-dolls') as HTMLInputElement).value);
    const prizeType = (document.getElementById('setting-prizetype') as HTMLSelectElement).value;
    prizesManager.spawnPrizes(dollCount, prizeType);
  });

  document.getElementById('setting-prizetype')!.addEventListener('change', () => {
    const dollCount = parseInt((document.getElementById('setting-dolls') as HTMLInputElement).value);
    const prizeType = (document.getElementById('setting-prizetype') as HTMLSelectElement).value;
    prizesManager.spawnPrizes(dollCount, prizeType);
  });

  // Clear stats
  document.getElementById('reset-stats-btn')!.addEventListener('click', () => {
    coins = 0;
    plays = 0;
    wins = 0;
    updateStatsUI();
  });

  // Reset to Optimal Presets
  document.getElementById('reset-presets-btn')!.addEventListener('click', () => {
    (document.getElementById('setting-strong') as HTMLInputElement).value = '100';
    (document.getElementById('setting-height') as HTMLInputElement).value = '45';
    (document.getElementById('setting-weak') as HTMLInputElement).value = '40';
    (document.getElementById('setting-tophit') as HTMLInputElement).value = '25';
    (document.getElementById('setting-speed') as HTMLInputElement).value = '4.0';
    (document.getElementById('setting-length') as HTMLInputElement).value = '10.0';
    (document.getElementById('setting-baffle') as HTMLInputElement).value = '1.2';
    (document.getElementById('setting-dolls') as HTMLInputElement).value = '20';
    (document.getElementById('setting-antiswing') as HTMLSelectElement).value = 'disabled';

    applyDIPSettings();
    document.getElementById('val-dolls')!.textContent = '20';
    prizesManager.spawnPrizes(20);
  });

  // Live update sliders mapping
  const sliders = [
    'setting-strong', 
    'setting-weak', 
    'setting-height', 
    'setting-tophit', 
    'setting-speed', 
    'setting-length',
    'setting-baffle'
  ];
  sliders.forEach(id => {
    document.getElementById(id)!.addEventListener('input', applyDIPSettings);
  });
  document.getElementById('setting-antiswing')!.addEventListener('change', applyDIPSettings);

  const dollsInput = document.getElementById('setting-dolls') as HTMLInputElement;
  dollsInput.addEventListener('input', () => {
    document.getElementById('val-dolls')!.textContent = dollsInput.value;
  });

  // Collapsible Settings Panel Drawer Toggle
  const settingsPanel = document.getElementById('settings-panel') as HTMLElement;
  const toggleBtn = document.getElementById('toggle-settings-btn') as HTMLElement;
  const closePanelBtn = document.getElementById('close-settings-btn') as HTMLElement;

  if (toggleBtn && settingsPanel) {
    toggleBtn.addEventListener('click', () => {
      settingsPanel.classList.toggle('open');
      settingsPanel.classList.toggle('collapsed');
    });
  }

  if (closePanelBtn && settingsPanel) {
    closePanelBtn.addEventListener('click', () => {
      settingsPanel.classList.remove('open');
      settingsPanel.classList.add('collapsed');
    });
  }

  // Manual modal event listeners
  const manualModal = document.getElementById('manual-modal') as HTMLElement;
  document.getElementById('open-manual-btn')!.addEventListener('click', () => {
    manualModal.style.display = 'flex';
  });
  document.getElementById('close-manual-btn')!.addEventListener('click', () => {
    manualModal.style.display = 'none';
  });
  manualModal.addEventListener('click', (e) => {
    if (e.target === manualModal) manualModal.style.display = 'none';
  });

  // Apply initially
  applyDIPSettings();
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
  });
}

function createArcadeEnvironment(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x0f172a); // Slate Arcade Ambient Background
  scene.fog = new THREE.FogExp2(0x0f172a, 0.012);

  // 1. Polished Arcade Store Floor
  const floorGeo = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.18,
    metalness: 0.3
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.01;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Floor Border Neon Strips (Cyan & Magenta)
  const stripMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const stripMat2 = new THREE.MeshBasicMaterial({ color: 0xff007f });

  const strip1 = new THREE.Mesh(new THREE.BoxGeometry(50, 0.02, 0.15), stripMat1);
  strip1.position.set(0, 0.01, -10);
  scene.add(strip1);

  const strip2 = new THREE.Mesh(new THREE.BoxGeometry(50, 0.02, 0.15), stripMat2);
  strip2.position.set(0, 0.01, 10);
  scene.add(strip2);

  // 2. Arcade Back Wall & Glowing Store Banner
  const wallGeo = new THREE.PlaneGeometry(50, 25);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0b132b,
    roughness: 0.7,
    metalness: 0.1
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.set(0, 10, -12);
  scene.add(wallMesh);

  // Glowing Arcade Store Banner
  const bannerGroup = new THREE.Group();
  bannerGroup.position.set(0, 11.5, -11.8);

  const bannerBack = new THREE.Mesh(new THREE.BoxGeometry(11, 3.2, 0.2), new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.3,
    metalness: 0.8
  }));
  bannerGroup.add(bannerBack);

  const bannerFrame = new THREE.Mesh(new THREE.BoxGeometry(11.4, 3.6, 0.1), new THREE.MeshBasicMaterial({
    color: 0x00f0ff
  }));
  bannerFrame.position.z = -0.1;
  bannerGroup.add(bannerFrame);

  // Canvas Neon Logo Texture
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 320);

  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#00f0ff';
  ctx.font = '900 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎮 街機娃娃機專賣店 🏆', 512, 130);

  ctx.shadowColor = '#ff007f';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#ff007f';
  ctx.font = '700 38px sans-serif';
  ctx.fillText('✨ 挑戰極限甩爪 · 爪無虛發 ✨', 512, 220);

  const logoTex = new THREE.CanvasTexture(canvas);
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true });
  const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 3.0), logoMat);
  logoPlane.position.z = 0.12;
  bannerGroup.add(logoPlane);

  scene.add(bannerGroup);
}

// Start Game
init();
