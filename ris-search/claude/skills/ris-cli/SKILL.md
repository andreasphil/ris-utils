---
name: ris-cli
description: >-
  Query German federal law with the `ris` command line client for the RIS API
  (rechtsinformationen.bund.de) — legislation (Gesetze), court decisions
  (Rechtsprechung), legal literature and administrative directives. Use when a task
  needs the text, metadata, XML or HTML of a German federal law or court ruling,
  when resolving an ELI or a law abbreviation such as BGB or IVSG, when searching
  case law by court, file number or ECLI, or whenever a `ris` command appears in
  the conversation.
---

# ris — command line client for the RIS API

`ris` queries the RIS API (rechtsinformationen.bund.de): German federal
legislation, court decisions, literature and administrative directives. It exists so
you do not have to remember endpoint paths, assemble nine-segment ELIs by hand, or
retype base URLs and credentials.

Every API endpoint behind this CLI is a GET. Nothing you run through `ris` can
change legal data — the only commands that write anything are `ris config set`,
`ris config use` and `ris skill install/update`, which touch local files.

## Rules

- **Never switch or edit the user's profile.** Do not run `ris config use` or
  `ris config set`, and do not edit `~/.config/ris-cli/config.json`. Which
  environment is the default is the user's decision, and changing it silently
  redirects every later command — including the user's own. `ris config list`,
  `ris config show`, `ris config path` and `ris config check` are read-only and
  fine to run.
- **Need a different environment? Do it per command.** Pass `--profile <name>` on
  that one invocation, and say in your answer which one you used. If the user seems
  to want a different default, tell them the command (`ris config use <name>`) and
  let them run it.
- **Never put a secret on the command line.** Credentials come only from the
  profile, as 1Password references — there is no flag and no environment variable
  that takes one. Do not echo credentials into your answer, and do not write them to
  a file.
- **Diagnose connection failures, do not work around them.** The fallback target is
  `http://localhost:8080`, so "connection refused" usually means no default profile
  is set and no local backend is running. Report that and suggest
  `--profile testphase` for a public instance — do not change the default.
- **Keep result sets small.** Each command fetches one page. Prefer `--size` with a
  small number while exploring, and page through with `--page` only if you must.
- **Check before you claim.** If a command exits non-zero, say so and show the
  error; do not present a guessed document number, ELI or citation as if it came
  from the API.

## Concepts

### Four document kinds, one set of verbs

`case-law` (`cl`), `legislation` (`leg`), `literature` (`lit`) and
`directive` (`ad`) all support `search`, `lucene`, `get`, `xml`, `html`
and `changelog`; legislation and case law add a few of their own. Learning one
kind teaches the other three. `ris search` and `ris lucene` search across all
four at once.

### Where flags go

Flags belong to the command they follow, so put them after the full subcommand
path: `ris leg toc IVSG --profile testphase`, **not**
`ris --profile testphase leg toc IVSG` — the latter fails with
"Unknown command testphase".

### Which API gets queried

Profiles are the only source of URLs and credentials. `--profile <name>` picks one
for a single command; otherwise the config file's default profile applies, falling
back to `http://localhost:8080` when none is set. Built-in profiles are `local`,
`staging` and `testphase`. `ris config list` shows what is configured and which
is the default; `ris config check` verifies that a profile's URL and credentials
actually work.

### Addressing a document

- **Case law, literature, directives:** a document number, e.g. `STRE201770751`.
- **Legislation:** an ELI at work, expression or manifestation level, with or
  without the `eli/` prefix, or a URL pasted from the browser or an API response —
  all are accepted anywhere an ELI is taken.
- **Legislation by name:** a non-ELI argument is resolved as an abbreviation
  (`ris leg html IVSG`), picking the version most relevant today. Override the
  date with `--on-date YYYY-MM-DD`.
- `ris legislation versions` lists every expression of a law; `ris legislation toc`
  lists article eIds, which is where the argument for `ris legislation article`
  comes from.

### Output

- `-o json|table` — a table on a terminal, JSON when piped. Piping into `jq`
  therefore already gives you JSON; use it to pull out single values.
