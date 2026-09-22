/**
 * Low-poly 3D decorations sold in the shop (shop_items.meta.model).
 * buildDecoration(THREE, model) → { object, update(time) } or null.
 */

function mat(THREE, color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
}

function glowTexture(THREE, rgb) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${rgb}, 0.9)`);
  gradient.addColorStop(0.4, `rgba(${rgb}, 0.35)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowSprite(THREE, rgb, scale) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(THREE, rgb),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function tree(THREE) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 6), mat(THREE, 0x7b4a2d));
  trunk.position.y = 0.25;
  group.add(trunk);
  const greens = [0x2d6a4f, 0x40916c, 0x52b788];
  [[0.62, 0.8, 0.72], [0.48, 0.7, 1.12], [0.32, 0.55, 1.48]].forEach(([r, h, y], i) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat(THREE, greens[i]));
    cone.position.y = y;
    group.add(cone);
  });
  return { object: group, update: (t) => { group.rotation.z = Math.sin(t * 1.3) * 0.025; } };
}

function lamp(THREE) {
  const group = new THREE.Group();
  const dark = mat(THREE, 0x37474f, { roughness: 0.5, metalness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8), dark);
  base.position.y = 0.06;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.35, 8), dark);
  post.position.y = 0.72;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffc94d, emissiveIntensity: 1.4 }),
  );
  bulb.position.y = 1.5;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 8), dark);
  cap.position.y = 1.66;
  const glow = glowSprite(THREE, '255, 214, 102', 1.3);
  glow.position.y = 1.5;
  group.add(base, post, bulb, cap, glow);
  return {
    object: group,
    update: (t) => {
      const flicker = 1.25 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.04;
      glow.scale.set(flicker, flicker, 1);
    },
  };
}

function snowman(THREE) {
  const group = new THREE.Group();
  const snow = mat(THREE, 0xf8f9fa, { roughness: 1 });
  [[0.42, 0.42], [0.31, 1.0], [0.22, 1.43]].forEach(([r, y]) => {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), snow);
    ball.position.y = y;
    group.add(ball);
  });
  const coal = mat(THREE, 0x212529);
  [-0.08, 0.08].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), coal);
    eye.position.set(x, 1.49, 0.19);
    group.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 6), mat(THREE, 0xf77f00));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.42, 0.3);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12), coal);
  brim.position.y = 1.62;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12), coal);
  hat.position.y = 1.76;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 14), mat(THREE, 0xe63946));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.24;
  group.add(nose, brim, hat, scarf);
  return { object: group, update: (t) => { group.rotation.y = Math.sin(t * 0.6) * 0.25; } };
}

function campfire(THREE) {
  const group = new THREE.Group();
  const stone = mat(THREE, 0x9e9e9e);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), stone);
    rock.position.set(Math.cos(angle) * 0.42, 0.07, Math.sin(angle) * 0.42);
    group.add(rock);
  }
  const wood = mat(THREE, 0x6d4c41);
  for (let i = 0; i < 4; i += 1) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 6), wood);
    log.rotation.z = Math.PI / 2.6;
    log.rotation.y = (i / 4) * Math.PI * 2;
    log.position.y = 0.16;
    group.add(log);
  }
  const flames = [
    [0xff6b00, 0.2, 0.55],
    [0xffb703, 0.14, 0.42],
    [0xfff3b0, 0.08, 0.28],
  ].map(([color, r, h]) => {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
    );
    flame.position.y = 0.2 + h / 2;
    group.add(flame);
    return flame;
  });
  const glow = glowSprite(THREE, '255, 140, 40', 1.6);
  glow.position.y = 0.45;
  group.add(glow);
  return {
    object: group,
    update: (t) => {
      flames.forEach((flame, i) => {
        const s = 1 + Math.sin(t * 11 + i * 2) * 0.14 + Math.sin(t * 17 + i) * 0.06;
        flame.scale.set(1, s, 1);
        flame.rotation.y = t * (1.5 + i);
      });
      const g = 1.5 + Math.sin(t * 13) * 0.12;
      glow.scale.set(g, g, 1);
    },
  };
}

