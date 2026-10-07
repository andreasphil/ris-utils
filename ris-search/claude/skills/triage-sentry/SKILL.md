---
name: triage-sentry
description: Triage all open Sentry issues of ris-search for the maintainer shift and write an HTML report with a summary, bug / huh / noise groups, a recommendation per issue, and links to Sentry. Read-only, it changes nothing in Sentry. Use when asked to triage Sentry, check open Sentry issues, or do the Sentry part of the maintainer shift.
---

## What I do

I get all unresolved issues with the `sentry` CLI, triage each one with the team's process below, and write an HTML report. I don't archive, merge, resolve or link anything. The maintainer does that in Sentry, based on the report.

## The team's Sentry process

**What Sentry is for:** unexpected, unhandled runtime errors that can affect users. Examples: illegal property access when types don't match real data, unhandled edge cases, cross-browser bugs.

**What it is not for:** errors during normal operation. This includes input validation errors, 4xx HTTP errors, timeouts and aborted requests or other network problems, uptime and infrastructure, logging below error level, and data quality issues. Don't overthink borderline cases. The goal is to notice errors we would have missed, not a perfectly tidy list.

**Categories:**

- **noise**: it shouldn't be in Sentry, or there's nothing to act on (wrong logging, temporary downtime, etc.). Recommend preventing it from being logged again when that's cheap, otherwise archive.
- **bug**: something is broken. Recommend a Jira ticket created via the Sentry integration (component `Portal`, fix version = current EA, status "Ready for development"), or linking an existing ticket.
- **huh**: unclear what it means, but the app is up. Recommend checking with the other devs.
- **emergency**: it looks like many users are affected. Recommend a bug ticket, a post in the team channel, and a team decision on next steps.

**Handling rules for the recommendations:**

- Default: archive *until escalating*. If it was a fluke, archive *for…*, *until this occurs again*, or *until it affects N more users*.
- Don't resolve during triage. Resolve only after a code fix, and reference the commit.
- **Regressed** issues were fixed before and came back. Treat them with higher priority. The activity feed shows the earlier tickets and commits.
- Merge only near-identical issues (same error, small stack trace differences), never issues that are only related.
- If a fix takes about 15 minutes or less, say so.
- Traceability: every action should be explainable from the Sentry issue itself (a linked ticket, a commit, or a comment).

Where the error happened: Java = backend, Node = Nuxt server, a browser and OS = Nuxt client.

## Step 1: Get the issues

```bash
sentry issue list digitalservice/ris-search --query "is:unresolved" --period 90d --limit 100 --json
```

The output is `{ data: [...], hasMore }`. Useful fields: `id`, `shortId`, `title`, `culprit`, `count`, `userCount`, `firstSeen`, `lastSeen`, `substatus` (`new`, `ongoing`, `escalating`, `regressed`), `platform`. The issue link is `https://digitalservice.sentry.io/issues/<id>/`.

If the CLI fails with `unable to open database file`, the sandbox is blocking its local state. Run it outside the sandbox.

## Step 2: Triage

Most issues can be categorized from the title, culprit, platform and timing. Look for clusters, for example many issues with the same root cause in the same time window (an outage, an OOM). For unclear issues, run `sentry issue view <shortId>` to see the stack trace, browser, environment and request URL. A quick look at the culprit file in the repo is fine. Keep it shallow: 1–2 sentences per issue or cluster are enough.

Note the environment from the request URL (testphase = production, staging, UAT). Errors that only occur in staging or UAT are more likely noise.

## Step 3: Write the report

Write `sentry-triage-<YYYY-MM-DD>.html` in the repo root (leave it untracked). It must be self-contained, readable, and have links. The visual design can vary between runs. Structure:

1. **Header**: date, number of unresolved issues, a link to the unresolved list in Sentry.
2. **Summary**: a few sentences on the overall picture. Always state whether any issues are **regressed** and whether any are an **emergency**, and give the count per category.
3. **Bug / Huh / Noise sections** (plus **Emergency** first, if there are any). Each row has the linked issue IDs (grouped when they are a cluster, with event counts and an escalating or regressed marker), what's going on, and the recommendation. Include merge suggestions.

Then tell the user the file path and give them `! open <file>` to view it, because the sandbox blocks `open`.
