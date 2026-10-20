import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

let seq = 0;

/**
 * Procedural, colourful thumbnail art for an ingredient (SVG, no external images).
 * It is decorative only — it does not depict a real sample or a molecular structure.
 */
@Component({
  selector: 'aur-ingredient-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()', 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-block;
      flex: none;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg viewBox="0 0 100 100" [attr.data-motif]="motif()">
      <defs>
        <radialGradient [attr.id]="id + 'bg'" cx="30%" cy="25%" r="90%">
          <stop offset="0" [attr.stop-color]="c().bg1" />
          <stop offset="1" [attr.stop-color]="c().bg2" />
        </radialGradient>
        <radialGradient [attr.id]="id + 'fx'" cx="38%" cy="32%" r="70%">
          <stop offset="0" [attr.stop-color]="c().hi" />
          <stop offset=".7" [attr.stop-color]="c().main" />
          <stop offset="1" [attr.stop-color]="c().deep" />
        </radialGradient>
        <linearGradient [attr.id]="id + 'lin'" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="c().hi" />
          <stop offset="1" [attr.stop-color]="c().deep" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" [attr.fill]="'url(#' + id + 'bg)'" />
      @switch (motif()) {
        @case ('citrus-slice') {
          <path d="M70 18c10 2 18 10 20 20-12 2-22-6-20-20z" fill="#5fae3a" opacity=".9" />
          <circle cx="50" cy="56" r="34" [attr.fill]="c().deep" />
          <circle cx="50" cy="56" r="30.5" fill="#fffbe8" />
          @for (a of wedges; track a) {
            <path [attr.d]="wedge(a)" [attr.fill]="'url(#' + id + 'fx)'" />
          }
          <circle cx="50" cy="56" r="3.5" fill="#fffbe8" />
          <ellipse cx="38" cy="40" rx="9" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 38 40)" />
        }
        @case ('white-flower') {
          <circle cx="20" cy="80" r="16" fill="#9fd48a" opacity=".55" />
          <circle cx="85" cy="20" r="14" fill="#cfe9c3" opacity=".6" />
          @for (a of petals; track a) {
            <ellipse
              cx="52"
              cy="30"
              rx="12"
              ry="21"
              [attr.transform]="'rotate(' + a + ' 52 52)'"
              fill="#ffffff"
              [attr.stroke]="c().soft"
              stroke-width="1.2"
            />
          }
          <circle cx="52" cy="52" r="9" fill="#ffd43b" />
          <circle cx="52" cy="52" r="5" fill="#f2a516" />
          @for (a of petals; track a) {
            <circle cx="52" cy="44" r="1.2" fill="#c47a0f" [attr.transform]="'rotate(' + (a + 36) + ' 52 52)'" />
          }
          <g transform="translate(70 72) scale(.42)">
            @for (a of petals; track a) {
              <ellipse
                cx="0"
                cy="-20"
                rx="12"
                ry="20"
                [attr.transform]="'rotate(' + a + ')'"
                fill="#fff"
                [attr.stroke]="c().soft"
              />
            }
            <circle r="8" fill="#ffd43b" />
          </g>
        }
        @case ('wood') {
          <g transform="rotate(-24 50 50)">
            <rect x="-6" y="22" width="112" height="22" rx="11" [attr.fill]="'url(#' + id + 'lin)'" />
            <rect x="-10" y="48" width="118" height="20" rx="10" [attr.fill]="c().main" />
            <rect x="0" y="72" width="104" height="18" rx="9" [attr.fill]="c().deep" />
            @for (y of grain; track y) {
              <path
                [attr.d]="'M-6 ' + y + ' C 25 ' + (y - 3) + ', 60 ' + (y + 3) + ', 106 ' + (y - 1)"
                stroke="#3c2214"
                stroke-opacity=".28"
                stroke-width="1.1"
                fill="none"
              />
            }
            <ellipse cx="96" cy="58" rx="6" ry="10" fill="#e8c9a4" stroke="#7a4a2a" stroke-width="1" />
            <ellipse cx="96" cy="58" rx="3" ry="5" fill="none" stroke="#7a4a2a" stroke-width=".8" />
          </g>
        }
        @case ('wave') {
          <path d="M0 58 C 18 42, 34 44, 46 56 S 78 70, 100 50 V100 H0z" [attr.fill]="c().main" />
          <path d="M0 70 C 20 58, 38 62, 52 72 S 80 82, 100 66 V100 H0z" [attr.fill]="c().deep" />
          <path
            d="M0 58 C 18 42, 34 44, 46 56 S 78 70, 100 50"
            stroke="#fff"
            stroke-width="3.5"
            fill="none"
            stroke-linecap="round"
            opacity=".9"
          />
          <path
            d="M8 76 C 24 66, 40 70, 54 78"
            stroke="#fff"
            stroke-width="2"
            fill="none"
            opacity=".6"
            stroke-linecap="round"
          />
          @for (b of bubbles; track $index) {
            <circle [attr.cx]="b[0]" [attr.cy]="b[1]" [attr.r]="b[2]" fill="#fff" opacity=".75" />
          }
        }
        @case ('amber-gem') {
          @for (g of gems; track $index) {
            <g [attr.transform]="'translate(' + g[0] + ' ' + g[1] + ') scale(' + g[2] + ')'">
              <polygon points="0,-20 17,-8 12,16 -12,16 -17,-8" [attr.fill]="'url(#' + id + 'fx)'" />
              <polygon points="0,-20 17,-8 0,-2 -17,-8" fill="#fff" opacity=".35" />
              <polygon points="0,-2 12,16 -12,16" [attr.fill]="c().deep" opacity=".45" />
            </g>
          }
        }
        @case ('lavender') {
          @for (s of stems; track $index) {
            <path
              [attr.d]="'M' + s[0] + ' 96 Q ' + (s[0] + s[1]) + ' 60 ' + (s[0] + s[1] * 1.6) + ' 22'"
              stroke="#6fa060"
              stroke-width="2"
              fill="none"
            />
            @for (k of buds; track k) {
              <ellipse
                [attr.cx]="s[0] + s[1] * (1.6 - k * 0.08)"
                [attr.cy]="22 + k * 6"
                rx="4.2"
                ry="3"
                [attr.fill]="k % 2 ? c().main : c().hi"
              />
            }
          }
        }
        @case ('leaves') {
          @for (l of leaves; track $index) {
            <g [attr.transform]="'translate(' + l[0] + ' ' + l[1] + ') rotate(' + l[2] + ')'">
              <path d="M0 0 C 14 -16, 34 -14, 44 0 C 34 14, 14 16, 0 0z" [attr.fill]="'url(#' + id + 'lin)'" />
              <path d="M2 0 H 40" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" />
            </g>
          }
        }
        @case ('pepper') {
          @for (p of peppers; track $index) {
            <circle [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="p[2]" fill="#2b2220" />
            <circle
              [attr.cx]="p[0] - p[2] * 0.35"
              [attr.cy]="p[1] - p[2] * 0.35"
              [attr.r]="p[2] * 0.3"
              fill="#fff"
              opacity=".25"
            />
          }
        }
        @case ('musk') {
          <path d="M-5 60 C 15 40, 35 70, 55 50 S 90 40, 105 58 V100 H-5z" fill="#ffffff" opacity=".85" />
          <path d="M-5 74 C 20 58, 45 84, 65 68 S 95 64, 105 76 V100 H-5z" [attr.fill]="c().soft" opacity=".9" />
          <path
            d="M-5 40 C 20 26, 40 46, 60 34 S 95 28, 105 38"
            stroke="#fff"
            stroke-width="7"
            fill="none"
            opacity=".7"
          />
        }
        @case ('peach') {
          <circle cx="50" cy="58" r="30" [attr.fill]="'url(#' + id + 'fx)'" />
          <path d="M50 30 C 46 44, 46 66, 52 88" stroke="#000" stroke-opacity=".08" stroke-width="3" fill="none" />
          <path d="M52 30 C 62 14, 80 14, 86 22 C 76 30, 62 32, 52 30z" fill="#5aa13d" />
        }
        @default {
          <circle cx="50" cy="50" r="28" [attr.fill]="'url(#' + id + 'fx)'" />
        }
      }
    </svg>
  `,
})
export class IngredientArtComponent {
  readonly motif = input<string>('default');
  readonly hue = input<number>(40);
  readonly size = input<number>(56);
  readonly id = `ia${++seq}`;

  readonly wedges = Array.from({ length: 10 }, (_, i) => i * 36);
  readonly petals = [0, 72, 144, 216, 288];
  readonly grain = [28, 34, 40, 54, 60, 64, 78, 84];
  readonly bubbles = [
    [20, 36, 3],
    [30, 26, 2],
    [72, 30, 2.5],
    [84, 40, 1.8],
    [60, 18, 1.5],
  ];
  readonly gems = [
    [34, 40, 1.05],
    [66, 58, 1.2],
    [36, 76, 0.8],
    [76, 26, 0.6],
  ];
  readonly stems = [
    [30, 4],
    [48, -2],
    [64, 6],
  ];
  readonly buds = [0, 1, 2, 3, 4, 5];
  readonly leaves = [
    [8, 70, -40],
    [30, 40, -20],
    [48, 76, -60],
    [52, 30, 15],
  ];
  readonly peppers = [
    [30, 34, 9],
    [52, 28, 8],
    [70, 44, 10],
    [38, 58, 10],
    [62, 70, 9],
    [26, 78, 8],
    [82, 72, 7],
  ];

  readonly c = computed(() => {
    const h = this.hue();
    const m = this.motif();
    const wood = m === 'wood' || m === 'pepper';
    return {
      bg1: wood ? `hsl(${h} 45% 88%)` : m === 'wave' ? `hsl(${h} 80% 88%)` : `hsl(${h} 90% 94%)`,
      bg2: wood ? `hsl(${h} 35% 70%)` : m === 'wave' ? `hsl(${h} 75% 62%)` : `hsl(${h} 75% 80%)`,
      hi: wood ? `hsl(${h} 50% 62%)` : `hsl(${h} 100% 72%)`,
      main: wood ? `hsl(${h} 48% 42%)` : `hsl(${h} 88% 54%)`,
      deep: wood ? `hsl(${h} 52% 26%)` : `hsl(${h} 85% 38%)`,
      soft: `hsl(${h} 60% 82%)`,
    };
  });

  wedge(a: number) {
    const r = 27;
    const cx = 50;
    const cy = 56;
    const a1 = ((a + 3) * Math.PI) / 180;
    const a2 = ((a + 33) * Math.PI) / 180;
    const p = (ang: number, rr: number) =>
      `${(cx + rr * Math.cos(ang)).toFixed(2)} ${(cy + rr * Math.sin(ang)).toFixed(2)}`;
    return `M${p(a1, 4)} L${p(a1, r)} A${r} ${r} 0 0 1 ${p(a2, r)} L${p(a2, 4)} Z`;
  }
}
