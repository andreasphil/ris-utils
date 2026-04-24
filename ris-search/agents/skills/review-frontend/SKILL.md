---
name: review-frontend
description: First-pass code review of frontend code against the project's frontend conventions. Defaults to files changed on the current branch. Can target a PR number or specific files.
---

You are performing a first-pass code review against the frontend conventions defined in `.agents/skills/review-frontend/frontend-conventions.md`. Read that file now before doing anything else.

## Determining scope

The user may invoke this skill with an argument:

- **No argument** — review all frontend files changed on the current branch vs. `main`:

  ```
  git diff main...HEAD --name-only -- 'frontend/src/**'
  ```

- **PR number** (e.g. `review-frontend 123`) — fetch the changed files from that PR using the GitHub CLI:

  ```
  gh pr diff 123 --name-only
  ```

  Then filter to files under `frontend/src/`.
- **File path(s)** (e.g. `review-frontend src/components/Foo.vue`) — review exactly those files.

If the resolved file list is empty, tell the user and stop.

## Performing the review

For each file in scope:

1. Read the file.
2. Check it against every applicable convention. Not all conventions apply to every file type — use judgement:
   - `.vue` components → Vue/TypeScript, Security, Tailwind, Accessibility conventions
   - `.spec.ts` unit tests → Testing conventions (unit test rules)
   - `e2e/**/*.spec.ts` E2E tests → Testing conventions (E2E rules)
   - `.css` / `<style>` blocks → Tailwind, CSS conventions
3. For each violation found, record:
   - **File** and **line number** (or line range)
   - **Convention** that is violated (use the section heading from the conventions doc)
   - **What the code does** vs. **what it should do** — one concise sentence each
   - **Severity**: `error` (clear violation) or `warning` (judgement call / borderline)

## Output format

Group findings by file. For each file, list violations as a numbered list. If a file has no issues, omit it (don't list it as "clean" — only mention it if asked).

Example output shape:

```
### src/components/Foo.vue

1. [error] **Avoid calling functions in templates** (line 42)
   `formatDate(item.date)` is called directly in the template. Move to a `computed` property instead.

2. [warning] **Use `ris-` typography utilities** (line 17)
   Uses `text-sm font-bold` — prefer a `ris-label*` utility if one matches the intended style.
```

After listing all findings, print a one-line summary: `X error(s), Y warning(s) across Z file(s).`

Then ask: "Would you like me to fix any of these?"

## Important constraints

- **Flag issues only** during the review. Do not think about or draft fixes while reviewing — that comes after, only if the user asks.
- Do not comment on things the conventions do not cover.
- Do not flag third-party or generated files (e.g. `node_modules`, `.nuxt`, auto-generated types).
