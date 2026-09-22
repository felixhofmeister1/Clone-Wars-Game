/* =============================================================================
 * main.js — Core game: renderer & scenes, the Naboo courtyard, lighting,
 * player movement / collision, HUD, menus and the main loop.
 *
 * Load order (see index.html): three.min.js → utils → audio → controls →
 * weapons → enemies → main. Everything here runs after the page has loaded.
 * ========================================================================== */

(() => {
  'use strict';

  /* ======================================================================== */
  /*  1. Device detection & renderer                                          */
  /* ======================================================================== */

  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  // Phones and tablets get a lighter render path (no shadows, lower pixel ratio).
  const lowQuality = isTouchDevice;

  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowQuality, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowQuality ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false; // we render the world, then the gun on top
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !lowQuality;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // World scene + camera.
  const scene = new THREE.Scene();
  const HORIZON = 0xcfe2f0;
  scene.fog = new THREE.Fog(HORIZON, 90, 420);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // View-model scene: the rifle is rendered after clearing depth, so it never
  // clips into walls and keeps a stable FOV.
  const viewScene = new THREE.Scene();
  const viewCamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 10);
  viewScene.add(new THREE.HemisphereLight(0xe6f2ff, 0x5a5444, 1.6));
  const viewSun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  viewSun.position.set(1, 2, 1.5);
  viewScene.add(viewSun);

  /* ======================================================================== */
  /*  2. Lighting & sky                                                       */
  /* ======================================================================== */

  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x6f7d4c, lowQuality ? 1.35 : 1.05));

  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sun.position.set(55, 90, 35);
  if (!lowQuality) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -62;
    sc.right = sc.top = 62;
    sc.near = 20;
    sc.far = 260;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
  }
  scene.add(sun);

  // Gradient sky dome (unaffected by fog) with a soft sun glow.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x3b78c9) },
        horizon: { value: new THREE.Color(HORIZON) },
        bottom: { value: new THREE.Color(0xb7cfa8) },
        sunDir: { value: sun.position.clone().normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, min(1.0, -h * 4.0));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  /* ======================================================================== */
  /*  3. Naboo environment — Theed-style courtyard                            */
  /* ======================================================================== */

  const colliders = []; // THREE.Box3 list shared with player, droids and bolts

  const TEX = {
    floor: Utils.canvasTexture(Utils.makeStoneCanvas({ rows: 4, cols: 4, checker: true, base: [234, 225, 205], grout: '#c4b597' }), 18.5, 18.5),
    wall: Utils.canvasTexture(Utils.makeStoneCanvas({ rows: 6, cols: 3, offsetRows: true, base: [226, 214, 188], grout: '#a8987a' })),
    pillar: Utils.canvasTexture(Utils.makeStoneCanvas({ rows: 10, cols: 2, offsetRows: true, base: [240, 233, 216], variance: 8, grout: '#cdbfa3' }), 3, 3),
    grass: Utils.canvasTexture(Utils.makeGrassCanvas(), 140, 140),
  };
  TEX.path = TEX.floor.clone();
  TEX.path.repeat.set(1, 1);
  TEX.path.needsUpdate = true;

  const stone = (map, color = 0xffffff, rough = 0.88) =>
    new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0, bumpMap: map, bumpScale: 0.6 });
  const MAT = {
    floor: stone(TEX.floor),
    path: stone(TEX.path, 0xf4efe4),
    wall: stone(TEX.wall),
    trim: stone(TEX.wall, 0xfff8ea, 0.8),
    pillar: stone(TEX.pillar),
    dome: new THREE.MeshStandardMaterial({ color: 0x5da593, roughness: 0.45, metalness: 0.35 }), // copper patina
    gold: new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.35, metalness: 0.8 }),
    grass: new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x3f9ad6, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.85 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x3f7f35, roughness: 0.85, flatShading: true }),
    hill: new THREE.MeshStandardMaterial({ color: 0x5f944c, roughness: 1, flatShading: true }),
  };

  /** Adds a box resting on `y` (its base). Optionally registers a collider. */
  function addBox(w, h, d, x, y, z, mat, { collide = true, cast = true, texSize = 2 } = {}) {
    const m = new THREE.Mesh(Utils.worldBox(w, h, d, texSize), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = cast && !lowQuality;
    m.receiveShadow = !lowQuality;
    scene.add(m);
    if (collide) {
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, y, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h, z + d / 2),
      ));
    }
    return m;
  }

  function addMesh(geo, mat, x, y, z, { cast = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast && !lowQuality;
    m.receiveShadow = !lowQuality;
    scene.add(m);
    return m;
  }

  /** Grand fluted column with square base and capital. */
  function addPillar(x, z, height = 9, radius = 0.65, collide = true) {
    addBox(radius * 2.8, 0.6, radius * 2.8, x, 0, z, MAT.trim, { collide });
    addMesh(new THREE.CylinderGeometry(radius * 1.25, radius * 1.35, 0.35, 20), MAT.trim, x, 0.77, z);
    addMesh(new THREE.CylinderGeometry(radius, radius * 1.08, height - 1.1, 20), MAT.pillar, x, 0.6 + (height - 1.1) / 2, z);
    addMesh(new THREE.CylinderGeometry(radius * 1.35, radius, 0.35, 20), MAT.trim, x, height - 0.68, z);
    addBox(radius * 2.9, 0.5, radius * 2.9, x, height - 0.5, z, MAT.trim, { collide: false });
    if (collide) {
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - radius, 0, z - radius),
        new THREE.Vector3(x + radius, height, z + radius),
      ));
    }
  }

  /** Waist-high defensive stone barricade — the cover you'll fight from. */
  function addBarrier(x, z, alongX, len = 4) {
    const w = alongX ? len : 0.9, d = alongX ? 0.9 : len;
    addBox(w, 1.2, d, x, 0, z, MAT.wall, { collide: false });
    addBox(alongX ? len + 0.2 : 1.15, 0.18, alongX ? 1.15 : len + 0.2, x, 1.2, z, MAT.trim, { collide: false });
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2 - 0.1, 0, z - d / 2 - 0.1),
      new THREE.Vector3(x + w / 2 + 0.1, 1.38, z + d / 2 + 0.1),
    ));
  }

  /** Stone planter with a rounded Naboo tree. */
  function addPlanter(x, z) {
    addBox(3, 0.8, 3, x, 0, z, MAT.trim);
    addMesh(new THREE.CylinderGeometry(0.16, 0.24, 3.4, 8), MAT.trunk, x, 2.4, z);
    const crown = addMesh(new THREE.IcosahedronGeometry(1.8, 1), MAT.leaves, x, 4.6, z);
    crown.scale.set(1, 0.8, 1);
    const crown2 = addMesh(new THREE.IcosahedronGeometry(1.2, 1), MAT.leaves, x + 0.6, 5.5, z - 0.4);
    crown2.scale.set(1, 0.85, 1);
  }

  /** Royal Naboo banner (purple & gold) hanging from a colonnade beam. */
  const bannerTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 384;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 384);
    grad.addColorStop(0, '#3d1f6e'); grad.addColorStop(1, '#241246');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 384);
    g.fillStyle = '#d9b45a';
    g.fillRect(0, 0, 128, 14); g.fillRect(8, 20, 6, 330); g.fillRect(114, 20, 6, 330);
    // Swallow-tail bottom.
    g.fillStyle = '#d9b45a';
    g.beginPath(); g.moveTo(0, 350); g.lineTo(64, 384); g.lineTo(128, 350); g.lineTo(128, 340); g.lineTo(64, 372); g.lineTo(0, 340); g.fill();
    g.clearRect(0, 352, 128, 32);
    g.fillStyle = '#241246';
    g.beginPath(); g.moveTo(0, 340); g.lineTo(64, 372); g.lineTo(128, 340); g.lineTo(128, 330); g.lineTo(0, 330); g.fill();
    // Emblem: ring + stylised sun of the Naboo royal house.
    g.strokeStyle = '#e8c56a'; g.lineWidth = 6;
    g.beginPath(); g.arc(64, 120, 34, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(64, 120, 14, 0, Math.PI * 2); g.fillStyle = '#e8c56a'; g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillRect(64 + Math.cos(a) * 44 - 3, 120 + Math.sin(a) * 44 - 3, 6, 6);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 0.9, transparent: true, alphaTest: 0.5 });
  function addBanner(x, z, rotY) {
    const m = addMesh(new THREE.PlaneGeometry(1.7, 5.1), bannerMat, x, 6.45, z, { cast: false });
    m.rotation.y = rotY;
  }

  /** Domed rotunda — the signature Theed skyline element. */
  function addRotunda(x, z, radius, height, collide = false) {
    addMesh(new THREE.CylinderGeometry(radius, radius * 1.03, height, 32), MAT.wall, x, height / 2, z);
    addMesh(new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, 0.8, 32), MAT.trim, x, height + 0.4, z);
    const dome = addMesh(new THREE.SphereGeometry(radius * 1.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), MAT.dome, x, height + 0.8, z);
    dome.scale.y = 0.85;
    addMesh(new THREE.CylinderGeometry(radius * 0.12, radius * 0.14, radius * 0.4, 12), MAT.trim, x, height + 0.8 + radius * 0.95, z);
    addMesh(new THREE.SphereGeometry(radius * 0.14, 12, 8), MAT.gold, x, height + 0.8 + radius * 1.2, z);
    if (collide) {
      colliders.push(new THREE.Box3(new THREE.Vector3(x - radius, 0, z - radius), new THREE.Vector3(x + radius, height, z + radius)));
    }
  }

  function buildNaboo() {
    // --- Ground ------------------------------------------------------------
    // Grass sits well below the paving: coplanar-ish surfaces z-fight on
    // mobile GPUs with low-precision depth buffers.
    const grass = addMesh(new THREE.PlaneGeometry(1200, 1200), MAT.grass, 0, -0.25, 0, { cast: false });
    grass.rotation.x = -Math.PI / 2;
    const floor = addMesh(new THREE.PlaneGeometry(74, 74), MAT.floor, 0, 0, 0, { cast: false });
    floor.rotation.x = -Math.PI / 2;
    // Paved avenues (raised stone slabs) leading out of each gate.
    for (const [x, z, alongZ] of [[0, -54.6, true], [0, 54.6, true], [-54.6, 0, false], [54.6, 0, false]]) {
      // World-scaled UVs (4 m per texture = 1 m tiles, matching the courtyard).
      const slab = new THREE.Mesh(Utils.worldBox(alongZ ? 9 : 34, 0.25, alongZ ? 34 : 9, 4), MAT.path);
      slab.position.set(x, -0.125, z);
      slab.receiveShadow = !lowQuality;
      scene.add(slab);
    }

    // --- Perimeter wall with four grand gates -------------------------------
    const H = 3.4, T = 1.2, E = 36, G = 4.2; // height, thickness, edge, half gate width
    const seg = E + T / 2 - G;          // length of each wall segment
    const mid = G + seg / 2;            // centre offset of each segment
    for (const s of [-1, 1]) {
      addBox(seg, H, T, -mid, 0, s * E, MAT.wall);
      addBox(seg, H, T, mid, 0, s * E, MAT.wall);
      addBox(T, H, seg, s * E, 0, -mid, MAT.wall);
      addBox(T, H, seg, s * E, 0, mid, MAT.wall);
      // Coping along the top.
      addBox(seg, 0.3, T + 0.3, -mid, H, s * E, MAT.trim, { collide: false });
      addBox(seg, 0.3, T + 0.3, mid, H, s * E, MAT.trim, { collide: false });
      addBox(T + 0.3, 0.3, seg, s * E, H, -mid, MAT.trim, { collide: false });
      addBox(T + 0.3, 0.3, seg, s * E, H, mid, MAT.trim, { collide: false });
    }
    // Gatehouses: twin towers + lintel, topped with small domes.
    const gates = [];
    for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const alongX = dx === 0;
      for (const s of [-1, 1]) {
        const tx = alongX ? s * (G + 1.2) : dx * E;
        const tz = alongX ? dz * E : s * (G + 1.2);
        addBox(2.4, 7.5, 2.4, tx, 0, tz, MAT.wall);
        addBox(2.8, 0.4, 2.8, tx, 7.5, tz, MAT.trim, { collide: false });
        const d = addMesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.dome, tx, 7.9, tz);
        d.scale.y = 1.1;
      }
      addBox(alongX ? G * 2 + 4.8 : 2.4, 1.3, alongX ? 2.4 : G * 2 + 4.8, dx * E, 6.2, dz * E, MAT.trim);
      gates.push({
        spawn: new THREE.Vector3(dx * 58, 0, dz * 58),
        gate: new THREE.Vector3(dx * E, 0, dz * E),
        dir: new THREE.Vector3(-dx, 0, -dz), // direction droids march in
      });
    }

    // --- Colonnade ring of grand pillars carrying stone beams ---------------
    const ring = 24;
    const spots = [-24, -16, -8, 8, 16, 24];
    for (const a of spots) {
      addPillar(a, -ring); addPillar(a, ring);
      if (Math.abs(a) !== ring) { addPillar(-ring, a); addPillar(ring, a); }
    }
    for (const s of [-1, 1]) {
      addBox(50, 1.0, 2.0, 0, 9, s * ring, MAT.trim, { collide: false });
      addBox(2.0, 1.0, 50, s * ring, 9, 0, MAT.trim, { collide: false });
      addBox(51, 0.35, 2.4, 0, 10, s * ring, MAT.wall, { collide: false });
      addBox(2.4, 0.35, 51, s * ring, 10, 0, MAT.wall, { collide: false });
      for (const b of [-20, -12, 12, 20]) {
        addBanner(b, s * ring, 0);
        addBanner(s * ring, b, Math.PI / 2);
      }
    }

    // --- Central fountain ----------------------------------------------------
    addMesh(new THREE.CylinderGeometry(4, 4.2, 0.7, 32), MAT.trim, 0, 0.35, 0);
    const water = addMesh(new THREE.CircleGeometry(3.65, 32), MAT.water, 0, 0.62, 0, { cast: false });
    water.rotation.x = -Math.PI / 2;
    addMesh(new THREE.CylinderGeometry(0.7, 1.0, 2.8, 16), MAT.pillar, 0, 1.4, 0);
    addMesh(new THREE.CylinderGeometry(1.7, 0.6, 0.5, 20), MAT.trim, 0, 3.0, 0);
    addMesh(new THREE.SphereGeometry(0.45, 16, 12), MAT.gold, 0, 3.6, 0);
    colliders.push(new THREE.Box3(new THREE.Vector3(-3.3, 0, -3.3), new THREE.Vector3(3.3, 0.7, 3.3)));
    colliders.push(new THREE.Box3(new THREE.Vector3(-0.9, 0, -0.9), new THREE.Vector3(0.9, 3.8, 0.9)));

    // --- Defensive barriers & cover -----------------------------------------
    for (const [x, z, ax, len] of [
      [-10, -12, true, 4], [10, -12, true, 4], [-10, 12, true, 4], [10, 12, true, 4],
      [-15, 0, false, 4], [15, 0, false, 4], [0, -18, true, 3], [0, 18, true, 3],
      [-30, -12, false, 4], [30, 12, false, 4], [-12, 30, true, 4], [12, -30, true, 4],
      [-30, 14, false, 4], [30, -14, false, 4], [14, 30, true, 4], [-14, -30, true, 4],
    ]) addBarrier(x, z, ax, len);
    // Stacked stone blocks.
    for (const [x, z] of [[20, -5], [-20, 5], [5, 28], [-5, -28]]) {
      addBox(1.2, 1.2, 1.2, x, 0, z, MAT.wall);
      addBox(1.2, 1.2, 1.2, x + 1.25, 0, z + 0.2, MAT.wall);
      addBox(1.1, 1.1, 1.1, x + 0.6, 1.2, z + 0.1, MAT.wall);
    }
    for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) addPlanter(x, z);

    // --- Theed skyline beyond the walls (decorative) ------------------------
    // Royal palace to the north.
    addBox(64, 16, 18, 0, 0, -84, MAT.wall, { collide: false, texSize: 3 });
    addBox(66, 1.2, 20, 0, 16, -84, MAT.trim, { collide: false });
    for (let i = -5; i <= 5; i++) if (i !== 0) addPillar(i * 5.6, -73.5, 14, 0.8, false);
    addBox(64, 1.4, 3, 0, 14, -73.5, MAT.trim, { collide: false });
    addRotunda(0, -84, 11, 24);
    addRotunda(-26, -90, 5, 22);
    addRotunda(26, -90, 5, 22);
    // East & west districts.
    for (const s of [-1, 1]) {
      addBox(20, 12, 40, s * 82, 0, 0, MAT.wall, { collide: false, texSize: 3 });
      addRotunda(s * 80, -28, 6, 20);
      addRotunda(s * 80, 28, 6, 20);
      addRotunda(s * 96, 0, 8, 28);
      addBox(14, 9, 14, s * 70, 0, -62, MAT.wall, { collide: false, texSize: 3 });
      addRotunda(s * 70, -62, 4, 12);
    }
    // South terraces.
    for (const [x, z, r, h] of [[-30, 82, 7, 16], [30, 82, 7, 16], [0, 100, 9, 22]]) {
      addBox(r * 2.6, h * 0.6, r * 2.6, x, 0, z, MAT.wall, { collide: false, texSize: 3 });
      addRotunda(x, z, r, h);
    }

    // Rolling green hills on the horizon.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Utils.rand(-0.1, 0.1);
      const d = Utils.rand(230, 320);
      const hill = addMesh(new THREE.IcosahedronGeometry(1, 2), MAT.hill, Math.cos(a) * d, -5, Math.sin(a) * d, { cast: false });
      hill.scale.set(Utils.rand(60, 110), Utils.rand(25, 55), Utils.rand(60, 110));
    }

    return { gates, water };
  }

  const env = buildNaboo();

  /* ======================================================================== */
  /*  4. HUD                                                                  */
  /* ======================================================================== */

  const $ = (id) => document.getElementById(id);
  const hud = {
    el: {
      root: $('hud'), healthFill: $('health-fill'), healthValue: $('health-value'), healthPanel: $('health-panel'),
      ammo: $('ammo-count'), mag: $('ammo-mag'), reserve: $('ammo-reserve'), ammoPanel: $('ammo-panel'),
      reload: $('reload-indicator'), reloadFill: $('reload-fill'),
      score: $('score-value'), wave: $('wave-value'), droids: $('droids-left'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), damage: $('damage-flash'),
      dmgIndicator: $('damage-indicator'), msg: $('message'), msgTitle: $('message-title'), msgSub: $('message-sub'),
      popups: $('score-popups'), radar: $('radar'), lowHealth: $('low-health'),
    },
    spread: 0,
    msgT: 0,
    hitT: 0,
    dmgT: 0,
    radarT: 0,

    show(on) { this.el.root.classList.toggle('hidden', !on); },

    setHealth(h) {
      const pct = Utils.clamp(h, 0, 100);
      this.el.healthFill.style.width = `${pct}%`;
      this.el.healthValue.textContent = Math.ceil(pct);
      this.el.healthPanel.classList.toggle('critical', pct <= 30);
      this.el.lowHealth.classList.toggle('active', pct <= 30);
    },

    setAmmo(ammo, mag, reserve, reloading) {
      this.el.ammo.textContent = String(ammo).padStart(2, '0');
      this.el.mag.textContent = `/${mag}`;
      this.el.reserve.textContent = reserve;
      this.el.ammoPanel.classList.toggle('low', ammo <= mag * 0.25);
      this.el.reload.classList.toggle('active', reloading);
      if (!reloading) this.el.reloadFill.style.width = '0%';
    },

    setReloadProgress(p) { this.el.reloadFill.style.width = `${Utils.clamp(p, 0, 1) * 100}%`; },
    setScore(s) { this.el.score.textContent = String(s).padStart(6, '0'); },
    setWave(w, remaining) {
      this.el.wave.textContent = w;
      this.el.droids.textContent = remaining;
    },

    message(title, sub = '', dur = 2.5) {
      this.el.msgTitle.textContent = title;
      this.el.msgSub.textContent = sub;
      this.el.msg.classList.add('visible');
      this.msgT = dur;
    },

    hitmarker(kill) {
      const h = this.el.hitmarker;
      h.classList.remove('active', 'kill');
      void h.offsetWidth; // restart the CSS animation
      h.classList.add('active');
      if (kill) h.classList.add('kill');
    },

    crosshairKick() { this.spread = Math.min(this.spread + 6, 18); },

    /** Red flash + a directional arc pointing at where the shot came from. */
    damage(relAngle) {
      this.el.damage.classList.remove('active');
      void this.el.damage.offsetWidth;
      this.el.damage.classList.add('active');
      this.el.dmgIndicator.style.transform = `translate(-50%, -50%) rotate(${relAngle}rad)`;
      this.el.dmgIndicator.classList.add('active');
      this.dmgT = 0.9;
    },

    scorePopup(text, cls = '') {
      const d = document.createElement('div');
      d.className = `score-popup ${cls}`;
      d.textContent = text;
      this.el.popups.appendChild(d);
      setTimeout(() => d.remove(), 1100);
    },

    update(dt, moveFactor) {
      // Crosshair gap blooms when firing / moving and settles back.
      this.spread = Math.max(0, this.spread - dt * 40);
      this.el.crosshair.style.setProperty('--gap', `${10 + this.spread + moveFactor * 8}px`);
      if (this.msgT > 0) {
        this.msgT -= dt;
        if (this.msgT <= 0) this.el.msg.classList.remove('visible');
      }
      if (this.dmgT > 0) {
        this.dmgT -= dt;
        if (this.dmgT <= 0) this.el.dmgIndicator.classList.remove('active');
      }
    },

    /** Helmet-style motion tracker: droids as red blips relative to facing. */
    drawRadar(dt, player, droids) {
      this.radarT -= dt;
      if (this.radarT > 0) return;
      this.radarT = 1 / 20; // 20 Hz is plenty
      const c = this.el.radar;
      const g = c.getContext('2d');
      const S = c.width, R = S / 2, range = 45;
      g.clearRect(0, 0, S, S);
      g.strokeStyle = 'rgba(127,216,255,0.35)';
      g.lineWidth = 1;
      for (const k of [0.33, 0.66, 0.98]) { g.beginPath(); g.arc(R, R, R * k, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.moveTo(R, 4); g.lineTo(R, S - 4); g.moveTo(4, R); g.lineTo(S - 4, R); g.stroke();
      // Rotating sweep.
      const sweep = (performance.now() / 1000) * 2.2;
      const grad = g.createRadialGradient(R, R, 0, R, R, R);
      grad.addColorStop(0, 'rgba(127,216,255,0.25)'); grad.addColorStop(1, 'rgba(127,216,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(R, R); g.arc(R, R, R, sweep, sweep + 0.5); g.closePath(); g.fill();

      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      for (const d of droids) {
        const dx = d.pos.x - player.pos.x, dz = d.pos.z - player.pos.z;
        const lx = dx * cy - dz * sy;       // right
        const lf = -dx * sy - dz * cy;      // forward
        let px = lx / range, py = lf / range;
        const len = Math.hypot(px, py);
        if (len > 0.95) { px *= 0.95 / len; py *= 0.95 / len; }
        g.fillStyle = d.commander ? '#ffcc33' : '#ff4b3a';
        g.beginPath(); g.arc(R + px * R, R - py * R, d.commander ? 3.5 : 2.6, 0, Math.PI * 2); g.fill();
      }
      // Player chevron.
      g.fillStyle = '#e8fbff';
      g.beginPath(); g.moveTo(R, R - 6); g.lineTo(R - 4, R + 4); g.lineTo(R + 4, R + 4); g.closePath(); g.fill();
    },
  };

  /* ======================================================================== */
  /*  5. Player                                                               */
  /* ======================================================================== */

  const SPAWN = new THREE.Vector3(0, 0, 16);
  const player = {
    pos: SPAWN.clone(),           // feet position
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    radius: 0.4,
    height: 1.8,
    eye: 1.65,
    grounded: true,
    health: 100,
    moveFactor: 0,                // 0 = still, 1 = sprinting (drives bob & spread)
    right: new THREE.Vector3(1, 0, 0),
    bobT: 0,
    shake: 0,
    addRecoil(amount) {
      this.pitch = Math.min(1.4, this.pitch + amount);
      this.yaw += Utils.rand(-amount, amount) * 0.4;
    },
  };

  const WORLD_LIMIT = 68;

  function updatePlayer(dt) {
    const look = input.consumeLook();
    player.yaw -= look.dx;
    player.pitch = Utils.clamp(player.pitch - look.dy, -1.4, 1.4);

    // Camera-relative movement basis (yaw 0 = looking toward -Z / north).
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    player.right.set(cy, 0, -sy);
    let wx = cy * input.move.x - sy * input.move.y;
    let wz = -sy * input.move.x - cy * input.move.y;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }

    const speed = input.sprint ? 8.5 : 5.2;
    const accel = player.grounded ? 14 : 3;
    const k = Utils.damp(accel, dt);
    player.vel.x = Utils.lerp(player.vel.x, wx * speed, k);
    player.vel.z = Utils.lerp(player.vel.z, wz * speed, k);

    if (input.consumePress('jump') && player.grounded) {
      player.vel.y = 6.6;
      player.grounded = false;
    }
    player.vel.y -= 20 * dt;

    // Horizontal move + collision against stone.
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;
    Utils.resolveCircleCollisions(player.pos, player.radius, player.height, colliders);
    player.pos.x = Utils.clamp(player.pos.x, -WORLD_LIMIT, WORLD_LIMIT);
    player.pos.z = Utils.clamp(player.pos.z, -WORLD_LIMIT, WORLD_LIMIT);

    // Vertical move: land on the ground or on top of low cover.
    player.pos.y += player.vel.y * dt;
    const floorY = Utils.supportHeight(player.pos, player.radius, colliders);
    if (player.pos.y <= floorY) {
      player.pos.y = floorY;
      player.vel.y = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }

    // Head bob, hit shake and final camera transform.
    player.moveFactor = Utils.clamp(Math.hypot(player.vel.x, player.vel.z) / 8.5, 0, 1);
    if (player.grounded) player.bobT += dt * (7 + player.moveFactor * 6) * (player.moveFactor > 0.05 ? 1 : 0);
    const bob = Math.sin(player.bobT) * 0.045 * player.moveFactor;
    player.shake = Math.max(0, player.shake - dt);
    const sh = player.shake * 0.12;
    camera.position.set(
      player.pos.x + Utils.rand(-sh, sh),
      player.pos.y + player.eye + bob + Utils.rand(-sh, sh),
      player.pos.z,
    );
    camera.rotation.set(player.pitch, player.yaw, 0);
    return look;
  }

  /* ======================================================================== */
  /*  6. Shared world context + game systems                                  */
  /* ======================================================================== */

  const input = new InputController(canvas);

  const world = {
    scene, camera, colliders, lowQuality, player, hud,
    effects: null, bolts: null, enemies: null, rifle: null,
    score: 0,

    /** Earliest hit time (0..1) of segment p0->p1 against level + ground. */
    raycastStatic(p0, p1) {
      let best = null;
      for (let i = 0; i < colliders.length; i++) {
        const t = Utils.segmentAABB(p0, p1, colliders[i]);
        if (t !== null && (best === null || t < best)) best = t;
      }
      if (p1.y < 0 && p0.y >= 0) {
        const t = p0.y / (p0.y - p1.y);
        if (best === null || t < best) best = t;
      }
      return best;
    },

    /** Distance along a ray to the first thing the crosshair is on. */
    aimDistance(origin, dir, maxDist) {
      const end = origin.clone().addScaledVector(dir, maxDist);
      let t = this.raycastStatic(origin, end);
      const hit = this.enemies.raycast(origin, end);
      if (hit && (t === null || hit.t < t)) t = hit.t;
      return t === null ? maxDist : t * maxDist;
    },

    /** Segment test against the player's head + body spheres. */
    raycastPlayer(p0, p1) {
      if (state !== 'playing') return null;
      const eye = camera.position;
      const head = Utils.segmentSphere(p0, p1, eye, 0.3);
      const body = Utils.segmentSphere(p0, p1, { x: eye.x, y: eye.y - 0.65, z: eye.z }, 0.42);
      const legs = Utils.segmentSphere(p0, p1, { x: eye.x, y: player.pos.y + 0.5, z: eye.z }, 0.35);
      const ts = [head, body, legs].filter((t) => t !== null);
      return ts.length ? Math.min(...ts) : null;
    },

    onPlayerHit(damage, fromPos) {
      if (state !== 'playing') return;
      player.health -= damage;
      player.shake = 0.25;
      hud.setHealth(player.health);
      const worldAngle = Math.atan2(fromPos.x - player.pos.x, fromPos.z - player.pos.z);
      hud.damage(player.yaw + Math.PI - worldAngle);
      GameAudio.playerHurt();
      if (player.health <= 0) gameOver();
    },

    onWaveCleared(wave) {
      const bonus = wave * 250;
      this.addScore(bonus, 'WAVE BONUS');
      player.health = Math.min(100, player.health + 25);
      hud.setHealth(player.health);
      this.rifle.resupply(60);
      hud.message('WAVE CLEARED', `+${bonus} bonus · +25 health · +60 cells`, 3.5);
    },

    addScore(points, label = '') {
      this.score += points;
      hud.setScore(this.score);
      hud.scorePopup(`+${points}${label ? ' ' + label : ''}`, label ? 'bonus' : '');
    },
  };

  world.effects = new EffectsSystem(scene);
  world.bolts = new BoltSystem(world);
  world.enemies = new DroidManager(world, env.gates);
  world.rifle = new DC15ARifle(world, viewScene);

  /* ======================================================================== */
  /*  7. Game state, menus & control-mode switching                           */
  /* ======================================================================== */

  let state = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'
  let controlMode = isTouchDevice ? 'mobile' : 'pc';

  const screens = { start: $('start-screen'), pause: $('pause-screen'), over: $('gameover-screen') };
  function showScreen(name) {
    for (const key in screens) screens[key].classList.toggle('hidden', key !== name);
  }

  function readHighScore() {
    try { return parseInt(localStorage.getItem('cw-naboo-highscore') || '0', 10) || 0; } catch (e) { return 0; }
  }
  function writeHighScore(v) {
    try { localStorage.setItem('cw-naboo-highscore', String(v)); } catch (e) { /* storage unavailable */ }
  }

  /** Applies the chosen control scheme to input handling, UI and layout. */
  function applyControlMode(mode) {
    controlMode = mode;
    input.setMode(mode);
    document.body.classList.toggle('mode-mobile', mode === 'mobile');
    document.body.classList.toggle('mode-pc', mode === 'pc');
    for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('selected', b.dataset.mode === mode);
    $('touch-controls').classList.toggle('hidden', mode !== 'mobile' || state !== 'playing');
    $('pause-mode-label').textContent = mode === 'mobile' ? 'PC (mouse & keyboard)' : 'Mobile (touch)';
    if (mode === 'mobile') input.exitPointerLock();
  }

  function resetGame() {
    player.pos.copy(SPAWN);
    player.vel.set(0, 0, 0);
    player.yaw = 0;
    player.pitch = 0;
    player.health = 100;
    player.shake = 0;
    world.score = 0;
    world.bolts.clear();
    world.enemies.reset();
    world.rifle.reset();
    hud.setHealth(100);
    hud.setScore(0);
    hud.setWave(0, 0);
    hud.message('BATTLE OF NABOO', 'Hold the courtyard, trooper!', 2.5);
  }

  /** Mobile: go fullscreen & lock landscape where the browser allows it. */
  function enterMobileFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !document.fullscreenElement) {
      try {
        const p = req.call(el, { navigationUI: 'hide' });
        if (p && p.then) {
          p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
            .catch(() => {});
        }
      } catch (e) { /* not supported (e.g. iPhone Safari) */ }
    }
  }

  function beginPlaying() {
    state = 'playing';
    showScreen(null);
    hud.show(true);
    input.reset();
    input.enabled = true;
    applyControlMode(controlMode);
    if (controlMode === 'pc') input.requestPointerLock();
    else enterMobileFullscreen();
    clock.getDelta(); // swallow the time spent in menus
  }

  function startGame() {
    GameAudio.init();
    resetGame();
    beginPlaying();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    input.enabled = false;
    input.reset();
    GameAudio.silence();
    $('touch-controls').classList.add('hidden');
    $('pause-hint').textContent = controlMode === 'pc' ? 'Click RESUME to re-engage mouse look' : 'Tap RESUME to continue';
    showScreen('pause');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    GameAudio.init();
    beginPlaying();
  }

  function gameOver() {
    state = 'gameover';
    input.enabled = false;
    input.reset();
    input.exitPointerLock();
    GameAudio.silence();
    $('touch-controls').classList.add('hidden');
    const best = Math.max(readHighScore(), world.score);
    writeHighScore(best);
    $('final-score').textContent = world.score;
    $('final-wave').textContent = world.enemies.wave;
    $('final-best').textContent = best;
    showScreen('over');
  }

  // PC: losing pointer lock (Esc) pauses the game.
  input.onPointerLockChange = (locked) => {
    if (!locked && state === 'playing' && controlMode === 'pc' && !input.pointerLockFailed) pauseGame();
  };

  // Menu wiring -------------------------------------------------------------
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.addEventListener('click', () => applyControlMode(b.dataset.mode));
  }
  $('btn-start').addEventListener('click', startGame);
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-restart').addEventListener('click', () => { resetGame(); beginPlaying(); });
  $('btn-retry').addEventListener('click', () => { GameAudio.init(); resetGame(); beginPlaying(); });
  $('btn-menu').addEventListener('click', () => { state = 'menu'; showScreen('start'); hud.show(false); });
  $('btn-switch-mode').addEventListener('click', () => applyControlMode(controlMode === 'pc' ? 'mobile' : 'pc'));
  $('sensitivity').addEventListener('input', (e) => { input.sensitivity = parseFloat(e.target.value); });
  $('voice-toggle').addEventListener('change', (e) => GameAudio.setVoiceEnabled(e.target.checked));
  $('best-score').textContent = readHighScore();

  // Pause when the tab / app goes to the background (important on phones).
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  applyControlMode(controlMode);
  showScreen('start');

  /* ======================================================================== */
  /*  8. Resize handling                                                      */
  /* ======================================================================== */

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    renderer.setSize(w, h);
    // Widen the vertical FOV in portrait so the horizontal view stays usable.
    camera.fov = aspect < 1 ? 95 : 75;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    viewCamera.fov = aspect < 1 ? 85 : 65;
    viewCamera.aspect = aspect;
    viewCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  onResize();

  /* ======================================================================== */
  /*  9. Main loop                                                            */
  /* ======================================================================== */

  const clock = new THREE.Clock();
  let menuT = 0;
  const NO_LOOK = { dx: 0, dy: 0 };

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (state === 'playing') {
      input.update();
      if (input.consumePress('pause')) pauseGame();
      const look = updatePlayer(dt);
      world.rifle.update(dt, input, player, look);
      world.enemies.update(dt);
      world.bolts.update(dt);
      hud.drawRadar(dt, player, world.enemies.droids);
    } else if (state === 'menu') {
      // Attract mode: slow fly-around of the courtyard behind the title screen.
      menuT += dt * 0.06;
      camera.position.set(Math.sin(menuT) * 30, 9, Math.cos(menuT) * 30);
      camera.lookAt(0, 3, 0);
    } else {
      world.rifle.update(0, { consumePress: () => false, firing: false }, player, NO_LOOK);
    }

    world.effects.update(dt);
    hud.update(dt, player.moveFactor);
    env.water.material.opacity = 0.8 + Math.sin(performance.now() * 0.002) * 0.05;

    renderer.clear();
    renderer.render(scene, camera);
    if (state !== 'menu') {
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
    }
  }
  frame();

  // Handy for debugging from the console.
  window.__game = { world, player, input, get state() { return state; } };
})();
