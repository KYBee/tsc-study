# Course Working Import v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `other-output`의 강의 분석·추출 Markdown을 근거 수준별로 구분한 검수 전 working 데이터와 Level 8 보강 계획으로 변환한다.

**Architecture:** 저장소에 실제 존재하는 Markdown만 `Source`로 등록하고, 강의 콘텐츠는 `SourceReference`와 `evidence_kind`로 근거를 추적한다. Python 표준 라이브러리 기반 빌더가 입력 해시와 근거 문구를 확인한 뒤 JSON을 원자적으로 생성하며, `--validate-only`는 같은 입력에서 재계산한 결과와 현재 산출물을 바이트 단위로 비교한다.

**Tech Stack:** Markdown, JSON, Python 3 표준 라이브러리, `unittest`

---

### Task 1: 근거 경계와 스키마 v1.1 문서화

**Files:**
- Modify: `docs/DATA_SCHEMA.md`
- Modify: `docs/SCHEMA_V1_SUMMARY.md`
- Modify: `docs/DECISIONS.md`

- [ ] **Step 1: 기존 Part 4 계약을 확인한다**

Run:

```sh
python3 scripts/build_part4_app_fixture.py --validate-only
```

Expected: 기존 6개 Question fixture가 변경 없이 통과한다.

- [ ] **Step 2: 공통 근거 enum과 네 엔터티를 추가한다**

`EvidenceKind`는 아래 다섯 값만 사용한다.

```text
document_text
screen_text
instructor_speech
analyst_synthesis
generated_study_material
```

`LearningExpression`, `PronunciationItem`, `PracticeDrill`, `CourseInsight`를 additive하게 정의하고 `SourceReference.target_type`에 네 종류를 추가한다. 기존 필드·enum은 제거하지 않는다.

- [ ] **Step 3: 과정 수준과 엄격한 반입 규칙을 기록한다**

`course_target_context = level_3`를 보존하고, 완전한 병음이 없는 교정은 `Correction`으로 만들지 않으며, `generated_study_material`을 강사 직접 발언으로 승격하지 않는다고 명시한다.

### Task 2: deterministic importer의 실패 테스트 작성

**Files:**
- Create: `scripts/tests/test_build_course_working_import.py`

- [ ] **Step 1: 필요한 파일과 개수를 검증하는 테스트를 작성한다**

최소 검증:

```python
self.assertEqual(len(payloads["sources.json"]), 20)
self.assertEqual(len(payloads["part-guides.json"]), 7)
self.assertEqual(len(payloads["learning-expressions.json"]), 37)
self.assertEqual(payloads["corrections.json"], [])
self.assertEqual(payloads["model-answer-candidates.json"], [])
self.assertEqual(payloads["question-link-candidates.json"], [])
```

- [ ] **Step 2: 테스트가 기능 부재로 실패하는지 확인한다**

Run:

```sh
python3 -m unittest scripts.tests.test_build_course_working_import -v
```

Expected: `scripts/build_course_working_import.py`가 없어 실패한다.

### Task 3: importer와 working 산출물 구현

**Files:**
- Create: `scripts/build_course_working_import.py`
- Create: `data/working/course-import-v1/README.md`
- Create: `data/working/course-import-v1/*.json`

- [ ] **Step 1: 입력 Source 20개와 해시 검증을 구현한다**

실제 `file_ref`는 `other-output`의 Markdown만 가리킨다. 원본 MP4·PDF·DOCX 이름은 `notes`의 주장으로만 보존한다.

- [ ] **Step 2: 표현 표를 원문 그대로 파싱한다**

37행을 고정 ID 순서로 읽고 전체 문장 병음이 확인된 16~18행만 `LanguageSet.pinyin`에 넣는다. `자료에서 확인 불가`, `화면 병음`, 부분 단어 병음은 빈 값과 검수 메모로 보존한다.

- [ ] **Step 3: 근거 기반 가이드·발음·드릴·인사이트·충돌을 생성한다**

모든 상태는 `raw`, `review_needed`, `draft` 중 하나이고 모든 출처 관계는 `verification_status = review_needed`다. Part 6·7은 상세 근거 부족을 숨기지 않는다.

- [ ] **Step 4: 원자적 출력과 validate-only를 구현한다**

JSON은 UTF-8, LF, 2칸 들여쓰기, 결정적인 키·배열 순서를 사용한다. 빌드는 임시 디렉터리 검증 후 교체하며 `--validate-only`는 재계산 결과와 현재 파일을 비교한다.

- [ ] **Step 5: 테스트를 통과시킨다**

Run:

```sh
python3 -m unittest scripts.tests.test_build_course_working_import -v
python3 scripts/build_course_working_import.py
python3 scripts/build_course_working_import.py --validate-only
```

Expected: 모든 검증이 통과하며 두 번 생성한 JSON 해시가 동일하다.

### Task 4: Level 8 데이터 보강 계획 문서화

**Files:**
- Create: `docs/LEVEL8_GAP_ANALYSIS.md`
- Create: `docs/HIGH_SCORE_DATA_PLAN.md`
- Modify: `docs/INDEX.md`

- [ ] **Step 1: 3급 과정의 유효 범위와 Part별 공백을 기록한다**

현재 자료를 정확성·감점 방지의 foundation으로만 분류하고 확인되지 않은 Level 8 공식 채점 기준을 만들지 않는다.

- [ ] **Step 2: 열 가지 우선순위별 데이터 계획을 작성한다**

각 항목에 필요한 데이터, 기존 데이터, 부족 데이터, 앱 화면, 구현 우선순위, 검수 조건을 기록한다.

### Task 5: 회귀·재현성 검증

**Files:**
- Verify only: existing app, fixture, raw/working inputs

- [ ] **Step 1: 입력과 보호 대상 파일의 Git 상태를 확인한다**

Run:

```sh
git status --short
git diff -- data/raw data/working/question-sample data/working/extended-sample
```

Expected: 기존 원본·CSV·추출 스크립트에는 변경이 없다.

- [ ] **Step 2: 전체 앱 회귀 검증을 실행한다**

Run:

```sh
npm run check
```

Expected: fixture 검증, typecheck, lint, tests, build가 모두 통과한다.

- [ ] **Step 3: 생성 결과를 다시 검증한다**

Run:

```sh
python3 scripts/build_course_working_import.py
python3 scripts/build_course_working_import.py --validate-only
python3 -m unittest discover -s scripts/tests -v
```

Expected: deterministic 검증과 모든 Python 테스트가 통과한다.

사용자 지침에 따라 이 계획의 어느 단계에서도 Git commit 또는 push를 실행하지 않는다.
