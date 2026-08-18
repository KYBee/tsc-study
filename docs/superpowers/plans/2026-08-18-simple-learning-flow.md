# 기본 학습 흐름 단순화 구현 계획

> 설계 기준: `docs/superpowers/specs/2026-08-18-simple-learning-flow-design.md`

**목표:** 기존 학습·실전·교정·검수 기능과 데이터 구조를 보존하면서 홈, 문제 목록, 텍스트/시각 문제 상세의 기본 흐름을 `문제 → 내 답변 저장 → 못 외움/외움 → 다음`으로 단순화한다.

**아키텍처:** 기존 `PracticeDraft`와 `ReviewState` repository 계약 위에 작은 공통 UI 컴포넌트를 추가한다. 화면별 데이터 로더는 유지하고, 복잡한 가이드·출처·교정·구조화 편집기는 닫힌 보조 영역 또는 기존 보조 라우트로 이동한다. IndexedDB schema와 router는 변경하지 않는다.

**기술:** React 19, TypeScript, React Router Declarative, idb, Vitest, React Testing Library, 일반 CSS.

---

## 작업 1: 공통 인라인 저장 컴포넌트

**파일**

- 추가: `src/components/SimpleAnswerEditor.tsx`
- 추가: `src/components/LearningStatusButtons.tsx`
- 추가: `src/components/SimpleAnswerEditor.test.tsx`
- 추가: `src/components/LearningStatusButtons.test.tsx`

### 1. 실패 테스트 작성

`SimpleAnswerEditor`에 대해 다음 테스트를 먼저 작성한다.

- 기존 draft의 `full_text`/`original_input`을 textarea에 복원한다.
- draft가 없으면 전달된 `UserAnswer.original_input` fallback을 표시한다.
- 새 답변 저장 시 target별 `PracticeDraft`를 `completed`로 upsert한다.
- 수정 저장 시 같은 target의 활성 draft 하나를 갱신한다.
- 답변 저장은 `ReviewState`를 만들지 않는다.
- 빈 입력과 repository 실패 시 입력을 보존한다.

`LearningStatusButtons`에 대해 다음 테스트를 먼저 작성한다.

- 기본 UI에는 `못 외움`, `외움`만 표시한다.
- 두 상태를 target별 `ReviewState`로 저장한다.
- 기존 `헷갈림`은 삭제하지 않고 현재 상태 안내로 보존한다.
- repository 실패 시 기존 상태를 유지한다.

### 2. RED 확인

실행:

```sh
npm test -- --run src/components/SimpleAnswerEditor.test.tsx src/components/LearningStatusButtons.test.tsx
```

예상: 컴포넌트가 없어 실패.

### 3. 최소 구현

- textarea, 저장 버튼, 상태 메시지와 오류 메시지만 구현한다.
- 저장 원문은 `original_input`과 `full_text`에 동일하게 기록한다.
- 기존 draft의 선택 필드는 repository upsert가 보존하도록 한다.
- 입력 언어 감지는 중국어/한글 문자 포함 여부만 판단하고 원문을 바꾸지 않는다.
- 상태 컴포넌트는 `aria-pressed`, 저장 중 비활성화와 오류를 제공한다.

### 4. GREEN 확인 및 커밋

```sh
npm test -- --run src/components/SimpleAnswerEditor.test.tsx src/components/LearningStatusButtons.test.tsx
git add src/components/SimpleAnswerEditor.tsx src/components/LearningStatusButtons.tsx src/components/SimpleAnswerEditor.test.tsx src/components/LearningStatusButtons.test.tsx
git commit -m "feat: add simple inline learning controls"
```

## 작업 2: 텍스트 문제 상세 단순화

**파일**

- 수정: `src/features/question/QuestionScreen.tsx`
- 수정: `src/app/App.integration.test.tsx`
- 수정: `src/styles/components.css`

### 1. 실패 통합 테스트 작성

다음을 `App.integration.test.tsx`에 추가한다.

- `/questions/P3-001`에서 질문 다음에 인라인 `내 답변`이 보인다.
- 기존 draft가 textarea에 복원된다.
- PracticeDraft가 없고 UserAnswer만 있으면 `original_input`이 복원된다.
- 새 답변과 수정 답변이 같은 Question draft에 저장된다.
- 저장 직후 ReviewState가 없는 상태를 유지한다.
- `못 외움`, `외움`을 각각 저장할 수 있다.
- 저장 성공 후 `다음 문제`로 이동한다.
- Part 4에 `답변 구조 연습하기`, Part 3에 `실전 모드`가 유지된다.
- 기존 `/questions/:id/answer`, `/questions/:id/correction`, `/questions/:id/exam` route가 유지된다.

