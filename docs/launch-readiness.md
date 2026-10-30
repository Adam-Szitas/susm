# SUSM launch readiness

The public homepage is English and uses https://susm.vercel.app as its canonical origin. It is prerendered so crawlers and social platforms receive content and metadata without running JavaScript. Project, account and shared-object routes use a separate client-rendered shell with noindex metadata. This is an indexing instruction, not an access-control mechanism; authentication remains responsible for private data.

## Validate before deployment

Run `npm run build`, then `node scripts/check-seo.mjs`. Check the build log for prerender errors even if Angular exits successfully. `vercel.json` serves application routes from index.csr.html and leaves unknown paths as HTTP 404 responses. Confirm these rewrites on the deployment preview.

If the domain changes, update `src/app/site.config.ts`, `src/index.html`, `src/app/environment.ts`, `public/robots.txt`, `public/sitemap.xml` and the expectations in `scripts/check-seo.mjs` together. Regenerate the social PNG if its SVG design changes.

## After deployment

- View the homepage source and confirm its title, description, canonical URL and Open Graph image. Confirm the image returns HTTP 200.
- Check /login and /share/example return noindex metadata and the X-Robots-Tag header. Check a nonexistent path returns HTTP 404. Do not block application paths in robots.txt: crawlers must be allowed to see noindex.
- Verify ownership in Google Search Console, submit /sitemap.xml, then inspect the homepage URL and request indexing. Indexing is controlled by Google and is not immediate.
- Refresh cached social previews using the Facebook Sharing Debugger and LinkedIn Post Inspector.

## Accessibility validation

Automated axe WCAG 2 A/AA and WCAG 2.1 AA checks passed on the production homepage and sign-in page at 1440, 390 and 320 CSS pixels, with no horizontal overflow or browser runtime errors. This is scoped testing, not a full WCAG conformance audit.

The app includes a skip link, visible keyboard focus, document language updates, navigation focus management, labeled native modal dialogs, an inert closed mobile menu, notification announcements and sign-in error associations. Before release, manually check authenticated workflows with keyboard and a screen reader, especially stacked dialogs, unsaved-change confirmations, file upload, reordering and protocol generation. Confirm Escape respects unsaved-change guards and focus returns to the triggering control.

Existing build warnings remain for project/protocol stylesheet sizes and the qrcode CommonJS dependency.
