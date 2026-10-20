import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { Concept, Inspiration } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { I } from '../../shared/icons';
import { SCENE_KEYS, SceneArtComponent } from '../../shared/scene-art/scene-art.component';

const FRAGRANCE_TYPES = [
  'Fine Fragrance',
  'Eau de Parfum',
  'Eau de Toilette',
  'Body Mist',
  'Home Fragrance',
  'Personal Care',
];
const CONSUMERS = ['Modern, Active', 'Classic, Elegant', 'Young, Playful', 'Unisex, Minimal', 'Bold, Expressive'];
const BOARD_FILTERS = ['All', 'Nature', 'Citrus', 'Marine', 'Floral', 'Woody', 'Textures'];

/** Static manual starting points (not AI output). Adding one creates an editable concept. */
const QUICK_DIRECTIONS = [
  {
    name: 'Mineral Citrus',
    art: 'waves',
    tags: ['Citrus', 'Marine'],
    description: 'A brighter, more mineral approach with salty marine notes and crisp citrus.',
    tint: '#e3f3ff',
  },
  {
    name: 'Floral Breeze',
    art: 'white-flowers',
    tags: ['Floral', 'Fresh'],
    description: 'Softer, more floral with white florals and airy musks. Inspires a clean elegance.',
    tint: '#ffe9f4',
  },
  {
    name: 'Woody Ocean',
    art: 'driftwood',
    tags: ['Woody', 'Marine'],
    description: 'A richer, more sophisticated direction with driftwood, amber and sea minerals.',
    tint: '#f6ece2',
  },
  {
    name: 'Fresh Aromatic',
    art: 'cliffs',
    tags: ['Aromatic', 'Fresh'],
    description: 'Crisp aromatics with herbal freshness and smooth woody dry down.',
    tint: '#e6f6ee',
  },
  {
    name: 'Modern Amber',
    art: 'amber',
    tags: ['Amber', 'Woody'],
    description: 'A warm, modern interpretation with transparent amber and soft woods.',
    tint: '#fff0dd',
  },
];

