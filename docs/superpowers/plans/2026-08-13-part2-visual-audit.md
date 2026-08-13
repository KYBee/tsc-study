# Part 2 이미지 전수검사·통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 2 12개 그림이 각 세트의 질문·추천답 네 항목을 직접 판별 가능하게 표현하고, 학습을 방해하는 저해상도·스타일 불일치 자산을 1448×1086 교육용 일러스트로 교체한다.

**Architecture:** fixture 질문·답변에서 판별 요구사항을 결정적으로 추출해 감사 문서와 테스트로 고정한다. 실제 이미지 수정은 built-in image generation을 사용하며 기존 파일명·asset ID를 유지하고, 현재 60개 자산으로 임시 archive를 구성해 repository importer가 metadata와 provenance를 재생성한다.

**Tech Stack:** Python standard library, existing named visual importer, built-in image generation, Vitest/Python unittest

---

## File map

- Create `docs/PART2_VISUAL_QUESTION_AUDIT.md`: 세트별 Q/A/시각 요구/판정.
- Modify failed images under `data/working/app-assets/tsc-individual-images-v1/`: only audited failures.
- Modify `data/working/app-assets/tsc-individual-images-v1/image_name_list.csv`: changed-image descriptions only.
- Regenerate `data/working/app-assets/tsc-individual-images-v1/manifest.json`, README metadata, Part 2·7 fixture metadata.
- Modify `scripts/tests/test_import_named_visual_assets.py`: 12 mapping and new-dimension/hash invariants.
- Modify `scripts/tests/test_build_part2_visual_app_fixture.py`: Q/A-to-asset coverage contract.

### Task 1: 결정적 감사표 생성

- [ ] **Step 1: fixture에서 12×4 질문·답을 추출**

Run a read-only Python command that joins `visual-questions.json` and `model-answers.json` by `visual_question_id`, sorted by set and item number, and prints exactly 48 rows. Expected: 12 sets, each four unique item numbers and one answer.

- [ ] **Step 2: 실제 PNG 12장을 원본 해상도로 검사**

`view_image`로 각 파일을 확인한다. Set 1·8·11·12를 style reference로 삼되 의미 오류가 있으면 reference라도 실패 처리한다. Set 2~7·9·10은 숫자·수량·위치·인물 식별성과 538×444 품질을 별도로 기록한다.

- [ ] **Step 3: 감사 문서 작성**

각 set에 다음 행 네 개를 작성한다.

```markdown
| Q | 질문 | 추천 답변 | 그림에 필요한 정보 | 판정 |
|---|---|---|---|---|
| Q1 | 원문 보존 | 원문 보존 | 사람·행동·숫자 | OK 또는 수정: 구체 이유 |
```

세트 전체 결론은 `OK` 또는 `수정` 두 값으로 남긴다.

- [ ] **Step 4: 문서 자체 검토**

48개 질문과 답이 모두 한 번씩 등장하고 질문·답 텍스트가 fixture와 byte-for-byte 동일한지 작은 Python assertion으로 검사한다.

- [ ] **Step 5: 커밋**

```sh
git add docs/PART2_VISUAL_QUESTION_AUDIT.md
git commit -m "docs: audit Part 2 visual question coverage"
```

### Task 2: 실패 자산만 재생성

- [ ] **Step 1: 각 실패 세트의 생성 사양 확정**

감사표의 네 시각 요구를 모두 prompt에 명시한다. 공통 prompt는 4:3, 1448×1086, semi-realistic educational illustration, simple background, no decorative text, exact counts and numeric labels, unambiguous gender/action/position을 요구한다. 기존 이미지를 편집하는 경우 먼저 `view_image`로 검사한 경로만 reference로 제공한다.

- [ ] **Step 2: built-in image generation으로 실패 세트 생성**

각 세트는 한 장씩 생성하고 즉시 원본 질문 네 개에 재대조한다. 숫자·수량·시간·가격 중 하나라도 틀리면 저장하지 않고 같은 요구로 수정 생성한다. 생성 결과를 기존 파일명에만 반영한다.

- [ ] **Step 3: 해상도와 PNG header 확인**

Run a Python read-only assertion over changed files. Expected: PNG signature, width 1448, height 1086, nonzero unique SHA.

- [ ] **Step 4: 변경 설명 갱신**

`image_name_list.csv`의 해당 행만 실제 새 그림의 시각 정보를 1문장으로 기록하고 filename은 유지한다.

### Task 3: importer로 metadata·fixture 재생성

- [ ] **Step 1: 현재 60개 PNG와 metadata로 임시 ZIP 구성**

`/tmp` 아래 임시 디렉터리와 archive를 사용한다. archive에는 정확히 60 PNG, `README.txt`, `image_name_list.csv`만 넣고 repository에 남기지 않는다.

- [ ] **Step 2: 기존 importer 실행**

Run: `python3 scripts/import_named_visual_assets.py --archive <temporary-archive>`
Expected: 60 assets imported; current bytes determine source archive hash, file size, SHA, width, height and generated hashes.

- [ ] **Step 3: Part 2와 shared Part 7 fixture 재생성**

Run:

```sh
npm run fixture:part2-visual
npm run fixture:part7-visual
```

Expected: deterministic fixture generation succeeds without changing questions, answers, StoryGuides or rights metadata.

- [ ] **Step 4: 질문·답변 불변성 검사**

작업 전 기록한 `visual-questions.json`과 `model-answers.json` SHA를 작업 후 비교한다. Expected: identical.

### Task 4: integrity tests and verification

- [ ] **Step 1: 12 mapping 테스트 강화**

Python test에서 Part 2 set numbers 1..12가 각각 한 asset에 연결되고 asset filename, manifest size/SHA/dimensions가 실제 file과 일치하는지 검증한다. production rights 필드도 `review_needed`/false로 유지되는지 확인한다.

- [ ] **Step 2: targeted validation 실행**

```sh
npm run validate:named-visual-assets
npm run test:named-visual-assets
npm run validate:part2-visual
npm run test:part2-visual
npm run validate:part2-assets
npm run validate:part7-visual
npm run validate:part7-assets
```

Expected: all PASS.

- [ ] **Step 3: 최종 12세트 재검사**

감사 문서의 `수정` 세트는 새 PNG를 다시 열어 Q1~Q4를 각각 ✅/❌로 판정한다. 하나라도 ❌이면 task를 완료하지 않는다.

- [ ] **Step 4: 커밋**

```sh
git add data/working/app-assets/tsc-individual-images-v1 data/working/app-fixtures/part2-visual-v1 data/working/app-fixtures/part7-visual-v1 scripts/tests/test_import_named_visual_assets.py scripts/tests/test_build_part2_visual_app_fixture.py docs/PART2_VISUAL_QUESTION_AUDIT.md
git commit -m "fix: align Part 2 visuals with all question cues"
```

