import * as THREE from 'three';
import { box, toon, addOutline } from './toon.js';

// Map 01 «Парк поколений», a blockout of the concept art.
// North is -Z. Three levels: lower plaza (y 0), park (y 4), hillside terraces (up to y 7).
// The retaining wall is the south face of the park slab at z = 8; the semicircular stair
// climbs it in the middle.

const PLAZA = 0;
const PARK = 4;
const WALL_Z = 8;
const STEP = 0.4;

const C = {
  paving: 0x8193a8,
  stone: 0xeadcc0,
  stoneDark: 0xd4c3a3,
  steps: 0x8d8580,
  grass: 0x7cc456,
  path: 0xb9b2a6,
  sand: 0xe6cf98,
  trellis: 0x5e3b26,
  rail: 0x2a2a2e,
  redTree: 0xd8344f,
  birch: 0xb7d24a,
  green: 0x6fae3a,
  planter: 0xcfc6b8,
  wood: 0x9a6232,
  cyan: 0x3cc6e0,
  gym: 0x7fc3e6,
  orange: 0xff7a1a,
  purple: 0x8f6fd0,
};

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function pavingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8496ab';
  ctx.fillRect(0, 0, 256, 256);
  const rand = rng(7);
  for (let y = 0; y < 256; y += 32) {
    for (let x = (y / 32) % 2 ? -32 : 0; x < 256; x += 64) {
      const v = 120 + rand() * 25;
      ctx.fillStyle = `rgb(${v - 8},${v + 6},${v + 30})`;
      ctx.fillRect(x + 2, y + 2, 60, 28);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 10);
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.solids = [];
    this.animated = [];
    this.rand = rng(2026);

    this.addLights();
    this.addTerrain();
    this.addGrandStair();
    this.addSideFlights();
    this.addWallDressing();
    this.addPaths();
    this.addTerraces();
    this.addBuildings();
    this.addPlayground();
    this.addGymTerrace();
    this.addPicnic();
    this.addCover();
    this.addTrees();
    this.addFlag();
    this.addBoundary();
    this.buildNav();

    this.playerSpawn = new THREE.Vector3(0, PLAZA, 34);
    this.spawnPoints = [
      [-20, PLAZA, 30], [18, PLAZA, 30], [32, PLAZA, 18], [-40, PLAZA, 28],
      [-22, PARK, -6], [14, PARK, -4], [-8, PARK, -26], [30, PARK, -10], [28, 7, -40],
    ].map(([x, y, z]) => new THREE.Vector3(x, y + 0.05, z));
  }

  // --- building blocks -------------------------------------------------------

  // Box by its footprint and bottom; optionally solid for movement and bullets.
  block(x0, x1, z0, z1, y0, y1, color, { collide = true, outline = 0.03, shadows = true, mat } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat ?? toon(color));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    if (outline) addOutline(mesh, outline);
    this.scene.add(mesh);
    if (collide) this.collide(x0, x1, z0, z1, y0, y1, mesh);
    return mesh;
  }

  collide(x0, x1, z0, z1, y0, y1, mesh) {
    this.colliders.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
    if (mesh) this.solids.push(mesh);
  }

  addLights() {
    this.scene.background = new THREE.Color(0x9fd8f5);
    this.scene.fog = new THREE.Fog(0xbfe3f2, 70, 160);
    this.scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x8a9a5a, 1.3));
    // Late-afternoon sun from the upper left of the concept
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.5);
    sun.position.set(-40, 55, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = c.bottom = -60;
    c.right = c.top = 60;
    c.near = 1;
    c.far = 160;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  addTerrain() {
    // Lower plaza paving everywhere at y = 0
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 100),
      new THREE.MeshToonMaterial({ map: pavingTexture() }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.z = 30;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    this.solids.push(plaza);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon(0x6a9e48));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.02;
    this.scene.add(far);

    // Park slab: grass on top, cream retaining wall on the south face
    const wall = toon(C.stone);
    const mats = [wall, wall, toon(C.grass), wall, wall, wall];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(92, PARK, 58), mats);
    slab.position.set(0, PARK / 2, WALL_Z - 29);
    slab.receiveShadow = true;
    slab.castShadow = true;
    addOutline(slab, 0.05);
    this.scene.add(slab);
    this.collide(-46, 46, WALL_Z - 58, WALL_Z, 0, PARK, slab);
  }

  // Semicircular amphitheatre stair: stacked half-discs, highest in the middle.
  addGrandStair() {
    const count = 10;
    const mat = toon(C.steps);
    for (let k = 0; k < count; k++) {
      const r = 10.5 - k * 0.9;
      const h = (k + 1) * STEP;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, false, -Math.PI / 2, Math.PI), mat);
      disc.position.set(0, h / 2, WALL_Z);
      disc.castShadow = k < 2;
      disc.receiveShadow = true;
      if (k === 0) addOutline(disc, 0.04);
      this.scene.add(disc);
      this.solids.push(disc);
      // Colliders: vertical strips under the half-disc
      const strips = 14;
      for (let i = 0; i < strips; i++) {
        const xa = -r + (2 * r * i) / strips;
        const xb = xa + (2 * r) / strips;
        const xm = Math.min(Math.abs(xa), Math.abs(xb)) + Math.abs(xb - xa) * 0.5;
        const depth = Math.sqrt(Math.max(0, r * r - xm * xm));
        if (depth > 0.05) this.collide(xa, xb, WALL_Z, WALL_Z + depth, 0, h);
      }
    }
    // Central planter splits the lower half into two curved flights
    this.block(-1.8, 1.8, WALL_Z + 2.2, WALL_Z + 6.8, 0, 3.6, C.stone, { outline: 0.04 });
    for (let i = 0; i < 5; i++) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + this.rand() * 0.3, 0), toon(i % 2 ? C.redTree : 0x4f9a3a));
      bush.position.set(-1 + i * 0.5, 3.9, WALL_Z + 3 + (i % 3) * 1.3);
      bush.castShadow = true;
      this.scene.add(bush);
    }
  }

  // Straight flights at both ends of the wall: the flanking routes up.
  addSideFlights() {
    for (const [x0, x1] of [[-43, -37], [37, 43]]) {
      for (let i = 0; i < 10; i++) {
        this.block(x0, x1, WALL_Z, WALL_Z + (10 - i), 0, (i + 1) * STEP, C.steps, { outline: i === 0 ? 0.03 : 0, shadows: false });
      }
      this.block(x0 - 0.6, x0, WALL_Z, WALL_Z + 10, 0, 1.2, C.stoneDark, { outline: 0.02 });
      this.block(x1, x1 + 0.6, WALL_Z, WALL_Z + 10, 0, 1.2, C.stoneDark, { outline: 0.02 });
    }
  }

  // Trellises, pilasters and the railing along the top of the retaining wall.
  addWallDressing() {
    const trellis = toon(C.trellis);
    for (const [xa, xb] of [[-35, -12], [12, 35]]) {
      for (let x = xa; x < xb; x += 7.7) {
        const w = 6.4;
        const frame = new THREE.Group();
        for (let i = 0; i <= 4; i++) {
          const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3, 0.12), trellis);
          v.position.set(-w / 2 + (i * w) / 4, 0, 0);
          frame.add(v);
        }
        for (const y of [-1.5, -0.5, 0.5, 1.5]) {
          const h = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), trellis);
          h.position.y = y;
          frame.add(h);
        }
        frame.position.set(x + w / 2, 2.1, WALL_Z + 0.1);
        this.scene.add(frame);
        for (let i = 0; i < 3; i++) {
          const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + this.rand() * 0.4, 0), toon(0x4f9a3a));
          vine.position.set(x + this.rand() * w, 0.4 + this.rand() * 3, WALL_Z + 0.3);
          this.scene.add(vine);
        }
        // Pilaster between panels
        this.block(x - 0.7, x - 0.1, WALL_Z, WALL_Z + 0.5, 0, PARK + 0.6, C.stoneDark, { outline: 0.03 });
      }
    }

    // Black railing on the wall top, with gaps at the three stairs
    const railMat = toon(C.rail);
    for (const [xa, xb] of [[-37, -10.5], [10.5, 37]]) {
      this.collide(xa, xb, WALL_Z - 0.25, WALL_Z, PARK, PARK + 1.1);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.08, 0.08), railMat);
      rail.position.set((xa + xb) / 2, PARK + 1.05, WALL_Z - 0.12);
      this.scene.add(rail);
      for (let x = xa; x <= xb; x += 1.2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), railMat);
        post.position.set(x, PARK + 0.53, WALL_Z - 0.12);
        this.scene.add(post);
      }
    }
  }

  // Winding grey paths across the park lawn
  addPaths() {
    const y = PARK + 0.02;
    const routes = [
      [[0, WALL_Z - 1], [-2, 0], [-4, -8], [-12, -14], [-24, -20], [-30, -26]],
      [[-4, -8], [-2, -18], [4, -26], [6, -30]],
      [[0, WALL_Z - 1], [8, 2], [16, -2], [28, -6], [38, -12], [42, -16]],
      [[-2, 0], [-14, 2], [-28, 4], [-40, 6]],
      [[16, -2], [14, 4], [22, 5]],
    ];
    const mat = toon(C.path);
    for (const pts of routes) {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, y, z)));
      const samples = curve.getPoints(pts.length * 12);
      const pos = [];
      const idx = [];
      samples.forEach((p, i) => {
        const next = samples[Math.min(i + 1, samples.length - 1)];
        const prev = samples[Math.max(i - 1, 0)];
        const dir = next.clone().sub(prev).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(1.9);
        pos.push(p.x + side.x, y, p.z + side.z, p.x - side.x, y, p.z - side.z);
        if (i > 0) {
          const a = (i - 1) * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  // Top-right hillside: three seat-like tiers and a straight stair on the right edge
  addTerraces() {
    const tiers = [[-18, 5], [-23, 6], [-28, 7]];
    for (const [z0, top] of tiers) {
      const mesh = this.block(10, 38, -50, z0, PARK, top, C.stone, { outline: 0.04 });
      mesh.material = [toon(C.stone), toon(C.stone), toon(C.grass), toon(C.stone), toon(C.stone), toon(C.stone)];
    }
    for (let i = 0; i < 9; i++) {
      this.block(38, 44, -50, -16 - i * 0.9, PARK, PARK + (i + 1) / 3, C.steps, { outline: i === 0 ? 0.03 : 0, shadows: false });
    }
    // Retaining edge along the terraces' left side
    this.block(9.4, 10, -50, -18, PARK, 7.4, C.stoneDark, { outline: 0.03 });
    // Benches on the top terrace
    this.bench(20, 7, -34, 0);
    this.bench(30, 7, -34, 0);
  }

  addBuildings() {
    // Pale beige civic building with a teal metal roof (top left)
    const civic = this.block(-42, -22, -48, -34, PARK, PARK + 8, 0xefe0c2, { outline: 0.06 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(14.5, 3.5, 4), toon(0x7cc7bb));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.68);
    roof.position.set(-32, PARK + 8 + 1.75, -41);
    roof.castShadow = true;
    addOutline(roof, 0.05);
    this.scene.add(roof);
    this.solids.push(roof);
    this.windows(-42, -22, -34, PARK + 2.2, PARK + 5.5, 0xffffff);
    void civic;

    // Small pale yellow house (top centre)
    this.block(-4, 8, -48, -38, PARK, PARK + 6, 0xf6e7a1, { outline: 0.06 });
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(9, 3, 4), toon(0xc9b37a));
    roof2.rotation.y = Math.PI / 4;
    roof2.scale.set(1, 1, 0.8);
    roof2.position.set(2, PARK + 7.5, -43);
    roof2.castShadow = true;
    addOutline(roof2, 0.05);
    this.scene.add(roof2);
    this.solids.push(roof2);
    this.windows(-4, 8, -38, PARK + 1.6, PARK + 4, 0xfffaf0);
    this.block(1.4, 2.6, -38, -37.8, PARK, PARK + 2.2, 0x7a4b2a, { collide: false, outline: 0 });
  }

  windows(x0, x1, z, y0, y1, frame) {
    const glass = toon(0x6fa9c9);
    const frameMat = toon(frame);
    for (let x = x0 + 2; x < x1 - 1; x += 3.2) {
      for (const y of [y0, y1]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 0.1), frameMat);
        f.position.set(x + 0.6, y, z + 0.05);
        const g = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 0.12), glass);
        g.position.set(x + 0.6, y, z + 0.06);
        this.scene.add(f, g);
      }
    }
  }

  // Sandy playground with the cyan globe climbing frame
  addPlayground() {
    const cx = 24;
    const cz = -8;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(8, 20), toon(C.sand));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(cx, PARK + 0.03, cz);
    sand.receiveShadow = true;
    this.scene.add(sand);
    const curb = new THREE.Mesh(new THREE.TorusGeometry(8, 0.2, 4, 20), toon(C.planter));
    curb.rotation.x = Math.PI / 2;
    curb.position.set(cx, PARK + 0.1, cz);
    this.scene.add(curb);

    const frame = new THREE.Group();
    const mat = toon(C.cyan);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.09, 6, 28, Math.PI), mat);
      ring.rotation.y = (i * Math.PI) / 4;
      ring.castShadow = true;
      frame.add(ring);
    }
    for (const [r, y] of [[3.4, 0.1], [3.0, 1.6], [1.8, 2.9]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 28), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      frame.add(ring);
    }
    frame.position.set(cx, PARK, cz);
    this.scene.add(frame);
    // Climbable: a low dome of colliders you can hop onto
    this.collide(cx - 2.2, cx + 2.2, cz - 2.2, cz + 2.2, PARK, PARK + 1.6);
    this.collide(cx - 1.2, cx + 1.2, cz - 1.2, cz + 1.2, PARK, PARK + 2.9);

    this.bench(cx + 9, PARK, cz - 4, -Math.PI / 2);
    this.bench(cx - 2, PARK, cz + 9.5, Math.PI);
  }

  // Lower-right terrace with outdoor gym and the zoomer hangout
  addGymTerrace() {
    const pad = this.block(12, 32, -1, 7.5, PARK, PARK + 0.15, 0xdad6cc, { outline: 0, shadows: false });
    void pad;
    const gym = toon(C.gym);
    const machines = [[16, 2], [20, 4.5], [24, 2], [28, 4.5]];
    for (const [x, z] of machines) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), gym);
      post.position.set(x, PARK + 1.25, z);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), gym);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(x, PARK + 2.2, z);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.9), toon(0x3d6d8a));
      seat.position.set(x, PARK + 0.8, z + 0.4);
      for (const m of [post, bar, seat]) {
        m.castShadow = true;
        this.scene.add(m);
      }
      this.collide(x - 0.4, x + 0.4, z - 0.3, z + 0.9, PARK, PARK + 1.2, post);
    }
    // Zoomer hangout: speaker and scooter
    const speaker = this.block(29.5, 30.7, -0.2, 0.8, PARK + 0.15, PARK + 1.6, C.cyan, { outline: 0.03 });
    void speaker;
    for (const y of [0.6, 1.15]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), toon(C.purple, { emissive: C.purple, emissiveIntensity: 0.4 }));
      cone.rotation.x = Math.PI / 2;
      cone.position.set(30.1, PARK + 0.15 + y, 0.82);
      this.scene.add(cone);
    }
    const scooter = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 1.2), toon(C.purple));
    deck.position.y = 0.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), toon(0x2a2a2e));
    stem.position.set(0, 0.75, -0.55);
    stem.rotation.x = 0.15;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), toon(0x2a2a2e));
    handle.position.set(0, 1.3, -0.62);
    scooter.add(deck, stem, handle);
    scooter.position.set(27.5, PARK + 0.15, 0.5);
    scooter.rotation.y = 0.6;
    this.scene.add(scooter);
    this.bench(14, PARK + 0.15, 6.4, Math.PI);
  }

  // Boomer picnic on the lower-left plaza: barbecue, fishing chair, cooler
  addPicnic() {
    const x = -30;
    const z = 30;
    this.bench(x - 3, PLAZA, z - 3, 0.3);
    this.bench(x + 3, PLAZA, z + 2, -1.2);
    // Mangal on legs
    const grill = this.block(x - 0.9, x + 0.9, z - 0.4, z + 0.4, 0.7, 1.05, 0x3a3a3a, { outline: 0.02 });
    void grill;
    for (const [dx, dz] of [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), toon(0x3a3a3a));
      leg.position.set(x + dx, 0.35, z + dz);
      this.scene.add(leg);
    }
    this.collide(x - 0.9, x + 0.9, z - 0.4, z + 0.4, 0, 1.05);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.6), toon(0xff6a2a, { emissive: 0xff4a10, emissiveIntensity: 0.8 }));
    coals.position.set(x, 1.06, z);
    this.scene.add(coals);
    this.smoke = { x, y: 1.3, z, t: 0, puffs: [] };

    // Folded fishing chair and a battered cooler
    const chair = new THREE.Group();
    const cloth = toon(C.orange);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.6), cloth);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.06), cloth);
    back.position.set(0, 0.85, 0.3);
    back.rotation.x = -0.2;
    chair.add(seat, back);
    for (const dx of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), toon(0x2a2a2e));
      leg.position.set(dx, 0.25, 0);
      leg.rotation.x = 0.5;
      chair.add(leg);
    }
    chair.position.set(x + 2.4, 0, z - 1.5);
    chair.rotation.y = -0.6;
    this.scene.add(chair);
    this.block(x - 2.8, x - 1.8, z + 0.8, z + 1.5, 0, 0.7, C.orange, { outline: 0.03 });
  }

  bench(x, y, z, rot) {
    const g = new THREE.Group();
    const wood = toon(C.wood);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), wood);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), wood);
    back.position.set(0, 0.85, 0.28);
    g.add(seat, back);
    for (const dx of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.6), toon(C.rail));
      leg.position.set(dx, 0.25, 0);
      g.add(leg);
    }
    g.traverse((m) => (m.castShadow = true));
    g.position.set(x, y, z);
    g.rotation.y = rot;
    this.scene.add(g);
    const along = Math.abs(Math.cos(rot)) > 0.5;
    const hw = along ? 1.1 : 0.35;
    const hd = along ? 0.35 : 1.1;
    this.collide(x - hw, x + hw, z - hd, z + hd, y, y + 0.6, seat);
  }

  // Waist-high cover: concrete planters with flowers, maintenance crates, rocks, bins
  addCover() {
    const planters = [
      // plaza
      [-24, 16, PLAZA], [-12, 26, PLAZA], [14, 22, PLAZA], [26, 32, PLAZA], [6, 38, PLAZA], [-10, 23, PLAZA],
      // park
      [-8, -4, PARK], [4, -14, PARK], [-18, -10, PARK], [8, 4, PARK], [-26, -2, PARK],
    ];
    for (const [x, z, y] of planters) {
      this.block(x - 1.2, x + 1.2, z - 1.2, z + 1.2, y, y + 1.1, C.planter, { outline: 0.03 });
      const flowers = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), toon(this.rand() > 0.5 ? 0x5fa83c : 0xd84a6a));
      flowers.position.set(x, y + 1.3, z);
      flowers.scale.y = 0.6;
      flowers.castShadow = true;
      this.scene.add(flowers);
    }

    const crates = [[22, 12, PLAZA], [30, 24, PLAZA], [-16, 36, PLAZA], [34, 5, PARK], [-34, -12, PARK], [-40, 2, PARK]];
    for (const [x, z, y] of crates) {
      const s = 1.2;
      this.block(x - s / 2, x + s / 2, z - s / 2, z + s / 2, y, y + s, 0xb88a4f, { outline: 0.03 });
      this.block(x + 0.3, x + 1.3, z - 0.2, z + 0.8, y, y + 1, 0xa87a42, { outline: 0.03 });
    }

    const rocks = [[-12, -16], [10, -20], [-4, -32], [-30, -14]];
    for (const [x, z] of rocks) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), toon(0x9a958c));
      rock.scale.y = 0.6;
      rock.position.set(x, PARK + 0.5, z);
      rock.castShadow = true;
      addOutline(rock, 0.03);
      this.scene.add(rock);
      this.collide(x - 1.1, x + 1.1, z - 1.1, z + 1.1, PARK, PARK + 1.1, rock);
    }

    // Benches along the wall on the plaza
    for (const x of [-26, -16, 16, 26]) this.bench(x, PLAZA, WALL_Z + 1.2, Math.PI);
    for (const [x, z] of [[-14, -2], [6, -10], [-20, -24]]) this.bench(x, PARK, z, this.rand() * Math.PI);

    // Street lamps
    const lampMat = toon(C.rail);
    const glow = toon(0xfff2c0, { emissive: 0xffd88a, emissiveIntensity: 0.6 });
    for (const [x, z, y] of [[-12, 12, PLAZA], [12, 14, PLAZA], [-20, 34, PLAZA], [3, -4, PARK], [-14, -16, PARK], [14, -14, PARK], [34, -2, PARK]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4, 6), lampMat);
      post.position.set(x, y + 2, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), glow);
      head.position.set(x, y + 4.2, z);
      post.castShadow = true;
      this.scene.add(post, head);
      this.collide(x - 0.15, x + 0.15, z - 0.15, z + 0.15, y, y + 4, post);
    }
  }

  tree(x, y, z, kind, s = 1) {
    const trunkColor = kind === 'birch' ? 0xf2f0ea : 0x6e4a32;
    const trunk = this.block(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s, y, y + 3 * s, trunkColor, { outline: 0.02 });
    if (kind === 'birch') {
      for (let i = 0; i < 4; i++) {
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.52 * s, 0.08, 0.2), toon(0x222222));
        mark.position.set(x, y + 0.6 + i * 0.6 * s, z - 0.05);
        this.scene.add(mark);
      }
    }
    void trunk;
    const color = kind === 'red' ? C.redTree : kind === 'birch' ? C.birch : C.green;
    const lumps = kind === 'red' ? 4 : 3;
    for (let i = 0; i < lumps; i++) {
      const r = (1.3 + this.rand() * 0.6) * s;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), toon(i === 0 ? color : new THREE.Color(color).offsetHSL(0, 0, 0.06).getHex()));
      crown.position.set(x + (this.rand() - 0.5) * 1.6 * s, y + (3.2 + this.rand() * 1.4) * s, z + (this.rand() - 0.5) * 1.6 * s);
      crown.castShadow = true;
      if (i === 0) addOutline(crown, 0.04);
      this.scene.add(crown);
      this.solids.push(crown);
    }
  }

  addTrees() {
    // Red ornamental trees in square planters on the plaza, as in the photo
    for (const [x, z] of [[-34, 14], [-18, 20], [12, 30], [-38, 38], [36, 34], [24, 18]]) {
      this.block(x - 1.4, x + 1.4, z - 1.4, z + 1.4, PLAZA, PLAZA + 0.9, C.planter, { outline: 0.03 });
      this.tree(x, PLAZA + 0.9, z, 'red', 0.9);
    }
    const park = [
      [-30, -6, 'red'], [-20, -16, 'birch'], [-36, -20, 'green'], [-10, -36, 'green'], [12, -30, 'red'],
      [18, -18, 'birch'], [34, -14, 'red'], [-40, -28, 'birch'], [36, -2, 'birch'], [-16, 4, 'green'],
      [-42, 2, 'green'], [40, -4, 'red'], [-6, -20, 'birch'],
    ];
    for (const [x, z, kind] of park) this.tree(x, PARK, z, kind, 1);
    for (const [x, z, kind] of [[16, -40, 'birch'], [26, -44, 'red'], [34, -40, 'green']]) this.tree(x, 7, z, kind, 1);
  }

  // Neutral capture flag on the upper central path junction
  addFlag() {
    const x = -4;
    const z = -8;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.3, 10), toon(C.planter));
    base.position.set(x, PARK + 0.15, z);
    base.receiveShadow = true;
    this.scene.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), toon(0x3a3a3e));
    pole.position.set(x, PARK + 3, z);
    pole.castShadow = true;
    this.scene.add(pole);
    this.collide(x - 0.15, x + 0.15, z - 0.15, z + 0.15, PARK, PARK + 6, pole);

    const geo = new THREE.PlaneGeometry(2.2, 1.3, 8, 3);
    geo.translate(1.1, 0, 0);
    const flag = new THREE.Mesh(geo, toon(0xfaf6ea, { side: THREE.DoubleSide }));
    flag.position.set(x + 0.08, PARK + 5.3, z);
    flag.castShadow = true;
    this.scene.add(flag);
    const rest = geo.attributes.position.array.slice();
    this.animated.push((t) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = rest[i * 3];
        p.setZ(i, Math.sin(px * 2.2 - t * 5) * 0.18 * (px / 2.2));
      }
      p.needsUpdate = true;
    });
  }

  addBoundary() {
    // Invisible walls just inside a ring of trees
    const H = 14;
    this.collide(-47, -46, -52, 44, 0, H);
    this.collide(46, 47, -52, 44, 0, H);
    this.collide(-47, 47, -52, -51, 0, H);
    this.collide(-47, 47, 43, 44, 0, H);
    // Plaza edge: a low cream parapet on the south with a hedge
    this.block(-46, 46, 42, 43, 0, 0.9, C.stoneDark, { outline: 0.03 });
    for (let x = -44; x <= 44; x += 4) {
      const hedge = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), toon(0x5a9a3a));
      hedge.position.set(x, 1.2, 43.4);
      this.scene.add(hedge);
    }
    // Tree line around the park
    for (let z = -48; z <= 6; z += 6) {
      this.tree(-45, PARK, z + this.rand() * 2, this.rand() > 0.7 ? 'red' : 'green', 1.1);
      this.tree(45, PARK, z + this.rand() * 2, this.rand() > 0.7 ? 'birch' : 'green', 1.1);
    }
    for (let x = -36; x <= 36; x += 7) {
      if (Math.abs(x - 2) < 8 || x < -20) continue;
      this.tree(x, 7, -48, 'green', 1.1);
    }
  }

  // Waypoint graph so bots can find the stairs between levels
  buildNav() {
    const n = {
      picnic: [-28, 26], plazaW: [-16, 30], plazaC: [0, 30], plazaE: [18, 28], plazaSE: [32, 18],
      stairFoot: [0, 22], flightL: [-6, 15], flightR: [6, 15], stairTop: [0, 4],
      westFoot: [-40, 22], westTop: [-40, 4], eastFoot: [40, 22], eastTop: [40, 4],
      flag: [-2, -10], parkW: [-22, -4], civic: [-28, -26], parkN: [2, -28], parkE: [12, -4],
      gym: [22, 2], terraceFoot: [41, -12], terraceTop: [41, -40], terraceMid: [24, -40],
    };
    const edges = [
      ['picnic', 'plazaW'], ['plazaW', 'plazaC'], ['plazaC', 'plazaE'], ['plazaE', 'plazaSE'],
      ['plazaC', 'stairFoot'], ['stairFoot', 'flightL'], ['stairFoot', 'flightR'],
      ['flightL', 'stairTop'], ['flightR', 'stairTop'], ['plazaW', 'flightL'], ['plazaE', 'flightR'],
      ['picnic', 'westFoot'], ['westFoot', 'westTop'], ['westTop', 'parkW'],
      ['plazaSE', 'eastFoot'], ['eastFoot', 'eastTop'], ['eastTop', 'gym'], ['eastTop', 'terraceFoot'],
      ['stairTop', 'flag'], ['stairTop', 'parkE'], ['flag', 'parkW'], ['parkW', 'civic'],
      ['flag', 'parkN'], ['civic', 'parkN'], ['parkE', 'gym'], ['parkE', 'terraceFoot'],
      ['terraceFoot', 'terraceTop'], ['terraceTop', 'terraceMid'], ['flag', 'parkE'],
    ];
    this.nav = Object.entries(n).map(([id, [x, z]]) => ({ id, pos: new THREE.Vector3(x, 0, z), links: [] }));
    const byId = Object.fromEntries(this.nav.map((node) => [node.id, node]));
    for (const [a, b] of edges) {
      byId[a].links.push(byId[b]);
      byId[b].links.push(byId[a]);
    }
  }

  nearestNode(pos) {
    let best = this.nav[0];
    let bestD = Infinity;
    for (const node of this.nav) {
      const d = (node.pos.x - pos.x) ** 2 + (node.pos.z - pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }

  // Breadth-first route between two nodes, as a list of points
  route(from, to) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const node = queue.shift();
      if (node === to) break;
      for (const next of node.links) {
        if (!prev.has(next)) {
          prev.set(next, node);
          queue.push(next);
        }
      }
    }
    const path = [];
    for (let node = to; node; node = prev.get(node)) path.unshift(node.pos);
    return path;
  }

  update(dt, time) {
    for (const fn of this.animated) fn(time);
    // Barbecue smoke
    const s = this.smoke;
    s.t -= dt;
    if (s.t <= 0) {
      s.t = 0.35;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), toon(0xeeeeee, { transparent: true, unique: true }));
      puff.position.set(s.x + (this.rand() - 0.5) * 0.6, s.y, s.z);
      this.scene.add(puff);
      s.puffs.push({ m: puff, life: 0 });
    }
    s.puffs = s.puffs.filter((p) => {
      p.life += dt;
      p.m.position.y += dt * 0.9;
      p.m.position.x += dt * 0.3;
      p.m.scale.setScalar(1 + p.life * 1.5);
      p.m.material.opacity = Math.max(0, 0.8 - p.life * 0.32);
      if (p.life > 2.5) {
        this.scene.remove(p.m);
        p.m.geometry.dispose();
        p.m.material.dispose();
        return false;
      }
      return true;
    });
  }
}
