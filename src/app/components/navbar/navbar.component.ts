import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from "rxjs";
import { FacadeStore } from "../../store/facade.store";

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class NavbarComponent implements OnInit {
  public user = computed(() => {
    return this.#facadeStore.user();
  });

  public toggledMenu = signal<boolean>(false);

  public hideMenuItem = null;
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #facadeStore = inject(FacadeStore);

  ngOnInit(): void {
      this.#router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
        this.getRouteParamsAndQueryParams();
      })
      this.getRouteParamsAndQueryParams();
  }

  getRouteParamsAndQueryParams(): void {
    const routeParams = this.#route.snapshot.params;
    const queryParams = this.#route.snapshot.queryParams;
  }

  toggleMobileMenu(): void {
    this.toggledMenu.set(!this.toggledMenu());
  }
  hideMobileMenu(): void {
    this.toggledMenu.set(false);
  }

  logout(): void {
    this.#facadeStore.logout();
    console.log(this.user());
  }
}
