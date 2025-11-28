import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { HttpService } from '../../services/http.service';
import { DashboardStats } from '../../models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  imports: [TranslateModule],
})
export class DashboardComponent implements OnInit {
  #httpService = inject(HttpService);

  public stats = signal<DashboardStats | null>(null);
  public loading = signal(true);

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  loadDashboardStats(): void {
    this.loading.set(true);
    this.#httpService.get<DashboardStats>('dashboard/stats').subscribe({
      next: (result) => {
        this.stats.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load dashboard stats:', error);
        this.loading.set(false);
      },
    });
  }
}
