import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `<section lang="en" style="padding:3rem 1.5rem;max-width:50rem;margin:auto">
    <h1>Page not found</h1>
    <p>This page may have moved or the address may be incorrect.</p>
    <a routerLink="/">Return to SUSM home</a>
  </section>`,
})
export class NotFoundComponent {}
