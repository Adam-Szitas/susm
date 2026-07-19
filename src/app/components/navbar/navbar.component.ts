import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { FacadeStore } from '../../store/facade.store';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { SusmLogoComponent } from '../../icons/susm-logo.component';

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

  readonly isLoggedIn = this.#facadeStore.isLoggedIn;
  readonly user = this.#facadeStore.user;

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

  logout(): void {
    this.#facadeStore.logout();
  }
}