### 2. RED 확인

```sh
npm test -- --run src/app/App.integration.test.tsx
```

### 3. 화면 재구성

- 상단 개발 badge와 긴 검수 안내는 기본 영역에서 제거한다.
- 질문 언어 묶음 바로 아래 공통 두 컴포넌트를 배치한다.
- 이전·다음 navigation을 핵심 흐름 하단에 둔다.
- Part 4 구조화 편집, Part 3 실전, AI 교정, 별도 답변 편집을 보조 행동으로 유지한다.
- AnswerPoint, PartGuide, LearningExpression, PracticeDrill, CourseInsight, ModelAnswer, 교정 UserAnswer와 데이터 상태를 기본적으로 닫힌 `추가 학습 자료 보기` 안으로 이동한다.

### 4. GREEN 확인 및 커밋

```sh
npm test -- --run src/app/App.integration.test.tsx
git add src/features/question/QuestionScreen.tsx src/app/App.integration.test.tsx src/styles/components.css
git commit -m "feat: simplify text question learning flow"
```

## 작업 3: 홈과 텍스트 Part 목록 단순화

**파일**

- 수정: `src/features/home/HomeScreen.tsx`
- 수정: `src/features/part/PartDetailScreen.tsx`
- 수정: `src/features/part/questionFilters.ts`
- 수정: `src/features/part/questionFilters.test.ts`
- 수정: `src/app/App.integration.test.tsx`
- 수정: `src/styles/components.css`

### 1. 실패 테스트 작성

- 홈의 Part 카드가 Part 번호·이름·전체 수·내 답변 수·외움 수·공부하기를 표시한다.
- 일반 홈에 개발/검수 badge와 복잡한 텍스트 통계 카드가 없다.
- 텍스트 목록 기본 필터가 전체/미작성/작성 완료/못 외움/외움으로 동작한다.
- 기존 검색·유형·헷갈림 필터는 닫힌 상세 필터에서 계속 동작한다.
- 문제 카드는 ID·중국어·한국어·답변 상태·암기 상태·문제 풀기만 표시한다.

### 2. RED 확인

```sh
npm test -- --run src/app/App.integration.test.tsx src/features/part/questionFilters.test.ts
```

### 3. 최소 구현

- Home의 기존 데이터 로드는 재사용하되 Part 카드 집계만 앞에 표시한다.
- visual production opt-in guard와 마지막 학습 정보 저장은 유지한다.
- PartDetail의 검색/유형/세부 review 필터 state는 유지하고 닫힌 상세 필터로 옮긴다.
- 단순 필터를 기존 `filterQuestionItems` 입력으로 변환하거나 작은 view filter를 추가한다.
- 가이드와 원본 상태 안내는 닫힌 추가 자료로 이동한다.

### 4. GREEN 확인 및 커밋

```sh
npm test -- --run src/app/App.integration.test.tsx src/features/part/questionFilters.test.ts
git add src/features/home/HomeScreen.tsx src/features/part/PartDetailScreen.tsx src/features/part/questionFilters.ts src/features/part/questionFilters.test.ts src/app/App.integration.test.tsx src/styles/components.css
git commit -m "feat: simplify home and text part lists"
```

## 작업 4: Part 2 네 질문 인라인 학습

**파일**

- 추가: `src/features/part2/VisualQuestionLearningCard.tsx`
- 수정: `src/features/part2/Part2SetScreen.tsx`
- 수정: `src/features/part2/VisualQuestionScreen.tsx`
- 수정: `src/app/Part2App.integration.test.tsx`
- 수정: `src/styles/components.css`

### 1. 실패 테스트 작성

- 세트 상세의 질문 4개 각각에 별도 textarea·저장·못 외움·외움이 있다.
- Q1과 Q2 답변 저장이 서로 다른 `visual_question` PracticeDraft로 남는다.
- Q1과 Q2 암기 상태가 서로 다른 ReviewState로 남는다.
- 한 질문 저장이 다른 질문 입력이나 상태를 바꾸지 않는다.
- VisualQuestion 상세도 같은 단순 인라인 흐름을 제공한다.
- 세트 실전 route와 원본 추천 답변 route/패널은 계속 동작한다.

### 2. RED 확인

```sh
npm test -- --run src/app/Part2App.integration.test.tsx src/features/exam/ExamScreens.test.tsx
```

### 3. 최소 구현

