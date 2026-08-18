# 기본 학습 흐름 단순화 설계

## 목적

현재의 학습·실전·교정·검수 기능과 데이터 계약을 보존하면서 일반 학습 화면의 첫 행동을 다음 흐름으로 단순화한다.

```text
Part 선택 → 문제 확인 → 내 답변 입력·저장 → 못 외움/외움 선택 → 다음 문제
```

이번 변경은 기능 삭제나 데이터 마이그레이션이 아니다. 기존의 구조화 답변, AI 교정, 실전 모드, 회상, 가이드, 출처 및 검수 정보는 보조 행동이나 접힌 영역으로 이동한다.

## 검토한 접근

### 1. 기존 화면에 공통 인라인 컴포넌트 추가 — 채택

- `SimpleAnswerEditor`가 `PracticeDraft`를 저장한다.
- `LearningStatusButtons`가 `ReviewState`를 저장한다.
- 텍스트 Question, Part 2 VisualQuestion, Part 7 VisualSet 화면에서 같은 저장 계약을 재사용한다.
- 기존 라우트와 상세 편집기는 그대로 둔다.

장점은 데이터·라우트 변경 없이 가장 작은 범위로 기본 행동을 앞에 배치할 수 있다는 점이다.

### 2. 기존 AnswerEditor를 문제 화면에 그대로 삽입 — 제외

교정, 완료, 회상, 재사용 표현까지 한꺼번에 노출되어 단순화 목적과 맞지 않는다. 기존 편집기는 보조 경로로 유지한다.

### 3. 별도의 간편 학습 라우트 추가 — 제외

기존 문제 화면과 간편 화면이 중복되고 사용자가 어느 경로를 써야 하는지 다시 판단해야 한다. 이번 목표인 클릭 수 감소에도 불리하다.

## 공통 저장 계약

### 인라인 답변

- 인라인 저장은 기존 `PracticeDraft`를 target별로 upsert한다.
- 텍스트 문제는 `target_type = question`과 `question_id`를 사용한다.
- Part 2 세부 질문은 `target_type = visual_question`을 사용한다.
- Part 7 스토리 세트는 `target_type = visual_set`을 사용한다.
- 저장한 인라인 답변은 `original_input`과 `full_text`에 같은 사용자 원문을 기록하고 `completion_status = completed`로 표시한다.
- 기존 구조화 필드와 스토리 필드는 repository의 additive upsert 동작으로 보존한다.
- 빈 답변은 저장하지 않으며, 실패하면 입력을 유지하고 오류를 표시한다.
- 저장 성공은 `저장되었습니다.`로 알리고 페이지를 다시 불러오지 않는다.
- 답변 저장은 `ReviewState`를 만들거나 변경하지 않는다.

초기 표시 우선순위는 다음과 같다.

1. 현재 target의 `PracticeDraft.full_text`
2. `PracticeDraft.original_input`
3. 텍스트 Question에 PracticeDraft가 없고 승인된 `UserAnswer`만 있으면 `UserAnswer.original_input`
4. 빈 문자열

교정 결과는 인라인 원문을 덮어쓰지 않고 보조 영역에 별도로 유지한다.

### 입력 언어

기존 draft의 `input_language`가 있으면 유지한다. 새 입력은 원문을 생성·번역하지 않고 문자 구성만으로 `ko | zh | mixed`를 결정한다. 애매하면 `mixed`로 보존한다.

### 암기 상태

- 기본 화면에는 `못 외움`, `외움` 두 버튼만 표시한다.
- 두 버튼은 기존 `ReviewState.learning_status` 값에 직접 매핑한다.
- 기존 `헷갈림` 레코드와 ReviewScreen의 세 단계 기능은 유지한다.
- 현재 상태가 `헷갈림`이면 데이터는 그대로 두고 기본 화면에서는 선택되지 않은 두 버튼과 짧은 현재 상태 안내만 제공한다.
- 상태 저장은 답변 저장과 독립적인 명시적 행동이다.

## 공통 컴포넌트

### `SimpleAnswerEditor`

책임:

- 저장된 원문을 textarea에 복원한다.
- 사용자 편집 상태를 관리한다.
- 빈 입력 차단, 저장 중 상태, 성공·실패 피드백을 제공한다.
- target에 맞는 `PracticeDraft`를 upsert한다.
- 별도 답변 편집·교정 경로로 가는 보조 링크를 선택적으로 표시한다.

컴포넌트는 질문 데이터나 ModelAnswer를 수정하지 않는다.

### `LearningStatusButtons`

책임:

- 현재 `ReviewState`를 표시한다.
- `못 외움` 또는 `외움`을 명시적으로 저장한다.
- 저장 실패를 화면에 알리고 기존 상태를 유지한다.

