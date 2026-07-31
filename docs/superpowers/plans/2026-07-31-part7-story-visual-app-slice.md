# Part 7 Story Visual App Slice Implementation Plan

> **For Codex:** Execute this plan task-by-task with test-driven development. Do not commit or push.

**Goal:** Connect the twelve raw Part 7 story-image sets to the local development app without creating canonical QuestionVisualSet relationships, ModelAnswers, generated language, or public image assets.

**Architecture:** Build a deterministic Part 7-only fixture from the existing working imports, validate it at Python and Zod boundaries, and load it beside the existing text and Part 2 fixtures. Reuse one development-only, allowlisted Vite image middleware for both visual parts. Extend the existing learning IndexedDB contract additively to `visual_set` targets and store only learner-authored story plans, answers, recall attempts, and review states.

**Tech Stack:** Python standard library, React, TypeScript, Vite, React Router Declarative mode, idb, Zod, Vitest, React Testing Library, Playwright CLI.

---

## Task 1: Part 7 deterministic fixture

**Files:**
- Create: `scripts/tests/test_build_part7_visual_app_fixture.py`
- Create: `scripts/build_part7_visual_app_fixture.py`
- Generate: `data/working/app-fixtures/part7-visual-v1/**`
- Modify: `package.json`

1. Add failing tests for exact entity counts, explicit StoryGuide-to-VisualSet integrity, zero canonical relations/ModelAnswers, twelve non-canonical candidates, rights preservation, source integrity, deterministic output, validate-only immutability, and protected-input hashes.
2. Run the new Python tests and confirm failure because the builder does not exist.
3. Implement the smallest deterministic builder by reusing the Part 2 fixture pattern.
4. Run the tests until green and generate the canonical working fixture twice.

## Task 2: Runtime fixture contract and repository

**Files:**
- Create: `src/domain/part7VisualValidation.test.ts`
- Modify: `src/domain/entities.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/data/fixtureLoader.ts`
- Modify: `src/domain/repositories.ts`
- Modify: `src/data/publicContentRepository.ts`
- Modify: `src/data/publicContentRepository.test.ts`

1. Add failing validation/repository tests for twelve story sets, StoryGuides, Part 7 Questions, non-canonical candidates, zero ModelAnswers, and source integrity.
2. Add `Part7VisualFixture` schemas and relationship-candidate types without altering the canonical relationship types.
3. Load the fixture and expose explicit StoryGuide/candidate/common-instruction queries.
4. Keep Part 2 and text repository contracts green.

## Task 3: Common secure local image boundary

**Files:**
- Create: `src/data/localVisualAssetUrl.test.ts`
- Create: `src/data/localVisualAssetUrl.ts`
- Create or rename: `viteLocalVisualAssets.ts`
- Modify: `vite.config.ts`
- Modify: `src/features/part2/Part2VisualImage.tsx`
- Create: `scripts/validate_local_visual_assets.py`
- Modify: `scripts/validate_part2_local_assets.py`
- Create: `scripts/validate_part7_local_assets.py`
- Modify: `package.json`

1. Add failing tests for Part 2/7 registered IDs, development-only URLs, and unsafe/right-status rejection.
2. Generalize the middleware to a combined fixture allowlist and retain the legacy Part 2 URL alias.
3. Verify real path, symlink containment, MIME/extension, file size, and SHA-256 before serving.
4. Add shared Python asset validation while retaining old package-script compatibility.

## Task 4: IndexedDB v5 and story personal data

**Files:**
- Modify: `src/domain/entities.ts`
- Modify: `src/data/indexedDb.ts`
- Modify: `src/data/userDataRepository.ts`
- Modify: `src/data/userDataRepository.test.ts`
- Modify: `src/app/lastLearningLocation.ts`
- Modify: `src/app/lastLearningLocation.test.ts`

1. Add failing tests for `visual_set` drafts, story keywords/ordered points, phrases, recall, review state, last location, and v4-to-v5 preservation.
2. Add `visual_set` to learning targets and additive Part 7 story fields/modes.
3. Bump the existing database version without changing its name or deleting records.
4. Preserve every v4 store and index; add no unnecessary store.

## Task 5: Part 7 learner screens

**Files:**
- Create: `src/app/Part7App.integration.test.tsx`
- Create: `src/features/part7/Part7SetsScreen.tsx`
- Create: `src/features/part7/Part7SetScreen.tsx`
- Create: `src/features/part7/Part7StoryAnswerScreen.tsx`
- Create: `src/features/part7/StoryGuidePanel.tsx`
- Create or generalize: `src/components/LocalVisualAssetImage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/my-answers/MyAnswersScreen.tsx`
- Modify: `src/features/review/ReviewScreen.tsx`
- Modify: `src/styles/components.css`

1. Add failing user-behavior tests for HOME, twelve sets, image states/zoom, StoryGuide labeling, candidate boundaries, story CRUD/reorder, explicit StoryGuide preview/confirm, draft completion, recall, My Answers, and Review.
2. Implement development-only Part 7 routes centered on VisualSet.
3. Store only learner-authored story data; never use StoryGuide as an answer.
4. Add Part 7 to My Answers and Review while preserving all existing Part 2/text/Part 4 flows.

## Task 6: Documentation and verification

**Files:**
- Create: `docs/PART7_STORY_VISUAL_APP_SLICE.md`
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
- Modify: `docs/TEXT_PARTS_APP_SLICE.md`
- Modify: `docs/PART2_VISUAL_APP_SLICE.md`
- Modify minimally if needed: `docs/FULL_WORKBOOK_IMPORT_REPORT.md`

1. Document the VisualSet-first boundary, zero canonical links, twelve candidates, StoryGuide distinction, local-only images, personal-data model, migration, and limits.
2. Run every required fixture, asset, data, TypeScript, lint, Vitest, build, and aggregate check command.
3. Confirm two Part 7 fixture generations are byte-identical and no Part 2/7 source image bytes appear in `dist`.
4. Use Playwright CLI on the real development server for the requested mobile and console checks.
5. Confirm `git status` includes no generated image bytes and no commit/push was performed.
