import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TabGroupComponent } from './tab-group.component';

/** Panel slot for {@link TabGroupComponent}. */
@Component({
  selector: 'app-tab-panel',
  standalone: true,
  host: {
    '[class.tab-panel-host--inactive]': '!visible()',
  },
  template: `
    <div
      class="tab-panel"
      role="tabpanel"
      [id]="panelDomId()"
      [attr.aria-labelledby]="tabDomId()"
      [class.tab-panel--inactive]="!visible()"
    >
      <ng-content />
    </div>
  `,
  styleUrl: './tab-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabPanelComponent {
  #tabGroup = inject(TabGroupComponent);

  tabId = input.required<string>({ alias: 'id' });

  readonly visible = computed(() => this.#tabGroup.isPanelVisible(this.tabId()));

  panelDomId = computed(() => this.#tabGroup.tabPanelId(this.tabId()));
  tabDomId = computed(() => this.#tabGroup.tabButtonId(this.tabId()));
}