- 기존 세트 로더의 drafts/reviews를 질문별 초기값으로 전달한다.
- 카드마다 `target_type = visual_question`, 실제 `visual_question_id`를 사용한다.
- LanguageBlock 또는 원문 표시 다음에 공통 컴포넌트를 배치한다.
- 실전 모드와 개별 상세는 보조 링크로 유지한다.

### 4. GREEN 확인 및 커밋

```sh
npm test -- --run src/app/Part2App.integration.test.tsx src/features/exam/ExamScreens.test.tsx
git add src/features/part2/VisualQuestionLearningCard.tsx src/features/part2/Part2SetScreen.tsx src/features/part2/VisualQuestionScreen.tsx src/app/Part2App.integration.test.tsx src/styles/components.css
git commit -m "feat: add inline Part 2 question practice"
```

## 작업 5: Part 7 세트 인라인 학습

**파일**

- 수정: `src/features/part7/Part7SetScreen.tsx`
- 수정: `src/app/Part7App.integration.test.tsx`
- 수정: `src/styles/components.css`

### 1. 실패 테스트 작성

- 네 이미지 다음에 `내 이야기 답변` textarea가 표시된다.
- 저장 시 `target_type = visual_set` PracticeDraft를 completed로 upsert한다.
- 수정 저장이 같은 VisualSet draft를 갱신한다.
- 답변 저장은 ReviewState를 바꾸지 않는다.
- 못 외움/외움을 별도로 저장한다.
- StoryGuide와 데이터 연결 상태는 닫힌 추가 자료에 유지된다.
- 기존 이야기 구조 편집·회상 route가 유지된다.

### 2. RED 확인

```sh
npm test -- --run src/app/Part7App.integration.test.tsx
```

### 3. 최소 구현

- 공통 컴포넌트를 `visual_set` target으로 사용한다.
- 기존 `story_keywords`, `story_points`는 repository upsert로 보존한다.
- StoryGuide, 공통 지시문, 연결 후보는 닫힌 추가 학습 자료로 이동한다.
- `이야기 구조 연습하기` 링크로 기존 editor를 유지한다.

### 4. GREEN 확인 및 커밋

```sh
npm test -- --run src/app/Part7App.integration.test.tsx
git add src/features/part7/Part7SetScreen.tsx src/app/Part7App.integration.test.tsx src/styles/components.css
git commit -m "feat: simplify Part 7 story practice"
```

## 작업 6: 문서와 전체 회귀 검증

**파일**

- 수정: `README.md`
- 수정: `docs/IMPLEMENTATION_STATUS.md`
- 수정: `docs/UI_SPEC.md`
- 수정: `docs/SCREEN_DATA_CONTRACT.md`
- 수정: `docs/NAVIGATION_FLOW.md`
- 수정: `docs/DECISIONS.md`
- 필요 시 수정: `src/styles/base.css`

### 1. 계약 문서 갱신

- 일반 학습의 기본 흐름과 보조 기능 배치를 기록한다.
- PracticeDraft/UserAnswer/ReviewState 의미가 바뀌지 않았음을 명시한다.
- Part 2는 질문별, Part 7은 세트별 저장 단위를 유지한다고 기록한다.
- 실전·교정·검수·provenance·기존 route가 유지됨을 기록한다.

### 2. 전체 검증

```sh
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run check:data
```

추가로 필요 시:

```sh
npm run check
```

### 3. 브라우저 스모크 검증

- 홈에서 Part 1~7 카드와 단순 집계를 확인한다.
- 텍스트 문제의 답변 저장·상태 저장·다음 문제를 확인한다.
- Part 2 세트에서 Q1/Q2 별도 저장을 확인한다.
- Part 7 세트 답변 저장을 확인한다.
- Part 2/3 실전 route, Part 4 구조 편집, 교정 route를 확인한다.
- 320px에서 가로 overflow와 콘솔 오류를 확인한다.

### 4. 최종 커밋

```sh
git diff --check
git status --short
git add README.md docs/IMPLEMENTATION_STATUS.md docs/UI_SPEC.md docs/SCREEN_DATA_CONTRACT.md docs/NAVIGATION_FLOW.md docs/DECISIONS.md src/styles/base.css src/styles/components.css
git commit -m "docs: record simplified learning flow"
```

## 완료 기준

- 일반 학습 화면에서 3초 안에 질문과 답변 입력 위치를 찾을 수 있다.
- 답변 저장과 암기 상태 저장이 독립적이다.
- Part 2는 VisualQuestion별, Part 7은 VisualSet별 저장된다.
- 기존 라우트와 실전·교정·복습·검수·가이드 데이터가 삭제되지 않는다.
- 전체 Vitest, typecheck, lint, build, data check가 통과한다.
