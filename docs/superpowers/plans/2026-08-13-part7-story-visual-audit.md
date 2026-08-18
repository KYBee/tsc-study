# Part 7 이미지·스토리 전수검사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 7 12세트의 48개 장면이 StoryGuide의 시작·전개·문제·결과를 그림만으로 합리적으로 추론할 수 있게 하고 실제 의미·연속성 실패 장면만 수정한다.

**Architecture:** StoryGuide와 source reference를 먼저 고정한 뒤 이미지 4장 contact sequence를 사람·사물·행동·원인결과 기준으로 평가한다. 수정은 built-in image generation으로 필요한 장면에 한정하고, Part 2 계획과 동일한 importer를 통해 shared manifest와 fixture를 재생성한다.

**Tech Stack:** Python standard library, existing named visual importer, built-in image generation, Python unittest

---

## File map

- Create `docs/PART7_STORY_VISUAL_AUDIT.md`: 12세트 provenance와 4장 continuity 판정.
- Modify only failed Part 7 PNGs under `data/working/app-assets/tsc-individual-images-v1/`.
- Modify `image_name_list.csv` descriptions for changed frames only.
- Regenerate named asset manifest and Part 2·7 fixture metadata.
- Modify `scripts/tests/test_import_named_visual_assets.py`: 48 mapping and integrity coverage.
- Modify `scripts/tests/test_build_part7_visual_app_fixture.py`: StoryGuide/set/frame and unchanged-content assertions.

### Task 1: StoryGuide provenance와 V03 충돌 판정

- [ ] **Step 1: StoryGuide 12개와 SourceReference 추출**

각 StoryGuide의 `visual_set_id`, 원문 flow, source locator, status를 표로 출력한다. Expected: 12 unique sets, one guide each, no ModelAnswer.

- [ ] **Step 2: V03 원본 근거 대조**

`story-guides.json`, source references, full workbook import report와 연결된 workbook locator를 읽는다. 수박 실종과 강아지 범인이 원본에 직접 존재하고 귤 상자가 named-image description에만 존재하는지 기록한다.

- [ ] **Step 3: V03 결정 기록**

- 원본 flow가 수박으로 일관되면 frame 1을 `이웃 방문과 아직 온전한 수박의 존재`가 보이는 장면으로 수정 대상으로 표시한다.
- 원본 텍스트 자체가 귤과 수박으로 충돌하면 이미지나 StoryGuide를 고치지 않고 `source conflict`로 기록한다.

두 경우 모두 StoryGuide 원문과 canonical 관계는 변경하지 않는다.

### Task 2: 48장 continuity 전수검사

- [ ] **Step 1: 세트별 4장을 원본 해상도로 검사**

`view_image`로 12세트를 4장 순서로 본다. 각 frame에 시작/전개/문제/결과 역할, 인물 외형, 핵심 사물, 행동, 다음 장면과의 인과를 기록한다.

- [ ] **Step 2: 감사 문서 작성**

각 세트는 다음 표를 사용한다.

```markdown
| Frame | StoryGuide 역할 | 실제 그림 단서 | 인물·사물 연속성 | 판정 |
|---|---|---|---|---|
| 1 | 사건 시작 원문 | 관찰 사실 | 유지/충돌 이유 | OK 또는 수정 |
```

세트 결론은 `OK`, `수정`, `원본 충돌` 중 하나로 기록한다.

- [ ] **Step 3: 수정 우선순위 확정**

의미 오류 → 사건 연결 불가 → 인물·행동 식별 실패 → 품질 문제 순으로 정렬한다. 단순히 538×444라는 이유만으로 48장 전체를 재생성하지 않는다.

- [ ] **Step 4: 감사 문서 커밋**

```sh
git add docs/PART7_STORY_VISUAL_AUDIT.md
git commit -m "docs: audit Part 7 story visual continuity"
```

### Task 3: 실패 장면 수정

- [ ] **Step 1: 세트별 continuity prompt 작성**

