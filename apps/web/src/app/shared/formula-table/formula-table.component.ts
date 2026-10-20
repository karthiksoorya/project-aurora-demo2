import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { fam, role } from '../families';
import { I } from '../icons';
import { IngredientArtComponent } from '../ingredient-card/ingredient-art.component';

/**
 * Editable formula table (FS-M1). Quantities are % (w/w) decimal strings.
 * Input is validated as typed; only valid values are sent. Total / completeness / issues shown here
 * are the NestJS formula engine's results for the last saved draft revision.
 */
@Component({
  selector: 'aur-formula-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, IngredientArtComponent],
  styleUrl: './formula-table.component.scss',
  template: `
    <div class="head">
      <h2 class="grow" data-testid="formula-title">
        Formula: {{ ctx.project()?.name }} – {{ basedOnLabel() ? 'Draft (from ' + basedOnLabel() + ')' : 'Draft' }}
      </h2>
      <span class="badge draft">Draft</span>
      <span class="tiny muted rev" data-testid="draft-revision">rev {{ ctx.draft()?.revision }}</span>
    </div>
    <div class="sync small" [class.busy]="ctx.computedStale()" data-testid="calc-state" aria-live="polite">
      @if (ctx.computedStale()) {
        <lucide-icon [img]="I.RefreshCw" [size]="13" class="spin" /> Calculating on server…
      } @else {
        <lucide-icon [img]="I.Check" [size]="13" /> Totals computed by API · % (w/w), 6 dp
      }
    </div>
    <div class="scroll tbl-wrap">
      <table class="table" data-testid="formula-table">
        <thead>
          <tr>
            <th style="width: 26px">#</th>
            <th>Ingredient</th>
            <th style="width: 90px">% (w/w)</th>
            @if (ui.formula().showGrams) {
              <th style="width: 76px">g</th>
            }
            <th>Role</th>
            <th>Family</th>
            <th style="width: 40px"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (it of ctx.workingItems(); track it.lineId; let i = $index) {
            @let ing = ctx.ingredient(it.ingredientId);
            <tr
              [class.sel]="it.ingredientId === ui.selectedIngredientId()"
              [class.fam]="ui.formula().selectedFamily === ing?.family"
              (click)="ui.selectIngredient(it.ingredientId)"
              [attr.data-testid]="'line-' + (ing?.slug ?? it.ingredientId)"
            >
              <td class="muted small">{{ i + 1 }}</td>
              <td>
                <div class="row" style="gap: 8px">
                  @if (ing) {
                    <aur-ingredient-art [motif]="ing.art.motif" [hue]="ing.art.hue" [size]="26" />
                  }
                  <b class="small nm">{{ ing?.name ?? 'Unknown' }}</b>
                  @if (issueFor(it.lineId); as iss) {
                    <lucide-icon
                      [img]="I.CircleAlert"
                      [size]="14"
                      [style.color]="iss.severity === 'error' ? 'var(--err)' : 'var(--warn)'"
                      [attr.title]="iss.message"
                    />
                  }
                </div>
              </td>
              <td (click)="$event.stopPropagation()">
                <input
                  class="input qty"
                  [class.invalid]="ctx.invalidInputs()[it.lineId] !== undefined"
                  inputmode="decimal"
                  [readonly]="!ctx.canEdit()"
                  [attr.aria-label]="'Quantity for ' + (ing?.name ?? 'line') + ' in percent w/w'"
                  [attr.aria-invalid]="ctx.invalidInputs()[it.lineId] !== undefined"
                  [ngModel]="ctx.invalidInputs()[it.lineId] ?? editing()[it.lineId] ?? display(it.massPct)"
                  (ngModelChange)="onQty(it.lineId, $event)"
                  (focus)="ui.selectIngredient(it.ingredientId)"
                  (blur)="endEdit(it.lineId)"
                  [attr.data-testid]="'qty-' + (ing?.slug ?? it.ingredientId)"
                />
              </td>
              @if (ui.formula().showGrams) {
                <td class="small mono">{{ ctx.draft()?.computed?.gramsByLine?.[it.lineId] ?? '…' }}</td>
              }
              <td>
                @if (ing) {
                  <span class="chip" [style.background]="role(ing.role).tint" [style.color]="role(ing.role).ink">{{
                    role(ing.role).label
                  }}</span>
                }
              </td>
              <td>
                @if (ing) {
                  <span class="chip" [style.background]="fam(ing.family).tint" [style.color]="fam(ing.family).ink">{{
                    fam(ing.family).label
                  }}</span>
                }
              </td>
              <td (click)="$event.stopPropagation()">
                <div class="row" style="gap: 0; justify-content: center">
                  <button
                    class="icon-btn sm danger"
                    [attr.aria-label]="'Remove ' + ing?.name"
                    (click)="ctx.removeLine(it.lineId)"
                    [attr.data-testid]="'remove-' + (ing?.slug ?? it.ingredientId)"
                  >
                    <lucide-icon [img]="I.Trash2" [size]="15" />
                  </button>
                </div>
              </td>
            </tr>
            @if (ctx.invalidInputs()[it.lineId] !== undefined) {
              <tr class="err-row">
                <td></td>
                <td colspan="6" class="tiny" role="alert">
                  Enter a non-negative number ≤ 100 with at most 6 decimals (e.g. 12.5). Not saved.
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td colspan="7" class="small muted" style="padding: 18px 8px">
                No ingredients yet. Add from the library or the Ingredient Explorer.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (ctx.draft()?.computed; as c) {
      <div class="total">
        <span class="grow"></span>
        <b>Total</b>
        <b
          class="tot"
          data-testid="formula-total"
          [class.ok]="c.completeness === 'complete'"
          [class.bad]="c.completeness === 'over'"
          >{{ c.totalPctDisplay }} %</b
        >
        <span class="badge" [class]="'badge ' + badgeCls()" data-testid="formula-completeness">{{
          completenessLabel()
        }}</span>
        <button
          class="btn sm soft"
          (click)="normalize.emit()"
          [disabled]="c.completeness === 'complete' || c.completeness === 'empty' || ctx.computedStale()"
          data-testid="normalize"
          title="Explicitly rescale all lines to total exactly 100 %"
        >
          <lucide-icon [img]="I.Scale" [size]="14" /> Normalize
        </button>
      </div>
      @if (visibleIssues().length) {
        <ul class="issues" data-testid="formula-issues">
          @for (iss of visibleIssues(); track iss.code + (iss.lineId ?? '')) {
            <li [class]="iss.severity"><lucide-icon [img]="I.CircleAlert" [size]="13" /> {{ iss.message }}</li>
          }
        </ul>
      }
      <div class="foot tiny muted">
        <label class="row" style="gap: 6px"
          ><input
            type="checkbox"
            [checked]="ui.formula().showGrams"
            (change)="ui.patchFormula({ showGrams: !ui.formula().showGrams })"
          />
          Show grams for batch</label
        >
        @if (ui.formula().showGrams) {
          <input
            class="input batch"
            [ngModel]="batch()"
            (ngModelChange)="onBatch($event)"
            aria-label="Batch size in grams"
          />
          g
        }
        <span class="grow"></span>
        <span>Unit: mass fraction % (w/w)</span>
      </div>
    }
  `,
})
export class FormulaTableComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly basedOnLabel = input<string | null>(null);
  readonly normalize = output<void>();
  readonly I = I;
  readonly fam = fam;
  readonly role = role;
  readonly batchText = signal<string | null>(null);
  readonly batch = computed(() => this.batchText() ?? this.ctx.draft()?.batchSizeG ?? '100.000');

  readonly visibleIssues = computed(() =>
    (this.ctx.draft()?.computed.issues ?? []).filter((i) => i.severity !== 'info'),
  );
  readonly completenessLabel = computed(() => {
    const c = this.ctx.draft()?.computed;
    if (!c) return '';
    return {
      complete: 'Complete 100 %',
      incomplete: `Incomplete · ${Number(c.remainingPct).toFixed(2)} % unassigned`,
      over: 'Over 100 %',
      empty: 'Empty',
    }[c.completeness];
  });
  readonly badgeCls = computed(
    () =>
      ({ complete: 'ok', incomplete: 'warn', over: 'err', empty: 'na' })[
        this.ctx.draft()?.computed.completeness ?? 'empty'
      ],
  );

  /** Raw text while a field is focused, so server canonicalisation never moves the caret. */
  readonly editing = signal<Partial<Record<string, string>>>({});
  onQty(lineId: string, raw: string) {
    this.editing.update((m) => ({ ...m, [lineId]: raw }));
    this.ctx.setQuantity(lineId, raw);
  }
  endEdit(lineId: string) {
    this.editing.update((m) => {
      const { [lineId]: _drop, ...rest } = m;
      return rest;
    });
  }

  display(v: string) {
    // trim trailing zeros for editing comfort, keep at least 2 dp: "18.000000" -> "18.00"
    const [w, f = ''] = v.split('.');
    const t = f.replace(/0+$/, '');
    return `${w}.${t.length < 2 ? t.padEnd(2, '0') : t}`;
  }
  issueFor(lineId: string) {
    return this.ctx.draft()?.computed.issues.find((i) => i.lineId === lineId);
  }
  onBatch(v: string) {
    this.batchText.set(v);
    if (this.ctx.setBatchSize(v)) this.batchText.set(null);
  }
}
