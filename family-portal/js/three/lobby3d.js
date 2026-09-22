/**
 * The Family Island: a small low-poly Three.js scene used as the sign-in
 * backdrop and as the interactive hub header.
 *
 *  - drag (mouse or touch) to spin it, with inertia; vertical swipes still scroll
 *  - tap the house to make it hop
 *  - owned shop decorations appear in fixed slots
 *  - family members orbit as avatar orbs
 *
 * Performance: capped pixel ratio, no shadow maps, a few thousand triangles,
 * and the render loop pauses while the canvas is off-screen or the tab hidden.
 * If Three.js or WebGL is unavailable, the container keeps its CSS gradient.
 */
import { buildDecoration } from './decorations.js';
import { resolveAvatar, initials } from '../data/avatars.js';
import { hashHue, prefersReducedMotion, isTouchDevice } from '../core/utils.js';

const SLOTS = [
  [-2.7, 0.9], [2.5, -1.6], [-2.2, -1.8], [1.3, 2.9],
  [-1.4, 2.7], [3.3, 0.2], [1.2, -3.1], [-3.2, -0.5],
];

function disposeObject(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    materials.forEach((material) => {
      if (material.map) material.map.dispose();
      material.dispose();
    });
  });
}

export class Lobby3D {
  constructor(container, {
    interactive = true,
    autoRotateSpeed = 0.18,
    cameraDistance = 12,
    members = [],
    decorations = [],
  } = {}) {
    this.container = container;
    this.options = { interactive, autoRotateSpeed, cameraDistance };
    this.pendingMembers = members;
    this.pendingDecorations = decorations;
    this.destroyed = false;
    this.running = false;
    this.visible = true;
    this.raf = 0;
    this.velocity = 0;
    this.dragging = false;
    this.reducedMotion = prefersReducedMotion();
    this.decorationObjects = new Map();
    this.memberSprites = new Map();
    this.hop = 0;
    this.cleanups = [];
    container.classList.add('lobby3d');
  }

  async start() {
    try {
      this.THREE = await import('three');
    } catch (err) {
      console.info('[3d] Three.js unavailable, using the flat backdrop.', err?.message || err);
      this.container.classList.add('lobby3d--fallback');
      return false;
    }
    if (this.destroyed) return false;
    try {
      this.setup();
    } catch (err) {
      console.info('[3d] WebGL unavailable, using the flat backdrop.', err?.message || err);
      this.container.classList.add('lobby3d--fallback');
      return false;
    }
    this.setMembers(this.pendingMembers);
    this.setDecorations(this.pendingDecorations);
    this.container.classList.add('lobby3d--ready');
    this.loop();
    return true;
  }

  setup() {
    const THREE = this.THREE;
    const dpr = window.devicePixelRatio || 1;
    const mobile = isTouchDevice() || Math.min(window.innerWidth, window.innerHeight) < 700;
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(dpr, mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.className = 'lobby3d__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.container.append(canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 5.2, this.options.cameraDistance);
    this.camera.lookAt(0, 0.4, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5d7fa3, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(5, 10, 6);
    this.scene.add(sun);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.island = new THREE.Group();
    this.world.add(this.island);
    this.buildIsland();
    this.buildClouds();

    this.orbitGroup = new THREE.Group();
    this.world.add(this.orbitGroup);

    this.clock = new THREE.Clock();
    this.resize();

    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);
    this.cleanups.push(() => resizeObserver.disconnect());

    const intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.loop();
    });
    intersection.observe(this.container);
    this.cleanups.push(() => intersection.disconnect());

    const onVisibility = () => {
      if (document.visibilityState === 'visible') this.loop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

    if (this.options.interactive) this.bindPointer(canvas);
  }

