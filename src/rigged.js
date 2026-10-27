import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { box, toon } from './toon.js';
import { TEAM_COLORS } from './character.js';

// Heroes generated as textured meshes (Tripo/TRELLIS) and skinned to a Mixamo-named
// skeleton. Poses are driven in code: each bone gets a rotation in model space.

const loader = new GLTFLoader();
const GUN = 0x34363d;
const X = new THREE.Vector3(1, 0, 0);

// Inlined models arrive as data: URLs; decode them directly, since sandboxed pages
// may refuse fetch() even for data: URLs
async function loadModel(url) {
  if (!url.startsWith('data:')) return loader.loadAsync(url);
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // Embedded textures become blob: URLs. ImageBitmapLoader fetch()es them, which the
  // sandbox blocks; hiding createImageBitmap makes GLTFLoader use <img> loading instead.
  const createImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = undefined;
  try {
    return await loader.parseAsync(bytes.buffer, '');
  } finally {
    globalThis.createImageBitmap = createImageBitmap;
  }
}

// A hero whose model fails to load keeps its primitive build instead of blanking the game
export async function loadHeroModels(heroes) {
  const byUrl = new Map();
  await Promise.all(
    heroes.filter((h) => h.model).map(async (h) => {
      if (!byUrl.has(h.model)) byUrl.set(h.model, loadModel(h.model).catch((err) => console.error('Model failed', h.id, err)));
      h.gltf = await byUrl.get(h.model);
    }),
  );
}

const role = (name) => name.replace(/^.*mixamorig[:_]?/, '');

