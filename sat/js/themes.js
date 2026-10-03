/* Settings store and the 15 UI styles. Each theme sets tokens in
   css/themes.css (scoped by [data-theme]); this file loads theme fonts,
   builds each theme's background decorations, and adds Material ripples. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;

  /* ------------------------------------------------------------ settings */
  const DEFAULTS = { theme: 'frutiger-aero', name: '', zoom: 1, testDict: true, dblLookup: true, motion: true, dailyGoal: 20, testDate: '', confetti: true };
  SAT.settings = {
    all: () => Object.assign({}, DEFAULTS, SAT.store.get('settings', {})),
    get: (k) => SAT.settings.all()[k],
    set(k, v) { const s = SAT.store.get('settings', {}); s[k] = v; SAT.store.set('settings', s); SAT.bus.emit('settings', { k, v }); },
  };

  const THEMES = [
    { id: 'frutiger-aero', name: 'Frutiger Aero', desc: 'Glossy glass, aqua skies, bubbles, lens flares, and green hills.', fonts: 'family=Nunito:wght@400;600;700;800', sw: ['#35b7f0', '#dff6ff', '#7ccf3c', '#ffffff'], meta: '#5ecbf5' },
    { id: 'dark-aero', name: 'Dark Aero', desc: 'Obsidian glass with specular highlights and neon accents.', fonts: 'family=Exo+2:wght@400;500;600;700', sw: ['#0b0f16', '#1c2533', '#00e5ff', '#b36bff'], meta: '#0b0f16' },
    { id: 'frutiger-eco', name: 'Frutiger Eco', desc: 'Blue skies, grassy fields, wind turbines, and solar optimism.', fonts: 'family=Nunito:wght@400;600;700;800', sw: ['#8fd3ff', '#ffffff', '#4caf50', '#ffd54f'], meta: '#8fd3ff' },
    { id: 'frutiger-aurora', name: 'Frutiger Aurora', desc: 'Glowing light ribbons, bokeh, and soft blended gradients.', fonts: 'family=Quicksand:wght@400;500;600;700', sw: ['#0d1b3e', '#3de0c4', '#9b6bff', '#ff7ac6'], meta: '#0d1b3e' },
    { id: 'frutiger-metro', name: 'Frutiger Metro', desc: 'Flat tiles, vivid solid colors, sharp grids, typography first.', fonts: 'family=Open+Sans:wght@300;400;600;700', sw: ['#111111', '#1ba1e2', '#d80073', '#8cbf26'], meta: '#111111' },
    { id: 'technozen', name: 'Technozen', desc: 'Soft whites, pastels, wide rounded corners, brushed metal, cozy console UI.', fonts: 'family=M+PLUS+Rounded+1c:wght@400;500;700;800', sw: ['#f4f6f9', '#34bfed', '#cfd6df', '#ffffff'], meta: '#f4f6f9' },
    { id: 'flat', name: 'Flat Design', desc: 'Clean 2D shapes, bold solid colors, no shadows.', fonts: 'family=Lato:wght@400;700;900', sw: ['#ecf0f1', '#3498db', '#e74c3c', '#2ecc71'], meta: '#34495e' },
    { id: 'material', name: 'Material Design', desc: 'Paper cards, elevation shadows, and ripple animations.', fonts: 'family=Roboto:wght@400;500;700', sw: ['#fafafa', '#3f51b5', '#ff4081', '#ffffff'], meta: '#3f51b5' },
    { id: 'glass', name: 'Glassmorphism', desc: 'Frosted translucent layers over vivid gradients.', fonts: 'family=Poppins:wght@400;500;600;700', sw: ['#6a5cff', '#ff6ec4', '#4fd1ff', '#ffffff'], meta: '#6a5cff' },
    { id: 'bento', name: 'Bento Box Grid', desc: 'Modular cards of varied sizes in an asymmetric grid.', fonts: 'family=Inter+Tight:wght@400;500;600;700;800', sw: ['#f2f2ef', '#ffffff', '#111111', '#ff6a3d'], meta: '#f2f2ef' },
    { id: 'skeuo', name: 'Skeuomorphism', desc: 'Leather, stitched seams, metal buttons, wood, and notebook paper.', fonts: 'family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Patrick+Hand', sw: ['#6b4a2f', '#f6efdc', '#c9ccd1', '#2f5d3a'], meta: '#5a3d26' },
    { id: 'neumorphism', name: 'Neumorphism', desc: 'Soft extruded plastic with dual shadows.', fonts: 'family=Poppins:wght@400;500;600;700', sw: ['#e0e5ec', '#6d5dfc', '#ffffff', '#a3b1c6'], meta: '#e0e5ec' },
    { id: 'claymorphism', name: 'Claymorphism', desc: 'Inflated 3D clay shapes in friendly pastels.', fonts: 'family=Fredoka:wght@400;500;600;700', sw: ['#f3e8ff', '#ffb3c7', '#b5ead7', '#c7ceea'], meta: '#f3e8ff' },
    { id: 'neubrutalism', name: 'Neubrutalism', desc: 'Thick black borders, hard offset shadows, loud primaries.', fonts: 'family=Space+Grotesk:wght@400;500;700&family=Archivo+Black', sw: ['#fff5d6', '#ffde59', '#ff5c8a', '#111111'], meta: '#ffde59' },
    { id: 'cyberpunk', name: 'Retro-Futurism / Cyberpunk', desc: 'Synthwave sunsets, neon glow, scanlines, and pixel accents.', fonts: 'family=Orbitron:wght@500;700;900&family=Exo+2:wght@400;500;600&family=Press+Start+2P', sw: ['#0d0221', '#ff2a6d', '#05d9e8', '#f9f871'], meta: '#0d0221' },
  ];

  /* -------------------------------------------------------- decorations */
  const rnd = U.rng(42);
  const bubbles = (n, cls) => Array.from({ length: n }, (_, i) => {
    const s = 12 + rnd() * 70;
    return '<span class="' + cls + '" style="--s:' + s.toFixed(0) + 'px;--x:' + (rnd() * 100).toFixed(1) + '%;--d:' + (14 + rnd() * 22).toFixed(1) + 's;--delay:-' + (rnd() * 30).toFixed(1) + 's"></span>';
  }).join('');
  const hills = (c1, c2, c3) => '<svg class="hills" viewBox="0 0 1440 320" preserveAspectRatio="none"><defs>' +
    '<linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>' +
    '<linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c3 + '"/></linearGradient></defs>' +
    '<path fill="url(#hg1)" opacity=".75" d="M0,190 C240,120 420,150 640,175 C860,200 1080,110 1440,150 L1440,320 L0,320 Z"/>' +
    '<path fill="url(#hg2)" d="M0,240 C260,190 520,230 760,220 C1000,210 1220,180 1440,215 L1440,320 L0,320 Z"/>' +
    '<path fill="#fff" opacity=".22" d="M0,240 C260,190 520,230 760,220 C1000,210 1220,180 1440,215 L1440,226 C1220,192 1000,222 760,232 C520,242 260,202 0,252 Z"/></svg>';
  const turbine = (x, s, d) => '<svg class="turbine" style="left:' + x + '%;--ts:' + s + ';--td:' + d + 's" viewBox="0 0 100 200"><rect x="47" y="60" width="6" height="140" rx="3" fill="#f5f7fa"/><rect x="47" y="60" width="2" height="140" fill="#dfe6ee"/>' +
    '<g class="blades"><path d="M50 60 L46 8 Q50 2 54 8 Z" fill="#fff"/><path d="M50 60 L46 8 Q50 2 54 8 Z" fill="#fff" transform="rotate(120 50 60)"/><path d="M50 60 L46 8 Q50 2 54 8 Z" fill="#fff" transform="rotate(240 50 60)"/></g><circle cx="50" cy="60" r="5" fill="#e8edf3" stroke="#cfd8e3"/></svg>';
  const solar = '<svg class="solar" viewBox="0 0 300 80">' + [0, 1, 2, 3].map((i) => '<g transform="translate(' + i * 72 + ',0)"><polygon points="6,20 66,20 58,62 0,62" fill="#1f4f8f" stroke="#cfe3ff" stroke-width="2"/><path d="M20,20 L14,62 M36,20 L30,62 M51,20 L45,62 M4,34 L64,34 M2,48 L61,48" stroke="#8fb9ef" stroke-width="1" opacity=".7"/><rect x="30" y="62" width="4" height="16" fill="#9aa7b4"/></g>').join('') + '</svg>';
  const cloud = (x, y, s, d) => '<div class="cloud" style="--x:' + x + '%;--y:' + y + '%;--cs:' + s + ';--cd:' + d + 's"></div>';

  const DECOR = {
    'frutiger-aero': () => '<div class="sky-flare"></div><div class="sky-flare f2"></div>' + cloud(8, 10, 1, 90) + cloud(62, 6, 1.3, 120) + bubbles(16, 'bubble') + hills('#9be15d', '#5fc03a', '#3a9b22'),
    'dark-aero': () => '<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="streak"></div>' + bubbles(10, 'bubble dark'),
    'frutiger-eco': () => '<div class="eco-sun"></div>' + cloud(5, 8, 1.2, 100) + cloud(45, 4, 0.9, 140) + cloud(75, 14, 1.1, 110) +
      '<div class="turbines">' + turbine(58, 1, 7) + turbine(70, 0.75, 5.5) + turbine(80, 0.9, 6.5) + turbine(12, 0.6, 8) + '</div>' + solar + hills('#a5e36b', '#6cc24a', '#43a047') + bubbles(8, 'leaf'),
    'frutiger-aurora': () => '<div class="ribbon r1"></div><div class="ribbon r2"></div><div class="ribbon r3"></div>' + bubbles(22, 'bokeh') + '<div class="stars"></div>',
    'frutiger-metro': () => '',
    'technozen': () => bubbles(10, 'zen-orb'),
    'flat': () => '<span class="flat-shape s1"></span><span class="flat-shape s2"></span><span class="flat-shape s3"></span><span class="flat-shape s4"></span>',
    'material': () => '<div class="mat-band"></div>',
    'glass': () => '<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div>',
    'bento': () => '<div class="dotgrid"></div>',
    'skeuo': () => '',
    'neumorphism': () => '',
    'claymorphism': () => '<span class="clay c1"></span><span class="clay c2"></span><span class="clay c3"></span><span class="clay c4"></span>',
    'neubrutalism': () => '<span class="nb-sticker st1">★</span><span class="nb-sticker st2">●</span><span class="nb-sticker st3">▲</span>',
    'cyberpunk': () => '<div class="stars"></div><div class="synth-sun"></div><div class="synth-grid"></div><div class="scanlines"></div>',
  };

  function apply(id, opts) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    document.documentElement.setAttribute('data-theme', t.id);
    document.documentElement.classList.toggle('no-motion', SAT.settings.get('motion') === false);
    const link = U.$('#theme-fonts');
    if (link && t.fonts) link.href = 'https://fonts.googleapis.com/css2?' + t.fonts + '&display=swap';
    const bg = U.$('#bg');
    if (bg) bg.innerHTML = (DECOR[t.id] || (() => ''))();
    const meta = U.$('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.meta);
    if (!opts || !opts.preview) SAT.settings.set('theme', t.id);
  }

  /* Material ripple on buttons and choices. */
  document.addEventListener('pointerdown', (e) => {
    if (document.documentElement.getAttribute('data-theme') !== 'material') return;
    const el = e.target.closest('.btn, .choice, .tile, .nav-link, #mainnav a, .rn-tool, .q-cell, .skill-card, .tab');
    if (!el) return;
    const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
    const rip = h('span.ripple', { style: { width: size + 'px', height: size + 'px', left: (e.clientX - r.left - size / 2) + 'px', top: (e.clientY - r.top - size / 2) + 'px' } });
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(rip);
    setTimeout(() => rip.remove(), 650);
  });

  SAT.themes = { list: THEMES, apply, current: () => SAT.settings.get('theme') };
})();
