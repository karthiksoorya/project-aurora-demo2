import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { isApiError } from '../../core/api/api.service';
import type { FormulaVersion } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { I } from '../../shared/icons';

@Component({
  selector: 'aur-save-version-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule],
  styles: `
    .dialog {
      width: 480px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .warn-box {
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--warn-50);
      color: #8a5300;
      font-size: 12.5px;
    }
    .err {
      color: var(--err);
      font-size: 12.5px;
    }
  `,
  template: `
    <div
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sv-h"
      (click)="dismiss.emit()"
      (keydown.escape)="dismiss.emit()"
    >
      <form
        class="dialog"
        (click)="$event.stopPropagation()"
        (keydown.escape)="dismiss.emit()"
        (submit)="$event.preventDefault(); save()"
        data-testid="save-version-dialog"
      >
        <div class="row">
          <lucide-icon [img]="I.Save" [size]="20" style="color: var(--primary)" />
          <h2 id="sv-h" class="grow" style="font-size: 18px">Save immutable version</h2>
          <button type="button" class="icon-btn" aria-label="Close" (click)="dismiss.emit()">
            <lucide-icon [img]="I.X" [size]="18" />
          </button>
        </div>
        <p class="small muted">
          Creates a hashed snapshot of the current draft (rev {{ ctx.draft()?.revision }}). Saved versions can never be
          edited or deleted.
        </p>
        <div class="field">
          <label for="vl">Version label</label>
          <input
            id="vl"
            class="input"
            name="label"
            [(ngModel)]="label"
            maxlength="40"
            required
            data-testid="version-label"
          />
        </div>
        <div class="field">
          <label for="vn">Note (optional)</label>
          <textarea
            id="vn"
            class="textarea"
            name="note"
            rows="2"
            maxlength="500"
            [(ngModel)]="note"
            placeholder="What changed and why"
          ></textarea>
        </div>
        @if (ctx.draft()?.computed; as c) {
          <div class="small">
            Total <b>{{ c.totalPctDisplay }} %</b> · {{ c.lineCount }} lines
          </div>
          @if (c.completeness !== 'complete') {
            <div class="warn-box" role="note">
              The formula total is {{ c.totalPctDisplay }} %. The version will be saved and marked
              <b>{{ c.completeness }}</b
              >; nothing is normalised implicitly. (Whether saving must require 100 % is an open policy decision.)
            </div>
          }
        }
        @if (error()) {
          <div class="err" role="alert">{{ error() }}</div>
        }
        <div class="row" style="justify-content: flex-end">
          <button type="button" class="btn ghost" (click)="dismiss.emit()">Cancel</button>
          <button
            type="submit"
            class="btn primary"
            [disabled]="busy() || !label.trim() || ctx.computedStale()"
            data-testid="confirm-save-version"
          >
            {{ busy() ? 'Saving…' : 'Save ' + label }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class SaveVersionDialogComponent {
  readonly ctx = inject(ProjectContextService);
  readonly dismiss = output<void>();
  readonly saved = output<FormulaVersion>();
  readonly I = I;
  label = this.ctx.suggestVersionLabel();
  note = '';
  readonly busy = signal(false);
  readonly error = signal('');

  async save() {
    this.busy.set(true);
    this.error.set('');
    try {
      const v = await this.ctx.saveVersion(this.label.trim(), this.note.trim());
      this.saved.emit(v);
    } catch (e) {
      this.error.set(isApiError(e) ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }
}
