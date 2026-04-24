# Frontend Conventions and Patterns

## Context

This style guide describes common patterns and best practices we want to establish in our frontend code. It's not intended to be an exhaustive list of everything frontend-development, but based on our needs and learnings.

This document is a living document. If you notice anything that you would like to change or add, please raise it in one of our Dailies or on Slack.

## Vue, TypeScript

### Use PascalCase for component names.

Use a consistent naming convention for components. Use the name that matches the filename, to make the code easier to read and to refactor.

```vue
<script setup lang="ts">
import MyComponent from "~/components/MyComponent.vue";
</script>

<!-- Good ✅ -->
<template>
  <MyComponent />
</template>

<!-- Bad 🚫 -->
<template>
  <my-component />
</template>
```

### Use aliases for import paths.

We use the alias `~/...` for referencing the `src/` folder. Use this alias to import modules in your components and modules. This helps us to keep paths simple and predictable, and therefore easy to refactor.

Exception: Tests can use the relative path, as they always need to be placed next to each other, and will always be moved as a group.

```ts
// Good ✅
import MyComponent from "~/components/MyComponent.vue";

// Bad 🚫
import MyComponent from "src/components/MyComponent.vue";
import MyComponent from "../MyComponent.vue";
```

### Treat props as immutable.

Never mutate values (or properties of those values) that have been passed as props. Always work with copies and events.

