# Part 4 Full Working Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Do not commit or push.

**Goal:** 검수 전 Part 4 Question 50개와 공통 강의 자료를 deterministic 개발 fixture로 제공하고, 실제 AI가 없어도 모든 문제에서 연습 초안을 저장·검색·복습할 수 있는 모바일 학습 흐름을 완성한다.

**Architecture:** `full-import-v1`의 Part 4 Question·AnswerPoint·workbook PartGuide와 `course-import-v1`의 Part 4 공통 자료를 원문 그대로 선별해 별도 fixture를 만든다. 앱은 Zod로 fixture를 검증한 뒤 읽기 전용 Repository를 통해 조회한다. 승인 교정 답변인 `UserAnswer`와 교정 전 원문인 `PracticeDraft`를 분리하고, 기존 IndexedDB 이름을 유지한 v2 migration으로 `practiceDrafts` store만 추가한다.

**Tech Stack:** Python 3 표준 라이브러리, deterministic JSON, React 19, TypeScript, React Router, Zod, idb/IndexedDB, Vitest, React Testing Library, Playwright CLI, 일반 CSS

---

### Task 1: 사전 무결성·기준선 확인

**Files:**
- Read only: `data/working/full-import-v1/`
- Read only: `data/working/course-import-v1/`
- Read only: `data/working/app-fixtures/part4/`
- Read only: 현재 `src/`와 테스트

- [x] **Step 1: main과 입력 구조를 확인한다**
- [x] **Step 2: 기존 `npm run check`를 실행한다**
- [x] **Step 3: 기존 `npm run check:data`를 실행한다**

### Task 2: Part 4 full fixture 계약 테스트와 builder

**Files:**
- Create: `scripts/tests/test_build_part4_full_app_fixture.py`
- Create: `scripts/build_part4_full_app_fixture.py`
- Create through builder: `data/working/app-fixtures/part4-full/*`

- [ ] **Step 1: 50개 Question·AnswerPoint와 0개 ModelAnswer 계약 테스트를 작성한다**
- [ ] **Step 2: Part 4 workbook/course 가이드와 표현 13개·드릴 2개·인사이트 6개 선별 계약을 작성한다**
- [ ] **Step 3: Source/SourceReference 참조 무결성, 상태·level_3 보존 테스트를 작성한다**
- [ ] **Step 4: deterministic 재실행, validate-only 무변경, 입력 해시 보존 테스트를 작성한다**
- [ ] **Step 5: 테스트 실패를 확인한 뒤 최소 builder를 구현한다**

### Task 3: 런타임 타입·검증·Repository 확장

**Files:**
- Modify: `src/domain/entities.ts`
- Modify: `src/domain/repositories.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/data/fixtureLoader.ts`
- Modify: `src/data/publicContentRepository.ts`
- Modify tests under `src/domain/` and `src/data/`

- [ ] **Step 1: PartGuide, LearningExpression, PracticeDrill, CourseInsight 런타임 계약 테스트를 추가한다**
- [ ] **Step 2: 새 dataset ID와 정확한 50개 ID/상태/참조 검증을 구현한다**
- [ ] **Step 3: 공용 자료 조회 메서드를 ID 기반으로 추가한다**
- [ ] **Step 4: 앱 기본 source를 새 fixture로 전환하고 기존 6문제 fixture는 보존한다**

### Task 4: PracticeDraft와 IndexedDB v2 migration

**Files:**
- Modify: `src/domain/entities.ts`
- Modify: `src/data/indexedDb.ts`
- Modify: `src/data/userDataRepository.ts`
- Modify: `src/data/userDataRepository.test.ts`

- [ ] **Step 1: PracticeDraft 저장·upsert·삭제·빈 값 거부 테스트를 작성한다**
- [ ] **Step 2: v1 stores에 기존 데이터를 넣은 뒤 v2 migration 보존 테스트를 작성한다**
- [ ] **Step 3: DB 이름을 유지하고 `practiceDrafts` store와 unique question index를 추가한다**
- [ ] **Step 4: UserAnswer·Correction·ReviewState와 독립적인 Repository API를 구현한다**

### Task 5: Part 4 50문제 탐색·연습 UI

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/part/PartDetailScreen.tsx`
- Modify: `src/features/question/QuestionScreen.tsx`
- Modify: `src/features/answer/AnswerEditorScreen.tsx`
- Modify: `src/features/my-answers/MyAnswersScreen.tsx`
- Modify: `src/features/review/ReviewScreen.tsx`
- Add focused utilities/components as needed
- Modify: `src/styles/components.css`

- [ ] **Step 1: 검색·유형·복습·작성 상태·랜덤·초기화 테스트를 추가한다**
- [ ] **Step 2: 이전/다음/랜덤과 언어 토글·마지막 위치 테스트를 추가한다**
- [ ] **Step 3: 초안 저장·복원·upsert·삭제와 unsupported mock 공존 테스트를 추가한다**
- [ ] **Step 4: 나의 답변을 교정 완료/연습 초안으로 분리한다**
- [ ] **Step 5: 홈 통계와 전체 50문제 복습 탐색을 구현한다**
- [ ] **Step 6: workbook 힌트와 level_3 강의 기반 공통 자료의 출처 성격을 구분해 표시한다**

### Task 6: 문서·스크립트 갱신

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/DATA_SCHEMA.md`
- Modify: `docs/SCHEMA_V1_SUMMARY.md`
- Modify: `docs/SCREEN_DATA_CONTRACT.md`
- Modify: `docs/NAVIGATION_FLOW.md`
- Modify: `docs/UI_SPEC.md`
- Create: `docs/PART4_FULL_WORKING_SLICE.md`

- [ ] **Step 1: fixture/validate/test npm 명령과 가벼운 `check` 연결을 추가한다**
- [ ] **Step 2: PracticeDraft additive schema와 IndexedDB migration 결정을 기록한다**
- [ ] **Step 3: 실제 구현 상태·raw 데이터·mock 제한·미완료 범위를 갱신한다**

### Task 7: 전체 검증·브라우저 확인

- [ ] **Step 1: fixture 두 번 생성과 validate-only, Python 테스트를 실행한다**
- [ ] **Step 2: `npm run check:data`, typecheck, lint, Vitest, build, `npm run check`를 실행한다**
- [ ] **Step 3: Playwright로 HOME→검색/필터→상세→초안→mock→승인→복습→이어보기 흐름을 확인한다**
- [ ] **Step 4: 320px viewport와 콘솔 오류를 확인한다**
- [ ] **Step 5: 보호 입력·기존 6문제 fixture·개인 DB 이름 보존과 no commit/push를 확인한다**
