import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api/api.service';
import type { AuditEvent, FormulaVersion, Lineage, Member, ProjectRole, Review } from '../../core/models';
import { ProjectContextService } from '../../core/project-context/project-context.service';
import { WorkspaceStateService } from '../../core/workspace-state/workspace-state.service';
import { AiPartnerPanelComponent } from '../../shared/contextual-panel/ai-partner-panel.component';
import { fam, role } from '../../shared/families';
import { I } from '../../shared/icons';
import { IngredientArtComponent } from '../../shared/ingredient-card/ingredient-art.component';
import { SceneArtComponent } from '../../shared/scene-art/scene-art.component';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';

type Tab = 'versions' | 'feedback' | 'audit';

/**
 * Share & Review (SR-M versions & sharing, SR-A AI mode, SR-X expanded review & feedback).
 * Reviews are tied to one saved version; permissions are enforced by the API — the UI only mirrors them.
 */
@Component({
  selector: 'aur-share-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    FormsModule,
    DatePipe,
    AiPartnerPanelComponent,
    IngredientArtComponent,
    SceneArtComponent,
    StatusChipComponent,
  ],
  templateUrl: './share-review.component.html',
  styleUrl: './share-review.component.scss',
})
export class ShareReviewComponent {
  readonly ctx = inject(ProjectContextService);
  readonly ui = inject(WorkspaceStateService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly I = I;
  readonly fam = fam;
  readonly role = role;

  readonly tab = signal<Tab>('versions');
  readonly reviews = signal<Review[]>([]);
  readonly members = signal<Member[]>([]);
  readonly lineage = signal<Lineage | null>(null);
  readonly events = signal<AuditEvent[]>([]);
  readonly versionId = signal<string | null>(null);
  readonly reviewId = signal<string | null>(null);
  readonly snapshot = signal<FormulaVersion | null>(null);
  readonly auditFilter = signal('');
  readonly commentText = signal('');
  readonly commentKind = signal<'feedback' | 'information' | 'suggestion'>('feedback');
  readonly decisionReason = signal('');
  readonly busy = signal(false);
  readonly reqOpen = signal(false);
  readonly req = signal<{
    formulaVersionId: string;
    title: string;
    message: string;
    reviewers: Record<string, '' | 'comment' | 'approve'>;
  }>({
    formulaVersionId: '',
    title: '',
    message: '',
    reviewers: {},
  });

  readonly meId = computed(() => this.ctx.session.userId());
  readonly versionReviews = computed(() => this.reviews().filter((r) => r.formulaVersionId === this.versionId()));
  /** Review shown in Review & Feedback: explicit pick, else latest for the selected version, else latest overall. */
  readonly review = computed<Review | null>(
    () =>
      this.reviews().find((r) => r.id === this.reviewId()) ??
      this.versionReviews().at(0) ??
      this.reviews().at(0) ??
      null,
  );
  /** Review shown in the Versions tab status card: only for the selected version. */
  readonly versionReview = computed<Review | null>(() => this.versionReviews().at(0) ?? null);
  readonly node = computed(() => this.lineage()?.nodes.find((n) => n.id === this.versionId()) ?? null);
  readonly mySlot = computed(() => this.review()?.reviewers.find((r) => r.userId === this.meId()) ?? null);
  readonly canComment = computed(() => {
    const r = this.review();
    if (!r || r.status === 'withdrawn') return false;
    return this.ctx.myRole() === 'owner' || (this.ctx.myRole() === 'reviewer' && !!this.mySlot());
  });
  readonly canDecide = computed(() => {
    const r = this.review();
    return (
      !!r &&
      this.ctx.myRole() === 'reviewer' &&
      this.mySlot()?.permission === 'approve' &&
      ['submitted', 'changes_requested'].includes(r.status)
    );
  });
  readonly reviewerCandidates = computed(() => this.members().filter((m) => m.userId !== this.meId()));
  readonly steps = computed(() => {
    const r = this.versionReview();
    const s = r?.status;
    return [
      { label: 'Submitted', done: !!r, sub: r ? new Date(r.createdAt).toLocaleDateString() : '' },
      {
        label: 'Under review',
        done: !!r && (r.comments.length > 0 || r.decisions.length > 0 || s !== 'submitted'),
        sub: `${r?.reviewers.length ?? 0} reviewer(s)`,
      },
      { label: 'Feedback', done: !!r && r.comments.length > 0, sub: `${r?.comments.length ?? 0} comment(s)` },
      {
        label: s === 'rejected' ? 'Rejected' : s === 'changes_requested' ? 'Changes requested' : 'Approved',
        done: s === 'approved' || s === 'rejected' || s === 'changes_requested',
        sub: '',
      },
    ];
  });
  readonly summary = computed(() => {
    const r = this.review();
    const c = r?.comments ?? [];
    return {
      comments: c.filter((x) => x.kind === 'feedback').length,
      suggestions: c.filter((x) => x.kind === 'suggestion').length,
      info: c.filter((x) => x.kind === 'information').length,
      decisions: r?.decisions.length ?? 0,
    };
  });

  constructor() {
    effect(() => {
      this.ctx.tick();
      const pid = this.ctx.projectId();
      if (pid) untracked(() => void this.load(pid));
    });
    effect(() => {
      const vid = this.versionId();
      if (!vid) return this.snapshot.set(null);
      void this.api.version(vid).then((v) => {
        if (this.versionId() === vid) this.snapshot.set(v);
      });
    });
    effect(() => {
      const f = this.auditFilter();
      const pid = this.ctx.projectId();
      this.ctx.tick();
      if (pid) void this.api.auditFiltered(pid, { action: f || undefined, limit: 100 }).then((e) => this.events.set(e));
    });
  }

  private async load(pid: string) {
    const [reviews, members, lineage] = await Promise.all([
      this.api.reviews(pid),
      this.api.members(pid),
      this.api.lineage(pid),
    ]);
    this.reviews.set(reviews);
    this.members.set(members);
    this.lineage.set(lineage);
    if (!this.versionId() || !lineage.nodes.some((n) => n.id === this.versionId()))
      this.versionId.set(lineage.nodes.at(-1)?.id ?? null);
  }
  private async reload() {
    const pid = this.ctx.projectId();
    if (!pid) return;
    await this.load(pid);
    this.events.set(await this.api.auditFiltered(pid, { action: this.auditFilter() || undefined, limit: 100 }));
    void this.ctx.refreshAudit();
  }

  selectVersion(id: string) {
    this.versionId.set(id);
    this.reviewId.set(null);
  }
  openReview(r: Review) {
    this.versionId.set(r.formulaVersionId);
    this.reviewId.set(r.id);
    this.tab.set('feedback');
  }
  member(userId: string) {
    return this.members().find((m) => m.userId === userId);
  }
  reviewCount(versionId: string) {
    return this.reviews().filter((r) => r.formulaVersionId === versionId).length;
  }
  latestReview(versionId: string) {
    return this.reviews().find((r) => r.formulaVersionId === versionId) ?? null;
  }

  openRequest() {
    const reviewers: Record<string, '' | 'comment' | 'approve'> = {};
    for (const m of this.reviewerCandidates())
      reviewers[m.userId] =
        m.role === 'reviewer' ? (m.title.toLowerCase().includes('product') ? 'approve' : 'comment') : '';
    this.req.set({
      formulaVersionId: this.versionId() ?? this.ctx.versions().at(-1)?.id ?? '',
      title: '',
      message: '',
      reviewers,
    });
    this.reqOpen.set(true);
  }
  patchReq(p: Partial<ReturnType<typeof this.req>>) {
    this.req.update((r) => ({ ...r, ...p }));
  }
  setReviewer(userId: string, perm: '' | 'comment' | 'approve') {
    this.req.update((r) => ({ ...r, reviewers: { ...r.reviewers, [userId]: perm } }));
  }
  reqReviewers() {
    return Object.entries(this.req().reviewers)
      .filter(([, p]) => !!p)
      .map(([userId, permission]) => ({ userId, permission: permission as 'comment' | 'approve' }));
  }
  async submitRequest() {
    const r = this.req();
    this.busy.set(true);
    try {
      const created = await this.api.createReview({
        formulaVersionId: r.formulaVersionId,
        title: r.title,
        message: r.message,
        reviewers: this.reqReviewers(),
      });
      this.reqOpen.set(false);
      await this.reload();
      this.openReview(created);
      this.ctx.reportInfo(`Review requested for ${created.versionLabel}`);
    } catch (e) {
      this.ctx.reportError(e, 'Review not requested');
    } finally {
      this.busy.set(false);
    }
  }
  async addComment() {
    const r = this.review();
    if (!r || !this.commentText().trim()) return;
    this.busy.set(true);
    try {
      await this.api.comment(r.id, this.commentText(), this.commentKind());
      this.commentText.set('');
      await this.reload();
      this.reviewId.set(r.id);
    } catch (e) {
      this.ctx.reportError(e, 'Comment not posted');
    } finally {
      this.busy.set(false);
    }
  }
  async decide(decision: 'approved' | 'changes_requested' | 'rejected') {
    const r = this.review();
    if (!r) return;
    this.busy.set(true);
    try {
      await this.api.decide(r.id, decision, this.decisionReason());
      this.decisionReason.set('');
      await this.reload();
      this.reviewId.set(r.id);
    } catch (e) {
      this.ctx.reportError(e, 'Decision not recorded');
    } finally {
      this.busy.set(false);
    }
  }
  async withdraw() {
    const r = this.review();
    if (!r) return;
    try {
      await this.api.withdrawReview(r.id);
      await this.reload();
      this.reviewId.set(r.id);
    } catch (e) {
      this.ctx.reportError(e, 'Not withdrawn');
    }
  }
  async setRole(userId: string, r: ProjectRole) {
    const pid = this.ctx.projectId();
    if (!pid) return;
    try {
      await this.api.setRole(pid, userId, r);
      await this.reload();
    } catch (e) {
      this.ctx.reportError(e, 'Role not changed');
      await this.reload();
    }
  }
  openInFormula() {
    this.ui.patchFormula({ tab: 'history' });
    void this.router.navigate(['/projects', this.ctx.projectId(), 'formula']);
  }
  downloadReport() {
    const r = this.review();
    const v = this.snapshot();
    if (!r || !v) return;
    const body = {
      exportedAt: new Date().toISOString(),
      note: 'Local review record (synthetic demo data)',
      review: r,
      version: v,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
    a.download = `review-${r.versionLabel}-${r.id.slice(0, 8)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  initials(name: string) {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  pyramid(v: FormulaVersion | null) {
    const out = { top: [] as string[], heart: [] as string[], base: [] as string[] };
    for (const it of v?.snapshot.items ?? []) out[it.role].push(it.ingredientName);
    return out;
  }
}
