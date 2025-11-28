# Copilot Instructions

This project is a mono-repo including both the backend and frontend for the NeuRIS Portal, an application for accessing laws, court decisions, and related literature from the federal government in Germany.

The frontend is a Vue + Nuxt application inside `frontend/`. We use: Yarn 4 as our package manager and task runner, TypeScript as the programming language, Tailwind for styling, PrimeVue as our component library, Vitest + Testing Library for unit tests, Playwright for E2E testing.

The backend is a Java 21 + Spring Boot REST API. I work exclusively in the frontend for now, so you should never touch files in the `backend/` folder unless explicitly asked to do so. However you may refer to the backend project e.g. if you need details about types or the API interface. `backend/src/main/java/de/bund/digitalservice/ris/search/controller` would be a good place to start.

## Good to know

For all changes you make, ensure type checking and tests still pass. If existing tests are starting to fail after making changes, ask before changing them.

## Important commands

```
yarn test # runs the unit tests with Vitest
yarn typecheck # runs the typechecker
```

## Outdated coding patterns

This repository contains coding patterns we no longer use. In particular:

- **Unit tests:** Old unit tests use `@vue/test-utils`. All newly created unit test files should use `@testing-library/vue`. When editing an existing file, follow the method used in that file for consistency. Do not mix approaches in one file. Do not refactor a file to a different approach unless explicitly asekd to.

- **Stores:** there are some Pinia-based stores. We don't use Pinia for new stores. When needed, use composables for extracting logic, including state, from components.

- **Naming conventions:** we have some legacy naming conventions for files, including `.data.ts`, `.logic.ts`, `.unit.spec.ts`. Don't use these anymore. When it comes to where stuff should be placed, follow standard Nuxt patterns. Unit tests should be placed next to the tested file and follow the naming pattern `<file>.spec.ts`. However when updating or looking for tests, you might sometimes need to check for files not following that exact pattern.

## Unit tests

- For rendering, use `renderSuspended` from `@nuxt/test-utils/runtime`, which is a drop-in replacement for `@testing-library/vue`s `render` but does additional Nuxt setup.
- Similarly, prefer `mountSuspended` over `mount` in legacy unit tests.
- Do not stub components if it can be avoided.
- PrimeVue is configured globally, you can assume it's available in tests.
- Component unit tests should cover at least the following (if applicable):
  - The component renders without error with reasonable defaults
  - Props are reflected correctly in the UI
  - Slots are rendered. If slots are scoped, the scope is passed correctly
  - All defined events are emitted as expected
  - ARIA attributes are set correctly
  - All defined models work as expected

## Code documentation guidelines

### Introduction

Our intention is to find a reasonable balance between keeping the effort for writing and maintaining documentation low, making our code base easy to understand, and fulfilling our functional requirements regarding documentation.

### General guidelines

- Keep in mind that we are writing documentation both for ourselves and for (potentially) a different team or company taking over the project at some time in the future.
- Try to think of it as supporting a coworker asynchronously, rather than ticking a box just to be able to say “it’s documented”.
- When in doubt, write a comment. Things that may seem obvious to you now might not be for others (and perhaps not even for yourself 6 months from now).
- Assume that the reader is familiar with the respective technology and the general project context.
- Focus on explaining the _how_ and _why_ rather than the _what_. The latter is often easy to figure out from reading the code, but why something has to be done in a certain way may be less clear.

### Shared

Rules of thumb:

- If it can be used from a different file, it MUST to be documented.
- If it is complex, hacky, or otherwise hard to understand, it MUST be documented, even if it is private.
- Anything else MAY be documented if the author feels documenting it makes sense.
- Independently of documentation, code SHOULD be written in a way that supports understanding and readability. Favor naming that is descriptive and conveys intention over brevity or “looking smart”.

Language:

- **Documentation MUST be written in English.**
- German terms MAY be used to supplement English documentation, but do not write descriptions entirely in German.

### TypeScript

**All documentation MUST conform to** [**JSDoc**](https://jsdoc.app/ "https://jsdoc.app/")**.**

**All publicly available types, functions, constants, and classes MUST be documented.** This includes for example:

- Anything (types, functions, constants, classes, …) exported by a module
- Ambient types or module declarations (e.g. `*.d.ts` files)
- For functions: include parameters and return types
- In the rare case where classes are required: constructor + non-private functions
- Anything assigned to the global scope or global objects (you should not do this anyways, but if you can’t avoid it, remember to also document it).
  **All publicly available properties of types, closures, objects, and classes MUST be documented.** This includes for example:

- Generally all properties of types as they’re always public
- Objects, functions, etc. in closure scopes
- Properties of global constants
- Public properties and constructor of classes
  **All values MUST be typed.**

- `any` is not allowed.
- Use `unknown` in cases where you genuinely don’t know or don’t care about the type.
- This ensures we don’t break type safety and have undocumented “mystery” values.
- Where applicable, it is fine to use TypeScript’s type inference rather than explicitly declaring a type first. Just make sure to still add documentation!
  **The README MUST have all informations to get started.** Someone checking out the repo for the first time should be able to get everything up and running without the need for support, just from reading the README and following the instructions provided there.

**No need to document:**

- Configuration files for tooling - this should be well documented by the developers of that tool already. One exception: when fixing tricky issues, setting linting rules, or making any other changes where the reason is not immediately obvious, consider leaving a note explaining the reason for the setting.
- Test cases - the name of the test, combined with simple, “dumb” test cases, should be enough to understand what is being tested, without additional explanation.

### Vue

This includes: Vue components, routing, stores, composables, any other Vue-specific patterns or libraries we may add in the future.

All rules in “TypeScript” also apply here, as we use TypeScript as the programming language for the frontend. In addition:

**All component props, models, and events MUST be documented.**

- This is the public interface of the component. (`defineProps`, `defineModel`, and `defineEmits` respectively)
- It’s ok to rely on TypeScript’s type inference instead of explicitly declaring the type, e.g.

```ts
// Good ✅
const props = defineProps<{ modelValue: string }>()

// Bad 🚫
type Props = { modelValue: string } const props = defineProps<Props>()`
```

**Reactive members of the component SHOULD be documented.**

- While not available to the outside, these are often used for defining complex behavior in components based on inputs, and should therefore generally be documented.
- This includes for example: Computed props, watchers, and watch effects
- You MAY skip documentation if the reactive member is trivial. “Trivial” in this case is defined as “The entire logic fits into a single expression”, e.g.

```ts
// Good ✅
const example = computed(() => (props.useExample ? "yes" : "no"));

// Good ✅ const
localExampleModel = computed({
  get: () => props.exampleModel,
  set: (value) => emit("update:example-model", value),
});
```

**Lifecycle hooks of the component MAY be documented.**

- Similar to reactive members, these are not available from the outside, but often perform important initialization and cleanup tasks.
- This includes for example: Mount and unmount hooks, update hooks
- Please add documentation if the hook is very complicated or uses hacks such as timeouts or waiting for ticks.
  **Templates and styles MAY be documented.** While generally not required, feel free to add comments and explanations to templates and styles in components to make them easier to read.

**Stores and all their state, computed properties, mutations, and actions MUST be documented.** Together, they form the public interface of the store.