- Tables unwrap the Hydra envelope, so rows are documents rather than
  `member[].item` nesting. JSON keeps the envelope, so `view.next` and
  `totalItems` tell you whether more pages exist.
- Everything goes to stdout, so the shell decides where it lands: redirect with
  `> file` to save XML, HTML or a ZIP. Binary commands (`zip`, `resource`) refuse
  to run into a bare terminal, so always redirect or pipe those.
- Diagnostics — row counts, pagination hints, `No results.` — go to stderr, so
  stdout stays pipeable and empty when there is nothing to report.
- `--dry-run` prints the equivalent `curl` command instead of sending it — useful
  to show the user what a command would do.

### Filters

Search flags combine as AND. Multi-value filters — `--type`, `--type-group` — may
be repeated or given as one comma-separated value; both mean the same thing. Dates
are `YYYY-MM-DD`. When a plain search returns too much, reach for `lucene`, which
takes field queries such as `courtName:"BGH Karlsruhe" AND date:[2020 TO 2024]`.

### Exit codes

`0` success · `1` the CLI could not run (bad flags, unreachable host) · `2` the
API rejected the request (404, 422, …). Diagnostics go to stderr, data to stdout.

## Command surface

Run `ris <command> --help` for the full description of any command and its flags.

### Global flags

Accepted by every command that talks to the API:

- `--dry-run` — Print the equivalent curl command and exit
- `--output, -o=json|table` — Output format (default: table on a TTY, else json)
- `--profile, -p <name>` — Named profile from the config file, providing the URL and credentials
- `--timeout <value>` — Request timeout in seconds (default: 30)
- `--verbose, -v` — Log requests to stderr

### Search flags

Listed below as "search flags" wherever a command accepts them:

- `--from <value>` — Only documents dated on or after this date (YYYY-MM-DD)
- `--page <value>` — Page index, 0-based (default: 0)
- `--size <value>` — Results per page, 1-300 (default: 100)
- `--sort <field>` — Sort field; prefix with - for descending, e.g. -date
- `--to <value>` — Only documents dated on or before this date (YYYY-MM-DD)

### Top level

- `ris search [terms]` — Search across every document kind (case law, legislation, literature, directives)
  Flags: `--most-relevant-on <date>`, search flags
- `ris lucene <query>` — Search across every document kind using Lucene query syntax
  Flags: `--page <value>`, `--size <value>`, `--sort <field>`
- `ris stats` — Document counts per kind
- `ris bulk-links` — Download URLs for the bulk ZIP archives of each document kind

### `ris case-law` (cl) — Court decisions (Rechtsprechung)

- `ris case-law search [terms]` — List and search court decisions
  Flags: `--court <value>`, `--ecli <value>`, `--file-number <value>`, `--legal-effect=JA|NEIN|KEINE_ANGABE|FALSCHE_ANGABE`, `--type <value>`, `--type-group <value>`, search flags
- `ris case-law lucene <query>` — Search court decisions using Lucene query syntax
  Flags: `--page <value>`, `--size <value>`, `--sort <field>`
- `ris case-law get <documentNumber>` — Court decision metadata as JSON
- `ris case-law xml <documentNumber>` — Court decision as XML
- `ris case-law html <documentNumber>` — Court decision as HTML
- `ris case-law zip <documentNumber>` — Decision as a ZIP archive (XML plus attachments)
- `ris case-law resource <documentNumber> <filename>` — An image or other file embedded in a decision
- `ris case-law courts [prefix]` — Courts that have decisions in the database, with decision counts
- `ris case-law changelog` — Documents added, changed or deleted in a time window (default: last 24h)
  Flags: `--from <value>`, `--to <value>`

### `ris legislation` (leg) — Laws and decrees (Gesetze)

- `ris legislation search [terms]` — List and search legislation
  Flags: `--abbreviation <value>`, `--eli <value>`, `--in-force-on <date>`, `--most-relevant-on <date>`, `--ris-abbreviation <value>`, `--temporal-from <date>`, `--temporal-to <date>`, search flags
- `ris legislation lucene <query>` — Search legislation using Lucene query syntax
  Flags: `--page <value>`, `--size <value>`, `--sort <field>`
- `ris legislation get <eli>` — Expression-level metadata
  Flags: `--on-date <date>`
