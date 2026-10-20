import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import * as THREE from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { IngredientSummary } from '../../core/models';
import type { CameraState } from '../../core/workspace-state/workspace-state.service';
import { FAMILIES } from '../../shared/families';
import { bubbleMaterial, color, esc, glow, particleCloud, ring, selectionHalo, sphere } from '../three/materials';
import { rng, type PickInfo, type SceneHost } from '../three/scene-host';
import { ThreeStage } from '../three/three-stage';
import { ViewToolsComponent } from '../three/view-tools.component';
import { ZoomBarComponent } from '../three/zoom-bar.component';

interface Node {
  ing: IngredientSummary;
  mesh: THREE.Mesh;
  label: CSS2DObject;
  base: number;
}

/**
 * Ingredient Universe (IE-U1 baseline, IE-U2 selection, IE-U3 expanded camera variant).
 * Exploratory layout: ingredients are grouped by their primary family tag on a ring.
 * Distances do NOT encode measured olfactive similarity.
 */
@Component({
  selector: 'aur-ingredient-universe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ViewToolsComponent, ZoomBarComponent],
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 14px;
      overflow: hidden;
      background: radial-gradient(60% 70% at 50% 45%, #ffffff 0%, #f3f6ff 55%, #e9eefb 100%);
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
    .note {
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 2;
      font-size: 11px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.85);
      padding: 4px 8px;
      border-radius: 8px;
    }
    .fallback {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--muted);
      padding: 20px;
      text-align: center;
    }
  `,
  template: `
    <div
      #stage
      class="three-stage"
      tabindex="0"
      role="application"
      aria-label="3D ingredient universe. Arrow keys orbit, plus and minus zoom, W A S D pan, 0 resets. Use the list for a non-3D alternative."
      (keydown)="onKey($event)"
      data-testid="universe-canvas"
    ></div>
    @if (!webgl()) {
      <div class="fallback" role="note">
        3D view unavailable (WebGL not supported). Use the Ingredient List tab — all selection features work there.
      </div>
    } @else {
      <aur-view-tools
        class="tools"
        [compact]="compactTools()"
        [tool]="tool()"
        (toolChange)="setTool($event)"
        (resetView)="resetView()"
        (focusSelection)="focusSelected()"
        (snapshotPng)="snapshot('ingredient-universe')"
      />
      <aur-zoom-bar
        class="zoom"
        [value]="zoomValue()"
        (zoom)="setZoom($event)"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (rotate)="toggleRotate()"
      />
      <span class="note">Exploratory layout · grouped by family tag · not measured similarity</span>
    }
  `,
})
export class IngredientUniverseComponent extends ThreeStage {
  readonly ingredients = input.required<IngredientSummary[]>();
  readonly visibleIds = input<Set<string> | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly inFormulaIds = input<Set<string>>(new Set());
  readonly key = input('universe');
  readonly compactTools = input(false);
  readonly selectIngredient = output<string>();
  readonly selectFamily = output<string>();

  private nodes = new Map<string, Node>();
  private halo: THREE.Mesh | null = null;
  private hoverId: string | null = null;

  constructor() {
    super();
    effect(() => {
      // re-apply highlight state when inputs change (no rebuild => camera untouched)
      this.visibleIds();
      this.selectedId();
      this.inFormulaIds();
      this.refresh();
    });
  }

  protected sceneKey() {
    return this.key();
  }
  protected defaultCamera(): CameraState {
    return { position: [0, 8.6, 11.6], target: [0, -0.4, 0.3] };
  }
  protected override limits() {
    return { min: 3, max: 24 };
  }

  static familyCenter(index: number, count: number) {
    const a = (index / count) * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector3(Math.cos(a) * 5.4, Math.sin(a * 3) * 0.5, Math.sin(a) * 3.9);
  }

  protected build(host: SceneHost) {
    const all = this.ingredients();
    const fams = FAMILIES.filter((f) => all.some((i) => i.family === f.key));
    const r1 = ring(5.4, 0x9fb4ff, 0.25);
    r1.scale.set(1, 3.9 / 5.4, 1);
    host.root.add(r1);
    const orbit2 = ring(3.4, 0xd59cff, 0.2);
    orbit2.rotation.y = 0.5;
    host.root.add(orbit2);

    fams.forEach((f, idx) => {
      const center = IngredientUniverseComponent.familyCenter(idx, fams.length);
      const g = new THREE.Group();
      g.position.copy(center);
      const c = color(f.key);
      g.add(glow(host, c, 3.4, 0.45));
      g.add(particleCloud(`u-${f.key}`, c, 70, 0.8, 0.05));
      g.add(particleCloud(`u2-${f.key}`, c.clone().offsetHSL(0, 0, 0.15), 30, 1.1, 0.03));
      const members = all.filter((i) => i.family === f.key);
      const lbl = host.label(
        `<span class="d" style="background:${f.color}"></span><b>${esc(f.label)}</b>`,
        'pill',
        () => this.selectFamily.emit(f.key),
      );
      lbl.position.set(0, 1.25, 0);
      lbl.element.dataset['family'] = f.key;
      g.add(lbl);
      const r = rng(`u-pos-${f.key}`);
      members.forEach((ing, k) => {
        const radius = 0.34 + (ing.kind === 'natural_mixture' ? 0.1 : 0);
        const m = sphere(radius, bubbleMaterial(new THREE.Color(`hsl(${ing.art.hue}, 80%, 58%)`).lerp(c, 0.55)));
        const ang = (k / Math.max(members.length, 1)) * Math.PI * 2 + r() * 0.6;
        const d = members.length === 1 ? 0 : 0.6 + r() * 0.3;
        m.position.set(Math.cos(ang) * d, (r() - 0.5) * 0.7, Math.sin(ang) * d);
        host.addPickable(m, { kind: 'ingredient', id: ing.id });
        const label = host.label(`${esc(ing.name)}`, 'name');
        label.position.set(0, radius + 0.42, 0);
        m.add(label);
        g.add(m);
        this.nodes.set(ing.id, { ing, mesh: m, label, base: 1 });
      });
      host.root.add(g);
    });
    this.halo = selectionHalo(0.5);
    this.halo.visible = false;
    host.root.add(this.halo);
    host.hoverHandler = (o) => {
      const p = o?.userData['pick'] as PickInfo | undefined;
      this.hoverId = p?.kind === 'ingredient' ? p.id : null;
      this.refresh();
    };
    host.addAnimator((t) => {
      if (!this.halo?.visible) return false;
      this.halo.rotation.z = t * 0.0012;
      this.halo.lookAt(host.camera.position);
      return true;
    });
    this.refresh();
  }

  private refresh() {
    if (!this.host || !this.nodes.size) return;
    const vis = this.visibleIds();
    const sel = this.selectedId();
    const inF = this.inFormulaIds();
    for (const [id, n] of this.nodes) {
      const shown = !vis || vis.has(id);
      n.mesh.visible = shown;
      const isSel = id === sel;
      n.mesh.scale.setScalar(isSel ? 1.55 : inF.has(id) ? 1.2 : 1);
      n.label.visible = shown && (isSel || id === this.hoverId); // CSS2DRenderer owns style.display
      n.label.element.innerHTML = isSel
        ? `<b>${esc(n.ing.name)}</b>${inF.has(id) ? ' <span style="color:#1f66ff">· in formula</span>' : ''}`
        : esc(n.ing.name);
      n.label.element.className = `three-label ${isSel ? 'card' : 'name'}`;
      (n.mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = inF.has(id) ? 2.2 : 1;
    }
    const s = sel ? this.nodes.get(sel) : undefined;
    if (this.halo) {
      this.halo.visible = !!s && s.mesh.visible;
      if (s) {
        const p = new THREE.Vector3();
        s.mesh.getWorldPosition(p);
        this.halo.position.copy(p);
      }
    }
    this.host.invalidate();
  }

  focusSelected() {
    const s = this.selectedId();
    const n = s ? this.nodes.get(s) : undefined;
    if (n && this.host) this.host.focusOn(n.mesh);
  }

  protected override onPick(p: PickInfo | null) {
    if (p?.kind === 'ingredient') this.selectIngredient.emit(p.id);
  }

  override ngOnDestroy() {
    this.nodes.clear();
    super.ngOnDestroy();
  }
}
