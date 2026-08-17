# Instructions

This project is a mono-repo including both the backend and frontend for the NeuRIS Portal, an application for accessing laws, court decisions, and related literature from the federal government in Germany.

- `frontend/`:
  - Vue + Nuxt application
  - Package manager: PNPM
  - Languages: TypeScript, Tailwind
  - Component library: PrimeVue
  - Unit tests: Vitest + `@testing-library/vue`
  - E2E tests: Playwright
  - Component playground: Storybook

- `backend/`:
  - Java 21 + Spring Boot REST API
  - Package manager & build system: Gradle
  - Controllers: `backend/src/main/java/de/bund/digitalservice/ris/search/controller`

- API spec: `frontend/src/public/openapi.json`

## Good to know

For all changes you make, ensure type checking and tests still pass. If existing tests are starting to fail after making changes, ask before changing them. Test fixtures for E2E tests can be found in `backend/e2e-data`. Assume the backend, frontend dev server, Docker services, etc. are running. If you find they're not, pause and ask me to start them instead of attempting to run them yourself. Similarly, if a large amount of unrelated tests fail due to data mismatches, stop and let me know (likely I forgot to run the backend with local test data).

We use Nuxt's auto import feature.

Ticket IDs: you will often be told the ticket number, otherwise you can usually get it from the branch name, where it's used as a prefix. Ticket numbers are shaped like `RISDEV-<number>`, e.g. `RISDEV-4711`, and branch: `risdev-4711-some-task`.

## Data loading

Fetch data at the page level with a top-level await, and throw createError as soon as a fetch fails. Pages then render only once their data exists, so they don't need loading states or missing-data branches. Fetch independent resources in parallel with Promise.all — sequential awaits serialize the requests.

Fetching inside a component needs a reason. Current exceptions: the court filter (components/search/CourtFilter.vue) loads suggestions on demand, and the two search pages re-trigger a search from the same page, so they emulate a full page load via useLoadingIndicator() plus a loading state on the search button.## E2E tests

## E2E tests

- Located in `frontend/e2e/`
- Run tests in the frontend folder with `pnpm exec playwright test <options>`
- Use `--project chromium` by default unless testing cross-browser issues
- Use `--grep "test name"` to filter tests
- Set `NUXT_PUBLIC_PRIVATE_FEATURES_ENABLED=true` (always do this unless you have a reason not to)
- Run minimal tests to save time, but if an entire view changed, run all tests to catch regressions
- When touching E2E tests, tag them with the current ticket ID. Don't tag if the number is a dummy (`RISDEV-0000`)

## Unit tests

- For rendering, use `renderSuspended` from `@nuxt/test-utils/runtime`, which is a drop-in replacement for `@testing-library/vue`s `render` but does additional Nuxt setup.
- Put unit tests next to the file they're testing: `<filename>.spec.ts`
- Add a describe block with the name of the file they're testing: `describe("<filename without extension>" ...`
- Do not stub components if it can be avoided.
- Use `userEvent` for firing events.
- PrimeVue is configured globally, you can assume it's available in tests.
- Component unit tests should cover at least the following (if applicable):
  - The component renders without error with reasonable defaults
  - Props are reflected correctly in the UI
  - Slots are rendered. If slots are scoped, the scope is passed correctly
  - All defined events are emitted as expected
  - ARIA attributes are set correctly
  - All defined models work as expected
  - Expected interactions work, even if not explicitly defined as an event (e.g. click)

## Other conventions

- use reactive prop destructuring for props and defaults in Vue components. Don't use `withDefaults`

## Storybook and components in `frontend/src/components/ui/`

Any components in `ui/` need to follow these conventions:

- They should be portable. They can't depend on Nuxt-specific functionality or any other components outside of `ui/`. They are allowed to depend on `utils/` and `composables/`, provided those don't use any Nuxt-specific functionality either.
- They can't use auto-imports or aliases. Use relative imports instead.
- They have a story named like `ComponentName.stories.ts`, placed next to the component.
- Components are allowed to import icons from `~icons`, and to use Tailwind.

Storybook does not understand any Nuxt-magic such as aliases, auto-imports, and globals. Stories of components relying on them will crash.

## Important commands

```
pnpm test       # run the unit tests with Vitest
pnpm typecheck  # run the typechecker
pnpm fmt        # format
pnpm lint       # run linting with autofix
```
