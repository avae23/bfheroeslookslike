import * as THREE from 'three';
import { toon } from './toon.js';

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const sphereGeo = new THREE.IcosahedronGeometry(1, 1);
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const ringGeo = new THREE.RingGeometry(0.8, 1, 32);

function fadeMat(color, opts = {}) {
  return toon(color, { transparent: true, unique: true, ...opts });
}

function textSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 84px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#2b1a10';
  ctx.strokeText(text, 128, 64);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 10;
  return sprite;
}

// Short-lived visual effects. Each effect is an update(dt) that returns false when done.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  update(dt) {
    this.list = this.list.filter((fx) => {
      const alive = fx.update(dt);
      if (!alive) fx.dispose();
      return alive;
    });
  }

  add(objects, update) {
    for (const o of objects) this.scene.add(o);
    this.list.push({
      update,
      dispose: () => {
        for (const o of objects) {
          this.scene.remove(o);
          o.traverse?.((m) => {
            if (!m.material || m.material.userData.shared) return;
            m.material.map?.dispose();
            m.material.dispose();
          });
        }
      },
    });
  }

  explosion(pos, radius) {
    let t = 0;

    // Toon fireball: pops out with overshoot, then shrinks away
    const fire = new THREE.Mesh(sphereGeo, fadeMat(0xff8a2b, { emissive: 0xff5a1a, emissiveIntensity: 0.6 }));
    const core = new THREE.Mesh(sphereGeo, fadeMat(0xfff27a, { emissive: 0xffd23a, emissiveIntensity: 0.9 }));
    fire.position.copy(pos);
    core.position.copy(pos);

    // Ground shockwave ring
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, Math.max(0.05, pos.y - 0.3), pos.z);

    const light = new THREE.PointLight(0xffa040, 60, radius * 4, 2);
    light.position.copy(pos).y += 1;

    const boom = textSprite(Math.random() < 0.5 ? 'БАХ!' : 'БУМ!', '#ffd23a');
    boom.position.copy(pos).y += radius * 0.9;

    // Smoke puffs drifting outward and up
    const puffs = [];
    for (let i = 0; i < 14; i++) {
      const shade = 0.75 + Math.random() * 0.2;
      const m = new THREE.Mesh(puffGeo, fadeMat(new THREE.Color(shade, shade, shade * 0.98)));
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), 0.6 + Math.random() * 0.9, Math.sin(a)).multiplyScalar(3 + Math.random() * 4);
      m.position.copy(pos);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      puffs.push({ m, v, size: 0.6 + Math.random() * 0.8, delay: Math.random() * 0.08 });
    }

    // Chunky debris
    const debris = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(cubeGeo, toon(i % 2 ? 0x4a3a2a : 0x6b5236));
      const s = 0.12 + Math.random() * 0.15;
      m.scale.setScalar(s);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 6, 6 + Math.random() * 6, Math.sin(a) * 6).multiplyScalar(0.6 + Math.random() * 0.6);
      debris.push({ m, v, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0) });
    }

    this.add([fire, core, ring, light, boom, ...puffs.map((p) => p.m), ...debris.map((d) => d.m)], (dt) => {
      t += dt;

      const grow = Math.min(t / 0.18, 1);
      const s = radius * 0.55 * easeOutBack(grow) * (t > 0.25 ? Math.max(0, 1 - (t - 0.25) / 0.35) : 1);
      fire.scale.setScalar(Math.max(s, 0.001));
      core.scale.setScalar(Math.max(s * 0.6, 0.001));
      fire.material.opacity = core.material.opacity = t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.2);

      const rt = Math.min(t / 0.45, 1);
      ring.scale.setScalar(0.5 + radius * 1.4 * easeOutCubic(rt));
      ring.material.opacity = 1 - rt;

      light.intensity = Math.max(0, 60 * (1 - t / 0.35));

      const bt = Math.min(t / 0.25, 1);
      boom.scale.set(4 * easeOutBack(bt), 2 * easeOutBack(bt), 1);
      boom.position.y += dt * 1.5;
      boom.material.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.3);

      for (const p of puffs) {
        const pt = Math.max(0, t - p.delay);
        p.m.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(Math.exp(-dt * 3));
        p.v.y += dt * 1.5;
        const life = pt / 1.4;
        p.m.scale.setScalar(Math.max(0.001, p.size * (life < 0.2 ? life / 0.2 : 1) * (1.6 - life)));
        p.m.material.opacity = Math.max(0, 1 - life * life);
      }

      for (const d of debris) {
        d.v.y -= 24 * dt;
        d.m.position.addScaledVector(d.v, dt);
        if (d.m.position.y < 0.05) {
          d.m.position.y = 0.05;
          d.v.multiplyScalar(0.4);
          d.v.y = Math.abs(d.v.y) * 0.4;
        }
        d.m.rotation.x += d.spin.x * dt;
        d.m.rotation.y += d.spin.y * dt;
      }

      return t < 1.5;
    });
  }

  muzzleFlash(pos, dir) {
    let t = 0;
    const flash = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    flash.position.copy(pos);
    flash.scale.set(0.18, 0.18, 0.35);
    flash.lookAt(pos.clone().add(dir));
    flash.rotation.z = Math.random() * Math.PI;
    this.add([flash], (dt) => {
      t += dt;
      return t < 0.05;
    });
  }

  tracer(from, to) {
    let t = 0;
    const dir = to.clone().sub(from);
    const len = dir.length();
    const geo = new THREE.BoxGeometry(0.05, 0.05, len);
    geo.translate(0, 0, len / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true }));
    mesh.position.copy(from);
    mesh.lookAt(to);
    this.add([mesh], (dt) => {
      t += dt;
      mesh.material.opacity = 1 - t / 0.08;
      if (t >= 0.08) geo.dispose();
      return t < 0.08;
    });
  }

  impact(pos, normal, color = 0xfff3b0) {
    let t = 0;
    const sparks = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color }));
      m.scale.setScalar(0.08);
      m.position.copy(pos);
      const v = normal.clone().multiplyScalar(3).add(
        new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).multiplyScalar(5),
      );
      sparks.push({ m, v });
    }
    this.add(sparks.map((s) => s.m), (dt) => {
      t += dt;
      for (const s of sparks) {
        s.v.y -= 20 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.scale.setScalar(0.08 * (1 - t / 0.3));
      }
      return t < 0.3;
    });
  }

  popText(pos, text, color = '#ffffff') {
    let t = 0;
    const sprite = textSprite(text, color);
    sprite.position.copy(pos);
    this.add([sprite], (dt) => {
      t += dt;
      sprite.position.y += dt * 1.5;
      const s = easeOutBack(Math.min(t / 0.2, 1));
      sprite.scale.set(1.6 * s, 0.8 * s, 1);
      sprite.material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.3;
      return t < 0.8;
    });
  }
}
