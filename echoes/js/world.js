/* =============================================================================
 * world.js - The apartment: layout, procedural drywall, furniture, pickups,
 * the exit, and collision. One tile is 2 m; walls are 2.6 m tall.
 *
 *  #  wall          .  floor        S  start
 *  T  cassette tape B  battery
 *  2  dead end in the hallway: drywall until the hallway shifts
 *  3  the front door: drywall until you have all three tapes and look away
 * ========================================================================== */

const TILE = 2;
const WALL_H = 2.6;
const MAP = [
  '##############',
  '#...##########',
  '#S........T2.#',
  '#.B.########.#',
  '############.#',
  '########...#.#',
  '########.T...#',
  '########B..#.#',
  '############.#',
  '#...#........#',
  '#.T........B##',
  '#...#.......##',
  '#####.......##',
  '########3#####',
];
const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

/* ---------------------------------------------------------------- textures */
function makeTexture(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function speckle(g, s, count, alpha) {
  for (let i = 0; i < count; i++) {
    const v = Math.random() < 0.5 ? 40 : 250;
    g.fillStyle = `rgba(${v},${v - 8},${v - 20},${Math.random() * alpha})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

const drawDrywall = (g, s) => {
  g.fillStyle = '#cbc3b1';
  g.fillRect(0, 0, s, s);
  speckle(g, s, 9000, 0.06);
  // Taped and mudded joint where two 4 ft sheets meet.
  g.fillStyle = 'rgba(255,250,236,0.32)';
  g.fillRect(s * 0.61 - 12, 0, 24, s);
  g.fillStyle = 'rgba(80,70,55,0.16)';
  g.fillRect(s * 0.61, 0, 1, s);
  // Screw dimples along studs 16 in. on centre.
  for (let x = 0.08; x < 1; x += 0.203) {
    for (let y = 0.1; y < 0.93; y += 0.15) {
      g.fillStyle = 'rgba(70,60,45,0.3)';
      g.beginPath();
      g.arc(x * s, y * s, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Water stains.
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * s, y = Math.random() * s * 0.7, r = 40 + Math.random() * 90;
    const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    gr.addColorStop(0, 'rgba(120,95,50,0)');
    gr.addColorStop(0.8, 'rgba(120,95,50,0.17)');
    gr.addColorStop(1, 'rgba(120,95,50,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Hairline cracks.
  g.strokeStyle = 'rgba(40,32,24,0.45)';
  g.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    let x = Math.random() * s, y = Math.random() * s * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 14; k++) { x += (Math.random() - 0.5) * 26; y += Math.random() * 18; g.lineTo(x, y); }
    g.stroke();
  }
  // Scuffed baseboard.
  g.fillStyle = '#39322a';
  g.fillRect(0, s * 0.955, s, s * 0.045);
};

const drawFloor = (g, s) => {
  const rows = 8, h = s / rows;
  for (let r = 0; r < rows; r++) {
    let x = -Math.random() * s * 0.5;
    while (x < s) {
      const w = s * (0.35 + Math.random() * 0.5);
      const shade = 30 + Math.random() * 16;
      g.fillStyle = `rgb(${shade + 18},${shade + 7},${shade - 5})`;
      g.fillRect(x, r * h, w, h);
      g.strokeStyle = `rgba(18,10,5,${0.15 + Math.random() * 0.15})`;
      for (let k = 0; k < 5; k++) {
        const yy = r * h + Math.random() * h;
        g.beginPath();
        g.moveTo(x, yy);
        g.bezierCurveTo(x + w * 0.3, yy + (Math.random() - 0.5) * 6, x + w * 0.6, yy + (Math.random() - 0.5) * 6, x + w, yy);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(x, r * h, 2, h);
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(0, r * h, s, 2);
  }
};

const drawCeiling = (g, s) => {
  g.fillStyle = '#6a645a';
  g.fillRect(0, 0, s, s);
  speckle(g, s, 5000, 0.12);
  const gr = g.createRadialGradient(s * 0.3, s * 0.6, 10, s * 0.3, s * 0.6, s * 0.35);
  gr.addColorStop(0, 'rgba(95,72,40,0.0)');
  gr.addColorStop(0.85, 'rgba(95,72,40,0.25)');
  gr.addColorStop(1, 'rgba(95,72,40,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
};

const drawGlow = (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
};

/* ---------------------------------------------------------------- World */
class World {
  constructor(scene) {
    this.scene = scene;
    this.shifted = { hall: false, exit: false };
    this.blockers = [];
    this.floorTiles = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) if ('.STB'.includes(MAP[y][x])) this.floorTiles.push([x, y]);
    }
    this.mats = {
      wall: new THREE.MeshStandardMaterial({ map: makeTexture(512, drawDrywall), roughness: 0.92 }),
      floor: new THREE.MeshStandardMaterial({ map: makeTexture(512, drawFloor, 7), roughness: 0.78 }),
      ceiling: new THREE.MeshStandardMaterial({ map: makeTexture(256, drawCeiling, 8), roughness: 1 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x4d463f, roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.85 }),
      laminate: new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.7 }),
      enamel: new THREE.MeshStandardMaterial({ color: 0xbab5a8, roughness: 0.45 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.6 }),
    };
    this.glowTexture = makeTexture(64, drawGlow);
    this.wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);

    this._buildShell();
    this._buildWalls();
    this._buildProps();
    this._buildHallReveal();
    this._buildTv();
    this._buildPickups();
    this._buildExit();
    this.reset();
  }

  /* ------------------------------------------------------------ queries */
  static tileCenter(tx, ty, y = 0) { return new THREE.Vector3(tx * TILE + TILE / 2, y, ty * TILE + TILE / 2); }

  tile(tx, ty) { return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? '#' : MAP[ty][tx]; }

  isSolid(tx, ty) {
    const c = this.tile(tx, ty);
    if (c === '#') return true;
    if (c === '2') return !this.shifted.hall;
    if (c === '3') return !this.shifted.exit;
    return false;
  }

  isSolidAt(x, z) { return this.isSolid(Math.floor(x / TILE), Math.floor(z / TILE)); }

  collides(x, z, r) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const z0 = Math.floor((z - r) / TILE), z1 = Math.floor((z + r) / TILE);
    for (let ty = z0; ty <= z1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true;
    for (const b of this.blockers) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
    }
    return false;
  }

  /** Moves a circle, sliding along walls one axis at a time. */
  move(pos, dx, dz, r) {
    if (!this.collides(pos.x + dx, pos.z, r)) pos.x += dx;
    if (!this.collides(pos.x, pos.z + dz, r)) pos.z += dz;
  }

  lineOfSight(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const steps = Math.ceil(Math.hypot(dx, dz) / 0.2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolidAt(a.x + dx * t, a.z + dz * t)) return false;
    }
    return true;
  }

  /** A random room tile whose distance from `from` lies within [minDist, maxDist]. */
  randomFloorPoint(from, minDist, maxDist = Infinity) {
    for (let i = 0; i < 60; i++) {
      const [tx, ty] = this.floorTiles[Math.floor(Math.random() * this.floorTiles.length)];
      const p = World.tileCenter(tx, ty);
      const d = from ? Math.hypot(p.x - from.x, p.z - from.z) : minDist;
      if (d >= minDist && d <= maxDist) return p;
    }
    const [tx, ty] = this.floorTiles[0];
    return World.tileCenter(tx, ty);
  }

  /* ------------------------------------------------------------ shifts */
  setHallShifted(on) {
    this.shifted.hall = on;
    this.hallWall.visible = !on;
    // The bulb behind the dead end only exists once the wall is gone (no light through drywall).
    this.hallLight.intensity = 0;
    this.hallBulb.material.color.setHex(on ? 0xffd9a0 : 0x2a2622);
  }

  setExitShifted(on) {
    this.shifted.exit = on;
    this.exitWall.visible = !on;
    this.exitGroup.visible = on;
    this.exitLight.intensity = on ? 6 : 0; // Kept in the scene so revealing it causes no shader recompile.
  }

  reset() {
    this.setHallShifted(false);
    this.setExitShifted(false);
    for (const p of this.pickups) { p.taken = false; p.group.visible = true; }
  }

  /* ------------------------------------------------------------ build */
  _buildShell() {
    const size = MAP_W * TILE;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(size / 2, 0, size / 2);
    floor.receiveShadow = true;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mats.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(size / 2, WALL_H, size / 2);
    ceiling.receiveShadow = true;
    this.scene.add(floor, ceiling);
  }

  _buildWalls() {
    // Only drywall that faces a room is built.
    const visible = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (MAP[y][x] !== '#') continue;
        let facesRoom = false;
        for (let oy = -1; oy <= 1 && !facesRoom; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const c = this.tile(x + ox, y + oy);
            if (c !== '#') { facesRoom = true; break; }
          }
        }
        if (facesRoom) visible.push([x, y]);
      }
    }
    const walls = new THREE.InstancedMesh(this.wallGeo, this.mats.wall, visible.length);
    const m = new THREE.Matrix4();
    visible.forEach(([x, y], i) => {
      m.makeTranslation(x * TILE + TILE / 2, WALL_H / 2, y * TILE + TILE / 2);
      walls.setMatrixAt(i, m);
    });
    walls.instanceMatrix.needsUpdate = true;
    walls.frustumCulled = false; // One draw call for the whole apartment; never cull it by its base box.
    walls.castShadow = walls.receiveShadow = true;
    this.scene.add(walls);

    const swapWall = (tx, ty) => {
      const mesh = new THREE.Mesh(this.wallGeo, this.mats.wall);
      mesh.position.copy(World.tileCenter(tx, ty, WALL_H / 2));
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };
    this.hallWall = swapWall(11, 2);
    this.exitWall = swapWall(8, 13);
  }

  /** Adds a box whose bottom sits at y, optionally blocking movement. */
  _box(w, h, d, mat, x, y, z, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collide) this.blockers.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  _buildProps() {
    const M = this.mats;
    // Bedroom: a bare mattress and a nightstand.
    this._box(1.9, 0.28, 2.0, M.fabric, 3.3, 0, 3.1);
    this._box(0.5, 0.55, 0.45, M.wood, 4.75, 0, 2.35);
    // Hallway: a single picture frame, the only landmark in the corridor.
    this._box(0.5, 0.66, 0.03, M.wood, 15, 1.22, 5.98, false);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.52), new THREE.MeshStandardMaterial({ color: 0x5e5244, roughness: 1 }));
    photo.position.set(15, 1.55, 5.96);
    photo.rotation.y = Math.PI;
    this.scene.add(photo);
    // Kitchen: counter, fridge and a table (tape 2 lies on it).
    this._box(4.8, 0.92, 0.62, M.laminate, 18.4, 0, 10.33);
    this._box(0.85, 1.85, 0.75, M.enamel, 21.5, 0, 10.4);
    this._box(1.0, 0.74, 0.8, M.wood, 19, 0, 13);
    // Bathroom: tub and sink.
    this._box(0.85, 0.55, 1.8, M.enamel, 2.5, 0, 19.0);
    this._box(0.6, 0.85, 0.45, M.enamel, 7.2, 0, 18.3);
    // Living room: sofa facing the television.
    this._box(2.8, 0.45, 0.95, M.fabric, 16, 0, 22.7);
    this._box(2.8, 0.5, 0.2, M.fabric, 16, 0.45, 23.1, false);
  }

  /** Beyond the dead end: a bare bulb, and the hallway's own picture hanging on the far wall. */
  _buildHallReveal() {
    this.hallBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a2622 }));
    this.hallBulb.position.set(25, 2.2, 5);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.36, 4), this.mats.dark);
    cord.position.set(25, 2.42, 5);
    this.scene.add(this.hallBulb, cord);
    this.hallLight = new THREE.PointLight(0xffc98f, 0, 5, 2);
    this.hallLight.position.set(25, 2.05, 5);
    this.scene.add(this.hallLight);
    this._box(0.03, 0.66, 0.5, this.mats.wood, 25.985, 1.22, 5, false);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.52), new THREE.MeshStandardMaterial({ color: 0x5e5244, roughness: 1 }));
    photo.position.set(25.965, 1.55, 5);
    photo.rotation.y = -Math.PI / 2;
    this.scene.add(photo);
    this.bulbT = 0;
  }

  _buildTv() {
    this._box(1.6, 0.55, 0.45, this.mats.wood, 16, 0, 18.3);
    this._box(0.9, 0.62, 0.5, this.mats.dark, 16, 0.55, 18.3, false);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    this.tvCtx = c.getContext('2d');
    this.tvImage = this.tvCtx.createImageData(64, 48);
    this.tvTexture = new THREE.CanvasTexture(c);
    this.tvTexture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.5), new THREE.MeshBasicMaterial({ map: this.tvTexture, color: 0x9aa6b8 }));
    screen.position.set(16, 0.86, 18.556);
    this.scene.add(screen);
    // Short range and pulled into the room, so it cannot glow through the wall into the kitchen.
    this.tvLight = new THREE.PointLight(0x9fb3d9, 1.4, 4.5, 2);
    this.tvLight.position.set(16, 0.95, 19.7);
    this.scene.add(this.tvLight);
    this.tvTimer = 0;
  }

  _glow(color, scale) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.setScalar(scale);
    return s;
  }

  _buildPickups() {
    this.pickups = [];
    const tapeY = { 9: 0.75 }; // Tape 2 rests on the kitchen table (tile x = 9).
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const c = MAP[y][x];
        if (c !== 'T' && c !== 'B') continue;
        const group = new THREE.Group();
        const pos = World.tileCenter(x, y);
        if (c === 'T') {
          pos.y = tapeY[x] || 0;
          const shell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.028, 0.13), this.mats.dark);
          const label = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.9 }));
          const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b2f }));
          shell.position.y = label.position.y = 0.014;
          led.position.set(0.075, 0.03, 0.045);
          const glow = this._glow(0xff3b2f, 0.7);
          glow.position.copy(led.position);
          group.add(shell, label, led, glow);
          group.userData = { led, glow };
          group.rotation.y = Math.random() * Math.PI;
        } else {
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.15, 12), this.mats.dark);
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xe3a33c, emissive: 0x6a4410, roughness: 0.5 }));
          body.rotation.z = band.rotation.z = Math.PI / 2;
          body.position.y = band.position.y = 0.035;
          const glow = this._glow(0xe3a33c, 0.55);
          glow.position.y = 0.05;
          group.add(body, band, glow);
          group.userData = { glow };
          group.rotation.y = Math.random() * Math.PI;
        }
        group.position.copy(pos);
        this.scene.add(group);
        this.pickups.push({ type: c === 'T' ? 'tape' : 'battery', group, pos, taken: false });
      }
    }
  }

  _buildExit() {
    const g = (this.exitGroup = new THREE.Group());
    const frame = this.mats.wood;
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); };
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.25, 0.26), frame), 16.07, 1.125, 26);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.25, 0.26), frame), 17.93, 1.125, 26);
    add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.26), frame), 17, 2.425, 26);
    // The door stands open onto a cold, bright landing.
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.9), frame);
    leaf.position.set(16.2 + 0.4, 1.1, 26.5 + 0.2);
    leaf.rotation.y = -0.35;
    g.add(leaf);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), new THREE.MeshBasicMaterial({ color: 0xb4c6e0, fog: false }));
    outside.position.set(17, 1.2, 27.95);
    outside.rotation.y = Math.PI;
    g.add(outside);
    this.scene.add(g);
    this.exitLight = new THREE.PointLight(0xb4c8ff, 0, 9, 2);
    this.exitLight.position.set(17, 2, 27.2);
    this.scene.add(this.exitLight);
  }

  /* ------------------------------------------------------------ per frame */
  update(dt, time) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      const { led, glow } = p.group.userData;
      if (led) {
        const on = Math.sin(time * 4) > -0.2;
        led.visible = on;
        glow.material.opacity = on ? 0.9 : 0.15;
      } else {
        glow.material.opacity = 0.45 + Math.sin(time * 2.2) * 0.25;
      }
    }
    // The bulb beyond the dead end hums and stutters.
    if (this.shifted.hall) {
      this.bulbT += dt * 6;
      const n = Perlin.noise1D(this.bulbT);
      this.hallLight.intensity = n < -0.45 ? 0.15 : 2.4 * (0.8 + n * 0.3);
    }
    // Dead-channel static and its flicker on the walls.
    this.tvTimer -= dt;
    if (this.tvTimer <= 0) {
      this.tvTimer = 0.07;
      const d = this.tvImage.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      this.tvCtx.putImageData(this.tvImage, 0, 0);
      this.tvTexture.needsUpdate = true;
      this.tvLight.intensity = 0.9 + Math.random() * 0.9;
    }
  }
}
