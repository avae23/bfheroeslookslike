import * as THREE from 'three';
import { toon, addOutline } from './toon.js';
import { GRAVITY } from './physics.js';

const FUSE = 1.6;
const R = 0.18;

export class Grenade {
  constructor(scene, pos, vel) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 1), toon(0x4f7a2a, { unique: true }));
    shell.castShadow = true;
    addOutline(shell, 0.03);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), toon(0xd9b44a));
    pin.position.y = R;
    this.mesh.add(shell, pin);
    this.shell = shell;
    this.mesh.position.copy(pos);
    scene.add(this.mesh);

    this.vel = vel.clone();
    this.time = 0;
    this.done = false;
  }

  // Returns the explosion position once the fuse runs out.
  update(dt, colliders) {
    this.time += dt;
    this.vel.y -= GRAVITY * dt;
    const p = this.mesh.position;

    for (const axis of ['x', 'y', 'z']) {
      const prev = p[axis];
      p[axis] += this.vel[axis] * dt;
      let hit = p.y - R < 0 && axis === 'y';
      if (hit) p.y = R;
      for (const b of colliders) {
        if (
          p.x + R > b.min.x && p.x - R < b.max.x &&
          p.y + R > b.min.y && p.y - R < b.max.y &&
          p.z + R > b.min.z && p.z - R < b.max.z
        ) {
          p[axis] = prev;
          hit = true;
          break;
        }
      }
      if (hit) {
        this.vel[axis] *= -0.4;
        const fr = axis === 'y' ? 0.7 : 0.85;
        for (const o of ['x', 'y', 'z']) if (o !== axis) this.vel[o] *= fr;
      }
    }

    this.mesh.rotation.x += this.vel.z * dt * 3;
    this.mesh.rotation.z -= this.vel.x * dt * 3;

    // Blink faster as the fuse runs down
    const blink = Math.sin(this.time * (8 + this.time * 20)) > 0;
    this.shell.material.emissive.setHex(blink ? 0xff3322 : 0x000000);
    this.shell.material.emissiveIntensity = 0.7;

    if (this.time >= FUSE) {
      this.done = true;
      this.scene.remove(this.mesh);
      this.shell.material.dispose();
      return p.clone();
    }
    return null;
  }
}
