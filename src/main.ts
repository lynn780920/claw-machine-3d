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

  // Auto-detect Mobile Device & Power Saver Defaults
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  let powerSaverMode = isMobileDevice;

  // Mobile-optimized Renderer setup (capped pixel ratio 1.0 on mobile to stop battery drain)
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas') as HTMLCanvasElement, antialias: !isMobileDevice, powerPreference: 'low-power' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(powerSaverMode ? 1.0 : Math.min(window.devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = !powerSaverMode;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Global Power Saver Toggle
  (window as any).togglePowerSaver = (enable?: boolean) => {
    powerSaverMode = (enable !== undefined) ? enable : !powerSaverMode;
    renderer.setPixelRatio(powerSaverMode ? 1.0 : Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = !powerSaverMode;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = !powerSaverMode;
        obj.receiveShadow = !powerSaverMode;
      }
    });
    const btn = document.getElementById('power-saver-btn');
    if (btn) {
      btn.textContent = powerSaverMode ? '⚡ 手機極速省電 (已開啟)' : '🚀 高畫質流暢模式';
      btn.style.background = powerSaverMode ? '#10b981' : '#6366f1';
    }
  };

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
  mainSpot.shadow.bias = -0.0008;
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

  // 6. Game loop with FPS Throttling for battery saving
  const clock = new THREE.Clock();
  let lastFrameTime = 0;
  const targetFPS = 60;
  const frameInterval = 1000 / targetFPS;
  
  function animate(now: number) {
    requestAnimationFrame(animate);

    const elapsed = now - lastFrameTime;
    if (elapsed < frameInterval - 1) return; // Skip extra frames for battery saving
    lastFrameTime = now - (elapsed % frameInterval);
    
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
  
  animate(0);
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
  const weakPercent = getVal('setting-weak', 40);
  const heightPercent = getVal('setting-height', 60);
  const tophitPercent = getVal('setting-tophit', 25);
  const antiswing = getStr('setting-antiswing', 'disabled');
  const speed = getVal('setting-speed', 4.0);
  const length = getVal('setting-length', 13.5);
  const baffleHeight = getVal('setting-baffle', 0.5);

  if (claw && claw.config) {
    claw.config.strongStiffness = (strongPercent / 100) * 250.0;
    claw.config.weakStiffness = (weakPercent / 100) * 25.0;
    claw.config.mediumStiffness = (claw.config.strongStiffness + claw.config.weakStiffness) / 2;
    claw.config.weakHeightThreshold = heightPercent / 100;
    claw.config.topHitProbability = tophitPercent / 100;
    claw.config.moveSpeed = speed;
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

  // ── Machine Switching Logic (經典機台 vs K-霸 巨無霸家電玩具機台) ──
  // Helper to force 100% synchronization of DIP UI controls and physics parameters
  function syncDIPPanelUI(params: {
    strong: string;
    height: string;
    weak: string;
    tophit: string;
    speed: string;
    length: string;
    baffle: string;
    dolls: string;
    antiswing: string;
    prizetype: string;
  }) {
    const strongEl = document.getElementById('setting-strong') as HTMLInputElement | null;
    const heightEl = document.getElementById('setting-height') as HTMLInputElement | null;
    const weakEl = document.getElementById('setting-weak') as HTMLInputElement | null;
    const tophitEl = document.getElementById('setting-tophit') as HTMLInputElement | null;
    const speedEl = document.getElementById('setting-speed') as HTMLInputElement | null;
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
    setInput(speedEl, params.speed);
    setInput(lengthEl, params.length);
    setInput(baffleEl, params.baffle);
    setInput(dollsEl, params.dolls);

    if (antiEl) antiEl.value = params.antiswing;
    if (prizeEl) prizeEl.value = params.prizetype;

    // Update text readouts
    const setTxt = (id: string, txt: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('val-strong', params.strong + '%');
    setTxt('val-height', params.height + '%');
    setTxt('val-weak', params.weak + '%');
    setTxt('val-tophit', params.tophit + '%');
    setTxt('val-speed', parseFloat(params.speed).toFixed(1));
    setTxt('val-length', parseFloat(params.length).toFixed(1));
    setTxt('val-baffle', parseFloat(params.baffle).toFixed(1));
    setTxt('val-dolls', params.dolls);

    // Dispatch DOM events so range slider thumbs re-render visually in all browsers
    [strongEl, heightEl, weakEl, tophitEl, speedEl, lengthEl, baffleEl, dollsEl].forEach(el => {
      if (el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    applyDIPSettings();
  }

  let currentMachineMode: string = 'standard';

  function switchMachineMode(mode: string) {
    currentMachineMode = mode;
    const modeSelect = document.getElementById('setting-machinemode') as HTMLSelectElement | null;
    if (modeSelect) modeSelect.value = mode;

    const btnLabel = document.querySelector('#switch-machine-btn .nav-btn-label');
    if (btnLabel) {
      if (mode === 'kbasket') btnLabel.textContent = '切換機台 (#02 K-霸家電大爪)';
      else if (mode === 'sanrio') btnLabel.textContent = '切換機台 (#03 三麗鷗水壺)';
      else if (mode === 'anime') btnLabel.textContent = '切換機台 (#04 動漫模型)';
      else btnLabel.textContent = '切換機台 (#01 經典娃娃機)';
    }

    // Clear all existing prizes completely first!
    prizesManager.clearPrizes();
    if (cabinet) cabinet.setTheme(mode);

    if (mode === 'kbasket') {
      // ⚡ K-霸 巨型家電玩具機台 (100% exact matching parameters from user screenshot)
      claw.setClawScale(1.3);

      syncDIPPanelUI({
        strong: '79',
        height: '60',
        weak: '43',
        tophit: '29',
        speed: '3.5',
        length: '4.5',
        baffle: '1.1',
        dolls: '20',
        antiswing: 'disabled',
        prizetype: 'giant_appliances'
      });

      prizesManager.spawnPrizes(20, 'giant_appliances');

      controls.target.set(0, 3.2, 0);
      camera.position.set(0, 5.6, 9.2);
      controls.update();
    } else if (mode === 'sanrio') {
      // ✨ 三麗鷗精品水壺機台 (可愛水壺)
      claw.setClawScale(0.95);

      syncDIPPanelUI({
        strong: '88',
        height: '50',
        weak: '48',
        tophit: '18',
        speed: '4.5',
        length: '6.5',
        baffle: '0.6',
        dolls: '50',
        antiswing: 'disabled',
        prizetype: 'sanrio_bottle'
      });

      prizesManager.spawnPrizes(50, 'sanrio_bottle');

      controls.target.set(0, 3.2, 0);
      camera.position.set(0, 5.6, 9.2);
      controls.update();
    } else if (mode === 'anime') {
      // ⚡ 動漫模型大賞機台 (七龍珠/航海王盒裝模型)
      claw.setClawScale(1.05);

      syncDIPPanelUI({
        strong: '95',
        height: '70',
        weak: '32',
        tophit: '35',
        speed: '4.2',
        length: '7.5',
        baffle: '0.5',
        dolls: '35',
        antiswing: 'disabled',
        prizetype: 'anime'
      });

      prizesManager.spawnPrizes(35, 'anime');

      controls.target.set(0, 3.2, 0);
      camera.position.set(0, 5.6, 9.2);
      controls.update();
    } else {
      // 👑 經典黃色 TOY STORY 娃娃機
      claw.setClawScale(1.0);

      syncDIPPanelUI({
        strong: '100',
        height: '60',
        weak: '40',
        tophit: '25',
        speed: '4.0',
        length: '7.0',
        baffle: '0.5',
        dolls: '80',
        antiswing: 'disabled',
        prizetype: 'mixed'
      });

      prizesManager.spawnPrizes(80, 'mixed');

      controls.target.set(0, 3.2, 0);
      camera.position.set(0, 5.6, 9.2);
      controls.update();
    }
  }

  // Expose globally for instant button bindings
  (window as any).switchMachineMode = switchMachineMode;

  document.getElementById('power-saver-btn')?.addEventListener('click', () => {
    (window as any).togglePowerSaver();
  });

  document.getElementById('switch-machine-btn')?.addEventListener('click', () => {
    const modes = ['standard', 'kbasket', 'sanrio', 'anime'];
    const nextIdx = (modes.indexOf(currentMachineMode) + 1) % modes.length;
    switchMachineMode(modes[nextIdx]);
  });

  document.getElementById('setting-machinemode')?.addEventListener('change', (e) => {
    const targetMode = (e.target as HTMLSelectElement).value;
    switchMachineMode(targetMode);
  });

  const dollsInput = document.getElementById('setting-dolls') as HTMLInputElement | null;
  if (dollsInput) {
    dollsInput.addEventListener('input', () => {
      const valEl = document.getElementById('val-dolls');
      if (valEl) valEl.textContent = dollsInput.value;
    });
  }

  // Collapsible Settings Panel Drawer Toggle
  const settingsPanel = document.getElementById('settings-panel') as HTMLElement | null;
  const toggleBtn = document.getElementById('toggle-settings-btn') as HTMLElement | null;
  const closePanelBtn = document.getElementById('close-settings-btn') as HTMLElement | null;

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

  // Apply initial machine mode preset (Classic standard)
  switchMachineMode('standard');
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
  // Deep Nightclub Cyberpunk Ambient Atmosphere
  scene.background = new THREE.Color(0x04020a);
  scene.fog = new THREE.FogExp2(0x04020a, 0.004);

  // ===== 1. REFLECTIVE NIGHTCLUB FLOOR: Glossy Mirror Steel Tiles with Neon Grids =====
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fctx = floorCanvas.getContext('2d')!;

  // Dark obsidian mirror tile base
  fctx.fillStyle = '#0a0614';
  fctx.fillRect(0, 0, 512, 512);

  // Diagonal laser grid lines
  fctx.strokeStyle = 'rgba(170, 0, 255, 0.15)';
  fctx.lineWidth = 1.5;
  for (let x = -512; x < 1024; x += 32) {
    fctx.beginPath(); fctx.moveTo(x, 0); fctx.lineTo(x + 512, 512); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, 512); fctx.lineTo(x + 512, 0); fctx.stroke();
  }

  // Large Nightclub Floor Tiles (128x128)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      fctx.strokeStyle = '#1a1030';
      fctx.lineWidth = 4;
      fctx.strokeRect(c * 128 + 4, r * 128 + 4, 120, 120);

      // Soft reflection sheen on tile corners
      fctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      fctx.fillRect(c * 128 + 8, r * 128 + 8, 45, 20);
    }
  }

  // Glowing Cyberpunk Seam Lines (Cyan & Hot Pink)
  for (let i = 0; i <= 512; i += 128) {
    fctx.shadowColor = '#00f0ff';
    fctx.shadowBlur = 10;
    fctx.strokeStyle = '#00f0ff';
    fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i, 512); fctx.stroke();

    fctx.shadowColor = '#ff0075';
    fctx.shadowBlur = 10;
    fctx.strokeStyle = '#ff0075';
    fctx.beginPath(); fctx.moveTo(0, i); fctx.lineTo(512, i); fctx.stroke();
  }
  fctx.shadowBlur = 0;

  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(12, 12);

  // Ultra-reflective nightclub polished floor
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.10, // Glossy mirror-like finish
    metalness: 0.85  // High metallic reflection for glowing neon machines
  });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.01;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // ===== 2. NIGHTCLUB DJ SOUNDPROOF BACK WALL =====
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 2048;
  wallCanvas.height = 1024;
  const wctx = wallCanvas.getContext('2d')!;

  // Deep Violet Nightclub Gradient
  const wallGrad = wctx.createLinearGradient(0, 0, 0, 1024);
  wallGrad.addColorStop(0, '#04020a');
  wallGrad.addColorStop(0.5, '#120524');
  wallGrad.addColorStop(1, '#080312');
  wctx.fillStyle = wallGrad;
  wctx.fillRect(0, 0, 2048, 1024);

  // Soundproof acoustic wall panels pattern
  wctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  wctx.lineWidth = 2;
  for (let gx = 0; gx <= 2048; gx += 128) {
    wctx.beginPath(); wctx.moveTo(gx, 0); wctx.lineTo(gx, 1024); wctx.stroke();
  }
  for (let gy = 0; gy <= 1024; gy += 128) {
    wctx.beginPath(); wctx.moveTo(0, gy); wctx.lineTo(2048, gy); wctx.stroke();
  }

  // Neon Nightclub Art & Typography (夜店龐克霓虹藝術)
  wctx.shadowColor = '#ff0075';
  wctx.shadowBlur = 25;
  wctx.fillStyle = '#ff0075';
  wctx.font = '900 100px sans-serif';
  wctx.fillText('🎧 CLUB CLAW 2077 🍸', 120, 380);

  wctx.shadowColor = '#00f0ff';
  wctx.shadowBlur = 25;
  wctx.fillStyle = '#00f0ff';
  wctx.font = '900 105px sans-serif';
  wctx.fillText('⚡ VIP NIGHT PUNK ⚡', 1050, 420);

  wctx.shadowColor = '#ffe600';
  wctx.shadowBlur = 18;
  wctx.fillStyle = '#ffe600';
  wctx.font = '800 65px sans-serif';
  wctx.fillText('🎶 BASS BOOST ARCADE 🎶', 300, 850);
  wctx.fillText('☠️ NO SLEEP TILL DAWN ☠️', 1200, 850);

  wctx.shadowBlur = 0;

  const wallTex = new THREE.CanvasTexture(wallCanvas);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.5, metalness: 0.4 });
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 42), wallMat);
  wallMesh.position.set(0, 19, -22);
  scene.add(wallMesh);

  // Side Walls
  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x060310, roughness: 0.85, metalness: 0.3 });
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(60, 42), sideWallMat);
  leftWall.position.set(-42, 19, 5);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(60, 42), sideWallMat);
  rightWall.position.set(42, 19, 5);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // ===== 3. MAIN MACHINE NIGHTCLUB HEADER BANNER =====
  const bannerGroup = new THREE.Group();
  bannerGroup.position.set(0, 13.5, -11.5);

  const bannerBack = new THREE.Mesh(new THREE.BoxGeometry(18, 4.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x060310, roughness: 0.3, metalness: 0.8 }));
  bannerGroup.add(bannerBack);

  const bannerFrame = new THREE.Mesh(new THREE.BoxGeometry(18.5, 4.7, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff0075 }));
  bannerFrame.position.z = -0.08;
  bannerGroup.add(bannerFrame);

  const innerRim = new THREE.Mesh(new THREE.BoxGeometry(18.1, 4.3, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
  innerRim.position.z = -0.04;
  bannerGroup.add(innerRim);

  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 2048;
  bannerCanvas.height = 480;
  const bctx = bannerCanvas.getContext('2d')!;

  const bgrad = bctx.createLinearGradient(0, 0, 2048, 0);
  bgrad.addColorStop(0, '#04020a');
  bgrad.addColorStop(0.5, '#180430');
  bgrad.addColorStop(1, '#04020a');
  bctx.fillStyle = bgrad;
  bctx.fillRect(0, 0, 2048, 480);

  bctx.shadowColor = '#ff0075';
  bctx.shadowBlur = 35;
  bctx.fillStyle = '#ffffff';
  bctx.font = '900 88px sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText('🍸 NIGHTCLUB 3D 娃娃機旗艦店 🎧', 1024, 175);

  bctx.shadowColor = '#00f0ff';
  bctx.shadowBlur = 25;
  bctx.fillStyle = '#00f0ff';
  bctx.font = '700 52px sans-serif';
  bctx.fillText('⚡ 賽博龐克 · 滿滿機台 · 極限甩爪狂歡 ⚡', 1024, 285);

  bctx.shadowColor = '#ffe600';
  bctx.shadowBlur = 18;
  bctx.fillStyle = '#ffe600';
  bctx.font = '600 38px sans-serif';
  bctx.fillText('🔥 100 個堆山爆抓 · 50 刮彩券好禮連發 🔥', 1024, 385);

  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true });
  const bannerPlane = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 3.9), bannerMat);
  bannerPlane.position.z = 0.12;
  bannerGroup.add(bannerPlane);
  scene.add(bannerGroup);

  // ===== 4. BUSTLING ARCADE HALL: SURROUNDING CLAW MACHINES =====
  // Create 6 glowing decorative claw machines around the room
  createSideArcadeMachines(scene);

  // ===== 5. NIGHTCLUB CEILING STROBE LIGHT STRIPS =====
  const neonColors = [0xff0075, 0x00f0ff, 0xffe600, 0xaa00ff, 0x00ff88];
  neonColors.forEach((col, i) => {
    const stripMat = new THREE.MeshBasicMaterial({ color: col });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(36, 0.16, 0.16), stripMat);
    strip.position.set(0, 9.4 + i * 0.3, -10 + i * 2.2);
    scene.add(strip);
  });

  // ===== 6. DYNAMIC NIGHTCLUB POINT LIGHTS =====
  const n1 = new THREE.PointLight(0xff0075, 2.2, 35);
  n1.position.set(-14, 9, -5);
  scene.add(n1);

  const n2 = new THREE.PointLight(0x00f0ff, 2.0, 35);
  n2.position.set(14, 9, -5);
  scene.add(n2);

  const n3 = new THREE.PointLight(0xaa00ff, 1.6, 40);
  n3.position.set(0, 12, 5);
  scene.add(n3);
}