export class RiggedCharacter {
  constructor(spec, team) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    // Model space: the source faces +Z; `inner` turns it to face -Z like everything else
    this.inner = cloneSkinned(spec.gltf.scene);
    this.body.add(this.inner);
    this.bones = {};
    this.meshes = [];
    this.inner.traverse((o) => {
      if (o.isBone) this.bones[role(o.name)] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        // Matte toon look over the generated texture
        const src = o.material;
        o.material = new THREE.MeshToonMaterial({ map: src.map, color: 0xffffff });
        src.dispose();
        this.meshes.push(o);
      }
    });

    const bbox = new THREE.Box3().setFromObject(this.inner);
    const scale = spec.modelHeight / (bbox.max.y - bbox.min.y);
    this.inner.updateMatrixWorld(true);

    // Rest pose in model space, before turning and scaling
    this.rest = new Map();
    const tmp = new THREE.Vector3();
    for (const bone of Object.values(this.bones)) {
      const q = bone.getWorldQuaternion(new THREE.Quaternion());
      const p = bone.getWorldPosition(new THREE.Vector3());
      this.rest.set(bone, { world: q, pos: p, local: bone.quaternion.clone() });
    }
    const dir = (a, b) => tmp.copy(this.rest.get(this.bones[b]).pos).sub(this.rest.get(this.bones[a]).pos).normalize().clone();
    this.armDir = { Left: dir('LeftArm', 'LeftForeArm'), Right: dir('RightArm', 'RightForeArm') };

    this.inner.rotation.y = Math.PI;
    this.inner.scale.setScalar(scale);

    // Rifle, held at the right hand and pointed along the aim
    this.gun = new THREE.Group();
    const receiver = box(0.12, 0.16, 0.6, GUN, { outline: 0.03 });
    receiver.position.z = -0.1;
    const barrel = box(0.06, 0.06, 0.35, GUN);
    barrel.position.z = -0.55;
    const mag = box(0.08, 0.22, 0.08, TEAM_COLORS[team]);
    mag.position.set(0, -0.15, -0.05);
    this.gun.add(receiver, barrel, mag);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.z = -0.75;
    this.gun.add(this.muzzle);
    this.root.add(this.gun);

    // Team armband on the left upper arm, so shared models still read as two sides
    const upperArm = this.bones.LeftArm;
    const foreArm = this.bones.LeftForeArm;
    if (upperArm && foreArm) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), toon(TEAM_COLORS[team], { side: THREE.DoubleSide }));
      // Size in model units, converted into the bone's own (often centimetre) scale
      const len = this.rest.get(upperArm).pos.distanceTo(this.rest.get(foreArm).pos);
      const unit = upperArm.getWorldScale(new THREE.Vector3()).x / scale;
      band.scale.set((len * 0.8) / unit, (len * 0.28) / unit, (len * 0.8) / unit);
      band.position.copy(foreArm.position).multiplyScalar(0.55);
      band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), foreArm.position.clone().normalize());
      upperArm.add(band);
    }

    this.height = spec.modelHeight;
    this.headY = spec.modelHeight * 0.7;
    this.phase = 0;
    this.flash = 0;
    this.q = new THREE.Quaternion();
    this.q2 = new THREE.Quaternion();
    this.invInner = new THREE.Quaternion();
  }

  // Set a bone so its rest pose is rotated by `rot` (model space) about its own pivot
  pose(name, rot) {
    const bone = this.bones[name];
    if (!bone) return;
    const rest = this.rest.get(bone);
    const parent = bone.parent;
    parent.updateWorldMatrix(true, false);
    // parent orientation in model space = inner^-1 * parentWorld
    const pw = parent.getWorldQuaternion(this.q2).premultiply(this.invInner).invert();
    bone.quaternion.copy(rot).multiply(rest.world).premultiply(pw);
  }

  animate(dt, { speed = 0, onGround = true, aimPitch = 0, aiming = true }) {
    const moving = speed > 0.5 && onGround;
    this.phase += dt * (moving ? speed * 1.6 : 0);
    const swing = moving ? Math.sin(this.phase) * 0.7 : 0;
    const k = 1 - Math.exp(-dt * 14);
    this.smooth ??= { legL: 0, legR: 0, kneeL: 0, kneeR: 0, lean: 0 };
    const s = this.smooth;
    const ease = (key, target) => (s[key] += (target - s[key]) * k);

    this.inner.updateWorldMatrix(true, false);
    this.inner.getWorldQuaternion(this.invInner).invert();
    // Model space is pre-turn: front is +Z, so a forward leg swing is a negative X rotation
    const axisAngle = (axis, a) => new THREE.Quaternion().setFromAxisAngle(axis, a);

    ease('lean', moving ? 0.12 : 0);
    this.pose('Spine', axisAngle(X, s.lean));
    this.pose('Spine1', axisAngle(X, s.lean));
    this.pose('Spine2', axisAngle(X, s.lean));

    if (!onGround) {
      ease('legL', -0.8);
      ease('legR', 0.3);
      ease('kneeL', 1.0);
      ease('kneeR', 0.6);
    } else {
      ease('legL', -swing);
      ease('legR', swing);
      ease('kneeL', moving ? Math.max(0, Math.sin(this.phase + 1.2)) * 0.9 : 0);
      ease('kneeR', moving ? Math.max(0, -Math.sin(this.phase + 1.2)) * 0.9 : 0);
    }
    this.pose('LeftUpLeg', axisAngle(X, s.legL));
    this.pose('LeftLeg', axisAngle(X, s.legL + s.kneeL));
    this.pose('LeftFoot', axisAngle(X, s.legL));
    this.pose('RightUpLeg', axisAngle(X, s.legR));
    this.pose('RightLeg', axisAngle(X, s.legR + s.kneeR));
    this.pose('RightFoot', axisAngle(X, s.legR));

    // Arms: point both forward along the aim (front is +Z in model space)
    if (aiming) {
      const c = Math.cos(aimPitch);
      const sn = Math.sin(aimPitch);
      // Right hand holds the grip; the left reaches across to the barrel
      for (const [side, x] of [['Right', 0.12], ['Left', -0.35]]) {
        const target = new THREE.Vector3(x, sn, c).normalize();
        const rot = new THREE.Quaternion().setFromUnitVectors(this.armDir[side], target);
        // The shoulder takes part of the turn so the sleeve doesn't shear
        this.pose(side + 'Shoulder', new THREE.Quaternion().slerp(rot, 0.45));
        this.pose(side + 'Arm', rot);
        this.pose(side + 'ForeArm', rot);
        this.pose(side + 'Hand', rot);
      }
    } else {
      this.pose('LeftArm', axisAngle(X, swing * 0.8));
      this.pose('LeftForeArm', axisAngle(X, swing * 0.8));
      this.pose('RightArm', axisAngle(X, -swing * 0.8));
      this.pose('RightForeArm', axisAngle(X, -swing * 0.8));
    }
    this.pose('Neck', axisAngle(X, -aimPitch * 0.25));
    this.pose('Head', axisAngle(X, -aimPitch * 0.25));

    this.body.position.y = moving ? Math.abs(Math.sin(this.phase)) * 0.06 : 0;

    // Rifle sits in the right hand
    this.inner.updateMatrixWorld(true);
    const hand = this.bones.RightHand;
    this.gun.visible = aiming;
    if (hand) {
      const p = hand.getWorldPosition(new THREE.Vector3());
      this.root.worldToLocal(p);
      this.gun.position.copy(p);
      this.gun.rotation.set(aimPitch, 0, 0);
    }

    if (this.flash > 0) {
      this.flash -= dt;
      this.setEmissive(this.flash > 0 ? 0xffffff : 0x000000, this.flash > 0 ? 0.5 : 0);
    }
  }

  hitFlash() {
    this.flash = 0.08;
    this.setEmissive(0xffffff, 0.5);
  }

  setEmissive(color, intensity) {
    for (const m of this.meshes) {
      m.material.emissive.setHex(color);
      m.material.emissiveIntensity = intensity;
    }
  }

  setOpacity(alpha) {
    this.root.traverse((m) => {
      if (!m.isMesh) return;
      if (m.material.userData.shared) {
        m.material = m.material.clone();
        m.material.userData = {};
      }
      m.material.transparent = alpha < 1;
      m.material.opacity = alpha;
    });
  }

  dispose() {
    this.root.traverse((m) => {
      if (!m.isMesh) return;
      // Geometry and textures are shared with the loaded glTF; only drop our materials
      if (!m.material.userData.shared) m.material.dispose();
    });
  }
}