@Component({
  selector: 'aur-concept-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, SceneArtComponent, AiPartnerPanelComponent, DecimalPipe],
  templateUrl: './concept-studio.component.html',
  styleUrl: './concept-studio.component.scss',
})
export class ConceptStudioComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  readonly I = I;
  readonly types = FRAGRANCE_TYPES;
  readonly consumers = CONSUMERS;
  readonly boardFilters = BOARD_FILTERS;
  readonly directions = QUICK_DIRECTIONS;
  readonly artKeys = SCENE_KEYS.filter((k) => k !== 'coastal');
  readonly b = this.ctx.briefEdit;

  readonly boardFilter = signal('All');
  readonly directionsView = signal<'cards' | 'list'>('cards');
  readonly newKeyword = signal('');
  readonly addingKeyword = signal(false);
  readonly conceptForm = signal<{ name: string; tags: string; description: string; artKey: string } | null>(null);
  readonly uploading = signal(false);
  readonly dragOver = signal(false);
  readonly menuFor = signal<string | null>(null);
  private readonly descEl = viewChild<ElementRef<HTMLTextAreaElement>>('desc');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('boardFile');

  readonly heroWords = computed(() => (this.b()?.keywords ?? []).slice(0, 3));
  readonly board = computed(() => {
    const f = this.boardFilter();
    const items = this.b()?.inspirations ?? [];
    return f === 'All' ? items : items.filter((i) => i.tags.includes(f));
  });
  readonly consumerOptions = computed(() => {
    const cur = this.b()?.targetConsumer;
    return cur && !CONSUMERS.includes(cur) ? [cur, ...CONSUMERS] : CONSUMERS;
  });
  readonly typeOptions = computed(() => {
    const cur = this.b()?.fragranceType;
    return cur && !FRAGRANCE_TYPES.includes(cur) ? [cur, ...FRAGRANCE_TYPES] : FRAGRANCE_TYPES;
  });

  // ---------------------------------------------------------------- brief fields
  set(field: 'fragranceType' | 'targetConsumer' | 'description', v: string) {
    this.ctx.patchBrief({ [field]: field === 'description' ? v.slice(0, 500) : v });
  }
  editBrief() {
    this.descEl()?.nativeElement.focus();
  }
  private readonly kwInput = viewChild<ElementRef<HTMLInputElement>>('kwInput');
  startKeyword() {
    this.addingKeyword.set(true);
    setTimeout(() => this.kwInput()?.nativeElement.focus());
  }
  addKeyword() {
    const k = this.newKeyword().trim().slice(0, 24);
    const cur = this.b()?.keywords ?? [];
    if (k && !cur.some((x) => x.toLowerCase() === k.toLowerCase()) && cur.length < 12)
      this.ctx.patchBrief({ keywords: [...cur, k] });
    this.newKeyword.set('');
    this.addingKeyword.set(false);
  }
  removeKeyword(k: string) {
    this.ctx.patchBrief({ keywords: (this.b()?.keywords ?? []).filter((x) => x !== k) });
  }

  // ---------------------------------------------------------------- uploads
  async onReferenceFiles(files: FileList | null) {
    if (!files?.length) return;
    this.uploading.set(true);
    try {
      for (const f of Array.from(files)) {
        const u = await this.ctx.uploadFile(f);
        const refs = this.b()?.references ?? [];
        this.ctx.patchBrief({
          references: [...refs, { uploadId: u.id, name: u.originalName, mime: u.mime, size: u.size }],
        });
      }
    } catch (e) {
      this.ctx.reportError(e, 'Upload failed');
    } finally {
      this.uploading.set(false);
    }
  }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    void this.onReferenceFiles(e.dataTransfer?.files ?? null);
  }
  removeReference(id: string) {
    this.ctx.patchBrief({ references: (this.b()?.references ?? []).filter((r) => r.uploadId !== id) });
  }
  pickBoardImage() {
    this.fileInput()?.nativeElement.click();
  }
  async onBoardFiles(files: FileList | null) {
    if (!files?.length) return;
    this.uploading.set(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        const u = await this.ctx.uploadFile(f);
        const tag = this.boardFilter() === 'All' ? 'Nature' : this.boardFilter();
        const item: Inspiration = {
          id: crypto.randomUUID(),
          source: 'upload',
          uploadId: u.id,
          title: u.originalName.slice(0, 80),
          tags: [tag],
        };
        this.ctx.patchBrief({ inspirations: [...(this.b()?.inspirations ?? []), item] });
      }
    } catch (e) {
      this.ctx.reportError(e, 'Upload failed');
    } finally {
      this.uploading.set(false);
      const el = this.fileInput()?.nativeElement;
      if (el) el.value = '';
    }
  }
  removeInspiration(id: string) {
    this.menuFor.set(null);
    this.ctx.patchBrief({ inspirations: (this.b()?.inspirations ?? []).filter((i) => i.id !== id) });
  }
  uploadUrl(id: string) {
    return this.ctx.uploadUrl(id);
  }

  // ---------------------------------------------------------------- concepts
  openConceptForm(seed?: { name: string; tags: string[]; description: string; art: string }) {
    this.conceptForm.set({
      name: seed?.name ?? '',
      tags: seed?.tags.join(', ') ?? '',
      description: seed?.description ?? '',
      artKey: seed?.art ?? 'citrus',
    });
  }
  saveConceptForm() {
    const f = this.conceptForm();
    if (!f || !f.name.trim()) return;
    const c: Concept = {
      id: crypto.randomUUID(),
      name: f.name.trim().slice(0, 60),
      tags: f.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((t) => t.slice(0, 24)),
      description: f.description.trim().slice(0, 300),
      artKey: f.artKey,
      selected: false,
    };
    this.ctx.patchBrief({ concepts: [...(this.b()?.concepts ?? []), c] });
    this.conceptForm.set(null);
  }
  patchConceptForm(p: Partial<{ name: string; tags: string; description: string; artKey: string }>) {
    this.conceptForm.update((f) => (f ? { ...f, ...p } : f));
  }
  toggleConcept(id: string) {
    this.ctx.patchBrief({
      concepts: (this.b()?.concepts ?? []).map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
    });
  }
  removeConcept(id: string) {
    this.menuFor.set(null);
    this.ctx.patchBrief({ concepts: (this.b()?.concepts ?? []).filter((c) => c.id !== id) });
  }
  addDirection(d: (typeof QUICK_DIRECTIONS)[number]) {
    this.openConceptForm({ name: d.name, tags: d.tags, description: d.description, art: d.art });
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async save() {
    await this.ctx.saveBrief();
  }
}
