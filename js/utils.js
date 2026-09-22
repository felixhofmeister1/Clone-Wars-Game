/* =============================================================================
 * utils.js — Shared math, collision and procedural-texture helpers.
 *
 * Loaded before every other game script so weapons.js, enemies.js and main.js
 * can all rely on the global `Utils` object.
 * ========================================================================== */

const Utils = {
  /* ---------------------------------------------------------------- math -- */
  clamp: (v, min, max) => (v < min ? min : v > max ? max : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (min, max) => min + Math.random() * (max - min),
  randInt: (min, max) => Math.floor(min + Math.random() * (max - min + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],

  /** Frame-rate independent exponential smoothing factor. */
  damp: (lambda, dt) => 1 - Math.exp(-lambda * dt),

  /** Shortest signed difference between two angles (radians). */
  angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  /* ----------------------------------------------------------- collision -- */

  /**
   * Segment (p0 -> p1) vs axis-aligned box (THREE.Box3) using the slab method.
   * @returns {number|null} normalised hit time in [0,1], or null for a miss.
   */
  segmentAABB(p0, p1, box) {
    let tmin = 0;
    let tmax = 1;
    for (let i = 0; i < 3; i++) {
      const axis = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
      const o = p0[axis];
      const d = p1[axis] - o;
      const bmin = box.min[axis];
      const bmax = box.max[axis];
      if (Math.abs(d) < 1e-9) {
        if (o < bmin || o > bmax) return null; // parallel & outside the slab
      } else {
        let t1 = (bmin - o) / d;
        let t2 = (bmax - o) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  },

  /**
   * Segment (p0 -> p1) vs sphere.
   * @returns {number|null} normalised hit time in [0,1], or null for a miss.
   */
  segmentSphere(p0, p1, c, r) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const fx = p0.x - c.x, fy = p0.y - c.y, fz = p0.z - c.z;
    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * (fx * dx + fy * dy + fz * dz);
    const cc = fx * fx + fy * fy + fz * fz - r * r;
    if (cc <= 0) return 0; // segment starts inside the sphere
    if (a < 1e-12) return null;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  },

  /**
   * Pushes a vertical cylinder (circle in XZ, from feetY to feetY+height) out
   * of every collider box it overlaps. Boxes low enough to step onto are ignored
   * so the caller can treat them as floors instead.
   * @param {THREE.Vector3} pos   feet position (mutated in place)
   */
  resolveCircleCollisions(pos, radius, height, colliders, stepHeight = 0.35) {
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        if (b.max.y <= pos.y + stepHeight || b.min.y >= pos.y + height) continue;
        const nx = Utils.clamp(pos.x, b.min.x, b.max.x);
        const nz = Utils.clamp(pos.z, b.min.z, b.max.z);
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          // Circle centre is outside the box: push along the contact normal.
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          // Centre is inside the box: exit along the axis of least penetration.
          const left = pos.x - b.min.x, right = b.max.x - pos.x;
          const back = pos.z - b.min.z, front = b.max.z - pos.z;
          const m = Math.min(left, right, back, front);
          if (m === left) pos.x = b.min.x - radius;
          else if (m === right) pos.x = b.max.x + radius;
          else if (m === back) pos.z = b.min.z - radius;
          else pos.z = b.max.z + radius;
        }
      }
    }
  },

  /**
   * Highest walkable surface under a circle: the ground (0) or the top of any
   * box whose top is at most `stepHeight` above the current feet position.
   */
  supportHeight(pos, radius, colliders, stepHeight = 0.35) {
    let floor = 0;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.max.y > pos.y + stepHeight || b.max.y <= floor) continue;
      const nx = Utils.clamp(pos.x, b.min.x, b.max.x);
      const nz = Utils.clamp(pos.z, b.min.z, b.max.z);
      const dx = pos.x - nx, dz = pos.z - nz;
      if (dx * dx + dz * dz < radius * radius * 0.5) floor = b.max.y;
    }
    return floor;
  },

  /* ------------------------------------------------- procedural textures -- */

  /** Wraps a canvas in a repeating, sRGB, mip-mapped THREE texture. */
  canvasTexture(canvas, repeatX = 1, repeatY = 1) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  },

  /**
   * Paints pale Naboo sandstone: a grid of blocks with per-block tone variation,
   * mortar lines, speckles and weathering.
   */
  makeStoneCanvas({
    size = 512, rows = 4, cols = 4, offsetRows = false,
    base = [232, 222, 200], variance = 14, grout = '#b9ab8f', checker = false,
  } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = grout;
    g.fillRect(0, 0, size, size);

    const bw = size / cols;
    const bh = size / rows;
    const gap = Math.max(2, size / 170);
    for (let r = 0; r < rows; r++) {
      const shift = offsetRows && r % 2 ? bw / 2 : 0;
      for (let col = -1; col < cols; col++) {
        const x = col * bw + shift;
        let tone = (Math.random() - 0.5) * variance;
        if (checker && (r + col) % 2 === 0) tone += 10;
        const [cr, cg, cb] = base.map((v) => Utils.clamp(Math.round(v + tone), 0, 255));
        // Block face with a gentle top-lit gradient.
        const grad = g.createLinearGradient(0, r * bh, 0, (r + 1) * bh);
        grad.addColorStop(0, `rgb(${cr + 6},${cg + 6},${cb + 6})`);
        grad.addColorStop(1, `rgb(${cr - 8},${cg - 8},${cb - 8})`);
        g.fillStyle = grad;
        g.fillRect(x + gap, r * bh + gap, bw - gap * 2, bh - gap * 2);
      }
    }

    // Speckles & pits.
    for (let i = 0; i < size * size / 45; i++) {
      const v = Math.random() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.07})`;
      g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // Soft weathering blotches.
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * size, y = Math.random() * size, rad = size * Utils.rand(0.04, 0.12);
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(120,105,80,0.10)');
      grad.addColorStop(1, 'rgba(120,105,80,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return c;
  },

  /** Rich green Naboo grass with blade-like noise. */
  makeGrassCanvas(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#4f8a3c';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 5000; i++) {
      const l = Utils.randInt(-25, 25);
      g.fillStyle = `rgba(${70 + l},${130 + l},${55 + l},0.5)`;
      g.fillRect(Math.random() * size, Math.random() * size, 1, 2 + Math.random() * 3);
    }
    return c;
  },

  /** Radial glow used for flashes, sparks and muzzle bursts. */
  makeGlowCanvas(inner = 'rgba(255,255,255,1)', outer = 'rgba(80,160,255,0)', size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.8)'));
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  },

  /**
   * BoxGeometry whose UVs are scaled to world units, so a single repeating
   * stone texture tiles at a consistent size across boxes of any dimension.
   */
  worldBox(w, h, d, texSize = 2) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    // Face order: +x, -x, +y, -y, +z, -z (4 vertices each).
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * dims[f][0] / texSize, uv.getY(i) * dims[f][1] / texSize);
      }
    }
    uv.needsUpdate = true;
    return geo;
  },
};

window.Utils = Utils;
