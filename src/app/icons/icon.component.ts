import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IconName, SvgIconDefinition } from './icon.model';
import { icons } from './icon.definitions';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-icon',
    '[style.--icon-size.px]': 'size()',
  },
})
export class IconComponent {
  /** Icon definition from `@icons` (e.g. `icons.plus`). */
  readonly icon = input<SvgIconDefinition | null>(null);
  /** Lookup by registry key when `icon` is not passed. */
  readonly name = input<IconName | null>(null);
  readonly size = input<number | null>(null);
  readonly strokeWidth = input<number | string | null>(null);
  readonly svgClass = input('');

  readonly resolved = computed((): SvgIconDefinition => {
    const definition = this.icon() ?? (this.name() ? icons[this.name()!] : null);
    if (!definition) {
      throw new Error('app-icon requires [icon] or [name].');
    }

    const overrideStroke = this.strokeWidth();
    if (overrideStroke == null) {
      return definition;
    }

    return { ...definition, strokeWidth: overrideStroke };
  });
}