/**
 * Creates 6 detailed surrounding arcade claw machines to form a bustling Nightclub Arcade Hall
 */
function createSideArcadeMachines(scene: THREE.Scene) {
  const machineConfigs = [
    // Left Row
    { x: -14.5, z: 1.0,  rotY: Math.PI * 0.12,  bodyHex: 0x00f0ff, glowHex: 0x00f0ff, title: 'UFO CATCHER 9' },
    { x: -22.5, z: -2.5, rotY: Math.PI * 0.18,  bodyHex: 0xff0075, glowHex: 0xff0075, title: 'GASHAPON KING' },
    { x: -30.5, z: -6.0, rotY: Math.PI * 0.25,  bodyHex: 0xaa00ff, glowHex: 0xaa00ff, title: 'CYBER TOY 2077' },

    // Right Row
    { x: 14.5,  z: 1.0,  rotY: -Math.PI * 0.12, bodyHex: 0xffb703, glowHex: 0xffb703, title: 'TOY STORY 3D' },
    { x: 22.5,  z: -2.5, rotY: -Math.PI * 0.18, bodyHex: 0x00ff88, glowHex: 0x00ff88, title: 'NEON CLAW 999' },
    { x: 30.5,  z: -6.0, rotY: -Math.PI * 0.25, bodyHex: 0xff0055, glowHex: 0xff0055, title: 'MONSTER PRIZE' },
  ];

  machineConfigs.forEach((cfg) => {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const W = 8.5, H = 8.2, D = 8.0;

    // ── Machine Outer Cabinet Frame ──
    const frameMat = new THREE.MeshStandardMaterial({ color: cfg.bodyHex, roughness: 0.2, metalness: 0.4 });
    const darkBodyMat = new THREE.MeshStandardMaterial({ color: 0x11111a, roughness: 0.4, metalness: 0.6 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.9 });

    // Lower cabinet base
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, 3.2, D), darkBodyMat);
    base.position.y = 1.6;
    group.add(base);

    // Front coin console
    const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.8, 1.4), frameMat);
    consoleMesh.position.set(0, 3.0, D / 2 - 0.5);
    group.add(consoleMesh);

    // Illuminated coin slot
    const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1),
      new THREE.MeshBasicMaterial({ color: cfg.glowHex }));
    coinSlot.position.set(0, 2.6, D / 2 + 0.02);
    group.add(coinSlot);

    // 4 Corner Pillars
    const pillarR = 0.28;
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(pillarR, pillarR, H, 12), frameMat);
    p1.position.set(-W / 2 + 0.3, H / 2, D / 2 - 0.3);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(pillarR, pillarR, H, 12), frameMat);
    p2.position.set(W / 2 - 0.3, H / 2, D / 2 - 0.3);
    const p3 = new THREE.Mesh(new THREE.CylinderGeometry(pillarR, pillarR, H, 12), frameMat);
    p3.position.set(-W / 2 + 0.3, H / 2, -D / 2 + 0.3);
    const p4 = new THREE.Mesh(new THREE.CylinderGeometry(pillarR, pillarR, H, 12), frameMat);
    p4.position.set(W / 2 - 0.3, H / 2, -D / 2 + 0.3);
    group.add(p1, p2, p3, p4);

    // ── Glowing Inner Prize Chamber ──
    const chamberGlowMat = new THREE.MeshBasicMaterial({
      color: cfg.glowHex,
      transparent: true,
      opacity: 0.25
    });
    const chamberBox = new THREE.Mesh(new THREE.BoxGeometry(W - 0.8, 3.8, D - 0.8), chamberGlowMat);
    chamberBox.position.set(0, 5.0, 0);
    group.add(chamberBox);

    // Prize chamber floor
    const chamberFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.2, D - 0.6), frameMat);
    chamberFloor.position.set(0, 3.3, 0);
    group.add(chamberFloor);

    // ── Dummy Prize Items Inside Chamber ──
    const prizeColors = [0xff0055, 0x00f0ff, 0xffe600, 0xffffff, 0xaa00ff];
    for (let i = 0; i < 14; i++) {
      const pColor = prizeColors[i % prizeColors.length];
      const pMat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.3 });
      const px = (Math.random() - 0.5) * (W - 2.0);
      const pz = (Math.random() - 0.5) * (D - 2.0);
      const py = 3.6 + (i % 3) * 0.45;

      let prizeMesh: THREE.Mesh;
      if (i % 2 === 0) {
        prizeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), pMat);
      } else {
        prizeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), pMat);
      }
      prizeMesh.position.set(px, py, pz);
      group.add(prizeMesh);
    }

    // Dummy gantry & claw rails
    const gantryRail = new THREE.Mesh(new THREE.BoxGeometry(W - 1.0, 0.15, 0.15), chromeMat);
    gantryRail.position.set(0, 6.7, 0);
    group.add(gantryRail);

    // ── Clear Glass Walls ──
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      opacity: 0.18,
      transparent: true,
      roughness: 0.0
    });
    const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.8, 3.8), glassMat);
    frontGlass.position.set(0, 5.0, D / 2 - 0.2);
    group.add(frontGlass);

    // ── Top Header Marquee Banner ──
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d')!;

    // Header bg
    bctx.fillStyle = '#' + cfg.bodyHex.toString(16).padStart(6, '0');
    bctx.fillRect(0, 0, 512, 128);
    bctx.strokeStyle = '#ffffff'; bctx.lineWidth = 6;
    bctx.strokeRect(6, 6, 500, 116);

    // Header text
    bctx.shadowColor = '#ffffff';
    bctx.shadowBlur = 12;
    bctx.fillStyle = '#ffffff';
    bctx.font = '900 42px sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText(cfg.title, 256, 75);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const marqueeMesh = new THREE.Mesh(new THREE.BoxGeometry(W, 1.4, D),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.3 }));
    marqueeMesh.position.set(0, 7.5, 0);
    group.add(marqueeMesh);

    // ── Emissive Light Source Inside Each Machine ──
    const mLight = new THREE.PointLight(cfg.glowHex, 1.4, 18);
    mLight.position.set(0, 5.5, 0);
    group.add(mLight);

    scene.add(group);
  });
}

// Start Game
init();
