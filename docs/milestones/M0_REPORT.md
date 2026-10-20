# M0 — Repository + traceability · COMPLETE

**Gate:** both apps start locally; `/health` returns healthy; six routes render the shared shell; no external
calls by default. → **Passed** (`e2e/m0-shell.spec.ts`, 3/3).

## Delivered
* npm-workspaces monorepo: `apps/web` (Angular 21, strict TS + strict templates, zoneless),
  `apps/api` (NestJS 11, strict TS). Prettier, ESLint (typescript-eslint; angular-eslint with template
  accessibility rules), Jest, Vitest, Playwright.
* `.env.example`, `.gitignore` (data, reports, secrets excluded), README with Windows-friendly commands.
* Screen traceability: `docs/SCREEN_INDEX.md` (27 IDs → route/state/component/status) and
  `tools/verify-screens.mjs` (27/27 reference images verified unchanged by SHA-256).
* Design tokens (`apps/web/src/styles.scss`): light surfaces, cards, gradients, family palette, radii, shadows,
  spacing, typography (bundled Inter).
* Shared shell: brand, six-item sidebar (aria-current), current-project card, header with global search,
  Coastal Air project selector, Manual/AI switch, activity (audit) and help menus, simulated user chip.
* Routing: `/projects/:projectId/{concept,ingredients,formula,validation,experiments,review}`, landing redirect.
* API: `/health` + `/api/v1/health`, loopback bind, request-id middleware, stable error envelope, DTO
  validation pipe, JSON persistence scaffold, mock project fixture.
* Outbound-network guard in every Playwright test (any non-loopback request fails the test).

## Commands
`npm ci` → `npm run dev` → http://127.0.0.1:4200 · `curl http://127.0.0.1:3000/health`

## Decisions
Angular 21 instead of 22 (Node engine compatibility); Storybook not configured (see README §5).
