# Opt-in Production Visual Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing secure development image route while allowing exactly 60 reviewed-pending Part 2 and Part 7 PNGs to be emitted and displayed in production only when `VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS=true`.

**Architecture:** Extend the existing Vite visual-asset allowlist into a shared verification path used by both the development middleware and a production build hook. Keep rights metadata unchanged; a strict deployment flag controls build emission and runtime URL resolution independently of metadata approval. UI availability is derived from that same runtime flag and Vite `BASE_URL`, so sub-path deployments work without exposing repository paths.

**Tech Stack:** React 19, TypeScript 6, Vite 8/Rollup plugin hooks, Vitest 4, Node filesystem/crypto APIs.

---

### Task 1: Runtime URL contract

**Files:**
- Modify: `src/data/localVisualAssetUrl.ts`
- Modify: `src/data/localVisualAssetUrl.test.ts`
- Modify: `src/data/part2AssetUrl.ts`
- Modify: `src/data/part2AssetUrl.test.ts`

- [x] **Step 1: Write failing URL resolver tests**

Add tests covering development URLs, production flag off, production flag on, invalid IDs, non-`review_needed` rights, and `/tsc-study/` base URLs. The production assertion must be:

```ts
expect(createVisualAssetUrl(asset, {
  development: false,
  productionEnabled: true,
  baseUrl: '/tsc-study/',
})).toBe('/tsc-study/tsc-visual-assets/va-P7-V01-01.png')
```

- [x] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:run -- src/data/localVisualAssetUrl.test.ts src/data/part2AssetUrl.test.ts`

Expected: FAIL because production opt-in URL generation is not implemented.

- [x] **Step 3: Implement the minimal resolver**

Define a typed runtime configuration and strict flag parser. Preserve the existing asset-ID regex and `rights_status === 'review_needed'` gate. Return the existing development URL in dev, a `BASE_URL`-aware `tsc-visual-assets/<asset-id>.png` URL only when production is explicitly enabled, and `undefined` otherwise. Keep the Part 2 compatibility wrapper functional.

- [x] **Step 4: Run the focused tests**

Run: `npm run test:run -- src/data/localVisualAssetUrl.test.ts src/data/part2AssetUrl.test.ts`

Expected: PASS.

### Task 2: Verified production emission

**Files:**
- Modify: `viteLocalVisualAssets.ts`
- Modify: `viteLocalVisualAssets.test.ts`
- Modify: `vite.config.ts`

- [x] **Step 1: Write failing build-helper tests**

Add tests asserting that disabled production collection returns zero assets, enabled collection returns exactly 60 assets split 12/48, output names and IDs are unique, each emitted byte buffer matches fixture SHA and size, and a temporary modified PNG fails integrity verification.

- [x] **Step 2: Run the plugin tests and verify failure**

Run: `npm run test:run -- viteLocalVisualAssets.test.ts`

Expected: FAIL because production collection and integrity helpers do not exist.

- [x] **Step 3: Share strict verification between serve and build**

Extend `AssetRecord` with width and height. Add a verifier that resolves only fixture-registered repository paths beneath `data/working/app-assets/tsc-individual-images-v1`, rejects symlink escapes, requires PNG MIME/extension/signature, checks size, SHA-256, and IHDR width/height, and returns bytes only after all checks pass.

- [x] **Step 4: Add the opt-in build hook**

Remove the serve-only plugin restriction while retaining `configureServer`. During `buildStart`, do nothing when the flag is false; when true, verify and emit deterministic files named `tsc-visual-assets/<visual_asset_id>.png`. Configure the plugin from Vite's resolved environment and accept only the exact string `true`.

- [x] **Step 5: Run focused plugin and resolver tests**

Run: `npm run test:run -- viteLocalVisualAssets.test.ts src/data/localVisualAssetUrl.test.ts`

Expected: PASS with 60 verified production entries.

### Task 3: Production-aware UI guards

**Files:**
- Modify: `src/components/LocalVisualAssetImage.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/part2/Part2SetsScreen.tsx`
- Modify: `src/features/part7/Part7SetsScreen.tsx`
- Modify: `src/features/part7/Part7SetScreen.tsx`
- Modify: `src/features/part7/Part7StoryAnswerScreen.tsx`
- Modify: `src/features/review/ReviewScreen.tsx`

- [x] **Step 1: Add runtime availability coverage**

Use the tested runtime helper as the single source of truth. Existing development integration tests must stay green; resolver tests cover the production flag cases without mutating global Vite env values.

- [x] **Step 2: Replace development-only gates**

Replace Part 2/7 `import.meta.env.DEV` availability checks with `REVIEW_VISUAL_ASSETS_ENABLED`. Build image URLs through the runtime resolver using `import.meta.env.BASE_URL`. Keep Part 4 data review dev-only. When no URL exists, show the safe inactive-deployment fallback rather than a broken image.

- [x] **Step 3: Run relevant React tests**

Run: `npm run test:run -- src/app/Part2App.integration.test.tsx src/app/Part7App.integration.test.tsx src/data/localVisualAssetUrl.test.ts`

Expected: PASS; development behavior remains unchanged.

### Task 4: Documentation and full verification

**Files:**
- Create: `.env.example`
- Modify: `README.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/PART2_VISUAL_APP_SLICE.md`
- Modify: `docs/PART7_STORY_VISUAL_APP_SLICE.md`

- [x] **Step 1: Document the opt-in boundary**

Document `VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS=false`, the explicit build command, default exclusion, exact 12/48/60 counts, `BASE_URL` compatibility, and that `review_needed`/`public_allowed=false` remain unchanged and are not a rights approval.

- [x] **Step 2: Run all targeted data commands**

Run the named-asset validation/tests, Part 2 fixture generation/validation/tests, Part 7 fixture generation/validation/tests, and both local asset validators required by the request. Expected: all PASS without data content changes.

- [x] **Step 3: Run code quality checks**

Run: `npm run typecheck`, `npm run lint`, and `npm run test:run`.

Expected: all PASS.

- [x] **Step 4: Verify production flag off**

Run: `npm run build`, then inspect `dist/tsc-visual-assets`.

Expected: build PASS and emitted PNG count 0.

- [x] **Step 5: Verify production flag on**

Run: `VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS=true npm run build`, inspect `dist/tsc-visual-assets`, and compare emitted files against fixture IDs and hashes.

Expected: 12 Part 2 + 48 Part 7 = 60 PNGs; all hashes match.

- [x] **Step 6: Preview smoke test**

Start `npm run preview -- --host 127.0.0.1`, use a real browser to open Part 2 and Part 7 detail pages, confirm image requests succeed, and stop the preview process after the smoke test.

Expected: production bundle displays Part 2 and all four Part 7 frames without console errors.

- [x] **Step 7: Run full repository check**

Rebuild with the flag off if needed, then run `npm run check`.

Expected: PASS and default production output excludes review images.

- [x] **Step 8: Review and commit**

Run `git diff --check`, inspect all changed paths, confirm no image/data/rights metadata changes, then commit the intentional changes:

```sh
git add .env.example README.md docs src vite.config.ts viteLocalVisualAssets.ts viteLocalVisualAssets.test.ts
git commit -m "feat: support opt-in production visual assets"
```