수정 frame마다 기존 같은 세트의 인물 성별, 머리, 옷 색, 장소, 핵심 사물을 reference로 명시한다. prompt에는 해당 frame에서 반드시 보여야 할 한 행동과 다음 frame으로 이어지는 원인만 넣고 새로운 인물·사물은 금지한다.

- [ ] **Step 2: built-in image generation으로 필요한 장면만 수정**

각 대상 이미지를 먼저 `view_image`로 확인하고 referenced image path를 사용해 스타일과 등장인물 continuity를 유지한다. 생성 후 set의 4장을 다시 연속으로 검사한다. 합리적 사건 추론이 불가능하면 저장하지 않는다.

- [ ] **Step 3: 파일 계약 유지**

기존 filename과 set/frame number를 유지하고 PNG를 재인코딩하거나 단순 확대하지 않는다. 바뀐 frame 설명만 `image_name_list.csv`에 관찰 가능한 사실로 갱신한다.

### Task 4: shared metadata 재생성과 불변성 검증

- [ ] **Step 1: 현재 60장 기준 임시 archive 생성 후 importer 실행**

Part 2 계획과 같은 62-file archive contract를 사용한다. repository에는 archive를 남기지 않는다.

Run: `python3 scripts/import_named_visual_assets.py --archive <temporary-archive>`
Expected: exact 60 assets and updated provenance for current bytes.

- [ ] **Step 2: fixture 재생성**

```sh
npm run fixture:part2-visual
npm run fixture:part7-visual
```

Expected: both succeed because manifest is shared.

- [ ] **Step 3: 공용 콘텐츠 불변성 검사**

작업 전후 `story-guides.json`, Part 2 `visual-questions.json`, Part 2 `model-answers.json`, link candidates의 content hashes를 비교한다. Expected: unchanged except generated source/asset metadata records that directly contain image hashes or descriptions.

### Task 5: tests and final verification

- [ ] **Step 1: 48 asset mapping 테스트 강화**

Part 7 set 1..12 각각 frame 1..4가 정확히 하나씩 있고, manifest와 실제 PNG의 SHA·size·dimensions가 일치하며 StoryGuide가 ModelAnswer 배열에 들어가지 않는지 검증한다.

- [ ] **Step 2: targeted commands 실행**

```sh
npm run validate:named-visual-assets
npm run test:named-visual-assets
npm run validate:part7-visual
npm run test:part7-visual
npm run validate:part7-assets
npm run validate:part2-visual
npm run validate:part2-assets
```

Expected: all PASS.

- [ ] **Step 3: 전체 12세트 최종 판정**

각 세트를 4장 순서로 다시 열고 감사 문서의 frame별 판정을 확정한다. `수정` 세트는 수정 이유와 최종 OK 근거를 모두 남긴다. `원본 충돌`은 임의 해결하지 않고 최종 보고의 남은 문제에 포함한다.

- [ ] **Step 4: 커밋**

```sh
git add data/working/app-assets/tsc-individual-images-v1 data/working/app-fixtures/part2-visual-v1 data/working/app-fixtures/part7-visual-v1 scripts/tests/test_import_named_visual_assets.py scripts/tests/test_build_part7_visual_app_fixture.py docs/PART7_STORY_VISUAL_AUDIT.md
git commit -m "fix: align Part 7 visuals with story continuity"
```

### Task 6: repository-wide verification

- [ ] **Step 1: 요청된 검사 실행**

```sh
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run check:data
```

Expected: all PASS.

- [ ] **Step 2: 저장소 전체 검사 실행**

Run: `npm run check`
Expected: PASS, including asset regeneration, fixtures, Python tests, Vitest and production build.

- [ ] **Step 3: diff와 권리 경계 확인**

Run: `git diff --check` and inspect `git diff --stat`.
Expected: no whitespace errors, no changes to rights approval, no login/backend/review algorithm/home CTA changes.

