# Full Workbook Working Import v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Do not commit or push.

**Goal:** 원본 workbook의 Question 253개와 전체 시각 자료를 스키마 v1.1 형태의 deterministic working JSON으로 반입하고, 기존 course working 데이터와의 엄격한 연결 후보 및 사람 검수 큐를 만든다.

**Architecture:** 기존 `extract_extended_sample.py`의 읽기 전용 OOXML 파서와 `build_course_working_import.py`의 결정적 JSON·검증·원자 교체 방식을 재사용한다. 실제 workbook `src-001`과 workbook 내부 출처 주장을 `SourceReference`로 분리하고, canonical 관계는 명시적 ID 또는 유일한 정확 일치에만 생성한다. working bundle과 생성 이미지 바이트는 별도 경계로 관리하며 앱 런타임에는 연결하지 않는다.

**Tech Stack:** Python 3 표준 라이브러리, XLSX OOXML/ZIP, JSON, `unittest`, 기존 npm 검증 명령

---

### Task 1: 사전 무결성·구조 게이트

**Files:**
- Read only: `data/raw/TSC_파트별_문제은행_그림포함.xlsx`
- Read only: 기존 sample CSV, Part 4 fixture, `course-import-v1`

- [x] **Step 1: 현재 main과 입력 해시를 확인한다**

Expected:

```text
branch=main
worktree=clean
workbook sha256=a150fd8a...f37f
```

- [x] **Step 2: workbook 구조를 읽기 전용으로 재검증한다**

Expected: 시트 10, Question 253, Part별 `4/48/84/50/36/19/12`, Part 2 세트·이미지 12, Part 7 세트·이미지 12, 공식 샘플 이미지 1, 전체 이미지 25.

- [x] **Step 3: 기존 앱 기준선을 검증한다**

Run:

```sh
npm run check
```

Expected: 기존 fixture, typecheck, lint, Vitest와 build 통과.

### Task 2: 실패하는 full import 계약 테스트

**Files:**
- Create: `scripts/tests/test_build_full_workbook_import.py`

- [ ] **Step 1: 핵심 엔터티·원문 보존 테스트를 작성한다**

검증:

- Question 253, AnswerPoint 253, Part별 수와 ID/Part 일치
- P7 공통 지시문 12개 유지
- Part 2 VisualSet 12, VisualQuestion 48, ModelAnswer 48
- Part 7 VisualSet 12, StoryGuide 12
- VisualAsset 25, Part 2·7 VisualSetAsset 참조 무결성
- ModelAnswer 대상은 모두 `visual_question`
- 개인 Excel 컬럼과 새 언어·답변 생성 없음

- [ ] **Step 2: 연결·출처·권리 테스트를 작성한다**

검증:

- `Source`는 기존 `src-001` 하나이며 claimed source와 분리
- SourceReference 대상·Source 참조 무결성
- Part 2의 유일한 엄격 일치만 자동 연결
- Part 7 접미사 연결은 후보이고 QuestionVisualSet은 생성하지 않음
- 모든 VisualAsset 권리는 `review_needed`
- 공식 샘플은 Question 연결 없이 별도 시각 맥락 또는 unmapped로 보존

- [ ] **Step 3: deterministic·보존·실패 원자성 테스트를 작성한다**

검증:

- 두 번 빌드의 JSON SHA-256 동일
- `--validate-only` 무변경
- `--extract-assets` 바이트와 workbook media SHA 일치
- 실패 시 기존 정상 출력 보존
- workbook, sample CSV, Part 4 fixture와 course import 해시 보존

- [ ] **Step 4: 기능 부재로 테스트가 실패하는지 확인한다**

Run:

```sh
python3 -m unittest scripts.tests.test_build_full_workbook_import -v
```

Expected: 새 builder가 없어 실패.

### Task 3: OOXML 반입·canonical-shaped payload 구현

**Files:**
- Create: `scripts/build_full_workbook_import.py`

- [ ] **Step 1: CLI와 안전한 입력·출력 경계를 구현한다**

지원:

```sh
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py --validate-only
python3 scripts/build_full_workbook_import.py --extract-assets
python3 scripts/build_full_workbook_import.py --output-dir <path>
```

- [ ] **Step 2: Source, Question, AnswerPoint, SourceReference를 만든다**

253개 원본 행과 기존 Part 4 ID 규칙을 그대로 사용한다. `Question`에 출처 주장·AnswerPoint·개인 컬럼을 넣지 않는다.

- [ ] **Step 3: workbook-specific PartGuide와 비매핑 내용을 보존한다**

`시험 구조`, `요약`, `그림 활용 안내`의 Part별 명시 문구만 사용하고, 전역 설명·링크·개인 컬럼 존재 정보는 `unmapped-content.json`에 원문 그대로 남긴다.

- [ ] **Step 4: Part 2 시각 데이터와 출처 답변을 만든다**

요청된 ID 규칙으로 12 VisualSet, 48 VisualQuestion, 48 ModelAnswer를 생성한다. 정확한 삼언어 일치 또는 단일 중국어 일치이며 다른 언어가 충돌하지 않을 때만 canonical Question을 연결한다.