Learn more: [RFC 0003 - Immutable V-Model](https://digitalservicebund.atlassian.net/wiki/spaces/VER/pages/869040131), [Vue.js](https://vuejs.org/guide/components/props.html#one-way-data-flow)

```ts
const props = defineProps<{
  myProp: { value: string };
}>();

// Good ✅
const emits = defineEmits<{
  "update:myProp": [value: string];
}>();

function changeValue(value) {
  emit("update:myProp", { value });
}

// Bad 🚫
function changeValue(value) {
  props.myProp.value = value;
}
```

Note that for primitive data types, this is done automatically for you if you use [defineModel](https://vuejs.org/api/sfc-script-setup.html#definemodel). You will still need to take care to treat objects and arrays as immutable though:

```ts
// Good ✅
const model = defineModel<{ value: string }>("myProp");

function changeValue(value) {
  model.value = { example: value };
}

// Bad 🚫
function changeValue(value) {
  model.value.example = value;
}
```

### Use TypeScript and "script setup" syntax for component logic.

From the different available ways of writing Vue components, only [script setup](https://vuejs.org/api/sfc-script-setup.html#script-setup) is allowed. This is to keep our components consistent, while taking advantage of the most modern and convenient features. All component code needs to be written in TypeScript.

```vue
<!-- Good ✅ -->
<script setup lang="ts">
...
</script>

<!-- Bad 🚫 -->
<script setup lang="js">
...
</script>
<script lang="ts">
...
</script>
```

### Avoid CSS and `style` blocks. Always use scoped CSS or CSS modules.

Our styling library and methodology of choice is Tailwind. Tailwind can do almost everything that CSS can do, so there's rarely a reason not to use it. Those rare reasons include:

- Transitions in Vue, as they depend on very specific class names

- CSS variants outside of the Tailwind design system that are not known at runtime, as all Tailwind variants need to be known at runtime

If you can't avoid using CSS, the style blocks must be a [module](https://vuejs.org/api/sfc-css-features.html#css-modules) (preferred) or [scoped](https://vuejs.org/api/sfc-css-features.html#scoped-css), depending on the use case, to minimize the side effects of styles outside the component itself.

```vue
<!-- Good: Tailwind where possible ✅ -->
<input class="block bg-white" />

<!-- Bad: CSS where Tailwind alternatives exist 🚫 -->
<input :class="$style.myInput" />
<style module>
.myInput { ... }
</style>

<!-- Good: Module CSS for transitions ✅ -->
<transition name="my-transition">...</transition>
<style scoped>
.my-transition-enter-active { ... }
</style>

<!-- Good: Scoped CSS for dynamic styles ✅ -->
<div :class="$style.dynamicHeightContainer"></div>
<style module>
.dynamicHeightContainer {
  height: v-bind(calculatedHeight);
}
</style>
```

### Avoid using IDs. Do not assume them to be human-readable or static.

Using IDs in HTML can lead to issues with global uniqueness, high CSS specificity, and complications with direct DOM manipulation, which interferes with Vue's reactivity system. Instead, use classes for styling and refs for DOM access to ensure maintainability and consistency.

In the rare cases where you can't avoid IDs (e.g. for `aria-labelledby` or `<label for="...">`), use Vue's built-in `useId()` for a random, unique ID.

If you need an ID for tests, use `data-testid` instead.

```vue
<!-- Good ✅ -->
<script setup>
import { useId } from "vue";
const id = useId();
</script>

<template>
  <label :for="id">Label</label>
  <input :id />
</template>

<!-- Bad 🚫 -->
<template>
  <label for="myElement">Label</label>
  <input id="myElement" />
</template>
```

### Prefer v-bind in CSS over style bindings.

Avoid style bindings because of their high specificity. Prefer [v-bind in CSS](https://vuejs.org/api/sfc-css-features.html#v-bind-in-css) if you need to dynamically set styling based on component state.

```vue
<!-- Good ✅ -->
<script setup>
const color = ref("red");
</script>

<template>
  <span :class="$style.colored">Text</span>
</template>

<style module>
.colored {
  color: v-bind(color);
}
</style>

<!-- Bad 🚫 -->
<script setup>
const color = ref("red");
</script>

<template>
  <span :style="{ color }">Text</span>
</template>
```

### Avoid calling functions in templates.

Functions in templates [will be called every time the component renders](https://vuejs.org/guide/essentials/computed.html#computed-caching-vs-methods) and cannot be automatically optimized by the runtime or the compiler. Instead, use `computed` and similar ways of preparing values inside your `script`. These will only re-run when necessary.

```vue
<!-- Good ✅ -->
<script setup>
const items = ref([]);
const isEmpty = computed(() => items.length === 0);
</script>

<template>
  <ul v-if="!isEmpty">
    <!-- ... -->
  </ul>
</template>

<!-- Bad 🚫 -->
<script setup>
const items = ref([]);
function isEmpty(array) {
  return array.length === 0;
}
</script>

<template>
  <ul v-if="isEmpty(items)">
    <!-- ... -->
  </ul>
</template>
```

### Do not render empty components.

If a component cannot meaningfully render without certain data, the decision to render it should be made **outside** the component, not inside. The parent component (or container) should decide whether to render a child component based on data availability. This keeps the child component focused on its core logic and presentation. It also simplifies its behavior since it can always rely on valid data when rendered. Exceptions include:

- If the component is explicitly designed to handle empty states (e.g., a "No Results" message is part of its core functionality)

- If the empty state is contextual and requires component-specific logic (e.g., a loading skeleton)

```vue
<!-- ✅ Good: Component using MyComponent -->
<template>
  <MyComponent v-if="someData" :some-data="someData" />
</template>

<!-- 🚫 Bad: MyComponent.vue -->
<script>
const props = defineProps<{
  someData?: any[]
}>()
</script>

<template>
  <div v-if="someData.length">...</div>
</template>
```

### Components should not make assumptions about the layout they're used in.

Components should never assume or enforce their own layout context, such as fixed widths, margins, or positioning. These decisions belong to the parent or layout system. This ensures flexibility and reusability across different contexts. If sizing or spacing is required, expose it as configurable props (e.g., `maxWidth`, `spacing`) or use [fallthrough attributes](https://vuejs.org/guide/components/attrs.html). Exception: Fixed dimensions or margins are acceptable if they are intrinsic to the component's functionality (e.g., a modal's maximum width or a button's minimum touch target size).

```vue
<!-- ✅ Good -->
<!-- Button.vue -->
<template>
  <button>
    <slot />
  </button>
</template>

<!-- Parent -->
<template>
  <Button class="w-full">Click me</Button>
</template>

<!-- 🚫 Bad -->
<template>
  <!-- Hardcoded width and margin -->
  <button style="width: 200px; margin: 10px;">
    <slot />
  </button>
</template>
```

### Auto-import components, composables, and helpers when possible.

Nuxt provides and encourages [auto-importing out of the box.](https://nuxt.com/docs/4.x/guide/concepts/auto-imports#vue-and-nuxt-composables) For all supported types of code, prefer auto-imports over manually importing them to keep components tidy and ensure Nuxt's setup in unit tests works as expected. Exception: manual imports are acceptable if it avoids naming conflicts.

## Security

### Avoid `v-html`. Sanitize raw HTML if rendering HTML is required.

Unsanitized HTML can expose us to cross-site scripting (XSS) attacks when inserted into the DOM with `v-html`. Also see: [Vue.js](https://vuejs.org/api/built-in-directives.html#v-html)

```vue
<!-- ✅ Good -->
<article v-html="sanitizeHtml(someHtml)"></article>

<!-- 🚫 Bad -->
<article v-html="someHtml"></article>
```

### Do not use user-defined values in style bindings.

User-provided styles can lead to vulnerabilities such as [clickjacking](https://owasp.org/www-community/attacks/Clickjacking). Also see: [Vue.js](https://vuejs.org/guide/best-practices/security.html#style-injection)

```vue
<!-- 🚫 Bad -->
<input v-model="color" />
<a :style="{ color }">...</a>
```

### Avoid user-defined values in URL bindings. Sanitize URLs if a binding is required.

Binding a user-defined value to a URL can be misused to inject dynamic behavior into a page, e.g. by using `javascript:...`. Avoid dynamic and user-defined values to reduce the risk of XSS attacks via URL injection. If dynamic binding can't be avoided, make sure to sanitize URLs first. Also see: [Vue.js](https://vuejs.org/guide/best-practices/security.html#url-injection)

```vue
<!-- ✅ Good -->
<input v-model="userDefinedUrl" />
<a :href="sanitizeUrl(userDefinedUrl)">...</a>

<!-- 🚫 Bad -->
<input v-model="userDefinedUrl" />
<a :href="userDefinedUrl">...</a>
```

### Do not use HTML script tags inside Vue templates.

Using an HTML script tag inside Vue templates can lead to unpredictable behavior in Vue. It can also lead to vulnerabilities, because the script will run entirely unchecked. Also see: [Vue.js](https://vuejs.org/guide/best-practices/security.html#javascript-injection)

## Tailwind

### Use `ris-` typography utilities for text styling.

The design system provides custom Tailwind typography utilities (e.g. `ris-label1-regular`, `ris-body2-bold`, `ris-link1-regular`) that encode both the correct font size and weight for each typographic role. Prefer these over composing raw Tailwind utilities (`text-sm font-bold`, etc.), which can diverge from the design system and make typography harder to maintain.

```vue
<!-- Good ✅ -->
<p class="ris-body1-regular">...</p>
<span class="ris-label2-bold">...</span>

<!-- Bad 🚫 -->
<p class="text-base font-normal">...</p>
<span class="text-sm font-bold">...</span>
```

### Avoid arbitrary values.

Two of the most important advantages of Tailwind are:

- Visual consistency from using a configured set of utilities for colors, text, spacing, etc.

- Very efficient CSS from building everything with the same handful of building blocks.

Using [arbitrary values](https://tailwindcss.com/docs/adding-custom-styles#using-arbitrary-values) negatively impacts both of them. We should therefore avoid them whenever possible. Hint: If you notice unusual colors, text, etc. in the design, don't immediately reach for an arbitrary value. This is most likely a mistake in the design file. Pick the closest existing utility from Tailwind or consult with our designers.

```vue
<!-- Good ✅ -->
<button class="h-32" />

<!-- Bad 🚫 -->
<button class="h-[32px]" />
```

### Use `data-` for variants.

When needing to support multiple visual variants in one component, prefer using `data` attributes and selectors matching those attributes for a performant, HTML-native solution. Avoid applying styles conditionally, as this is usually slower.

Learn more: [Hover, focus, and other states - Core concepts](https://tailwindcss.com/docs/hover-focus-and-other-states#data-attributes)

```vue
<!-- Good ✅ -->
<button
  data-variant="primary"
  class="h-32 data-[variant=primary]:bg-blue data-[variant=primary]:text-white"
/>

<!-- Bad 🚫 -->
<button class="h-32" :class="{ 'bg-blue text-white': primary }" />
```

### Avoid `@apply`.

`@apply` can be a valid tool to use Tailwind utilities in CSS classes. But it is meant as an escape hatch when regular Tailwind utilities don't work for whatever reason. ["Don't use @apply just to make things look 'cleaner'"](https://tailwindcss.com/docs/reusing-styles#avoiding-premature-abstraction). Valid uses include CSS transitions (which depend on specific class names) and native `@scope` blocks where Tailwind utilities can't be applied directly.

### Import dependencies as layers.

When using third party CSS, import them as [CSS layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer). CSS layers provide a clear and structured way to manage the cascade, ensuring styles from different sources are applied in the desired order without relying solely on specificity and source order. This makes dependency management more predictable and maintainable.

```css
/* Good ✅ */
@import "some-3rd-party-css.css" @layer (layerName);

/* Bad 🚫 */
@import "some-3rd-party-css.css";
```

### Do not use `!important`.

Using `!important` in CSS, especially with frameworks like Tailwind, can lead to specificity conflicts and make it difficult to override styles when necessary, which can degrade maintainability and lead to unexpected behavior.

### Prefer `rem` over pixel values.

Pixel values don't scale proportionally when users zoom or customize their font sizes, leading to accessibility issues. Always use relative units — usually `rem`, but depending on the context `em`, `ch`, or container and viewport units might also make sense. Do not use `px`, unless something really should be a fixed size under all circumstances (e.g. a `1px` border).

```css
/* Good ✅ */
.control {
  font-size: 1rem;
  border: 1px solid black;
}

/* Bad 🚫 */
.control {
  font-size: 16px;
}
```

## Accessibility

### Avoid ARIA labels.

Avoid using ARIA labels because they can complicate accessibility if not used correctly. Instead, use semantic HTML elements and attributes to ensure proper accessibility and meaningful structure. If the design doesn't include a label (e.g. for an icon-only button), consider using [Tailwind's `sr-only`](https://tailwindcss.com/docs/screen-readers#screen-reader-only-elements).

Learn more: [Bad ARIA practices](https://www.accessibility-developer-guide.com/knowledge/aria/bad-practices/#adding-missing-labels)

```html
<button>
  <svg><!-- Some icon --></svg>
  <span class="sr-only">Accessible but invisible label</span>
</button>
```

## Testing

### All components must be tested. Keep tests next to components.

Every component needs to have an accompanying unit test that covers its functionality. Test files should be placed in the same folder as the component. The naming convention for tests is `[ComponentName].spec.ts`. Components inside of the `views/` folder are exempt from this rule.

Each test file must have a top-level `describe` block whose name matches the filename without the extension.

```
// for components/controls/Pagination.vue:

// Good ✅
components/controls/Pagination.spec.ts
→ describe("Pagination", () => { ... })

// Bad 🚫
tests/components/controls/Pagination.spec.ts
components/controls/Pagination.test.ts
describe("Pagination component", () => { ... })
describe("pagination", () => { ... })
```

### Views must be E2E tested.

We don't unit test views because of the complexity of the setup. Views instead must be covered by E2E tests.

### E2E tests related to stories must be tagged with the ticket number.

**Note:** This only applies to contract-relevant E2E tests.

When writing tests for covering requirements of a user story or a bug, add the ticket number as a tag. Our testers will use this information to determine which parts of a story have been covered by automated testing, and which aspects they need to test manually. Unlike commits, you don't need to add a default tag like `@RISDEV-0000` if there is no ticket.

If you extend an already existing, tagged test, add an additional tag to the list.

```ts
// Good ✅
test.describe("some test", { tag: ["@RISDEV-4711"] }, () => {
  /*...*/
});

// Good ✅
test.describe("some test", { tag: ["@RISDEV-4711", "@RISDEV-4712"] }, () => {
  /*...*/
});
```

### Use the recommended order for element queries in tests.

When querying elements in E2E tests and unit tests, follow the philosophy of Testing Library and Playwright:

> ["The more your tests resemble the way your software is used, the more confidence they can give you."](https://twitter.com/kentcdodds/status/977018512689455106)

This means you should query elements similar to how a user would, by using queries according to the following order:

1. Accessible (e.g. by role, label text)
2. Semantic (e.g. by alt text and title)
3. Test IDs only if there is no other way.

Learn more for [Testing Library](https://testing-library.com/docs/queries/about#priority) (unit tests) and [Playwright](https://playwright.dev/docs/locators#quick-guide) (E2E tests).

### Use specific queries. Avoid `locator` and `querySelector`.

Avoid using Playwright's `locator` and the DOM API `querySelector` because they can lead to brittle tests that are tightly coupled to the implementation details. Instead, use higher-level selectors or test IDs to create more robust and maintainable tests that better reflect user interactions.

```ts
// Good ✅
page.getByText("foo");

// Good ✅
screen.getByRole("button", { name: "Foo" });

// Bad 🚫
page.locator("text=foo");

// Bad 🚫
container.querySelector("button");
```

### Consider keeping E2E tests small & focused.

Smaller tests are easier to read, and they're easier to debug as they fail faster and it's more clear what went wrong. You can group tests using `test.describe()`. You can also create a shared page to keep context between different tests.

Note that this comes with a performance penalty because setting up the context for a large number of tests is costly. In addition, this can create an undesirable dependency between tests. For this reason it can also make sense to write larger tests. Use your gesunder Menschenverstand.

```ts
test.describe("a flow I want to test", () => {
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    // additional preparation
  });

  test("first step", () => {
    sharedPage.doSomething();
  });

  test("second step", () => {
    sharedPage.doSomething();
  });
});
```

### Don't re-declare locators in E2E tests.

Locators are evaluated dynamically and repeatedly whenever they are accessed. So use them like this:

```ts
// Good ✅
const myThing = page.getAllByRole("textbox");
await expect(myThing).toHaveCount(2);
// delete one of the things
await expect(myThing).toHaveCount(1);

// Bad 🚫
let myThing = page.getAllByRole("textbox");
await expect(myThing).toHaveCount(2);
// delete one of the things
myThing = page.getAllByRole("textbox");
await expect(myThing).toHaveCount(1);
```

### Be mindful of race conditions in E2E tests.

Be mindful of race conditions in tests. Race conditions are what causes flaky tests. Common sources of race conditions are: API requests, promises, timeouts, etc. There are ways of telling Playwright to [wait for events](https://playwright.dev/docs/events#waiting-for-event) to happen before continuing.

For example: Say you have a page with a form. You want to change values in the form, press save, reload the page, and assert that the values are still the values you saved. If you reload immediately after pressing save, you got yourself a race condition: the test only succeeds if the save request is faster than the reload. The solution is to use [`waitForResponse`](https://playwright.dev/docs/api/class-page#page-wait-for-response) between saving and reloading to ensure the changes have been persisted.

### Don't use manual assertions.

Don't use manual assertions that are not awaiting the expect. In the code below the await is inside the expect rather than before it. When using assertions such as `isVisible()` the test won't wait a single second, it will just check the locator is there and return immediately.

```ts
// 👎
expect(await page.getByText("welcome").isVisible()).toBe(true);
```

Use web first assertions such as `toBeVisible()` instead.

```ts
// 👍
await expect(page.getByText("welcome")).toBeVisible();
```

## Documentation

### Follow our code documentation guidelines.

Learn more: [Dokumentation von Quellcode](https://ris-reports.prod.ds4g.net/operative_dokumentation/entwicklungshandbuch/richtlinien/dokumentation_von_quellcode/)
