/* =============================================================================
 * enemies.js — B1 Battle Droids: model, AI, waves, hit reactions & scoring.
 *
 *  B1Model      : builds the thin, skeletal battle droid out of primitives with a
 *                 joint hierarchy (hips, knees, shoulders, elbows, neck) so it
 *                 can march, aim, stagger and fall apart.
 *  BattleDroid  : one droid's AI — march in formation through a gate, then
 *                 advance on the player, halt to fire red bolts when in range and
 *                 in line of sight, flinch and complain ("Roger, roger!") when hit.
 *  DroidManager : wave director, spawning, speech bubbles, debris & scoring.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Shared geometry / materials (built once, reused by every droid)           */
/* -------------------------------------------------------------------------- */

const B1Model = {
  _res: null,

  resources() {
    if (this._res) return this._res;
    const std = (color, rough = 0.55, metal = 0.35, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    const cylZ = (r1, r2, len, seg = 10) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2);

    this._res = {
      mat: {
        tan: std(0xc9b27c),                 // classic B1 sand/tan finish
        joint: std(0x7a6545, 0.6, 0.45),
        dark: std(0x2a2a2a, 0.5, 0.5),
        eye: std(0x0d0d0d, 0.2, 0.6),
        commander: std(0xe0a81e, 0.5, 0.3), // yellow command markings
      },
      geo: {
        thigh: new THREE.CylinderGeometry(0.028, 0.022, 0.46, 6),
        shin: new THREE.CylinderGeometry(0.024, 0.02, 0.46, 6),
        joint: new THREE.SphereGeometry(0.04, 8, 6),
        foot: new THREE.BoxGeometry(0.075, 0.035, 0.2),
        pelvis: new THREE.BoxGeometry(0.2, 0.08, 0.11),
        spine: new THREE.CylinderGeometry(0.026, 0.026, 0.3, 6),
        chest: new THREE.BoxGeometry(0.3, 0.25, 0.14),
        chestLow: new THREE.BoxGeometry(0.2, 0.08, 0.12),
        backpack: new THREE.BoxGeometry(0.2, 0.22, 0.12),
        neck: new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6),
        head: cylZ(0.045, 0.072, 0.34),         // long snout, pointing forward
        headBack: new THREE.SphereGeometry(0.072, 10, 8),
        headStripe: cylZ(0.074, 0.074, 0.08),
        eye: new THREE.SphereGeometry(0.024, 8, 6),
        upperArm: new THREE.CylinderGeometry(0.02, 0.018, 0.3, 6),
        forearm: new THREE.CylinderGeometry(0.018, 0.016, 0.28, 6),
        hand: new THREE.BoxGeometry(0.045, 0.06, 0.05),
        gun: new THREE.BoxGeometry(0.04, 0.07, 0.34),
        gunBarrel: cylZ(0.012, 0.012, 0.22, 6),
        gunScope: cylZ(0.014, 0.014, 0.1, 6),
      },
    };
    return this._res;
  },

  /** Builds one droid. Returns the root plus named joints for animation. */
  build(isCommander) {
    const { mat, geo } = this.resources();
    const mesh = (g, m, x = 0, y = 0, z = 0, parent) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.castShadow = true;
      if (parent) parent.add(o);
      return o;
    };
    const group = (x, y, z, parent) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    // The droid faces +Z in its local space.
    const root = new THREE.Group();
    const rig = { root };

    // Legs ------------------------------------------------------------------
    mesh(geo.pelvis, mat.joint, 0, 0.98, 0, root);
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const hip = group(s * 0.085, 0.95, 0, root);
      mesh(geo.joint, mat.joint, 0, 0, 0, hip);
      mesh(geo.thigh, mat.tan, 0, -0.23, 0, hip);
      const knee = group(0, -0.46, 0, hip);
      mesh(geo.joint, mat.joint, 0, 0, 0, knee);
      mesh(geo.shin, mat.tan, 0, -0.23, 0, knee);
      mesh(geo.foot, mat.tan, 0, -0.47, 0.05, knee);
      rig['hip' + side] = hip;
      rig['knee' + side] = knee;
    }

    // Upper body (pivots at the waist so the droid can flinch) ---------------
    const torso = group(0, 1.0, 0, root);
    rig.torso = torso;
    mesh(geo.spine, mat.joint, 0, 0.15, 0, torso);
    mesh(geo.chestLow, mat.tan, 0, 0.23, 0.01, torso);
    mesh(geo.chest, isCommander ? mat.commander : mat.tan, 0, 0.38, 0.01, torso);
    mesh(geo.backpack, mat.tan, 0, 0.38, -0.13, torso);

    // Neck juts forward, head hangs out in front: the unmistakable B1 profile.
    const neck = group(0, 0.5, 0.02, torso);
    neck.rotation.x = 0.5;
    mesh(geo.neck, mat.joint, 0, 0.15, 0, neck);
    const head = group(0, 0.3, 0, neck);
    head.rotation.x = -0.28;
    mesh(geo.head, mat.tan, 0, 0, 0.08, head);
    mesh(geo.headBack, mat.tan, 0, 0, -0.09, head);
    mesh(geo.eye, mat.eye, 0.064, 0.012, -0.06, head);
    mesh(geo.eye, mat.eye, -0.064, 0.012, -0.06, head);
    if (isCommander) mesh(geo.headStripe, mat.commander, 0, 0, -0.04, head);
    rig.neck = neck;
    rig.head = head;

    // Arms --------------------------------------------------------------------
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const shoulder = group(s * 0.19, 0.46, 0, torso);
      mesh(geo.joint, mat.joint, 0, 0, 0, shoulder);
      mesh(geo.upperArm, mat.tan, 0, -0.15, 0, shoulder);
      const elbow = group(0, -0.3, 0, shoulder);
      mesh(geo.joint, mat.joint, 0, 0, 0, elbow);
      mesh(geo.forearm, mat.tan, 0, -0.14, 0, elbow);
      const hand = group(0, -0.29, 0, elbow);
      mesh(geo.hand, mat.joint, 0, 0, 0, hand);
      rig['shoulder' + side] = shoulder;
      rig['elbow' + side] = elbow;
      rig['hand' + side] = hand;
    }

    // E-5 blaster in the right hand.
    const gun = group(0, -0.02, 0.02, rig.handR);
    mesh(geo.gun, mat.dark, 0, 0, 0.05, gun);
    mesh(geo.gunBarrel, mat.dark, 0, 0.012, 0.3, gun);
    mesh(geo.gunScope, mat.dark, 0.03, 0.03, 0.05, gun);
    rig.gun = gun;
    rig.muzzle = group(0, 0.012, 0.42, gun);

    return rig;
  },
};

