# Testing — Globus BTP

The project follows a full **test pyramid**. Each layer runs independently and is
wired into CI (`.github/workflows/ci.yml`).

```
        ▲  e2e (Playwright)        — critical user journeys, real built SPA
       ╱ ╲ visual (Chromatic)      — Storybook component snapshots
      ╱   ╲ a11y (axe-core)        — accessibility of shared UI primitives
     ╱     ╲ component (Vitest+RTL) — components & hooks in jsdom
    ╱       ╲ integration (MSW)     — hooks ↔ axios ↔ HTTP, mocked backend
   ╱_________╲ integration (pytest) — every API module against a real app+DB
```

## Backend — pytest (base of the pyramid)

```bash
cd backend
python -m pytest tests/ -q
```

- Ephemeral SQLite per session (`tests/conftest.py`), seeded ADMIN + CLIENT users.
- Shared fixtures: `admin_headers` / `client_headers` (function), `admin_auth`
  (session — use this inside module-scoped fixtures), `client_user_id`,
  `sample_project`.
- **23 files** covering auth, 2FA, CMS (public + admin), analytics, CRM, client
  portal, collaboration, realtime, projects/team, **invoicing, HR + payroll,
  procurement, equipment, SAV, planning, signing**, documents/exports, health.
- **163 tests** green.

## Frontend — Vitest (unit / component / integration / a11y)

```bash
cd frontend
npm test                # run once
npm run test:coverage   # with v8 coverage
npm run test:watch      # watch mode
```

- jsdom environment, `src/test/setup.ts` boots **MSW** (`src/test/msw/`) and the
  **axe** matcher.
- Integration tests hit the real React-Query → axios → HTTP path with MSW
  standing in for the backend (`src/test/erp.hooks.msw.test.tsx`).
- Override a handler per-test with `server.use(http.get(...))` to exercise empty
  / error branches.
- a11y: `src/test/a11y.test.tsx` runs axe-core on the shared UI primitives.

## End-to-end — Playwright

```bash
cd frontend
npx playwright install chromium   # first time
npm run test:e2e                  # builds + previews + drives Chromium
npm run test:e2e:ui               # interactive
```

- `playwright.config.ts` boots the **built** SPA via `vite preview` (so e2e runs
  against the production bundle — this is what caught the manual-chunk React
  init bug).
- Specs in `e2e/` cover the public vitrine, routing, and the auth screens; they
  need no backend (data queries resolve to adapted empty states).

## Component catalogue — Storybook + Chromatic

```bash
cd frontend
npm run storybook         # dev server on :6006
npm run build-storybook   # static build → storybook-static/
```

- Stories live next to components (`src/components/ui/*.stories.tsx`).
- The a11y addon flags violations in the Storybook UI.
- **Chromatic** visual regression runs in CI when the `CHROMATIC_PROJECT_TOKEN`
  repository secret is set (otherwise the step is skipped). Locally:
  `npx chromatic --project-token <token>`.

## CI

`backend-tests`, `frontend-build` (tsc + Vitest + build), `e2e`, `storybook`
(+ Chromatic) run on every push / PR; `docker` builds images on `main`/tags.
