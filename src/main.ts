import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PhysicsSystem } from './physics';
import { Cabinet } from './cabinet';
import { Claw } from './claw';
import { PrizesManager } from './prizes';
import { soundEngine } from './audio';
import { scratchcardManager } from './scratchcard';

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

let winToastTimer: number | null = null;

function showWinAlert() {
  soundEngine.playWinSFX();
  scratchcardManager.addChance(1);

  const toast = document.getElementById('win-toast');
  if (toast) {
    const textEl = toast.querySelector('.win-toast-text');
    if (textEl) {
      textEl.textContent = '恭喜中獎！成功夾出娃娃！獲得 1 次刮刮樂！🏆';
    }
    toast.classList.remove('hidden');
    if (winToastTimer !== null) clearTimeout(winToastTimer);
    winToastTimer = window.setTimeout(() => {
      toast.classList.add('hidden');
      winToastTimer = null;
    }, 5000);
  }
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

  // Start BGM on first user click gesture
  window.addEventListener('click', () => {
    soundEngine.startBGM();
  }, { once: true });

  // BGM Mute/Unmute Toggle
  const bgmBtn = document.getElementById('bgm-toggle-btn');
  if (bgmBtn) {
    bgmBtn.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      bgmBtn.innerHTML = `🎵 <span class="nav-btn-label">${isMuted ? '背景音樂 (關)' : '背景音樂 (開)'}</span>`;
    });
  }

  // Open Scratchcard Modal
  const openScratchBtn = document.getElementById('open-scratch-btn');
  if (openScratchBtn) {
    openScratchBtn.addEventListener('click', () => {
      scratchcardManager.openModal();
    });
  }

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
      const clampedX = Math.max(-3.2, Math.min(3.2, targetPoint.x));
      const clampedZ = Math.max(-3.2, Math.min(3.2, targetPoint.z));
      const prizeType = (document.getElementById('setting-prizetype') as HTMLSelectElement).value;

      prizesManager.spawnSinglePrize(clampedX, 1.2, clampedZ, prizeType);
      soundEngine.playScratchSFX();
    }
  });

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
    (document.getElementById('setting-height') as HTMLInputElement).value = '60';
    (document.getElementById('setting-weak') as HTMLInputElement).value = '40';
    (document.getElementById('setting-tophit') as HTMLInputElement).value = '25';
    (document.getElementById('setting-speed') as HTMLInputElement).value = '4.0';
    (document.getElementById('setting-length') as HTMLInputElement).value = '13.5';
    (document.getElementById('setting-baffle') as HTMLInputElement).value = '0.5';
    (document.getElementById('setting-dolls') as HTMLInputElement).value = '100';
    (document.getElementById('setting-antiswing') as HTMLSelectElement).value = 'disabled';

    applyDIPSettings();
    document.getElementById('val-dolls')!.textContent = '100';
    const prizeType = (document.getElementById('setting-prizetype') as HTMLSelectElement)?.value || 'mixed';
    prizesManager.spawnPrizes(100, prizeType);
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
  // Deep midnight blue JP arcade atmosphere
  scene.background = new THREE.Color(0x0f0a1e);
  scene.fog = new THREE.FogExp2(0x0f0a1e, 0.004);

  // ===== 1. VIBRANT FLOOR: Pink & White Gloss Tiles with Gold Seams =====
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fctx = floorCanvas.getContext('2d')!;

  // Soft warm white base
  fctx.fillStyle = '#fff8f8';
  fctx.fillRect(0, 0, 512, 512);

  // Candy pink alternating tiles
  fctx.fillStyle = '#ffd6e7';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 1) {
        fctx.fillRect(c * 128 + 2, r * 128 + 2, 124, 124);
      }
    }
  }

  // Inner highlight gloss on each tile
  fctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      fctx.fillRect(c * 128 + 8, r * 128 + 8, 50, 28);
    }
  }

  // Gold grout lines
  fctx.strokeStyle = '#f9a825';
  fctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i, 512); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(0, i); fctx.lineTo(512, i); fctx.stroke();
  }

  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(10, 10);

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.08, metalness: 0.18 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.01;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // ===== 2. BACKGROUND WALL: JP Arcade Night Sky =====
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 2048;
  wallCanvas.height = 1024;
  const wctx = wallCanvas.getContext('2d')!;

  // Deep night gradient: midnight indigo -> dark magenta
  const wallGrad = wctx.createLinearGradient(0, 0, 0, 1024);
  wallGrad.addColorStop(0, '#0d0221');
  wallGrad.addColorStop(0.45, '#1a0533');
  wallGrad.addColorStop(1, '#2d0a4e');
  wctx.fillStyle = wallGrad;
  wctx.fillRect(0, 0, 2048, 1024);

  // Glowing neon grid lines
  wctx.strokeStyle = 'rgba(190, 0, 255, 0.18)';
  wctx.lineWidth = 1.5;
  for (let gx = 0; gx <= 2048; gx += 128) {
    wctx.beginPath(); wctx.moveTo(gx, 0); wctx.lineTo(gx, 1024); wctx.stroke();
  }
  for (let gy = 0; gy <= 1024; gy += 128) {
    wctx.beginPath(); wctx.moveTo(0, gy); wctx.lineTo(2048, gy); wctx.stroke();
  }

  // Twinkling stars
  for (let i = 0; i < 180; i++) {
    const sx = (i * 317 + 47) % 2048;
    const sy = (i * 233 + 19) % 1024;
    const sr = 1.5 + (i % 4) * 1.2;
    const alpha = 0.4 + (i % 5) * 0.12;
    wctx.fillStyle = `rgba(255, 240, 255, ${alpha})`;
    wctx.beginPath(); wctx.arc(sx, sy, sr, 0, Math.PI * 2); wctx.fill();
  }

  // Neon glow circles (bokeh effect)
  const bokehs = [
    { x: 300, y: 200, r: 80, color: 'rgba(255, 0, 200, 0.07)' },
    { x: 900, y: 600, r: 120, color: 'rgba(100, 0, 255, 0.07)' },
    { x: 1600, y: 300, r: 100, color: 'rgba(0, 200, 255, 0.06)' },
    { x: 1200, y: 800, r: 90, color: 'rgba(255, 100, 0, 0.05)' },
    { x: 500, y: 700, r: 70, color: 'rgba(0, 255, 180, 0.06)' },
  ];
  bokehs.forEach(b => {
    const bg = wctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    bg.addColorStop(0, b.color);
    bg.addColorStop(1, 'transparent');
    wctx.fillStyle = bg;
    wctx.beginPath(); wctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); wctx.fill();
  });

  // Floating cute icons row
  const icons = ['🎀', '⭐', '🎠', '💫', '🌸', '🎪', '🎡', '✨', '🎀', '🌟', '🎠', '💝', '🌸', '⭐', '🎡', '🎀'];
  wctx.font = '56px serif';
  icons.forEach((icon, i) => {
    wctx.fillText(icon, 60 + i * 128, 950);
  });

  const wallTex = new THREE.CanvasTexture(wallCanvas);
  wallTex.wrapS = THREE.ClampToEdgeWrapping;
  wallTex.wrapT = THREE.ClampToEdgeWrapping;

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, metalness: 0.05 });
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), wallMat);
  wallMesh.position.set(0, 18, -20);
  scene.add(wallMesh);

  // Side walls
  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x0d0221, roughness: 0.9 });
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(50, 40), sideWallMat);
  leftWall.position.set(-35, 18, 5);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(50, 40), sideWallMat);
  rightWall.position.set(35, 18, 5);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // ===== 3. NEON STORE BANNER =====
  const bannerGroup = new THREE.Group();
  bannerGroup.position.set(0, 13.5, -11.5);

  // Dark back panel
  const bannerBack = new THREE.Mesh(new THREE.BoxGeometry(18, 4.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x0d0221, roughness: 0.4, metalness: 0.3 }));
  bannerGroup.add(bannerBack);

  // Hot pink outer glow frame
  const bannerFrame = new THREE.Mesh(new THREE.BoxGeometry(18.5, 4.7, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff00aa }));
  bannerFrame.position.z = -0.08;
  bannerGroup.add(bannerFrame);

  // Inner cyan glow rim
  const innerRim = new THREE.Mesh(new THREE.BoxGeometry(18.1, 4.3, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x00eeff }));
  innerRim.position.z = -0.04;
  bannerGroup.add(innerRim);

  // Banner canvas texture
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 2048;
  bannerCanvas.height = 480;
  const bctx = bannerCanvas.getContext('2d')!;

  // Deep dark gradient bg
  const bgrad = bctx.createLinearGradient(0, 0, 2048, 0);
  bgrad.addColorStop(0, '#0d0221');
  bgrad.addColorStop(0.5, '#1a0040');
  bgrad.addColorStop(1, '#0d0221');
  bctx.fillStyle = bgrad;
  bctx.fillRect(0, 0, 2048, 480);

  // Neon title glow
  bctx.shadowColor = '#ff00cc';
  bctx.shadowBlur = 30;
  bctx.fillStyle = '#ffffff';
  bctx.font = '900 88px serif';
  bctx.textAlign = 'center';
  bctx.fillText('🎀 夢幻 3D 娃娃機旗艦店 🎀', 1024, 175);

  bctx.shadowColor = '#00ccff';
  bctx.shadowBlur = 20;
  bctx.fillStyle = '#00eeff';
  bctx.font = '700 52px sans-serif';
  bctx.fillText('✨ 吉依卡哇 · 七龍珠 · 海賊王 · 三麗鷗 ✨', 1024, 285);

  bctx.shadowColor = '#ffcc00';
  bctx.shadowBlur = 12;
  bctx.fillStyle = '#ffe066';
  bctx.font = '600 38px sans-serif';
  bctx.fillText('🌸 每局精彩 · 保底必得 · 新品每週更新 🌸', 1024, 385);

  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true });
  const bannerPlane = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 3.9), bannerMat);
  bannerPlane.position.z = 0.12;
  bannerGroup.add(bannerPlane);

  scene.add(bannerGroup);

  // ===== 4. NEON LIGHT STRIPS on ceiling =====
  const neonColors = [0xff00aa, 0x00eeff, 0xff6600, 0xaaff00];
  neonColors.forEach((col, i) => {
    const stripMat = new THREE.MeshBasicMaterial({ color: col });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(30, 0.12, 0.12), stripMat);
    strip.position.set(0, 9 + i * 0.3, -8 + i * 2);
    scene.add(strip);
  });

  // ===== 5. AMBIENT POINT LIGHTS for neon mood =====
  const neonLight1 = new THREE.PointLight(0xff00aa, 1.2, 25);
  neonLight1.position.set(-12, 8, -8);
  scene.add(neonLight1);

  const neonLight2 = new THREE.PointLight(0x00eeff, 1.0, 25);
  neonLight2.position.set(12, 8, -8);
  scene.add(neonLight2);

  const warmLight = new THREE.PointLight(0xffcc66, 0.6, 30);
  warmLight.position.set(0, 10, 8);
  scene.add(warmLight);
}

// Start Game
init();
