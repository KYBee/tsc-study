# Part 4 Local Review Workflow Implementation Plan

> **For Codex:** Execute this plan test-first. Do not commit or push. Do not create a real reviewed dataset without a user-exported decision file.

**Goal:** Add a local-only, deterministic human review workflow for the 50 Part 4 working Questions so only explicit, non-stale approvals can later be promoted to reviewed canonical JSON.

**Architecture:** A Python builder creates an immutable review fixture from the existing Part 4 working fixture. A separate IndexedDB database stores local review decisions, while strict Zod contracts govern decisions and browser import/export. A development-only React route presents the review UI without the learning bottom navigation. A Python promotion CLI consumes an exported decision file and atomically emits only eligible reviewed records.

**Tech Stack:** Python 3 standard library and unittest; React 19, TypeScript, React Router, idb, Zod, Vitest, React Testing Library, Playwright CLI for browser verification.

---

## Task 1: Establish baseline and review fixture contract

**Files:**

- Create: `scripts/tests/test_build_part4_review_fixture.py`
- Create: `scripts/build_part4_review_fixture.py`
- Generate: `data/working/review-fixtures/part4-v1/review-items.json`
- Generate: `data/working/review-fixtures/part4-v1/manifest.json`
- Generate: `data/working/review-fixtures/part4-v1/README.md`

**Steps:**

1. Run the existing data and app checks before editing.
2. Write failing unittest cases for 50 IDs, AnswerPoint 1:1, source-reference integrity, required fields, stable hashes, deterministic output, validate-only immutability, and protected working input hashes.
3. Run the new test and confirm it fails because the builder is missing.
4. Implement deterministic JSON hashing, review item assembly, validation, atomic publish, `--validate-only`, and `--output-dir`.
5. Run the fixture tests and both generation passes; compare all generated hashes.

## Task 2: Implement reviewed promotion gate

**Files:**

- Create: `scripts/tests/test_promote_part4_reviewed_data.py`
- Create: `scripts/promote_part4_reviewed_data.py`

**Steps:**

1. Write failing promotion tests for zero approvals, one valid approval, incomplete/needs-fix/deferred/stale/unknown/duplicate/invalid decisions, reference integrity, excluded reasons, deterministic output, validate-only immutability, source preservation, and failure rollback.
2. Run the tests and confirm the missing implementation failure.
3. Implement strict decision-file validation and eligibility classification.
4. Promote exact source Question/AnswerPoint content while setting only `Question.question_status = verified` and `AnswerPoint.point_status = reviewed`.
5. Preserve SourceReference verification claims unchanged, include only required Source and SourceReference records, and atomically publish.
6. Run all promotion tests using temporary synthetic decisions only.

## Task 3: Define browser review contracts and separate storage

**Files:**

- Modify: `src/domain/entities.ts`
- Create: `src/domain/dataReview.ts`
- Create: `src/domain/dataReview.test.ts`
- Create: `src/data/reviewFixtureLoader.ts`
- Create: `src/data/reviewIndexedDb.ts`
- Create: `src/data/reviewDecisionRepository.ts`
- Create: `src/data/reviewDecisionRepository.test.ts`

**Steps:**

1. Add failing tests for decision enum validation, overall-status consistency, stale detection, fixture integrity, separate DB naming, unique question upsert, persistence, reload, and reset.
2. Implement `Part4ReviewDecision`, fixture types, strict Zod schemas, and status calculation.
3. Implement the separate `tsc-study-data-review-v1` IndexedDB database and `part4ReviewDecisions` store.
4. Confirm no learning database schema or migration is changed.

## Task 4: Implement import/export preview contract

**Files:**

- Create: `src/features/data-review/reviewDecisionTransfer.ts`
- Create: `src/features/data-review/reviewDecisionTransfer.test.ts`

**Steps:**

1. Add failing tests for export envelope, valid import, invalid JSON, size/string/date constraints, unknown IDs, duplicates, identical/new/overwrite/stale/rejected classification.
2. Implement strict parsing and preview generation.
3. Implement browser download helpers without server calls.
4. Keep imported stale decisions visible but ineligible for promotion.

## Task 5: Build the local review route and screen

**Files:**

- Modify: `src/app/dependencies.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/AppShell.tsx`
- Create: `src/features/data-review/Part4DataReviewScreen.tsx`
- Create: `src/features/data-review/Part4DataReviewScreen.test.tsx`
- Modify: `src/styles/components.css`

**Steps:**

1. Add failing user-flow tests for the 50-item summary, filters, field decisions, bulk actions, note requirement, save/reload, stale display, next unreviewed, import preview/apply, export, reset confirmation, and absence of bottom navigation.
2. Extend dependencies with review fixture and decision repositories.
3. Add `/data-review/part4` as a local development tool route.
4. Hide the learning bottom navigation on the review route and display a clear local data-review warning.
5. Implement responsive list/detail review UX and promotion-eligible preview without editing source content.
6. Run focused Vitest tests and resolve failures without weakening existing tests.

## Task 6: Wire scripts and documentation

**Files:**

- Modify: `package.json`
- Create: `docs/PART4_REVIEW_WORKFLOW.md`
- Modify: `README.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/DATA_SCHEMA.md`
- Modify: `docs/SCHEMA_V1_SUMMARY.md`
- Modify: `docs/DATA_WORKFLOW.md`
- Modify: `docs/UI_SPEC.md`
- Modify: `docs/SCREEN_DATA_CONTRACT.md`
- Modify: `docs/NAVIGATION_FLOW.md`

**Steps:**

1. Add fixture, validation, and Python test scripts without removing existing scripts.
2. Add review fixture generation and validation to `npm run check`, but never execute promotion there.
3. Document the decision schema, separate review storage, import/export, stale handling, promotion gate, source-claim distinction, and unimplemented human review.
4. State explicitly that the learning app remains on the Part 4 working fixture.

## Task 7: Full verification and browser walkthrough

**Files:**

- Temporary only: synthetic review decision JSON under a temporary directory
- Do not create: `data/reviewed/part4-v1/`

**Steps:**

1. Run the review fixture builder twice and verify byte-identical hashes.
2. Run validate-only and both Python test modules.
3. Run `npm run check:data`, typecheck, lint, Vitest, build, and `npm run check`.
4. Use temporary synthetic decisions to exercise successful, blocked, stale, and deterministic promotion.
5. Start the dev server and use Playwright at 320px to verify the requested review flow, export/import, stale preview, learning-route isolation, and console errors.
6. Confirm `git status`, no commit/push, no real reviewed output, no changed working source content, no ModelAnswer, and no AI integration.
