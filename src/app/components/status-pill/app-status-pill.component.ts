import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { formatWorkStatus, WorkStatus } from "@models";
import { TranslateModule } from "@ngx-translate/core";

@Component({
    selector: 'app-status-pill',
    templateUrl: './app-status-pill.component.html',
    styleUrl: './app-status-pill.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslateModule],
})
export class StatusPillComponent {
    @Input() status: WorkStatus = 'created';
    formatStatus = formatWorkStatus;
}