import * as THREE from 'three';
import { box, toon, addOutline } from './toon.js';

export const TEAM_COLORS = { garage: 0xff7a1a, feed: 0x2bb8f0 };
const GUN = 0x34363d;

// Wojak head: one lathe from the thick neck up to the domed skull, so the head
// "flows" into the neck like in the meme. Face lines are a canvas texture.
export function headProfile(h) {
  return (t) => {
    if (t >= 1) return 0;
    if (t > h.top) {
      const k = (t - h.top) / (1 - h.top);
      return h.rh * Math.sqrt(Math.max(0, 1 - k * k));
    }
    const k = THREE.MathUtils.smoothstep(t, 0, h.top);
    return THREE.MathUtils.lerp(h.rn, h.rh, k);
  };
}

function buildHead(spec) {
  const h = spec.head;
  const r = headProfile(h);
  const pts = [];
  const rows = 24;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    pts.push(new THREE.Vector2(Math.max(r(t), 0.0001), t * h.H));
  }
  const geo = new THREE.LatheGeometry(pts, 14);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${new THREE.Color(spec.skin).getHexString()}`;
  ctx.fillRect(0, 0, 1024, 512);
  spec.face(new FacePen(ctx, spec));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const mat = toon(0xffffff, { unique: true, map: tex, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.z = h.zScale ?? 1;
  mesh.castShadow = true;
  addOutline(mesh, 0.025);
  return mesh;
}

// Drawing helpers in head space: dx in canvas px from the face centre, t = height fraction.
const FACE_SCALE = 1.9;
const LINE_SCALE = 1.7;

class FacePen {
  constructor(ctx, spec) {
    this.ctx = ctx;
    this.spec = spec;
    this.rand = mulberry(spec.name.length * 7919);
  }
  // Feature offsets in the specs are authored small; this sizes them for the head texture
  X(dx) {
    return 512 + dx * FACE_SCALE;
  }
  Y(t) {
    return (1 - t) * 512;
  }
  line(points, width = 4, color = '#1d1a24') {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width * LINE_SCALE;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    points.forEach(([dx, t], i) => {
      const x = this.X(dx);
      const y = this.Y(t);
      if (i === 0) c.moveTo(x, y);
      else {
        const [pdx, pt] = points[i - 1];
        const mx = (this.X(pdx) + x) / 2 + (this.rand() - 0.5) * 3;
        const my = (this.Y(pt) + y) / 2 + (this.rand() - 0.5) * 3;
        c.quadraticCurveTo(mx, my, x, y);
      }
    });
    c.stroke();
  }
  blob(dx, t, rx, ry, color, rot = 0) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(this.X(dx), this.Y(t), rx * FACE_SCALE, ry * FACE_SCALE * 0.8, rot, 0, Math.PI * 2);
    c.fill();
  }
  // Small dull wojak eye with a heavy lid line
  eye(dx, t, { w = 20, lid = 0.6, bag = false, look = 0 } = {}) {
    this.blob(dx, t, w, w * 0.55, '#ffffff');
    this.blob(dx + look, t - 0.004, w * 0.42, w * 0.42, '#1d1a24');
    const lidT = t + 0.022 * lid;
    this.line([[dx - w - 2, t + 0.004], [dx, lidT + 0.012], [dx + w + 2, t + 0.004]], 4);
    this.line([[dx - w, t - 0.012], [dx + w * 0.8, t - 0.016]], 2.5);
    if (bag) {
      this.blob(dx, t - 0.03, w * 1.1, w * 0.45, 'rgba(70,60,80,0.35)');
      this.line([[dx - w, t - 0.04], [dx + w * 0.9, t - 0.045]], 2.5);
    }
  }
  stubble(t0, t1, spread, count = 120, size = 2) {
    const c = this.ctx;
    c.fillStyle = '#2b2622';
    for (let i = 0; i < count; i++) {
      const dx = (this.rand() - 0.5) * 2 * spread;
      const t = t0 + this.rand() * (t1 - t0);
      c.fillRect(this.X(dx), this.Y(t), size * LINE_SCALE, size * LINE_SCALE);
    }
  }
  wrinkles(t, n = 3, w = 70, gap = 0.035) {
    for (let i = 0; i < n; i++) {
      const tt = t + i * gap;
      const ww = w - i * 8;
      this.line([[-ww, tt], [-ww / 3, tt + 0.006], [ww / 3, tt - 0.004], [ww, tt + 0.004]], 3);
    }
  }
  strands(t0, t1, spread, n = 14, width = 3) {
    for (let i = 0; i < n; i++) {
      const dx = (this.rand() - 0.5) * 2 * spread;
      const tt = t0 + this.rand() * (t1 - t0);
      this.line([[dx, tt], [dx + (this.rand() - 0.5) * 40, tt + 0.06 + this.rand() * 0.05]], width, '#2b2622');
    }
  }
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A hero built from a spec in heroes.js. Faces -Z locally, feet at y = 0.
export class Character {
  constructor(spec, team) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.parts = [];
    const o = 0.03;
    const part = (mesh) => {
      this.parts.push(mesh);
      return mesh;
    };
    const s = spec;

    // Legs: pivot at the hip; upper (shorts/trousers) + lower (skin or trousers) + sock + shoe
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    for (const [leg, x] of [[this.legL, -s.hipW], [this.legR, s.hipW]]) {
      leg.position.set(x, s.hipY, 0);
      const upperLen = s.hipY * s.shortsLen;
      const upper = part(box(s.legW * 1.25, upperLen, s.legW * 1.35, s.pants, { outline: o }));
      upper.position.y = -upperLen / 2;
      const lowerLen = s.hipY - upperLen - 0.12;
      const lower = part(box(s.legW * 0.8, lowerLen, s.legW * 0.85, s.shin ?? s.skin, { outline: o }));
      lower.position.y = -upperLen - lowerLen / 2;
      leg.add(upper, lower);
      if (s.sock) {
        const sock = part(box(s.legW * 0.9, 0.16, s.legW * 0.95, s.sock));
        sock.position.y = -s.hipY + 0.18;
        leg.add(sock);
        if (s.sockStripe) {
          const stripe = part(box(s.legW * 0.93, 0.03, s.legW * 0.98, s.sockStripe));
          stripe.position.y = -s.hipY + 0.22;
          leg.add(stripe);
        }
      }
      const shoe = part(box(s.shoe.w, s.shoe.h, s.shoe.d, s.shoe.color, { outline: o }));
      shoe.position.set(0, -s.hipY + s.shoe.h / 2, -s.shoe.d * 0.15);
      leg.add(shoe);
      if (s.shoe.sole) {
        const sole = part(box(s.shoe.w * 1.05, 0.05, s.shoe.d * 1.04, s.shoe.sole));
        sole.position.set(0, -s.hipY + 0.025, -s.shoe.d * 0.15);
        leg.add(sole);
      }
      this.body.add(leg);
    }

    // Torso and belly
    this.torso = new THREE.Group();
    this.torso.position.y = s.hipY;
    this.torso.rotation.x = s.hunch ?? 0;
    this.body.add(this.torso);
    const shirt = part(box(s.torso.w, s.torso.h, s.torso.d, s.top, { outline: o }));
    shirt.position.y = s.torso.h / 2 + (s.torso.lift ?? 0);
    this.torso.add(shirt);
    if (s.torso.lift) {
      // Bare midriff between the waistband and a too-short tee
      const waist = part(box(s.torso.w * 0.92, s.torso.lift, s.torso.d * 0.92, s.skin, { outline: o }));
      waist.position.y = s.torso.lift / 2;
      const band = part(box(s.torso.w * 0.94, 0.1, s.torso.d * 0.94, s.pants));
      band.position.y = 0.04;
      this.torso.add(waist, band);
    }
    if (s.belly) {
      const belly = part(new THREE.Mesh(new THREE.IcosahedronGeometry(s.belly.r, 1), toon(s.belly.color ?? s.top)));
      belly.scale.set(1.15, 1, 1);
      belly.position.set(0, s.belly.y, -s.torso.d / 2 - s.belly.r * 0.1);
      belly.castShadow = true;
      addOutline(belly, 0.03);
      this.torso.add(belly);
    }
    const shoulderY = s.torso.h + (s.torso.lift ?? 0) - 0.08;

    // Arms
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    const armX = s.torso.w / 2 + 0.1;
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]]) {
      arm.position.set(armX * side, shoulderY, 0);
      const sleeveLen = s.armLen * s.sleeve;
      const sleeve = part(box(0.2, sleeveLen, 0.22, s.sleeveColor ?? s.top, { outline: o }));
      sleeve.position.y = -sleeveLen / 2;
      arm.add(sleeve);
      if (s.sleeve < 1) {
        const forearm = part(box(0.15, s.armLen - sleeveLen, 0.16, s.skin, { outline: o }));
        forearm.position.y = -sleeveLen - (s.armLen - sleeveLen) / 2;
        arm.add(forearm);
      }
      const hand = part(box(0.17, 0.15, 0.17, s.skin, { outline: o }));
      hand.position.y = -s.armLen - 0.06;
      arm.add(hand);
      this.torso.add(arm);
    }
    // Team armband on the left upper arm, as on the concept sheets
    const band = part(box(0.23, 0.08, 0.25, TEAM_COLORS[team]));
    band.position.y = -0.16;
    this.armL.add(band);

    // Rifle in the right hand, barrel along the arm's -Y axis
    const gun = new THREE.Group();
    gun.position.set(-0.04, -s.armLen - 0.08, 0);
    const receiver = part(box(0.12, 0.5, 0.16, GUN, { outline: o }));
    receiver.position.y = -0.15;
    const barrel = part(box(0.06, 0.3, 0.06, GUN));
    barrel.position.y = -0.55;
    const mag = part(box(0.08, 0.08, 0.22, TEAM_COLORS[team]));
    mag.position.set(0, -0.12, 0.16);
    gun.add(receiver, barrel, mag);
    this.armR.add(gun);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, -0.72, 0);
    gun.add(this.muzzle);

    // Head on a forward-leaning neck
    this.head = new THREE.Group();
    this.head.position.set(0, shoulderY - 0.1, s.head.forward ?? -0.04);
    const lean = new THREE.Group();
    lean.rotation.x = s.head.lean ?? -0.12;
    this.head.add(lean);
    const headMesh = part(buildHead(s));
    lean.add(headMesh);
    s.accessories?.({ head: lean, torso: this.torso, part, at: headAnchor(s), team });
    this.torso.add(this.head);

    this.root.traverse((m) => {
      if (m.isMesh && !m.userData.isOutline) m.castShadow = true;
    });

    this.height = s.hipY + shoulderY - 0.1 + s.head.H * 0.97;
    this.headY = s.hipY + shoulderY - 0.1 + s.head.H * 0.3;
    this.phase = 0;
    this.flash = 0;
  }

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

    const hunch = this.spec.hunch ?? 0;
    if (aiming) {
      lerp(this.armR, Math.PI / 2 + aimPitch - hunch);
      lerp(this.armL, Math.PI / 2 + aimPitch - hunch - 0.1);
      this.armL.rotation.z = -0.45;
      this.armR.rotation.z = 0.05;
    } else {
      lerp(this.armR, -swing * 0.8);
      lerp(this.armL, swing * 0.8);
      this.armL.rotation.z = -0.12;
      this.armR.rotation.z = 0.12;
    }
    this.head.rotation.x = aimPitch * 0.4;

    // Bouncy run bob, with a belly wobble for free
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
      if (!p.material.emissive) continue;
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

  dispose() {
    this.root.traverse((m) => {
      if (!m.isMesh) return;
      if (!m.userData.isOutline) m.geometry.dispose();
      if (!m.material.userData.shared || m.material.userData.unique) {
        m.material.map?.dispose();
        m.material.dispose();
      }
    });
  }
}

// Where on the head surface things like glasses sit: at height fraction t, how far forward is the face?
function headAnchor(spec) {
  const r = headProfile(spec.head);
  return (t) => ({ y: t * spec.head.H, z: -r(t) * (spec.head.zScale ?? 1), r: r(t) });
}
