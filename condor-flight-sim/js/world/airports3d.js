/* =============================================================================
 * airports3d.js — Runways drawn at their surveyed positions on top of the
 * satellite imagery: asphalt with ICAO markings rendered procedurally in a
 * shader (threshold piano keys, designators, touchdown zone, aiming point,
 * centreline, edge stripes), runway/threshold/TDZ/approach lights with the
 * sequenced-flasher "rabbit", and working PAPI lights.
 * ========================================================================== */
(function () {
  'use strict';
  const { D2R, R2D, FT, clamp } = Geo;
  const GLYPHS = '0123456789LCR';

  let glyphTex = null;
  function glyphTexture() {
    if (glyphTex) return glyphTex;
    const cw = 96, ch = 192;
    const c = document.createElement('canvas'); c.width = cw * GLYPHS.length; c.height = ch;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${ch * 0.98}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`;
    for (let i = 0; i < GLYPHS.length; i++) {
      g.save();
      g.translate(i * cw + cw / 2, ch / 2 + ch * 0.04);
      g.scale(0.62, 1);
      g.fillText(GLYPHS[i], 0, 0);
      g.restore();
    }
    glyphTex = new THREE.CanvasTexture(c);
    glyphTex.generateMipmaps = true;
    glyphTex.minFilter = THREE.LinearMipmapLinearFilter;
    glyphTex.anisotropy = 8;
    return glyphTex;
  }

  const runwayVS = `
    varying vec2 vRw; varying vec3 vWorld;
    attribute vec2 rw;
    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vRw = rw;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }`;
  const runwayFS = `
    uniform float L, W, dispA, dispB; uniform vec4 desA, desB; uniform sampler2D glyphs; uniform vec3 tint;
    varying vec2 vRw;
    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>
    float box(vec2 p, vec2 c, vec2 hs) {
      vec2 d = abs(p - c) - hs; float dist = max(d.x, d.y);
      float aa = max(fwidth(dist), 0.02);
      return 1.0 - smoothstep(-aa, aa, dist);
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float glyph(float idx, vec2 g) {
      if (idx < 0.0 || g.x < 0.0 || g.x > 1.0 || g.y < 0.0 || g.y > 1.0) return 0.0;
      return texture2D(glyphs, vec2((idx + g.x) / 13.0, g.y)).r;
    }
    // Markings for one runway end in its own frame: a = metres from threshold, c = metres right of centreline.
    float endMarks(float a, float c, vec4 des) {
      float m = 0.0;
      float hw = W * 0.5;
      // Threshold piano keys (6..36 m): 1.8 m stripes with 1.8 m gaps, wider central gap
      if (a > 6.0 && a < 36.0) {
        float n = W >= 59.0 ? 8.0 : 6.0;
        float ac = abs(c) - 1.8;
        if (ac > 0.0) {
          float k = floor(ac / 3.6);
          float f = ac - k * 3.6;
          if (k < n) m = max(m, box(vec2(f, a), vec2(0.9 + 0.45, 21.0), vec2(0.9, 15.0)));
        }
      }
      // Designator: letter 48..57 m, number 60..69 m
      float hasL = des.z;
      float nb = hasL >= 0.0 ? 60.0 : 48.0;
      if (hasL >= 0.0) m = max(m, glyph(hasL, vec2((c + 2.5) / 5.0, (a - 48.0) / 9.0)));
      if (des.x >= 0.0) {
        if (des.y >= 0.0) {
          m = max(m, glyph(des.x, vec2((c + 5.6) / 5.0, (a - nb) / 9.0)));
          m = max(m, glyph(des.y, vec2((c - 0.6) / 5.0, (a - nb) / 9.0)));
        } else m = max(m, glyph(des.x, vec2((c + 2.5) / 5.0, (a - nb) / 9.0)));
      }
      // Aiming point (300..350 m)
      float inner = W >= 59.0 ? 10.0 : 9.0;
      m = max(m, box(vec2(abs(c), a), vec2(inner + 4.0, 325.0), vec2(4.0, 25.0)));
      // Touchdown zone bars
      for (int i = 0; i < 6; i++) {
        float d = 150.0 + float(i) * 150.0;
        if (i == 1) continue;
        float bars = i == 0 ? 3.0 : (i < 4 ? 2.0 : 1.0);
        float ac2 = abs(c) - inner;
        if (ac2 > 0.0 && ac2 < bars * 3.0) {
          float f = mod(ac2, 3.0);
          m = max(m, box(vec2(f, a), vec2(0.9, d + 11.25), vec2(0.9, 11.25)));
        }
      }
      return m;
    }
    void main() {
      #include <logdepthbuf_fragment>
      float u = vRw.x, v = vRw.y;
      float hw = W * 0.5;
      float n = hash(floor(vec2(u * 2.0, v * 2.0)));
      float n2 = hash(floor(vec2(u * 0.25, v * 0.08)));
      vec3 asphalt = vec3(0.23, 0.23, 0.235) * (0.92 + 0.08 * n) * (0.94 + 0.1 * n2);
      vec3 col = asphalt;
      // Rubber deposits in the touchdown zones
      float rub = smoothstep(hw * 0.55, 0.0, abs(u)) * (smoothstep(150.0, 400.0, v - dispA) * smoothstep(1100.0, 600.0, v - dispA) + smoothstep(150.0, 400.0, L - v - dispB) * smoothstep(1100.0, 600.0, L - v - dispB));
      col *= 1.0 - 0.45 * rub * (0.7 + 0.3 * n);
      float paint = 0.0;
      if (abs(u) > hw) col = vec3(0.30, 0.29, 0.27) * (0.9 + 0.1 * n);         // shoulders
      if (v < 0.0 || v > L) {                                                     // blast pads with chevrons
        col = vec3(0.26, 0.26, 0.25) * (0.9 + 0.1 * n);
        float a = v < 0.0 ? -v : v - L;
        float ch = fract((a + abs(u) * 0.8) / 30.0);
        if (abs(u) < hw && ch < 0.1) col = mix(col, vec3(0.85, 0.66, 0.1), 0.9);
      } else if (abs(u) <= hw) {
        paint = max(paint, endMarks(v - dispA, u, desA));
        paint = max(paint, endMarks(L - v - dispB, -u, desB));
        // Displaced threshold bars
        if (dispA > 1.0) paint = max(paint, box(vec2(u, v), vec2(0.0, dispA - 1.5), vec2(hw, 1.5)));
        if (dispB > 1.0) paint = max(paint, box(vec2(u, v), vec2(0.0, L - dispB + 1.5), vec2(hw, 1.5)));
        // Centreline 30 m dash / 20 m gap between the designators
        if (v > dispA + 80.0 && v < L - dispB - 80.0) {
          float ph = mod(v - dispA - 80.0, 50.0);
          paint = max(paint, box(vec2(u, ph), vec2(0.0, 15.0), vec2(0.45, 15.0)));
        }
        // Edge stripes
        paint = max(paint, box(vec2(abs(u), v), vec2(hw - 0.45, L * 0.5), vec2(0.45, L * 0.5)));
      }
      col = mix(col, vec3(0.86, 0.86, 0.84), paint * 0.95);
      gl_FragColor = vec4(col * tint, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`;

  const lightVS = `
    attribute vec3 color; attribute float size; attribute vec3 ldir;
    uniform float pxScale, night, flash;
    varying vec3 vColor; varying float vA;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = max(-mv.z, 1.0);
      float vis = 1.0;
      if (dot(ldir, ldir) > 0.1) {
        // Directional light: compare in view space (camera at the origin).
        vec3 toCam = normalize(-mv.xyz);
        vis = smoothstep(-0.05, 0.35, dot(toCam, normalize(normalMatrix * ldir)));
      }
      float px = size * pxScale / d;
      gl_PointSize = clamp(px * (0.6 + 1.6 * night), 1.6 + night * 1.2, 26.0);
      vA = vis * mix(0.3, 1.0, night) * clamp(px * 0.9 + 0.55, 0.0, 1.0);
      vColor = color;
      #include <logdepthbuf_vertex>
    }`;
  const lightFS = `
    varying vec3 vColor; varying float vA;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = gl_PointCoord - 0.5;
      float r = length(p) * 2.0;
      float core = smoothstep(1.0, 0.0, r);
      float a = (pow(core, 3.0) + 0.35 * core) * vA;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor * a, a);
    }`;

  const COL = { white: [1, 0.93, 0.8], yellow: [1, 0.8, 0.35], green: [0.3, 1, 0.45], red: [1, 0.15, 0.1], blue: [0.3, 0.45, 1] };

  class Airports3D {
    constructor(renderer) {
      this.renderer = renderer;
      this.group = new THREE.Group();
      this.group.name = 'airports';
      this.built = new Map();
      this.airports = [];
      this.tint = new THREE.Color(1, 1, 1);
      this.lightUniforms = { pxScale: { value: 800 }, night: { value: 0 }, flash: { value: 0 } };
      this.t = 0;
    }
    setAirports(list) { this.airports = list; }

    build(ap) {
      const A = Geo.llaToEcef(ap.lat, ap.lon, ap.elev * FT);
      const B = WorldFrame.enuBasis(ap.lat, ap.lon);
      const toLocal = (lat, lon, h) => {
        const e = Geo.llaToEcef(lat, lon, h);
        const d = [e[0] - A[0], e[1] - A[1], e[2] - A[2]];
        return [B[0] * d[0] + B[3] * d[1] + B[6] * d[2], B[1] * d[0] + B[4] * d[1] + B[7] * d[2], B[2] * d[0] + B[5] * d[1] + B[8] * d[2]];
      };
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      const papis = [], rabbits = [];
      const lights = { pos: [], col: [], size: [], dir: [] };
      const addLight = (p, c, s, dir = [0, 0, 0]) => { lights.pos.push(...p); lights.col.push(...c); lights.size.push(s); lights.dir.push(...dir); };

      for (const rw of ap.runways) {
        const [ea, eb] = rw.ends;
        const hdg = Geo.bearing(ea.lat, ea.lon, eb.lat, eb.lon);
        const L = Geo.distance(ea.lat, ea.lon, eb.lat, eb.lon);
        const W = rw.width;
        const hA = (isFinite(ea.elev) ? ea.elev : ap.elev) * FT, hB = (isFinite(eb.elev) ? eb.elev : ap.elev) * FT;
        const pt = (along, across, lift = 0.3) => {
          const p = Geo.destination(ea.lat, ea.lon, hdg, along);
          const q = across ? Geo.destination(p.lat, p.lon, hdg + 90, across) : p;
          const f = clamp(along / L, 0, 1);
          return toLocal(q.lat, q.lon, hA + (hB - hA) * f + lift);
        };
        // ---- surface mesh (with 60 m blast pads and 7.5 m shoulders)
        const ext = 60, sh = 7.5;
        const segs = Math.max(4, Math.ceil((L + 2 * ext) / 120));
        const pos = [], rwc = [], idx = [];
        const across = [-W / 2 - sh, W / 2 + sh];
        for (let k = 0; k <= segs; k++) {
          const along = -ext + (L + 2 * ext) * (k / segs);
          for (const c of across) { pos.push(...pt(along, c)); rwc.push(c, along); }
        }
        for (let k = 0; k < segs; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('rw', new THREE.Float32BufferAttribute(rwc, 2));
        geo.setIndex(idx);
        geo.computeBoundingSphere();
        const des = (id) => {
          const m = /^(\d{1,2})([LCR]?)$/.exec(id) || [null, id.replace(/\D/g, '') || '0', ''];
          const num = m[1], letter = m[2];
          const d1 = num.length === 2 ? GLYPHS.indexOf(num[0]) : GLYPHS.indexOf(num[0]);
          const d2 = num.length === 2 ? GLYPHS.indexOf(num[1]) : -1;
          return new THREE.Vector4(d1, d2, letter ? GLYPHS.indexOf(letter) : -1, 0);
        };
        const mat = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
            L: { value: L }, W: { value: W }, dispA: { value: ea.disp || 0 }, dispB: { value: eb.disp || 0 },
            desA: { value: des(ea.id) }, desB: { value: des(eb.id) }, glyphs: { value: null }, tint: { value: this.tint },
          }]),
          vertexShader: runwayVS, fragmentShader: runwayFS, fog: true, side: THREE.DoubleSide,
        });
        mat.uniforms.glyphs.value = glyphTexture();
        mat.uniforms.tint.value = this.tint;
        mat.extensions = { derivatives: true };
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 1;
        g.add(mesh);

        // ---- lights
        const up = 0.8;
        const dirAB = (() => { const a = pt(0, 0), b = pt(100, 0); const d = [b[0] - a[0], 0, b[2] - a[2]]; const l = Math.hypot(d[0], d[2]); return [d[0] / l, 0, d[2] / l]; })();
        const dirBA = [-dirAB[0], 0, -dirAB[2]];
        for (let a = 0; a <= L; a += 60) {
          const col = a < 600 || a > L - 600 ? COL.yellow : COL.white;
          addLight(pt(a, -W / 2 - 1.5, up), a < 600 ? COL.white : col, 1.1);
          addLight(pt(a, W / 2 + 1.5, up), a > L - 600 ? COL.white : col, 1.1);
        }
        for (let a = 15; a < L; a += 30) {
          const toB = L - a, toA = a;
          const cA = toB < 300 ? COL.red : toB < 900 && Math.floor(a / 30) % 2 ? COL.red : COL.white;
          const cB = toA < 300 ? COL.red : toA < 900 && Math.floor(a / 30) % 2 ? COL.red : COL.white;
          addLight(pt(a, 0, 0.35), cA, 0.8, dirBA);
          addLight(pt(a, 0, 0.35), cB, 0.8, dirAB);
        }
        const endLights = (thrAlong, dirIn, dirOut) => {
          for (let c = -W / 2; c <= W / 2 + 0.1; c += 3) {
            addLight(pt(thrAlong, c, up), COL.green, 1.0, dirOut);   // green: seen on approach
            addLight(pt(thrAlong, c, up), COL.red, 1.0, dirIn);      // red: runway end, seen from the runway
          }
        };
        endLights(ea.disp || 0, dirBA, dirAB.map((v) => -v));
        endLights(L - (eb.disp || 0), dirAB, dirBA.map((v) => -v));
        // Touchdown zone, approach lights, rabbit and PAPI for each end
        for (const [end, sgn] of [[ea, 1], [eb, -1]]) {
          const thr = sgn > 0 ? (end.disp || 0) : L - (end.disp || 0);
          const toApp = sgn > 0 ? dirBA : dirAB; // direction lights face (toward approaching aircraft)
          for (let a = 60; a <= 900; a += 30) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
            addLight(pt(thr + sgn * a, s * (9 + k * 1.5), 0.35), COL.white, 0.7, toApp);
          }
          for (let a = 60; a <= 900; a += 30) {
            for (let k = -2; k <= 2; k++) addLight(pt(thr - sgn * a, k * 1.0, 1.5 + a * 0.004), COL.white, 1.2, toApp);
            if (a === 300) for (let k = -15; k <= 15; k += 1.5) addLight(pt(thr - sgn * a, k, 1.5 + a * 0.004), COL.white, 1.2, toApp);
          }
          rabbits.push({ pts: Array.from({ length: 30 }, (_, i) => pt(thr - sgn * (900 - i * 30), 0, 2.5 + (900 - i * 30) * 0.004)), dir: toApp });
          // PAPI: 4 units on the left, abeam the glide path origin (300 m)
          const baseAlong = thr + sgn * 300;
          const side = -sgn;
          const units = [];
          for (let i = 0; i < 4; i++) units.push({ p: pt(baseAlong, side * (W / 2 + 15 + i * 9), 0.9), angle: [2.5, 2.83, 3.17, 3.5][i] });
          papis.push({ units, toApp, idx: 0 });
        }
      }

      // Static lights
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lights.pos, 3));
      lg.setAttribute('color', new THREE.Float32BufferAttribute(lights.col, 3));
      lg.setAttribute('size', new THREE.Float32BufferAttribute(lights.size, 1));
      lg.setAttribute('ldir', new THREE.Float32BufferAttribute(lights.dir, 3));
      const lightMat = new THREE.ShaderMaterial({ uniforms: this.lightUniforms, vertexShader: lightVS, fragmentShader: lightFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(lg, lightMat);
      pts.renderOrder = 5; pts.frustumCulled = false;
      g.add(pts);

      // Dynamic lights: PAPI + rabbit
      const nPapi = papis.length * 4, nRab = rabbits.length * 2;
      const dg = new THREE.BufferGeometry();
      const dpos = new Float32Array((nPapi + nRab) * 3), dcol = new Float32Array((nPapi + nRab) * 3), dsize = new Float32Array(nPapi + nRab), ddir = new Float32Array((nPapi + nRab) * 3);
      let k = 0;
      for (const p of papis) for (const u of p.units) { dpos.set(u.p, k * 3); dsize[k] = 2.2; ddir.set(p.toApp, k * 3); u.k = k++; }
      for (const r of rabbits) { r.k = k; for (let i = 0; i < 2; i++) { dsize[k] = 2.6; ddir.set(r.dir, k * 3); dcol.set([0, 0, 0], k * 3); k++; } }
      dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
      dg.setAttribute('color', new THREE.BufferAttribute(dcol, 3));
      dg.setAttribute('size', new THREE.BufferAttribute(dsize, 1));
      dg.setAttribute('ldir', new THREE.BufferAttribute(ddir, 3));
      const dpts = new THREE.Points(dg, lightMat);
      dpts.renderOrder = 6; dpts.frustumCulled = false;
      g.add(dpts);

      this.group.add(g);
      const rec = { ap, g, A, B, papis, rabbits, dg };
      this.built.set(ap.icao, rec);
      return rec;
    }

    dispose(rec) {
      this.group.remove(rec.g);
      rec.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== this.sharedLightMat) o.material.dispose?.(); });
      this.built.delete(rec.ap.icao);
    }

    /**
     * @param camLat/camLon  camera position
     * @param frame          WorldFrame
     * @param camPos         camera position in render coordinates (THREE.Vector3)
     */
    update(dt, camLat, camLon, frame, camPos, camera, renderer, night, tint) {
      this.t += dt;
      this.tint.copy(tint);
      this.lightUniforms.night.value = night;
      const h = renderer.getSize(new THREE.Vector2()).y * renderer.getPixelRatio();
      this.lightUniforms.pxScale.value = h / (2 * Math.tan((camera.fov * D2R) / 2));
      for (const ap of this.airports) {
        const d = Geo.distance(camLat, camLon, ap.lat, ap.lon);
        const rec = this.built.get(ap.icao);
        if (!rec && d < 90000) this.build(ap);
        else if (rec && d > 130000) this.dispose(rec);
      }
      const inv = new THREE.Matrix4();
      for (const rec of this.built.values()) {
        frame.placeEcef(rec.g, rec.A, rec.B);
        rec.g.updateMatrixWorld(true);
        inv.copy(rec.g.matrixWorld).invert();
        const cam = camPos.clone().applyMatrix4(inv); // camera in airport-local frame
        const col = rec.dg.attributes.color;
        for (const p of rec.papis) for (const u of p.units) {
          const dx = cam.x - u.p[0], dy = cam.y - u.p[1], dz = cam.z - u.p[2];
          const ang = Math.atan2(dy, Math.hypot(dx, dz)) * R2D;
          col.setXYZ(u.k, ...(ang > u.angle ? [1, 0.95, 0.9] : [1, 0.1, 0.08]));
        }
        // Rabbit: two flashes per second running to the threshold
        const pos = rec.dg.attributes.position;
        for (const r of rec.rabbits) {
          const ph = (this.t * 2) % 1;
          const i = Math.floor(ph * r.pts.length);
          const on = night > 0.3 || true;
          pos.setXYZ(r.k, ...r.pts[i]);
          col.setXYZ(r.k, ...(on ? [1.4, 1.4, 1.5] : [0, 0, 0]));
          pos.setXYZ(r.k + 1, ...r.pts[Math.min(r.pts.length - 1, i + 1)]);
          col.setXYZ(r.k + 1, 0.4, 0.4, 0.45);
        }
        col.needsUpdate = true; pos.needsUpdate = true;
      }
    }
  }

  window.Airports3D = Airports3D;
})();
