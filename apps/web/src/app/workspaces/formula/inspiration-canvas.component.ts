import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { fam } from '../../shared/families';
import { I } from '../../shared/icons';
import { SceneArtComponent } from '../../shared/scene-art/scene-art.component';

/**
 * Inspiration Canvas (FS-M2). A moodboard composed live from the Concept Studio brief
 * (inspirations, keywords, selected concepts) plus a palette from the formula's accord balance —
 * demonstrates that brief context carries into Formula Studio.
 */
@Component({
  selector: 'aur-inspiration-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SceneArtComponent, RouterLink],
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 54px;
      grid-template-rows: minmax(0, 1fr) 76px;
      gap: 10px;
      height: 100%;
      padding: 12px;
      background: #fbfcff;
      border-radius: 0 0 14px 14px;
    }
    .board {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      background: #e9f3fb;
    }
    .mosaic {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 4px;
    }
    .mosaic > div {
      overflow: hidden;
    }
    .mosaic img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .m0 {
      grid-column: 1 / span 2;
      grid-row: 1 / span 2;
    }
    .m3 {
      grid-column: 3 / span 2;
      grid-row: 2 / span 2;
    }
    .bottle {
      position: absolute;
      left: 50%;
      top: 52%;
      transform: translate(-50%, -50%);
      width: 30%;
      max-width: 190px;
      filter: drop-shadow(0 12px 22px rgba(10, 40, 80, 0.35));
    }
    .word {
      position: absolute;
      font-family: 'Segoe Script', 'Brush Script MT', cursive;
      color: #fff;
      font-size: 22px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
      white-space: nowrap;
    }
    .title {
      position: absolute;
      left: 14px;
      top: 10px;
      background: rgba(255, 255, 255, 0.9);
      padding: 6px 12px;
      border-radius: 10px;
    }
    .title b {
      font-size: 15px;
    }
    .palette {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      padding-top: 6px;
    }
    .sw {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: var(--shadow-1);
    }
    .strip {
      grid-column: 1 / span 2;
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }
    .strip > button {
      flex: none;
      width: 92px;
      height: 100%;
      border-radius: 10px;
      overflow: hidden;
      border: 2px solid transparent;
      padding: 0;
      cursor: pointer;
      background: #eef2f8;
    }
    .strip > button.on {
      border-color: var(--primary);
    }
    .strip img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--ink-2);
      padding: 20px;
      background: rgba(255, 255, 255, 0.7);
    }
  `,
  template: `
    <div class="board" data-testid="inspiration-canvas">
      <div class="mosaic">
        @for (t of mosaic(); track t.id; let i = $index) {
          <div [class]="'m' + i">
            @if (t.source === 'upload' && t.uploadId) {
              <img [src]="ctx.uploadUrl(t.uploadId)" [alt]="t.title" />
            } @else {
              <aur-scene-art [key]="t.artKey ?? 'waves'" />
            }
          </div>
        }
      </div>
      <svg class="bottle" viewBox="0 0 120 170" aria-hidden="true">
        <defs>
          <linearGradient id="ib-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#bfe9ff" stop-opacity=".9" />
            <stop offset=".5" stop-color="#ffffff" stop-opacity=".55" />
            <stop offset="1" stop-color="#9fd8f5" stop-opacity=".9" />
          </linearGradient>
          <linearGradient id="ib-l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" [attr.stop-color]="liquid()[0]" />
            <stop offset="1" [attr.stop-color]="liquid()[1]" />
          </linearGradient>
        </defs>
        <rect x="44" y="6" width="32" height="30" rx="5" fill="#a77447" />
        <rect x="40" y="34" width="40" height="8" rx="2" fill="#d2ad70" />
        <path
          d="M22 50 Q22 42 32 42 H88 Q98 42 98 50 V158 Q98 166 90 166 H30 Q22 166 22 158 Z"
          fill="url(#ib-g)"
          stroke="#ffffff"
          stroke-width="2"
        />
        <path d="M26 88 H94 V156 Q94 162 88 162 H32 Q26 162 26 156 Z" fill="url(#ib-l)" opacity=".85" />
        <path d="M32 54 V150" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55" />
      </svg>
      @for (w of words(); track w.text) {
        <span class="word" [style.left.%]="w.x" [style.top.%]="w.y">{{ w.text }}</span>
      }
      <div class="title">
        <b>{{ ctx.project()?.name }}</b>
        <div class="tiny muted">{{ ctx.briefEdit()?.description?.slice(0, 70) }}…</div>
      </div>
      @if (!mosaic().length) {
        <div class="empty">
          <div class="col" style="align-items: center">
            <lucide-icon [img]="I.ImagePlus" [size]="26" />
            <span class="small"
              >No inspiration yet. Add images in <a [routerLink]="['../concept']">Concept Studio</a>.</span
            >
          </div>
        </div>
      }
    </div>
    <div class="palette" aria-label="Palette from accord balance">
      @for (c of palette(); track c.family) {
        <span class="sw" [style.background]="c.color" [attr.title]="c.label + ' ' + c.share + '%'"></span>
      }
    </div>
    <div class="strip" role="listbox" aria-label="Inspiration images">
      @for (t of inspirations(); track t.id; let i = $index) {
        <button
          role="option"
          [attr.aria-selected]="focus() === i"
          [class.on]="focus() === i"
          (click)="focus.set(i)"
          [attr.aria-label]="t.title"
        >
          @if (t.source === 'upload' && t.uploadId) {
            <img [src]="ctx.uploadUrl(t.uploadId)" [alt]="t.title" />
          } @else {
            <aur-scene-art [key]="t.artKey ?? 'waves'" />
          }
        </button>
      }
    </div>
  `,
})
export class InspirationCanvasComponent {
  readonly ctx = inject(ProjectContextService);
  readonly I = I;
  readonly focus = signal(0);
  readonly inspirations = computed(() => this.ctx.briefEdit()?.inspirations ?? []);
  readonly mosaic = computed(() => {
    const all = this.inspirations();
    if (!all.length) return [];
    const start = this.focus() % all.length;
    return [...all.slice(start), ...all.slice(0, start)].slice(0, 6);
  });
  readonly words = computed(() => {
    const kws = this.ctx.briefEdit()?.keywords ?? [];
    const spots = [
      [8, 30],
      [62, 14],
      [6, 72],
      [64, 80],
      [70, 46],
    ];
    return kws.slice(0, 5).map((k, i) => ({ text: k, x: spots[i][0], y: spots[i][1] }));
  });
  readonly palette = computed(() =>
    (this.ctx.draft()?.computed.accords ?? [])
      .slice(0, 6)
      .map((a) => ({ family: a.family, color: fam(a.family).color, label: fam(a.family).label, share: a.sharePct })),
  );
  readonly liquid = computed(() => {
    const p = this.palette();
    return [p[0]?.color ?? '#7fd3ff', p[1]?.color ?? '#2c97f0'];
  });
}
