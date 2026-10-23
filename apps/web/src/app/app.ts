import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccessGateComponent } from './core/access/access-gate.component';
import { AccessGateService } from './core/access/access-gate.service';

@Component({
  selector: 'aur-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AccessGateComponent],
  template: `
    @switch (gate.state()) {
      @case ('open') {
        <router-outlet />
      }
      @case ('locked') {
        <aur-access-gate />
      }
    }
  `,
})
export class App {
  readonly gate = inject(AccessGateService);
  constructor() {
    void this.gate.check();
  }
}
