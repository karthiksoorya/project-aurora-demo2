import { ChangeDetectionStrategy, Component, effect, input, output, untracked } from '@angular/core';
import * as THREE from 'three';
import type { Family, IngredientSummary, NoteRole } from '../../core/models';
import type { CameraState } from '../../core/workspace-state/workspace-state.service';
import { fam, role as roleMeta } from '../../shared/families';
import { bubbleMaterial, color, esc, glow, particleCloud, ring, selectionHalo, sphere } from '../three/materials';
import { rng, type PickInfo, type SceneHost } from '../three/scene-host';
import { ThreeStage } from '../three/three-stage';
import { ViewToolsComponent } from '../three/view-tools.component';
import { ZoomBarComponent } from '../three/zoom-bar.component';

export interface FormulaLine {
  lineId: string;
  ingredient: IngredientSummary;
  pct: number;
}

/**
 * 3D Formula View (FS-3DF; FS-06 when expanded in AI Assist).
 * A bottle surrounded by the formula's family accords. Sphere size ~ cube root of % (w/w);
 * accord shares come from the API's deterministic calculation. Visual only — not a sensory model.
 */
@Component({
  selector: 'aur-formula-3d',
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
      background: linear-gradient(180deg, #e9f4ff 0%, #f6fbff 45%, #fff8ee 100%);
    }
    .three-stage {
      position: absolute;
      inset: 0;
      outline: none;
    }
    .sea {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 38%;
      background: linear-gradient(180deg, rgba(120, 200, 240, 0), rgba(120, 200, 240, 0.18));
      pointer-events: none;
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
      text-align: center;
      padding: 20px;
    }
  `,
  template: `
    <div class="sea"></div>
    <div
      #stage
      class="three-stage"
      tabindex="0"
      role="application"
      aria-label="3D formula view. Arrow keys orbit, plus/minus zoom, 0 resets. The formula table is the accessible alternative."
      (keydown)="onKey($event)"
      data-testid="formula3d-canvas"
    ></div>
    @if (!webgl()) {
      <div class="fallback" role="note">
        3D view unavailable (WebGL not supported). The formula table, accord balance and pyramid show the same data.
      </div>
    } @else {
      @if (showTools()) {
        <aur-view-tools
          class="tools"
          [compact]="compactTools()"
          [tool]="tool()"
          (toolChange)="setTool($event)"
          (resetView)="resetView()"
          (focusSelection)="focusSelected()"
          (snapshotPng)="snapshot('formula-3d')"
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
    }
  `,
})
export class Formula3dComponent extends ThreeStage {
  readonly lines = input.required<FormulaLine[]>();
  readonly accords = input.required<{ family: Family; sharePct: string }[]>();
  readonly pyramid = input<Record<NoteRole, { massPct: string }> | null>(null);
  readonly view = input<'families' | 'volatility'>('families');
  readonly layer = input<'bottle' | 'ingredients'>('bottle');
  readonly selectedIngredientId = input<string | null>(null);
  readonly selectedFamily = input<string | null>(null);
  readonly showTools = input(true);
  readonly key = input('formula3d');
  readonly compactTools = input(false);
  readonly selectIngredient = output<string>();
  readonly selectFamily = output<string | null>();

  private halo: THREE.Mesh | null = null;
  private built = false;

  constructor() {
    super();
    effect(() => {
      this.lines();
      this.accords();
      this.view();
      this.layer();
      if (this.built && this.host) untracked(() => this.rebuild(this.host!));
    });
    effect(() => {
      this.selectedIngredientId();
      this.selectedFamily();
      untracked(() => this.refreshSelection());
    });
  }

  protected sceneKey() {
    return this.key();
  }
  protected defaultCamera(): CameraState {
    return { position: [0, 1.9, 8.2], target: [0, 0.15, 0] };
  }
  protected override limits() {
    return { min: 3.5, max: 18 };
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
    const lines = this.lines().filter((l) => l.pct > 0);
    const showBottle = this.layer() === 'bottle';
    if (showBottle) host.root.add(this.bottle(lines));
    const scaleBoost = showBottle ? 1 : 1.45;
    const r = (pct: number) => (0.14 + 0.62 * Math.cbrt(pct / 100)) * scaleBoost;

    if (this.view() === 'families') {
      const accords = this.accords();
      const n = Math.max(accords.length, 1);
      accords.forEach((a, i) => {
        const ang = (i / n) * Math.PI * 2 + Math.PI / 6;
        const R = showBottle ? 2.85 : 2.4;
        const center = new THREE.Vector3(Math.cos(ang) * R, Math.sin(ang * 2) * 0.55 + 0.1, Math.sin(ang) * R * 0.75);
        const g = new THREE.Group();
        g.position.copy(center);
        const c = color(a.family);
        const share = Number(a.sharePct);
        g.add(glow(host, c, 1.6 + share / 18, 0.4));
        g.add(particleCloud(`f-${a.family}`, c, Math.round(14 + share * 1.4), 0.35 + share / 90, 0.045));
        const members = lines.filter((l) => l.ingredient.family === a.family);
        const rr = rng(`fpos-${a.family}`);
        members.forEach((l, k) => {
          const m = sphere(
            r(l.pct),
            bubbleMaterial(c.clone().lerp(new THREE.Color(`hsl(${l.ingredient.art.hue},85%,60%)`), 0.35)),
          );
          const aa = (k / Math.max(members.length, 1)) * Math.PI * 2 + rr();
          const d = members.length > 1 ? 0.42 : 0;
          m.position.set(Math.cos(aa) * d, (rr() - 0.5) * 0.4, Math.sin(aa) * d);
          host.addPickable(m, { kind: 'ingredient', id: l.ingredient.id });
          if (!showBottle) {
            const nl = host.label(esc(l.ingredient.name), 'name');
            nl.position.set(0, r(l.pct) + 0.18, 0);
            m.add(nl);
          }
          g.add(m);
        });
        const hit = sphere(0.75, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 12);
        host.addPickable(hit, { kind: 'family', id: a.family });
        g.add(hit);
        const f = fam(a.family);
        const lbl = host.label(
          `<span class="d" style="background:${f.color}"></span><b>${esc(f.label)}</b><br><span style="font-size:15px;font-weight:700;padding-left:15px">${Number(a.sharePct).toFixed(0)}%</span>`,
          'card',
          () => this.selectFamily.emit(this.selectedFamily() === a.family ? null : a.family),
        );
        lbl.element.dataset['family'] = a.family;
        lbl.position.set(center.x > 0 ? 0.9 : -0.9, 0.75, 0);
        g.add(lbl);
        host.root.add(g);
      });
    } else {
      const tiers: { key: NoteRole; y: number }[] = [
        { key: 'top', y: 1.75 },
        { key: 'heart', y: 0.05 },
        { key: 'base', y: -1.65 },
      ];
      for (const t of tiers) {
        const meta = roleMeta(t.key);
        const members = lines.filter((l) => l.ingredient.role === t.key);
        const rg = ring(2.55, new THREE.Color(meta.color), 0.45, 0.018);
        rg.position.y = t.y;
        host.root.add(rg);
        members.forEach((l, k) => {
          const ang = (k / Math.max(members.length, 1)) * Math.PI * 2 + 0.4;
          const m = sphere(r(l.pct), bubbleMaterial(color(l.ingredient.family)));
          m.position.set(Math.cos(ang) * 2.55, t.y, Math.sin(ang) * 2.55);
          host.addPickable(m, { kind: 'ingredient', id: l.ingredient.id });
          const nl = host.label(esc(l.ingredient.name), 'name');
          nl.position.set(0, r(l.pct) + 0.16, 0);
          m.add(nl);
          host.root.add(m);
        });
        const pct = this.pyramid()?.[t.key]?.massPct;
        const lbl = host.label(
          `<span class="d" style="background:${meta.color}"></span><b>${meta.label} notes</b><br><span class="s">${pct ? Number(pct).toFixed(1) + ' % w/w' : ''} · role tag</span>`,
          'card',
        );
        lbl.position.set(-3.6, t.y, 0);
        host.root.add(lbl);
      }
    }
    this.halo = selectionHalo(0.6);
    this.halo.visible = false;
    host.root.add(this.halo);
    this.refreshSelection();
  }

  private bottle(lines: FormulaLine[]) {
    const g = new THREE.Group();
    const profile = [
      [0, -1.35],
      [0.92, -1.35],
      [1.02, -1.27],
      [1.06, 0.55],
      [0.98, 0.82],
      [0.5, 1.02],
      [0.34, 1.12],
      [0.34, 1.34],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 72),
      new THREE.MeshPhysicalMaterial({
        color: 0xe6f8ff,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
        envMapIntensity: 1.8,
      }),
    );
    glass.renderOrder = 2;
    g.add(glass);
    // liquid colour = % (w/w)-weighted blend of family colours (decorative)
    const total = lines.reduce((s, l) => s + l.pct, 0) || 1;
    const mix = new THREE.Color(0, 0, 0);
    for (const l of lines) mix.add(color(l.ingredient.family).multiplyScalar(l.pct / total));
    const liquidColor = mix.clone().lerp(new THREE.Color(0x7fd3ff), 0.55);
    const liquid = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0, -1.28],
          [0.9, -1.28],
          [0.98, -1.2],
          [1.0, 0.35],
          [0, 0.35],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        72,
      ),
      new THREE.MeshPhysicalMaterial({
        color: liquidColor,
        roughness: 0.1,
        transparent: true,
        opacity: 0.72,
        clearcoat: 1,
        depthWrite: false,
      }),
    );
    liquid.renderOrder = 1;
    g.add(liquid);
    const gold = new THREE.MeshStandardMaterial({ color: 0xcaa266, metalness: 1, roughness: 0.28 });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 48), gold);
    collar.position.y = 1.36;
    g.add(collar);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.36, 0.62, 48),
      new THREE.MeshStandardMaterial({ color: 0x9b6a3f, metalness: 0.15, roughness: 0.45 }),
    );
    cap.position.y = 1.73;
    g.add(cap);
    return g;
  }

  private refreshSelection() {
    const host = this.host;
    if (!host || !this.halo) return;
    const id = this.selectedIngredientId();
    const famSel = this.selectedFamily();
    const target =
      (id && host.findPickable(id, 'ingredient')) || (famSel && host.findPickable(famSel, 'family')) || null;
    this.halo.visible = !!target;
    if (target) {
      const p = new THREE.Vector3();
      target.getWorldPosition(p);
      this.halo.position.copy(p);
      const s =
        (target as THREE.Mesh).geometry instanceof THREE.SphereGeometry
          ? ((target as THREE.Mesh).geometry as THREE.SphereGeometry).parameters.radius
          : 0.5;
      this.halo.scale.setScalar(Math.max(s * 1.6, 0.4) / 0.6);
    }
    host.root.traverse((o) => {
      const el = (o as unknown as { element?: HTMLElement }).element;
      if (el?.dataset?.['family']) el.classList.toggle('sel', el.dataset['family'] === famSel);
    });
    host.invalidate();
  }

  focusSelected() {
    const id = this.selectedIngredientId() ?? this.selectedFamily();
    const o = id ? this.host?.findPickable(id) : undefined;
    if (o && this.host) this.host.focusOn(o);
  }

  protected override onPick(p: PickInfo | null) {
    if (!p) return;
    if (p.kind === 'ingredient') this.selectIngredient.emit(p.id);
    if (p.kind === 'family') this.selectFamily.emit(this.selectedFamily() === p.id ? null : p.id);
  }
}
