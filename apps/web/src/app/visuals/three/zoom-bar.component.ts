import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../../shared/icons';

@Component({
  selector: 'aur-zoom-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 10px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-2);
    }
    input[type='range'] {
      width: 110px;
      accent-color: var(--primary);
    }
  `,
  template: `
    <button class="icon-btn" (click)="rotate.emit()" aria-label="Toggle auto-rotate">
      <lucide-icon [img]="I.RefreshCw" [size]="16" />
    </button>
    <button class="icon-btn" (click)="zoomOut.emit()" aria-label="Zoom out">
      <lucide-icon [img]="I.Minus" [size]="16" />
    </button>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      [value]="value()"
      (input)="zoom.emit(+$any($event.target).value)"
      aria-label="Zoom level"
    />
    <button class="icon-btn" (click)="zoomIn.emit()" aria-label="Zoom in">
      <lucide-icon [img]="I.Plus" [size]="16" />
    </button>
    <lucide-icon [img]="I.ZoomIn" [size]="18" style="color: var(--muted)" />
  `,
})
export class ZoomBarComponent {
  readonly value = input(0.5);
  readonly zoom = output<number>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly rotate = output<void>();
  readonly I = I;
}
