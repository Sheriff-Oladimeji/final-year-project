# Prompt evals

Automated checks for the tutor prompts in `src/lib/gemini/prompts.ts`, built with
[promptfoo](https://promptfoo.dev). Every prompt function imports and calls the
real exported templates — this tests exactly what ships, not a hand-copied stand-in.

## What's covered

- **`grading.yaml`** — `CLASSIFY_CHECK_TEMPLATE`. The adaptive-grading claim: does
  it reward own-words/own-analogy answers, and still catch real misunderstanding
  even when the right vocabulary is present.
- **`intent.yaml`** — `INTENT_CLASSIFIER_TEMPLATE`. Includes a real garbled,
  typo-heavy reply (matching actual usability-tester phrasing) that mixes an
  attempt with a confused follow-up question.
- **`formatting.yaml`** — `buildFormattingRules()`. The "explain and break it
  down clearly" claim: lead sentence → analogy → structured breakdown, never a
  textbook paragraph with the breakdown bolted on at the end. Checked two ways —
  deterministic regex assertions (`assertions/checks.js`) for the mechanical
  stuff (bold terms, no filler, analogy-before-list ordering), and an
  `llm-rubric` for the fuzzier "does this actually read clearly" quality.

## Running

```bash
npm run eval:grading      # just the grading suite
npm run eval:intent       # just the intent-classification suite
npm run eval:formatting   # just the formatting suite
npm run eval:prompts      # all three, in sequence
npm run eval:view         # open the local results browser after a run
```

Each `eval:*` script recompiles the four TS files these evals depend on
(`prompts.ts` plus the three `prompts/*.ts` wrappers) to plain JS first — see
"Why compiled JS" below — then runs promptfoo against `gemini-2.5-flash`,
reading `GEMINI_API_KEY` from `../.env`.

## Known environment quirks (already worked around here, documented in case they resurface)

- **Node version**: `promptfoo@latest` currently requires Node `>=22.22.0`.
  These scripts pin `promptfoo@0.120.0`, which only requires `>=20.0.0`. If you
  upgrade Node past 22.22, feel free to bump the pin back to `@latest`.
- **`--import tsx` breaks promptfoo's own bundled asset resolution** — it made
  promptfoo unable to find its own SQLite migration files. That's why the
  eval prompt files are precompiled to plain CommonJS (`eval:compile`, output
  in the gitignored `evals/.compiled/`) instead of loaded live via a TS loader.
  `prompts.ts` has zero external imports, so this compiles cleanly with a bare
  `tsc` invocation — no project tsconfig needed.
- **A broken `promptfoo@0.120.0` npm package**: this specific published build
  looks for its migrations folder at `promptfoo/drizzle`, but the files
  actually ship at `promptfoo/dist/drizzle` — a real packaging bug in that
  version. Worked around locally with a symlink in the npx cache directory
  (`~/.npm/_npx/.../node_modules/promptfoo/drizzle -> dist/drizzle`). This is
  outside the repo and machine-specific — if a fresh `npx` cache hits the same
  bug on another machine, re-run the symlink fix, or just try a different
  0.12x.x version.
- **Isolated promptfoo state**: `PROMPTFOO_CONFIG_DIR` is pointed at
  `evals/.promptfoo-state` (gitignored) so this doesn't touch or get confused
  by any other `~/.promptfoo` state from unrelated projects on the same
  machine.

## Verified but not yet run to completion

The harness is fully wired — confirmed by running `npm run eval:grading`,
which correctly compiled the prompts, loaded all 5 test cases, and made a real
call to the Gemini API before failing. The failure was Gemini's own
`"User location is not supported for the API use"` (`FAILED_PRECONDITION`)
error — reproduced with a bare `curl` to
`generativelanguage.googleapis.com` using the same key, with promptfoo
completely out of the picture. That's a Google-side geographic restriction on
whatever network this was run from, unrelated to promptfoo, the prompts, or
this config. Run `npm run eval:prompts` from a machine/network where the app
already works (i.e. wherever `npm run dev` successfully gets real answers out
of the chat) and it should run end-to-end.
