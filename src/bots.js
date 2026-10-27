import * as THREE from 'three';
import { Character } from './character.js';
import { Body } from './physics.js';

const MAX_HP = 100;
const RESPAWN_TIME = 3;

// Target dummies that wander the town. They don't shoot back yet.
export class Bot {
  constructor(scene, world, spawn, hero) {
    this.scene = scene;
    this.world = world;
    this.body = new Body(0.45, 1.95);
    this.box = new THREE.Box3();
    this.setHero(hero);

    this.hpBar = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ color: 0x1d1a24 }));
    this.hpFill = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.08), new THREE.MeshBasicMaterial({ color: 0x6bdc4a }));
    this.hpFill.position.z = 0.001;
    this.hpBar.add(back, this.hpFill);
    scene.add(this.hpBar);

    this.respawn(spawn);
  }

  setHero(hero) {
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose();
    }
    this.hero = hero;
    this.model = new Character(hero, hero.camp);
    this.body.height = this.model.height;
    this.scene.add(this.model.root);
  }

  respawn(spawn) {
    this.body.pos.copy(spawn);
    this.body.vel.set(0, 0, 0);
    this.hp = MAX_HP;
    this.dead = false;
    this.deadTime = 0;
    this.model.root.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.model.root.scale.setScalar(1);
    this.model.setOpacity(1);
    this.model.root.visible = true;
    this.hpBar.visible = true;
    this.pickTarget();
    this.updateHpBar();
  }

  // Head for a random waypoint, following the nav graph so stairs get used
  pickTarget() {
    const world = this.world;
    const from = world.nearestNode(this.body.pos);
    let to = from;
    while (to === from) to = world.nav[Math.floor(Math.random() * world.nav.length)];
    this.path = world.route(from, to).map((p) =>
      p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)),
    );
    this.target = this.path.shift();
    this.idle = Math.random() < 0.3 ? 0.5 + Math.random() * 1.5 : 0;
    this.stuckTime = 0;
  }

  get alive() {
    return !this.dead;
  }

  getBox() {
    const p = this.body.pos;
    const r = this.body.radius;
    return this.box.set(
      new THREE.Vector3(p.x - r, p.y, p.z - r),
      new THREE.Vector3(p.x + r, p.y + this.body.height, p.z + r),
    );
  }

  // Returns true when this damage killed the bot.
  damage(amount, impulse) {
    if (this.dead) return false;
    this.hp -= amount;
    this.model.hitFlash();
    if (impulse) this.body.vel.add(impulse);
    this.updateHpBar();
    if (this.hp <= 0) {
      this.dead = true;
      this.deadTime = 0;
      this.hpBar.visible = false;
      this.spin = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      this.body.vel.y = Math.max(this.body.vel.y, 6);
      return true;
    }
    // Startled: run somewhere else
    this.pickTarget();
    this.idle = 0;
    return false;
  }

  updateHpBar() {
    const k = Math.max(0, this.hp / MAX_HP);
    this.hpFill.scale.x = Math.max(k, 0.001);
    this.hpFill.position.x = -(1 - k) * 0.48;
    this.hpFill.material.color.setHex(k > 0.5 ? 0x6bdc4a : k > 0.25 ? 0xffcf4d : 0xff4d4d);
  }

  update(dt, camera, spawns) {
    const b = this.body;

    if (this.dead) {
      this.deadTime += dt;
      b.steer(dt, 0, 0, 10, 1);
      b.step(dt, this.world.colliders);
      const r = this.model.root;
      r.position.copy(b.pos);
      if (!b.onGround) {
        r.rotation.x += this.spin.x * dt;
        r.rotation.z += this.spin.z * dt;
      }
      if (this.deadTime > 1.5) {
        const k = Math.max(0, 1 - (this.deadTime - 1.5) / 0.6);
        r.scale.setScalar(Math.max(k, 0.001));
      }
      if (this.deadTime > RESPAWN_TIME) {
        if (this.roster) this.setHero(this.roster[Math.floor(Math.random() * this.roster.length)]);
        this.respawn(spawns[Math.floor(Math.random() * spawns.length)]);
      }
      this.model.animate(dt, { speed: 0, onGround: false, aiming: false });
      return;
    }

    let tx = 0;
    let tz = 0;
    if (this.idle > 0) {
      this.idle -= dt;
    } else {
      const dx = this.target.x - b.pos.x;
      const dz = this.target.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        if (this.path.length) this.target = this.path.shift();
        else this.pickTarget();
      } else {
        const speed = 4;
        tx = (dx / dist) * speed;
        tz = (dz / dist) * speed;
        const yaw = Math.atan2(-dx, -dz);
        const r = this.model.root;
        let diff = yaw - r.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        r.rotation.y += diff * Math.min(1, dt * 8);
      }
    }

    const before = b.pos.clone();
    b.steer(dt, tx, tz);
    b.step(dt, this.world.colliders);

    // Hop over low cover, or give up on targets we can't reach
    const moved = before.distanceTo(b.pos);
    if ((tx || tz) && moved < dt * 1.5) {
      this.stuckTime += dt;
      if (b.onGround && this.stuckTime > 0.15) b.vel.y = 8.5;
      if (this.stuckTime > 1.2) this.pickTarget();
    } else {
      this.stuckTime = 0;
    }

    this.model.root.position.copy(b.pos);
    this.model.animate(dt, {
      speed: Math.hypot(b.vel.x, b.vel.z),
      onGround: b.onGround,
      aiming: false,
    });

    this.hpBar.position.set(b.pos.x, b.pos.y + 2.35, b.pos.z);
    this.hpBar.quaternion.copy(camera.quaternion);
  }
}
