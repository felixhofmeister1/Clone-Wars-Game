/* =============================================================================
 * weapons.js — Blaster bolts, impact effects and the DC-15A blaster rifle.
 *
 *  EffectsSystem : pooled spark bursts + glow flashes for bolt impacts and
 *                  droid explosions.
 *  BoltSystem    : every blaster bolt in flight (blue for the player, red for
 *                  droids). Bolts are swept as line segments each frame so fast
 *                  shots never tunnel through thin droids or pillars.
 *  DC15ARifle    : the first-person view model (drawn in its own overlay scene
 *                  so it never clips into walls), firing, recoil, muzzle flash,
 *                  heat-cell ammo and reloading.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Impact / explosion effects                                                */
/* -------------------------------------------------------------------------- */

class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.flashes = [];

    this.glowTexture = Utils.canvasTexture(Utils.makeGlowCanvas('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
    this.sparkMaterials = {};

    // Pre-allocate spark bursts (each is a small particle cloud).
    this.SPARKS_PER_BURST = 14;
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.SPARKS_PER_BURST * 3), 3));
      const points = new THREE.Points(geo, this._sparkMaterial(0xffffff));
      points.visible = false;
      points.frustumCulled = false;
      scene.add(points);
      this.bursts.push({ points, vel: new Float32Array(this.SPARKS_PER_BURST * 3), life: 0, maxLife: 1 });
    }

    // Pre-allocate additive glow sprites.
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTexture, color: 0xffffff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.flashes.push({ sprite, life: 0, maxLife: 1, size: 1 });
    }
  }

  _sparkMaterial(color) {
    if (!this.sparkMaterials[color]) {
      this.sparkMaterials[color] = new THREE.PointsMaterial({
        color, size: 0.09, map: this.glowTexture, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
    }
    return this.sparkMaterials[color];
  }

  _next(pool) {
    let best = pool[0];
    for (const item of pool) {
      if (item.life <= 0) return item;
      if (item.life < best.life) best = item;
    }
    return best; // recycle the one closest to dying
  }

  /** Spark burst + flash where a bolt struck something. */
  impact(point, color = 0x66ccff, scale = 1) {
    this.sparks(point, color, 6 * scale, 0.35);
    this.flash(point, color, 1.1 * scale, 0.14);
  }

  /** Big flash + orange sparks when a droid is destroyed. */
  explosion(point) {
    this.sparks(point, 0xffaa33, 9, 0.7);
    this.sparks(point, 0xffffff, 6, 0.4);
    this.flash(point, 0xffaa44, 3.2, 0.35);
  }

  sparks(point, color, speed, life) {
    const b = this._next(this.bursts);
    const pos = b.points.geometry.attributes.position;
    for (let i = 0; i < this.SPARKS_PER_BURST; i++) {
      pos.setXYZ(i, point.x, point.y, point.z);
      // Random direction biased upward.
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 0.9 + 0.1;
      const s = speed * (0.4 + Math.random() * 0.6);
      b.vel[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * s;
      b.vel[i * 3 + 1] = v * s;
      b.vel[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * s;
    }
    pos.needsUpdate = true;
    b.points.material = this._sparkMaterial(color);
    b.points.visible = true;
    b.life = b.maxLife = life;
  }

  flash(point, color, size, life) {
    const f = this._next(this.flashes);
    f.sprite.position.copy(point);
    f.sprite.material.color.setHex(color);
    f.sprite.material.opacity = 1;
    f.sprite.visible = true;
    f.life = f.maxLife = life;
    f.size = size;
  }

  update(dt) {
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) { b.points.visible = false; continue; }
      const pos = b.points.geometry.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < this.SPARKS_PER_BURST; i++) {
        b.vel[i * 3 + 1] -= 14 * dt; // gravity
        arr[i * 3] += b.vel[i * 3] * dt;
        arr[i * 3 + 1] = Math.max(0.02, arr[i * 3 + 1] + b.vel[i * 3 + 1] * dt);
        arr[i * 3 + 2] += b.vel[i * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) { f.sprite.visible = false; continue; }
      const k = f.life / f.maxLife;
      f.sprite.material.opacity = k;
      const s = f.size * (1.4 - k * 0.6);
      f.sprite.scale.set(s, s, s);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Blaster bolts                                                             */
/* -------------------------------------------------------------------------- */

class BoltSystem {
  /**
   * @param {object} world shared game context (scene, colliders, enemies, player...)
   */
  constructor(world) {
    this.world = world;
    this.active = [];
    this.pool = { player: [], enemy: [] };

    // Unit-length open cylinders along +Z; each bolt scales them to its length.
    const coreGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6, 1, true).rotateX(Math.PI / 2);
    const glowGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 8, 1, true).rotateX(Math.PI / 2);
    const make = (core, glow) => ({
      coreGeo, glowGeo,
      core: new THREE.MeshBasicMaterial({ color: core }),
      glow: new THREE.MeshBasicMaterial({
        color: glow, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    });
    this.styles = {
      player: make(0xeaf8ff, 0x2f8dff), // Republic blue
      enemy: make(0xfff0ea, 0xff2a14),  // Separatist red
    };

    this._p0 = new THREE.Vector3();
    this._p1 = new THREE.Vector3();
    this._hit = new THREE.Vector3();
  }

  _mesh(team) {
    const pool = this.pool[team];
    if (pool.length) return pool.pop();
    const s = this.styles[team];
    const group = new THREE.Group();
    group.add(new THREE.Mesh(s.coreGeo, s.core));
    group.add(new THREE.Mesh(s.glowGeo, s.glow));
    group.userData.team = team;
    return group;
  }

  /**
   * Launches a bolt.
   * @param {object} o
   * @param {THREE.Vector3} o.origin    start point (world)
   * @param {THREE.Vector3} o.direction normalised travel direction
   * @param {'player'|'enemy'} o.team
   */
  spawn({ origin, direction, team, speed = 90, damage = 1, length = 1.3, maxDist = 160 }) {
    const mesh = this._mesh(team);
    mesh.scale.set(1, 1, length);
    this.world.scene.add(mesh);
    const bolt = {
      mesh, team, speed, damage, length, maxDist, travelled: 0,
      pos: origin.clone(), dir: direction.clone().normalize(),
    };
    this._place(bolt);
    this.active.push(bolt);
    return bolt;
  }

  _place(bolt) {
    // Mesh centre trails half a length behind the bolt tip.
    const m = bolt.mesh;
    m.position.copy(bolt.pos).addScaledVector(bolt.dir, -bolt.length * 0.5);
    this._hit.copy(m.position).add(bolt.dir);
    m.lookAt(this._hit);
  }

  _recycle(i) {
    const bolt = this.active[i];
    this.world.scene.remove(bolt.mesh);
    this.pool[bolt.team].push(bolt.mesh);
    this.active[i] = this.active[this.active.length - 1];
    this.active.pop();
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this._recycle(i);
  }

  update(dt) {
    const { world } = this;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      const step = b.speed * dt;
      const p0 = this._p0.copy(b.pos);
      const p1 = this._p1.copy(b.pos).addScaledVector(b.dir, step);

      // 1) Level geometry (stone, pillars, ground).
      let bestT = world.raycastStatic(p0, p1);
      let target = bestT !== null ? 'static' : null;
      let targetData = null;

      // 2) Characters on the opposing team.
      if (b.team === 'player') {
        const hit = world.enemies.raycast(p0, p1);
        if (hit && (bestT === null || hit.t < bestT)) { bestT = hit.t; target = 'droid'; targetData = hit; }
      } else {
        const t = world.raycastPlayer(p0, p1);
        if (t !== null && (bestT === null || t < bestT)) { bestT = t; target = 'player'; }
      }

      if (target) {
        const point = this._hit.copy(p0).lerp(p1, bestT);
        const color = b.team === 'player' ? 0x5ab4ff : 0xff4a2a;
        if (target === 'static') {
          world.effects.impact(point, color, 0.8);
          if (b.team === 'player') GameAudio.hitStone(point.distanceTo(world.camera.position));
        } else if (target === 'droid') {
          world.enemies.onBoltHit(targetData.droid, targetData.part, point, b);
        } else {
          world.onPlayerHit(b.damage, b.pos);
        }
        this._recycle(i);
        continue;
      }

      b.pos.copy(p1);
      b.travelled += step;
      if (b.travelled > b.maxDist) { this._recycle(i); continue; }
      this._place(b);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  DC-15A blaster rifle                                                      */
/* -------------------------------------------------------------------------- */

class DC15ARifle {
  /**
   * @param {object} world          shared game context
   * @param {THREE.Scene} viewScene overlay scene holding only the view model
   */
  constructor(world, viewScene) {
    this.world = world;
    this.viewScene = viewScene;

    // Ammo / timing ----------------------------------------------------------
    this.magSize = 30;
    this.ammo = this.magSize;
    this.reserve = 150;
    this.fireInterval = 0.14;   // ~430 rounds per minute
    this.cooldown = 0;
    this.reloadTime = 1.55;
    this.reloading = false;
    this.reloadT = 0;
    this.emptyClickT = 0;

    // Animation state --------------------------------------------------------
    this.recoil = 0;
    this.flashT = 0;
    this.bobT = 0;
    this.sway = new THREE.Vector2();
    this.basePos = new THREE.Vector3(0.15, -0.14, -0.4);

    this._buildModel();
    this._buildMuzzleFlash();

    // Scratch vectors (avoid per-shot allocations).
    this._v = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  /* ----------------------------------------------------------- the model */

  _buildModel() {
    const std = (color, rough = 0.55, metal = 0.35, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    const M = {
      body: std(0x2a2e33, 0.5, 0.45),
      dark: std(0x151719, 0.6, 0.4),
      steel: std(0x6d747c, 0.35, 0.7),
      shroud: std(0x3b4148, 0.45, 0.55),
      lens: std(0x1a5fb4, 0.1, 0.3, { emissive: 0x2a7fff, emissiveIntensity: 0.9 }),
      armor: std(0xeeeeea, 0.45, 0.05),
      glove: std(0x1c1c1e, 0.85, 0.05),
      cell: std(0x30363c, 0.4, 0.5),
      cellGlow: new THREE.MeshBasicMaterial({ color: 0x4fc3ff }),
    };
    this.cellGlowMat = M.cellGlow;

    const root = new THREE.Group();
    const add = (geo, mat, x, y, z, parent = root) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const cylZ = (r1, r2, len, seg = 12) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2);

    // Receiver & top rail.
    add(new THREE.BoxGeometry(0.055, 0.085, 0.42), M.body, 0, 0, -0.1);
    add(new THREE.BoxGeometry(0.03, 0.014, 0.40), M.dark, 0, 0.05, -0.1);
    add(new THREE.BoxGeometry(0.06, 0.03, 0.16), M.steel, 0, -0.035, -0.06); // ejection housing

    // Long perforated barrel shroud with cooling rings — the DC-15A silhouette.
    add(cylZ(0.031, 0.031, 0.44), M.shroud, 0, 0.004, -0.52);
    for (let i = 0; i < 8; i++) add(cylZ(0.036, 0.036, 0.012), M.dark, 0, 0.004, -0.34 - i * 0.05);
    add(cylZ(0.015, 0.015, 0.2), M.dark, 0, 0.004, -0.82);  // inner barrel
    add(cylZ(0.024, 0.02, 0.06), M.steel, 0, 0.004, -0.93); // muzzle
    add(new THREE.BoxGeometry(0.008, 0.035, 0.012), M.dark, 0, 0.045, -0.72); // front sight

    // Scope on its mounts.
    add(cylZ(0.019, 0.019, 0.17), M.dark, 0, 0.085, -0.12);
    add(cylZ(0.024, 0.02, 0.03), M.body, 0, 0.085, -0.215);
    add(new THREE.CircleGeometry(0.02, 16).rotateY(Math.PI), M.lens, 0, 0.085, -0.231);
    add(new THREE.BoxGeometry(0.012, 0.03, 0.02), M.body, 0, 0.065, -0.07);
    add(new THREE.BoxGeometry(0.012, 0.03, 0.02), M.body, 0, 0.065, -0.17);

    // Pistol grip + trigger guard.
    const grip = add(new THREE.BoxGeometry(0.038, 0.12, 0.05), M.dark, 0, -0.09, 0.03);
    grip.rotation.x = 0.28;
    add(new THREE.BoxGeometry(0.01, 0.01, 0.07), M.body, 0, -0.06, -0.03);

    // Side-mounted power cell with a glowing charge strip (dims with ammo).
    this.cell = add(new THREE.BoxGeometry(0.03, 0.06, 0.11), M.cell, -0.043, -0.005, -0.2);
    add(new THREE.BoxGeometry(0.004, 0.012, 0.085), M.cellGlow, -0.017, 0.012, 0, this.cell);

    // Folding skeletal stock (extended).
    add(new THREE.BoxGeometry(0.012, 0.012, 0.22), M.steel, 0, 0.02, 0.2);
    add(new THREE.BoxGeometry(0.012, 0.012, 0.22), M.steel, 0, -0.03, 0.2);
    add(new THREE.BoxGeometry(0.03, 0.08, 0.02), M.dark, 0, -0.005, 0.31);

    // Clone trooper arms: black glove + white Phase I armour plates.
    const limb = (from, to, w, h, mat) => {
      const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
      root.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(0.055, 0.07, 0.09), M.glove, 0.01, -0.085, 0.04);          // trigger hand
    limb([0.03, -0.1, 0.08], [0.12, -0.2, 0.36], 0.075, 0.07, M.glove);                  // under-suit sleeve
    limb([0.04, -0.105, 0.12], [0.11, -0.18, 0.33], 0.085, 0.078, M.armor);              // forearm plate
    add(new THREE.BoxGeometry(0.06, 0.05, 0.1), M.glove, -0.005, -0.04, -0.46);          // support hand
    limb([-0.02, -0.06, -0.44], [-0.2, -0.22, -0.12], 0.07, 0.065, M.glove);
    limb([-0.035, -0.075, -0.4], [-0.17, -0.2, -0.16], 0.082, 0.076, M.armor);

    // Muzzle anchor used to spawn bolts & position the flash.
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.004, -0.97);
    root.add(this.muzzle);

    root.scale.setScalar(0.62); // view-model scale: keeps the rifle compact on screen
    root.position.copy(this.basePos);
    this.root = root;
    this.viewScene.add(root);
  }

  _buildMuzzleFlash() {
    // Star-shaped additive flash on the muzzle.
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(150,210,255,0.9)');
    grad.addColorStop(1, 'rgba(40,120,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 22 : 64;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fill();
    const tex = Utils.canvasTexture(c);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    this.flashSprite.visible = false;
    this.muzzle.add(this.flashSprite);

    // Lights: one lights the gun itself, one lights up the world around you.
    this.viewLight = new THREE.PointLight(0x5aaaff, 0, 2, 2);
    this.viewLight.position.set(0.2, -0.1, -1.2);
    this.viewScene.add(this.viewLight);

    this.worldLight = new THREE.PointLight(0x4a9bff, 0, 10, 2);
    this.world.scene.add(this.worldLight);
  }

  /* ------------------------------------------------------------ gameplay */

  reset() {
    this.ammo = this.magSize;
    this.reserve = 150;
    this.reloading = false;
    this.reloadT = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this._syncHud();
  }

  /** Called between waves: resupply power cells. */
  resupply(amount) {
    this.reserve += amount;
    this._syncHud();
  }

  startReload() {
    if (this.reloading || this.ammo >= this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = 0;
    GameAudio.reload();
    this._syncHud();
  }

  _finishReload() {
    const take = Math.min(this.magSize - this.ammo, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this.reloading = false;
    this._syncHud();
  }

  _syncHud() {
    this.world.hud.setAmmo(this.ammo, this.magSize, this.reserve, this.reloading);
    // Cell glow dims as the magazine empties.
    const k = this.ammo / this.magSize;
    this.cellGlowMat.color.setRGB(0.15 + 0.16 * k, 0.25 + 0.51 * k, 0.35 + 0.65 * k);
  }

  fire() {
    const { world } = this;
    const cam = world.camera;
    this.ammo--;
    this.cooldown = this.fireInterval;
    this.recoil = Math.min(this.recoil + 1, 1.6);

    // Muzzle position: the view-model camera sits at the origin with no
    // rotation, so the muzzle's view-scene position is already camera-space.
    this.root.updateMatrixWorld(true);
    this.muzzle.getWorldPosition(this._muzzle);
    this._muzzle.applyMatrix4(cam.matrixWorld);

    // Aim direction: camera forward + a little spread (more when moving).
    const spread = 0.005 + world.player.moveFactor * 0.012;
    this._dir.set(Utils.rand(-spread, spread), Utils.rand(-spread, spread), -1)
      .normalize().applyQuaternion(cam.quaternion);

    // Converge the bolt from the muzzle onto whatever the crosshair points at.
    const dist = world.aimDistance(cam.position, this._dir, 200);
    this._target.copy(cam.position).addScaledVector(this._dir, dist);
    const dir = this._v.copy(this._target).sub(this._muzzle).normalize();
    if (dist < 2) dir.copy(this._dir);

    // If the muzzle is poking through a wall, impact right there instead.
    const blockT = world.raycastStatic(cam.position, this._muzzle);
    if (blockT !== null) {
      const p = cam.position.clone().lerp(this._muzzle, blockT);
      world.effects.impact(p, 0x5ab4ff, 0.8);
    } else {
      world.bolts.spawn({ origin: this._muzzle, direction: dir, team: 'player', speed: 110, damage: 1, length: 1.5 });
    }

    // Feedback: flash, light, sound, crosshair bloom, camera kick.
    this.flashT = 0.06;
    this.flashSprite.material.rotation = Math.random() * Math.PI;
    this.worldLight.position.copy(this._muzzle);
    GameAudio.blaster();
    world.hud.crosshairKick();
    world.player.addRecoil(0.011);

    if (this.ammo === 0) this.startReload();
    this._syncHud();
  }

  /**
   * @param {number} dt
   * @param {InputController} input
   * @param {{moveFactor:number, grounded:boolean}} motion
   */
  update(dt, input, motion, lookDelta) {
    this.cooldown -= dt;
    this.emptyClickT -= dt;

    if (input.consumePress('reload')) this.startReload();

    if (this.reloading) {
      this.reloadT += dt;
      this.world.hud.setReloadProgress(this.reloadT / this.reloadTime);
      if (this.reloadT >= this.reloadTime) this._finishReload();
    } else if (input.firing && this.cooldown <= 0) {
      if (this.ammo > 0) {
        this.fire();
      } else if (this.emptyClickT <= 0) {
        GameAudio.empty();
        this.emptyClickT = 0.35;
        this.startReload();
      }
    }

    this._animate(dt, motion, lookDelta);
  }

  /* ----------------------------------------------------------- animation */

  _animate(dt, motion, lookDelta) {
    const r = this.root;

    // Walk bob.
    if (motion.grounded && motion.moveFactor > 0.05) this.bobT += dt * (6 + motion.moveFactor * 5);
    const bobAmt = 0.012 * motion.moveFactor;
    const bobX = Math.sin(this.bobT) * bobAmt;
    const bobY = -Math.abs(Math.cos(this.bobT)) * bobAmt;

    // Sway: the gun lags slightly behind camera rotation.
    this.sway.x = Utils.lerp(this.sway.x, Utils.clamp(-lookDelta.dx * 1.2, -0.06, 0.06), Utils.damp(10, dt));
    this.sway.y = Utils.lerp(this.sway.y, Utils.clamp(lookDelta.dy * 1.2, -0.06, 0.06), Utils.damp(10, dt));

    // Recoil springs back.
    this.recoil = Math.max(0, this.recoil - dt * 9);
    const kick = this.recoil;

    // Reload: dip & roll the rifle, pop the power cell out and back in.
    let reloadDip = 0, reloadRoll = 0, cellOut = 0;
    if (this.reloading) {
      const p = Utils.clamp(this.reloadT / this.reloadTime, 0, 1);
      const env = Math.sin(p * Math.PI); // 0 -> 1 -> 0
      reloadDip = env * 0.09;
      reloadRoll = env * 0.55;
      cellOut = p < 0.5 ? Math.sin(p * 2 * Math.PI) * 0.08 : 0;
    }

    r.position.set(
      this.basePos.x + bobX + this.sway.x * 0.4,
      this.basePos.y + bobY - reloadDip + this.sway.y * 0.4,
      this.basePos.z + kick * 0.045,
    );
    r.rotation.set(kick * 0.06 + reloadDip * 1.5 + this.sway.y, this.sway.x, reloadRoll);
    this.cell.position.x = -0.043 - cellOut;
    this.cell.position.y = -0.005 - cellOut * 0.6;

    // Muzzle flash & lights decay.
    this.flashT -= dt;
    const on = this.flashT > 0;
    this.flashSprite.visible = on;
    if (on) {
      const s = 0.16 + Math.random() * 0.08;
      this.flashSprite.scale.set(s, s, s);
    }
    this.viewLight.intensity = on ? 4 : 0;
    this.worldLight.intensity = on ? 40 : 0;
  }
}

window.EffectsSystem = EffectsSystem;
window.BoltSystem = BoltSystem;
window.DC15ARifle = DC15ARifle;
