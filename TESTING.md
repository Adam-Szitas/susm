# SUSM manual QA checklist

Use this after shared-component refactors or before a release. Run against a logged-in environment with sample projects, objects, and protocols.

## Setup

- [ ] `npm run build` succeeds
- [ ] `npm test -- --watch=false --browsers=ChromeHeadless` succeeds
- [ ] App loads at `http://localhost:4200` with valid auth

## Projects list (`/projects`)

- [ ] Page header shows centered title
- [ ] Archive toggle (icon) shows/hides archived projects
- [ ] Project cards show status pill, name, address lines, note, created date
- [ ] Archived projects show archived pill and comment preview when applicable
- [ ] Virtual scroll works when list has 50+ projects (smooth scroll, no layout jump)
- [ ] FAB opens create-project modal
- [ ] Create modal: name, address, note, status fields save correctly
- [ ] Clicking a card navigates to project tab

## Objects list (`/objects`)

- [ ] Page header and filters render
- [ ] Object cards show status, project name, address (with postal code), note, datetime
- [ ] Filter by address text matches house number / level / door / postal code
- [ ] Empty state message when no results
- [ ] Virtual scroll with large lists
- [ ] Card click opens object tab

## Project tab (`/projects/tab/:id`)

- [ ] Breadcrumb and tabs (Objects / Protocols / Todos / Plan) work
- [ ] Project details collapsed by default; expand shows detail fields
- [ ] Object list uses shared cards; compact labels on narrow viewport
- [ ] Object card links preserve category filter query params
- [ ] Reorder mode: drag near viewport edges auto-scrolls
- [ ] FAB opens add-object flow
- [ ] Protocols tab scrolls inside panel on mobile
- [ ] Objects tab first panel scrolls (virtual scroll + internal scroll)

## Object tab (`/objects/tab/:id`)

- [ ] Details collapsed by default; expand/collapse toggle works
- [ ] Detail fields show house number, level, door, prefix, note
- [ ] Inline status select updates object status (no stale value after save)
- [ ] Category select still works
- [ ] Edit button opens edit modal with shared form fields
- [ ] File upload and todos sections unchanged

## Protocols (`/protocols`)

- [ ] Page header with create action (icon-only on mobile)
- [ ] Generate modal: checklist panel has max height and internal scroll
- [ ] Object labels in picker match address formatting

## Forms (shared fields)

- [ ] Project create: `app-project-form-fields` + status select
- [ ] Project edit: same fields, status hidden
- [ ] Object edit: `app-object-form-fields` + status select
- [ ] Object bulk create modal: shared status select on shared fields

## Regression smoke

- [ ] Navbar: Objects link goes to `/objects`
- [ ] Login / logout still work
- [ ] No console errors on main routes
- [ ] Mobile viewport (~390px): icon-only actions where expected

## Automated tests

```bash
cd susm
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Unit coverage focus:

- `object-address.util.spec.ts` — address formatting helpers
- `status-select.component.spec.ts` — ControlValueAccessor binding
- `object-card.component.spec.ts` — card display modes
