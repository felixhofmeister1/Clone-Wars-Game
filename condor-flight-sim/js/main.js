/* =============================================================================
 * main.js — The Condor A330neo simulator application: renderer, world,
 * aircraft, cockpit, the simulation loop (FMGC at 30 Hz, flight model at
 * 120 Hz, time acceleration), views (cockpit, chase, drone, tower, fly-by,
 * cabin), cockpit interaction, commands, warnings & callouts, the flight
 * planner background and the landing report.
 * ========================================================================== */
(() => {
  'use strict';
  const { D2R, R2D, FT, KT, NM, clamp } = Geo;
  const $ = (id) => document.getElementById(id);
  Geo.setMagvarGrid(window.CONDOR_MAGVAR);
  const AIRPORTS = window.CONDOR_AIRPORTS;
  const BY = new Map(AIRPORTS.map((a) => [a.icao, a]));
  const params = new URLSearchParams(location.search);
  const MAXDT = +(params.get('maxdt') || 0.1); // frame-time cap (raised only by automated tests)

  /* ================================================================ renderer */
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let lowQ = isTouch || params.get('quality') === 'low';
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, logarithmicDepthBuffer: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shots') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowQ ? 1.25 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb8d3ec, 30000, 250000);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 4e6);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const frame = new WorldFrame();
  const sky = new Sky();
  scene.add(sky.sunLight, sky.sunLight.target, sky.hemi);

  // Environment map for the aircraft's paint and metal (sky gradient, refreshed with daylight)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envUniforms = { top: { value: new THREE.Color(0x4f86d0) }, hor: { value: new THREE.Color(0xc4d8ea) }, gnd: { value: new THREE.Color(0x4d4a44) } };
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: envUniforms,
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, hor, gnd; varying vec3 d; void main(){ vec3 c = d.y > 0. ? mix(hor, top, pow(d.y, .6)) : mix(hor, gnd, min(1., -d.y*4.)); gl_FragColor = vec4(c,1.); }',
  })));
  let envTarget = null, envDay = -1;
  function refreshEnv(day, horizon) {
    if (Math.abs(day - envDay) < 0.08) return;
    envDay = day;
    envUniforms.top.value.set(0x4f86d0).multiplyScalar(0.04 + day);
    envUniforms.hor.value.copy(horizon);
    envUniforms.gnd.value.set(0x4d4a44).multiplyScalar(0.05 + day);
    if (envTarget) envTarget.dispose();
    envTarget = pmrem.fromScene(envScene, 0.02);
    scene.environment = envTarget.texture;
  }

  let terrain = new Terrain(renderer, { imagery: params.get('imagery') || 'esri', lowQuality: lowQ });
  terrain.requested = params.get('imagery') || 'esri';
  terrain.setAirports(AIRPORTS);
  scene.add(terrain.group);
  const airports3d = new Airports3D(renderer);
  airports3d.setAirports(AIRPORTS);
  scene.add(airports3d.group);

  // Base earth: a sphere just below sea level so there is always ground under the
  // horizon, even before the first scenery tiles arrive.
  const earthMat = new THREE.MeshBasicMaterial({ color: 0x2a3a2e });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(Geo.R - 60, 96, 48), earthMat);
  earth.matrixAutoUpdate = false;
  earth.renderOrder = -5;
  scene.add(earth);

  const avionics = new Avionics();
  const model = new A330Model.AircraftModel('island', { lowQuality: lowQ });
  scene.add(model.root);
  const cockpit = new Cockpit3D(avionics);
  model.root.add(cockpit.group);
  const shadow = A330Model.makeShadow();
  scene.add(shadow);

  const input = new FlightInput();
  const audio = new SimAudio();
  const ui = new SimUI();

  /* ================================================================ state */
  const sim = {
    mode: 'menu', paused: false, rate: 1, utc: new Date(), cfg: null, flightTime: 0,
    lights: { nav: true, beacon: true, strobe: false, landing: false, taxi: true, logo: true, seatbelts: true },
    report: null, touchdown: null, landedAt: null, fuelStart: 0, crashShown: false, reportShown: false,
    toastT: 0, subT: 0, lastAltAlert: null, lastHudT: 0, frameNo: 0,
  };
  let ac = null, fm = null, plan = null, weather = null;
  const RATES = [1, 2, 4, 8, 16, 32, 64, 128];

  const view = { mode: 'cockpit', ext: 'chase', yaw: 0, pitch: -4 * D2R, fov: 64, headYaw: 0, headPitch: -11 * D2R, dist: 95, chaseYaw: 0, chasePitch: 8 * D2R, droneYaw: 0.6, dronePitch: 12 * D2R, flyby: null, smoothHdg: null, menuT: 0 };

  /* ================================================================ environment for the FDM */
  const ground = { lat: 1e9, lon: 1e9, h: 0, surface: 'runway' };
  function groundQuery(lat, lon) {
    if (Math.abs(lat - ground.lat) > 1e-6 || Math.abs(lon - ground.lon) > 1e-6) {
      const r = terrain.heightAt(lat, lon);
      ground.lat = lat; ground.lon = lon; ground.h = r.h; ground.surface = r.surface;
    }
    return ground;
  }
  function makeEnv(w, lat) {
    return {
      groundHeight: (la, lo) => groundQuery(la, lo).h,
      surface: (la, lo) => groundQuery(la, lo).surface,
      wind: (alt, la, lo, t) => w.fn(alt, la, lo, t),
      isaDev: w.isaDev(lat),
    };
  }

  /* ================================================================ flight setup */
  function utcFor(timeSel, ap) {
    const now = new Date();
    if (timeSel === 'now') return now;
    // Local solar hour at the departure airport
    const local = { morning: 8.5, noon: 12.5, sunset: 0, night: 23 }[timeSel];
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
    if (timeSel === 'sunset') {
      // Search for the sun at ~2° elevation in the evening
      let best = 18, bestErr = 1e9;
      for (let h = 14; h <= 22; h += 0.05) {
        const t = new Date(d.getTime() + (h - 12 - ap.lon / 15) * 3600e3);
        const s = sunPosition(t);
        const el = 90 - Geo.distance(ap.lat, ap.lon, s.lat, s.lon) / Geo.R * R2D;
        if (Math.abs(el - 3) < bestErr) { bestErr = Math.abs(el - 3); best = h; }
      }
      return new Date(d.getTime() + (best - 12 - ap.lon / 15) * 3600e3);
    }
    return new Date(d.getTime() + (local - 12 - ap.lon / 15) * 3600e3);
  }

  function startFlight(cfg) {
    sim.cfg = cfg;
    const dep = BY.get(cfg.dep), arr = BY.get(cfg.arr);
    plan = FlightPlan.build({ dep, depRwy: cfg.depRwy, arr, arrRwy: cfg.arrRwy, cruiseFt: cfg.cruiseFt });
    weather = cfg.weather || makeWeather(cfg.wx, dep, arr);
    // Scenery provider & quality
    lowQ = cfg.quality === 'low' || (cfg.quality === 'auto' && isTouch);
    renderer.setPixelRatio(Math.min(devicePixelRatio, lowQ ? 1.25 : 2));
    if (cfg.imagery !== terrain.requested) {
      scene.remove(terrain.group);
      terrain = new Terrain(renderer, { imagery: cfg.imagery, lowQuality: lowQ });
      terrain.requested = cfg.imagery;
      terrain.setAirports(AIRPORTS);
      terrain.onStatus((m) => toast(m));
      scene.add(terrain.group);
    }
    ground.lat = 1e9;
    ac = new FDM.Aircraft(makeEnv(weather, dep.lat));
    ac.controls.law = cfg.law || 'normal';
    const rw = plan.depRwy;
    const common = { fuel: cfg.fuel, payload: cfg.payload, flexTemp: clamp(Math.round(55 - (cfg.tow - 200000) / 2500), 36, 68) };
    sim.utc = utcFor(cfg.time, dep);
    sim.flightTime = 0; sim.touchdown = null; sim.landedAt = null; sim.crashShown = false; sim.reportShown = false; sim.rate = 1;
    sim.lastAltAlert = null; sim.tenK = null;
    sim.lights = { nav: true, beacon: true, strobe: false, landing: false, taxi: true, logo: true, seatbelts: true };

    if (cfg.start === 'final') {
      const aRw = plan.arrRwy;
      const dNm = 12;
      const p = Geo.destination(aRw.thr.lat, aRw.thr.lon, aRw.hdg + 180, dNm * NM + 300);
      const altFt = aRw.elev / FT + dNm * FlightPlan.FT_PER_NM + 50;
      ac = new FDM.Aircraft(makeEnv(weather, arr.lat));
      ac.controls.law = cfg.law || 'normal';
      const lw = Math.max(cfg.fuelPlan.finalRes + cfg.fuelPlan.alternate + 1500, 7500);
      ac.reset(Object.assign({}, common, { fuel: lw, lat: p.lat, lon: p.lon, heading: aRw.hdg, onGround: false, alt: altFt * FT, tas: 75 }));
      const vapp = Math.round(1.23 * FDM.vs1g(5, ac.mass) / KT + 5);
      ac.trimFlight({ lat: p.lat, lon: p.lon, heading: aRw.hdg, alt: altFt * FT, ias: vapp, gamma: -3, flapLever: 4, gearDown: true, spoilersArmed: true, conf: 5 });
      ac.controls.autobrake = 2;
      ac.controls.throttle = 0.6;
      input.setDetent(0.6);
      fm = new Autoflight.FMGC(ac, plan);
      fm.active = plan.wps.length - 1;
      fm.phase = 'approach';
      fm.fcu.alt = Math.round((aRw.elev / FT + 3000) / 100) * 100;
      fm.fcu.appr = true; fm.setLat('LOC'); fm.setVert('G/S');
      fm.athrArmed = true; fm.athrActive = true; fm.fcu.athr = true; fm.athrI = 0.35;
      fm.fcu.hdg = Math.round(aRw.magHdg);
      sim.fuelStart = cfg.fuel;
      sim.utc = new Date(sim.utc.getTime() + cfg.fuelPlan.hours * 3600e3);
      sim.lights.landing = true; sim.lights.strobe = true;
      fm.updateApproachSpeeds();
      view.mode = 'cockpit';
    } else if (cfg.start === 'cruise') {
      const distAlong = Math.min(plan.todDist - 30 * NM, Math.max(plan.tocDist + 40 * NM, plan.total * 0.25));
      const pos = pointAlong(plan, distAlong);
      ac.reset(Object.assign({}, common, { lat: pos.lat, lon: pos.lon, heading: pos.course, onGround: false, alt: cfg.cruiseFt * FT, tas: 240 }));
      const burned = (distAlong / NM) / 470 * 6200;
      ac.fuel = Math.max(8000, cfg.fuel - burned);
      const ias = FDM.tasToCas(0.82 * FDM.atmosphere(cfg.cruiseFt * FT, ac.env.isaDev).a, FDM.atmosphere(cfg.cruiseFt * FT, ac.env.isaDev)) / KT;
      ac.trimFlight({ lat: pos.lat, lon: pos.lon, heading: pos.course, alt: cfg.cruiseFt * FT, ias, gamma: 0, flapLever: 0, gearDown: false });
      ac.controls.throttle = 0.6; input.setDetent(0.6);
      ac.controls.spoilersArmed = false;
      fm = new Autoflight.FMGC(ac, plan);
      fm.active = pos.leg;
      fm.phase = 'cruise'; fm.setLat('NAV'); fm.setVert('ALT CRZ');
      fm.fcu.alt = cfg.cruiseFt; fm.fcu.ap1 = true; ac.ap.engaged = true;
      fm.athrArmed = true; fm.athrActive = true; fm.fcu.athr = true; fm.athrI = 0.55;
      sim.fuelStart = cfg.fuel;
      sim.utc = new Date(sim.utc.getTime() + (distAlong / NM / 470 + 0.3) * 3600e3);
      sim.lights.strobe = true; sim.lights.taxi = false; sim.lights.seatbelts = false;
      sim.tenK = true;
    } else {
      // Lined up on the runway: 40 m past the runway end, parking brake set.
      const p = Geo.destination(rw.lat, rw.lon, rw.hdg, 40);
      ac.reset(Object.assign({}, common, { lat: p.lat, lon: p.lon, heading: rw.hdg, onGround: true, flapLever: 1, spoilersArmed: true, autobrake: 3, parkingBrake: true }));
      input.setDetent(0);
      fm = new Autoflight.FMGC(ac, plan);
      fm.fcu.fd = true;
      fm.armLat('NAV'); fm.armVert('CLB');
      sim.fuelStart = cfg.fuel;
      sim.lights.strobe = true; sim.lights.landing = true;
      if (cfg.voice) setTimeout(() => audio.say('Cabin crew, please be seated for take off.', { pitch: 1, rate: 1.02 }), 1500);
    }
    fm.computeTakeoffSpeeds();
    fm.modeBox = {};
    model.setLivery(cfg.livery);
    input.enabled = true;
    input.settings.sensitivity = cfg.sens;
    input.settings.invertThrottle = cfg.invThr;
    audio.init(); audio.setVolume(cfg.vol); audio.voice = cfg.voice;
    sim.mode = 'flight'; sim.paused = false;
    view.mode = cfg.start === 'cruise' ? 'chase' : 'cockpit';
    if (view.mode !== 'cockpit') view.ext = 'chase';
    view.headYaw = 0; view.headPitch = -11 * D2R; view.fov = 64;
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('report').classList.add('hidden'); $('pauseMenu').classList.add('hidden');
    const touchUI = cfg.controls === 'touch' || (cfg.controls === 'auto' && isTouch);
    $('touch').classList.toggle('hidden', !touchUI);
    $('tb-from').textContent = dep.iata; $('tb-to').textContent = arr.iata;
    $('credits').textContent = `${terrain.credit} · Elevation: AWS Terrain Tiles · Airports: OurAirports`;
    setPanel(false);
    try { localStorage.setItem('condor-sim-cfg', JSON.stringify(Object.assign({}, cfg, { weather: undefined, fuelPlan: undefined }))); } catch (e) { /* private mode */ }
    toast(`${dep.city} → ${arr.city} · ${plan.arrRwy.ils.ident} ${plan.arrRwy.ils.freq.toFixed(2)} · FL${Math.round(cfg.cruiseFt / 100)}`);
  }

  function pointAlong(p, dist) {
    const w = p.wps;
    for (let i = 1; i < w.length; i++) if (w[i].dist >= dist) {
      const a = w[i - 1], b = w[i];
      const f = clamp((dist - a.dist) / Math.max(1, b.dist - a.dist), 0, 1);
      const q = Geo.intermediate(a.lat, a.lon, b.lat, b.lon, f);
      return { lat: q.lat, lon: q.lon, course: Geo.bearing(q.lat, q.lon, b.lat, b.lon), leg: i };
    }
    const l = w[w.length - 1];
    return { lat: l.lat, lon: l.lon, course: l.course || 0, leg: w.length - 1 };
  }

  /* ================================================================ commands */
  function command(c, v) {
    if (sim.mode !== 'flight' || !ac) {
      if (c === 'pause' && sim.mode === 'flight') togglePause();
      return;
    }
    const k = ac.controls;
    switch (c) {
      case 'gear':
        if (ac.wowMain && k.gearDown) { toast('Gear lever locked — weight on wheels'); break; }
        k.gearDown = !k.gearDown; audio.thunk(); toast(k.gearDown ? 'Gear DOWN' : 'Gear UP'); break;
      case 'flaps': {
        const n = clamp(k.flapLever + v, 0, 4);
        if (n !== k.flapLever) { k.flapLever = n; audio.click(); toast(`Flaps ${['0', '1', '2', '3', 'FULL'][n]}`); }
        break;
      }
      case 'speedbrakeCycle': k.speedbrake = k.speedbrake < 0.25 ? 0.5 : k.speedbrake < 0.75 ? 1 : 0; toast(`Speed brake ${k.speedbrake ? Math.round(k.speedbrake * 100) + '%' : 'RETRACTED'}`); audio.click(); break;
      case 'speedbrake': k.speedbrake = clamp(Math.round((k.speedbrake + v * 0.25) * 4) / 4, 0, 1); toast(`Speed brake ${Math.round(k.speedbrake * 100)}%`); break;
      case 'spoilersArm': k.spoilersArmed = !k.spoilersArmed; toast(k.spoilersArmed ? 'Ground spoilers ARMED' : 'Ground spoilers disarmed'); audio.click(); break;
      case 'parkbrake': k.parkingBrake = !k.parkingBrake; toast(k.parkingBrake ? 'Parking brake ON' : 'Parking brake released'); audio.click(); break;
      case 'autobrakeCycle': k.autobrake = (k.autobrake + 1) % 4; toast(`Autobrake ${['OFF', 'LO', 'MED', 'MAX'][k.autobrake]}`); audio.click(); break;
      case 'autobrake': k.autobrake = k.autobrake === v ? 0 : v; toast(`Autobrake ${['OFF', 'LO', 'MED', 'MAX'][k.autobrake]}`); audio.click(); break;
      case 'thrust': input.stepDetent(v); break;
      case 'detent': input.setDetent(v); toast(`Thrust levers ${{ 0: 'IDLE', 0.6: 'CL', 0.8: 'FLX/MCT', 1: 'TOGA' }[v]}`); break;
      case 'apOff': fm.fcuAction('apOff'); break;
      case 'ap1': case 'ap2': case 'athr': case 'appr': case 'loc': case 'hdgPush': case 'hdgPull': case 'altPush': case 'altPull': case 'spdPush': case 'spdPull':
        fm.fcuAction(c); audio.click(); break;
      case 'hdgTurn': case 'spdTurn': case 'altTurn': case 'vsTurn': fm.fcuAction(c, v); break;
      case 'viewToggle': setView(view.mode === 'cockpit' ? view.ext : 'cockpit'); break;
      case 'viewCycle': {
        const ext = ['chase', 'drone', 'tower', 'flyby', 'cabin'];
        const i = view.mode === 'cockpit' ? -1 : ext.indexOf(view.mode);
        setView(ext[(i + 1) % ext.length]);
        break;
      }
      case 'panel': setPanel($('panel2d').classList.contains('hidden')); break;
      case 'map': $('mapOverlay').classList.toggle('hidden'); syncOverlayClass(); break;
      case 'timeScale': changeRate(v); break;
      case 'pause': togglePause(); break;
      case 'help': $('help').classList.toggle('hidden'); syncOverlayClass(); break;
      case 'message': toast(v); break;
      case 'lights': sim.lights.landing = !sim.lights.landing; toast(`Landing lights ${sim.lights.landing ? 'ON' : 'OFF'}`); break;
      case 'parkbrakeOff': k.parkingBrake = false; break;
    }
  }
  input.onCommand = command;
  cockpit.onControl = (what, v) => {
    const map = { gear: ['gear'], flaps: ['flaps', v], speedbrake: ['speedbrake', v], parkbrake: ['parkbrake'], autobrake: ['autobrake', v], thrust: ['thrust', v] };
    if (map[what]) command(...map[what]);
  };
  cockpit.onMaster = () => { fm.apOffWarn = 0; fm.athrOffWarn = 0; };

  function syncOverlayClass() {
    const open = ['mapOverlay', 'help', 'pauseMenu', 'report'].some((id) => !$(id).classList.contains('hidden'));
    document.body.classList.toggle('overlay-open', open);
  }
  new MutationObserver(syncOverlayClass).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  function setView(m) {
    view.mode = m;
    if (m !== 'cockpit') view.ext = m;
    if (m === 'flyby') view.flyby = null;
    const names = { cockpit: 'COCKPIT', chase: 'CHASE', drone: 'DRONE', tower: 'TOWER', flyby: 'FLY-BY', cabin: 'CABIN' };
    $('tb-view-name').textContent = names[m];
    toast(`View: ${names[m].toLowerCase()}`);
    setPanel(false);
  }
  function setPanel(on) {
    $('panel2d').classList.toggle('hidden', !on);
    $('minidata').classList.toggle('hidden', on || view.mode === 'cockpit');
  }
  function changeRate(dir) {
    const i = RATES.indexOf(sim.rate);
    const n = RATES[clamp(i + dir, 0, RATES.length - 1)];
    const max = maxRate();
    if (n > max) { toast(max === 1 ? 'Time acceleration is available once airborne' : `Max ${max}× here${max < 128 ? ' — engage the AP above 10,000 ft for more' : ''}`); sim.rate = Math.min(n, max); }
    else sim.rate = n;
  }
  function maxRate() {
    if (!ac || ac.crashed) return 1;
    if (ac.onGround) return 2;
    const agl = ac.agl / FT;
    if ((fm.fcu.ap1 || fm.fcu.ap2) && agl > 10000) return 128;
    if (agl > 3000) return 8;
    return 4;
  }
  function togglePause() {
    if (sim.mode !== 'flight') return;
    sim.paused = !sim.paused;
    $('pauseMenu').classList.toggle('hidden', !sim.paused);
    if (sim.paused) {
      $('pause-info').textContent = `${plan.dep.city} → ${plan.arr.city} · ${fm.phase} · fuel ${(ac.fuel / 1000).toFixed(1)} t · sim time ${Math.floor(sim.flightTime / 3600)}h${String(Math.floor(sim.flightTime / 60) % 60).padStart(2, '0')}`;
      if (window.speechSynthesis) speechSynthesis.cancel();
    }
  }

  /* ================================================================ events */
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); sim.toastT = 3.2; }
  function subtitle(msg, secs = 2.2) { const s = $('subtitle'); s.textContent = msg; s.style.opacity = 1; sim.subT = secs; }

  function handleEvents() {
    for (const e of ac.events) {
      switch (e.type) {
        case 'liftoff': sim.liftoffT = sim.flightTime; break;
        case 'touchdown': {
          const fpm = -e.vs;
          audio.touchdown(fpm);
          if (!sim.touchdown) sim.touchdown = Object.assign({ fuel: ac.fuel, vapp: fm.perf.vapp, flightTime: sim.flightTime, hdg: ac.heading * R2D }, e);
          subtitle(`Touchdown ${Math.round(fpm)} fpm`, 3);
          break;
        }
        case 'tailStrike': toast('⚠ TAIL STRIKE'); audio.masterCaution(); break;
        case 'crash': crashed(e.reason); break;
      }
    }
    ac.events.length = 0;
    for (const e of fm.events) {
      switch (e.type) {
        case 'callout': if (sim.cfg.voice) audio.say(e.text, { rate: e.text === 'RETARD' ? 1.25 : 1.15 }); subtitle(e.text === 'RETARD' ? 'RETARD — thrust levers to IDLE (1)' : e.text); break;
        case 'gpws': audio.say(e.text, { rate: 1.2, pitch: 0.6 }); $('warnbar').textContent = e.text; sim.warnT = 2.5; break;
        case 'apDisconnect': audio.cavalryCharge(); fm.apOffWarn = performance.now(); toast(`AP OFF${e.reason === 'sidestick' ? ' (sidestick takeover)' : ''}`); if (sim.rate > 1) sim.rate = 1; break;
        case 'apEngage': toast('AP1 engaged'); break;
        case 'athrDisconnect': if (e.wasActive || e.reason === 'button') { audio.masterCaution(); fm.athrOffWarn = performance.now(); } toast('A/THR OFF'); break;
        case 'stall': audio.cricket(); if (sim.cfg.voice) audio.say('Stall', { rate: 1.3 }); break;
        case 'overspeed': audio.clacker(); break;
        case 'mode': { const m = e.lat || e.vert; if (m) fm.modeBox[m] = performance.now(); break; }
        case 'tod': toast('Top of descent — dial a lower FCU altitude (End) and push the ALT knob (U)'); audio.chime(); if (sim.rate > 4) sim.rate = 1; break;
        case 'phase':
          if (e.phase === 'approach' && sim.rate > 1) sim.rate = 1;
          if (e.phase === 'climb') toast('Climb — flaps up on schedule, levers in CL');
          break;
        case 'lvrClb': subtitle('LVR CLB — thrust levers to CL (2)', 4); break;
        case 'goAround': toast('GO AROUND — flaps one step up, positive climb: gear up'); break;
        case 'rejectedTakeoff': toast('Rejected take-off'); break;
        case 'alphaFloor': toast('A.FLOOR — TOGA thrust'); audio.masterCaution(); break;
        case 'message': toast(e.text); if (e.level === 'caution') audio.masterCaution(); break;
        case 'takeoffPower': sim.takeoffT = sim.flightTime; break;
      }
    }
    fm.events.length = 0;
  }

  function crashed(reason) {
    if (sim.crashShown) return;
    sim.crashShown = true;
    audio.noiseBurst(1.8, 300, 1.2);
    sim.rate = 1;
    setTimeout(() => {
      ui.showReport({ crashed: true, title: reason, grade: '✕', stats: flightStats(), note: 'The flight ended in an accident. Check your speed, configuration and sink rate — the ECAM and callouts will help.' });
    }, 1600);
  }

  function flightStats() {
    const s = [];
    s.push(['Route', `${plan.dep.iata} → ${plan.arr.iata}`]);
    s.push(['Flight time', `${Math.floor(sim.flightTime / 3600)}h ${String(Math.floor(sim.flightTime / 60) % 60).padStart(2, '0')}m`]);
    s.push(['Fuel used', `${((sim.fuelStart - ac.fuel) / 1000).toFixed(1)} t`]);
    return s;
  }

  /** The runway (of any network airport) that a touchdown point lies on. */
  function findRunway(lat, lon, hdgDeg) {
    let best = null;
    for (const ap of AIRPORTS) {
      if (Geo.distance(lat, lon, ap.lat, ap.lon) > 9000) continue;
      for (const rw of ap.runways) for (const e of rw.ends) {
        const r = FlightPlan.runwayEnd(ap, e.id);
        if (hdgDeg != null && Math.abs(Geo.wrap180(hdgDeg - r.hdg)) > 50) continue;
        const ti = Geo.trackInfo(lat, lon, r.thr.lat, r.thr.lon, r.far.lat, r.far.lon);
        if (Math.abs(ti.xtk) > r.width / 2 + 40 || ti.atk < -600 || ti.atk > r.length + 200) continue;
        if (!best || Math.abs(ti.xtk) < Math.abs(best.ti.xtk)) best = { ap, r, ti };
      }
    }
    return best;
  }

  function landingReport() {
    const td = sim.touchdown;
    const found = findRunway(td.lat, td.lon, td.hdg);
    if (!found) {
      ui.showReport({ title: 'Landed off the runway', grade: 'F', stats: [['Touchdown rate', `${Math.round(-td.vs)} fpm`], ...flightStats()], note: 'The aircraft came to rest away from any runway.' });
      return;
    }
    const rw = found.r;
    const onRwy = found.ti;
    const stop = Geo.trackInfo(ac.lat, ac.lon, rw.thr.lat, rw.thr.lon, rw.far.lat, rw.far.lon);
    const fpm = -td.vs;
    let score = 100;
    const notes = [];
    if (fpm > 360) score -= (fpm - 360) / 8;
    if (fpm > 600) { score -= 20; notes.push('Hard landing — a maintenance inspection is due.'); }
    if (fpm < 60) notes.push('Very smooth!');
    const dThr = onRwy.atk;
    if (dThr < 150) { score -= (150 - dThr) / 5; notes.push('Touched down very early.'); }
    if (dThr > 700) { score -= (dThr - 700) / 20; notes.push('Long landing — aim for the touchdown zone markers 300–600 m in.'); }
    const cl = Math.abs(onRwy.xtk);
    if (cl > 4) score -= (cl - 4) * 2;
    const dv = td.ias - (td.vapp || fm.perf.vapp);
    if (Math.abs(dv) > 5) score -= (Math.abs(dv) - 5) * 1.5;
    if (td.gMax > 1.45) score -= (td.gMax - 1.45) * 40;
    if (ac.tailStrike) { score -= 30; notes.push('Tail strike on landing.'); }
    if (Math.abs(td.roll) > 5) score -= (Math.abs(td.roll) - 5) * 3;
    score = clamp(Math.round(score), 0, 100);
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
    const stats = [
      ['Touchdown rate', `${Math.round(fpm)} fpm`], ['Peak load', `${td.gMax.toFixed(2)} g`], ['Pitch', `${td.pitch.toFixed(1)}°`],
      ['From threshold', `${Math.round(dThr)} m`], ['Centreline', `${onRwy.xtk >= 0 ? 'R' : 'L'} ${cl.toFixed(1)} m`], ['Speed', `${Math.round(td.ias)} kt (${dv >= 0 ? '+' : ''}${Math.round(dv)})`],
      ['Stopped after', `${Math.round(stop.atk - dThr)} m`], ...flightStats(),
    ];
    const city = found.ap.city;
    if (found.ap !== plan.arr) notes.push(found.ap === plan.dep ? 'You returned to the departure airport.' : `Diverted to ${city}.`);
    stats.unshift(['Runway', `${found.ap.iata} ${rw.id}`]);
    ui.showReport({ title: `Welcome to ${city}`, grade, stats, note: `Score ${score}/100. ${notes.join(' ')}` });
    if (sim.cfg.voice) setTimeout(() => audio.say(`Ladies and gentlemen, welcome to ${city}. On behalf of Condor and the entire crew, thank you for flying with us.`, { pitch: 1, rate: 1.0 }), 1200);
  }

  /* ================================================================ skip ahead */
  function skipToTod() {
    if (!ac || fm.phase !== 'cruise' || !(fm.fcu.ap1 || fm.fcu.ap2) || !fm.prog) return;
    const target = plan.todDist - 25 * NM;
    const flown = fm.prog.flown;
    if (target <= flown + 5 * NM) { toast('Already near the top of descent'); return; }
    const pos = pointAlong(plan, target);
    const gsKt = Math.max(ac.gs / KT, 350);
    const hours = (target - flown) / NM / gsKt;
    const burn = hours * (ac.engines[0].ff + ac.engines[1].ff) * 3600;
    const alt = ac.alt, cas = ac.cas / KT, lever = ac.controls.throttle;
    ac.fuel = Math.max(3000, ac.fuel - burn);
    ac.trimFlight({ lat: pos.lat, lon: pos.lon, heading: pos.course, alt, ias: cas, gamma: 0, flapLever: 0, gearDown: false });
    ac.controls.throttle = lever; input.setDetent(lever);
    fm.active = pos.leg;
    sim.utc = new Date(sim.utc.getTime() + hours * 3600e3);
    sim.flightTime += hours * 3600;
    toast(`Skipped ${Math.round((target - flown) / NM)} NM (${Math.floor(hours)}h${String(Math.round((hours % 1) * 60)).padStart(2, '0')}) — 25 NM before T/D`);
  }

  /* ================================================================ pointer: look & cockpit clicks */
  const ray = new THREE.Raycaster();
  const ptr = { down: false, button: 0, x: 0, y: 0, moved: 0, id: null };
  function pickCockpit(ev) {
    if (view.mode !== 'cockpit') return null;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(cockpit.interactive, false);
    return hits[0] || null;
  }
  function panelAction(panel, uv, button, wheel) {
    const cv = avionics.canvases[panel];
    const x = uv.x * cv.width, y = (1 - uv.y) * cv.height;
    const reg = avionics.hit(panel, x, y);
    if (!reg) return false;
    fcuRegion(panel, reg, button, wheel, null);
    return true;
  }
  function fcuRegion(panel, reg, button, wheel, rel) {
    if (!fm) return;
    const shift = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    // rel: position inside the region (2D panel taps): left third = turn -, right third = turn +, top = pull, bottom = push
    let act = wheel ? 'turn' : button === 2 ? 'pull' : 'push';
    let dir = wheel ? -Math.sign(wheel) : 0;
    if (rel && reg.kind === 'knob' && !wheel) {
      if (rel.x < 0.33) { act = 'turn'; dir = -1; } else if (rel.x > 0.67) { act = 'turn'; dir = 1; } else act = rel.y < 0.5 ? 'pull' : 'push';
    }
    const id = reg.id;
    audio.click();
    if (panel === 'efis') {
      if (id === 'fd') fm.fcuAction('fd');
      else if (id === 'ls') avionics.efis.ls = !avionics.efis.ls;
      else if (id === 'baro') fm.fcuAction('std');
      else if (id === 'ndMode') avionics.efis.ndMode = avionics.efis.ndMode === 'ARC' ? 'ROSE' : 'ARC';
      else if (id === 'ndRange') {
        const R = [10, 20, 40, 80, 160, 320, 640];
        const d = act === 'turn' ? dir : act === 'pull' ? -1 : 1;
        avionics.efis.range = R[clamp(R.indexOf(avionics.efis.range) + d, 0, R.length - 1)];
      }
      return;
    }
    const knob = { spd: 'spd', hdg: 'hdg', alt: 'alt', vs: 'vs' }[id];
    if (knob) {
      if (act === 'turn') {
        const step = { spd: shift ? 10 : 1, hdg: shift ? 10 : 1, alt: shift ? 100 : 1000, vs: 100 }[knob];
        fm.fcuAction(`${knob}Turn`, dir * step);
      } else fm.fcuAction(`${knob}${act === 'pull' ? 'Pull' : 'Push'}`);
      return;
    }
    if (id === 'exped') { toast('EXPED is not used by Condor SOPs'); return; }
    fm.fcuAction(id);
  }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    audio.init();
    ptr.down = true; ptr.button = e.button; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = 0; ptr.id = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (view.mode === 'cockpit' && !ptr.down) { const h = pickCockpit(e); canvas.style.cursor = h ? 'pointer' : 'default'; }
    if (!ptr.down) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.0045 * (view.mode === 'cockpit' ? view.fov / 62 : 1);
    if (view.mode === 'cockpit' || view.mode === 'cabin') {
      if (ptr.button === 0 && view.mode === 'cockpit' && ptr.moved < 6) return;
      view.headYaw = clamp(view.headYaw - dx * k, -2.6, 2.6); view.headPitch = clamp(view.headPitch - dy * k, -1.2, 1.0);
    } else if (view.mode === 'drone' || view.mode === 'chase' || view.mode === 'menu') {
      if (view.mode === 'drone') { view.droneYaw -= dx * k; view.dronePitch = clamp(view.dronePitch + dy * k, -0.2, 1.45); }
      else { view.chaseYaw -= dx * k; view.chasePitch = clamp(view.chasePitch + dy * k, -0.15, 1.4); }
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (ptr.down && ptr.moved < 6 && view.mode === 'cockpit' && sim.mode === 'flight') {
      const h = pickCockpit(e);
      if (h) {
        const o = h.object;
        if (o.userData.panel === 'fcu' || o.userData.panel === 'efis') panelAction(o.userData.panel, h.uv, e.button, 0);
        else if (o.userData.action) { o.userData.action(e.button, 0); audio.click(); }
      }
    }
    ptr.down = false;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (view.mode === 'cockpit' && sim.mode === 'flight') {
      const h = pickCockpit(e);
      if (h) {
        const o = h.object;
        if (o.userData.panel === 'fcu' || o.userData.panel === 'efis') { if (panelAction(o.userData.panel, h.uv, 0, e.deltaY)) return; }
        else if (o.userData.action) { o.userData.action(0, e.deltaY); return; }
      }
      view.fov = clamp(view.fov + Math.sign(e.deltaY) * 4, 22, 85);
    } else view.dist = clamp(view.dist * (e.deltaY > 0 ? 1.1 : 0.9), 25, 600);
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { view.headYaw = 0; view.headPitch = -11 * D2R; view.fov = 64; });

  // 2D FCU / EFIS overlay: use the live avionics canvases directly
  (() => {
    const fc = $('fcu-canvas');
    fc.replaceWith(avionics.canvases.fcu);
    avionics.canvases.fcu.id = 'fcu-canvas';
    const screens = { pfd2d: 'pfd', nd2d: 'nd', ewd2d: 'ewd' };
    for (const [id, k] of Object.entries(screens)) { const c = avionics.canvases[k]; $(id).replaceWith(c); c.className = 'scr'; c.id = id; }
    const cv = avionics.canvases.fcu;
    const at = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerup', (e) => {
      const [x, y] = at(e); const reg = avionics.hit('fcu', x, y);
      if (reg) fcuRegion('fcu', reg, e.button, 0, e.pointerType === 'mouse' && reg.kind === 'knob' && e.button === 0 ? { x: (x - reg.x) / reg.w, y: 0.9 } : { x: (x - reg.x) / reg.w, y: (y - reg.y) / reg.h });
    });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = at(e); const reg = avionics.hit('fcu', x, y); if (reg && reg.kind === 'knob') fcuRegion('fcu', reg, 0, e.deltaY, null); }, { passive: false });
    avionics.canvases.nd.addEventListener('pointerup', () => {
      const R = [10, 20, 40, 80, 160, 320, 640];
      avionics.efis.range = R[(R.indexOf(avionics.efis.range) + 1) % R.length];
      toast(`ND range ${avionics.efis.range} NM`);
    });
  })();

  /* ================================================================ touch controls */
  (() => {
    const stick = $('t-stick'), knob = $('t-stick-knob');
    let sid = null;
    const setStick = (e) => {
      const r = stick.getBoundingClientRect();
      const x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1), y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      input.touch.active = true; input.touch.roll = x; input.touch.pitch = y;
      knob.style.transform = `translate(${x * 46}px, ${y * 46}px)`;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); audio.init(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e); });
    const rel = (e) => { if (e.pointerId !== sid) return; sid = null; input.touch.active = false; input.touch.pitch = input.touch.roll = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', rel); stick.addEventListener('pointercancel', rel);
    const thr = $('t-thrust-track'), tk = $('t-thrust-knob');
    let tid = null;
    const setThr = (e) => {
      const r = thr.getBoundingClientRect();
      let v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
      for (const d of [0, 0.6, 0.8, 1]) if (Math.abs(v - d) < 0.04) v = d;
      input.touch.throttle = v;
    };
    $('t-thrust').addEventListener('pointerdown', (e) => { tid = e.pointerId; $('t-thrust').setPointerCapture(tid); setThr(e); });
    $('t-thrust').addEventListener('pointermove', (e) => { if (e.pointerId === tid) setThr(e); });
    $('t-thrust').addEventListener('pointerup', () => { tid = null; });
    sim.touchThrKnob = tk;
    document.querySelectorAll('#t-buttons button').forEach((b) => {
      if (b.dataset.cmd) b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.init(); command(b.dataset.cmd, b.dataset.val != null ? +b.dataset.val : undefined); });
      if (b.dataset.hold) {
        const set = (on) => {
          b.classList.toggle('on', on);
          if (b.dataset.hold === 'brake') input.touch.brake = on;
          if (b.dataset.hold === 'reverse') input.touch.reverse = on;
          if (b.dataset.hold === 'rudderL') input.touch.rudder = on ? -1 : 0;
          if (b.dataset.hold === 'rudderR') input.touch.rudder = on ? 1 : 0;
        };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
        b.addEventListener('pointerup', () => set(false)); b.addEventListener('pointerleave', () => set(false)); b.addEventListener('pointercancel', () => set(false));
      }
    });
  })();

  /* ================================================================ HUD buttons & dialogs */
  $('tb-view').onclick = () => command('viewToggle');
  $('tb-panel').onclick = () => command('panel');
  $('tb-map').onclick = () => command('map');
  $('tb-help').onclick = () => command('help');
  $('tb-pause').onclick = () => togglePause();
  $('tb-faster').onclick = () => changeRate(1);
  $('tb-slower').onclick = () => changeRate(-1);
  $('tb-skip').onclick = () => skipToTod();
  $('btn-resume').onclick = () => togglePause();
  $('btn-restart').onclick = () => { $('pauseMenu').classList.add('hidden'); startFlight(sim.cfg); };
  $('btn-tomenu').onclick = () => toMenu();
  $('btn-help2').onclick = () => $('help').classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => $(b.dataset.close).classList.add('hidden')));
  $('btn-rep-menu').onclick = () => toMenu();
  $('btn-continue').onclick = () => { $('report').classList.add('hidden'); };
  $('btn-nextleg').onclick = () => {
    $('report').classList.add('hidden');
    if (ac.crashed) { startFlight(sim.cfg); return; }
    const c = Object.assign({}, sim.cfg);
    [c.dep, c.arr] = [c.arr, c.dep];
    const dep = BY.get(c.dep), arr = BY.get(c.arr);
    c.weather = makeWeather(c.wx, dep, arr);
    c.depRwy = FlightPlan.bestRunways(dep, c.weather.dep.dir, c.weather.dep.kt)[0].id;
    c.arrRwy = FlightPlan.bestRunways(arr, c.weather.arr.dir, c.weather.arr.kt)[0].id;
    const dist = Geo.distance(dep.lat, dep.lon, arr.lat, arr.lon) * 1.04;
    c.fuelPlan = FlightPlan.fuelPlan(dist, FDM.A339.oew + c.payload);
    c.fuel = Math.min(c.fuelPlan.block, FDM.A339.maxFuel) - c.fuelPlan.taxi;
    c.tow = FDM.A339.oew + c.payload + c.fuel;
    c.start = 'runway'; c.time = 'now';
    const keepUtc = sim.utc;
    startFlight(c);
    sim.utc = new Date(keepUtc.getTime() + 75 * 60e3); // turnaround
  };

  function toMenu() {
    sim.mode = 'menu'; sim.paused = false;
    input.enabled = false;
    $('pauseMenu').classList.add('hidden'); $('report').classList.add('hidden'); $('help').classList.add('hidden');
    $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('menu').classList.remove('hidden');
    if (window.speechSynthesis) speechSynthesis.cancel();
    menuAircraft();
  }

  /* ================================================================ menu background */
  let menuAc = null;
  function menuAircraft() {
    const cfg = ui.cfg || ui.config();
    const dep = BY.get(cfg.dep);
    const rw = FlightPlan.runwayEnd(dep, cfg.depRwy);
    if (!rw) return;
    const p = Geo.destination(rw.lat, rw.lon, rw.hdg, 40);
    menuAc = new FDM.Aircraft(makeEnv(makeWeather('calm', dep, dep), dep.lat));
    menuAc.reset({ lat: p.lat, lon: p.lon, heading: rw.hdg, onGround: true, flapLever: 1 });
    menuAc.engines.forEach((e) => { e.n1 = 21; });
    menuAc.gearComp = [0.19, 0.3, 0.3];
    ac = menuAc; fm = null;
    view.mode = 'menu';
    sim.utc = utcFor(cfg.time === 'now' ? 'now' : cfg.time, dep);
  }
  ui.onChange = (what) => {
    if (what === 'livery') model.setLivery(ui.livery);
    if (sim.mode === 'menu') menuAircraft();
  };
  ui.onFly = (cfg) => startFlight(cfg);

  /* ================================================================ camera */
  const tmpV = new THREE.Vector3();
  const C_MODEL = (M) => [M[0], -M[2], M[1], M[3], -M[5], M[4], M[6], -M[8], M[7]]; // model -> ECEF basis

  function placeAircraft() {
    frame.setOrigin(ac.lat, ac.lon);
    const B = C_MODEL(ac.M);
    frame.placeEcef(model.root, ac.pos, B);
    model.root.updateMatrixWorld(true);
    // Ground shadow: under the aircraft, projected along the sun, oriented to the heading
    const agl = ac.alt - ac.ground;
    const sunDir = sky.uniforms.sunDir.value;
    const vis = clamp(1 - agl / 250, 0, 1) * (sky.day || 0);
    shadow.visible = vis > 0.02;
    if (shadow.visible) {
      const k = sunDir.y > 0.15 ? agl / sunDir.y : agl / 0.15;
      const off = new THREE.Vector3(-sunDir.x * k, 0, -sunDir.z * k);
      const gp = Geo.llaToEcef(ac.lat, ac.lon, ac.ground + 0.35);
      const b = Geo.localBasis(ac.lat, ac.lon);
      const h = ac.heading;
      const fwd = [b.north[0] * Math.cos(h) + b.east[0] * Math.sin(h), b.north[1] * Math.cos(h) + b.east[1] * Math.sin(h), b.north[2] * Math.cos(h) + b.east[2] * Math.sin(h)];
      const right = [-b.north[0] * Math.sin(h) + b.east[0] * Math.cos(h), -b.north[1] * Math.sin(h) + b.east[1] * Math.cos(h), -b.north[2] * Math.sin(h) + b.east[2] * Math.cos(h)];
      const basis = [fwd[0], b.up[0], right[0], fwd[1], b.up[1], right[1], fwd[2], b.up[2], right[2]];
      const offE = [b.east[0] * off.x - b.north[0] * off.z, b.east[1] * off.x - b.north[1] * off.z, b.east[2] * off.x - b.north[2] * off.z];
      frame.placeEcef(shadow, [gp[0] + offE[0], gp[1] + offE[1], gp[2] + offE[2]], basis);
      shadow.material.opacity = 0.5 * vis;
    }
  }

  function updateCamera(dt) {
    const acPos = frame.point(ac.pos, new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0);
    const M = ac.M;
    const fwd = frame.dir([M[0], M[3], M[6]], new THREE.Vector3());
    const fwdH = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const hdg = Math.atan2(fwdH.x, -fwdH.z);
    const cockpitView = view.mode === 'cockpit';
    const cabinView = view.mode === 'cabin';
    model.setExteriorVisible(!cockpitView);
    model.parts.fuselage.visible = !cockpitView && !cabinView;
    $('cabinFrame').classList.toggle('hidden', !cabinView);
    cockpit.group.visible = cockpitView;
    if (cockpitView || cabinView) {
      if (camera.parent !== model.root) model.root.add(camera);
      if (cockpitView) {
        // Head position with a touch of runway rumble and g-loading
        const shake = ac.onGround ? clamp(ac.gs / 80, 0, 1) * 0.004 : Math.min(0.004, Math.abs((ac.nz || 1) - 1) * 0.01);
        camera.position.set(COCKPIT_EYE.x + (Math.random() - 0.5) * shake, COCKPIT_EYE.y + (Math.random() - 0.5) * shake - clamp(((ac.nz || 1) - 1) * 0.02, -0.03, 0.03), COCKPIT_EYE.z);
        camera.rotation.set(view.headPitch, -Math.PI / 2 + view.headYaw, 0);
        camera.fov = view.fov;
        camera.near = 0.03;
      } else {
        // Window seat behind the wing on the right side (row ~34)
        camera.position.set(-12.5, 0.55, 2.45);
        camera.rotation.set(view.headPitch - 0.02, -Math.PI + 0.62 + view.headYaw, 0);
        camera.fov = 60; camera.near = 0.05;
      }
    } else {
      if (camera.parent !== scene) scene.add(camera);
      camera.near = 0.5;
      let pos, target = acPos.clone().add(new THREE.Vector3(0, 2, 0));
      switch (view.mode) {
        case 'menu': {
          view.menuT += dt;
          const a = hdg + 2.3 + view.menuT * 0.05 + view.chaseYaw;
          const d = 78;
          pos = acPos.clone().add(new THREE.Vector3(Math.sin(a) * d, 9 + Math.sin(view.menuT * 0.1) * 3, -Math.cos(a) * d));
          camera.fov = 45;
          break;
        }
        case 'chase': {
          if (view.smoothHdg == null) view.smoothHdg = hdg;
          view.smoothHdg += Geo.wrap180((hdg - view.smoothHdg) * R2D) * D2R * clamp(dt * 2.5, 0, 1);
          const a = view.smoothHdg + Math.PI + view.chaseYaw, p = view.chasePitch;
          pos = acPos.clone().add(new THREE.Vector3(Math.sin(a) * Math.cos(p) * view.dist, Math.sin(p) * view.dist, -Math.cos(a) * Math.cos(p) * view.dist));
          camera.fov = 55;
          break;
        }
        case 'drone': {
          const a = view.droneYaw, p = view.dronePitch;
          pos = acPos.clone().add(new THREE.Vector3(Math.sin(a) * Math.cos(p) * view.dist, Math.sin(p) * view.dist, -Math.cos(a) * Math.cos(p) * view.dist));
          camera.fov = 55;
          break;
        }
        case 'tower': {
          const aps = [plan.dep, plan.arr].map((a) => ({ a, d: Geo.distance(ac.lat, ac.lon, a.lat, a.lon) })).sort((x, y) => x.d - y.d);
          const ap = aps[0].a;
          if (aps[0].d > 30000) { pos = null; break; }
          const rw = ap.runways[0];
          const mid = Geo.intermediate(rw.ends[0].lat, rw.ends[0].lon, rw.ends[1].lat, rw.ends[1].lon, 0.45);
          const h = Geo.bearing(rw.ends[0].lat, rw.ends[0].lon, rw.ends[1].lat, rw.ends[1].lon);
          const tw = Geo.destination(mid.lat, mid.lon, h + 90, 420);
          const tEcef = Geo.llaToEcef(tw.lat, tw.lon, terrain.heightAt(tw.lat, tw.lon).h + 45);
          pos = frame.point(tEcef, new THREE.Vector3());
          const dist = pos.distanceTo(acPos);
          camera.fov = clamp(2 * Math.atan(45 / dist) * R2D, 1.5, 60);
          break;
        }
        case 'flyby': {
          if (!view.flyby || frame.point(view.flyby, new THREE.Vector3()).distanceTo(acPos) > 2200) {
            const vel = ac.vel, sp = Math.hypot(...vel) || 1;
            const ahead = Math.max(250, sp * 7);
            const side = Geo.localBasis(ac.lat, ac.lon);
            const r = [-side.north[0] * Math.sin(ac.track) + side.east[0] * Math.cos(ac.track), -side.north[1] * Math.sin(ac.track) + side.east[1] * Math.cos(ac.track), -side.north[2] * Math.sin(ac.track) + side.east[2] * Math.cos(ac.track)];
            view.flyby = [0, 1, 2].map((i) => ac.pos[i] + (vel[i] / sp) * ahead + r[i] * 70 + side.up[i] * 12);
          }
          pos = frame.point(view.flyby, new THREE.Vector3());
          camera.fov = 45;
          break;
        }
      }
      if (!pos) { view.mode = 'chase'; return updateCamera(dt); }
      // Keep external cameras above the ground
      const camE = camEcefFrom(pos);
      const lla = Geo.ecefToLla(camE);
      const gh = terrain.heightAt(lla.lat, lla.lon).h + 2;
      if (lla.h < gh) pos.y += gh - lla.h;
      camera.position.copy(pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
    }
    camera.aspect = innerWidth / innerHeight;
    // With the instrument overlay open in an outside view, shift the projection so the
    // aircraft sits in the free area above the panel.
    const panelOn = !$('panel2d').classList.contains('hidden') && view.mode !== 'cockpit';
    if (panelOn) {
      const top = $('panel2d').getBoundingClientRect().top;
      const dy = Math.max(0, innerHeight / 2 - top / 2 - 20);
      camera.setViewOffset(innerWidth, innerHeight, 0, dy, innerWidth, innerHeight);
    } else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  function camEcefFrom(p) {
    const R = frame.R, O = frame.O;
    return [O[0] + R[0] * p.x + R[3] * p.y + R[6] * p.z, O[1] + R[1] * p.x + R[4] * p.y + R[7] * p.z, O[2] + R[2] * p.x + R[5] * p.y + R[8] * p.z];
  }

  /* ================================================================ HUD */
  const fmtT = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  function updateHud(dt) {
    sim.toastT -= dt; if (sim.toastT <= 0) $('toast').classList.remove('show');
    sim.subT -= dt; if (sim.subT <= 0) $('subtitle').style.opacity = 0;
    sim.warnT = (sim.warnT || 0) - dt; if (sim.warnT <= 0) $('warnbar').textContent = fm && fm.stallWarn ? 'STALL' : fm && fm.overspeedWarn ? 'OVERSPEED' : '';
    sim.lastHudT += dt;
    if (sim.lastHudT < 0.25) return;
    sim.lastHudT = 0;
    $('tb-phase').textContent = fm.phase.toUpperCase();
    $('tb-utc').textContent = fmtT(sim.utc) + 'Z';
    if (fm.prog) {
      const toGo = fm.prog.toGo / NM;
      $('tb-togo').textContent = `${Math.round(toGo)} NM`;
      const eta = new Date(sim.utc.getTime() + (toGo / Math.max(ac.gs / KT, 250)) * 3600e3);
      $('tb-eta').textContent = fmtT(eta) + 'Z';
    }
    $('tb-rate').textContent = `${sim.rate}×`;
    $('tb-skip').classList.toggle('hidden', !(fm.phase === 'cruise' && (fm.fcu.ap1 || fm.fcu.ap2) && fm.prog && fm.prog.flown < plan.todDist - 40 * NM));
    if (!$('minidata').classList.contains('hidden')) {
      $('md-ias').textContent = Math.round(ac.cas / KT);
      $('md-alt').textContent = Math.round(ac.alt / FT / 10) * 10;
      $('md-vs').textContent = Math.round(ac.vs / FT * 60 / 10) * 10;
      $('md-hdg').textContent = String(Math.round(Geo.wrap360(ac.heading * R2D - Geo.magvar(ac.lat, ac.lon)))).padStart(3, '0');
      const t = ac.controls.throttle;
      $('md-thr').textContent = t < -0.02 ? 'REV' : t < 0.05 ? 'IDLE' : t < 0.58 ? `${Math.round(t / 0.6 * 100)}%` : t < 0.7 ? 'CL' : t < 0.95 ? 'FLX' : 'TOGA';
      $('md-flaps').textContent = ac.P.confs[ac.conf].name;
      $('md-gear').textContent = ac.gearPos > 0.99 ? 'DN' : ac.gearPos < 0.01 ? 'UP' : '···';
    }
    if (!$('mapOverlay').classList.contains('hidden')) {
      const mc = $('map-canvas');
      ui.drawRouteMap(mc, plan.dep, plan.arr, { lat: ac.lat, lon: ac.lon, hdg: ac.heading * R2D });
    }
    const pend = terrain.pendingCount();
    $('loading').classList.toggle('hidden', pend < 12 || sim.flightTime > 120);
    $('loading-text').textContent = `Loading scenery (${pend})…`;
    if (sim.touchThrKnob) sim.touchThrKnob.style.bottom = `${clamp(ac.controls.throttle, 0, 1) * 100}%`;
  }

  /* ================================================================ misc per-frame logic */
  function flightLogic(dt) {
    const c = ac.controls, altFt = ac.alt / FT;
    // Lights: automatic-ish crew actions
    sim.lights.taxi = ac.gearPos > 0.9 && (ac.onGround || ac.agl / FT < 2500);
    if (!ac.onGround && altFt > (plan.depRwy.elev / FT + 10000) && ac.vs > 0) sim.lights.landing = false;
    if (!ac.onGround && fm.phase === 'approach' && ac.agl / FT < 10000) sim.lights.landing = true;
    // Seat-belt chime through 10,000 ft
    const above = ac.agl / FT > 10000;
    if (sim.tenK == null) sim.tenK = above;
    if (above !== sim.tenK) { sim.tenK = above; sim.lights.seatbelts = !above; if (sim.cfg.voice) audio.chime(); }
    // Altitude alert (C-chord) when approaching the FCU altitude in manual flight
    const d = Math.abs(fm.fcu.alt - altFt);
    const zone = d < 750 && d > 250 ? 'near' : d <= 250 ? 'at' : 'far';
    if (sim.lastAltAlert === 'far' && zone === 'near' && !(fm.fcu.ap1 || fm.fcu.ap2) && !ac.onGround && !fm.fcu.appr) audio.cChord();
    sim.lastAltAlert = zone;
    // Reverse thrust: hold R (or REV button) with the levers at idle, on the ground
    const pin = sim.pilot;
    if (pin.reverse && ac.onGround && input.throttle < 0.05) c.throttle = -0.9;
    else if (c.throttle < 0 && !pin.reverse) c.throttle = 0;
    // Parking brake released automatically when thrust is set for take-off? (no — the crew does it)
    if (c.parkingBrake && c.throttle > 0.75 && ac.onGround && !sim.pbWarned) { sim.pbWarned = true; toast('Parking brake is ON — release it with P'); }
    if (!c.parkingBrake) sim.pbWarned = false;
    // Landing complete → report
    if (sim.touchdown && ac.onGround && ac.gs < 12 * KT && !sim.reportShown && !ac.crashed) {
      sim.landedAt = sim.landedAt || sim.flightTime;
      if (sim.flightTime - sim.landedAt > 1.5) { sim.reportShown = true; landingReport(); }
    }
    if (sim.touchdown && !ac.onGround && ac.agl / FT > 100) sim.touchdown = null; // bounced / go-around
  }

  /* ================================================================ main loop */
  let last = performance.now();
  let avT = 0, avIdx = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const rdt = Math.min(MAXDT, (now - last) / 1000);
    last = now;
    sim.frameNo++;
    if (!ac) return;

    const T0 = performance.now();
    if (sim.mode === 'flight' && !sim.paused) {
      // Pilot inputs
      const pin = input.update(rdt);
      sim.pilot = pin;
      const c = ac.controls;
      c.pitch = pin.pitch; c.roll = pin.roll; c.yaw = pin.pedal;
      c.brakeL = c.brakeR = pin.brake;
      c.pitchTrim = pin.trim;
      if (!(pin.reverse && ac.onGround)) c.throttle = pin.throttle;
      if (sim.cfg.autoRudder && ac.onGround && ac.gs > 20 * KT && Math.abs(pin.pedal) < 0.05) {
        const rw = fm.phase === 'takeoff' || fm.phase === 'preflight' ? plan.depRwy : plan.arrRwy;
        const ti = Geo.trackInfo(ac.lat, ac.lon, rw.thr.lat, rw.thr.lon, rw.far.lat, rw.far.lon);
        c.yaw = clamp(-ti.xtk * 0.03 - Geo.wrap180(ac.heading * R2D - rw.hdg) * 0.08, -0.5, 0.5);
      }
      flightLogic(rdt);
      const rate = Math.min(sim.rate, maxRate());
      if (rate < sim.rate) sim.rate = rate;
      let rem = rdt * rate;
      const chunk = 1 / 30;
      let guard = 0;
      while (rem > 1e-6 && guard++ < 600) {
        const h = Math.min(rem, chunk);
        fm.update(h);
        ac.update(h);
        handleEvents();
        sim.flightTime += h;
        sim.utc = new Date(sim.utc.getTime() + h * 1000);
        rem -= h;
        if (ac.crashed) break;
      }
    } else if (sim.mode === 'menu') {
      sim.utc = new Date(sim.utc.getTime() + rdt * 1000);
    }

    const T1 = performance.now();
    // ---------- world & rendering
    placeAircraft();
    const camWorld = new THREE.Vector3();
    updateCamera(rdt);
    camera.getWorldPosition(camWorld);
    sky.update(sim.utc, frame, ac.alt, camera);
    const camE = camEcefFrom(camWorld);
    terrain.setLighting(sky.terrainTint);
    frame.placeEcef(earth, [0, 0, 0], null);
    earthMat.color.setRGB(0.12, 0.17, 0.2).multiply(sky.terrainTint);
    terrain.update(camE, frame);
    // Fog/haze: denser near the ground, thin at cruise altitude
    const altM = Math.max(0, Geo.ecefToLla(camE).h);
    const hk = clamp(altM / 11000, 0, 1);
    scene.fog.color.copy(sky.fogColor);
    scene.fog.near = 20000 + hk * 120000;
    scene.fog.far = 140000 + hk * 700000;
    refreshEnv(sky.day, sky.uniforms.horizon.value);
    const camLla = Geo.ecefToLla(camE);
    airports3d.update(rdt, camLla.lat, camLla.lon, frame, camWorld, camera, renderer, sky.night, sky.terrainTint);
    const pxScale = (renderer.getSize(new THREE.Vector2()).y * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * D2R) / 2));
    model.setPixelScale(pxScale);
    model.update(ac, rdt, sim.lights, sky.night);
    renderer.toneMappingExposure = 0.95 + sky.night * 0.5;

    const T2 = performance.now();
    if (sim.mode === 'flight' && fm) {
      cockpit.update(ac, fm, sky.night);
      // Displays: PFD every other frame, the rest round-robin
      avT += rdt;
      const S = { ac, fm, plan, utc: sim.utc, lightsSt: sim.lights, fuelStart: sim.fuelStart };
      const inside = view.mode === 'cockpit';
      const panelOn = !$('panel2d').classList.contains('hidden');
      const list = [];
      if (inside || panelOn) list.push('pfd');
      const others = inside ? ['nd', 'ewd', 'sd', 'fcu', 'efis', 'mcdu', 'nd', 'ewd', 'fcu'] : panelOn ? ['nd', 'ewd', 'fcu'] : [];
      if (others.length && (sim.frameNo & 1)) list.push(others[avIdx++ % others.length]);
      if (sim.frameNo % 2 === 0 && list.length) avionics.draw(S, avT, list), (avT = 0);
      else if (list.length > 1) avionics.draw(S, avT, list.slice(1)), (avT = 0);
      audio.update(ac, view.mode, rdt);
      updateHud(rdt);
    }

    const T3 = performance.now();
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    const T4 = performance.now();
    // Main-thread cost per frame (exponential average, ms): physics, world, avionics+HUD, render
    const P = sim.perf || (sim.perf = { sim: 0, world: 0, avionics: 0, render: 0, calls: 0, tris: 0 });
    const k = 0.05;
    P.sim += (T1 - T0 - P.sim) * k; P.world += (T2 - T1 - P.world) * k; P.avionics += (T3 - T2 - P.avionics) * k; P.render += (T4 - T3 - P.render) * k;
    P.calls = renderer.info.render.calls; P.tris = renderer.info.render.triangles;
  }

  /* ================================================================ boot */
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('condor-sim-cfg') || 'null'); } catch (e) { saved = null; }
  if (params.get('dep')) saved = Object.assign(saved || {}, { dep: params.get('dep'), arr: params.get('arr') || 'FAOR' });
  ui.initPlanner(saved);
  terrain.onStatus((m) => { const h = $('menu-hint'); if (h) h.textContent = m; });
  model.setLivery(ui.livery);
  menuAircraft();
  $('boot').classList.add('hidden');
  requestAnimationFrame(loop);

  // Test hooks (used by the automated screenshots): ?autostart=1&start=final&view=chase
  if (params.get('autostart')) {
    setTimeout(() => {
      const cfg = ui.config();
      if (params.get('start')) cfg.start = params.get('start');
      if (params.get('time')) cfg.time = params.get('time');
      startFlight(cfg);
      if (params.get('view')) setView(params.get('view'));
      if (params.get('panel')) setPanel(params.get('panel') === '1');
    }, +(params.get('delay') || 300));
  }
  window.__sim = { get ac() { return ac; }, get fm() { return fm; }, get plan() { return plan; }, sim, view, setView, command, terrain, startFlight, ui, skipToTod };
})();
