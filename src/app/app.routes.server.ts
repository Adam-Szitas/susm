import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'projects/tab/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'objects/tab/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'share/:token',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
