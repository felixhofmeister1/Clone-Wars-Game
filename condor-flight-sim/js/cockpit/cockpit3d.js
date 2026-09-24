/* =============================================================================
 * cockpit3d.js — The A330 flight deck from the captain's seat: windscreen and
 * side windows, glareshield with FCU and EFIS panels, main instrument panel
 * (PFD, ND, E/WD, ND, PFD) with the SD below, gear lever and autobrake,
 * pedestal with MCDUs, thrust levers (REV/IDLE/CL/FLX-MCT/TOGA), speed brake,
 * flaps lever and parking brake, and the captain's sidestick.
 *
 * Everything is clickable through a raycast: left click, right click and the
 * mouse wheel are passed to the control's handler.
 * Built in model axes (x fwd, y up, z right) relative to the design eye point.
 * ========================================================================== */
(function () {
  'use strict';
  const D2R = Math.PI / 180;
  const EYE = new THREE.Vector3(22.9, 1.38, -0.55); // captain's design eye point (model axes)

  function panelMat(color, rough = 0.8) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.1 }); }

  /** A flat panel with rectangular holes, as a mesh in its own XY plane. */
  function framePanel(w, h, holes, mat) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
    for (const pts of holes) {
      const p = new THREE.Path();
      pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
      s.holes.push(p);
    }
    return new THREE.Mesh(new THREE.ShapeGeometry(s), mat);
  }

  function labelTexture(lines, w = 256, h = 128, opts = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = opts.bg || '#46505a'; g.fillRect(0, 0, w, h);
    g.fillStyle = opts.fg || '#f0f0f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [text, x, y, px] of lines) { g.font = `600 ${px}px Arial, sans-serif`; g.fillText(text, x, y); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  class Cockpit3D {
    constructor(avionics) {
      this.av = avionics;
      this.group = new THREE.Group();
      this.group.name = 'cockpit';
      this.group.position.copy(EYE);
      this.interactive = [];
      this.anim = {};
      this.mats = {
        wall: panelMat(0x8795a3), panel: panelMat(0x6f7d8b), dark: panelMat(0x2c3137, 0.9), glare: panelMat(0x24282d, 0.95),
        floor: panelMat(0x2b3036), metal: new THREE.MeshStandardMaterial({ color: 0xb4b9bf, roughness: 0.3, metalness: 0.8 }),
        black: panelMat(0x0d0f11, 0.6), seat: panelMat(0x26313d, 0.9), handle: panelMat(0xdedede, 0.5),
      };
      this.build();
      this.light = new THREE.PointLight(0xffe2b8, 0, 3.5, 1.6);
      this.light.position.set(0.3, 0.35, 0.5);
      this.group.add(this.light);
    }

    screen(name, w, h, pos, rotX = 0, rotY = 0) {
      const mat = new THREE.MeshBasicMaterial({ map: this.av.texture(name), toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.copy(pos); m.rotation.order = 'YXZ'; m.rotation.y = rotY; m.rotation.x = rotX;
      // Bezel
      const bez = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, h + 0.03), this.mats.black);
      bez.position.set(0, 0, -0.003); m.add(bez);
      this.group.add(m);
      return m;
    }

    build() {
      const G = this.group, M = this.mats;
      // Screens face the pilot: in model axes the pilot looks along +x, so a plane
      // must face -x: rotate a default (+z facing) plane by -90° about Y.
      const faceAft = -Math.PI / 2;
      // ---------------- main instrument panel (sight lines checked from the design eye point)
      const mp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 2.6), M.panel);
      mp.position.set(0.84, -0.47, 0.55); mp.rotation.z = 15 * D2R; G.add(mp);
      const tilt = -15 * D2R; // screens tilted back toward the pilots
      const sy = -0.48, sx = 0.8;
      this.screens = {
        pfd: this.screen('pfd', 0.2, 0.2, new THREE.Vector3(sx, sy, -0.12), tilt, faceAft),
        nd: this.screen('nd', 0.2, 0.2, new THREE.Vector3(sx, sy, 0.12), tilt, faceAft),
        ewd: this.screen('ewd', 0.2, 0.2, new THREE.Vector3(sx, sy, 0.55), tilt, faceAft),
        nd2: this.screen('nd', 0.2, 0.2, new THREE.Vector3(sx, sy, 0.98), tilt, faceAft),
        pfd2: this.screen('pfd', 0.2, 0.2, new THREE.Vector3(sx, sy, 1.22), tilt, faceAft),
        sd: this.screen('sd', 0.19, 0.19, new THREE.Vector3(0.7, -0.71, 0.55), -38 * D2R, faceAft),
      };
      for (const k of ['pfd', 'nd', 'ewd', 'sd']) this.screens[k].userData.panel = k;
      this.screens.nd.userData.action = (b) => { this.av.efis.ndMode = this.av.efis.ndMode === 'ARC' ? 'ROSE' : 'ARC'; };
      this.interactive.push(this.screens.nd);

      // ---------------- glareshield, FCU, EFIS
      const gs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 2.7), M.glare);
      gs.position.set(0.84, -0.215, 0.55); G.add(gs);
      const gsFront = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 2.7), M.panel);
      gsFront.position.set(0.635, -0.233, 0.55); G.add(gsFront);
      const fcuH = 0.084, fcuW = fcuH * 1024 / 220;
      const fcu = new THREE.Mesh(new THREE.PlaneGeometry(fcuW, fcuH), new THREE.MeshBasicMaterial({ map: this.av.texture('fcu'), toneMapped: false }));
      fcu.position.set(0.618, -0.233, 0.55); fcu.rotation.y = faceAft;
      fcu.userData.panel = 'fcu';
      G.add(fcu); this.interactive.push(fcu);
      const efW = fcuH * 512 / 200;
      for (const z of [-0.12, 1.22]) {
        const ef = new THREE.Mesh(new THREE.PlaneGeometry(efW, fcuH), new THREE.MeshBasicMaterial({ map: this.av.texture('efis'), toneMapped: false }));
        ef.position.set(0.618, -0.233, z); ef.rotation.y = faceAft;
        ef.userData.panel = 'efis';
        G.add(ef); this.interactive.push(ef);
      }
      // Master warning / caution lights
      this.masterWarn = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.028), new THREE.MeshBasicMaterial({ color: 0x330000, toneMapped: false }));
      this.masterWarn.position.set(0.617, -0.214, -0.3); this.masterWarn.rotation.y = faceAft; G.add(this.masterWarn);
      this.masterCaut = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.028), new THREE.MeshBasicMaterial({ color: 0x331f00, toneMapped: false }));
      this.masterCaut.position.set(0.617, -0.25, -0.3); this.masterCaut.rotation.y = faceAft; G.add(this.masterCaut);
      this.masterWarn.userData.action = () => this.onMaster && this.onMaster();
      this.masterCaut.userData.action = () => this.onMaster && this.onMaster();
      this.interactive.push(this.masterWarn, this.masterCaut);

      // ---------------- windscreen & structure
      // Front windscreen frame: slanted plane in front of the pilots
      const ws = framePanel(3.0, 0.62, [
        [[-1.2, -0.25], [-0.02, -0.25], [-0.02, 0.27], [-1.05, 0.27]],
        [[0.08, -0.25], [1.25, -0.25], [1.1, 0.27], [0.08, 0.27]],
      ], M.dark);
      ws.material = M.dark.clone(); ws.material.side = THREE.DoubleSide;
      ws.position.set(1.0, 0.07, 0.53); ws.rotation.order = 'YXZ'; ws.rotation.y = faceAft; ws.rotation.x = 32 * D2R;
      G.add(ws);
      // Side walls with windows
      for (const side of [-1, 1]) {
        const z = side < 0 ? -0.95 : 2.05;
        const wall = framePanel(2.2, 1.2, [
          [[side < 0 ? 0.25 : -0.25, -0.12], [side < 0 ? 0.95 : -0.95, -0.1], [side < 0 ? 0.92 : -0.92, 0.3], [side < 0 ? 0.28 : -0.28, 0.32]],
          [[side < 0 ? -0.55 : 0.55, -0.08], [side < 0 ? 0.12 : -0.12, -0.1], [side < 0 ? 0.12 : -0.12, 0.28], [side < 0 ? -0.5 : 0.5, 0.26]],
        ], M.wall.clone());
        wall.material.side = THREE.DoubleSide;
        wall.position.set(0.1, 0.02, z); wall.rotation.y = side < 0 ? 0 : Math.PI;
        wall.rotation.x = side * 0; wall.rotation.z = 0;
        G.add(wall);
        // Sill / armrest console
        const con = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.28), M.panel);
        con.position.set(0.05, -0.52, side < 0 ? -0.78 : 1.88); G.add(con);
      }
      // Ceiling and overhead panel
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 3.1), M.wall);
      ceil.position.set(-0.2, 0.52, 0.55); G.add(ceil);
      const ovhTex = this.overheadTexture();
      const ovh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.9), [M.panel, M.panel, M.panel, new THREE.MeshStandardMaterial({ map: ovhTex, roughness: 0.8 }), M.panel, M.panel]);
      ovh.position.set(0.2, 0.44, 0.55); ovh.rotation.z = -18 * D2R; G.add(ovh);
      // Pillars
      for (const z of [-0.95, 0.53, 2.05]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), M.dark);
        p.position.set(0.93, 0.08, z); p.rotation.z = 32 * D2R; G.add(p);
      }
      // Floor
      const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 3.1), M.floor);
      floor.position.set(0.1, -1.05, 0.55); G.add(floor);
      // Lower panel (knee area)
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 2.7), M.panel);
      knee.position.set(0.9, -0.88, 0.55); G.add(knee);

      // ---------------- gear lever & autobrake on the centre panel
      const gearBase = new THREE.Group(); gearBase.position.set(0.815, -0.56, 0.79); G.add(gearBase);
      const glSlot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.035), M.black); gearBase.add(glSlot);
      const gearHandle = new THREE.Group(); gearBase.add(gearHandle);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 16), M.handle);
      knob.rotation.z = Math.PI / 2; knob.position.set(-0.05, 0, 0); gearHandle.add(knob);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), M.metal); stem.position.x = -0.025; gearHandle.add(stem);
      this.anim.gear = gearHandle;
      knob.userData.action = () => this.onControl && this.onControl('gear');
      this.interactive.push(knob);
      const gearLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: labelTexture([['L/G', 128, 64, 70]]) }));
      gearLbl.position.set(0.8, -0.455, 0.79); gearLbl.rotation.y = faceAft; G.add(gearLbl);
      // Gear indicator lights (3 green UNLK/▼)
      this.gearLights = [];
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.012), new THREE.MeshBasicMaterial({ color: 0x0a2a10, toneMapped: false }));
        l.position.set(0.814, -0.63, 0.73 + i * 0.022); l.rotation.y = faceAft; G.add(l); this.gearLights.push(l);
      }
      // Autobrake pushbuttons
      this.abButtons = [];
      ['LO', 'MED', 'MAX'].forEach((lbl, i) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.034), new THREE.MeshStandardMaterial({ map: labelTexture([[lbl, 128, 80, 64], ['', 0, 0, 1]], 256, 256, { bg: '#2a2f35' }), roughness: 0.6 }));
        b.position.set(0.81, -0.52 - i * 0.034, 0.7); G.add(b);
        const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.005), new THREE.MeshBasicMaterial({ color: 0x0a2a10, toneMapped: false }));
        ind.position.set(-0.007, 0.008, 0); ind.rotation.y = faceAft; b.add(ind);
        b.userData.action = () => this.onControl && this.onControl('autobrake', i + 1);
        this.interactive.push(b); this.abButtons.push(ind);
      });

      // ---------------- pedestal
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.5), M.panel);
      ped.position.set(0.2, -0.93, 0.55); G.add(ped);
      const pedTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.5), new THREE.MeshStandardMaterial({ map: this.pedestalTexture(), roughness: 0.85 }));
      pedTop.position.set(0.2, -0.675, 0.55); G.add(pedTop);
      // MCDUs
      for (const z of [0.43, 0.67]) {
        const md = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.086), new THREE.MeshBasicMaterial({ map: this.av.texture('mcdu'), toneMapped: false }));
        md.position.set(0.66, -0.68, z); md.rotation.order = 'YXZ'; md.rotation.y = faceAft; md.rotation.x = -62 * D2R;
        md.userData.action = () => { this.av.mcduPage = this.av.mcduPage === 'FPLN' ? 'PROG' : 'FPLN'; };
        G.add(md); this.interactive.push(md);
      }
      // Thrust levers
      this.anim.thr = [];
      for (const z of [0.51, 0.59]) {
        const piv = new THREE.Group(); piv.position.set(0.12, -0.7, z); G.add(piv);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.025), M.metal); arm.position.y = 0.1; piv.add(arm);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.07), M.handle); grip.position.y = 0.2; piv.add(grip);
        grip.userData.action = (btn, wheel) => this.onControl && this.onControl('thrust', wheel ? -Math.sign(wheel) : btn === 2 ? -1 : 1);
        arm.userData.action = grip.userData.action;
        this.interactive.push(grip, arm);
        this.anim.thr.push(piv);
      }
      // Speed brake (left of the thrust levers)
      const sbPiv = new THREE.Group(); sbPiv.position.set(0.2, -0.68, 0.36); G.add(sbPiv);
      const sbArm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.1, 0.015), M.metal); sbArm.position.y = 0.05; sbPiv.add(sbArm);
      const sbGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.03), M.handle); sbGrip.position.y = 0.1; sbPiv.add(sbGrip);
      sbGrip.userData.action = (btn, wheel) => this.onControl && this.onControl('speedbrake', wheel ? -Math.sign(wheel) : btn === 2 ? -1 : 1);
      this.interactive.push(sbGrip); this.anim.sb = sbPiv;
      // Flaps lever (right of the thrust levers)
      const flPiv = new THREE.Group(); flPiv.position.set(0.22, -0.68, 0.75); G.add(flPiv);
      const flArm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.1, 0.015), M.metal); flArm.position.y = 0.05; flPiv.add(flArm);
      const flGrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.06), M.handle); flGrip.position.y = 0.1; flPiv.add(flGrip);
      flGrip.userData.action = (btn, wheel) => this.onControl && this.onControl('flaps', wheel ? -Math.sign(wheel) : btn === 2 ? -1 : 1);
      this.interactive.push(flGrip); this.anim.flaps = flPiv;
      // Parking brake handle
      const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.5 }));
      pb.position.set(-0.2, -0.66, 0.55); G.add(pb);
      pb.userData.action = () => this.onControl && this.onControl('parkbrake');
      this.interactive.push(pb); this.anim.pb = pb;

      // ---------------- sidestick (captain, left console)
      const ss = new THREE.Group(); ss.position.set(0.12, -0.46, -0.72); G.add(ss);
      const ssBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.02, 16), M.black); ss.add(ssBase);
      const stick = new THREE.Group(); ss.add(stick);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 10), M.black); shaft.position.y = 0.05; stick.add(shaft);
      const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.06, 4, 10), M.black); grip.position.y = 0.13; grip.rotation.z = 0.2; stick.add(grip);
      const trig = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.012), new THREE.MeshStandardMaterial({ color: 0xa81c1c })); trig.position.set(0.02, 0.17, 0); stick.add(trig);
      this.anim.stick = stick;
      // F/O seat (visible to the right)
      const seat = new THREE.Group(); seat.position.set(-0.45, -0.75, 1.1); G.add(seat);
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), M.seat); seat.add(cushion);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.5), M.seat); back.position.set(-0.25, 0.4, 0); seat.add(back);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), M.seat); head.position.set(-0.26, 0.86, 0); seat.add(head);
    }

    overheadTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#4b5661'; g.fillRect(0, 0, 512, 512);
      let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let px = 0; px < 6; px++) for (let py = 0; py < 5; py++) {
        const x = 12 + px * 83, y = 12 + py * 100;
        g.strokeStyle = '#6d7984'; g.lineWidth = 2; g.strokeRect(x, y, 76, 92);
        for (let k = 0; k < 6; k++) {
          const bx = x + 8 + (k % 3) * 22, by = y + 14 + Math.floor(k / 3) * 38;
          g.fillStyle = '#1e2429'; g.fillRect(bx, by, 18, 24);
          if (r() > 0.75) { g.fillStyle = r() > 0.5 ? '#2fcc57' : '#ffffff'; g.fillRect(bx + 3, by + 4, 12, 3); }
        }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }

    pedestalTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#4b5661'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#e8e8e8'; g.font = '600 18px Arial'; g.textAlign = 'center';
      const marks = [['TOGA', 60], ['FLX MCT', 110], ['CL', 170], ['IDLE', 250], ['REV', 330]];
      for (const [m, x] of marks) g.fillText(m, x + 60, 60);
      g.fillText('SPEED BRAKE', 130, 230); g.fillText('FLAPS', 380, 230);
      g.fillText('0  1  2  3  FULL', 380, 200);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }

    /** Animate levers/lights from the aircraft state. */
    update(ac, fm, night) {
      const c = ac.controls;
      const thrAng = (v) => (v >= 0 ? -v * 38 : -v * -22) * D2R; // forward = toward +x (rotate about z negative)
      for (const p of this.anim.thr) p.rotation.z = thrAng(c.throttle);
      this.anim.sb.rotation.z = c.speedbrake * 35 * D2R;
      this.anim.flaps.rotation.z = (c.flapLever / 4) * 40 * D2R;
      this.anim.gear.position.y = c.gearDown ? -0.045 : 0.045;
      this.anim.pb.rotation.y = c.parkingBrake ? Math.PI / 2 : 0;
      this.anim.stick.rotation.z = -c.pitch * 16 * D2R;
      this.anim.stick.rotation.x = c.roll * 16 * D2R;
      const down = ac.gearPos > 0.99, transit = ac.gearPos > 0.01 && !down;
      for (const l of this.gearLights) l.material.color.setHex(down ? 0x28ff5a : transit ? 0xff2020 : 0x0a2a10);
      this.abButtons.forEach((b, i) => b.material.color.setHex(c.autobrake === i + 1 ? (ac.autobrakeActive ? 0x28ff5a : 0x28c8ff) : 0x0a2a10));
      const warn = fm.stallWarn || fm.overspeedWarn || (fm.gpws === 'PULL UP') || (fm.apOffWarn && performance.now() - fm.apOffWarn < 3000) || fm.configWarning;
      const flash = (performance.now() % 600) < 350;
      this.masterWarn.material.color.setHex(warn && flash ? 0xff2020 : 0x300000);
      const caut = fm.gpws && fm.gpws !== 'PULL UP' || (fm.athrOffWarn && performance.now() - fm.athrOffWarn < 3000);
      this.masterCaut.material.color.setHex(caut ? 0xffa010 : 0x301c00);
      this.light.intensity = night * 1.6;
    }
  }

  window.Cockpit3D = Cockpit3D;
  window.COCKPIT_EYE = EYE;
})();
