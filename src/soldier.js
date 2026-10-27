import * as THREE from 'three';
import { box, toon } from './toon.js';

const SKIN = 0xf2c29b;
const BOOT = 0x3b2f2a;
const GUN = 0x34363d;

// Placeholder low-poly soldier made from boxes. Faces -Z locally.
export class Soldier {
  constructor({ uniform = 0x5c8a3a, helmet = 0x46702a, accent = 0xd9b44a } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // tilted/squashed for juice without moving root
    this.root.add(this.body);
    this.parts = [];

    const o = 0.03;
    const part = (mesh) => {
      this.parts.push(mesh);
      return mesh;
    };

    // Legs
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    for (const [leg, x] of [[this.legL, -0.15], [this.legR, 0.15]]) {
      leg.position.set(x, 0.75, 0);
      const thigh = part(box(0.24, 0.6, 0.26, uniform, { outline: o }));
      thigh.position.y = -0.3;
      const boot = part(box(0.26, 0.18, 0.36, BOOT, { outline: o }));
      boot.position.set(0, -0.66, -0.04);
      leg.add(thigh, boot);
      this.body.add(leg);
    }

    // Torso
    const torso = part(box(0.62, 0.6, 0.38, uniform, { outline: o }));
    torso.position.y = 1.05;
    const belt = part(box(0.64, 0.1, 0.4, BOOT));
    belt.position.y = 0.8;
    const strap = part(box(0.1, 0.62, 0.4, accent));
    strap.rotation.z = 0.6;
    strap.position.y = 1.05;
    this.body.add(torso, belt, strap);

    // Head
    this.head = new THREE.Group();
    this.head.position.y = 1.36;
    const face = part(box(0.48, 0.44, 0.46, SKIN, { outline: o }));
    face.position.y = 0.24;
    const hat = part(box(0.56, 0.2, 0.54, helmet, { outline: o }));
    hat.position.y = 0.5;
    const brim = part(box(0.58, 0.05, 0.2, helmet));
    brim.position.set(0, 0.41, -0.3);
    const eyeMat = toon(0x1d1a24);
    for (const x of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.02), eyeMat);
      eye.position.set(x, 0.27, -0.235);
      this.head.add(eye);
    }
    const nose = part(box(0.08, 0.08, 0.08, 0xe0a57f));
    nose.position.set(0, 0.2, -0.25);
    this.head.add(face, hat, brim, nose);
    this.body.add(this.head);

    // Arms (pivot at the shoulder, hanging down -Y)
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    for (const [arm, x] of [[this.armL, -0.4], [this.armR, 0.4]]) {
      arm.position.set(x, 1.28, 0);
      const sleeve = part(box(0.18, 0.5, 0.2, uniform, { outline: o }));
      sleeve.position.y = -0.25;
      const hand = part(box(0.16, 0.14, 0.16, SKIN, { outline: o }));
      hand.position.y = -0.56;
      arm.add(sleeve, hand);
      this.body.add(arm);
    }

    // Gun in the right hand, barrel along the arm's -Y axis
    const gun = new THREE.Group();
    gun.position.set(-0.04, -0.6, 0);
    const receiver = part(box(0.12, 0.5, 0.16, GUN, { outline: o }));
    receiver.position.y = -0.15;
    const barrel = part(box(0.06, 0.3, 0.06, GUN));
    barrel.position.y = -0.55;
    const mag = part(box(0.08, 0.08, 0.22, accent));
    mag.position.set(0, -0.12, 0.16);
    gun.add(receiver, barrel, mag);
    this.armR.add(gun);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, -0.72, 0);
    gun.add(this.muzzle);

    this.root.traverse((m) => {
      if (m.isMesh && !m.userData.isOutline) m.castShadow = true;
    });

    this.phase = 0;
    this.flash = 0;
  }

  // speed: horizontal speed (m/s); aimPitch in radians (positive = up)
  animate(dt, { speed = 0, onGround = true, aimPitch = 0, aiming = true }) {
    const moving = speed > 0.5 && onGround;
    this.phase += dt * (moving ? speed * 1.6 : 0);
    const swing = moving ? Math.sin(this.phase) * 0.8 : 0;

    const k = 1 - Math.exp(-dt * 14);
    const lerp = (obj, target) => (obj.rotation.x += (target - obj.rotation.x) * k);

    if (!onGround) {
      lerp(this.legL, -0.7);
      lerp(this.legR, 0.4);
    } else {
      lerp(this.legL, swing);
      lerp(this.legR, -swing);
    }

    if (aiming) {
      lerp(this.armR, Math.PI / 2 + aimPitch);
      lerp(this.armL, Math.PI / 2 + aimPitch - 0.1);
      this.armL.rotation.z = -0.45;
      this.armR.rotation.z = 0.05;
    } else {
      lerp(this.armR, -swing * 0.8);
      lerp(this.armL, swing * 0.8);
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
    }
    this.head.rotation.x = aimPitch * 0.5;

    // Bouncy run bob
    this.body.position.y = moving ? Math.abs(Math.sin(this.phase)) * 0.08 : 0;

    if (this.flash > 0) {
      this.flash -= dt;
      this.setEmissive(this.flash > 0 ? 0xffffff : 0x000000, this.flash > 0 ? 0.6 : 0);
    }
  }

  hitFlash() {
    this.flash = 0.08;
    this.setEmissive(0xffffff, 0.6);
  }

  setEmissive(color, intensity) {
    for (const p of this.parts) {
      if (!p.material.userData.unique) {
        p.material = p.material.clone();
        p.material.userData.unique = true;
      }
      p.material.emissive.setHex(color);
      p.material.emissiveIntensity = intensity;
    }
  }

  setOpacity(alpha) {
    this.root.traverse((m) => {
      if (!m.isMesh) return;
      if (!m.material.userData.unique) {
        m.material = m.material.clone();
        m.material.userData.unique = true;
      }
      m.material.transparent = alpha < 1;
      m.material.opacity = alpha;
    });
  }
}
