import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: 'app-dasbhoard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  // public projects = input<any>()
}