/* -------------------------------------------------------------------------- */
/*  Droid lines                                                               */
/* -------------------------------------------------------------------------- */

const DROID_LINES = {
  hit: ['Roger, roger!', 'Roger, roger!', 'Uh oh.', 'Ow!', "Hey! I'm hit!", 'Roger, roger...', 'Not again!'],
  squad: ['Roger, roger.', 'Roger, roger.', 'Move, move, move!', 'Blast them!', 'Clone spotted!'],
  commander: ['Get that clone!', 'Forward! Roger, roger.', 'Fire at will!'],
  death: ['Uh oh...', 'Roger, roger...', 'Ow...'],
};

/* -------------------------------------------------------------------------- */
/*  One battle droid                                                          */
/* -------------------------------------------------------------------------- */

class BattleDroid {
  constructor(manager, position, waypoint, commander = false) {
    this.mgr = manager;
    this.world = manager.world;
    this.commander = commander;
    this.rig = B1Model.build(commander);
    this.root = this.rig.root;
    this.pos = this.root.position.copy(position);
    this.pos.y = 0;
    this.waypoint = waypoint ? waypoint.clone() : null;

    const wave = manager.wave;
    this.hp = commander ? 3 : 2;               // 2 body shots, or 1 to the head
    this.points = commander ? 250 : 100;
    this.speed = Utils.rand(1.7, 2.1) + Math.min(wave, 8) * 0.07;
    this.engageRange = Utils.rand(12, 24);
    this.state = 'march';
    this.stateT = 0;
    this.fireCooldown = Utils.rand(1.5, 3);
    this.burstLeft = 0;
    this.burstT = 0;
    this.staggerT = 0;
    this.staggerSide = 1;
    this.aimBlend = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.yaw = 0;
    this.los = false;
    this.losT = Math.random() * 0.3;
    this.noLosTime = 0;
    this.strafeDir = 0;
    this.strafeT = 0;
    this.stuckT = 0;
    this.detourT = 0;
    this.detourDir = 1;
    this.lastPos = this.pos.clone();
    this.dead = false;

    // Hit spheres (world space), refreshed every frame.
    this.spheres = {
      head: { c: new THREE.Vector3(), r: 0.16 },
      chest: { c: new THREE.Vector3(), r: 0.25 },
      legs: { c: new THREE.Vector3(), r: 0.27 },
      feet: { c: new THREE.Vector3(), r: 0.2 },
    };
    this.bound = { c: new THREE.Vector3(), r: 1.25 };

    // Face the direction of travel from the start.
    const target = this.waypoint || this.world.player.pos;
    this.yaw = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    this.root.rotation.y = this.yaw;

    this.world.scene.add(this.root);
    this._updateSpheres();
  }

