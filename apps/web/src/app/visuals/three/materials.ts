import * as THREE from 'three';
import { fam } from '../../shared/families';
import { rng, type SceneHost } from './scene-host';

export const color = (familyKey: string) => new THREE.Color(fam(familyKey).color);

/** Glossy "bubble" sphere material used for ingredients (bright, colourful, light background friendly). */
export function bubbleMaterial(c: THREE.Color, opts: { opacity?: number; glow?: number } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.18,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffffff),
    emissive: c.clone().multiplyScalar(opts.glow ?? 0.18),
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    envMapIntensity: 1.1,
  });
}

export function sphere(radius: number, mat: THREE.Material, seg = 32) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, seg, Math.round(seg * 0.75)), mat);
}

/** Additive-looking soft halo (normal blending so it reads on a white background). */
export function glow(host: SceneHost, c: THREE.Color, scale: number, opacity = 0.42) {
  const m = new THREE.SpriteMaterial({
    map: host.glowTexture(),
    color: c,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  s.renderOrder = -1;
  return s;
}

/** Cloud of small particles around a centre (instanced, deterministic). */
export function particleCloud(seed: string, c: THREE.Color, count: number, radius: number, size = 0.06) {
  const r = rng(seed);
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.35,
    metalness: 0.0,
    emissive: c.clone().multiplyScalar(0.25),
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // gaussian-ish radial distribution
    const u = r(),
      v = r(),
      w = (r() + r() + r()) / 3;
    const th = 2 * Math.PI * u;
    const ph = Math.acos(2 * v - 1);
    const d = radius * w * 1.6;
    const s = 0.5 + r() * 1.3;
    m.makeScale(s, s, s);
    m.setPosition(d * Math.sin(ph) * Math.cos(th), d * Math.cos(ph) * 0.8, d * Math.sin(ph) * Math.sin(th));
    mesh.setMatrixAt(i, m);
    tint.copy(c).offsetHSL((r() - 0.5) * 0.06, (r() - 0.5) * 0.2, (r() - 0.5) * 0.25);
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function ring(radius: number, c: THREE.Color | number, opacity = 0.35, tube = 0.012) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 8, 160),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

export function selectionHalo(radius: number) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(radius, Math.max(radius * 0.06, 0.02), 10, 64),
    new THREE.MeshBasicMaterial({ color: 0x1f66ff, transparent: true, opacity: 0.9 }),
  );
  m.name = 'halo';
  return m;
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
