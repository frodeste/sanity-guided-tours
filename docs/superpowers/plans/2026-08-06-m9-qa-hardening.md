# M9 — QA Hardening: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every change — PR or release — is verified automatically: enforced coverage floor, code-health checks, type-export soundness, and merge blocked on red CI (issues #134–#138). Research and evidence: `.superpowers/sdd/qa-research.md`.

**Findings that shape the plan (verified 2026-08-06):**
- Ruleset `protect-main` (20387420) has NO `required_status_checks` rule — red CI does not block merges today. GitHub Actions `integration_id` is 15368 (read from this repo's check-run data).
- `pkg-utils build --check` already runs publint; `plugin-kit verify-package` already runs twice. Sanity ships no further automated plugin-qualification suite (Exchange review is human) — issue #136 documents this; attw is the one real gap.
- Bun 1.3 coverage reports lines+functions only (no branches — oven-sh/bun#7100); a threshold makes `bun test` exit non-zero. Baseline: 94.15% funcs / 95.01% lines; weak files `src/schema/elements/previewHelpers.ts` (50/22.7) and `src/studio/useUploader.ts` (50/75).

## Global Constraints

All accumulated constraints hold (memory `guided-tours-m1-execution-facts`). Additions:
- No new SaaS accounts, secrets, or upload steps — all checks run headless in Actions. Coverage lcov is an artifact/summary, not an upload.
- The `build` script literal stays untouched. No lifecycle hooks. Release stays `workflow_dispatch`-only and owner-gated — this milestone changes what release.yml VERIFIES, never when it runs.
- Do not make `claude-review` a required check (advisory, skips drafts).

### Task 1: Coverage floor + weak-file tests + attw + shared release gates (#134, #136, #138)

**Files:** `bunfig.toml` (`[test]`: coverage on, reporters text+lcov, `coverageSkipTestFiles = true`, `coveragePathIgnorePatterns` for `scripts/**` + `seed/**` + test-support, threshold lines/functions only); new tests for `previewHelpers.ts` and `useUploader.ts` (lift both files to ≥90/≥90 where practical — read what each does first; pure logic paths preferred over UI scaffolding); `.github/workflows/gates.yml` (new reusable `workflow_call` running the full gate sequence: install → lint → typecheck → build → `bun test --coverage` → attw `--pack . --profile esm-only` → verify-package → example builds/typechecks/export, preserving current ci.yml step order incl. build-before-test); `ci.yml` (calls the reusable workflow; job/check names MUST keep producing a stable context — record the final check name for Task 3); `release.yml` (calls the same reusable workflow, then semantic-release; dispatch trigger and concurrency group unchanged).

Threshold: set to measured-baseline-minus-~1pt AFTER the new tests land (expect ≥0.93/0.93; record actuals). Coverage summary appended to `$GITHUB_STEP_SUMMARY`.

- [ ] TDD the weak files → wire coverage + workflows → gates green locally (incl. act-free reproduction: run each new command) → commit `feat: enforce coverage floor and full release gates`

### Task 2: Code-health `quality` job (#135)

**Files:** `ci.yml` (new `quality` job parallel to the gates job — no build needed), `knip.json`/`knip` config (entry points from the exports map + example apps as workspaces; triage findings — genuinely dead code gets DELETED, false positives get targeted ignores with a comment why), jscpd config if needed (`.jscpd.json`: report to `$GITHUB_STEP_SUMMARY`, informational).

Commands: `bunx knip --reporter compact` (gating), `bunx madge --circular --extensions ts,tsx src` (gating), jscpd markdown → step summary (non-gating). Record every knip deletion in the report — anything ambiguous (looks dead but might be deliberate public API) is a PARKED finding for the controller, not a silent deletion.

- [ ] Triage → implement → green → commit `feat: code-health checks in CI`

### Controller (post-merge, no PR): Ruleset required checks (#137)

Apply the ruleset PUT from the research doc: require the Task 1 check context + `Conventional Commit title` (integration_id 15368, `strict_required_status_checks_policy: true`); after `quality` is green on main, add it too. Verify by reading the ruleset back.

- [ ] PUT ruleset → verify → close #137

## PR grouping

| PR | Tasks | Closes |
|---|---|---|
| feat: QA hardening — coverage floor, release gates, code health | 1, 2 (+ this plan doc) | #134 #135 #136 #138 |

#137 closes via the controller config step after merge.

## Verification

CI on the PR itself proves the gates (coverage threshold active, attw, quality job). Post-merge: ruleset read-back shows required checks; a deliberate no-op check is NOT performed against main (never push test commits to main).
