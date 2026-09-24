/* =============================================================================
 * clouds.js — Cumulus layer for the weather presets (FEW / SCT / BKN).
 *
 * Clouds are clusters of soft billboard puffs placed deterministically on a
 * ~4 km lat/lon grid, so the same sky reappears when you fly back. Puffs are
 * instanced camera-facing quads (any size, one draw call), anchored in a local
 * ENU frame that is re-centred when the aircraft moves far, and lit from the
 * sun. Flying through a puff whites out the view.
 * ========================================================================== */
(function () {
  'use strict';
  const { D2R, FT, clamp } = Geo;
  const CELL = 0.04;          // degrees of latitude per grid cell (~4.4 km)
  const RADIUS = 38000;       // metres of cloud field kept around the camera

  function hash(a, b, c = 0) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function puffTexture() {
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const r = S * (0.12 + rnd() * 0.18);
      const x = S / 2 + (rnd() - 0.5) * S * 0.5, y = S / 2 + (rnd() - 0.5) * S * 0.36;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  const VS = `
    attribute vec3 iPos; attribute float iSize; attribute float iShade;
    uniform float fadeFar;
    varying vec2 vUv; varying float vShade; varying float vFade;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = uv; vShade = iShade;
      vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
      float d = length(mv.xyz);
      mv.xy += position.xy * iSize;
      gl_Position = projectionMatrix * mv;
      vFade = (1.0 - smoothstep(fadeFar * 0.65, fadeFar, d)) * smoothstep(iSize * 0.35, iSize * 1.2, d);
      #include <logdepthbuf_vertex>
    }`;
  const FS = `
    uniform sampler2D map; uniform vec3 lit; uniform vec3 shadow; uniform float opacity;
    varying vec2 vUv; varying float vShade; varying float vFade;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      float a = texture2D(map, vUv).a * opacity * vFade;
      if (a < 0.01) discard;
      vec3 col = mix(shadow, lit, clamp(vUv.y * 0.9 + vShade * 0.35, 0.0, 1.0));
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }`;

  class Clouds {
    constructor() {
      const quad = new THREE.PlaneGeometry(2, 2);
      this.geo = new THREE.InstancedBufferGeometry();
      this.geo.index = quad.index;
      this.geo.setAttribute('position', quad.attributes.position);
      this.geo.setAttribute('uv', quad.attributes.uv);
      this.max = 6000;
      this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
      this.iSize = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
      this.iShade = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
      this.geo.setAttribute('iPos', this.iPos); this.geo.setAttribute('iSize', this.iSize); this.geo.setAttribute('iShade', this.iShade);
      this.geo.instanceCount = 0;
      this.uniforms = {
        map: { value: puffTexture() }, lit: { value: new THREE.Color(1, 1, 1) }, shadow: { value: new THREE.Color(0.6, 0.64, 0.7) },
        opacity: { value: 0.9 }, fadeFar: { value: RADIUS },
      };
      this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false }));
      this.mesh.frustumCulled = false;
      this.mesh.matrixAutoUpdate = false;
      this.mesh.renderOrder = 3;
      this.cover = 0; this.baseM = 1500; this.anchor = null; this.puffs = [];
      this.inCloud = 0;
    }

    /** cover 0..1, baseFn(lat, lon) -> cloud base (m MSL), depthM = layer thickness. */
    configure(cover, baseFn, depthM = 900) {
      this.cover = cover; this.baseFn = baseFn; this.depthM = depthM;
      this.anchor = null; this.builtAt = null;
      this.mesh.visible = cover > 0.01;
    }

    rebuild(lat, lon, camLocalFn) {
      const aLat = Math.round(lat / CELL) * CELL, aLon = Math.round(lon / CELL) * CELL;
      this.baseM = this.baseFn ? this.baseFn(lat, lon) : 1500;
      this.anchor = { lat: aLat, lon: aLon, ecef: Geo.llaToEcef(aLat, aLon, 0), basis: WorldFrame.enuBasis(aLat, aLon) };
      const mPerDegLat = Geo.R * D2R, mPerDegLon = Geo.R * D2R * Math.cos(aLat * D2R);
      const nLat = Math.ceil(RADIUS / (CELL * mPerDegLat)), nLon = Math.ceil(RADIUS / (CELL * Math.max(1000, mPerDegLon)));
      const puffs = [];
      for (let i = -nLat; i <= nLat; i++) for (let j = -nLon; j <= nLon; j++) {
        const cLat = aLat + i * CELL, cLon = aLon + j * CELL;
        const gi = Math.round(cLat / CELL), gj = Math.round(cLon / CELL);
        if (hash(gi, gj, 1) > this.cover) continue;
        // Cluster: centre jitter, size and puff count grow with coverage
        const cx = (j * CELL + (hash(gi, gj, 2) - 0.5) * CELL * 0.8) * mPerDegLon;
        const cz = -(i * CELL + (hash(gi, gj, 3) - 0.5) * CELL * 0.8) * mPerDegLat;
        const w = 700 + hash(gi, gj, 4) * 1600 * (0.6 + this.cover);
        const h = this.depthM * (0.5 + hash(gi, gj, 5) * 0.8);
        const n = 6 + Math.floor(hash(gi, gj, 6) * 10 * (0.5 + this.cover));
        for (let k = 0; k < n; k++) {
          const u = hash(gi, gj, 10 + k), v = hash(gi, gj, 40 + k), q = hash(gi, gj, 70 + k);
          const ang = u * Math.PI * 2, rr = Math.sqrt(v) * w * 0.5;
          const y = this.baseM + q * h * 0.7;
          const size = (260 + hash(gi, gj, 100 + k) * 420) * (1 - q * 0.35);
          puffs.push({ x: cx + Math.cos(ang) * rr, y: y + size * 0.35, z: cz + Math.sin(ang) * rr, size, shade: q });
          if (puffs.length >= this.max) break;
        }
        if (puffs.length >= this.max) break;
      }
      // Earth curvature: drop puffs by d²/2R relative to the anchor's tangent plane
      for (const p of puffs) p.y -= (p.x * p.x + p.z * p.z) / (2 * Geo.R);
      // Back-to-front order from the camera at rebuild time
      const cam = camLocalFn(this.anchor);
      puffs.sort((a, b) => ((b.x - cam.x) ** 2 + (b.y - cam.y) ** 2 + (b.z - cam.z) ** 2) - ((a.x - cam.x) ** 2 + (a.y - cam.y) ** 2 + (a.z - cam.z) ** 2));
      puffs.forEach((p, i) => { this.iPos.setXYZ(i, p.x, p.y, p.z); this.iSize.setX(i, p.size); this.iShade.setX(i, p.shade); });
      this.iPos.needsUpdate = this.iSize.needsUpdate = this.iShade.needsUpdate = true;
      this.geo.instanceCount = puffs.length;
      this.puffs = puffs;
      this.builtAt = { lat, lon };
    }

    /**
     * @param camEcef camera position (ECEF), camLla its lat/lon/h
     */
    update(frame, camEcef, camLla, sky) {
      if (this.cover <= 0.01) { this.inCloud = 0; return; }
      const far = !this.builtAt || Geo.distance(camLla.lat, camLla.lon, this.builtAt.lat, this.builtAt.lon) > 9000;
      const toLocal = (anchor) => {
        const d = [camEcef[0] - anchor.ecef[0], camEcef[1] - anchor.ecef[1], camEcef[2] - anchor.ecef[2]], B = anchor.basis;
        return { x: B[0] * d[0] + B[3] * d[1] + B[6] * d[2], y: B[1] * d[0] + B[4] * d[1] + B[7] * d[2], z: B[2] * d[0] + B[5] * d[1] + B[8] * d[2] };
      };
      if (far) this.rebuild(camLla.lat, camLla.lon, toLocal);
      frame.placeEcef(this.mesh, this.anchor.ecef, this.anchor.basis);
      // Lighting from the sky model
      const day = sky.day, sun = sky.sunLight.color;
      this.uniforms.lit.value.setRGB(0.12 + 0.95 * day * sun.r, 0.13 + 0.95 * day * sun.g, 0.16 + 0.95 * day * sun.b);
      this.uniforms.shadow.value.setRGB(0.05 + 0.55 * day, 0.06 + 0.58 * day, 0.08 + 0.62 * day);
      // In-cloud whiteout: nearest puff within its radius
      const c = toLocal(this.anchor);
      let inside = 0;
      if (Math.abs(camLla.h - this.baseM - this.depthM * 0.5) < this.depthM + 600) {
        for (const p of this.puffs) {
          const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
          if (Math.abs(dx) > p.size || Math.abs(dz) > p.size) continue;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / (p.size * 0.9);
          if (d < 1) inside = Math.max(inside, 1 - d);
        }
      }
      this.inCloud += (Math.min(1, inside * 2.2) - this.inCloud) * 0.15;
    }
  }

  window.Clouds = Clouds;
})();
