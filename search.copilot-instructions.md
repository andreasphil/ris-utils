# Copilot Instructions

This project is a mono-repo including both the backend and frontend for the NeuRIS Portal, an application for accessing laws, court decisions, and related literature from the federal government in Germany.

The frontend is a Vue + Nuxt application inside `frontend/`. We use: Yarn 4 as our package manager and task runner, TypeScript as the programming language, Tailwind for styling, PrimeVue as our component library, Vitest + Testing Library for unit tests, Playwright for E2E testing.

The backend is a Java 21 + Spring Boot REST API. I work exclusively in the frontend for now, so you should never touch files in the `backend/` folder unless explicitly asked to do so. However you may refer to the backend project e.g. if you need details about types or the API interface. `backend/src/main/java/de/bund/digitalservice/ris/search/controller` would be a good place to start.

## Important commands

```
yarn test # runs the unit tests with Vitest
yarn typecheck # runs the typechecker
```

## Good to know

This repository contains coding patterns we no longer use. In particular:

- **Unit tests:** old unit tests use `@vue/test-utils`. All newly created unit test files should use `@testing-library/vue`. When editing an existing file, follow the method used in that file for consistency. Do not mix approaches in one file. Do not refactor a file to a different approach unless explicitly asekd to.

- **Stores:** there are some Pinia-based stores. We don't use Pinia for new stores. When needed, use composables for extracting logic, including state, from components.

- **Naming conventions:** we have some legacy naming conventions for files, including `.data.ts`, `.logic.ts`, `.unit.spec.ts`. Don't use these anymore. When it comes to where stuff should be placed, follow standard Nuxt patterns. Unit tests should be placed next to the tested file and follow the naming pattern `<file>.spec.ts`. However when updating or looking for tests, you might sometimes need to check for files not following that exact pattern.
