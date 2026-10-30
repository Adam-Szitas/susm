import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { siteConfig } from '../site.config';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.update(event.urlAfterRedirects));
  }

  update(url: string): void {
    const path = url.split(/[?#]/)[0];
    const home = path === '/';
    const labels: Record<string, string> = {
      login: 'Sign in',
      register: 'Register',
      projects: 'Projects',
      objects: 'Objects',
      files: 'Files',
      protocols: 'Protocols',
      dashboard: 'Dashboard',
      admin: 'Administration',
      share: 'Shared object',
    };
    const title = home
      ? siteConfig.title
      : `${labels[path.split('/')[1]] ?? 'Page not found'} | SUSM`;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: siteConfig.description });
    this.meta.updateTag({
      name: 'robots',
      content: home ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    });
    this.meta.updateTag({
      property: 'og:title',
      content: home ? title : 'SUSM | Project workspace',
    });
    this.meta.updateTag({ property: 'og:description', content: siteConfig.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: siteConfig.name });
    this.meta.updateTag({ property: 'og:url', content: siteConfig.origin + '/' });
    this.meta.updateTag({ property: 'og:image', content: siteConfig.origin + siteConfig.image });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({
      property: 'og:image:alt',
      content: 'SUSM - project documentation, photos, checklists and PDF protocols.',
    });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({
      name: 'twitter:title',
      content: home ? title : 'SUSM | Project workspace',
    });
    this.meta.updateTag({ name: 'twitter:description', content: siteConfig.description });
    this.meta.updateTag({ name: 'twitter:image', content: siteConfig.origin + siteConfig.image });
    this.meta.updateTag({
      name: 'twitter:image:alt',
      content: 'SUSM project documentation workspace',
    });
    let canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (home) {
      if (!canonical) {
        canonical = this.document.createElement('link');
        canonical.rel = 'canonical';
        this.document.head.appendChild(canonical);
      }
      canonical.href = siteConfig.origin + '/';
    } else {
      canonical?.parentNode?.removeChild(canonical);
    }
    const previousData = this.document.getElementById('site-structured-data');
    previousData?.parentNode?.removeChild(previousData);
    if (home) {
      const script = this.document.createElement('script');
      script.id = 'site-structured-data';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: siteConfig.name,
        url: siteConfig.origin,
        description: siteConfig.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        image: siteConfig.origin + siteConfig.image,
      });
      this.document.head.appendChild(script);
    }
    if (isPlatformBrowser(this.platform)) {
      requestAnimationFrame(() => {
        if (!this.document.querySelector('dialog[open], .modal-host'))
          this.document.getElementById('main-content')?.focus({ preventScroll: true });
      });
    }
  }
}
