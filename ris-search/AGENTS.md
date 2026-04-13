# Instructions

This project is a mono-repo including both the backend and frontend for the NeuRIS Portal, an application for accessing laws, court decisions, and related literature from the federal government in Germany.

- `frontend/`:
  - Vue + Nuxt application
  - Package manager: PNPM
  - Languages: TypeScript, Tailwind
  - Component library: PrimeVue
  - Unit tests: Vitest + `@testing-library/vue`
  - E2E tests: Playwright

- `backend/`:
  - Java 21 + Spring Boot REST API
  - Package manager & build system: Gradle
  - Controllers: `backend/src/main/java/de/bund/digitalservice/ris/search/controller`

## Good to know

For all changes you make, ensure type checking and tests still pass. If existing tests are starting to fail after making changes, ask before changing them.

Test fixtures for E2E tests can be found in `backend/e2e-data`.

Assume the backend, frontend dev server, Docker services, etc. are running. If you find they're not, pause and ask me to start them instead of attempting to run them yourself.

We use Nuxt's auto import feature.

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
pnpm test       # run the unit tests with Vitest
pnpm typecheck  # run the typechecker
pnpm fmt        # format
pnpm lint       # run linting with autofix
```

## Library Docs

<!-- context7 -->

Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

### Steps

1. Resolve library: `ctx7 library <name> "<user's question>"`
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `ctx7 docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `ctx7 login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.

<!-- context7 -->