  material(color, extra = {}) {
    return new this.THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...extra });
  }

  buildIsland() {
    const THREE = this.THREE;
    const add = (geometry, color, [x, y, z], extra) => {
      const mesh = new THREE.Mesh(geometry, this.material(color, extra));
      mesh.position.set(x, y, z);
      this.island.add(mesh);
      return mesh;
    };

    add(new THREE.CylinderGeometry(4.2, 4.0, 0.5, 28), 0x7cc576, [0, 0, 0]);
    add(new THREE.CylinderGeometry(4.0, 3.5, 0.6, 28), 0xa47148, [0, -0.55, 0]);
    const rock = add(new THREE.ConeGeometry(3.5, 3.2, 12), 0x8d6e63, [0, -2.45, 0]);
    rock.rotation.x = Math.PI;
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2 + 0.3;
      const pebble = add(new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.08, 0), 0x9e8b80,
        [Math.cos(angle) * 3.3, -1.1 - (i % 4) * 0.35, Math.sin(angle) * 3.3]);
      pebble.rotation.set(i, i * 2, 0);
    }

    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshStandardMaterial({ color: 0x5ec8f2, emissive: 0x1a6f99, emissiveIntensity: 0.25, roughness: 0.2 }),
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(2.0, 0.26, 0.9);
    this.island.add(pond);
    this.pond = pond;

    const path = add(new THREE.BoxGeometry(0.62, 0.04, 2.5), 0xe9c893, [0, 0.25, 1.55]);
    path.receiveShadow = false;

    this.house = new THREE.Group();
    this.house.position.set(0, 0.25, -0.4);
    this.island.add(this.house);
    const houseAdd = (geometry, color, [x, y, z], extra) => {
      const mesh = new THREE.Mesh(geometry, this.material(color, extra));
      mesh.position.set(x, y, z);
      this.house.add(mesh);
      return mesh;
    };
    houseAdd(new THREE.BoxGeometry(1.8, 1.3, 1.5), 0xfff3e0, [0, 0.65, 0]);
    const roof = houseAdd(new THREE.ConeGeometry(1.55, 1.0, 4), 0xe76f51, [0, 1.8, 0]);
    roof.rotation.y = Math.PI / 4;
    houseAdd(new THREE.BoxGeometry(0.42, 0.72, 0.06), 0x8d5524, [0, 0.36, 0.76]);
    const windowMat = { emissive: 0xffb703, emissiveIntensity: 0.55 };
    houseAdd(new THREE.BoxGeometry(0.36, 0.36, 0.06), 0xffe8a3, [-0.56, 0.8, 0.76], windowMat);
    houseAdd(new THREE.BoxGeometry(0.36, 0.36, 0.06), 0xffe8a3, [0.56, 0.8, 0.76], windowMat);
    houseAdd(new THREE.BoxGeometry(0.26, 0.55, 0.26), 0x6d4c41, [0.52, 2.0, -0.25]);
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.12);
    heart.bezierCurveTo(-0.3, 0.1, -0.12, 0.3, 0, 0.14);
    heart.bezierCurveTo(0.12, 0.3, 0.3, 0.1, 0, -0.12);
    const heartMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(heart),
      new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff4d6d, emissiveIntensity: 0.4, side: THREE.DoubleSide }),
    );
    heartMesh.position.set(0, 1.25, 0.77);
    this.house.add(heartMesh);

    [[-1.6, 1.3], [1.5, 1.8], [-0.9, -1.9], [2.9, 1.9], [-3.0, 1.9]].forEach(([x, z], i) => {
      const bush = add(new THREE.IcosahedronGeometry(0.3 + (i % 2) * 0.1, 0), i % 2 ? 0x55a630 : 0x2b9348, [x, 0.45, z]);
      bush.rotation.y = i;
    });
    const flowerColors = [0xff70a6, 0xffd670, 0xa0c4ff, 0xff9770];
    for (let i = 0; i < 14; i += 1) {
      const angle = i * 2.4;
      const radius = 1.4 + (i % 5) * 0.45;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.abs(x) < 1.1 && z > -1.3 && z < 3) continue;
      add(new THREE.SphereGeometry(0.07, 6, 4), flowerColors[i % 4], [x, 0.3, z]);
    }
  }

  buildClouds() {
    const THREE = this.THREE;
    this.clouds = new THREE.Group();
    const white = this.material(0xffffff, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.45 });
    for (let c = 0; c < 4; c += 1) {
      const cloud = new THREE.Group();
      for (let i = 0; i < 4; i += 1) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + (i % 2) * 0.14, 1), white);
        puff.position.set(i * 0.4 - 0.6, (i % 2) * 0.14, (i % 3) * 0.1);
        cloud.add(puff);
      }
      const angle = (c / 4) * Math.PI * 2 + 0.6;
      cloud.position.set(Math.cos(angle) * 5.2, 3.1 + (c % 2) * 0.5, Math.sin(angle) * 5.2);
      cloud.rotation.y = -angle;
      this.clouds.add(cloud);
    }
    this.world.add(this.clouds);
  }

  memberTexture(member) {
    const THREE = this.THREE;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const avatar = resolveAvatar(member.avatar_url);
    const bg = avatar.kind === 'preset' ? avatar.bg : `hsl(${hashHue(member.id)} 70% 75%)`;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (avatar.kind === 'preset') {
      ctx.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(avatar.emoji, size / 2, size / 2 + 4);
    } else {
      ctx.fillStyle = '#3b2f2f';
      ctx.font = 'bold 48px Nunito, system-ui, sans-serif';
      ctx.fillText(initials(member.username), size / 2, size / 2 + 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /** members: profile rows ({ id, username, avatar_url }). */
  setMembers(members) {
    this.pendingMembers = members || [];
    if (!this.scene) return;
    const THREE = this.THREE;
    const wanted = new Map(this.pendingMembers.slice(0, 12).map((m) => [m.id, m]));
    for (const [id, entry] of this.memberSprites) {
      const next = wanted.get(id);
      if (!next || next.avatar_url !== entry.avatar || next.username !== entry.name) {
        this.orbitGroup.remove(entry.sprite);
        disposeObject(entry.sprite);
        this.memberSprites.delete(id);
      }
    }
    for (const member of wanted.values()) {
      if (this.memberSprites.has(member.id)) continue;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.memberTexture(member), transparent: true }));
      sprite.scale.set(0.9, 0.9, 1);
      sprite.userData.memberId = member.id;
      this.orbitGroup.add(sprite);
      this.memberSprites.set(member.id, { sprite, avatar: member.avatar_url, name: member.username, pop: 0 });
    }
    this.renderOnce();
  }

  /** models: decoration model keys, e.g. ['tree', 'windmill']. */
  setDecorations(models) {
    this.pendingDecorations = [...new Set(models || [])];
    if (!this.scene) return;
    const wanted = this.pendingDecorations.slice(0, SLOTS.length);
    for (const [model, entry] of this.decorationObjects) {
      if (!wanted.includes(model)) {
        this.island.remove(entry.object);
        disposeObject(entry.object);
        this.decorationObjects.delete(model);
      }
    }
    wanted.forEach((model, index) => {
      let entry = this.decorationObjects.get(model);
      if (!entry) {
        entry = buildDecoration(this.THREE, model);
        if (!entry) return;
        this.island.add(entry.object);
        this.decorationObjects.set(model, entry);
      }
      const [x, z] = SLOTS[index];
      entry.object.position.set(x, 0.25, z);
      entry.object.rotation.y = Math.atan2(x, z);
    });
    this.renderOnce();
  }

  bindPointer(canvas) {
    const THREE = this.THREE;
    canvas.style.touchAction = 'pan-y';
    let lastX = 0;
    let startX = 0;
    let startY = 0;
    let lastTime = 0;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const down = (event) => {
      this.dragging = true;
      lastX = event.clientX;
      startX = event.clientX;
      startY = event.clientY;
      lastTime = performance.now();
      this.velocity = 0;
      canvas.setPointerCapture?.(event.pointerId);
      this.loop();
    };
    const move = (event) => {
      if (!this.dragging) return;
      const now = performance.now();
      const dx = event.clientX - lastX;
      const dt = Math.max(1, now - lastTime);
      this.world.rotation.y += dx * 0.01;
      this.velocity = (dx * 0.01) / (dt / 1000);
      lastX = event.clientX;
      lastTime = now;
    };
    const up = (event) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (performance.now() - lastTime > 80) this.velocity = 0;
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (moved < 6) this.pick(event, raycaster, pointer);
    };
    const cancel = () => {
      this.dragging = false;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    this.cleanups.push(() => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
    });
  }

  pick(event, raycaster, pointer) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, this.camera);
    const sprites = [...this.memberSprites.values()].map((entry) => entry.sprite);
    const hitSprite = raycaster.intersectObjects(sprites, false)[0];
    if (hitSprite) {
      const entry = this.memberSprites.get(hitSprite.object.userData.memberId);
      if (entry) entry.pop = 1;
      this.loop();
      return;
    }
    if (raycaster.intersectObject(this.house, true).length) {
      this.hop = 1;
      this.loop();
    }
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const narrow = this.camera.aspect < 1;
    this.camera.position.z = this.options.cameraDistance * (narrow ? 1.35 : 1);
    this.camera.position.y = narrow ? 6.2 : 5.2;
    this.camera.lookAt(0, 0.4, 0);
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  animate(time, dt) {
    const motion = this.reducedMotion ? 0 : 1;
    if (!this.dragging) {
      this.world.rotation.y += (this.options.autoRotateSpeed * motion + this.velocity) * dt;
      this.velocity *= Math.pow(0.04, dt);
      if (Math.abs(this.velocity) < 0.001) this.velocity = 0;
    }
    this.island.position.y = Math.sin(time * 0.8) * 0.12 * motion;
    this.clouds.rotation.y = time * 0.03 * motion;

    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt * 1.8);
      const phase = 1 - this.hop;
      this.house.position.y = 0.25 + Math.sin(phase * Math.PI) * 0.6;
      this.house.rotation.y = Math.sin(phase * Math.PI * 2) * 0.15;
    }

    const count = this.memberSprites.size;
    let i = 0;
    for (const entry of this.memberSprites.values()) {
      const angle = time * 0.25 * motion + (i / Math.max(1, count)) * Math.PI * 2;
      const radius = 5.0 + (i % 2) * 0.35;
      entry.sprite.position.set(Math.cos(angle) * radius, 1.6 + Math.sin(time * 1.2 + i) * 0.25 * motion, Math.sin(angle) * radius);
      if (entry.pop > 0) entry.pop = Math.max(0, entry.pop - dt * 2);
      const scale = 0.9 + Math.sin(entry.pop * Math.PI) * 0.5;
      entry.sprite.scale.set(scale, scale, 1);
      i += 1;
    }

    const decoTime = motion ? time : 0;
    for (const entry of this.decorationObjects.values()) entry.update(decoTime);
  }

  loop() {
    if (this.destroyed || this.running || !this.renderer) return;
    if (!this.visible || document.visibilityState !== 'visible') return;
    this.running = true;
    this.clock.getDelta();
    const frame = () => {
      if (this.destroyed || !this.visible || document.visibilityState !== 'visible') {
        this.running = false;
        return;
      }
      const dt = Math.min(0.05, this.clock.getDelta());
      this.animate(this.clock.elapsedTime, dt);
      this.renderer.render(this.scene, this.camera);
      const idle = this.reducedMotion && !this.dragging && this.velocity === 0 && this.hop === 0;
      if (idle) {
        this.running = false;
        return;
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  renderOnce() {
    if (this.renderer && !this.running) {
      this.animate(this.clock ? this.clock.elapsedTime : 0, 0);
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    if (this.scene) disposeObject(this.scene);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement.remove();
    }
    this.scene = null;
    this.renderer = null;
  }
}
