---
name: migrate-primevue-component
description: migrate a component that was previously based on PrimeVue to our own codebase. Use when asked to migrate, replace, or rebuild a specific PrimeVue component (e.g. "migrate the Button", "replace PrimeVue Message") into our own component under frontend/src/components/ui/.
---

## What I do

Migrate **one named PrimeVue component** into our own implementation under
`frontend/src/components/ui/`, as part of RISDEV-12137 ("Replace PrimeVue with own
Portal components").

**Migrate a component only when the user asks for that specific component.** Each
component comes with its own additional instructions (target strategy, interface
notes) — wait for them. Do not batch-migrate the whole list on your own initiative.

All `pnpm`/`vitest`/`playwright` commands run from `frontend/`, never the repo root.

## Background you need

### ris-ui is a PrimeVue passthrough theme, not a component library

The shared library `@digitalservicebund/ris-ui` (sources at `~/Projects/ris-ui`,
**read-only — never modify**) does **not** ship Vue SFCs. Each "component" is a
Tailwind **passthrough (`pt`) style preset**: a `.ts` file exporting a
`<Component>PassThroughOptions` object that maps PrimeVue's internal DOM sections
(`root`, `label`, `icon`, …) to Tailwind class strings. PrimeVue runs
`unstyled: true` with `pt: RisUiTheme` (configured in
`frontend/src/plugins/risUi.ts`), so today all styling comes from those presets.

**This is the styling the ticket tells you to reuse.** For a component `Foo`:

- Preset (the Tailwind classes to copy): `~/Projects/ris-ui/src/primevue/foo/foo.ts`
- Story (to adapt): `~/Projects/ris-ui/src/primevue/foo/foo.stories.ts`
- Design tokens & `ris-*` typography utilities: `~/Projects/ris-ui/src/tailwind/global.css`

The classes in `foo.ts` are wrapped in a `tw` tagged template (a no-op used only for
editor IntelliSense). Copy the class strings, not the passthrough structure.

### How PrimeVue is used in the frontend today

- Components are used via **explicit named imports**: `import { Message } from "primevue";`
  (there is no auto-import resolver for PrimeVue). ~36 `.vue` files import from `"primevue"`.
- Config lives in `frontend/src/plugins/risUi.ts` (registers PrimeVue unstyled + the
  ris-ui theme, `ToastService`, the `tooltip` directive).
- `frontend/src/tests/setup.ts` registers PrimeVue globally for tests.

### The canonical example: `Button`

`frontend/src/components/ui/Button.{vue,stories.ts,spec.ts}` is a fully migrated,
self-built component with no PrimeVue dependency. **It's the most comprehensive reference
— mirror its structure.** It exercises nearly every pattern in this skill:

- `Button.vue`: `withDefaults(defineProps<…>(), …)` declaring only the in-use props; native
  attrs (`aria-*`, `href`, `to`, …) left to fall through; a polymorphic `as` prop rendering
  via `<component :is>`; `useSlots()`-driven derived state; the **class section last in
  `<script setup>`** under a `// Classes` comment, with `tw`-tagged named variables (one
  blank line apart) assembled into a Vue class **object** (`{ [primary]: cond }`) that mirrors
  the ris-ui passthrough; `typo-*` responsive typography; a nested `ui/` component
  (`ProgressSpinner`) via **relative import** for the loading state.
- `Button.stories.ts`: `@storybook/vue3-vite`, `html` from `../../utils/tags` (relative), CSF3
  (`Meta`/`StoryObj`), `tags: ["autodocs"]`, one `export const` per variant — and the component
  imported under a **non-HTML name (`UiButton`)** so the formatter doesn't rewrite `<Button>`
  → `<button>`.
- `Button.spec.ts`: `render`/`screen` from `@testing-library/vue` + `vitest`; **behavioral**
  assertions only (roles, text, `disabled`/`loading`, `as`, events, scoped-slot payload,
  ARIA) — no Tailwind-class assertions.

`Badge.{vue,stories.ts,spec.ts}` is a simpler reference if you want the minimal shape (single
prop, an exported enum via a second `<script lang="ts">` block, a one-variant story).

### Icons

`unplugin-icons` with the `ic` (Material Icons) set. Import as components:
`import IcBaselineCheck from "~icons/ic/baseline-check";` then `<IcBaselineCheck />`.
Custom SVGs in `frontend/src/assets/icons/` resolve as `~icons/custom/<name>`.
Use the icon that matches whatever the PrimeVue component/story used.

### Typography: use `typo-*`, not `ris-*`

The app defines responsive `typo-*` utilities in `frontend/src/assets/typography.css`
that compose the fixed-size `ris-*` primitives from ris-ui. When copying classes from a
ris-ui preset, **convert `ris-<x>` typography classes to their `typo-<x>` equivalent**
(e.g. `ris-label1-regular` → `typo-label1-regular`, `ris-body2-regular` → `typo-body-regular`).
Non-typography `ris-*`/token classes (colors, spacing like `bg-blue-800`, `px-16`) stay as-is.

## `frontend/src/components/ui/` conventions (from CLAUDE.md)

Components here **must**:

- Be portable: no Nuxt-specific functionality, no components outside `ui/`. They may use
  `utils/` and `composables/` only if those are Nuxt-free.
- Use **relative imports** (no auto-imports, no `~/` aliases) — Storybook can't resolve them.
- Have a co-located story `<ComponentName>.stories.ts`.
- Icons from `~icons`, styling via Tailwind, are allowed.

## Migration strategy (per the ticket)

Unless the per-component instructions say otherwise:

- Put the new component in `frontend/src/components/ui/<ComponentName>.vue`.
- Keep the **interface (props, events) as close as possible** to current usage, so views
  using it need little to no change.
- Reuse the ris-ui styling as much as possible.
- **Only migrate the props/variants actually in use.** Do **not** shadow native HTML
  attributes (e.g. `aria-label`, `disabled`, `placeholder`) — rely on fallthrough
  attributes instead. Report when dropping variants.
- Don't base the implementation on PrimeVue's internals. Build the **simplest** version
  using modern web standards that meets the requirements.
- Copy the story from ris-ui as `<ComponentName>.stories.ts`; keep stories working with
  minimal changes, drop stories for variants we no longer need.
- Icons from our icon collection; typography switched to the `typo-*` equivalent.
- **Full unit-test coverage** for each new component.
- After migration, **no remaining instances of the PrimeVue component.**

### Per-component target approach (from the ticket)

The user's per-component instructions override this table, but as a default:

- **Build from scratch:** RadioButton, Button, InputText, Textarea, ProgressSpinner
- **Own build / library where it helps:** Tabs, Tooltip, Message, Breadcrumb, Accordion
- **Simplify via web platform, else library:** Select, Drawer
- **Base on a library:** AutoComplete (Reka UI Combobox), InputMask (`maska`)
- **Remove (obsolete), do not rebuild:** DataTable + Column, PanelMenu, Toast,
  InputGroup + InputGroupAddon. For these, delete the usage instead of building a replacement.

## Workflow

### Step 0 — Confirm scope

Confirm which component is being migrated and read the user's per-component instructions
(strategy, interface constraints). If none were given, ask for them.

### Step 1 — Inventory current usage

Find every usage and the surface actually used, so you migrate only what's needed:

```bash
cd frontend
# imports of the component from primevue
grep -rn "from \"primevue\"" src | grep -i "<ComponentName>"
grep -rn "<ComponentName>" src   # tag usage: which props / events / slots appear
```

Catalog the props, events, slots, and directives that are genuinely in use.

### Step 2 — Read the ris-ui source (read-only)

Read `~/Projects/ris-ui/src/primevue/<name>/<name>.ts` (classes to reuse) and
`<name>.stories.ts` (variants). Cross-reference tokens/typography in
`~/Projects/ris-ui/src/tailwind/global.css` if needed. **Do not edit anything in ris-ui.**

### Step 3 — Build `<ComponentName>.vue`

Create `frontend/src/components/ui/<ComponentName>.vue` following the `Button.vue` pattern:

- `defineProps` for the in-use props only; a second `<script>` block for exported
  enums/types if needed.
- `defineEmits` / `defineModel` for the events/models in use.
- Let native attributes fall through (don't redeclare `aria-*`, `disabled`, etc.).
- Reuse ris-ui Tailwind classes; convert `ris-*` typography → `typo-*`.
- Icons from `~icons/ic/*` (or `~icons/custom/*`).
- Relative imports only; no Nuxt-specific code or non-`ui/` components.

**Class construction — mirror the ris-ui passthrough.** When a computed produces conditional
classes, build a Vue class **object** `{ [classes]: condition }`, not a chain of ternaries or an
array of `cond && "…"`. Assign each class list to a named intermediary variable (via the `tw`
helper from `../../utils/tags`, for Tailwind IntelliSense/sorting) and use the variable as the
key — exactly like ris-ui's ```const primary = tw`…``` → `{ [primary]: … }`. Inlining a full
class string as an object key is only OK for 1–2 self-explanatory utilities (e.g.
`"rounded-full": rounded`). This keeps the returned object readable and close to the original
preset.

Two layout conventions for this class section:

- **Put it last in `<script setup>`**, after all other logic (props, slots, derived state),
  under a `// Classes` section comment. The class definitions and the computeds that assemble
  them (`rootClass`, size maps, etc.) are the final thing in the block.
- **Separate each class variable with a blank line.** Each `tw\`…\`` is a long line that soft-wraps,
  so a blank line between them keeps them visually distinct.

```ts
// props, slots, isNativeButton, hasLabel, iconOnly, … come first

// Classes ------------------------------------------------

const base = tw`relative inline-flex …`;

const primary = tw`bg-blue-800 text-white …`;

const secondary = tw`border-2 border-blue-800 …`;

const rootClass = computed(() => ({
  [base]: true,
  "rounded-full": props.rounded,
  [primary]: !props.text && props.severity === "primary",
  [secondary]: !props.text && props.severity === "secondary",
}));
```

### Step 4 — Copy & adapt `<ComponentName>.stories.ts`

Adapt the ris-ui story to our conventions (see `Button.stories.ts`):
`@storybook/vue3-vite`, `html` from `../../utils/tags`, import the component from
`./<ComponentName>.vue`, drop removed variants. Keep existing stories working with minimal
changes.

### Step 5 — Write `<ComponentName>.spec.ts`

Full coverage (co-located, `describe("<ComponentName>", …)`). Cover, where applicable:
renders with sensible defaults; props reflected in the UI; slots rendered (scoped slots
receive scope); every declared event emits; expected interactions work even if not a declared
event (e.g. `click`); ARIA attributes correct; models work.
Use `render` from `@testing-library/vue` for portable components (like `Button.spec.ts`);
use `renderSuspended` from `@nuxt/test-utils/runtime` only if the component touches Nuxt
composables (which `ui/` components normally shouldn't).

**Test behavior, not Tailwind class presence.** Don't assert `toHaveClass("bg-blue-800")` /
`toHaveClass("h-64")` for visual variants: jsdom never renders these classes, so the assertion
just restates the source (a shared typo passes; a design-driven class rename fails with no real
regression) — it tests *how*, not *what*. Cover visual variants (severities, sizes, etc.) in
**Storybook** instead, which is where appearance is actually reviewed. Reserve unit tests for
observable behavior/contract: rendered text/roles, `disabled`/`loading` state, `as` rendering a
different element, emitted events and interactions, scoped-slot payloads, ARIA. Query by role
(`getByRole("link", …)`, `getByRole("button", …)`) rather than raw DOM selectors like
`container.querySelector("a")`.

### Step 6 — Replace all usages

Swap every PrimeVue usage for the new component:

- Remove the component from the `primevue` named import (or delete the whole import line if it
  was the only one).
- **`ui/` components auto-import with a `Ui` prefix** (`ui/Button.vue` → `<UiButton>`, like the
  existing `<UiBadge>`). So call sites change from `<Button>` to `<UiButton>` — you edit the tag,
  not just the import. Inside another `ui/` component, use a relative import instead
  (`import ProgressSpinner from "./ProgressSpinner.vue"`), never the auto-import.
- Adjust props/events to the (near-identical) new interface.
- When doing the tag rename mechanically (sed/perl), watch for **multi-line closing tags** the
  formatter produces, e.g. `>Label</Button\n    >` — a naive `</Button>` match misses these and
  leaves a mismatched `<UiButton>…</Button>` that fails to parse. Grep for `</Component` (without
  the trailing `>`) afterwards to catch them.

### Step 7 — Verify

```bash
cd frontend
grep -rn "<ComponentName>" src | grep -i primevue   # must return nothing
pnpm typecheck
pnpm test        # at least the new spec + affected files
pnpm lint
pnpm fmt
```

Confirm **no remaining PrimeVue instances** of the migrated component. If the component was
the last user of a PrimeVue feature (e.g. `ToastService`, the `tooltip` directive), clean up
the now-dead registration in `frontend/src/plugins/risUi.ts` too.

Run relevant E2E tests if a whole view changed (see CLAUDE.md for the Playwright invocation).

## Gotchas (learned in practice)

- **Auto-import prefix:** `ui/` components are `<UiComponentName>` at call sites (see Step 6).
- **Formatter lowercases story tags:** `oxfmt`/prettier rewrites a `<Button>` tag inside a
  story `html` template to the native `<button>`, silently breaking the story (renders a
  bare element, not your component). Import the component under a non-HTML name in the story —
  e.g. `import UiButton from "./Button.vue"` and use `<UiButton>` — and re-run `pnpm fmt` to
  confirm the tag survives. (ris-ui hit this too and aliased to `PrimevueButton`.)
- **Typography isn't always a 1:1 name swap, but the outcome must always be responsive.**
  Don't leave fixed `ris-*` typography in place. The `typo-*` scale collapses some primitives
  (e.g. no `body1`/`body2` split — both map into `typo-body-*`), so when a component uses fixed
  `ris-body1`/`ris-body2` to differentiate variants, you must pick the responsive scale that
  keeps that distinction. Map same-level: `body2`→`label2`, `body1`→`label1`, i.e. `ris-body2-*`
  → `typo-label2-*` and `ris-body1-*` → `typo-label1-*` (for button-like text, `label`
  typography fits better than `body`). **Flag which option you chose** — the question is which
  `typo-*` scale, never whether to stay fixed.
- **Icon/spinner color on solid backgrounds:** a restored spinner with a hard-coded color
  (e.g. `border-blue-900`) is invisible on a same-color button. Use `border-current` + a default
  `text-*`, and let the button override via `!text-current` so the indicator inherits the
  button's text color per severity.
- **Tests asserting PrimeVue internals:** specs may target PrimeVue-specific artifacts — a
  `.p-*` class, or PrimeVue's auto-set `aria-label` (it derived the accessible name from the
  `label` prop; our components don't, per the no-shadow rule, so a non-decorative stubbed icon
  can leak into the accessible name). These assertions must move to the new component's
  behavior. Per CLAUDE.md, **ask before changing a failing test** — the intent is preserved,
  but the user should confirm.
- **`as` polymorphism:** several call sites render the button as a link via `:as="NuxtLink"`,
  `as="a"`, or `:as="ExternalLink"`, passing `to`/`href`/`url` alongside. Support `as` as a
  prop (`string | Component`, default `"button"`) and let the link-specific attributes fall
  through; only bind `type`/`disabled` when actually rendering a native `<button>`.

## Done when

- New `<ComponentName>.{vue,stories.ts,spec.ts}` exist in `src/components/ui/`.
- No remaining PrimeVue instances of the component; imports removed.
- Typecheck, unit tests, lint, and format all pass.
- No functional or a11y regressions in the views that used it.
