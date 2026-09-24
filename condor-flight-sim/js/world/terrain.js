/* =============================================================================
 * terrain.js — Streams the real world onto a spherical earth.
 *
 *  • Imagery: Web-Mercator satellite tiles (Esri World Imagery, falling back to
 *    EOX Sentinel-2 cloudless, falling back to procedural colouring).
 *  • Elevation: AWS Open Data "Terrarium" DEM tiles (SRTM/ETOPO1 based).
 *  • A quadtree picks the level of detail from the camera distance; tiles are
 *    culled against the horizon and the view frustum; parents are drawn until
 *    all visible children are ready; skirts hide cracks between levels.
 *  • Airports are flattened to their surveyed runway profiles so the aircraft
 *    sits exactly on the runways drawn by airports3d.js.
 *  • heightAt() gives the physics the same ground the renderer draws.
 *
 * All tiles are positioned by WorldFrame (ECEF -> local render frame) each
 * frame, so there is no floating-point jitter anywhere on the planet.
 * ========================================================================== */
(function () {
  'use strict';
  const { D2R, R2D, clamp } = Geo;

  const PROVIDERS = {
    esri: { name: 'Esri World Imagery', maxZ: 17, url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      credit: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
    eox: { name: 'Sentinel-2 cloudless (EOX)', maxZ: 14, url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
      credit: 'Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)' },
    none: { name: 'Procedural', maxZ: 15, url: null, credit: '' },
  };
  const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  const DEM_MAX_Z = 12;
  const ROOT_Z = 2;

  /* ------------------------------------------------------------ request queue */
  class Loader {
    constructor(maxActive) { this.max = maxActive; this.active = 0; this.queue = []; }
    push(job) { this.queue.push(job); }
    pump() {
      if (this.queue.length > 64) this.queue = this.queue.filter((j) => !(j.cancelled && j.cancelled()));
      if (!this.queue.length || this.active >= this.max) return;
      const pr = (j) => (typeof j.priority === 'function' ? j.priority() : j.priority);
      this.queue.sort((a, b) => pr(a) - pr(b));
      while (this.queue.length && this.active < this.max) {
        const job = this.queue.shift();
        if (job.cancelled && job.cancelled()) continue;
        this.active++;
        job.run(() => { this.active--; });
      }
    }
  }

  function loadImage(url, done) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let finished = false;
    const t = setTimeout(() => { if (!finished) { finished = true; img.src = ''; done(null); } }, 15000);
    img.onload = () => { if (finished) return; finished = true; clearTimeout(t); done(img); };
    img.onerror = () => { if (finished) return; finished = true; clearTimeout(t); done(null); };
    img.src = url;
  }

  /* ----------------------------------------------------------------- tiles */
  class Tile {
    constructor(z, x, y, parent) {
      this.z = z; this.x = x; this.y = y; this.parent = parent;
      this.children = null;
      this.key = `${z}/${x}/${y}`;
      this.lon0 = Geo.tileXToLon(x, z); this.lon1 = Geo.tileXToLon(x + 1, z);
      this.lat1 = Geo.tileYToLat(y, z); this.lat0 = Geo.tileYToLat(y + 1, z);
      const cl = (this.lat0 + this.lat1) / 2, co = (this.lon0 + this.lon1) / 2;
      this.cLat = cl; this.cLon = co;
      this.center = Geo.llaToEcef(cl, co, 0);
      this.cDir = this.center.map((v) => v / Geo.R);
      // Angular radius (rad) of the tile as seen from the earth centre.
      const corners = [[this.lat0, this.lon0], [this.lat0, this.lon1], [this.lat1, this.lon0], [this.lat1, this.lon1]];
      this.angRadius = Math.max(...corners.map(([a, b]) => Geo.distance(cl, co, a, b))) / Geo.R;
      this.size = Geo.distance(cl, this.lon0, cl, this.lon1); // east-west width (m)
      this.state = 'new';     // new | loading | ready | failed
      this.imgState = 'new';
      this.mesh = null; this.texture = null; this.image = null;
      this.lastUsed = 0;
    }
    get ready() { return this.state === 'ready'; }
  }

  class Terrain {
    constructor(renderer, opts = {}) {
      this.renderer = renderer;
      this.group = new THREE.Group();
      this.group.name = 'terrain';
      this.provider = opts.imagery && PROVIDERS[opts.imagery] ? opts.imagery : 'esri';
      this.segments = opts.lowQuality ? 20 : 32;
      this.lodFactor = opts.lowQuality ? 1.6 : 2.2;
      this.maxTiles = opts.lowQuality ? 320 : 700;
      this.imgLoader = new Loader(opts.lowQuality ? 6 : 10);
      this.demLoader = new Loader(6);
      this.tiles = new Map();
      this.dem = new Map();       // key -> {state, data:Float32Array(256*256)}
      this.airports = [];
      this.frame = 0;
      this.failCount = { esri: 0, eox: 0 };
      this.okCount = { esri: 0, eox: 0 };
      this.demFail = 0; this.demOk = 0;
      this.brightness = 1; this.tint = new THREE.Color(1, 1, 1);
      this.maxAniso = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
      this.roots = [];
      const n = 1 << ROOT_Z;
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
        const t = new Tile(ROOT_Z, x, y, null);
        this.tiles.set(t.key, t);
        this.roots.push(t);
      }
      this.stats = { drawn: 0, loaded: 0 };
      this.listeners = [];
    }

    get credit() { return PROVIDERS[this.provider].credit; }
    get providerName() { return PROVIDERS[this.provider].name; }
    onStatus(fn) { this.listeners.push(fn); }
    status(msg) { for (const fn of this.listeners) fn(msg); }

    setAirports(list) {
      // Pre-computed runway rectangles for flattening + surface queries.
      this.airports = list.map((ap) => {
        const lat0 = ap.lat, lon0 = ap.lon, k = Math.cos(lat0 * D2R);
        const toXY = (lat, lon) => [(Geo.wrap180(lon - lon0)) * D2R * Geo.R * k, (lat - lat0) * D2R * Geo.R];
        let maxExt = 0;
        const rws = ap.runways.map((rw) => {
          const a = rw.ends[0], b = rw.ends[1];
          const pa = toXY(a.lat, a.lon), pb = toXY(b.lat, b.lon);
          const dx = pb[0] - pa[0], dy = pb[1] - pa[1], L = Math.hypot(dx, dy);
          maxExt = Math.max(maxExt, Math.hypot(pa[0], pa[1]), Math.hypot(pb[0], pb[1]));
          return { pa, ux: dx / L, uy: dy / L, L, w: rw.width, ea: (isFinite(a.elev) ? a.elev : ap.elev) * Geo.FT, eb: (isFinite(b.elev) ? b.elev : ap.elev) * Geo.FT };
        });
        return { ap, lat0, lon0, k, rws, elev: ap.elev * Geo.FT, rIn: maxExt + 1200, rOut: maxExt + 3500 };
      });
    }

    /**
     * Airport influence at a point: {w, h, onRunway}. w=1 fully flattened.
     */
    airportAt(lat, lon) {
      for (const A of this.airports) {
        const dLat = (lat - A.lat0) * D2R * Geo.R;
        if (Math.abs(dLat) > A.rOut) continue;
        const dLon = Geo.wrap180(lon - A.lon0) * D2R * Geo.R * A.k;
        const r = Math.hypot(dLon, dLat);
        if (r > A.rOut) continue;
        // Nearest runway profile
        let best = null, bestD = 1e18;
        for (const rw of A.rws) {
          const px = dLon - rw.pa[0], py = dLat - rw.pa[1];
          const along = px * rw.ux + py * rw.uy;
          const cross = -px * rw.uy + py * rw.ux;
          const ac = clamp(along, 0, rw.L);
          const d = Math.hypot(along - ac, cross);
          if (d < bestD) { bestD = d; best = { rw, along, cross, ac }; }
        }
        const rw = best.rw;
        const h = rw.ea + (rw.eb - rw.ea) * (best.ac / rw.L);
        const onRunway = Math.abs(best.cross) <= rw.w / 2 + 4 && best.along >= -60 && best.along <= rw.L + 60;
        let w;
        if (bestD < rw.w / 2 + 180) w = 1;
        else if (r < A.rIn) w = 1;
        else w = 1 - smooth((r - A.rIn) / (A.rOut - A.rIn));
        return { w, h, onRunway, airport: A.ap };
      }
      return null;
    }

    /* ----------------------------------------------------------- elevation */
    demKeyFor(z, x, y) {
      const dz = clamp(z - 2, Math.min(z, 3), DEM_MAX_Z);
      const s = z - dz;
      return { dz, dx: x >> s, dy: y >> s, key: `${dz}/${x >> s}/${y >> s}` };
    }
    requestDem(dz, dx, dy, priority) {
      const key = `${dz}/${dx}/${dy}`;
      let d = this.dem.get(key);
      if (d) return d;
      d = { state: 'loading', data: null, z: dz, x: dx, y: dy, used: this.frame };
      this.dem.set(key, d);
      if (this.demFail > 12 && this.demOk === 0) { d.state = 'failed'; return d; }
      this.demLoader.push({
        priority, run: (done) => loadImage(DEM_URL(dz, dx, dy), (img) => {
          if (img) {
            try {
              const c = document.createElement('canvas'); c.width = c.height = 256;
              const g = c.getContext('2d', { willReadFrequently: true });
              g.drawImage(img, 0, 0);
              const px = g.getImageData(0, 0, 256, 256).data;
              const out = new Float32Array(256 * 256);
              for (let i = 0; i < out.length; i++) out[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
              d.data = out; d.state = 'ready'; this.demOk++;
            } catch (e) { d.state = 'failed'; this.demFail++; }
          } else { d.state = 'failed'; this.demFail++; if (this.demFail === 12 && !this.demOk) this.status('Elevation data unavailable — flat terrain'); }
          done();
        }),
      });
      return d;
    }
    /** Bilinear sample of a DEM tile at lat/lon (metres, sea = raw bathymetry). */
    sampleDem(d, lat, lon) {
      const n = 1 << d.z;
      const fx = (Geo.lonToTileX(lon, d.z) - d.x) * 255, fy = (Geo.latToTileY(lat, d.z) - d.y) * 255;
      const x0 = clamp(Math.floor(fx), 0, 254), y0 = clamp(Math.floor(fy), 0, 254);
      const tx = clamp(fx - x0, 0, 1), ty = clamp(fy - y0, 0, 1);
      const D = d.data, i = y0 * 256 + x0;
      return (D[i] * (1 - tx) + D[i + 1] * tx) * (1 - ty) + (D[i + 256] * (1 - tx) + D[i + 257] * tx) * ty;
    }
    /** Finest loaded DEM covering a point. */
    bestDem(lat, lon, maxZ = DEM_MAX_Z) {
      for (let z = maxZ; z >= 0; z--) {
        const x = Math.floor(Geo.lonToTileX(lon, z)), y = Math.floor(Geo.latToTileY(lat, z));
        const d = this.dem.get(`${z}/${x}/${y}`);
        if (d && d.state === 'ready') { d.used = this.frame; return d; }
      }
      return null;
    }
    rawElevation(lat, lon) {
      const d = this.bestDem(lat, lon);
      return d ? this.sampleDem(d, lat, lon) : null;
    }
    /** Ground height (m MSL) and surface type for physics. */
    heightAt(lat, lon) {
      const raw = this.rawElevation(lat, lon);
      const ap = this.airportAt(lat, lon);
      let h = raw == null ? (ap ? ap.h : 0) : Math.max(raw, 0);
      if (ap) h = h + (ap.h - h) * ap.w;
      let surface = 'grass';
      if (ap && ap.onRunway) surface = 'runway';
      else if (!ap && raw != null && raw < -2) surface = 'water';
      return { h, surface };
    }

    /* ------------------------------------------------------------- loading */
    requestTile(t, camEcef) {
      if (t.state !== 'new') return;
      t.state = 'loading';
      const pr = () => dist3(t.center, camEcef) - t.angRadius * Geo.R;
      const dk = this.demKeyFor(t.z, t.x, t.y);
      t.dem = this.requestDem(dk.dz, dk.dx, dk.dy, pr() - 1);
      t.dem.used = this.frame;
      // Imagery
      const prov = PROVIDERS[this.provider];
      if (prov.url && t.z <= prov.maxZ) {
        const reqProvider = this.provider;
        this.imgLoader.push({
          priority: () => pr(),
          cancelled: () => t.state === 'evicted' || this.provider !== reqProvider || t.lastUsed < this.frame - 90,
          run: (done) => {
            const provider = this.provider;
            loadImage(prov.url(t.z, t.x, t.y), (img) => {
              done();
              if (t.state === 'evicted') return;
              if (img) { t.image = img; t.imgState = 'ready'; this.okCount[provider] = (this.okCount[provider] || 0) + 1; }
              else {
                t.imgState = 'failed';
                this.failCount[provider] = (this.failCount[provider] || 0) + 1;
                this.maybeFallback(provider);
              }
            });
          },
        });
      } else t.imgState = 'procedural';
    }
    maybeFallback(provider) {
      if (this.provider !== provider) return;
      if (this.failCount[provider] >= 10 && (this.okCount[provider] || 0) < 2) {
        const next = provider === 'esri' ? 'eox' : 'none';
        this.provider = next;
        this.status(next === 'none' ? 'Satellite imagery unavailable — procedural scenery' : `Esri imagery unavailable — using ${PROVIDERS[next].name}`);
        for (const t of this.tiles.values()) if (t.state !== 'ready') { t.state = 'new'; t.imgState = 'new'; }
      }
    }

    /** Build the mesh once imagery (or fallback) and elevation are available. */
    tryBuild(t) {
      if (t.state !== 'loading') return;
      const demState = t.dem ? t.dem.state : 'failed';
      if (demState === 'loading') return;
      if (t.imgState === 'new') return;
      if (t.imgState === 'failed' && this.provider !== 'none' && t.z > 4 && t.parent && t.parent.ready) {
        // Upsample the parent's imagery for this quadrant.
        t.imgState = 'parent';
      }
      this.buildMesh(t);
    }

    buildMesh(t) {
      const N = this.segments;
      const dem = t.dem && t.dem.state === 'ready' ? t.dem : null;
      const n1 = N + 1;
      const vcount = n1 * n1 + 4 * n1;
      const pos = new Float32Array(vcount * 3), uv = new Float32Array(vcount * 2);
      const heights = new Float32Array(n1 * n1);
      const center = t.center;
      let minH = 1e9, maxH = -1e9;
      const ecef = [0, 0, 0];
      const tileY0 = t.y, z = t.z;
      // Airports near this tile
      const nearAp = this.airports.filter((A) => A.lat0 > t.lat0 - 0.2 && A.lat0 < t.lat1 + 0.2 && Geo.wrap180(A.lon0 - t.lon0) > -0.3 && Geo.wrap180(A.lon0 - t.lon1) < 0.3);
      const saveAp = this.airports;
      this.airports = nearAp;
      for (let j = 0; j <= N; j++) {
        const lat = Geo.tileYToLat(tileY0 + j / N, z);
        for (let i = 0; i <= N; i++) {
          const lon = t.lon0 + (t.lon1 - t.lon0) * (i / N);
          let h = dem ? Math.max(0, this.sampleDem(dem, lat, lon)) : 0;
          if (nearAp.length) { const ap = this.airportAt(lat, lon); if (ap) h = h + (ap.h - h) * ap.w; }
          const k = j * n1 + i;
          heights[k] = h;
          minH = Math.min(minH, h); maxH = Math.max(maxH, h);
          Geo.llaToEcef(lat, lon, h, ecef);
          pos[k * 3] = ecef[0] - center[0]; pos[k * 3 + 1] = ecef[1] - center[1]; pos[k * 3 + 2] = ecef[2] - center[2];
          uv[k * 2] = i / N; uv[k * 2 + 1] = 1 - j / N;
        }
      }
      this.airports = saveAp;
      // Skirts: duplicate edge vertices pushed down.
      const skirt = Math.max(30, t.size * 0.015);
      const edges = [];
      for (let i = 0; i <= N; i++) edges.push([0, i]);          // top row j=0
      for (let i = 0; i <= N; i++) edges.push([N, i]);          // bottom row
      for (let j = 0; j <= N; j++) edges.push([j, 0]);          // left col
      for (let j = 0; j <= N; j++) edges.push([j, N]);          // right col
      edges.forEach(([j, i], e) => {
        const src = j * n1 + i, dst = n1 * n1 + e;
        const lat = Geo.tileYToLat(tileY0 + j / N, z), lon = t.lon0 + (t.lon1 - t.lon0) * (i / N);
        Geo.llaToEcef(lat, lon, heights[src] - skirt, ecef);
        pos[dst * 3] = ecef[0] - center[0]; pos[dst * 3 + 1] = ecef[1] - center[1]; pos[dst * 3 + 2] = ecef[2] - center[2];
        uv[dst * 2] = uv[src * 2]; uv[dst * 2 + 1] = uv[src * 2 + 1];
      });
      const idx = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const skirtStrip = (off, getSrc, flip) => {
        for (let k = 0; k < N; k++) {
          const s0 = getSrc(k), s1 = getSrc(k + 1), d0 = n1 * n1 + off + k, d1 = d0 + 1;
          if (flip) idx.push(s0, s1, d0, s1, d1, d0); else idx.push(s0, d0, s1, s1, d0, d1);
        }
      };
      skirtStrip(0, (k) => k, true);
      skirtStrip(n1, (k) => N * n1 + k, false);
      skirtStrip(2 * n1, (k) => k * n1, false);
      skirtStrip(3 * n1, (k) => k * n1 + N, true);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(vcount > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      t.heights = heights; t.minH = minH; t.maxH = maxH;

      // Texture
      let tex;
      if (t.imgState === 'ready' && t.image) {
        tex = new THREE.Texture(t.image);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.maxAniso;
        tex.needsUpdate = true;
        t.image = null;
      } else if (t.imgState === 'parent' && t.parent && t.parent.texture) {
        tex = t.parent.texture.clone();
        const qx = t.x & 1, qy = t.y & 1;
        tex.repeat.set(0.5, 0.5); tex.offset.set(qx * 0.5, (1 - qy) * 0.5);
        tex.needsUpdate = true;
        t.sharedTex = true;
      } else {
        tex = proceduralTexture(t, heights, N);
      }
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: this.tint, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      mesh.visible = false;
      t.mesh = mesh; t.texture = tex;
      t.state = 'ready';
      this.group.add(mesh);
      this.stats.loaded++;
    }

    /* ----------------------------------------------------------- selection */
    /**
     * @param camEcef  camera position (ECEF)
     * @param frame    WorldFrame used to place meshes
     */
    update(camEcef, frame) {
      this.frame++;
      const camR = Math.hypot(camEcef[0], camEcef[1], camEcef[2]);
      const camDir = camEcef.map((v) => v / camR);
      const horizon = Math.acos(clamp(Geo.R / Math.max(camR, Geo.R + 1), -1, 1)) + Math.acos(Geo.R / (Geo.R + 9000));
      const drawList = [];
      const maxZ = PROVIDERS[this.provider].maxZ;
      const visit = (t, below = 0) => {
        t.lastUsed = this.frame;
        // Horizon cull
        const ang = Math.acos(clamp(t.cDir[0] * camDir[0] + t.cDir[1] * camDir[1] + t.cDir[2] * camDir[2], -1, 1));
        if (ang - t.angRadius > horizon) return 'hidden';
        // Progressive refinement: request at most 3 levels below the deepest loaded ancestor.
        if (t.state === 'new' && below <= 3) this.requestTile(t, camEcef);
        if (t.state === 'loading') this.tryBuild(t);
        const depth = t.ready ? 0 : below + 1;
        const dist = Math.max(0, dist3(t.center, camEcef) - t.angRadius * Geo.R * 0.9);
        const want = t.z < maxZ && (t.z < ROOT_Z + 1 || dist < t.size * this.lodFactor);
        if (want) {
          if (!t.children) t.children = [0, 1, 2, 3].map((i) => {
            const c = new Tile(t.z + 1, t.x * 2 + (i & 1), t.y * 2 + (i >> 1), t);
            this.tiles.set(c.key, c);
            return c;
          });
          // Check readiness of visible children
          let allReady = true;
          for (const c of t.children) {
            const a = Math.acos(clamp(c.cDir[0] * camDir[0] + c.cDir[1] * camDir[1] + c.cDir[2] * camDir[2], -1, 1));
            c.lastUsed = this.frame;
            if (a - c.angRadius > horizon) continue;
            if (c.state === 'new' && depth <= 3) this.requestTile(c, camEcef);
            if (c.state === 'loading') this.tryBuild(c);
            if (!c.ready) allReady = false;
          }
          if (allReady || !t.ready) {
            for (const c of t.children) visit(c, depth);
            if (!allReady && !t.ready) return 'pending';
            return 'split';
          }
        }
        if (t.ready) drawList.push(t);
        return 'drawn';
      };
      for (const r of this.roots) visit(r);

      // Visibility & placement
      for (const t of this.tiles.values()) if (t.mesh) t.mesh.visible = false;
      for (const t of drawList) {
        frame.placeEcef(t.mesh, t.center, null);
        t.mesh.visible = true;
      }
      this.stats.drawn = drawList.length;
      this.imgLoader.pump();
      this.demLoader.pump();
      if (this.frame % 60 === 0) this.evict();
    }

    evict() {
      if (this.tiles.size < this.maxTiles) return;
      // Drop whole child sets that have not been needed for a while, oldest first.
      const parents = [...this.tiles.values()].filter((t) => t.children && t.children.every((c) => this.frame - c.lastUsed > 300));
      parents.sort((a, b) => Math.max(...a.children.map((c) => c.lastUsed)) - Math.max(...b.children.map((c) => c.lastUsed)));
      for (const p of parents) {
        if (this.tiles.size < this.maxTiles * 0.8) break;
        if (!p.children) continue;
        for (const c of p.children) this.disposeTile(c);
        p.children = null;
      }
      if (this.dem.size > 400) {
        const ds = [...this.dem.entries()].filter(([, d]) => d.z > 3 && this.frame - (d.used || 0) > 300).slice(0, this.dem.size - 300);
        for (const [k] of ds) this.dem.delete(k);
      }
    }
    disposeTile(t) {
      if (t.children) for (const c of t.children) this.disposeTile(c);
      t.children = null;
      if (t.mesh) {
        this.group.remove(t.mesh);
        t.mesh.geometry.dispose();
        if (!t.sharedTex) t.texture?.dispose();
        t.mesh.material.dispose();
      }
      t.mesh = null; t.texture = null; t.image = null;
      t.state = 'evicted';
      this.tiles.delete(t.key);
    }

    /** Daylight tint (applied to all tile materials). */
    setLighting(color) { this.tint.copy(color); }

    /** Pre-load the tiles around a point (used while the menu is open). */
    warm(lat, lon, frame) {
      const ecef = Geo.llaToEcef(lat, lon, 200);
      this.update(ecef, frame);
    }
    pendingCount() { return this.imgLoader.queue.length + this.imgLoader.active + this.demLoader.queue.length + this.demLoader.active; }
  }

  function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  /* --------------------------------------------------- procedural fallback */
  function proceduralTexture(t, heights, N) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const n1 = N + 1;
    for (let py = 0; py < S; py++) {
      const lat = Geo.tileYToLat(t.y + (py + 0.5) / S, t.z);
      const alat = Math.abs(lat);
      for (let px = 0; px < S; px++) {
        const gi = Math.min(N, Math.round((px / S) * N)), gj = Math.min(N, Math.round((py / S) * N));
        const h = heights[gj * n1 + gi];
        const noise = (Math.sin(px * 12.9898 + py * 78.233 + t.x * 3.1 + t.y * 1.7) * 43758.5453) % 1;
        const nz = (noise - 0.5) * 14;
        let r, gg, b;
        if (h <= 0.5) { r = 22; gg = 60; b = 96; }
        else if (alat > 66 || h > 3500) { r = 235; gg = 238; b = 240; }
        else if (h < 8) { r = 196; gg = 184; b = 150; }
        else {
          const desert = alat > 15 && alat < 32 ? 1 : 0;
          const hk = clamp(h / 2500, 0, 1);
          if (desert) { r = 196 - hk * 40; gg = 160 - hk * 40; b = 110 - hk * 30; }
          else { r = 72 + hk * 70; gg = 104 + hk * 20; b = 52 + hk * 40; }
        }
        const o = (py * S + px) * 4;
        img.data[o] = clamp(r + nz, 0, 255); img.data[o + 1] = clamp(gg + nz, 0, 255); img.data[o + 2] = clamp(b + nz, 0, 255); img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  window.Terrain = Terrain;
  window.TerrainProviders = PROVIDERS;
})();
