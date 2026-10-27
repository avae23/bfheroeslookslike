import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { Bot } from './bots.js';
import { Effects } from './effects.js';
import { Grenade } from './grenade.js';
import { controls } from './controls.js';
import { HEROES, CAMPS, heroById } from './heroes.js';

const MAG_SIZE = 30;
const FIRE_INTERVAL = 0.11;
const RELOAD_TIME = 1.2;
const BODY_DAMAGE = 20;
const HEAD_DAMAGE = 45;
const GRENADE_COOLDOWN = 5;
const BLAST_RADIUS = 6.5;
const BLAST_DAMAGE = 120;
const BOT_COUNT = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 300);

const world = new World(scene);
const effects = new Effects(scene);
function savedHeroId() {
  try {
    return localStorage.getItem('hero');
  } catch {
    return null;
  }
}

let hero = heroById(savedHeroId() ?? 'palych');
const enemiesOf = (h) => HEROES.filter((e) => e.camp !== h.camp);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const player = new Player(scene, world, camera, hero);
player.showcase = true;
const bots = [];
for (let i = 0; i < BOT_COUNT; i++) {
  const enemies = enemiesOf(hero);
  const bot = new Bot(scene, world, world.spawnPoints[(i * 5) % world.spawnPoints.length], enemies[i % enemies.length]);
  bot.roster = enemies;
  bots.push(bot);
}

function selectHero(next) {
  const campChanged = next.camp !== hero.camp;
  hero = next;
  try {
    localStorage.setItem('hero', next.id);
  } catch {}
  player.setHero(next);
  if (campChanged) {
    const enemies = enemiesOf(next);
    bots.forEach((bot, i) => {
      bot.roster = enemies;
      bot.setHero(enemies[i % enemies.length]);
      bot.respawn(pick(world.spawnPoints));
    });
  }
  renderHeroList();
}

