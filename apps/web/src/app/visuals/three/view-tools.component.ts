import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../../shared/icons';

/** Vertical tool rail (Orbit / Pan / Zoom / Focus / Reset / Snapshot) shared by all 3D canvases. */
@Component({
  selector: 'aur-view-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow-2);
    }
    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      width: 52px;
      padding: 7px 0 6px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: none;
      cursor: pointer;
      font-size: 11px;
      color: var(--ink-2);
    }
    button:hover {
      background: var(--primary-50);
    }
    button.on {
      border-color: var(--primary);
      color: var(--primary);
      background: #f4f8ff;
    }
    :host(.compact) button {
      width: 36px;
      padding: 6px 0;
      font-size: 0;
      gap: 0;
    }
  `,
  host: { '[class.compact]': 'compact()' },
  template: `
    <button
      [class.on]="tool() === 'orbit'"
      (click)="toolChange.emit('orbit')"
      aria-label="Orbit tool"
      [attr.aria-pressed]="tool() === 'orbit'"
    >
      <lucide-icon [img]="I.Rotate3d" [size]="18" />Orbit
    </button>
    <button
      [class.on]="tool() === 'pan'"
      (click)="toolChange.emit('pan')"
      aria-label="Pan tool"
      [attr.aria-pressed]="tool() === 'pan'"
    >
      <lucide-icon [img]="I.Move" [size]="18" />Pan
    </button>
    <button
      [class.on]="tool() === 'zoom'"
      (click)="toolChange.emit('zoom')"
      aria-label="Zoom tool"
      [attr.aria-pressed]="tool() === 'zoom'"
    >
      <lucide-icon [img]="I.ZoomIn" [size]="18" />Zoom
    </button>
    @if (showFocus()) {
      <button (click)="focusSelection.emit()" aria-label="Focus selection">
        <lucide-icon [img]="I.Focus" [size]="18" />Focus
      </button>
    }
    <button (click)="resetView.emit()" aria-label="Reset view" data-testid="view-reset">
      <lucide-icon [img]="I.RotateCcw" [size]="18" />Reset
    </button>
    <button (click)="snapshotPng.emit()" aria-label="Save snapshot PNG">
      <lucide-icon [img]="I.Camera" [size]="18" />Snapshot
    </button>
  `,
})
export class ViewToolsComponent {
  readonly tool = input<'orbit' | 'pan' | 'zoom'>('orbit');
  readonly showFocus = input(true);
  readonly compact = input(false);
  readonly toolChange = output<'orbit' | 'pan' | 'zoom'>();
  readonly focusSelection = output<void>();
  readonly resetView = output<void>();
  readonly snapshotPng = output<void>();
  readonly I = I;
}
