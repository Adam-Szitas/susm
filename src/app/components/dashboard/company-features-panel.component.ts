import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserStore } from '@store/user.store';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import type { FeatureFlags } from '@models';

const FEATURES = [
  { key: 'protocols', icon: icons.fileTextDetailed, route: '/protocols' },
  { key: 'externalSharing', icon: icons.share, route: '/objects' },
  { key: 'trash', icon: icons.trashBin, route: '/files/removed' },
  { key: 'streetPlan', icon: icons.mapPin, route: '/projects' },
] as const satisfies readonly { key: keyof FeatureFlags; icon: unknown; route: string }[];

/** Read-only company entitlements and illustrative examples, including disabled features. */
@Component({
  selector: 'app-company-features-panel',
  standalone: true,
  imports: [TranslateModule, RouterLink, IconComponent],
  templateUrl: './company-features-panel.component.html',
  styleUrl: './company-features-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyFeaturesPanelComponent {
  readonly icons = icons;
  #user = inject(UserStore);
  readonly canView = computed(() => this.#user.isAdmin() || this.#user.isSuperuser());
  readonly features = computed(() =>
    FEATURES.map((feature) => {
      const flag = this.#user.user()?.feature_flags?.[feature.key]?.enabled;
      const status =
        !this.#user.profileVerified() || typeof flag !== 'boolean'
          ? 'unknown'
          : flag
            ? 'enabled'
            : 'disabled';
      return { ...feature, status };
    }),
  );
}
