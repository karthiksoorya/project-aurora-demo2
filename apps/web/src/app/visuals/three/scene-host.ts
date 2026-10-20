import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { CameraState } from '../../core/workspace-state/workspace-state.service';

export interface PickInfo {
  kind: string;
  id: string;
}

export interface SceneDebugApi {
  key: string;
  objectIds(kind?: string): string[];
  screenPos(id: string): { x: number; y: number } | null;
  camera(): CameraState;
  memory(): { geometries: number; textures: number };
  pickables(): number;
}

interface AuroraDebug {
  scenes: Record<string, SceneDebugApi>;
  created: number;
  disposed: number;
  live(): number;
}

declare global {
  interface Window {
    __aurora?: AuroraDebug;
  }
}

function registry(): AuroraDebug {
  if (!window.__aurora) {
    const r: AuroraDebug = {
      scenes: {},
      created: 0,
      disposed: 0,
      live: () => r.created - r.disposed,
    };
    window.__aurora = r;
  }
  return window.__aurora;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Deterministic PRNG so 3D layouts are reproducible (stable screenshots, no random drift). */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SceneHostOptions {
  key: string;
  camera: CameraState;
  saved?: CameraState;
  minDistance?: number;
  maxDistance?: number;
  fov?: number;
  onPick?: (p: PickInfo | null) => void;
  onCamera?: (c: CameraState) => void;
}

/**
 * Owns one WebGL renderer + CSS2D label layer + OrbitControls for a container element.
 * Rendering is on demand (damping/animation keep it alive only while needed).
 * dispose() releases every geometry, material, texture, listener and the GL context.
 */
export class SceneHost {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labels: CSS2DRenderer;
  readonly controls: OrbitControls;
  readonly root = new THREE.Group();
  private readonly pickables: THREE.Object3D[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly ro: ResizeObserver;
  private readonly env: THREE.Texture;
  private frame = 0;
  private needs = true;
  private disposed = false;
  private down: { x: number; y: number } | null = null;
  private camTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly animators = new Set<(t: number) => boolean>();
  private readonly ownedTextures: THREE.Texture[] = [];
  private hovered: THREE.Object3D | null = null;
  hoverHandler?: (o: THREE.Object3D | null) => void;

  constructor(
    private readonly container: HTMLElement,
    private readonly opts: SceneHostOptions,
  ) {
    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 42, Math.max(w, 1) / Math.max(h, 1), 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'three-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    this.labels.domElement.className = 'three-labels';
    container.appendChild(this.labels.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    room.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe3ff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 8, 6);
    this.scene.add(sun);
    this.scene.add(this.root);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = opts.minDistance ?? 2;
    this.controls.maxDistance = opts.maxDistance ?? 40;
    this.applyCamera(opts.saved ?? opts.camera);
    this.controls.addEventListener('change', this.onControlsChange);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointermove', this.onMove);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    const reg = registry();
    reg.created++;
    reg.scenes[opts.key] = this.debugApi();
    this.loop();
  }

  // ------------------------------------------------------------------ camera
  applyCamera(c: CameraState) {
    this.camera.position.set(...c.position);
    this.controls.target.set(...c.target);
    this.controls.update();
    this.invalidate();
  }
  cameraState(): CameraState {
    const p = this.camera.position;
    const t = this.controls.target;
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return { position: [r(p.x), r(p.y), r(p.z)], target: [r(t.x), r(t.y), r(t.z)] };
  }
  resetCamera() {
    this.applyCamera(this.opts.camera);
    this.opts.onCamera?.(this.cameraState());
  }
  zoom(factor: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(dir.setLength(len));
    this.controls.update();
    this.invalidate();
  }
  /** Distance as 0..1 between min and max (for zoom sliders). */
  zoomLevel() {
    const d = this.camera.position.distanceTo(this.controls.target);
    return 1 - (d - this.controls.minDistance) / (this.controls.maxDistance - this.controls.minDistance);
  }
  setZoomLevel(v: number) {
    const d = this.controls.maxDistance - v * (this.controls.maxDistance - this.controls.minDistance);
    const dir = this.camera.position.clone().sub(this.controls.target).setLength(d);
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
    this.invalidate();
  }
  orbit(dAzimuth: number, dPolar: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    s.theta += dAzimuth;
    s.phi = THREE.MathUtils.clamp(s.phi + dPolar, 0.15, Math.PI - 0.15);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));
    this.controls.update();
    this.invalidate();
  }
  pan(dx: number, dy: number) {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0).multiplyScalar(dx);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1).multiplyScalar(dy);
    this.camera.position.add(right).add(up);
    this.controls.target.add(right).add(up);
    this.controls.update();
    this.invalidate();
  }
  focusOn(obj: THREE.Object3D) {
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    const off = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(p);
    this.camera.position.copy(p).add(off.setLength(Math.max(off.length() * 0.7, this.controls.minDistance + 1)));
    this.controls.update();
    this.invalidate();
  }
  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 0.8;
    this.invalidate();
  }
  get autoRotate() {
    return this.controls.autoRotate;
  }

  // ------------------------------------------------------------------ content helpers
  addPickable(obj: THREE.Object3D, info: PickInfo) {
    obj.userData['pick'] = info;
    this.pickables.push(obj);
  }
  findPickable(id: string, kind?: string) {
    return this.pickables.find((o) => {
      const p = o.userData['pick'] as PickInfo;
      return p.id === id && (!kind || p.kind === kind);
    });
  }
  /** Remove + dispose everything under root (keeps lights / env). */
  clear() {
    disposeTree(this.root);
    this.root.clear();
    this.pickables.length = 0;
    this.hovered = null;
    this.invalidate();
  }
  label(html: string, cls = '', onClick?: () => void): CSS2DObject {
    const div = document.createElement('div');
    div.className = `three-label ${cls}`;
    div.innerHTML = html;
    if (onClick) {
      div.classList.add('clickable');
      div.addEventListener('pointerdown', (e) => e.stopPropagation());
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
    }
    return new CSS2DObject(div);
  }
  glowTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData['shared'] = true; // owned by the host, disposed in dispose()
    this.ownedTextures.push(t);
    return t;
  }
  addAnimator(fn: (t: number) => boolean) {
    this.animators.add(fn);
    this.invalidate();
    return () => this.animators.delete(fn);
  }
  invalidate() {
    this.needs = true;
  }
  snapshot(): string {
    this.renderNow();
    return this.renderer.domElement.toDataURL('image/png');
  }

  // ------------------------------------------------------------------ internals
  private readonly onControlsChange = () => {
    this.invalidate();
    if (this.camTimer) clearTimeout(this.camTimer);
    this.camTimer = setTimeout(() => this.opts.onCamera?.(this.cameraState()), 250);
  };
  private readonly onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private readonly onUp = (e: PointerEvent) => {
    if (!this.down) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    this.down = null;
    if (moved > 5) return; // it was a drag (orbit/pan), not a click
    const hit = this.hit(e);
    this.opts.onPick?.(hit ? (hit.userData['pick'] as PickInfo) : null);
  };
  private readonly onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const hit = this.hit(e);
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.hoverHandler?.(hit);
      this.invalidate();
    }
  };
  private hit(e: PointerEvent): THREE.Object3D | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hits = this.ray.intersectObjects(
      this.pickables.filter((p) => p.visible),
      true,
    );
    // specific objects (ingredients, atoms) win over enclosing group hit-volumes (families)
    let fallback: THREE.Object3D | null = null;
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData['pick']) o = o.parent;
      if (!o) continue;
      if ((o.userData['pick'] as PickInfo).kind !== 'family') return o;
      fallback ??= o;
    }
    return fallback;
  }
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.invalidate();
  }
  private renderNow() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
  private loop = (t = 0) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const moved = this.controls.update();
    let anim = false;
    for (const a of this.animators) anim = a(t) || anim;
    if (moved || anim || this.needs || this.controls.autoRotate) {
      this.needs = false;
      this.renderNow();
    }
  };

  private debugApi(): SceneDebugApi {
    return {
      key: this.opts.key,
      objectIds: (kind) =>
        this.pickables
          .map((o) => o.userData['pick'] as PickInfo)
          .filter((p) => !kind || p.kind === kind)
          .map((p) => `${p.kind}:${p.id}`),
      screenPos: (id) => {
        const o = this.pickables.find((x) => {
          const p = x.userData['pick'] as PickInfo;
          return `${p.kind}:${p.id}` === id || p.id === id;
        });
        if (!o) return null;
        const v = new THREE.Vector3();
        o.getWorldPosition(v);
        v.project(this.camera);
        const r = this.renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      camera: () => this.cameraState(),
      memory: () => ({
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      }),
      pickables: () => this.pickables.length,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    if (this.camTimer) {
      clearTimeout(this.camTimer);
      this.opts.onCamera?.(this.cameraState());
    }
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    this.controls.removeEventListener('change', this.onControlsChange);
    this.controls.dispose();
    this.animators.clear();
    disposeTree(this.scene);
    this.env.dispose();
    this.ownedTextures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
    this.labels.domElement.remove();
    const reg = registry();
    reg.disposed++;
    if (reg.scenes[this.opts.key]?.key === this.opts.key) delete reg.scenes[this.opts.key];
  }
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture && !v.userData['shared']) v.dispose();
      m.dispose();
    }
    if (o instanceof CSS2DObject) o.element.remove();
  });
}
