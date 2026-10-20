import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { VerificationStatus } from '../../core/models';

/** Small honesty label: where a value came from and how far it can be trusted. */
@Component({
  selector: 'aur-evidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge ' + cls()" [attr.title]="title()" data-testid="evidence">{{
    text()
  }}</span>`,
})
export class SourceEvidenceComponent {
  readonly status = input.required<VerificationStatus | 'illustrative' | 'not-assessed' | 'deterministic'>();
  readonly source = input<string>('');
  readonly text = computed(
    () =>
      ({
        verified: 'Verified',
        unverified: 'Unverified',
        computed: 'Computed',
        missing: 'Not assessed',
        illustrative: 'Demo / illustrative',
        'not-assessed': 'Not assessed',
        deterministic: 'Deterministic calc',
      })[this.status()],
  );
  readonly cls = computed(
    () =>
      ({
        verified: 'ok',
        unverified: 'warn',
        computed: 'info',
        missing: 'na',
        illustrative: 'violet',
        'not-assessed': 'na',
        deterministic: 'info',
      })[this.status()],
  );
  readonly title = computed(() => this.source() || this.text());
}