  /* ------------------------------------------------------------------ AI */

  update(dt) {
    const world = this.world;
    const player = world.player;
    this.stateT += dt;

    const toPx = player.pos.x - this.pos.x;
    const toPz = player.pos.z - this.pos.z;
    const distToPlayer = Math.hypot(toPx, toPz);
    const playerYaw = Math.atan2(toPx, toPz);

    // Line-of-sight checks are throttled; they cost a sweep over the level.
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.3;
      const from = this._tmp || (this._tmp = new THREE.Vector3());
      from.set(this.pos.x, 1.45, this.pos.z);
      this.los = distToPlayer < 60 && world.raycastStatic(from, world.camera.position) === null;
    }
    this.noLosTime = this.los ? 0 : this.noLosTime + dt;

    let moveX = 0, moveZ = 0, wantYaw = this.yaw, speed = this.speed;

    if (this.staggerT > 0) {
      // Flinching: no movement, no shooting.
      this.staggerT -= dt;
    } else if (this.state === 'march') {
      // Head for the gate waypoint first, then straight at the clone.
      let tx = player.pos.x, tz = player.pos.z;
      if (this.waypoint) {
        tx = this.waypoint.x; tz = this.waypoint.z;
        if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 1.2) this.waypoint = null;
      }
      const dx = tx - this.pos.x, dz = tz - this.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      moveX = dx / len; moveZ = dz / len;

      // Stuck on cover? Side-step around it for a moment.
      if (this.detourT > 0) {
        this.detourT -= dt;
        const px = -moveZ * this.detourDir, pz = moveX * this.detourDir;
        moveX = moveX * 0.3 + px; moveZ = moveZ * 0.3 + pz;
      }
      wantYaw = Math.atan2(moveX, moveZ);

      // Marching droids take the odd pot-shot.
      if (this.los && distToPlayer < 35) this._tickFire(dt, 0.45);