- `ris legislation versions <eli>` — Every expression (version) of a piece of legislation
- `ris legislation toc <eli>` — Table of contents, with the article eIds needed by `article`
  Flags: `--on-date <value>`
- `ris legislation xml <eli>` — Legislation text as XML, resolving the manifestation automatically
  Flags: `--on-date <date>`
- `ris legislation html <eli>` — Legislation text as HTML, resolving the manifestation automatically
  Flags: `--on-date <date>`
- `ris legislation article <eli> <articleEid>` — A single article (§) as HTML
  Flags: `--on-date <value>`
- `ris legislation zip <eli>` — Manifestation as a ZIP archive (XML plus attachments)
  Flags: `--on-date <value>`
- `ris legislation resource <eli> <filename>` — A file (PDF, image, XML) inside a manifestation
- `ris legislation translations [id]` — English translations of selected legislation
  Flags: `--filename <name>`
- `ris legislation changelog` — Documents added, changed or deleted in a time window (default: last 24h)
  Flags: `--from <value>`, `--to <value>`

### `ris literature` (lit) — Legal literature (Literatur)

- `ris literature search [terms]` — List and search literature
  Flags: `--author <value>`, `--collaborator <value>`, `--document-number <value>`, `--type <value>`, `--year <value>`, search flags
- `ris literature lucene <query>` — Search literature using Lucene query syntax
  Flags: `--page <value>`, `--size <value>`, `--sort <field>`
- `ris literature get <documentNumber>` — Literature item metadata as JSON
- `ris literature xml <documentNumber>` — Literature item as XML
- `ris literature html <documentNumber>` — Literature item as HTML
- `ris literature changelog` — Documents added, changed or deleted in a time window (default: last 24h)
  Flags: `--from <value>`, `--to <value>`

### `ris directive` (ad) — Administrative directives (Verwaltungsvorschriften)

- `ris directive search [terms]` — List and search administrative directives
  Flags: `--document-number <value>`, search flags
- `ris directive lucene <query>` — Search administrative directives using Lucene query syntax
  Flags: `--page <value>`, `--size <value>`, `--sort <field>`
- `ris directive get <documentNumber>` — Administrative directive metadata as JSON
- `ris directive xml <documentNumber>` — Administrative directive as XML
- `ris directive html <documentNumber>` — Administrative directive as HTML
- `ris directive changelog` — Documents added, changed or deleted in a time window (default: last 24h)
  Flags: `--from <value>`, `--to <value>`

### `ris config` — Manage API URLs and credentials

- `ris config list` — Show all profiles and which one is the default
- `ris config show [profile]` — Show one profile as JSON
- `ris config set <profile>` — Create or update a profile (secrets are stored as 1Password references)
  Flags: `--api-key-ref <op://…>`, `--clear-auth`, `--password-ref <op://…>`, `--url <url>`, `--user <value>`
- `ris config use <profile>` — Set the default profile
- `ris config path` — Print the config file location
- `ris config check [profile]` — Verify that the resolved URL and credentials actually work

### `ris skill` — Install this CLI's usage guide as an agent skill (Claude Code and friends)

- `ris skill install` — Write ris-cli/SKILL.md, failing if it already exists
  Flags: `--target <dir>`
- `ris skill update` — Regenerate ris-cli/SKILL.md, overwriting an existing one
  Flags: `--target <dir>`

## Recipes

```sh
ris stats                                   # document counts per kind
ris search "Mietrecht Kündigung" --size 5   # across all kinds
ris case-law search --court BGH --from 2024-01-01 --size 5
ris cl lucene 'courtName:"BGH Karlsruhe" AND date:[2020 TO 2024]'
ris cl get STRE201770751 | jq -r .headline  # one field of one decision
ris leg html IVSG                           # current consolidated text
ris leg toc IVSG                            # article eIds
ris leg article IVSG hauptteil-1_art-1      # one article; eId comes from `toc`
ris cl changelog --from 2026-01-01          # what changed since then
ris cl courts BGH                           # courts matching a prefix
```

---

Generated from ris 0.1.0 by `ris skill install`. After upgrading the CLI, run
`ris skill update` to regenerate this file — do not edit it by hand.
