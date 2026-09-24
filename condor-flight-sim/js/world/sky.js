/* =============================================================================
 * sky.js — Sun position from the UTC date/time, an atmospheric sky dome
 * (horizon dips with altitude, sunset glow, darker blue at cruise levels),
 * stars that turn with sidereal time, and the scene lighting derived from it.
 * ========================================================================== */
(function () {
  'use strict';
  const { D2R, R2D, clamp } = Geo;

  /** Sub-solar point and Greenwich sidereal angle for a Date. */
  function sunPosition(date) {
    const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * D2R;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const e = (23.439 - 0.00000036 * d) * D2R;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * D2R;
    const lon = ra - gmst;
    return { lat: dec * R2D, lon: Geo.wrap180(lon * R2D), ecef: [Math.cos(dec) * Math.cos(lon), Math.cos(dec) * Math.sin(lon), Math.sin(dec)], gmst };
  }

  const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t, 0, 1));

  class Sky {
    constructor() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, 1, 1, 200);
      this.uniforms = {
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
        ground: { value: new THREE.Color() }, dip: { value: 0 }, sunVis: { value: 1 }, night: { value: 0 },
      };
      const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: this.uniforms,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 sunDir, zenith, horizon, glow, ground; uniform float dip, sunVis, night;
          varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float el = asin(clamp(d.y, -1.0, 1.0)) + dip;          // elevation above the true horizon
            float s = max(dot(d, sunDir), 0.0);
            vec3 col;
            if (el >= 0.0) {
              float t = pow(clamp(el / 1.4, 0.0, 1.0), 0.45);
              col = mix(horizon, zenith, t);
            } else {
              col = mix(horizon, ground, clamp(-el * 6.0, 0.0, 1.0));
            }
            // Sunset/sunrise glow around the sun near the horizon
            float hz = exp(-abs(el) * 7.0);
            col += glow * pow(s, 4.0) * hz * 0.9;
            // Sun: disc + halo
            col += vec3(1.0, 0.95, 0.85) * (pow(s, 2200.0) * 40.0 + pow(s, 90.0) * 0.35 + pow(s, 8.0) * 0.08) * sunVis;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }));
      dome.renderOrder = -10;
      this.scene.add(dome);

      // Stars (fixed to the celestial sphere, turned by sidereal time)
      const n = 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
        pos.set([r * Math.cos(a) * 95, r * Math.sin(a) * 95, z * 95], i * 3);
        const b = 0.35 + Math.pow(rnd(), 6) * 1.3, tint = rnd();
        col.set([b * (0.85 + tint * 0.15), b * 0.9, b * (1.05 - tint * 0.15)], i * 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.starMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
      this.stars = new THREE.Points(sg, this.starMat);
      this.stars.matrixAutoUpdate = false;
      this.stars.renderOrder = -9;
      this.scene.add(this.stars);

      // Scene lights (added to the main scene by the app)
      this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
      this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a5a50, 1);
      this.fogColor = new THREE.Color();
      this.terrainTint = new THREE.Color();
      this.sunElev = 45;
    }

    /**
     * @param date   UTC Date
     * @param frame  WorldFrame
     * @param altM   camera altitude (m)
     * @param camera main camera (for orientation)
     */
    update(date, frame, altM, camera) {
      const sp = sunPosition(date);
      this.sun = sp;
      const sunDir = frame.dir(sp.ecef).normalize();
      this.uniforms.sunDir.value.copy(sunDir);
      const elev = Math.asin(clamp(sunDir.y, -1, 1)) * R2D;
      this.sunElev = elev;
      const dip = Math.acos(clamp(Geo.R / (Geo.R + Math.max(0, altM)), -1, 1));
      this.uniforms.dip.value = dip;
      const hk = clamp(altM / 12000, 0, 1);
      // Day factor: 1 in daylight, 0 at night, transition through civil twilight.
      const day = clamp((elev + 6) / 14, 0, 1);
      const golden = clamp(1 - Math.abs(elev - 2) / 10, 0, 1);
      const night = 1 - clamp((elev + 12) / 10, 0, 1);
      this.day = day; this.night = night;
      const zenith = lerpC(0x020510, lerpC(0x2e67c7, 0x0c2a78, hk), day);
      let horizon = lerpC(0x03060d, lerpC(0xb8d3ec, 0x9ec2ea, hk), day);
      horizon = horizon.lerp(new THREE.Color(0xf08a4b), golden * 0.55);
      const glow = new THREE.Color(0xff7a30).multiplyScalar(golden * 1.2 + day * 0.15);
      const ground = lerpC(0x020306, 0x8aa0b4, day);
      this.uniforms.zenith.value.copy(zenith);
      this.uniforms.horizon.value.copy(horizon);
      this.uniforms.glow.value.copy(glow);
      this.uniforms.ground.value.copy(ground);
      this.uniforms.sunVis.value = clamp((elev + 1.5) / 3, 0, 1);
      this.starMat.opacity = clamp(night * 1.2 + hk * 0.15 * (1 - day), 0, 1);

      // Stars: celestial frame -> ECEF (rotate by -GMST) -> render
      const g = sp.gmst, c = Math.cos(-g), s = Math.sin(-g);
      const Rz = [c, -s, 0, s, c, 0, 0, 0, 1];
      const R = frame.R, m = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = R[i * 3] * Rz[j] + R[i * 3 + 1] * Rz[3 + j] + R[i * 3 + 2] * Rz[6 + j];
      this.stars.matrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
      this.stars.matrixWorldNeedsUpdate = true;

      // Lights
      const sunCol = lerpC(0xff8a4a, 0xfff4e2, clamp((elev - 1) / 18, 0, 1));
      this.sunLight.color.copy(sunCol);
      this.sunLight.intensity = 3.0 * clamp((elev + 1) / 8, 0, 1);
      this.sunLight.position.copy(sunDir).multiplyScalar(1000);
      this.hemi.color.copy(lerpC(0x1b2842, 0xc4dcff, day));   // moonlit blue at night
      this.hemi.groundColor.copy(lerpC(0x07080c, 0x5f5a4c, day));
      this.hemi.intensity = 0.45 + day * 0.85;
      // Terrain imagery tint: daylight, golden hour warmth, night darkness
      const tint = lerpC(0x0b0f1a, 0xffffff, day);
      tint.lerp(new THREE.Color(0xffc49a), golden * 0.35 * day);
      this.terrainTint.copy(tint);
      // Fog / haze colour
      this.fogColor.copy(horizon).lerp(ground, 0.15);

      this.camera.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
      this.camera.fov = camera.fov; this.camera.aspect = camera.aspect;
      if (camera.view && camera.view.enabled) { const v = camera.view; this.camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height); }
      else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }
  }

  window.Sky = Sky;
  window.sunPosition = sunPosition;
})();