function windmill(THREE) {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 1.8, 6), mat(THREE, 0xfff1d6));
  tower.position.y = 0.9;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.45, 6), mat(THREE, 0xd62828));
  roof.position.y = 2.02;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.04), mat(THREE, 0x6d4c41));
  door.position.set(0, 0.17, 0.37);
  const blades = new THREE.Group();
  blades.position.set(0, 1.62, 0.34);
  const sail = mat(THREE, 0xf5f5f5);
  for (let i = 0; i < 4; i += 1) {
    const arm = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.02), sail);
    blade.position.y = 0.5;
    arm.add(blade);
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(THREE, 0x6d4c41));
  blades.add(hub);
  group.add(tower, roof, door, blades);
  return { object: group, update: (t) => { blades.rotation.z = -t * 1.4; } };
}

function balloon(THREE) {
  const group = new THREE.Group();
  const craft = new THREE.Group();
  const envelope = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), mat(THREE, 0xef476f));
  envelope.scale.y = 1.15;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.565, 0.565, 0.16, 16, 1, true),
    mat(THREE, 0xffd166, { side: THREE.DoubleSide }),
  );
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), mat(THREE, 0x8d5524));
  basket.position.y = -1.0;
  const rope = mat(THREE, 0x5d4037);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.52, 4), rope);
    line.position.set(x * 0.13, -0.66, z * 0.13);
    craft.add(line);
  });
  craft.add(envelope, band, basket);
  craft.position.y = 2.6;
  group.add(craft);
  return {
    object: group,
    update: (t) => {
      craft.position.y = 2.6 + Math.sin(t * 0.7) * 0.25;
      craft.rotation.y = t * 0.2;
    },
  };
}

function trophy(THREE) {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc933, metalness: 0.75, roughness: 0.28, flatShading: true });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), mat(THREE, 0x5d4037));
  base.position.y = 0.11;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), gold);
  plinth.position.y = 0.29;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.42, 10), gold);
  stem.position.y = 0.56;
  const profile = [
    [0.02, 0], [0.18, 0.02], [0.3, 0.16], [0.36, 0.42], [0.38, 0.62], [0.34, 0.64], [0.3, 0.44], [0.24, 0.2], [0.02, 0.12],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 16), gold);
  cup.position.y = 0.74;
  const handleGeo = new THREE.TorusGeometry(0.16, 0.035, 6, 14, Math.PI);
  [-1, 1].forEach((side) => {
    const handle = new THREE.Mesh(handleGeo, gold);
    handle.rotation.z = side * -Math.PI / 2;
    handle.position.set(side * 0.36, 1.08, 0);
    group.add(handle);
  });
  const star = glowSprite(THREE, '255, 230, 140', 0.9);
  star.position.y = 1.5;
  group.add(base, plinth, stem, cup, star);
  return {
    object: group,
    update: (t) => {
      group.rotation.y = t * 0.5;
      const s = 0.8 + Math.sin(t * 3) * 0.15;
      star.scale.set(s, s, 1);
    },
  };
}

function rocket(THREE) {
  const group = new THREE.Group();
  const ship = new THREE.Group();
  const white = mat(THREE, 0xf1f3f5, { roughness: 0.5 });
  const red = mat(THREE, 0xe63946);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.0, 12), white);
  body.position.y = 0.5;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 12), red);
  nose.position.y = 1.22;
  const window1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x74c0fc, emissive: 0x1c7ed6, emissiveIntensity: 0.6 }),
  );
  window1.position.set(0, 0.7, 0.2);
  for (let i = 0; i < 3; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.24), red);
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.sin(angle) * 0.25, 0.14, Math.cos(angle) * 0.25);
    fin.rotation.y = angle;
    ship.add(fin);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.42, 8),
    new THREE.MeshBasicMaterial({ color: 0xffa94d, transparent: true, opacity: 0.9 }),
  );
  flame.rotation.x = Math.PI;
  flame.position.y = -0.2;
  const glow = glowSprite(THREE, '255, 160, 60', 0.9);
  glow.position.y = -0.2;
  ship.add(body, nose, window1, flame, glow);
  group.add(ship);
  return {
    object: group,
    update: (t) => {
      ship.position.y = 0.45 + Math.sin(t * 2) * 0.12;
      ship.rotation.y = t * 0.6;
      flame.scale.y = 1 + Math.sin(t * 25) * 0.2;
    },
  };
}

const BUILDERS = { tree, lamp, snowman, campfire, windmill, balloon, trophy, rocket };

export const DECORATION_MODELS = Object.keys(BUILDERS);

export function buildDecoration(THREE, model) {
  const builder = BUILDERS[model];
  return builder ? builder(THREE) : null;
}