const heroList = document.getElementById('hero-list');
function renderHeroList() {
  heroList.innerHTML = '';
  for (const h of HEROES) {
    const btn = document.createElement('button');
    btn.className = `hero-btn camp-${h.camp}${h === hero ? ' selected' : ''}`;
    btn.innerHTML = `<b>${h.name}</b><span>${h.role}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectHero(h);
    });
    heroList.append(btn);
  }
  document.getElementById('hero-camp').textContent = `${CAMPS[hero.camp]} против «${CAMPS[enemiesOf(hero)[0].camp]}»`;
}
renderHeroList();
const grenades = [];

const hud = {
  overlay: document.getElementById('overlay'),
  ammo: document.getElementById('ammo'),
  ammoPill: document.getElementById('ammo-pill'),
  kills: document.getElementById('kills'),
  grenadeCd: document.getElementById('grenade-cd'),
  hitmarker: document.getElementById('hitmarker'),
};

const state = {
  ammo: MAG_SIZE,
  fireTimer: 0,
  reloading: 0,
  firing: false,
  grenadeCd: 0,
  kills: 0,
  hitmarker: 0,
};

// --- Input -----------------------------------------------------------------

hud.overlay.addEventListener('click', async () => {
  player.showcase = false;
  try {
    await renderer.domElement.requestPointerLock();
  } catch {
    controls.fallback = true;
    hud.overlay.classList.add('hidden');
  }
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  hud.overlay.classList.toggle('hidden', locked);
  player.showcase = !locked && !controls.fallback;
  if (!locked) state.firing = false;
  if (locked) controls.fallback = false;
});
addEventListener('mousedown', (e) => {
  if (e.button === 0 && controls.active) state.firing = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) state.firing = false;
});
addEventListener('keydown', (e) => {
  if (!controls.active) return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyQ') throwGrenade();
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Weapons ---------------------------------------------------------------

const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();

function startReload() {
  if (state.reloading > 0 || state.ammo === MAG_SIZE) return;
  state.reloading = RELOAD_TIME;
}

function shoot() {
  state.ammo--;
  state.fireTimer = FIRE_INTERVAL;
  player.addShake(0.08);

  // Aim through the crosshair from the camera, with a little spread
  const dir = player.aimDir().add(
    new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.025),
  ).normalize();
  ray.set(camera.position, dir);
  ray.far = 200;

  let best = { distance: Infinity, point: camera.position.clone().addScaledVector(dir, 200), normal: null, bot: null };
  const wallHit = ray.intersectObjects(world.solids, false)[0];
  if (wallHit) best = { distance: wallHit.distance, point: wallHit.point, normal: wallHit.face?.normal ?? new THREE.Vector3(0, 1, 0), bot: null };
  for (const bot of bots) {
    if (!bot.alive) continue;
    const p = ray.ray.intersectBox(bot.getBox(), tmp);
    if (!p) continue;
    const d = p.distanceTo(camera.position);
    if (d < best.distance) best = { distance: d, point: p.clone(), normal: dir.clone().negate(), bot };
  }

  const muzzle = player.model.muzzle.getWorldPosition(new THREE.Vector3());
  effects.muzzleFlash(muzzle, dir);
  effects.tracer(muzzle, best.point);

  if (best.bot) {
    const head = best.point.y > best.bot.body.pos.y + best.bot.model.headY;
    const dmg = head ? HEAD_DAMAGE : BODY_DAMAGE;
    const killed = best.bot.damage(dmg, dir.clone().setY(0).multiplyScalar(1.5));
    effects.impact(best.point, best.normal, head ? 0xffd23a : 0xff6b4d);
    effects.popText(best.point.clone().add(new THREE.Vector3(0, 0.4, 0)), head ? `${dmg}!` : `${dmg}`, head ? '#ffd23a' : '#ffffff');
    showHitmarker();
    if (killed) onKill(best.bot);
  } else if (best.normal) {
    effects.impact(best.point, best.normal);
  }
}

function throwGrenade() {
  if (state.grenadeCd > 0) return;
  state.grenadeCd = GRENADE_COOLDOWN;
  const start = player.model.muzzle.getWorldPosition(new THREE.Vector3());
  const vel = player.aimDir().multiplyScalar(17).add(new THREE.Vector3(0, 4.5, 0)).add(player.body.vel.clone().multiplyScalar(0.5));
  grenades.push(new Grenade(scene, start, vel));
}

function explode(pos) {
  effects.explosion(pos, BLAST_RADIUS);

  const push = (center, falloff) =>
    center.clone().sub(pos).setY(0).normalize().multiplyScalar(14 * falloff + 3).setY(9 * falloff + 4);

  for (const bot of bots) {
    if (!bot.alive) continue;
    const center = bot.body.center();
    const d = center.distanceTo(pos);
    if (d > BLAST_RADIUS) continue;
    const falloff = 1 - d / BLAST_RADIUS;
    const dmg = Math.round(BLAST_DAMAGE * (0.35 + 0.65 * falloff));
    const killed = bot.damage(dmg, push(center, falloff));
    effects.popText(center.clone().add(new THREE.Vector3(0, 1.2, 0)), `${dmg}`, '#ffb347');
    showHitmarker();
    if (killed) onKill(bot);
  }

  // The player gets knocked around too (no self-damage), which allows grenade jumps
  const pc = player.body.center();
  const pd = pc.distanceTo(pos);
  if (pd < BLAST_RADIUS) player.body.vel.add(push(pc, 1 - pd / BLAST_RADIUS).multiplyScalar(0.8));
  player.addShake(Math.max(0.25, 1 - pd / 25));
}

function onKill(bot) {
  state.kills++;
  effects.popText(bot.body.center().add(new THREE.Vector3(0, 1.6, 0)), '+1', '#6bdc4a');
}

function showHitmarker() {
  state.hitmarker = 0.12;
}

// --- Loop --------------------------------------------------------------------

function updateWeapons(dt) {
  state.fireTimer -= dt;
  state.grenadeCd = Math.max(0, state.grenadeCd - dt);
  if (state.reloading > 0) {
    state.reloading -= dt;
    if (state.reloading <= 0) state.ammo = MAG_SIZE;
  } else if (state.firing && state.fireTimer <= 0) {
    if (state.ammo > 0) shoot();
    else startReload();
  }

  for (const g of grenades) {
    const boom = g.update(dt, world.colliders);
    if (boom) explode(boom);
  }
  for (let i = grenades.length - 1; i >= 0; i--) if (grenades[i].done) grenades.splice(i, 1);
}

function updateHud(dt) {
  document.getElementById('hud').hidden = player.showcase;
  hud.ammo.textContent = state.reloading > 0 ? '…' : state.ammo;
  hud.ammoPill.classList.toggle('warn', state.ammo <= 5 || state.reloading > 0);
  hud.kills.textContent = state.kills;
  hud.grenadeCd.style.height = `${(state.grenadeCd / GRENADE_COOLDOWN) * 100}%`;
  state.hitmarker -= dt;
  hud.hitmarker.classList.toggle('show', state.hitmarker > 0);
}

function separate(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const min = a.radius + b.radius;
  const d = Math.hypot(dx, dz);
  if (d >= min || d < 1e-4 || Math.abs(a.pos.y - b.pos.y) > 1.5) return;
  const push = (min - d) / 2;
  a.pos.x -= (dx / d) * push;
  a.pos.z -= (dz / d) * push;
  b.pos.x += (dx / d) * push;
  b.pos.z += (dz / d) * push;
}

let lastTime = performance.now();
function frame(time) {
  const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 0.05);
  lastTime = time;
  const living = bots.filter((b) => b.alive).map((b) => b.body);
  for (let i = 0; i < living.length; i++) {
    separate(player.body, living[i]);
    for (let j = i + 1; j < living.length; j++) separate(living[i], living[j]);
  }
  player.update(dt);
  updateWeapons(dt);
  for (const bot of bots) bot.update(dt, camera, world.spawnPoints);
  effects.update(dt);
  updateHud(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at things from the devtools console
window.game = { scene, player, bots, world, shoot, explode, throwGrenade, selectHero, HEROES };