### Part 2 질문 학습 카드

Part 2 세트 한 화면의 네 질문마다 언어 묶음, `SimpleAnswerEditor`, `LearningStatusButtons`를 조합한다. 각 카드의 target ID는 반드시 해당 `visual_question_id`다.

## 화면 설계

### 홈

- 상단의 복잡한 전체 통계와 행동 대시보드를 기본 흐름에서 제거한다.
- Part 1~7 카드를 첫 핵심 콘텐츠로 배치한다.
- 카드에는 Part 번호·이름·간단한 설명·전체 수·내 답변 수·외움 수와 `공부하기`만 표시한다.
- Part 2·7의 production opt-in/권리 경계는 유지한다. 비활성 환경에서는 기존 안전 안내를 유지한다.
- `raw`, `review_needed`, `development_fixture` 같은 데이터 상태는 홈 카드에서 표시하지 않는다.

### 텍스트 Part 목록

- 기본 필터를 `전체`, `미작성`, `작성 완료`, `못 외움`, `외움`으로 제공한다.
- 검색, 유형, 헷갈림 등 기존 상세 필터는 닫힌 `상세 필터` 안에 보존한다.
- 카드에는 ID, 중국어, 한국어, 답변 상태, 암기 상태와 `문제 풀기`만 표시한다.
- PartGuide와 원본 상태 안내는 닫힌 `추가 학습 자료`로 이동한다.

### 일반 텍스트 문제

주요 순서는 다음과 같다.

1. Part·문제 ID와 중국어·병음·한국어
2. `내 답변` 인라인 편집기
3. `암기 상태` 두 버튼
4. 이전·다음 문제

Part 4의 기존 질문 이해→설계→작성→암기 흐름은 `답변 구조 연습하기` 보조 링크로 유지한다. Part 3 실전 모드는 `실전 모드` 보조 링크로 유지한다. AI 교정은 저장된 답변이 있을 때 `답변 다듬기` 보조 행동으로 제공한다.

AnswerPoint, workbook/course guide, LearningExpression, PracticeDrill, CourseInsight, ModelAnswer, 교정 완료 UserAnswer와 데이터 상태는 기본적으로 닫힌 `추가 학습 자료 보기` 또는 `데이터 정보` 안에 유지한다.

### Part 2

- 세트 상세에서 그림을 먼저 표시한다.
- 네 VisualQuestion을 한 화면에 각각 독립 카드로 표시한다.
- 각 카드가 별도 `PracticeDraft`와 `ReviewState`를 읽고 저장한다.
- 기존 VisualQuestion 상세·답변·회상·실전 라우트와 원본 추천 답변은 유지한다.
- 추천 답변과 실전 모드는 보조 행동으로 둔다.

### Part 7

- 세트 상세에서 네 장의 그림을 먼저 표시한다.
- 그 아래에 VisualSet 대상의 `내 이야기 답변` textarea와 저장 버튼, 두 상태 버튼을 표시한다.
- 기존 StoryGuide, 공통 지시문, 연결 후보, 이야기 포인트 편집기는 닫힌 추가 학습 자료와 `이야기 구조 연습하기` 보조 링크로 유지한다.

## 오류와 접근성

- textarea는 명시적인 label과 target별 고유 ID를 가진다.
- 저장 메시지는 `role=status`, 오류는 `role=alert`로 알린다.
- 현재 상태는 색상뿐 아니라 버튼의 `aria-pressed`와 텍스트로 표시한다.
- 저장 중 중복 요청을 막되 답변 입력은 지우지 않는다.
- 320px에서도 주요 순서가 세로 한 열로 유지되고 이전·다음 버튼이 화면 밖으로 넘치지 않게 한다.

## 테스트 전략

컴포넌트 단위에서 공통 저장 동작을 먼저 실패하는 테스트로 작성하고, 화면 통합 테스트에서 다음을 확인한다.

- 기존 답변 복원과 UserAnswer 원문 fallback
- 새 답변 저장과 수정 upsert
- 못 외움·외움 저장
- 답변 저장과 암기 상태의 독립성
- 다음 문제 이동
- Part 2 네 VisualQuestion의 답변·상태 분리
- Part 7 VisualSet 답변 저장
- Part 2·3 실전 라우트와 기존 상세 답변 라우트 회귀
- 기존 ReviewScreen, CorrectionResultScreen, Part 4 구조화 편집기 회귀

완료 전 `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:data`를 실행한다.

## 범위 밖

- 저장 엔터티나 IndexedDB 버전 변경
- 기존 실전·교정·복습 알고리즘 변경
- 답변 자동 생성·번역·교정
- 원본·working·reviewed 데이터 변경
- 기존 라우트 삭제
- 대규모 디자인 시스템 또는 라우팅 리팩터링