      if (!this.waypoint && this.los && distToPlayer < this.engageRange) this._setState('attack');
    } else if (this.state === 'attack') {
      // Halt, face the clone and fire in bursts; occasionally side-step.
      wantYaw = playerYaw;
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = Utils.rand(1.2, 2.6);
        this.strafeDir = Math.random() < 0.55 ? 0 : Utils.pick([-1, 1]);
      }
      if (this.strafeDir) {
        moveX = Math.cos(playerYaw) * this.strafeDir;
        moveZ = -Math.sin(playerYaw) * this.strafeDir;
        speed = this.speed * 0.45;
      }
      if (this.los) this._tickFire(dt, 1);
      if (distToPlayer > this.engageRange + 6 || this.noLosTime > 1.8) this._setState('march');
    }

    // Separation so squads don't merge into one blob.
    for (const other of this.mgr.droids) {
      if (other === this || other.dead) continue;
      const sx = this.pos.x - other.pos.x, sz = this.pos.z - other.pos.z;
      const d2 = sx * sx + sz * sz;
      if (d2 < 1.1 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        moveX += (sx / d) * (1.05 - d) * 1.5;
        moveZ += (sz / d) * (1.05 - d) * 1.5;
      }
    }

    // Integrate movement + collide with the level.
    const moving = Math.hypot(moveX, moveZ) > 0.1 && this.staggerT <= 0;
    if (moving) {
      const len = Math.max(1, Math.hypot(moveX, moveZ));
      this.pos.x += (moveX / len) * speed * dt;
      this.pos.z += (moveZ / len) * speed * dt;
    }
    Utils.resolveCircleCollisions(this.pos, 0.35, 1.9, world.colliders, 0.2);

    // Stuck detection while marching.
    if (this.state === 'march') {
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        if (this.pos.distanceTo(this.lastPos) < 0.6 && this.detourT <= 0) {
          this.detourT = Utils.rand(0.8, 1.6);
          this.detourDir = Math.random() < 0.5 ? -1 : 1;
        }
        this.lastPos.copy(this.pos);
        this.stuckT = 0;
      }
    }

    // Smooth turning.
    this.yaw += Utils.angleDiff(this.yaw, wantYaw) * Utils.damp(6, dt);
    this.root.rotation.y = this.yaw;

    this._animate(dt, moving);
    this._updateSpheres();
  }

  _setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  /** Counts down to the next burst and fires its shots. */
  _tickFire(dt, rateScale) {
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this._shoot();
        this.burstLeft--;
        this.burstT = 0.22;
      }
      return;
    }
    this.fireCooldown -= dt * rateScale;
    if (this.fireCooldown <= 0) {
      this.burstLeft = Utils.randInt(1, 3);
      this.burstT = 0;
      const waveHaste = Math.min(this.mgr.wave, 10) * 0.08;
      this.fireCooldown = Utils.rand(1.4, 2.8) - waveHaste;
    }
  }

  _shoot() {
    const world = this.world;
    this.root.updateMatrixWorld(true);
    const origin = this.rig.muzzle.getWorldPosition(new THREE.Vector3());

    // Aim at the clone's chest. B1s are famously poor shots: add a wobble
    // that shrinks a little each wave.
    const target = world.camera.position.clone();
    target.y -= 0.35;
    const dist = origin.distanceTo(target);
    const spread = Math.max(0.03, 0.085 - this.mgr.wave * 0.005) * dist;
    target.x += Utils.rand(-spread, spread);
    target.y += Utils.rand(-spread, spread) * 0.6;
    target.z += Utils.rand(-spread, spread);
    const dir = target.sub(origin).normalize();

    world.bolts.spawn({
      origin, direction: dir, team: 'enemy',
      speed: 30 + Math.min(this.mgr.wave, 10), damage: 6 + Math.floor(this.mgr.wave / 3),
      length: 1.1, maxDist: 120,
    });
    world.effects.flash(origin, 0xff5533, 0.5, 0.08);
    GameAudio.droidBlaster(dist, this.mgr.panFor(this.pos));
    this.aimBlend = 1; // snap the rifle up
  }

  /* ----------------------------------------------------------- reactions */

  /** Returns true if this hit destroyed the droid. */
  takeHit(part) {
    this.hp -= part === 'head' ? 99 : 1;
    if (this.hp <= 0) return true;
    this.staggerT = 0.45;
    this.staggerSide = Math.random() < 0.5 ? -1 : 1;
    // Getting shot tends to make them come at you.
    if (this.state === 'march' && !this.waypoint) this._setState('attack');
    return false;
  }

  /* ----------------------------------------------------------- animation */

  _animate(dt, moving) {
    const r = this.rig;
    const walkAmt = moving ? 1 : 0;
    this.walkBlend = Utils.lerp(this.walkBlend || 0, walkAmt, Utils.damp(8, dt));
    if (moving) this.phase += dt * (this.state === 'attack' ? 5 : 7.5);

    // Stiff, mechanical march.
    const s = Math.sin(this.phase) * this.walkBlend;
    r.hipL.rotation.x = s * 0.5;
    r.hipR.rotation.x = -s * 0.5;
    r.kneeL.rotation.x = Math.max(0, Math.sin(this.phase + Math.PI * 0.5)) * 0.7 * this.walkBlend;
    r.kneeR.rotation.x = Math.max(0, Math.sin(this.phase - Math.PI * 0.5)) * 0.7 * this.walkBlend;
    r.torso.position.y = 1.0 + Math.abs(Math.cos(this.phase)) * 0.03 * this.walkBlend;

    // Rifle held at port-arms while marching, raised when attacking.
    const wantAim = this.state === 'attack' ? 1 : 0;
    this.aimBlend = Utils.lerp(this.aimBlend, wantAim, Utils.damp(3, dt));
    const a = this.aimBlend;
    r.shoulderR.rotation.x = Utils.lerp(-0.45, -1.3, a);
    r.elbowR.rotation.x = Utils.lerp(-1.1, -0.3, a);
    r.shoulderR.rotation.z = Utils.lerp(0.25, 0.1, a);
    r.shoulderL.rotation.x = Utils.lerp(-0.6, -1.25, a);
    r.elbowL.rotation.x = Utils.lerp(-1.0, -0.45, a);
    r.shoulderL.rotation.z = Utils.lerp(-0.45, -0.5, a);
    // Keep the blaster pointing forward regardless of the arm pose.
    r.gun.rotation.x = -(r.shoulderR.rotation.x + r.elbowR.rotation.x);
    r.gun.rotation.z = -r.shoulderR.rotation.z;

    // Flinch: lean back and twist the head.
    const st = this.staggerT > 0 ? Math.sin((this.staggerT / 0.45) * Math.PI) : 0;
    r.torso.rotation.x = -st * 0.45;
    r.torso.rotation.z = st * 0.2 * this.staggerSide;
    r.neck.rotation.z = st * 0.5 * this.staggerSide;
  }

  _updateSpheres() {
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const p = this.pos;
    const set = (v, fx, y, fz) => v.set(p.x + fx * cy + fz * sy, y, p.z - fx * sy + fz * cy);
    set(this.spheres.head.c, 0, 1.76, 0.2);
    set(this.spheres.chest.c, 0, 1.36, 0);
    set(this.spheres.legs.c, 0, 0.72, 0);
    set(this.spheres.feet.c, 0, 0.25, 0.03);
    this.bound.c.set(p.x, 1.0, p.z);
  }

  /** Segment test against this droid. Returns {t, part} or null. */
  raycast(p0, p1) {
    if (Utils.segmentSphere(p0, p1, this.bound.c, this.bound.r) === null) return null;
    let best = null;
    for (const part in this.spheres) {
      const s = this.spheres[part];
      const t = Utils.segmentSphere(p0, p1, s.c, s.r);
      if (t !== null && (!best || t < best.t)) best = { t, part };
    }
    return best;
  }
}

