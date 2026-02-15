# Instructions

This project is a mono-repo including both the backend and frontend for the NeuRIS Portal, an application for accessing laws, court decisions, and related literature from the federal government in Germany.

- `frontend/`:
  - Vue + Nuxt application
  - Package manager: PNPM
  - Languages: TypeScript, Tailwind
  - Component library: PrimeVue
  - Unit tests: Vitest + `@testing-library/vue`
  - E2E tests: Playwright

- `backend`:
  - Java 21 + Spring Boot REST API
  - Package manager & build system: Gradle
  - Controllers: `backend/src/main/java/de/bund/digitalservice/ris/search/controller`

## Good to know

For all changes you make, ensure type checking and tests still pass. If existing tests are starting to fail after making changes, ask before changing them.

Test fixtures for E2E tests can be found in `backend/e2e-data`.

Assume the backend, frontend dev server, Docker services, etc. are running. If you find they're not, pause and ask me to start them instead of attempting to run them yourself.

## E2E tests

- Located in `frontend/e2e/`
- Run tests in the frontend folder with `pnpm exec playwright test <options>`
- Use `--project chromium` by default unless testing cross-browser issues
- Use `--grep "test name"` to filter tests
- Set `NUXT_PUBLIC_PRIVATE_FEATURES_ENABLED=true` (default)
- Run minimal tests to save time, but if an entire view changed, run all tests to catch regressions

## Unit tests

- For rendering, use `renderSuspended` from `@nuxt/test-utils/runtime`, which is a drop-in replacement for `@testing-library/vue`s `render` but does additional Nuxt setup.
- Put unit tests next to the file they're testing: `<filename>.spec.ts`
- Add a describe block with the name of the file they're testing: `describe("<filename without extension>" ...`
- Do not stub components if it can be avoided.
- PrimeVue is configured globally, you can assume it's available in tests.
- Component unit tests should cover at least the following (if applicable):
  - The component renders without error with reasonable defaults
  - Props are reflected correctly in the UI
  - Slots are rendered. If slots are scoped, the scope is passed correctly
  - All defined events are emitted as expected
  - ARIA attributes are set correctly
  - All defined models work as expected

## Important commands

```
pnpm test           # run the unit tests with Vitest
pnpm typecheck      # run the typechecker
pnpm oxlint:check   # run linting
pnpm oxlint:fix     # fix linting issues
pnpm prettier:check # check code formatting
pnpm prettier:fix   # fix code formatting
```
