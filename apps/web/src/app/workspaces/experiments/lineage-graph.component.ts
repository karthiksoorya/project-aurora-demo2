import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { LineageNode } from '../../core/models';
import { I } from '../../shared/icons';
import { SceneArtComponent } from '../../shared/scene-art/scene-art.component';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';

const ART = ['waves', 'citrus', 'white-flowers', 'driftwood', 'sea-rock', 'leaves', 'amber', 'jasmine'];

/**
 * Version ancestry graph (EE-M1 branching card, EE-X expanded canvas).
 * Positions come only from saved parent links: depth = distance from a root version, rows in DFS order.
 */
@Component({
  selector: 'aur-lineage-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DatePipe, SceneArtComponent, StatusChipComponent],
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      border-radius: 12px;
      background: radial-gradient(70% 90% at 40% 40%, #ffffff, #eef4ff 70%, #e9f1fb);
    }
    .viewport {
      position: absolute;
      inset: 0;
      overflow: auto;
    }
    .canvas {
      position: relative;
      transform-origin: 0 0;
    }
    svg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: visible;
    }
    .node {
      position: absolute;
      min-height: 84px;
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px;
      background: #fff;
      border: 1.5px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-1);
      cursor: pointer;
      text-align: left;
    }
    .node:hover {
      border-color: var(--primary-100);
    }
    .node.on {
      border-color: var(--primary);
      box-shadow: var(--focus);
    }
    .node.draft-base {
      outline: 2px dashed #f2b01e;
      outline-offset: 3px;
    }
    .thumb {
      width: 52px;
      height: 44px;
      border-radius: 8px;
      overflow: hidden;
      flex: none;
    }
    .meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .meta b {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .tools {
      position: absolute;
      left: 10px;
      top: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 2;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
    }
    .legend {
      position: absolute;
      right: 10px;
      bottom: 8px;
      z-index: 2;
      font-size: 11px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.85);
      padding: 3px 8px;
      border-radius: 8px;
    }
    .empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 13px;
    }
  `,
  template: `
    @if (!nodes().length) {
      <div class="empty">No saved versions yet.</div>
    } @else {
      <div class="tools" role="group" aria-label="Graph zoom">
        <button class="icon-btn" aria-label="Zoom in" (click)="scale.set(min(1.6, scale() + 0.15))">
          <lucide-icon [img]="I.Plus" [size]="15" />
        </button>
        <button class="icon-btn" aria-label="Zoom out" (click)="scale.set(max(0.5, scale() - 0.15))">
          <lucide-icon [img]="I.Minus" [size]="15" />
        </button>
        <button class="icon-btn" aria-label="Reset zoom" (click)="scale.set(1)">
          <lucide-icon [img]="I.Focus" [size]="15" />
        </button>
      </div>
      <div class="viewport">
        <div class="canvas" [style.width.px]="layout().w * scale()" [style.height.px]="layout().h * scale()">
          <div
            [style.transform]="'scale(' + scale() + ')'"
            style="transform-origin: 0 0; position: absolute; inset: 0"
            [style.width.px]="layout().w"
            [style.height.px]="layout().h"
          >
            <svg [attr.width]="layout().w" [attr.height]="layout().h" aria-hidden="true">
              @for (e of layout().edges; track e.id) {
                <path [attr.d]="e.d" fill="none" stroke="#7aa2ff" stroke-width="2" />
              }
            </svg>
            @for (n of layout().placed; track n.node.id) {
              <button
                class="node"
                [class.on]="n.node.id === selectedId()"
                [class.draft-base]="n.node.id === draftBaseId()"
                [style.left.px]="n.x"
                [style.top.px]="n.y"
                [style.width.px]="cardW()"
                (click)="selectVersion.emit(n.node.id)"
                [attr.data-testid]="'lineage-' + n.node.versionLabel"
                [attr.aria-label]="'Version ' + n.node.versionLabel"
              >
                <div class="thumb"><aur-scene-art [key]="art(n.i)" /></div>
                <div class="meta">
                  <b>{{ n.node.versionLabel }}</b>
                  <span class="tiny muted"
                    >{{ n.node.savedAt | date: 'd MMM y' }} · {{ n.node.experiments }} exp ·
                    {{ n.node.observations }} obs</span
                  >
                  <div class="chips">
                    @if (n.node.latestValidation) {
                      <aur-status [status]="n.node.latestValidation" />
                    }
                    @if (n.node.latestReview) {
                      <aur-status [status]="n.node.latestReview" />
                    }
                    @if (n.node.completeness !== 'complete') {
                      <span class="badge warn">{{ n.node.completeness }}</span>
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        </div>
      </div>
      <span class="legend">Edges = saved parent version links · dashed = current draft is based on it</span>
    }
  `,
})
export class LineageGraphComponent {
  readonly nodes = input.required<LineageNode[]>();
  readonly selectedId = input<string | null>(null);
  readonly draftBaseId = input<string | null>(null);
  readonly compact = input(false);
  readonly selectVersion = output<string>();
  readonly I = I;
  readonly scale = signal(1);
  readonly min = Math.min;
  readonly max = Math.max;
  readonly cardW = computed(() => (this.compact() ? 200 : 236));

  art(i: number) {
    return ART[i % ART.length];
  }

  readonly layout = computed(() => {
    const nodes = this.nodes();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const kids = new Map<string | null, LineageNode[]>();
    for (const n of nodes) {
      const p = n.parentVersionId && byId.has(n.parentVersionId) ? n.parentVersionId : null;
      kids.set(p, [...(kids.get(p) ?? []), n]);
    }
    const colW = this.cardW() + (this.compact() ? 46 : 70);
    const rowH = this.compact() ? 96 : 108;
    const placed: { node: LineageNode; x: number; y: number; i: number }[] = [];
    let row = 0;
    const pos = new Map<string, { x: number; y: number }>();
    const visit = (n: LineageNode, depth: number) => {
      const children = kids.get(n.id) ?? [];
      const startRow = row;
      for (const c of children) visit(c, depth + 1);
      const r = children.length ? (startRow + row - 1) / 2 : row++;
      const p = { x: 16 + 46 + depth * colW, y: 14 + r * rowH };
      pos.set(n.id, p);
      placed.push({ node: n, ...p, i: nodes.indexOf(n) });
    };
    for (const root of kids.get(null) ?? []) visit(root, 0);
    const h = this.compact() ? 60 : 64;
    const edges = nodes
      .filter((n) => n.parentVersionId && pos.has(n.parentVersionId))
      .map((n) => {
        const a = pos.get(n.parentVersionId!)!;
        const b = pos.get(n.id)!;
        const x1 = a.x + this.cardW();
        const y1 = a.y + h / 2;
        const x2 = b.x;
        const y2 = b.y + h / 2;
        const mx = (x1 + x2) / 2;
        return { id: n.id, d: `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` };
      });
    const w = Math.max(...placed.map((p) => p.x + this.cardW()), 0) + 30;
    const hh = Math.max(...placed.map((p) => p.y + h), 0) + 30;
    return { placed, edges, w, h: hh };
  });
}
