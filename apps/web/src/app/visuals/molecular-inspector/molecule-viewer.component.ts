import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import * as THREE from 'three';
import type { Structure } from '../../core/models';
import type { CameraState } from '../../core/workspace-state/workspace-state.service';
import type { SceneHost } from '../three/scene-host';
import { ThreeStage } from '../three/three-stage';
import { ViewToolsComponent } from '../three/view-tools.component';
import { ZoomBarComponent } from '../three/zoom-bar.component';

const CPK: Record<string, { c: number; r: number; label: string }> = {
  C: { c: 0x3a3d45, r: 0.36, label: 'Carbon (C)' },
  H: { c: 0xf2f4f7, r: 0.22, label: 'Hydrogen (H)' },
  O: { c: 0xe8412c, r: 0.35, label: 'Oxygen (O)' },
  N: { c: 0x3050f8, r: 0.35, label: 'Nitrogen (N)' },
  S: { c: 0xf2c200, r: 0.42, label: 'Sulfur (S)' },
};

/**
 * Ball-and-stick viewer for ONE curated single-compound structure (FS-MI1/MI2).
 * Coordinates come from the API structure fixture (RDKit conformer from curated SMILES) —
 * never from a natural mixture, never invented in the client.
 */
@Component({
  selector: 'aur-molecule-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ViewToolsComponent, ZoomBarComponent],
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 12px;
      background: radial-gradient(70% 80% at 50% 40%, #ffffff 0%, #f2f6ff 60%, #e9f2e6 100%);
    }
    .three-stage {
      position: absolute;
      inset: 0;
      outline: none;
    }
    .tools {
      position: absolute;
      left: 10px;
      top: 10px;
      z-index: 2;
    }
    .zoom {
      position: absolute;
      left: 10px;
      bottom: 10px;
      z-index: 2;
    }
    .legend {
      position: absolute;
      left: 76px;
      bottom: 60px;
      z-index: 2;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .legend span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend i {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }
    .svg2d {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: #fff;
    }
    .svg2d svg {
      width: 86%;
      height: 86%;
    }
    .toggle {
      position: absolute;
      right: 10px;
      top: 10px;
      z-index: 3;
    }
    .fallback {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--muted);
    }
  `,
  template: `
    <div
      #stage
      class="three-stage"
      tabindex="0"
      role="img"
      [attr.aria-label]="'3D ball-and-stick model of ' + structure().name"
      (keydown)="onKey($event)"
      data-testid="molecule-canvas"
    ></div>
    <div class="seg toggle" role="group" aria-label="Structure view">
      <button [class.on]="!show2d()" (click)="show2d.set(false)">3D View</button>
      <button [class.on]="show2d()" (click)="show2d.set(true)" data-testid="molecule-2d">2D View</button>
    </div>
    @if (show2d()) {
      <div class="svg2d" data-testid="molecule-svg">
        <svg [attr.viewBox]="d2.viewBox" role="img" [attr.aria-label]="'2D skeletal structure of ' + structure().name">
          @for (b of d2.bonds; track $index) {
            <line
              [attr.x1]="b.x1"
              [attr.y1]="b.y1"
              [attr.x2]="b.x2"
              [attr.y2]="b.y2"
              stroke="#2b2f3a"
              stroke-width="0.07"
              stroke-linecap="round"
            />
            @if (b.double) {
              <line
                [attr.x1]="b.dx1"
                [attr.y1]="b.dy1"
                [attr.x2]="b.dx2"
                [attr.y2]="b.dy2"
                stroke="#2b2f3a"
                stroke-width="0.06"
                [attr.stroke-dasharray]="b.aromatic ? '0.12 0.08' : null"
              />
            }
          }
          @for (a of d2.hetero; track $index) {
            <circle [attr.cx]="a.x" [attr.cy]="a.y" r="0.26" fill="#fff" />
            <text
              [attr.x]="a.x"
              [attr.y]="a.y + 0.15"
              font-size="0.45"
              text-anchor="middle"
              [attr.fill]="a.el === 'O' ? '#e8412c' : '#3050f8'"
              font-weight="600"
            >
              {{ a.el }}
            </text>
          }
        </svg>
      </div>
    }
    @if (!webgl()) {
      <div class="fallback">3D unavailable — use 2D View.</div>
    } @else if (!show2d()) {
      @if (tools()) {
        <aur-view-tools
          class="tools"
          [tool]="tool()"
          [showFocus]="false"
          (toolChange)="setTool($event)"
          (resetView)="resetView()"
          (snapshotPng)="snapshot(structure().compoundId)"
        />
      }
      <aur-zoom-bar
        class="zoom"
        [value]="zoomValue()"
        (zoom)="setZoom($event)"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (rotate)="toggleRotate()"
      />
      <div class="legend" aria-label="Atom colour legend">
        @for (e of elements(); track e) {
          <span><i [style.background]="hex(e)"></i>{{ label(e) }}</span>
        }
      </div>
    }
  `,
})
export class MoleculeViewerComponent extends ThreeStage {
  readonly structure = input.required<Structure>();
  readonly tools = input(true);
  readonly key = input('molecule');
  readonly show2d = signal(false);
  readonly elements = computed(() =>
    [...new Set(this.structure().atoms.map((a) => a.el))].sort((a, b) =>
      a === 'C' ? -1 : b === 'C' ? 1 : a.localeCompare(b),
    ),
  );
  private built = false;

  constructor() {
    super();
    effect(() => {
      this.structure();
      if (this.built && this.host) untracked(() => this.rebuild(this.host!));
    });
  }

  hex(e: string) {
    return `#${(CPK[e]?.c ?? 0xaa66ff).toString(16).padStart(6, '0')}`;
  }
  label(e: string) {
    return CPK[e]?.label ?? e;
  }

  protected sceneKey() {
    return this.key();
  }
  protected defaultCamera(): CameraState {
    return { position: [0, 1.5, 11], target: [0, 0, 0] };
  }
  protected override limits() {
    return { min: 3, max: 30 };
  }
  protected build(host: SceneHost) {
    this.built = true;
    this.rebuild(host);
  }

  private rebuild(host: SceneHost) {
    host.clear();
    const s = this.structure();
    const g = new THREE.Group();
    const mats = new Map<string, THREE.Material>();
    const mat = (el: string) => {
      let m = mats.get(el);
      if (!m) {
        m = new THREE.MeshPhysicalMaterial({
          color: CPK[el]?.c ?? 0xaa66ff,
          roughness: 0.25,
          clearcoat: 0.8,
          metalness: 0.05,
        });
        mats.set(el, m);
      }
      return m;
    };
    const geoCache = new Map<number, THREE.SphereGeometry>();
    let maxR = 1;
    s.atoms.forEach((a, i) => {
      const r = CPK[a.el]?.r ?? 0.35;
      let geo = geoCache.get(r);
      if (!geo) {
        geo = new THREE.SphereGeometry(r, 28, 20);
        geoCache.set(r, geo);
      }
      const m = new THREE.Mesh(geo, mat(a.el));
      m.position.set(a.x, a.y, a.z);
      maxR = Math.max(maxR, m.position.length());
      host.addPickable(m, { kind: 'atom', id: `${i}` });
      g.add(m);
    });
    const bondMat = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.4, metalness: 0.1 });
    const up = new THREE.Vector3(0, 1, 0);
    const cyl = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), bondMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
      g.add(m);
    };
    for (const b of s.bonds) {
      const A = s.atoms[b.a];
      const B = s.atoms[b.b];
      const pa = new THREE.Vector3(A.x, A.y, A.z);
      const pb = new THREE.Vector3(B.x, B.y, B.z);
      if (b.order >= 1.5) {
        const dir = pb.clone().sub(pa).normalize();
        const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
        if (side.lengthSq() < 1e-3) side.set(1, 0, 0);
        side.normalize().multiplyScalar(0.11);
        cyl(pa.clone().add(side), pb.clone().add(side), 0.06);
        cyl(pa.clone().sub(side), pb.clone().sub(side), b.order === 1.5 ? 0.035 : 0.06);
      } else cyl(pa, pb, 0.085);
    }
    host.root.add(g);
    const d = Math.max(5.5, maxR * 2.05);
    host.applyCamera({ position: [0, d * 0.15, d], target: [0, 0, 0] });
  }

  /** 2D skeletal depiction from the fixture's RDKit 2D coordinates (heavy atoms only). */
  readonly d2c = computed(() => {
    const dep = this.structure().depiction2d;
    const xs = dep.atoms.map((a) => a.x);
    const ys = dep.atoms.map((a) => -a.y);
    const pad = 0.9;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad;
    const h = Math.max(...ys) - minY + pad;
    const P = (i: number) => ({ x: dep.atoms[i].x, y: -dep.atoms[i].y });
    const bonds = dep.bonds.map((b) => {
      const p1 = P(b.a);
      const p2 = P(b.b);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * 0.16;
      const ny = (dx / L) * 0.16;
      const shrink = 0.15;
      return {
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        double: b.order >= 1.5,
        aromatic: b.aromatic,
        dx1: p1.x + nx + dx * shrink,
        dy1: p1.y + ny + dy * shrink,
        dx2: p2.x + nx - dx * shrink,
        dy2: p2.y + ny - dy * shrink,
      };
    });
    const hetero = dep.atoms.map((a, i) => ({ el: a.el, ...P(i) })).filter((a) => a.el !== 'C');
    return { viewBox: `${minX} ${minY} ${w} ${h}`, bonds, hetero };
  });
  get d2() {
    return this.d2c();
  }
}