- [ ] **Step 5: Part 7 시각 데이터와 StoryGuide를 만든다**

12 VisualSet과 12 StoryGuide를 생성하되 Question 연결은 만들지 않는다. 접미사 대응은 `workbook-link-candidates.json`의 `review_needed` 후보로만 보존한다.

- [ ] **Step 6: 이미지 25개 메타데이터와 선택적 바이트 추출을 구현한다**

PNG IHDR에서 원본 픽셀 크기를 읽고 원본 media 바이트 SHA를 기록한다. 공식 샘플은 명확한 독립 `official_sample` 시각 세트로 보존하되 Question과 연결하지 않는다.

### Task 4: course cross-dataset 후보·검수 큐

**Files:**
- Create through builder: `course-question-link-candidates.json`
- Create through builder: `course-content-usage-candidates.json`
- Create through builder: `workbook-link-candidates.json`
- Create through builder: `unmapped-content.json`
- Create through builder: `review-queue.json`

- [ ] **Step 1: canonical Question 연결 후보를 엄격한 기준으로 계산한다**

course 데이터에 explicit canonical ID 또는 완전한 질문 원문이 없으면 0개를 정상 결과로 유지한다.

- [ ] **Step 2: 학습 콘텐츠 사용 후보를 literal 근거로만 계산한다**

Part가 일치하면서 완전한 중국어 표현이 실제 질문 문자열에 포함되는 경우만 생성한다. Part·주제 유사성만으로 연결하지 않는다.

- [ ] **Step 3: 비매핑 원문과 사람 검수 큐를 생성한다**

병음·한국어 검수, 시각 링크, P7 접미사 후보, PartGuide 충돌, 이미지 권리, URL 검증과 언어 누락을 `blocking|important|later`로만 분류한다.

### Task 5: deterministic bundle·manifest·원자 게시

**Files:**
- Create through builder: `data/working/full-import-v1/*.json`
- Create through builder: `data/working/full-import-v1/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: 결정적 직렬화와 manifest를 구현한다**

UTF-8, LF, 2칸 들여쓰기, 끝 개행, 안정 ID/키 순서, 생성 시각·절대경로 제외. `manifest.json`은 자기 자신을 제외한 생성 파일 해시를 기록한다.

- [ ] **Step 2: 전체 bundle 검증 후 원자 교체한다**

같은 부모의 staging에서 모든 파일과 참조를 검증하고, 기존 정상 bundle은 교체 실패 시 복원한다. `--validate-only`는 읽기 전용이며 현재 산출물과 재계산 결과를 바이트 단위로 비교한다.

- [ ] **Step 3: generated assets 경계를 추가한다**

`data/working/generated-assets/full-import-v1/`를 `.gitignore`에 넣고, `--extract-assets`에서만 원본 바이트를 결정적으로 게시한다.

### Task 6: npm 명령과 문서

**Files:**
- Modify: `package.json`
- Create: `docs/FULL_WORKBOOK_IMPORT_REPORT.md`
- Create: `docs/COURSE_QUESTION_LINK_REPORT.md`
- Modify: `README.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/HIGH_SCORE_DATA_PLAN.md`
- Modify: `docs/DATA_WORKFLOW.md`
- Modify: `docs/DECISIONS.md`

- [ ] **Step 1: 데이터 전용 npm 명령을 추가한다**

`dataset:course`, `validate:course-dataset`, `test:course-dataset`, `dataset:full`, `validate:full-dataset`, `test:full-dataset`, `check:data`를 추가한다. 기존 frontend `check`에는 전체 import 재생성을 넣지 않는다.

- [ ] **Step 2: 반입·연결 보고서를 작성한다**

실제 수·해시·자동 연결·미연결·비매핑·review queue와 reviewed 승격 조건을 generated 결과에서 기록한다.

- [ ] **Step 3: 상태 문서를 최소 갱신한다**

Phase 1은 계속 진행 중이며 reviewed 승격, 사람 언어 검수, 권리 승인, 앱 연결은 미완료로 둔다.

### Task 7: 전체 검증·독립 리뷰

**Files:**
- Verify only: all protected inputs and existing app source

- [ ] **Step 1: 요청된 모든 명령을 실행한다**

```sh
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py --validate-only
python3 -m unittest scripts.tests.test_build_full_workbook_import -v
python3 scripts/build_full_workbook_import.py --extract-assets
npm run validate:course-dataset
npm run test:course-dataset
npm run validate:full-dataset
npm run test:full-dataset
npm run check:data
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run check
```

- [ ] **Step 2: 전후 해시와 앱 비변경을 확인한다**

workbook, sample CSV, Part 4 fixture, course import의 전후 해시를 비교하고 `src/` diff가 없는지 확인한다.

- [ ] **Step 3: 별도 spec/code review를 요청한다**

Critical/Important 지적을 수정한 뒤 전체 검증을 다시 실행한다.

- [ ] **Step 4: Git 비변경 동작을 확인한다**

사용자 요청에 따라 commit과 push를 실행하지 않는다.
