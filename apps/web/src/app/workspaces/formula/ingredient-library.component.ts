import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { FAMILIES, fam } from '../../shared/families';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';

/** Formula Studio ingredient library (left column). "+" is the only way to add — selection never adds. */
@Component({
  selector: 'aur-ingredient-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, IngredientArtComponent],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
    }
    .head {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
    .head h2 {
      font-size: 17px;
      flex: 1;
    }
    .tabs .tab {
      height: 34px;
      padding: 0 10px;
      font-size: 12.5px;
    }
    .filters {
      display: flex;
      gap: 6px;
      margin: 10px 0 8px;
    }
    .filters .select {
      height: 32px;
      font-size: 12.5px;
      padding: 0 8px;
    }
    .list {
      flex: 1;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0 -6px;
      padding: 0 6px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .item:hover {
      background: #f6f8fd;
    }
    .item.sel {
      background: var(--primary-50);
      border-color: var(--primary-100);
    }
    .item .col {
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    .item b {
      font-size: 13.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .add {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid var(--border-strong);
      background: #fff;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: var(--primary);
      flex: none;
    }
    .add:hover {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
    .count {
      font-size: 11px;
      color: var(--ok);
      font-weight: 600;
    }
  `,
  template: `
    <div class="head">
      <h2>Ingredient Library</h2>
      <button class="icon-btn" aria-label="Collapse library" (click)="collapse.emit()">
        <lucide-icon [img]="I.ChevronsLeft" [size]="18" />
      </button>
    </div>
    <div class="search">
      <span class="search-icon"><lucide-icon [img]="I.Search" [size]="15" /></span>
      <input
        class="input"
        style="height: 34px; font-size: 12.5px"
        type="search"
        placeholder="Search ingredients (e.g. Bergamot, Linalool…)"
        aria-label="Search library"
        [ngModel]="q()"
        (ngModelChange)="q.set($event)"
        data-testid="library-search"
      />
    </div>
    <div class="tabs" role="tablist" style="margin-top: 8px">
      @for (t of tabs; track t[0]) {
        <button
          class="tab"
          role="tab"
          [class.on]="ui.formula().libraryFilter === t[0]"
          [attr.aria-selected]="ui.formula().libraryFilter === t[0]"
          (click)="ui.patchFormula({ libraryFilter: t[0] })"
        >
          {{ t[1] }}
        </button>
      }
    </div>
    <div class="filters">
      <select class="select" aria-label="Filter by family" [ngModel]="family()" (ngModelChange)="family.set($event)">
        <option value="">Olfactive Family</option>
        @for (f of families; track f.key) {
          <option [value]="f.key">{{ f.label }}</option>
        }
      </select>
      <select class="select" aria-label="Filter by type" [ngModel]="kind()" (ngModelChange)="kind.set($event)">
        <option value="">Type</option>
        <option value="natural_mixture">Natural</option>
        <option value="single_compound">Compound</option>
      </select>
    </div>
    <div class="list" role="list" data-testid="library-list">
      @for (i of items(); track i.id) {
        <div
          class="item"
          role="listitem"
          tabindex="0"
          [class.sel]="i.id === ui.selectedIngredientId()"
          (click)="ui.selectIngredient(i.id)"
          (keydown.enter)="ui.selectIngredient(i.id)"
          [attr.data-testid]="'lib-' + i.slug"
        >
          <aur-ingredient-art [motif]="i.art.motif" [hue]="i.art.hue" [size]="52" />
          <div class="col">
            <b>{{ i.name }}</b>
            <div class="row" style="gap: 4px">
              <span class="chip" [style.background]="fam(i.family).tint" [style.color]="fam(i.family).ink">{{
                fam(i.family).label
              }}</span>
              <span class="chip">{{ i.descriptors.at(1) ?? i.descriptors.at(0) }}</span>
            </div>
            @if (inFormula().has(i.id)) {
              <span class="count">✓ in formula</span>
            }
          </div>
          <button
            class="add"
            [attr.aria-label]="'Add ' + i.name + ' to formula'"
            (click)="$event.stopPropagation(); add(i.id)"
            [attr.data-testid]="'lib-add-' + i.slug"
          >
            <lucide-icon [img]="I.Plus" [size]="16" />
          </button>
        </div>
      } @empty {
        <p class="small muted" style="padding: 10px">No ingredients match.</p>
      }
    </div>
  `,
})
export class IngredientLibraryComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly collapse = output<void>();
  readonly added = output<string>();
  readonly I = I;
  readonly fam = fam;
  readonly families = FAMILIES;
  readonly tabs: ['all' | 'in-formula' | 'recent', string][] = [
    ['all', 'All'],
    ['in-formula', 'In formula'],
    ['recent', 'Recent'],
  ];
  readonly q = signal('');
  readonly family = signal('');
  readonly kind = signal('');
  readonly inFormula = computed(() => new Set(this.ctx.workingItems().map((i) => i.ingredientId)));
  readonly items = computed(() => {
    const q = this.q().trim().toLowerCase();
    const mode = this.ui.formula().libraryFilter;
    let list = this.ctx.catalog();
    if (mode === 'in-formula') list = list.filter((i) => this.inFormula().has(i.id));
    if (mode === 'recent') {
      const rec = this.ui.recentIngredientIds();
      list = rec.map((id) => this.ctx.ingredient(id)).filter((x): x is NonNullable<typeof x> => !!x);
    }
    return list.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q) || i.descriptors.some((d) => d.toLowerCase().includes(q))) &&
        (!this.family() || i.family === this.family()) &&
        (!this.kind() || i.kind === this.kind()),
    );
  });

  add(id: string) {
    this.ctx.addIngredient(id);
    this.ui.selectIngredient(id);
    this.added.emit(id);
  }
}
