import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const MAP: Record<string, { label: string; cls: string; icon: string }> = {
  pass: { label: 'Pass', cls: 'ok', icon: '✓' },
  warning: { label: 'Warning', cls: 'warn', icon: '!' },
  fail: { label: 'Fail', cls: 'err', icon: '✕' },
  not_assessed: { label: 'Not assessed', cls: 'na', icon: '–' },
  evaluated: { label: 'Evaluated', cls: 'ok', icon: '✓' },
  submitted: { label: 'In review', cls: 'info', icon: '•' },
  changes_requested: { label: 'Changes requested', cls: 'warn', icon: '!' },
  approved: { label: 'Approved', cls: 'ok', icon: '✓' },
  rejected: { label: 'Rejected', cls: 'err', icon: '✕' },
  withdrawn: { label: 'Withdrawn', cls: 'na', icon: '–' },
  planned: { label: 'Planned', cls: 'na', icon: '•' },
  in_progress: { label: 'In progress', cls: 'info', icon: '•' },
  completed: { label: 'Completed', cls: 'ok', icon: '✓' },
  observation: { label: 'Observation', cls: 'violet', icon: '•' },
  measurement: { label: 'Measurement', cls: 'info', icon: '#' },
  hypothesis: { label: 'Hypothesis', cls: 'warn', icon: '?' },
};

/** One visual language for check, review, experiment and observation states. */
@Component({
  selector: 'aur-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge ' + m().cls" [attr.data-status]="status()"
    ><span aria-hidden="true">{{ m().icon }}</span
    >{{ label() || m().label }}</span
  >`,
})
export class StatusChipComponent {
  readonly status = input.required<string>();
  readonly label = input<string>('');
  readonly m = computed(() => MAP[this.status()] ?? { label: this.status(), cls: 'na', icon: '•' });
}
