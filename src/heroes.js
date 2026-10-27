import * as THREE from 'three';
import { box, toon, addOutline } from './toon.js';
import { Character } from './character.js';
import { RiggedCharacter } from './rigged.js';
import sanychModel from './models/sanych.glb?url';
import palychModel from './models/palych.glb?url';
import swipeModel from './models/swipe.glb?url';
import hypeModel from './models/hype.glb?url';
import deadinsideModel from './models/deadinside.glb?url';

// The six heroes from the "Скуфы против зумеров" concept sheets, built from primitives.
// Camps: garage = «Гаражный союз» (orange), feed = «Поколение ленты» (blue).

const SKIN = 0xf3e8d6;
const PALE = 0xf1ede4;
const INK = 0x1d1a24;

function glassesRound(ctx, t, { r = 0.055, gap = 0.065, color = INK } = {}) {
  const { head, part, at } = ctx;
  const a = at(t);
  const mat = toon(color);
  for (const side of [-1, 1]) {
    const ring = part(new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 16), mat));
    ring.position.set(side * gap, a.y, a.z - 0.025);
    head.add(ring);
    const temple = part(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, a.r * 1.1), mat));
    temple.position.set(side * (gap + r * 0.9), a.y, a.z + a.r * 0.5);
    head.add(temple);
  }
  const bridge = part(new THREE.Mesh(new THREE.BoxGeometry(gap * 2 - r * 2, 0.01, 0.01), mat));
  bridge.position.set(0, a.y + 0.01, a.z - 0.03);
  head.add(bridge);
}

function glassesRect(ctx, t) {
  const { head, part, at } = ctx;
  const a = at(t);
  const mat = toon(INK);
  for (const side of [-1, 1]) {
    // Rectangular frame from four thin bars
    const frame = new THREE.Group();
    for (const [w, h, x, y] of [[0.17, 0.016, 0, 0.05], [0.17, 0.016, 0, -0.05], [0.016, 0.1, 0.08, 0], [0.016, 0.1, -0.08, 0]]) {
      frame.add(part(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.016), mat)));
      frame.children.at(-1).position.set(x, y, 0);
    }
    frame.position.set(side * 0.09, a.y, a.z - 0.025);
    head.add(frame);
    const temple = part(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, a.r * 1.1), mat));
    temple.position.set(side * 0.15, a.y + 0.01, a.z + a.r * 0.5);
    head.add(temple);
  }
}

