/** Public identity. Keep robots.txt, sitemap.xml and deployment URLs in sync when changing domains. */
export const siteConfig = {
  origin: 'https://susm.vercel.app',
  name: 'SUSM',
  title: 'SUSM | Project documentation, photos & PDF protocols',
  description:
    'Keep project objects, site photos, checklists, and PDF protocols connected in one workspace. Organize documentation and prepare project handovers with SUSM.',
  image: '/social/susm-preview.png',
} as const;
