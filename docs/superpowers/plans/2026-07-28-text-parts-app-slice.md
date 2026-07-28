# Text Parts App Slice Implementation Plan

> **For Codex:** Execute this plan with test-driven development. Do not commit or push.

**Goal:** Replace the app's default Part 4-only public fixture with a deterministic 193-question text-parts fixture covering Parts 1, 3, 4, 5, and 6, while preserving every existing Part 4 learning and personal-data workflow.

**Architecture:** Build a new working fixture from `full-import-v1` and `course-import-v1`, validate it at Python and Zod boundaries, and expose it through the existing read-only public-content repository. Generalize navigation, lists, detail, drafts, recall, answers, and review by stable `part` and `question_id`; retain the specialized Part 4 answer builder as a conditional experience.

**Tech Stack:** Python standard library, React, TypeScript, React Router Declarative, Zod, IndexedDB through `idb`, Vitest, React Testing Library, plain CSS.

---

### Task 1: Deterministic text-parts fixture

**Files:**
- Create: `scripts/build_text_parts_app_fixture.py`
- Create: `scripts/tests/test_build_text_parts_app_fixture.py`
- Create: `data/working/app-fixtures/text-parts-v1/*`
- Modify: `package.json`

**Steps:**
1. Write failing Python tests for exact counts, exclusions, reference integrity, empty ModelAnswer data, deterministic output, validate-only immutability, and source-data immutability.
2. Run the new tests and confirm failure before implementation.
3. Implement the builder with temporary-directory validation and atomic replacement.
4. Generate twice, validate only, and run the tests.

### Task 2: Runtime contract and repository

**Files:**
- Modify: `src/domain/validation.ts`
- Modify: `src/domain/entities.ts` only where an additive recall mode is required
- Modify: `src/data/fixtureLoader.ts`
- Modify: `src/data/publicContentRepository.ts`
- Modify/Create: relevant validation and repository tests

**Steps:**
1. Add failing tests for the 193-question schema and Part 1/3/4/5/6 catalog.
2. Add a `TextPartsFixture` Zod contract with exact part/count/reference validation.
3. Load the new fixture while preserving the two existing Part 4 fixture loaders.
4. Switch only the default public repository source to the new fixture.

### Task 3: Shared navigation, home, lists, and details

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/features/home/*`
- Modify: `src/features/part/*`
- Modify: `src/features/question/*`
- Modify: shared components/styles as needed
- Modify/Create: related component tests

**Steps:**
1. Add failing tests for enabled/disabled Part cards, exact counts, common routes, filters, random selection, navigation, and question detail.
2. Generalize `/parts/:part` and common text-question lookup.
3. Preserve the Part 4 structure and learning flow behind a Part 4 condition.
4. Show Parts 2 and 7 as disabled picture-question work.

### Task 4: Free-input drafting and recall for Parts 1, 3, 5, and 6

**Files:**
- Modify: `src/features/answer/*`
- Modify: `src/features/my-answers/*`
- Modify: `src/features/review/*`
- Modify: personal repository types/tests only if additive behavior is required

**Steps:**
1. Add failing tests for free-input draft save/update/delete/complete/restore and recall modes.
2. Add a non-Part-4 answer flow without translation, correction, pinyin generation, or answer synthesis.
3. Reuse existing PracticeDraft, ReusablePhrase, RecallAttempt, ReviewState, and last-location storage without renaming or deleting the IndexedDB.
4. Generalize My Answers and Review filters to all five text parts.
5. Run all existing Part 4 regression tests.

### Task 5: Documentation

**Files:**
- Create: `docs/TEXT_PARTS_APP_SLICE.md`
- Modify: `README.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/DATA_SCHEMA.md`
- Modify: `docs/SCHEMA_V1_SUMMARY.md`
- Modify: `docs/UI_SPEC.md`
- Modify: `docs/SCREEN_DATA_CONTRACT.md`
- Modify: `docs/NAVIGATION_FLOW.md`
- Modify: `docs/HIGH_SCORE_DATA_PLAN.md`

**Steps:**
1. Document fixture scope, Part 2/7 exclusion, common UI, Part 4 specialization, free-input policy, personal-data preservation, and ModelAnswer=0.
2. Record the unchanged IndexedDB name as intentional compatibility debt.
3. Keep review, AI, visual parts, backend, login, and deployment incomplete.

### Task 6: Verification and browser walkthrough

**Steps:**
1. Run the requested fixture commands and Python tests.
2. Run `npm run fixture:part4-full`, `npm run fixture:part4-review`, and `npm run check:data`.
3. Run typecheck, lint, Vitest, build, and `npm run check`.
4. Use a real browser to verify Home, all five Part lists/details, filtering, drafts for Parts 1/3/5/6, reload restoration, My Answers, Review, Part 4 regression, 320px layout, and console errors.
5. Confirm source JSON, existing fixtures, and personal-database identifiers remain intact.
6. Report exact results without committing or pushing.
