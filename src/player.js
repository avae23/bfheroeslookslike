import * as THREE from 'three';
import { Soldier } from './soldier.js';
import { Body } from './physics.js';
import { controls } from './controls.js';

const RUN_SPEED = 7.5;
const JUMP_SPEED = 8.5;
const MOUSE_SENS = 0.0022;
const CAM_DISTANCE = 5;
const SHOULDER = 0.9;

export class Player {
  constructor(scene, world, camera) {
    this.world = world;
    this.camera = camera;
    this.model = new Soldier();
    scene.add(this.model.root);
    this.body = new Body(0.4, 1.9);
    this.body.pos.set(0, 0, 8);

    this.yaw = 0;
    this.pitch = -0.1;
    this.keys = new Set();
    this.camRay = new THREE.Raycaster();
    this.shake = 0;

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (!controls.active) return;
      this.yaw -= e.movementX * MOUSE_SENS;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * MOUSE_SENS, -1.2, 1.0);
    });
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  aimDir(out = new THREE.Vector3()) {
    const c = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * c, Math.sin(this.pitch), -Math.cos(this.yaw) * c);
  }

  update(dt) {
    const b = this.body;
    const k = this.keys;
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);

    const f = this.forward();
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const move = f.multiplyScalar(fwd).addScaledVector(right, side);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(RUN_SPEED);

    b.steer(dt, move.x, move.z);
    if (k.has('Space') && b.onGround) b.vel.y = JUMP_SPEED;
    b.step(dt, this.world.colliders);

    const r = this.model.root;
    r.position.copy(b.pos);
    r.rotation.y = this.yaw;
    this.model.animate(dt, {
      speed: Math.hypot(b.vel.x, b.vel.z),
      onGround: b.onGround,
      aimPitch: this.pitch,
      aiming: true,
    });

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const look = this.aimDir();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = this.body.pos.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(right, SHOULDER);

    // Pull the camera in when a wall is between it and the player
    let dist = CAM_DISTANCE;
    const back = look.clone().negate();
    this.camRay.set(pivot, back);
    this.camRay.far = CAM_DISTANCE;
    const hit = this.camRay.intersectObjects(this.world.solids, false)[0];
    if (hit) dist = Math.max(0.6, hit.distance - 0.3);

    this.camera.position.copy(pivot).addScaledVector(back, dist);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Trauma-based camera shake
    if (this.shake > 0) {
      const s = this.shake * this.shake;
      const t = performance.now() * 0.05;
      this.camera.position.x += Math.sin(t * 1.3) * s * 0.4;
      this.camera.position.y += Math.sin(t * 1.7 + 1) * s * 0.4;
      this.camera.rotation.z += Math.sin(t * 2.1 + 2) * s * 0.08;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }
}
