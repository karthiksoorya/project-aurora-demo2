import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let seq = 0;

export const SCENE_KEYS = [
  'waves',
  'citrus',
  'white-flowers',
  'driftwood',
  'sea-rock',
  'cliffs',
  'sunset',
  'leaves',
  'jasmine',
  'shell',
  'amber',
  'coastal',
] as const;

/**
 * Procedural inspiration artwork (SVG). Stands in for the photographic moodboard imagery of the
 * reference screens, which is not available as licensed assets. Users can upload their own images.
 */
@Component({
  selector: 'aur-scene-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host { display: block; width: 100%; height: 100%; overflow: hidden; }
    svg { display: block; width: 100%; height: 100%; }
  `,
  template: `
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" [attr.data-scene]="key()">
      <defs>
        <linearGradient [attr.id]="id + 'sky'" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7cc4ff" /><stop offset=".55" stop-color="#cfeaff" /><stop offset="1" stop-color="#fff4dc" />
        </linearGradient>
        <linearGradient [attr.id]="id + 'sea'" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#21b5d6" /><stop offset=".5" stop-color="#0f8fc2" /><stop offset="1" stop-color="#0a5f97" />
        </linearGradient>
        <linearGradient [attr.id]="id + 'dusk'" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff9a5a" /><stop offset=".5" stop-color="#ffc977" /><stop offset="1" stop-color="#ffe7b0" />
        </linearGradient>
        <linearGradient [attr.id]="id + 'rock'" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#c9a27a" /><stop offset="1" stop-color="#6d4a32" />
        </linearGradient>
        <linearGradient [attr.id]="id + 'wood'" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#5a3a26" /><stop offset=".5" stop-color="#9b6a46" /><stop offset="1" stop-color="#4a2e1d" />
        </linearGradient>
        <radialGradient [attr.id]="id + 'cit'" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#ffe680" /><stop offset=".7" stop-color="#ffbf1f" /><stop offset="1" stop-color="#e48f00" />
        </radialGradient>
        <radialGradient [attr.id]="id + 'sun'" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fff9d0" /><stop offset=".5" stop-color="#ffd76a" stop-opacity=".9" /><stop offset="1" stop-color="#ffb347" stop-opacity="0" />
        </radialGradient>
        <radialGradient [attr.id]="id + 'gem'" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffd18a" /><stop offset=".6" stop-color="#f28a1f" /><stop offset="1" stop-color="#9c4708" />
        </radialGradient>
      </defs>
      @switch (key()) {
        @case ('waves') {
          <rect width="160" height="100" [attr.fill]="'url(#' + id + 'sea)'" />
          @for (w of waveRows; track $index) {
            <path [attr.d]="'M0 ' + w + ' C 30 ' + (w - 14) + ', 60 ' + (w + 10) + ', 90 ' + (w - 6) + ' S 140 ' + (w - 14) + ', 160 ' + (w - 2)" stroke="#e9fbff" [attr.stroke-width]="3 + $index" fill="none" opacity=".85" stroke-linecap="round" />
          }
          <path d="M0 40 C 40 10, 70 60, 110 22 S 150 18, 160 30 V0 H0z" fill="#bff0ff" opacity=".5" />
        }
        @case ('citrus') {
          <rect width="160" height="100" fill="#ffeaa0" />
          @for (o of oranges; track $index) {
            <g [attr.transform]="'translate(' + o[0] + ' ' + o[1] + ') scale(' + o[2] + ')'">
              <circle r="30" fill="#e98b00" /><circle r="27" fill="#fff7d8" />
              @for (a of wedges; track a) {
                <path [attr.d]="wedge(a, 24)" [attr.fill]="'url(#' + id + 'cit)'" />
              }
            </g>
          }
          <path d="M120 8 c 18 2 30 14 30 30 -18 -2 -30 -14 -30 -30z" fill="#4f9d2e" />
        }
        @case ('white-flowers') {
          <rect width="160" height="100" fill="#cfe7b9" />
          <circle cx="20" cy="20" r="30" fill="#e9f7dc" opacity=".8" /><circle cx="140" cy="90" r="34" fill="#a8d38f" opacity=".7" />
          @for (f of flowers; track $index) {
            <g [attr.transform]="'translate(' + f[0] + ' ' + f[1] + ') scale(' + f[2] + ')'">
              @for (a of petals; track a) {
                <ellipse cx="0" cy="-15" rx="9" ry="15" [attr.transform]="'rotate(' + a + ')'" fill="#fff" stroke="#f2e6ef" />
              }
              <circle r="6" fill="#ffd43b" /><circle r="3" fill="#f2a516" />
            </g>
          }
        }
        @case ('jasmine') {
          <rect width="160" height="100" fill="#fbe9d2" />
          @for (f of flowers; track $index) {
            <g [attr.transform]="'translate(' + (160 - f[0]) + ' ' + f[1] + ') scale(' + f[2] * 0.9 + ') rotate(20)'">
              @for (a of petals; track a) {
                <ellipse cx="0" cy="-15" rx="7" ry="15" [attr.transform]="'rotate(' + a + ')'" fill="#fffdf8" stroke="#f3d9bf" />
              }
              <circle r="4.5" fill="#f4c55b" />
            </g>
          }
        }
        @case ('driftwood') {
          <rect width="160" height="100" fill="#d9c3a5" />
          @for (r of logs; track $index) {
            <g [attr.transform]="'rotate(' + r[2] + ' 80 50)'">
              <rect x="-20" [attr.y]="r[0]" width="200" [attr.height]="r[1]" [attr.rx]="r[1] / 2" [attr.fill]="'url(#' + id + 'wood)'" />
              @for (g of [0.25, 0.5, 0.75]; track g) {
                <path [attr.d]="'M-20 ' + (r[0] + r[1] * g) + ' C 40 ' + (r[0] + r[1] * g - 3) + ', 110 ' + (r[0] + r[1] * g + 3) + ', 180 ' + (r[0] + r[1] * g)" stroke="#2b190e" stroke-opacity=".3" fill="none" />
              }
            </g>
          }
        }
        @case ('sea-rock') {
          <rect width="160" height="100" [attr.fill]="'url(#' + id + 'sky)'" />
          <rect y="48" width="160" height="52" [attr.fill]="'url(#' + id + 'sea)'" />
          <path d="M70 56 C 80 30, 112 26, 128 44 C 140 52, 150 58, 160 58 V70 H66z" fill="#5b4a43" />
          <path d="M0 80 C 30 68, 60 76, 90 70 S 140 78, 160 72 V100 H0z" fill="#f3e2c4" />
          <ellipse cx="44" cy="86" rx="12" ry="7" fill="#fbe7d3" stroke="#d9b48f" />
        }
        @case ('cliffs') {
          <rect width="160" height="100" [attr.fill]="'url(#' + id + 'sky)'" />
          <rect y="55" width="160" height="45" [attr.fill]="'url(#' + id + 'sea)'" />
          <path d="M0 20 C 18 18, 30 30, 40 46 C 46 58, 54 66, 62 72 L 62 100 H0z" [attr.fill]="'url(#' + id + 'rock)'" />
          <path d="M0 18 C 14 12, 30 16, 40 26 C 30 22, 14 22, 0 26z" fill="#4f9d3a" />
          <path d="M108 60 C 120 40, 140 34, 160 36 V100 H100z" [attr.fill]="'url(#' + id + 'rock)'" opacity=".85" />
          <path d="M64 74 C 80 70, 96 76, 112 72" stroke="#fff" stroke-width="2" fill="none" opacity=".7" />
        }
        @case ('sunset') {
          <rect width="160" height="100" [attr.fill]="'url(#' + id + 'dusk)'" />
          <circle cx="96" cy="54" r="30" [attr.fill]="'url(#' + id + 'sun)'" />
          <rect y="58" width="160" height="42" fill="#d9773a" opacity=".75" />
          @for (y of [64, 72, 82, 92]; track y) {
            <path [attr.d]="'M60 ' + y + ' H 132'" stroke="#ffe7a8" stroke-width="2" opacity=".6" />
          }
          <path d="M0 50 C 20 40, 34 44, 46 60 L 46 100 H0z" fill="#3a2a2a" />
        }
        @case ('leaves') {
          <rect width="160" height="100" fill="#2e7d32" />
          @for (l of leafs; track $index) {
            <g [attr.transform]="'translate(' + l[0] + ' ' + l[1] + ') rotate(' + l[2] + ') scale(' + l[3] + ')'">
              <path d="M0 0 C 18 -22, 46 -20, 60 0 C 46 20, 18 22, 0 0z" fill="#66bb3a" />
              <path d="M2 0 H 56" stroke="#d6f5b9" stroke-opacity=".7" stroke-width="1.4" />
            </g>
          }
        }
        @case ('shell') {
          <rect width="160" height="100" fill="#f6e3c3" />
          <path d="M0 70 C 40 60, 80 74, 120 64 S 150 66, 160 62 V100 H0z" fill="#ead2a8" />
          <g transform="translate(84 56)">
            <path d="M-36 10 C -30 -24, 30 -24, 36 10 C 20 18, -20 18, -36 10z" fill="#fbe3cf" stroke="#c99a74" stroke-width="1.5" />
            @for (k of [-24, -12, 0, 12, 24]; track k) {
              <path [attr.d]="'M0 14 L ' + k + ' -14'" stroke="#c99a74" stroke-width="1.3" />
            }
          </g>
        }
        @case ('amber') {
          <rect width="160" height="100" fill="#3a2414" />
          @for (g of gems; track $index) {
            <g [attr.transform]="'translate(' + g[0] + ' ' + g[1] + ') scale(' + g[2] + ')'">
              <polygon points="0,-20 17,-8 12,16 -12,16 -17,-8" [attr.fill]="'url(#' + id + 'gem)'" />
              <polygon points="0,-20 17,-8 0,-2 -17,-8" fill="#fff" opacity=".3" />
            </g>
          }
        }
        @default {
          <!-- coastal hero -->
          <rect width="160" height="100" [attr.fill]="'url(#' + id + 'sky)'" />
          <circle cx="112" cy="30" r="20" [attr.fill]="'url(#' + id + 'sun)'" />
          <path d="M60 46 C 84 40, 120 44, 160 40 V100 H60z" fill="#8fb7c9" opacity=".6" />
          <rect y="50" width="160" height="50" [attr.fill]="'url(#' + id + 'sea)'" />
          <path d="M104 52 C 112 30, 124 18, 140 14 C 150 12, 156 16, 160 18 V70 H100z" [attr.fill]="'url(#' + id + 'rock)'" />
          <path d="M120 22 C 130 14, 146 10, 160 12 V20 C 146 18, 132 20, 120 26z" fill="#4f9d3a" />
          @for (w of [62, 70, 80]; track w) {
            <path [attr.d]="'M0 ' + w + ' C 20 ' + (w - 4) + ', 40 ' + (w + 3) + ', 70 ' + (w - 2)" stroke="#e6fbff" stroke-width="1.6" fill="none" opacity=".75" />
          }
          <path d="M0 78 C 20 70, 44 74, 58 84 C 66 90, 70 96, 72 100 H0z" fill="#7a5a3e" />
          <circle cx="150" cy="86" r="18" fill="#3f8f2f" opacity=".85" /><circle cx="136" cy="96" r="12" fill="#5fae3a" opacity=".85" />
        }
      }
    </svg>
  `,
})
export class SceneArtComponent {
  readonly key = input<string>('coastal');
  readonly id = `sa${++seq}`;
  readonly waveRows = [30, 52, 74, 92];
  readonly wedges = Array.from({ length: 10 }, (_, i) => i * 36);
  readonly petals = [0, 72, 144, 216, 288];
  readonly oranges = [
    [46, 50, 1.25],
    [118, 62, 0.95],
    [96, 14, 0.6],
  ];
  readonly flowers = [
    [40, 44, 1.15],
    [96, 60, 1],
    [128, 28, 0.75],
    [70, 88, 0.7],
  ];
  readonly logs = [
    [16, 22, -12],
    [44, 26, -8],
    [76, 20, -14],
  ];
  readonly leafs = [
    [-6, 30, 10, 1.1],
    [40, 70, -30, 1],
    [70, 26, 20, 0.9],
    [100, 80, -40, 1.2],
    [120, 30, 30, 0.8],
  ];
  readonly gems = [
    [40, 40, 1.2],
    [86, 60, 1.5],
    [126, 34, 1],
    [60, 84, 0.8],
    [140, 82, 0.9],
  ];

  wedge(a: number, r: number) {
    const a1 = ((a + 3) * Math.PI) / 180;
    const a2 = ((a + 33) * Math.PI) / 180;
    const p = (ang: number, rr: number) => `${(rr * Math.cos(ang)).toFixed(2)} ${(rr * Math.sin(ang)).toFixed(2)}`;
    return `M${p(a1, 3)} L${p(a1, r)} A${r} ${r} 0 0 1 ${p(a2, r)} L${p(a2, 3)} Z`;
  }
}