export const HEROES = [
  {
    id: 'palych',
    name: 'Палыч',
    model: palychModel,
    modelHeight: 2.0,
    role: 'бумер, танк',
    camp: 'garage',
    skin: SKIN,
    hipY: 0.55, hipW: 0.17, legW: 0.16, shortsLen: 0.62, pants: 0xd1a33a,
    sock: 0xffffff, shoe: { w: 0.2, h: 0.1, d: 0.34, color: 0x6b4630 },
    torso: { w: 0.72, h: 0.62, d: 0.46 }, top: 0xf5f5f0,
    belly: { r: 0.36, y: 0.28 },
    sleeve: 0.12, armLen: 0.55,
    head: { H: 1.0, rn: 0.22, rh: 0.27, top: 0.62, zScale: 1.0, lean: -0.08 },
    face(f) {
      f.wrinkles(0.8, 3, 80, 0.04);
      f.strands(0.86, 0.93, 150, 10, 2.5);
      f.line([[-14, 0.6], [-6, 0.56], [-16, 0.535], [-4, 0.525]], 3.5); // nose
      f.line([[-40, 0.485], [-10, 0.478], [25, 0.48], [42, 0.492]], 4); // smug thin smile
      f.line([[-60, 0.5], [-52, 0.44]], 3);
      f.stubble(0.38, 0.47, 70, 160, 2);
      f.stubble(0.4, 0.44, 12, 40, 3); // goatee
      f.line([[18, 0.33], [22, 0.26]], 3); // neck line
      f.line([[-30, 0.35], [-26, 0.29]], 2.5);
    },
    accessories(ctx) {
      // Big black sunglasses
      const a = ctx.at(0.66);
      const mat = toon(0x1b1b1f, { emissive: 0x222233, emissiveIntensity: 0.2 });
      for (const side of [-1, 1]) {
        const lens = ctx.part(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.03), mat));
        lens.position.set(side * 0.085, a.y, a.z - 0.02);
        lens.rotation.y = side * 0.25;
        ctx.head.add(lens);
      }
      const bridge = ctx.part(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), mat));
      bridge.position.set(0, a.y + 0.02, a.z - 0.035);
      ctx.head.add(bridge);
    },
  },
  {
    id: 'sanych',
    name: 'Саныч',
    model: sanychModel,
    modelHeight: 1.95,
    role: 'скуф-рыбак, контроль',
    camp: 'garage',
    skin: SKIN,
    hipY: 0.58, hipW: 0.17, legW: 0.16, shortsLen: 0.5, pants: 0x5b84b8,
    sock: 0x7a5434, sockStripe: 0xf0e8dc, shoe: { w: 0.2, h: 0.1, d: 0.34, color: 0x6b4630 },
    torso: { w: 0.66, h: 0.42, d: 0.42, lift: 0.22 }, top: 0xd99a2b,
    belly: { r: 0.33, y: 0.2, color: SKIN },
    sleeve: 0.3, armLen: 0.55,
    head: { H: 0.98, rn: 0.2, rh: 0.26, top: 0.6, zScale: 1.08, lean: -0.1 },
    face(f) {
      f.wrinkles(0.78, 2, 60, 0.04);
      f.strands(0.84, 0.95, 90, 16, 3); // comb-over
      f.eye(-36, 0.655, { w: 13, lid: 0.8 });
      f.eye(36, 0.655, { w: 13, lid: 0.8 });
      f.line([[-6, 0.62], [-14, 0.57], [-2, 0.548], [10, 0.555]], 3.5);
      f.line([[-30, 0.52], [-12, 0.535], [12, 0.535], [30, 0.52]], 3); // droopy mustache
      f.line([[-38, 0.49], [0, 0.475], [34, 0.495], [44, 0.51]], 4);
      f.line([[-62, 0.6], [-58, 0.5]], 2.5);
      f.stubble(0.4, 0.46, 50, 90, 2);
    },
    accessories(ctx) {
      glassesRound(ctx, 0.655, { r: 0.05, gap: 0.062 });
      // Fishing rod slung across the back
      const rod = ctx.part(box(0.03, 1.5, 0.03, 0x2b2b2b));
      rod.position.set(0.05, 0.6, 0.26);
      rod.rotation.z = 0.5;
      const reel = ctx.part(box(0.08, 0.08, 0.08, 0x8a8a8a));
      reel.position.set(-0.18, 0.2, 0.28);
      ctx.torso.add(rod, reel);
    },
  },
  {
    id: 'swipe',
    name: 'Свайп',
    model: swipeModel,
    modelHeight: 1.9,
    role: 'зумер, разведчик',
    camp: 'feed',
    skin: PALE,
    hipY: 0.66, hipW: 0.16, legW: 0.17, shortsLen: 0.78, pants: 0x2a2b30, shin: 0x2a2b30,
    shoe: { w: 0.3, h: 0.2, d: 0.46, color: 0xf2f2ee, sole: 0x9aa0a6 },
    torso: { w: 0.66, h: 0.56, d: 0.4 }, top: 0x2f3136,
    sleeve: 1, sleeveColor: 0x2f3136, armLen: 0.55,
    head: { H: 0.9, rn: 0.17, rh: 0.24, top: 0.6, zScale: 1.05, lean: -0.15 },
    face(f) {
      f.eye(-34, 0.66, { w: 14, lid: 1, look: 3 });
      f.eye(34, 0.66, { w: 14, lid: 1, look: 3 });
      f.line([[-50, 0.71], [-20, 0.715]], 3); // brows
      f.line([[20, 0.715], [50, 0.705]], 3);
      f.line([[-4, 0.63], [-12, 0.58], [2, 0.56], [12, 0.57]], 3.5);
      f.line([[-36, 0.505], [-10, 0.49], [20, 0.5], [44, 0.53]], 4); // smirk
      f.line([[44, 0.53], [50, 0.545]], 3);
      f.line([[-55, 0.58], [-48, 0.5]], 2.5);
      f.stubble(0.76, 0.84, 70, 60, 2.5); // shaved sides
      f.line([[10, 0.33], [14, 0.27]], 3);
    },
    accessories(ctx) {
      glassesRound(ctx, 0.66);
      // Swept-up spiky hair
      const hairMat = toon(0x7a4a2a);
      const top = ctx.at(0.9);
      for (let i = 0; i < 7; i++) {
        const spike = ctx.part(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 4), hairMat));
        spike.position.set(-0.12 + i * 0.04, top.y + 0.04, -0.05 + (i % 2) * 0.04);
        spike.rotation.x = -0.5;
        ctx.head.add(spike);
      }
      // Mint and white windbreaker panels
      const mint = ctx.part(box(0.68, 0.22, 0.42, 0x6cc3a3));
      mint.position.y = 0.45;
      const chev = ctx.part(box(0.68, 0.07, 0.42, 0xf2f2ee));
      chev.position.y = 0.32;
      const strap = ctx.part(box(0.08, 0.75, 0.43, 0x1d1d20));
      strap.position.y = 0.3;
      strap.rotation.z = -0.7;
      const bag = ctx.part(box(0.3, 0.14, 0.12, 0x1d1d20, { outline: 0.02 }));
      bag.position.set(-0.08, 0.36, -0.25);
      bag.rotation.z = -0.4;
      ctx.torso.add(mint, chev, strap, bag);
    },
  },
  {
    id: 'hype',
    name: 'Хайп',
    model: hypeModel,
    modelHeight: 1.95,
    role: 'зумер-стример, поддержка',
    camp: 'feed',
    skin: PALE,
    hipY: 0.56, hipW: 0.19, legW: 0.18, shortsLen: 0.55, pants: 0x232428,
    sock: 0xf2f2ee, sockStripe: 0x8f6fd0, shoe: { w: 0.28, h: 0.17, d: 0.42, color: 0xf2f2ee, sole: 0x8f6fd0 },
    torso: { w: 0.8, h: 0.62, d: 0.5 }, top: 0x9b7fd6,
    sleeve: 1, armLen: 0.55,
    head: { H: 0.88, rn: 0.24, rh: 0.3, top: 0.58, zScale: 0.95, lean: -0.05 },
    face(f) {
      f.eye(-40, 0.64, { w: 14, lid: 1.2, look: -2 });
      f.eye(40, 0.64, { w: 14, lid: 1.2, look: -2 });
      f.line([[-60, 0.695], [-22, 0.69]], 3.5);
      f.line([[22, 0.69], [60, 0.7]], 3.5);
      f.wrinkles(0.76, 2, 70, 0.035);
      f.line([[-4, 0.61], [-12, 0.56], [4, 0.545], [14, 0.555]], 3.5);
      f.line([[-50, 0.5], [-20, 0.475], [20, 0.48], [56, 0.515]], 4.5); // wide smug grin
      f.line([[-66, 0.58], [-60, 0.48], [-46, 0.44]], 3);
      f.line([[66, 0.58], [62, 0.48]], 3);
      f.stubble(0.42, 0.47, 30, 40, 2);
    },
    accessories(ctx) {
      // Broccoli hair: chunky brown lumps
      const hairMat = toon(0x6e4128);
      const top = ctx.at(0.85);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const lump = ctx.part(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), hairMat));
        lump.position.set(Math.cos(a) * 0.17, top.y + 0.06, Math.sin(a) * 0.17);
        ctx.head.add(lump);
      }
      const crown = ctx.part(new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), hairMat));
      crown.position.set(0, top.y + 0.1, 0);
      ctx.head.add(crown);
      // Headphones around the neck
      const phones = ctx.part(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 16), toon(0x1d1d20)));
      phones.rotation.x = Math.PI / 2;
      phones.position.y = 0.62;
      for (const side of [-1, 1]) {
        const cup = ctx.part(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), toon(0x8f6fd0)));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.27, 0.6, -0.08);
        ctx.torso.add(cup);
      }
      // Backpack with a glowing ring light
      const pack = ctx.part(box(0.48, 0.5, 0.2, 0x232428, { outline: 0.02 }));
      pack.position.set(0, 0.32, 0.34);
      const pole = ctx.part(box(0.03, 0.4, 0.03, 0x232428));
      pole.position.set(-0.18, 0.75, 0.38);
      const ring = ctx.part(new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.03, 6, 20),
        toon(0xe8dcff, { emissive: 0xb89cff, emissiveIntensity: 0.9 }),
      ));
      ring.position.set(-0.18, 1.0, 0.38);
      ctx.torso.add(phones, pack, pole, ring);
    },
  },
  {
    id: 'deadinside',
    name: 'Дед Инсайд',
    model: deadinsideModel,
    modelHeight: 1.95,
    role: 'думер, скрытность',
    camp: 'feed',
    skin: PALE,
    hipY: 0.72, hipW: 0.14, legW: 0.15, shortsLen: 1, pants: 0x2e3a55,
    shoe: { w: 0.22, h: 0.14, d: 0.36, color: 0x2a2a2a, sole: 0x7a7a7a },
    torso: { w: 0.6, h: 0.6, d: 0.38 }, top: 0x1f1f22,
    sleeve: 1, armLen: 0.6,
    hunch: -0.06,
    head: { H: 0.92, rn: 0.16, rh: 0.22, top: 0.62, zScale: 1.05, lean: -0.1 },
    face(f) {
      f.eye(-32, 0.64, { w: 14, lid: 1.4, bag: true, look: 4 });
      f.eye(32, 0.64, { w: 14, lid: 1.4, bag: true, look: 4 });
      f.line([[-2, 0.61], [-10, 0.56], [4, 0.545], [12, 0.555]], 3.5);
      f.line([[-26, 0.485], [0, 0.488], [24, 0.482]], 3.5); // flat mouth
      f.line([[-52, 0.6], [-48, 0.5], [-36, 0.45]], 2.5);
      f.line([[52, 0.6], [48, 0.52]], 2.5);
      f.wrinkles(0.74, 1, 50, 0.03);
      f.stubble(0.4, 0.48, 55, 120, 2);
      f.line([[-12, 0.34], [-8, 0.27]], 3);
    },
    accessories(ctx) {
      // Black beanie
      const top = ctx.at(0.8);
      const beanie = ctx.part(new THREE.Mesh(new THREE.CylinderGeometry(top.r * 0.75, top.r * 1.12, 0.26, 10), toon(0x1a1a1d)));
      beanie.position.set(0, top.y + 0.06, 0);
      beanie.scale.z = 1.05;
      const cuff = ctx.part(new THREE.Mesh(new THREE.CylinderGeometry(top.r * 1.14, top.r * 1.16, 0.07, 10), toon(0x2c2c30)));
      cuff.position.set(0, top.y - 0.06, 0);
      cuff.scale.z = 1.05;
      ctx.head.add(beanie, cuff);
      // Wired earphones
      const wire = toon(0x111111);
      for (const side of [-1, 1]) {
        const w = ctx.part(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.012), wire));
        w.position.set(side * 0.13, 0.55, -0.2);
        ctx.torso.add(w);
      }
      // Hood bunched on the back, red tee at the collar
      const hood = ctx.part(box(0.46, 0.18, 0.2, 0x1f1f22, { outline: 0.02 }));
      hood.position.set(0, 0.6, 0.18);
      const collar = ctx.part(box(0.3, 0.06, 0.05, 0x7a2020));
      collar.position.set(0, 0.58, -0.19);
      ctx.torso.add(hood, collar);
    },
  },
  {
    id: 'admin',
    name: 'Ночной Админ',
    role: 'думер, инженер',
    camp: 'feed',
    skin: SKIN,
    hipY: 0.62, hipW: 0.18, legW: 0.19, shortsLen: 1, pants: 0x77736c,
    shoe: { w: 0.24, h: 0.16, d: 0.38, color: 0x5a4632, sole: 0x2a2a2a },
    torso: { w: 0.76, h: 0.6, d: 0.48 }, top: 0x2c5a6b,
    belly: { r: 0.34, y: 0.26, color: 0x9a9a9a },
    sleeve: 1, armLen: 0.58,
    hunch: -0.18,
    head: { H: 0.9, rn: 0.23, rh: 0.27, top: 0.58, zScale: 1.0, lean: 0.02 },
    face(f) {
      f.eye(-40, 0.635, { w: 13, lid: 1.5, bag: true, look: 2 });
      f.eye(40, 0.635, { w: 13, lid: 1.5, bag: true, look: 2 });
      f.wrinkles(0.74, 2, 60, 0.035);
      f.strands(0.82, 0.96, 120, 22, 2.5); // greasy strands
      f.line([[-4, 0.6], [-12, 0.555], [2, 0.54], [12, 0.55]], 3.5);
      f.line([[-14, 0.515], [14, 0.515]], 2.5); // little mustache
      f.line([[-30, 0.49], [0, 0.484], [26, 0.49]], 3.5);
      f.line([[-62, 0.58], [-54, 0.47]], 2.5);
      f.stubble(0.38, 0.5, 70, 170, 2);
    },
    accessories(ctx) {
      glassesRect(ctx, 0.635);
      // Router backpack with antennas and a blue cable loop
      const router = ctx.part(box(0.5, 0.42, 0.18, 0x2a2a2d, { outline: 0.02 }));
      router.position.set(0, 0.36, 0.34);
      const vents = ctx.part(box(0.3, 0.12, 0.02, 0x111114));
      vents.position.set(0, 0.4, 0.44);
      ctx.torso.add(router, vents);
      for (const x of [-0.18, 0.18]) {
        const ant = ctx.part(box(0.04, 0.42, 0.04, 0x1d1d20));
        ant.position.set(x, 0.75, 0.34);
        ctx.torso.add(ant);
      }
      const led = ctx.part(box(0.1, 0.03, 0.02, 0x4ad8ff));
      led.material = toon(0x4ad8ff, { emissive: 0x4ad8ff, emissiveIntensity: 1 });
      led.position.set(0.12, 0.22, 0.44);
      const cable = ctx.part(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 14), toon(0x2a5cc0)));
      cable.position.set(-0.3, 0.12, 0.3);
      cable.rotation.y = Math.PI / 2;
      ctx.torso.add(led, cable);
      // Grey tee showing at the open jacket
      const tee = ctx.part(box(0.3, 0.5, 0.05, 0x9a9a9a));
      tee.position.set(0, 0.32, -0.24);
      ctx.torso.add(tee);
    },
  },
];

// Ночной Админ has no generated model yet and borrows Sanych's
for (const h of HEROES) {
  h.model ??= sanychModel;
  h.modelHeight ??= 1.95;
}

export const CAMPS = {
  garage: 'Гаражный союз',
  feed: 'Поколение ленты',
};

export function makeCharacter(spec, team) {
  return spec.gltf ? new RiggedCharacter(spec, team) : new Character(spec, team);
}

export function heroById(id) {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}