/* -------------------------------------------------------------------------- */
/*  Wave director                                                             */
/* -------------------------------------------------------------------------- */

class DroidManager {
  /**
   * @param {object} world shared game context
   * @param {Array<{spawn:THREE.Vector3, gate:THREE.Vector3, dir:THREE.Vector3}>} gates
   */
  constructor(world, gates) {
    this.world = world;
    this.gates = gates;
    this.droids = [];
    this.debris = [];
    this.bubbles = [];
    this.bubbleTextures = new Map();
    this.maxAlive = world.lowQuality ? 10 : 16;
    this.reset();
  }

  reset() {
    for (const d of this.droids) this.world.scene.remove(d.root);
    for (const d of this.debris) this.world.scene.remove(d.obj);
    for (const b of this.bubbles) b.sprite.parent && b.sprite.parent.remove(b.sprite);
    this.droids = [];
    this.debris = [];
    this.bubbles = [];
    this.wave = 0;
    this.toSpawn = 0;
    this.remaining = 0;
    this.spawnTimer = 0;
    this.phase = 'intermission';
    this.phaseT = 2.5; // brief calm before wave 1
  }

  get aliveCount() { return this.droids.length; }

  /* --------------------------------------------------------------- waves */

  _startWave() {
    this.wave++;
    const count = 4 + this.wave * 2;
    this.toSpawn = count;
    this.remaining = count;
    this.commandersLeft = this.wave >= 2 ? Math.min(3, Math.floor(this.wave / 2)) : 0;
    this.spawnTimer = 0.5;
    this.phase = 'active';
    this.world.hud.setWave(this.wave, this.remaining);
    this.world.hud.message(`WAVE ${this.wave}`, `${count} battle droids inbound`, 2.6);
    GameAudio.waveHorn();
  }

