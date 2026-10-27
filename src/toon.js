import * as THREE from 'three';

// Three-band gradient gives the flat cartoon shading.
const gradientMap = (() => {
  const data = new Uint8Array([90, 170, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const cache = new Map();

export function toon(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!opts.unique && cache.has(key)) return cache.get(key);
  const mat = new THREE.MeshToonMaterial({ color, gradientMap, ...stripUnique(opts) });
  if (!opts.unique) {
    mat.userData.shared = true;
    cache.set(key, mat);
  }
  return mat;
}

function stripUnique(opts) {
  const { unique, ...rest } = opts;
  return rest;
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1d1a24, side: THREE.BackSide });

// Inverted-hull outline: a slightly bigger copy rendered from the back faces.
export function addOutline(mesh, thickness = 0.06) {
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  mesh.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(size);
  outline.scale.set(
    1 + (thickness * 2) / Math.max(size.x, 0.01),
    1 + (thickness * 2) / Math.max(size.y, 0.01),
    1 + (thickness * 2) / Math.max(size.z, 0.01),
  );
  outline.userData.isOutline = true;
  mesh.add(outline);
  return mesh;
}

export function box(w, h, d, color, { outline = 0, shadows = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  if (outline) addOutline(mesh, outline);
  return mesh;
}
