import * as THREE from 'three';
import { box, toon, addOutline } from './toon.js';

export const MAP_HALF = 45;

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Blocky cartoon town. Exposes AABB colliders for movement and meshes for raycasts.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.solids = [];
    this.spawnPoints = [];
    const rand = rng(1337);

    this.addLights();
    this.addGround();

    // Houses around the central plaza
    const houses = [
      [-16, -16, 8, 5, 7, 0xf4e1c1, 0xd9573b],
      [16, -16, 7, 4.5, 8, 0xc9e4f2, 0x3b6fd9],
      [-16, 16, 9, 4, 6, 0xf2d0e4, 0x8a4ab0],
      [16, 16, 7, 6, 7, 0xfff2a8, 0xd9573b],
      [0, -30, 12, 5, 6, 0xe8d6b8, 0x5e8f3b],
      [-31, 0, 6, 7, 10, 0xd4ecd0, 0xb0743b],
      [31, 2, 6, 5, 12, 0xf4e1c1, 0x3b6fd9],
      [0, 31, 10, 4.5, 7, 0xc9e4f2, 0xd9573b],
      [-30, -30, 7, 4, 7, 0xfff2a8, 0x8a4ab0],
      [30, -30, 8, 5, 6, 0xf2d0e4, 0x5e8f3b],
      [30, 30, 7, 6, 7, 0xd4ecd0, 0xd9573b],
      [-30, 30, 8, 4.5, 8, 0xe8d6b8, 0x3b6fd9],
    ];
    for (const [x, z, w, h, d, wall, roof] of houses) this.addHouse(x, z, w, h, d, wall, roof);

    // Central watchtower with a platform you can jump onto from the crates
    this.addSolid(box(4, 2.2, 4, 0xb98a5a, { outline: 0.04 }), 0, 1.1, 0);
    this.addSolid(box(5, 0.4, 5, 0x8a603a, { outline: 0.04 }), 0, 2.4, 0);
    const towerFlag = box(0.15, 3, 0.15, 0x5a4030);
    towerFlag.position.set(2, 4, 2);
    const flag = box(1.4, 0.8, 0.05, 0xff6b3d);
    flag.position.set(2.7, 5, 2);
    this.scene.add(towerFlag, flag);
    for (const [x, z] of [[3.2, 0], [4.2, 0.6]]) this.addSolid(box(1.2, 1.2, 1.2, 0xc8964f, { outline: 0.03 }), x, 0.6, z);

    // Crates and sandbag cover
    for (let i = 0; i < 28; i++) {
      const x = (rand() - 0.5) * 70;
      const z = (rand() - 0.5) * 70;
      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
      const s = 1 + rand() * 0.6;
      const crate = this.addSolid(box(s, s, s, 0xc8964f, { outline: 0.03 }), x, s / 2, z);
      if (this.overlapsOther(crate)) this.removeSolid(crate);
    }
    for (let i = 0; i < 12; i++) {
      const x = (rand() - 0.5) * 60;
      const z = (rand() - 0.5) * 60;
      const horiz = rand() > 0.5;
      const bags = this.addSolid(
        box(horiz ? 4 : 1, 1, horiz ? 1 : 4, 0xd8c79a, { outline: 0.03 }),
        x, 0.5, z,
      );
      if (this.overlapsOther(bags) || (Math.abs(x) < 5 && Math.abs(z) < 5)) this.removeSolid(bags);
    }

    // Trees
    for (let i = 0; i < 26; i++) {
      const x = (rand() - 0.5) * 82;
      const z = (rand() - 0.5) * 82;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      this.addTree(x, z, 0.8 + rand() * 0.6);
    }

    // Border walls keep everyone in the arena
    const L = MAP_HALF * 2 + 2;
    this.addSolid(box(L, 3, 2, 0x9a8a78, { outline: 0.05 }), 0, 1.5, -MAP_HALF - 1);
    this.addSolid(box(L, 3, 2, 0x9a8a78, { outline: 0.05 }), 0, 1.5, MAP_HALF + 1);
    this.addSolid(box(2, 3, L, 0x9a8a78, { outline: 0.05 }), -MAP_HALF - 1, 1.5, 0);
    this.addSolid(box(2, 3, L, 0x9a8a78, { outline: 0.05 }), MAP_HALF + 1, 1.5, 0);

    this.addClouds(rand);

    for (let x = -36; x <= 36; x += 12) {
      for (let z = -36; z <= 36; z += 12) {
        if (!this.blocked(x, z, 1.5)) this.spawnPoints.push(new THREE.Vector3(x, 0, z));
      }
    }
  }

  addLights() {
    this.scene.background = new THREE.Color(0x8fd3ff);
    this.scene.fog = new THREE.Fog(0x8fd3ff, 60, 140);
    this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0x7aa35a, 1.4));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = c.bottom = -55;
    c.right = c.top = 55;
    c.near = 1;
    c.far = 140;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  addGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), toon(0x7cc456));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.solids.push(ground);

    const roadMat = toon(0xe2c98f);
    for (const [w, d] of [[8, 90], [90, 8]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.y = 0.01;
      road.receiveShadow = true;
      this.scene.add(road);
    }
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(11, 8), toon(0xd6b97a));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
  }

  addHouse(x, z, w, h, d, wallColor, roofColor) {
    this.addSolid(box(w, h, d, wallColor, { outline: 0.05 }), x, h / 2, z);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.6, 4), toon(roofColor));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roof.position.set(x, h + h * 0.3, z);
    roof.castShadow = true;
    addOutline(roof, 0.05);
    this.scene.add(roof);
    this.solids.push(roof);

    // Door and windows on every side, just decoration
    const door = box(1.2, 2, 0.1, 0x7a4b2a, { shadows: false });
    door.position.set(x, 1, z + d / 2 + 0.05);
    this.scene.add(door);
    const winMat = toon(0x6fc3ff);
    for (const side of [-1, 1]) {
      for (const off of [-w / 4, w / 4]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), winMat);
        win.position.set(x + off, h * 0.62, z + side * (d / 2 + 0.05));
        if (side === 1 && Math.abs(off) < 1.2) continue;
        this.scene.add(win);
      }
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 1), winMat);
      win.position.set(x + side * (w / 2 + 0.05), h * 0.62, z);
      this.scene.add(win);
    }
  }

  addTree(x, z, s) {
    if (this.blocked(x, z, 1.5)) return;
    const trunk = box(0.5 * s, 2 * s, 0.5 * s, 0x8a5a3a, { outline: 0.03 });
    this.addSolid(trunk, x, s, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * s, 0), toon(0x4fa83a));
    leaves.position.set(x, 2.8 * s, z);
    leaves.castShadow = true;
    addOutline(leaves, 0.04);
    this.scene.add(leaves);
    this.solids.push(leaves);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1 * s, 0), toon(0x68c24d));
    top.position.set(x + 0.3 * s, 3.8 * s, z - 0.2 * s);
    top.castShadow = true;
    this.scene.add(top);
  }

  addClouds(rand) {
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rand() * 2, 0), mat);
        puff.position.set(j * 2.5, rand(), rand() * 2);
        cloud.add(puff);
      }
      cloud.position.set((rand() - 0.5) * 160, 30 + rand() * 12, (rand() - 0.5) * 160);
      this.scene.add(cloud);
    }
  }

  addSolid(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    mesh.updateMatrixWorld();
    const aabb = new THREE.Box3().setFromObject(mesh, true);
    // Outline children inflate the box; use the raw geometry bounds instead.
    mesh.geometry.computeBoundingBox();
    aabb.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    mesh.userData.aabb = aabb;
    this.colliders.push(aabb);
    this.solids.push(mesh);
    return mesh;
  }

  removeSolid(mesh) {
    this.scene.remove(mesh);
    this.colliders.splice(this.colliders.indexOf(mesh.userData.aabb), 1);
    this.solids.splice(this.solids.indexOf(mesh), 1);
  }

  overlapsOther(mesh) {
    const a = mesh.userData.aabb.clone().expandByScalar(1.2);
    return this.colliders.some((b) => b !== mesh.userData.aabb && a.intersectsBox(b));
  }

  blocked(x, z, r) {
    return this.colliders.some(
      (b) => x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && b.min.y < 1.8,
    );
  }
}