  _spawnSquad() {
    const alive = this.droids.length;
    const size = Math.min(this.wave >= 4 ? 6 : 3, this.toSpawn, this.maxAlive - alive);
    if (size <= 0) return;

    // Prefer a gate that is far from the player so droids appear off-screen.
    const pp = this.world.player.pos;
    const sorted = [...this.gates].sort((a, b) => b.spawn.distanceTo(pp) - a.spawn.distanceTo(pp));
    const gate = sorted[Math.random() < 0.7 ? Utils.randInt(0, 1) : Utils.randInt(0, sorted.length - 1)];
    const perp = new THREE.Vector3(-gate.dir.z, 0, gate.dir.x);

    let leader = null;
    for (let i = 0; i < size; i++) {
      const row = Math.floor(i / 3), col = (i % 3) - 1;
      // Formation: rows of three, marching in step toward the gate.
      const spawn = gate.spawn.clone()
        .addScaledVector(perp, col * 1.3)
        .addScaledVector(gate.dir, -row * 1.7);
      const waypoint = gate.gate.clone()
        .addScaledVector(perp, col * 1.2)
        .addScaledVector(gate.dir, 3);
      const commander = i === 0 && this.commandersLeft > 0;
      if (commander) this.commandersLeft--;
      const droid = new BattleDroid(this, spawn, waypoint, commander);
      this.droids.push(droid);
      if (i === 0) leader = droid;
    }
    this.toSpawn -= size;

    // The classic acknowledgement as the squad moves out.
    const line = leader.commander ? Utils.pick(DROID_LINES.commander) : Utils.pick(DROID_LINES.squad);
    this.say(leader, line);
  }

  update(dt) {
    if (this.phase === 'intermission') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this._startWave();
    } else {
      this.spawnTimer -= dt;
      if (this.toSpawn > 0 && this.spawnTimer <= 0 && this.droids.length < this.maxAlive) {
        this._spawnSquad();
        this.spawnTimer = Math.max(2, Utils.rand(3.5, 5) - this.wave * 0.15);
      }
      if (this.toSpawn === 0 && this.droids.length === 0) {
        this.phase = 'intermission';
        this.phaseT = 5;
        this.world.onWaveCleared(this.wave);
      }
    }

