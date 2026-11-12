import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { FacadeStore } from '../../store/facade.store';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { SusmLogoComponent } from '../../icons/susm-logo.component';
import { UserStore } from '../../store/user.store';
import { ChecklistFeedbackService } from '@services/checklist-feedback.service';
import { ModalService } from '@services/modal.service';
import { ChecklistFeedbackInboxComponent } from '../checklist-feedback/checklist-feedback-inbox.component';

const FEEDBACK_POLL_MS = 60_000;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, SusmLogoComponent, IconComponent],
})
export class NavbarComponent implements OnInit {
  protected readonly icons = icons;

  #router = inject(Router);
  #facadeStore = inject(FacadeStore);
  #userStore = inject(UserStore);
  #feedback = inject(ChecklistFeedbackService);
  #modal = inject(ModalService);
  #pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly isLoggedIn = this.#facadeStore.isLoggedIn;
  readonly user = this.#facadeStore.user;
  readonly isSuperuser = this.#userStore.isSuperuser;
  readonly protocolsEnabled = this.#userStore.protocolsEnabled;
  readonly feedbackEnabled = this.#userStore.externalSharingEnabled;
  /** Creator-only: pending checklist feedback on links this user created. */
  readonly feedbackPendingCount = this.#feedback.pendingCount;

  constructor() {
    effect(() => {
      const active = this.isLoggedIn() && this.feedbackEnabled();
      this.#setFeedbackPolling(active);
    });
    inject(DestroyRef).onDestroy(() => this.#setFeedbackPolling(false));
  }

  public toggledMenu = signal<boolean>(false);
  readonly isLoginPage = signal(false);

  ngOnInit(): void {
    this.#router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.updateRouteState();
    });
    this.updateRouteState();
  }

  private updateRouteState(): void {
    const path = this.#router.url.split('?')[0].split('#')[0];
    this.isLoginPage.set(path === '/login');
  }

  toggleMobileMenu(): void {
    this.toggledMenu.set(!this.toggledMenu());
  }
  hideMobileMenu(): void {
    this.toggledMenu.set(false);
  }

  openFeedbackInbox(): void {
    this.hideMobileMenu();
    this.#modal.open({
      title: 'checklistFeedback.inbox.title',
      extraWide: true,
      component: ChecklistFeedbackInboxComponent,
    });
  }

  #setFeedbackPolling(active: boolean): void {
    if (typeof window === 'undefined') return;
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
    if (!active) {
      this.#feedback.clearPending();
      return;
    }
    this.#feedback.refreshPending();
    this.#pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') this.#feedback.refreshPending();
    }, FEEDBACK_POLL_MS);
  }

  logout(): void {
    this.#facadeStore.logout();
  }
}
