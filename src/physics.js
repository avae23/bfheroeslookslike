import * as THREE from 'three';

export const GRAVITY = 24;
const STEP_UP = 0.45;

// Upright box body; pos is at the feet.
export class Body {
  constructor(radius = 0.4, height = 1.8) {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = radius;
    this.height = height;
    this.onGround = false;
  }

  overlaps(b) {
    const p = this.pos;
    const r = this.radius;
    return (
      p.x + r > b.min.x && p.x - r < b.max.x &&
      p.z + r > b.min.z && p.z - r < b.max.z &&
      p.y + this.height > b.min.y && p.y < b.max.y
    );
  }

  // Walk up stairs and kerbs instead of bumping into them
  stepOnto(b) {
    const rise = b.max.y - this.pos.y;
    if (rise > STEP_UP || this.vel.y > 2) return false;
    this.pos.y = b.max.y;
    return true;
  }

  step(dt, colliders) {
    this.vel.y -= GRAVITY * dt;
    const p = this.pos;
    const r = this.radius;

    p.x += this.vel.x * dt;
    for (const b of colliders) {
      if (!this.overlaps(b) || this.stepOnto(b)) continue;
      p.x = p.x < (b.min.x + b.max.x) / 2 ? b.min.x - r : b.max.x + r;
    }

    p.z += this.vel.z * dt;
    for (const b of colliders) {
      if (!this.overlaps(b) || this.stepOnto(b)) continue;
      p.z = p.z < (b.min.z + b.max.z) / 2 ? b.min.z - r : b.max.z + r;
    }

    this.onGround = false;
    p.y += this.vel.y * dt;
    for (const b of colliders) {
      if (!this.overlaps(b)) continue;
      if (this.vel.y <= 0) {
        p.y = b.max.y;
        this.onGround = true;
      } else {
        p.y = b.min.y - this.height;
      }
      this.vel.y = 0;
    }
    if (p.y <= 0) {
      p.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }
  }

  // Steer horizontal velocity toward a target; weaker in the air so knockback carries.
  steer(dt, targetX, targetZ, groundAccel = 60, airAccel = 8) {
    const accel = this.onGround ? groundAccel : airAccel;
    const dx = targetX - this.vel.x;
    const dz = targetZ - this.vel.z;
    const len = Math.hypot(dx, dz);
    const maxStep = accel * dt;
    if (len <= maxStep) {
      this.vel.x = targetX;
      this.vel.z = targetZ;
    } else {
      this.vel.x += (dx / len) * maxStep;
      this.vel.z += (dz / len) * maxStep;
    }
  }

  center(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.pos.y + this.height / 2);
  }
}
