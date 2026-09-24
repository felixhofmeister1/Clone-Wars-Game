/* =============================================================================
 * entity.js - The thing in the drywall.
 *
 * It moves through walls and hunts by sound alone. If it hears you it heads
 * for where you were, stops to listen, then drifts away. It only takes you if
 * it is right beside you AND can still hear you, so standing still and holding
 * your breath lets it pass.
 * ========================================================================== */

class DrywallEntity {
  constructor(scene, world) {
    this.world = world;
    this.wanderSpeed = 1.1;
    this.huntSpeed = 1.9;       // Slower than a walking player, but it cuts through walls.
    this.catchRadius = 1.25;
    this.stopShort = 1.0;       // Stops this far from where it heard you, then listens.
    this.listenTime = 1.6;
    this.retreatTime = 3;       // Deaf while retreating, so a quiet exhale afterwards is safe.
    this.mesh = this._build();
    scene.add(this.mesh);
    this.target = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.state = 'dormant';     // dormant | waking | wander | hunt | listen | retreat
    this.pos.copy(World.tileCenter(5, 6));
    this.target.copy(this.pos);
    this.timer = 0;
    this.freeze = 0;
    this.t = 0;
    this.mesh.visible = false;
    this.mesh.position.copy(this.pos);
  }

  get active() { return this.state !== 'dormant'; }

  /** How loudly it scrapes through the drywall (0..1), for the positional scratching loop. */
  get activity() {
    return { dormant: 0, waking: 0.5, wander: 0.35, hunt: 0.85, listen: 0.12, retreat: 0.6 }[this.state];
  }

  wake(delay = 4) {
    if (this.state !== 'dormant') return;
    this.state = 'waking';
    this.timer = delay;
    this.mesh.visible = true;
  }

  /** A loud event (a gasp) reaches it even while retreating. */
  hear(point, radius) {
    if (!this.active || this.state === 'waking') return;
    if (Math.hypot(point.x - this.pos.x, point.z - this.pos.z) > radius) return;
    this.state = 'hunt';
    this.target.set(point.x, 0, point.z);
  }

  /** Being caught in the flashlight makes it stop dead for a moment. */
  startle() { this.freeze = 0.8; }

  /** Returns true when it has taken the player. */
  update(dt, playerPos, noiseRadius) {
    if (this.state === 'dormant') return false;
    this.t += dt;
    const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);

    const deaf = this.state === 'waking' || this.state === 'retreat';
    if (!deaf && d < noiseRadius) {
      this.state = 'hunt';
      this.target.set(playerPos.x, 0, playerPos.z);
    }
    if (!deaf && d < this.catchRadius && d < noiseRadius) return true;

    if (this.freeze > 0) {
      this.freeze -= dt;
    } else {
      switch (this.state) {
        case 'waking':
          this.timer -= dt;
          if (this.timer <= 0) this._wander(playerPos);
          break;
        case 'wander':
          if (this._stepToward(this.wanderSpeed, dt) < 0.3) this._wander(playerPos);
          break;
        case 'hunt':
          if (this._stepToward(this.huntSpeed, dt) < this.stopShort) { this.state = 'listen'; this.timer = this.listenTime; }
          break;
        case 'listen':
          this.timer -= dt;
          if (this.timer <= 0) {
            this.state = 'retreat';
            this.timer = this.retreatTime;
            this.target.copy(this.world.randomFloorPoint(playerPos, 9));
          }
          break;
        case 'retreat':
          this._stepToward(this.huntSpeed, dt);
          this.timer -= dt;
          if (this.timer <= 0) this._wander(playerPos);
          break;
      }
    }
    this._animate(dt);
    return false;
  }

  /** Inside a wall it is hidden by the drywall itself; out in a room the flashlight can find it. */
  get insideWall() { return this.world.isSolidAt(this.pos.x, this.pos.z); }

  _wander(playerPos) {
    this.state = 'wander';
    // Half the time it prowls close to where you are; it still only hunts what it hears.
    const prowl = Math.random() < 0.55;
    this.target.copy(prowl ? this.world.randomFloorPoint(playerPos, 3, 9) : this.world.randomFloorPoint(playerPos, 6));
  }

  _stepToward(speed, dt) {
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-3) {
      const step = Math.min(dist, speed * dt);
      this.pos.x += (dx / dist) * step;
      this.pos.z += (dz / dist) * step;
      this.heading = Math.atan2(dx, dz);
    }
    return dist;
  }

  _animate(dt) {
    const m = this.mesh;
    m.position.set(this.pos.x, Math.sin(this.t * 2.1) * 0.02, this.pos.z);
    if (this.heading !== undefined) {
      // Turn slowly, like something that does not need to see.
      let diff = this.heading - m.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      m.rotation.y += diff * Math.min(1, dt * 3);
    }
    m.rotation.z = Math.sin(this.t * 1.3) * 0.04;
    // The head twitches at irregular intervals.
    const twitch = Perlin.noise1D(this.t * 1.7 + 40);
    this.head.rotation.z = twitch > 0.35 ? 0.5 : twitch < -0.4 ? -0.35 : 0.08;
    this.head.rotation.x = 0.25 + Perlin.noise1D(this.t * 0.9) * 0.2;
  }

  /** Faces the camera from arm's length: the last thing you see. */
  lunge(camera) {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    this.mesh.visible = true;
    // Far enough that the whole stooped shape reads, head just above eye level.
    this.mesh.position.set(camera.position.x + fwd.x * 1.05, -0.45, camera.position.z + fwd.z * 1.05);
    this.mesh.rotation.set(0, Math.atan2(-fwd.x, -fwd.z), 0);
    this.head.rotation.set(0.1, 0, 0.45);
  }

  _build() {
    // Its skin is the drywall itself: taped seams and screw dimples where a face should be smooth.
    const skin = new THREE.MeshStandardMaterial({ map: this.world.mats.wall.map, color: 0xd6cebd, roughness: 0.95 });
    const g = new THREE.Group();
    const part = (geo, x, y, z, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, skin);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    part(new THREE.CylinderGeometry(0.12, 0.16, 0.95, 8), 0, 1.45, 0, 0.12);   // torso, stooped
    part(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 8), 0, 0.92, 0);          // hips
    part(new THREE.CylinderGeometry(0.05, 0.035, 0.95, 6), -0.08, 0.45, 0);     // legs
    part(new THREE.CylinderGeometry(0.05, 0.035, 0.95, 6), 0.08, 0.45, 0);
    part(new THREE.CylinderGeometry(0.035, 0.03, 1.4, 6), -0.24, 1.22, 0.05, 0.1, 0.12); // arms, too long
    part(new THREE.CylinderGeometry(0.035, 0.03, 1.4, 6), 0.24, 1.22, 0.05, 0.1, -0.12);
    part(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 6), 0, 2.0, 0.07, 0.35); // neck
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin);
    head.scale.set(0.82, 1.3, 0.92);
    head.position.set(0, 2.2, 0.12);
    head.castShadow = true;
    g.add(head);
    this.head = head;
    // Sunken eye sockets and a mouth that hangs open too far.
    const hollow = new THREE.MeshBasicMaterial({ color: 0x050403 });
    const feature = (r, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), hollow);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      head.add(m);
    };
    feature(0.032, -0.055, 0.035, 0.118, 1, 1.2, 0.6);
    feature(0.032, 0.055, 0.035, 0.118, 1, 1.2, 0.6);
    feature(0.03, 0, -0.07, 0.122, 1.1, 2.4, 0.55);
    return g;
  }
}
