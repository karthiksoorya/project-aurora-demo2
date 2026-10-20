import { Component, inject } from '@angular/core';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
@Component({
  selector: 'aur-tmp',
  imports: [AiPartnerPanelComponent],
  template: `<div class="page-head"><h1 data-testid="workspace-title">Ingredient Explorer</h1><span class="badge info">M0 scaffold</span></div>
    @if (ui.aiPanelVisible('ingredients')) { <aur-ai-partner-panel workspace="ingredients" style="width:340px;height:600px" /> }`,
})
export class IngredientExplorerComponent {
  readonly ui = inject(WorkspaceStateService);
}