    for (const d of this.droids) d.update(dt);
    this._updateDebris(dt);
    this._updateBubbles(dt);
  }

  /* ------------------------------------------------------------- combat */

  /** Nearest droid hit along a segment: {t, droid, part} or null. */
  raycast(p0, p1) {
    let best = null;
    for (const d of this.droids) {
      const hit = d.raycast(p0, p1);
      if (hit && (!best || hit.t < best.t)) best = { t: hit.t, part: hit.part, droid: d };
    }
    return best;
  }

  /** A player bolt struck a droid. */
  onBoltHit(droid, part, point) {
    const world = this.world;
    const dist = point.distanceTo(world.camera.position);
    world.effects.impact(point, 0x5ab4ff, 1);
    world.effects.sparks(point, 0xffc266, 5, 0.3);
    GameAudio.hitMetal(dist);

    const killed = droid.takeHit(part);
    if (killed) {
      this._destroy(droid, part === 'head');
    } else {
      world.hud.hitmarker(false);
      // The famous response to... everything.
      this.say(droid, Utils.pick(DROID_LINES.hit));
    }
  }

  _destroy(droid, headshot) {
    const world = this.world;
    droid.dead = true;
    this.droids.splice(this.droids.indexOf(droid), 1);
    this.remaining--;

    const pts = droid.points + (headshot ? 50 : 0);
    world.addScore(pts, headshot ? 'HEADSHOT' : droid.commander ? 'COMMANDER' : '');
    world.hud.hitmarker(true);
    world.hud.setWave(this.wave, this.remaining);

    const center = droid.spheres.chest.c.clone();
    world.effects.explosion(center);
    GameAudio.droidDestroyed(center.distanceTo(world.camera.position), this.panFor(droid.pos));
    if (Math.random() < 0.35) this.say(droid, Utils.pick(DROID_LINES.death), center);

    this._breakApart(droid, headshot);
  }

  /** Detaches limbs and lets them tumble with simple physics. */
  _breakApart(droid, headshot) {
    const scene = this.world.scene;
    const r = droid.rig;
    droid.root.updateMatrixWorld(true);
    const pieces = [r.neck, r.shoulderL, r.shoulderR, r.hipL, r.hipR, r.torso];
    const origin = droid.pos.clone();
    origin.y = 1;

    for (const obj of pieces) {
      scene.attach(obj); // keeps the current world transform
      const out = obj.getWorldPosition(new THREE.Vector3()).sub(origin).setY(0).normalize();
      const up = obj === r.neck && headshot ? 7 : Utils.rand(2, 4.5);
      this.debris.push({
        obj,
        vel: new THREE.Vector3(out.x * Utils.rand(1, 3), up, out.z * Utils.rand(1, 3)),
        spin: new THREE.Vector3(Utils.rand(-8, 8), Utils.rand(-8, 8), Utils.rand(-8, 8)),
        life: Utils.rand(3.5, 4.5),
      });
    }
    // Whatever remains (pelvis) just topples.
    this.debris.push({
      obj: droid.root, vel: new THREE.Vector3(0, 1, 0),
      spin: new THREE.Vector3(Utils.rand(-3, 3), 0, Utils.rand(-3, 3)), life: 4,
    });
  }

  _updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      const o = d.obj;
      d.vel.y -= 16 * dt;
      o.position.addScaledVector(d.vel, dt);
      o.rotation.x += d.spin.x * dt;
      o.rotation.y += d.spin.y * dt;
      o.rotation.z += d.spin.z * dt;
      // Bounce and settle on the ground.
      if (o.position.y < 0.08) {
        o.position.y = 0.08;
        d.vel.y *= -0.3;
        d.vel.x *= 0.5; d.vel.z *= 0.5;
        d.spin.multiplyScalar(0.5);
      }
      // Sink into the ground before being removed.
      if (d.life < 0.8) o.position.y -= dt * 0.4;
      if (d.life <= 0) {
        o.parent && o.parent.remove(o);
        this.debris.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------- speech bubbles */

  _bubbleTexture(text) {
    if (this.bubbleTextures.has(text)) return this.bubbleTextures.get(text);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.font = 'bold 54px "Share Tech Mono", monospace';
    const w = Math.min(500, g.measureText(text).width + 60);
    const x = (512 - w) / 2;
    g.fillStyle = 'rgba(20,16,10,0.78)';
    g.strokeStyle = 'rgba(230,190,110,0.95)';
    g.lineWidth = 5;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, 14, w, 88, 20); else g.rect(x, 14, w, 88);
    g.fill(); g.stroke();
    g.fillStyle = '#ffd98a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 60);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.bubbleTextures.set(text, tex);
    return tex;
  }

  /**
   * Shows a speech bubble above a droid and voices it.
   * @param {BattleDroid} droid
   * @param {string} text
   * @param {THREE.Vector3} [at] fixed world position (for destroyed droids)
   */
  say(droid, text, at) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._bubbleTexture(text), transparent: true, depthTest: false, depthWrite: false,
    }));
    sprite.scale.set(1.8, 0.45, 1);
    sprite.renderOrder = 10;
    this.world.scene.add(sprite);
    this.bubbles.push({ sprite, droid: at ? null : droid, at: at ? at.clone() : null, life: 1.8, rise: 0 });

    const dist = droid.pos.distanceTo(this.world.player.pos);
    if (!GameAudio.speak(text, dist)) GameAudio.droidChirp(dist, this.panFor(droid.pos));
  }

  _updateBubbles(dt) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life -= dt;
      b.rise += dt * 0.25;
      if (b.droid && !b.droid.dead) b.sprite.position.set(b.droid.pos.x, 2.3 + b.rise, b.droid.pos.z);
      else if (b.at) b.sprite.position.set(b.at.x, b.at.y + 0.8 + b.rise, b.at.z);
      b.sprite.material.opacity = Math.min(1, b.life * 2);
      if (b.life <= 0 || (b.droid && b.droid.dead)) {
        this.world.scene.remove(b.sprite);
        b.sprite.material.dispose();
        this.bubbles.splice(i, 1);
      }
    }
  }

  /** Stereo pan (-1..1) of a world position relative to the camera. */
  panFor(pos) {
    const cam = this.world.camera;
    const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z;
    const right = this.world.player.right;
    const len = Math.hypot(dx, dz) || 1;
    return ((dx * right.x + dz * right.z) / len) * 0.8;
  }
}

window.B1Model = B1Model;
window.BattleDroid = BattleDroid;
window.DroidManager = DroidManager;
