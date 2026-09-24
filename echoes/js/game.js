/* =============================================================================
 * game.js - Echoes in the Drywall: renderer, player, rules, HUD and screens.
 *
 * Find the three cassette tapes, then get out. The thing in the walls hunts by
 * sound: footsteps and breathing carry, a gasp carries through the whole
 * apartment. Stand still and hold your breath and it will pass you by.
 * ========================================================================== */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const FLASH_BASE = 14;          // Beam intensity (candela) on a healthy battery.
  const GASP_RADIUS = 16;         // A gasp is heard across most of the apartment.
  const EXIT_ZONE = { minX: 16.1, maxX: 17.9, minZ: 26.6 };
  const HIDE_HINT = {
    pc: 'When the scratching gets close: stand still and hold Space, or sneak away with C.',
    mobile: 'When the scratching gets close: stand still and hold BREATH, or push the stick lightly to sneak away.',
  };
  const TAPE_LINES = [
    'Tape 1 of 3.  "It started knocking back."',
    'Tape 2 of 3.  "It moves when I breathe. So I stopped breathing."',
    'Tape 3 of 3.  "The front door is gone. It only comes back when you are not looking."',
  ];

  /* ------------------------------------------------------------ renderer and scene */
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040303);
  scene.fog = new THREE.FogExp2(0x040303, 0.07);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  // Eyes adjusted to the dark: shapes stay readable with the flashlight off.
  scene.add(new THREE.HemisphereLight(0x5d6475, 0x15110d, 0.5));

  const spot = new THREE.SpotLight(0xffdcae, FLASH_BASE, 24, 0.44, 0.55, 2);
  spot.position.set(0.2, -0.16, 0.05);
  spot.castShadow = true;
  spot.shadow.mapSize.set(isTouch ? 512 : 1024, isTouch ? 512 : 1024);
  spot.shadow.camera.near = 0.1;
  spot.shadow.camera.far = 24;
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.02; // No shadow acne on curved surfaces up close.
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0.02, -0.12, -4);
  camera.add(spot, spotTarget);
  spot.target = spotTarget;

  const world = new World(scene);
  const entity = new DrywallEntity(scene, world);
  const input = new Input(canvas, $('touch'));
  const director = new AudioDirector();
  scene.updateMatrixWorld(true);

  /* ------------------------------------------------------------ state */
  const player = {
    pos: new THREE.Vector3(), yaw: 0, pitch: 0, radius: 0.3, eye: 1.6,
    walkSpeed: 2.2, runSpeed: 3.6, stepDist: 0, bobPhase: 0, bobAmount: 0, running: false,
  };
  const game = {
    state: 'title', mode: isTouch ? 'mobile' : 'pc', time: 0, runTime: 0, tapes: 0,
    noiseRadius: 0, noiseSource: 'breathing', loudTimer: 0, heartTimer: 0, revealCooldown: 0,
    breathWasHeld: false, timers: [], flags: {}, deathTimer: 0, deathCause: '', best: loadBest(),
  };
  let flashlight = null;
  let breathing = null;
  const shifts = {};

  /* ------------------------------------------------------------ helpers */
  function later(seconds, fn) { game.timers.push({ t: seconds, fn }); }

  function loadBest() {
    try { const v = parseFloat(localStorage.getItem('echoes.best')); return Number.isFinite(v) ? v : null; } catch (e) { return null; }
  }
  function saveBest(v) { try { localStorage.setItem('echoes.best', String(v)); } catch (e) { /* storage unavailable */ } }

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // One message at a time, with a short gap so consecutive messages read as separate.
  const toastQueue = [];
  let toastTimer = 0;
  let toastGap = 0;
  let toastText = '';
  function toast(text, seconds = 3.4) {
    if ((toastTimer > 0 && toastText === text) || toastQueue.some((t) => t.text === text)) return;
    if (toastQueue.length >= 2) toastQueue.shift(); // Stale news is worse than no news.
    toastQueue.push({ text, seconds });
  }
  function clearToasts() {
    toastQueue.length = 0;
    toastTimer = toastGap = 0;
    toastText = '';
    $('toast').classList.remove('show');
  }
  function updateToasts(dt) {
    const el = $('toast');
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) { el.classList.remove('show'); toastGap = 0.35; toastText = ''; }
      return;
    }
    if (toastGap > 0) { toastGap -= dt; return; }
    if (!toastQueue.length) return;
    const next = toastQueue.shift();
    toastText = next.text;
    el.textContent = next.text;
    el.classList.add('show');
    toastTimer = next.seconds;
  }

  function setObjective(text) { $('objective').textContent = text; }

  const frustum = new THREE.Frustum();
  const projView = new THREE.Matrix4();
  const tmpBox = new THREE.Box3();
  function onScreen(obj) {
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projView);
    return frustum.intersectsBox(tmpBox.setFromObject(obj));
  }

  /* ------------------------------------------------------------ setup / reset */
  function makeShifts() {
    shifts.hall = new ShiftTrigger({
      zone: { minX: 14, maxX: 22, minZ: 4, maxZ: 6 },
      focus: new THREE.Vector3(23, 1.5, 5),
      isUnseen: () => !onScreen(world.hallWall),
      apply: (on) => world.setHallShifted(on),
      onShift: () => {
        Sound.creak({ x: 23, y: 1.4, z: 5 });
        breathing.addPanic(15);
        toast('Something moved behind you.');
        game.flags.hallShiftTime = game.runTime;
      },
    });
    shifts.exit = new ShiftTrigger({
      zone: { minX: 10, maxX: 24, minZ: 18, maxZ: 26 },
      focus: new THREE.Vector3(17, 1.5, 27),
      isUnseen: () => !onScreen(world.exitWall),
      apply: (on) => world.setExitShifted(on),
      onShift: () => {
        Sound.unlock({ x: 17, y: 1.2, z: 26.6 });
        breathing.addPanic(12);
        setObjective('The front door is open. Get out.');
        toast('A lock turned behind you.');
      },
      enabled: false,
    });
  }

  function newGame() {
    world.reset();
    entity.reset();
    director.reset();
    clearToasts();

    spot.intensity = FLASH_BASE;
    flashlight = new Flashlight(spot);
    flashlight.onClick = () => { Sound.click(); entity.hear(player.pos, 2.5); };
    flashlight.onDepleted = () => toast('The battery is dead.');

    breathing = new Breathing();
    breathing.onHoldChanged = (holding) => {
      Sound.setMuffled(holding);
      if (!holding && !breathing.recovering) Sound.exhale();
    };
    breathing.onForcedGasp = (reason) => {
      Sound.gasp();
      game.loudTimer = 1.2;
      entity.hear(player.pos, GASP_RADIUS);
      pulse('gasp');
      toast(reason === 'exhausted' ? 'You ran out of breath.' : 'Too scared to breathe out quietly.');
    };

    director.onEvent = () => breathing.addPanic(10);

    player.pos.copy(World.tileCenter(1, 2));
    player.yaw = -Math.PI / 2; // Facing east, down the hallway.
    player.pitch = 0;
    player.stepDist = player.bobPhase = player.bobAmount = 0;
    Object.assign(game, { runTime: 0, tapes: 0, loudTimer: 0, heartTimer: 0, revealCooldown: 0, breathWasHeld: false, timers: [], flags: {} });
    makeShifts();
    setObjective('Find the three cassette tapes.   0 / 3');
    hudCache.reset();
  }

  /* ------------------------------------------------------------ flow */
  function show(id, on) { $(id).hidden = !on; }

  function startGame() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Space must not re-press a menu button.
    Sound.init();
    Sound.resume();
    newGame();
    game.state = 'playing';
    show('screen-title', false);
    show('screen-end', false);
    show('screen-pause', false);
    show('hud', true);
    show('touch', game.mode === 'mobile');
    input.setMode(game.mode);
    input.enabled = true;
    if (game.mode === 'pc') input.requestLock();
    else tryFullscreen();
    director.startDrone();
    toast(game.mode === 'pc'
      ? 'F: flashlight.   Hold Space: hold your breath.   C: sneak.   Shift: run.'
      : 'LIGHT: flashlight.   Hold BREATH: hold your breath.   Push the stick lightly to sneak, fully to run.', 5.5);
  }

  function tryFullscreen() {
    const el = document.documentElement;
    try {
      const r = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' });
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* not allowed here */ }
  }

  function pause() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    input.enabled = false;
    input.reset();
    input.exitLock();
    // Pausing is not a panicked exhale: end any hold quietly, with no gasp.
    breathing._endHold();
    game.breathWasHeld = false;
    Sound.setMuffled(false);
    Sound.suspend();
    show('touch', false);
    show('screen-pause', true);
  }

  function resume() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    show('screen-pause', false);
    show('touch', game.mode === 'mobile');
    Sound.resume();
    input.enabled = true;
    if (game.mode === 'pc') input.requestLock();
  }

  function toTitle() {
    game.state = 'title';
    input.enabled = false;
    input.reset();
    input.exitLock();
    Sound.fadeDrone(0, 0.5);
    Sound.setMuffled(false);
    Sound.updateScratch(0, entity.pos, 0); // Silence the scratching before audio resumes on the menu.
    Sound.resume();
    show('hud', false);
    show('touch', false);
    show('screen-pause', false);
    show('screen-end', false);
    show('screen-title', true);
    world.reset();
    entity.reset();
    player.pos.copy(World.tileCenter(1, 2));
    renderBest();
  }

  function startDeath() {
    game.state = 'dying';
    game.deathTimer = 1.15;
    input.enabled = false;
    input.reset();
    const causes = {
      gasp: 'It heard you gasp.',
      breathing: 'It heard you breathing.',
      footsteps: 'It heard your footsteps.',
      running: 'It heard you running.',
    };
    game.deathCause = causes[game.noiseSource] || 'It heard you.';
    spot.visible = true;
    spot.intensity = FLASH_BASE * 1.3;
    entity.lunge(camera);
    Sound.setMuffled(false);
    Sound.fadeDrone(0, 0.05);
    Sound.updateScratch(0, entity.pos, 0);
    Sound.capture();
    pulse('caught');
  }

  function finish(escaped) {
    game.state = escaped ? 'escaped' : 'caught';
    input.enabled = false;
    input.reset();
    input.exitLock();
    Sound.setMuffled(false);
    Sound.updateScratch(0, entity.pos, 0);
    show('hud', false);
    show('touch', false);
    const end = $('screen-end');
    end.classList.toggle('won', escaped);
    if (escaped) {
      Sound.fadeDrone(0, 2.5);
      const newBest = game.best === null || game.runTime < game.best;
      if (newBest) { game.best = game.runTime; saveBest(game.runTime); }
      $('end-title').textContent = 'You got out';
      $('end-detail').textContent = `Out in ${fmtTime(game.runTime)} with all three tapes.${newBest ? ' Your best escape so far.' : ` Best: ${fmtTime(game.best)}.`}`;
      $('end-hint').textContent = 'The apartment is still listening. It will be there next time.';
    } else {
      $('end-title').textContent = 'It heard you';
      $('end-detail').textContent = `${game.deathCause}  Tapes found: ${game.tapes} of 3.  Time: ${fmtTime(game.runTime)}.`;
      $('end-hint').textContent = game.noiseSource === 'gasp'
        ? 'A breath lasts about six seconds, less when you are scared. Let go before it runs out, or once your heart slows down.'
        : 'When the scratching is close, stand still and hold your breath until it moves away.';
    }
    show('screen-end', true);
  }

  /* ------------------------------------------------------------ per-frame gameplay */
  const fwd = new THREE.Vector3();
  const chest = new THREE.Vector3();

  function updatePlaying(dt) {
    game.runTime += dt;
    for (let i = game.timers.length - 1; i >= 0; i--) {
      const t = game.timers[i];
      t.t -= dt;
      if (t.t <= 0) { game.timers.splice(i, 1); t.fn(); }
    }

    input.update();
    if (input.consume('pause')) { pause(); return; }
    if (input.consume('light')) flashlight.toggle();

    // Breath: act on press and release edges only, so a gasp needs a fresh press.
    if (input.breathHeld && !game.breathWasHeld) breathing.startHolding();
    if (!input.breathHeld && game.breathWasHeld) breathing.stopHolding();
    game.breathWasHeld = input.breathHeld;

    // Look and move.
    const look = input.takeLook();
    player.yaw -= look.dx;
    player.pitch = clamp(player.pitch - look.dy, -1.35, 1.35);
    const sneakScale = input.sneak ? 0.5 : 1;
    const mx = input.move.x * sneakScale, my = input.move.y * sneakScale;
    const mag = Math.min(1, Math.hypot(mx, my));
    const wantsRun = input.run && my > 0.3;
    const speed = wantsRun ? player.runSpeed : player.walkSpeed;
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const vx = (-sy * my + cy * mx) * speed;
    const vz = (-cy * my - sy * mx) * speed;
    const bx = player.pos.x, bz = player.pos.z;
    world.move(player.pos, vx * dt, vz * dt, player.radius);
    const moved = Math.hypot(player.pos.x - bx, player.pos.z - bz);
    const moving = moved > 0.2 * dt && mag > 0.1;
    player.running = moving && wantsRun;

    // 0 when creeping, 1 at a normal walk: slow, careful steps are much quieter.
    const pace = moving && !player.running ? clamp((moved / dt - 0.9) / 1.3, 0, 1) : 1;
    if (moving) {
      player.stepDist += moved;
      const stride = player.running ? 0.8 : lerp(0.45, 0.62, pace);
      if (player.stepDist >= stride) {
        player.stepDist -= stride;
        Sound.step(player.running ? 0.45 : lerp(0.06, 0.2, pace), player.running);
      }
      player.bobPhase += moved * (Math.PI * 2) / (stride * 2);
    }
    player.bobAmount += ((moving ? 1 : 0) - player.bobAmount) * Math.min(1, dt * 8);

    // Noise: footsteps or breathing, whichever carries further; a gasp beats both for a moment.
    game.loudTimer = Math.max(0, game.loudTimer - dt);
    const footRadius = moving ? (player.running ? 10 : lerp(1.4, 4.5, pace)) : 0;
    const breathRadius = 1.8 * breathing.noiseMultiplier; // Calm breathing carries 1.8 m, panicked 3.2 m.
    game.noiseRadius = Math.max(footRadius, breathRadius);
    game.noiseSource = footRadius > breathRadius ? (player.running ? 'running' : 'footsteps') : 'breathing';
    if (game.loudTimer > 0) { game.noiseRadius = Math.max(game.noiseRadius, GASP_RADIUS); game.noiseSource = 'gasp'; }

    // Systems.
    breathing.update(dt);
    flashlight.update(dt);
    if (flashlight.on && flashlight.isLow && !game.flags.lowWarned) { game.flags.lowWarned = true; toast('Battery low.'); }

    updateCamera(dt);
    shifts.hall.update(dt, camera);
    shifts.exit.update(dt, camera);

    // The thing in the walls.
    if (entity.update(dt, player.pos, game.noiseRadius)) { startDeath(); return; }
    if (entity.active) {
      const d = Math.hypot(entity.pos.x - player.pos.x, entity.pos.z - player.pos.z);
      if (d < 7) breathing.addPanic(12 * (1 - d / 7) ** 2 * dt); // Mostly when it is right on top of you.
      checkReveal(dt);
    }

    checkPickups();
    checkHints(dt);

    if (world.shifted.exit && player.pos.z > EXIT_ZONE.minZ && player.pos.x > EXIT_ZONE.minX && player.pos.x < EXIT_ZONE.maxX) {
      finish(true);
      return;
    }

    // Audio.
    Sound.updateListener(camera.position, fwd);
    Sound.updateScratch(dt, { x: entity.pos.x, y: 1.3, z: entity.pos.z }, entity.activity);
    director.update(dt, player.pos, player.yaw);
    if (breathing.panic > 40) {
      game.heartTimer -= dt;
      if (game.heartTimer <= 0) {
        const p = (breathing.panic - 40) / 60;
        Sound.heartbeat(0.15 + p * 0.5);
        game.heartTimer = lerp(1.05, 0.42, p);
      }
    }
    updateHud();
  }

  function updateCamera(dt) {
    const panic = breathing ? breathing.panicNormalized : 0;
    const t = game.time;
    let shake = panic > 0.6 ? (panic - 0.6) * 0.03 : 0;
    if (breathing && breathing.holding && breathing.breathNormalized < 0.35) shake += (0.35 - breathing.breathNormalized) * 0.03;
    const bob = Math.sin(player.bobPhase) * 0.035 * player.bobAmount * (player.running ? 1.5 : 1);
    camera.position.set(
      player.pos.x + Perlin.noise1D(t * 9) * shake,
      player.eye + bob + Perlin.noise1D(t * 11 + 50) * shake,
      player.pos.z,
    );
    camera.rotation.set(player.pitch + Perlin.noise1D(t * 7 + 90) * shake * 0.6, player.yaw, 0);
    camera.updateMatrixWorld();
    camera.getWorldDirection(fwd);
    // The beam wanders a little, like a torch in a nervous hand.
    spotTarget.position.x = 0.02 + Perlin.noise1D(t * 0.6 + 7) * (0.05 + panic * 0.12);
    spotTarget.position.y = -0.12 + Perlin.noise1D(t * 0.5 + 21) * (0.04 + panic * 0.1);
  }

  function checkReveal(dt) {
    game.revealCooldown = Math.max(0, game.revealCooldown - dt);
    if (!flashlight.on || flashlight.brightness < 0.25 || game.revealCooldown > 0 || entity.insideWall) return;
    chest.set(entity.pos.x, 1.5, entity.pos.z);
    const dx = chest.x - camera.position.x, dy = chest.y - camera.position.y, dz = chest.z - camera.position.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 10 || dist < 0.01) return;
    const cos = (fwd.x * dx + fwd.y * dy + fwd.z * dz) / dist;
    if (cos < Math.cos(0.42) || !world.lineOfSight(camera.position, chest)) return;
    game.revealCooldown = 10;
    Sound.sting();
    breathing.addPanic(25);
    entity.startle();
    pulse('reveal');
  }

  function checkPickups() {
    for (const p of world.pickups) {
      if (p.taken || Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) > 0.95) continue;
      p.taken = true;
      p.group.visible = false;
      if (p.type === 'battery') {
        const added = flashlight.addCharge(105);
        Sound.pickup();
        toast(`Battery.  +${Math.round((added / flashlight.maxBatterySeconds) * 100)}%`);
        game.flags.lowWarned = flashlight.isLow;
      } else {
        collectTape();
      }
    }
  }

  function collectTape() {
    game.tapes++;
    Sound.tapeVoice();
    breathing.addPanic(8);
    toast(TAPE_LINES[game.tapes - 1], 6);
    if (game.tapes === 1) {
      entity.wake(4);
      later(6.5, () => toast('Something in the walls heard that.'));
      later(16, () => toast(HIDE_HINT[game.mode], 5));
    }
    if (game.tapes < 3) {
      setObjective(`Find the three cassette tapes.   ${game.tapes} / 3`);
    } else {
      setObjective('Get out. The front door was in the living room.');
      shifts.exit.enabled = true;
    }
  }

  function checkHints(dt) {
    const f = game.flags;
    // Stuck in the hallway after it changed.
    if (world.shifted.hall && !f.leftHall) {
      if (player.pos.x > 23) f.leftHall = true;
      else if (game.runTime - f.hallShiftTime > 25 && !f.hallHint) { f.hallHint = true; toast('The end of the hallway is different now.'); }
    }
    // All tapes found but the door has not come back yet.
    const z = shifts.exit.zone;
    const inLiving = player.pos.x >= z.minX && player.pos.x <= z.maxX && player.pos.z >= z.minZ && player.pos.z <= z.maxZ;
    if (game.tapes === 3 && !world.shifted.exit && inLiving) {
      f.livingTime = (f.livingTime || 0) + dt;
      if (f.livingTime > 18 && !f.exitHint) { f.exitHint = true; toast('Look at the wall where the door should be. Then turn away.', 5); }
    }
  }

  function updateDying(dt) {
    game.deathTimer -= dt;
    const s = 0.05;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.updateMatrixWorld();
    if (game.deathTimer <= 0) finish(false);
  }

  function updateTitle(dt) {
    // A slow look around the bedroom while the menu is up.
    player.pos.copy(World.tileCenter(1, 2));
    player.yaw = -Math.PI / 2 + Math.sin(game.time * 0.12) * 0.9;
    player.pitch = -0.08 + Math.sin(game.time * 0.2) * 0.05;
    player.bobAmount = 0;
    spot.visible = true;
    spot.intensity = FLASH_BASE * (0.82 + Perlin.noise1D(game.time * 3) * 0.12);
    updateCamera(dt);
  }

  /* ------------------------------------------------------------ HUD */
  const hudCache = {
    reset() { this.pct = -1; this.breath = -1; this.noise = -1; this.vig = -1; this.flags = ''; },
  };
  hudCache.reset();
  const noiseSegs = Array.from(document.querySelectorAll('#noise .seg'));

  function updateHud() {
    const pct = Math.round(flashlight.percentage);
    if (pct !== hudCache.pct) {
      hudCache.pct = pct;
      $('cell-pct').textContent = flashlight.battery <= 0 ? 'DEAD' : `${pct}%`;
      $('cell-fill').style.transform = `scaleX(${flashlight.fraction})`;
    }
    const breathN = Math.round(breathing.breathNormalized * 200) / 200;
    if (breathN !== hudCache.breath) { hudCache.breath = breathN; $('breath-fill').style.transform = `scaleX(${breathN})`; }

    const flags = [
      flashlight.on, flashlight.isLow, breathing.holding, breathing.recovering,
      breathing.holding && breathing.isPanicHigh, breathing.holding || breathing.recovering || breathing.breathNormalized < 0.995,
    ].map(Number).join('');
    if (flags !== hudCache.flags) {
      hudCache.flags = flags;
      $('m-cell').classList.toggle('on', flashlight.on);
      $('m-cell').classList.toggle('low', flashlight.isLow);
      $('m-breath').hidden = !(breathing.holding || breathing.recovering || breathing.breathNormalized < 0.995);
      $('m-breath').classList.toggle('holding', breathing.holding);
      $('m-breath').classList.toggle('gasping', breathing.recovering);
      $('m-breath').classList.toggle('panic', breathing.holding && breathing.isPanicHigh);
      $('breath-label').textContent = breathing.recovering ? 'GASP' : 'HOLD';
      $('btn-light').classList.toggle('on', flashlight.on);
      $('btn-breath').classList.toggle('on', breathing.holding);
    }

    const r = game.noiseRadius;
    const level = r < 0.5 ? 0 : r < 2.6 ? 1 : r < 4.6 ? 2 : r < 10.5 ? 3 : 4;
    if (level !== hudCache.noise) {
      hudCache.noise = level;
      noiseSegs.forEach((s, i) => s.classList.toggle('on', i < level));
    }

    const panic = breathing.panicNormalized;
    const vig = Math.round((0.3 + panic * 0.7 + (breathing.holding ? 0.15 : 0)) * 50) / 50;
    if (vig !== hudCache.vig) {
      hudCache.vig = vig;
      const v = $('vignette');
      v.style.opacity = Math.min(1, vig);
      v.classList.toggle('panic', breathing.isPanicHigh);
    }
  }

  function pulse(kind) {
    const el = $('pulse');
    el.className = '';
    void el.offsetWidth; // Restart the animation.
    el.className = kind;
  }

  /* ------------------------------------------------------------ menus */
  function setMode(mode) {
    game.mode = mode;
    $('app').classList.toggle('mobile', mode === 'mobile');
    $('mode-pc').setAttribute('aria-pressed', String(mode === 'pc'));
    $('mode-mobile').setAttribute('aria-pressed', String(mode === 'mobile'));
    $('legend-pc').hidden = mode !== 'pc';
    $('legend-mobile').hidden = mode !== 'mobile';
    $('pause-mode').textContent = mode === 'pc' ? 'Switch to phone controls' : 'Switch to computer controls';
  }

  function renderBest() {
    $('best').hidden = game.best === null;
    if (game.best !== null) $('best').textContent = `Best escape  ${fmtTime(game.best)}`;
  }

  $('mode-pc').addEventListener('click', () => setMode('pc'));
  $('mode-mobile').addEventListener('click', () => setMode('mobile'));
  $('btn-start').addEventListener('click', startGame);
  $('btn-resume').addEventListener('click', resume);
  $('btn-restart').addEventListener('click', startGame);
  $('btn-menu').addEventListener('click', toTitle);
  $('btn-again').addEventListener('click', startGame);
  $('btn-menu-end').addEventListener('click', toTitle);
  $('pause-mode').addEventListener('click', () => {
    setMode(game.mode === 'pc' ? 'mobile' : 'pc');
    input.setMode(game.mode);
  });
  input.onLockLost = pause;
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /* ------------------------------------------------------------ resize and loop */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 84 : 72;
    camera.updateProjectionMatrix();
    $('rotate-note').hidden = !(isTouch && w < h);
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    game.time += dt;
    world.update(dt, game.time);
    if (game.state === 'playing') updatePlaying(dt);
    else if (game.state === 'dying') updateDying(dt);
    else if (game.state === 'title') updateTitle(dt);
    updateToasts(dt);
    renderer.render(scene, camera);
  }

  function boot(data) {
    setMode(data && (data.mode === 'pc' || data.mode === 'mobile') ? data.mode : game.mode);
    renderBest();
    requestAnimationFrame(frame);
  }

  // Test hook: read-only view of the running game for automated checks.
  window.__echoes = { game, player, world, entity, shifts, renderer, director, get flashlight() { return flashlight; }, get breathing() { return breathing; } };

  const hot = window.claude && window.claude.hot;
  try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ mode: game.mode })); } catch (e) { /* optional */ }
  if (hot && typeof hot.ready === 'function') hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
