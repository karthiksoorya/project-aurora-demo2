import { TestBed } from '@angular/core/testing';
import { WorkspaceStateService } from './workspace-state.service';

describe('WorkspaceStateService', () => {
  beforeEach(() => localStorage.clear());

  it('switching mode never alters formula / selection / camera state (A2)', () => {
    const s = TestBed.inject(WorkspaceStateService);
    s.patchFormula({ canvasMode: 'ingredients3d', selectedFamily: 'citrus' });
    s.selectIngredient('ing-1');
    s.saveCamera('formula3d', { position: [1, 2, 3], target: [0, 0, 0] });
    const before = JSON.stringify([s.formula(), s.selectedIngredientId(), s.cameras()]);
    s.setMode('ai');
    s.setAiPanel('formula', false);
    s.setMode('manual');
    expect(JSON.stringify([s.formula(), s.selectedIngredientId(), s.cameras()])).toBe(before);
  });

  it('AI panel is only visible in AI mode and is hideable per workspace', () => {
    const s = TestBed.inject(WorkspaceStateService);
    expect(s.aiPanelVisible('concept')).toBe(false);
    s.setMode('ai');
    expect(s.aiPanelVisible('concept')).toBe(true);
    s.setAiPanel('concept', false);
    expect(s.aiPanelVisible('concept')).toBe(false);
    expect(s.aiPanelVisible('formula')).toBe(true);
  });

  it('keeps a bounded most-recent ingredient list', () => {
    const s = TestBed.inject(WorkspaceStateService);
    for (let i = 0; i < 20; i++) s.selectIngredient(`i${i}`);
    s.selectIngredient('i5');
    expect(s.recentIngredientIds()[0]).toBe('i5');
    expect(s.recentIngredientIds().length).toBe(12);
  });
});
