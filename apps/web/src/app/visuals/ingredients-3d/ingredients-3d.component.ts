import { ChangeDetectionStrategy, Component, effect, input, output, untracked } from '@angular/core';
import * as THREE from 'three';
import type { IngredientSummary } from '../../core/models';
import type { CameraState } from '../../core/workspace-state/workspace-state.service';
import { FAMILIES, role as roleMeta } from '../../shared/families';
import { bubbleMaterial, color, esc, glow, particleCloud, selectionHalo, sphere } from '../three/materials';
import { rng, type PickInfo, type SceneHost } from '../three/scene-host';
import { ThreeStage } from '../three/three-stage';
import { ViewToolsComponent } from '../three/view-tools.component';
import { ZoomBarComponent } from '../three/zoom-bar.component';
import type { FormulaLine } from '../formula-3d/formula-3d.component';

/**
 * 3D Ingredients view (FS-3DI). Formula ingredients as large spheres clustered by family tag,
 * related catalog ingredients (same family, not in formula) as small translucent spheres.
 * Network mode links formula ingredients that share a descriptor tag (curator tags, not chemistry).
 */
@Component({
  selector: 'aur-ingredients-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ViewToolsComponent, ZoomBarComponent],
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 0 0 14px 14px;
      background: radial-gradient(70% 70% at 50% 45%, #ffffff 0%, #f1f5ff 60%, #e8eefc 100%);
    }
    .three-stage {
      position: absolute;
      inset: 0;
      outline: none;
    }
    .tools {
      position: absolute;
      left: 12px;
      top: 12px;
      z-index: 2;
    }
    .zoom {
      position: absolute;
      left: 12px;
      bottom: 12px;
      z-index: 2;
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
      role="application"
      aria-label="3D ingredients view. Arrow keys orbit, plus/minus zoom."
      (keydown)="onKey($event)"
      data-testid="ingredients3d-canvas"
    ></div>
    @if (!webgl()) {
      <div class="fallback" role="note">3D view unavailable. Switch to List view.</div>
    } @else {
      <aur-view-tools
        class="tools"
        [compact]="compactTools()"
        [tool]="tool()"
        (toolChange)="setTool($event)"
        (resetView)="resetView()"
        (focusSelection)="focusSelected()"
        (snapshotPng)="snapshot('ingredients-3d')"
      />
      <aur-zoom-bar
        class="zoom"
        [value]="zoomValue()"
        (zoom)="setZoom($event)"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (rotate)="toggleRotate()"
      />
    }
  `,
})
export class Ingredients3dComponent extends ThreeStage {
  readonly lines = input.required<FormulaLine[]>();
  readonly catalog = input.required<IngredientSummary[]>();
  readonly mode = input<'clusters' | 'network'>('clusters');
  readonly showLabels = input(true);
  readonly showConnections = input(true);
  readonly showRelated = input(true);
  readonly colorBy = input<'family' | 'role'>('family');
  readonly selectedIngredientId = input<string | null>(null);
  readonly compactTools = input(false);
  readonly selectIngredient = output<string>();

  private halo: THREE.Mesh | null = null;
  private built = false;

  constructor() {
    super();
    effect(() => {
      this.lines();
      this.mode();
      this.showLabels();
      this.showConnections();
      this.showRelated();
      this.colorBy();
      if (this.built && this.host) untracked(() => this.rebuild(this.host!));
    });
    effect(() => {
      this.selectedIngredientId();
      untracked(() => this.refreshSelection());
    });
  }

  protected sceneKey() {
    return 'ingredients3d';
  }
  protected defaultCamera(): CameraState {
    return { position: [0, 3.6, 10.5], target: [0, 0, 0] };
  }
  protected build(host: SceneHost) {
    this.built = true;
    this.rebuild(host);
    host.addAnimator((t) => {
      if (!this.halo?.visible) return false;
      this.halo.lookAt(host.camera.position);
      this.halo.rotation.z = t * 0.001;
      return true;
    });
  }

  private rebuild(host: SceneHost) {
    host.clear();
    const lines = this.lines();
    const inFormula = new Map(lines.map((l) => [l.ingredient.id, l]));
    const families = FAMILIES.filter((f) => lines.some((l) => l.ingredient.family === f.key));
    const n = Math.max(families.length, 1);
    const positions = new Map<string, THREE.Vector3>();
    const colorOf = (i: IngredientSummary) =>
      this.colorBy() === 'role' ? new THREE.Color(roleMeta(i.role).color) : color(i.family);
    const network = this.mode() === 'network';

    families.forEach((f, idx) => {
      const a = (idx / n) * Math.PI * 2 - Math.PI / 2;
      const center = new THREE.Vector3(Math.cos(a) * 3.3, Math.sin(a * 2) * 0.7, Math.sin(a) * 2.4);
      const g = new THREE.Group();
      g.position.copy(center);
      const c = color(f.key);
      if (!network) {
        g.add(glow(host, c, 3.2, 0.36));
        g.add(particleCloud(`i3-${f.key}`, c, 60, 0.8, 0.05));
      }
      const members = lines.filter((l) => l.ingredient.family === f.key);
      const related = this.showRelated()
        ? this.catalog().filter((i) => i.family === f.key && !inFormula.has(i.id))
        : [];
      const r = rng(`i3pos-${f.key}`);
      members.forEach((l, k) => {
        const rad = 0.26 + 0.5 * Math.cbrt(l.pct / 100);
        const m = sphere(rad, bubbleMaterial(colorOf(l.ingredient)));
        const ang = (k / Math.max(members.length, 1)) * Math.PI * 2 + r();
        const d = members.length > 1 ? 0.6 : 0;
        m.position.set(Math.cos(ang) * d, (r() - 0.5) * 0.5, Math.sin(ang) * d);
        host.addPickable(m, { kind: 'ingredient', id: l.ingredient.id });
        if (this.showLabels()) {
          const lb = host.label(esc(l.ingredient.name), 'name');
          lb.position.set(0, rad + 0.2, 0);
          m.add(lb);
        }
        g.add(m);
        positions.set(l.ingredient.id, center.clone().add(m.position));
      });
      related.forEach((i, k) => {
        const m = sphere(0.15, bubbleMaterial(colorOf(i), { opacity: 0.45, glow: 0.05 }), 20);
        const ang = (k / Math.max(related.length, 1)) * Math.PI * 2 + 1.3;
        m.position.set(Math.cos(ang) * 1.15, 0.5 + (r() - 0.5) * 0.9, Math.sin(ang) * 1.15);
        host.addPickable(m, { kind: 'ingredient', id: i.id });
        g.add(m);
      });
      const lbl = host.label(
        `<span class="d" style="background:${f.color}"></span><b>${esc(f.label)}</b><br><span class="s" style="padding-left:15px">${members.length} in formula${related.length ? ` · ${related.length} related` : ''}</span>`,
        'card',
      );
      lbl.position.set(0, 1.45, 0);
      g.add(lbl);
      host.root.add(g);
    });

    if (this.showConnections() || network) {
      const pts: number[] = [];
      for (let i = 0; i < lines.length; i++)
        for (let j = i + 1; j < lines.length; j++) {
          const a = lines[i].ingredient;
          const b = lines[j].ingredient;
          const shared = a.descriptors.some((d) => b.descriptors.includes(d));
          if (!shared || a.id === b.id) continue;
          const pa = positions.get(a.id);
          const pb = positions.get(b.id);
          if (pa && pb) pts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        }
      if (pts.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        host.root.add(
          new THREE.LineSegments(
            geo,
            new THREE.LineBasicMaterial({
              color: network ? 0x5b7cff : 0x9fb0d8,
              transparent: true,
              opacity: network ? 0.7 : 0.4,
            }),
          ),
        );
      }
    }
    this.halo = selectionHalo(0.6);
    this.halo.visible = false;
    host.root.add(this.halo);
    this.refreshSelection();
  }

  private refreshSelection() {
    const host = this.host;
    if (!host || !this.halo) return;
    const id = this.selectedIngredientId();
    const t = id ? host.findPickable(id, 'ingredient') : undefined;
    this.halo.visible = !!t;
    if (t) {
      const p = new THREE.Vector3();
      t.getWorldPosition(p);
      this.halo.position.copy(p);
      const rad = ((t as THREE.Mesh).geometry as THREE.SphereGeometry).parameters.radius;
      this.halo.scale.setScalar((rad * 1.6) / 0.6);
    }
    host.invalidate();
  }

  focusSelected() {
    const id = this.selectedIngredientId();
    const o = id ? this.host?.findPickable(id, 'ingredient') : undefined;
    if (o && this.host) this.host.focusOn(o);
  }

  protected override onPick(p: PickInfo | null) {
    if (p?.kind === 'ingredient') this.selectIngredient.emit(p.id);
  }
}
