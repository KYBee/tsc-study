# 구현 상태

## 현재 구현 범위

현재 React 앱은 Part 1·3·4·5·6의 검수 전 working 텍스트 문제 193개,
Part 2 그림 12세트·VisualQuestion 48개와 Part 7 스토리
그림 12세트를 대상으로 다음
흐름을 제공한다.

```text
HOME
→ 텍스트 Part 선택
→ 193문제 공통 검색·필터·랜덤 선택
→ 문제 상세와 공통 강의 자료
→ Part 1·3·5·6 자유 입력 또는 Part 4 구조화 입력
→ PracticeDraft 저장·완료
→ 지원되는 경우 deterministic mock 교정
→ 사용자 승인 후 교정 완료 답변 저장
→ 파트별 복습·회상 상태 변경
→ 개인 실수와 마지막 학습 위치 확인

HOME
→ Part 2 그림 세트 12개
→ 그림과 세부 질문 4개
→ VisualQuestion 자유 입력 PracticeDraft
→ 검수 전 원본 추천 답변 비교
→ 그림 기반 회상·ReviewState

HOME
→ Part 7 스토리 그림 12세트
→ VisualSet과 원본 StoryGuide
→ 내 키워드·순서 포인트·전체 이야기 PracticeDraft
→ 그림·내 포인트 기반 회상·ReviewState
```

실제 AI, 백엔드, 로그인·동기화와 배포는 구현하지 않았다.
Part 2 12장과 Part 7 48장의 이름 지정 working 이미지 바이트는 Git에
보존한다. 권리 상태는 `review_needed`/`public_allowed = false`다. 개발
서버에서는 검증 라우트로 제공하고 production은 기본 제외한다. 단,
운영자가 `VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS=true`를 명시한 build에서는
동일한 60개 allowlist와 무결성 검증을 통과한 바이트만 제공한다. 이 설정은
권리 승인으로 간주하지 않는다.

## 앱 개발 fixture

- dataset ID: `text-parts-working-development-fixture-v1`
- 경로: `data/working/app-fixtures/text-parts-v1/`
- 입력: `data/working/full-import-v1/`, `data/working/course-import-v1/`

| 엔터티 | 수 |
|---|---:|
| `Question` | 193 |
| `AnswerPoint` | 193 |
| `PartGuide` | 10 |
| `LearningExpression` | 29 |
| `PracticeDrill` | 5 |
| `CourseInsight` | 8 |
| `ModelAnswer` | 0 |

workbook과 강의 `PartGuide`를 하나의 검수된 가이드로 병합하지 않는다. 강의 자료의 `course_target_context = level_3`도 유지한다. 표현·드릴·인사이트는 Part 공통 보조 자료이며 특정 Question의 정답이 아니다. 기존 6문제 및 Part 4 50문제 fixture도 삭제하지 않았다.

Part 2 fixture ID는 `part2-visual-working-development-fixture-v1`이다.
VisualSet·VisualAsset·VisualSetAsset이 각 12개, VisualQuestion과 그 대상
ModelAnswer가 각 48개다. 엄격 근거 Question 연결 18개와 미연결 30개를
그대로 유지하며 추천 답변은 `review_needed`, `unverified_source`다.

Part 7 fixture ID는 `part7-visual-working-development-fixture-v1`이다.
VisualSet·StoryGuide·Part 7 Question은 각 12개이고, 세트별 네 장면을
보존하는 VisualAsset·VisualSetAsset은 각 48개다. 확정 QuestionVisualSet과
ModelAnswer는 0개다. 숫자 접미사 기반
후보 12개는 `candidate`, `review_needed`, `not_canonical`로만 보존한다.

## 개인 데이터 흐름

```text
원문 입력 → 명시적 초안 저장 → IndexedDB PracticeDraft

지원되는 mock 성공
→ 사용자 승인
→ IndexedDB UserAnswer + 실제 변경 Correction

상태 버튼 선택 → IndexedDB ReviewState
문제 상세 방문 → localStorage 마지막 학습 위치
교정 화면 이동·새로고침 → sessionStorage 임시 세션
```

`PracticeDraft`는 교정 전 원문이며 `UserAnswer`가 아니다. 같은 Question에 둘이 동시에 존재할 수 있고 교정 답변 승인 시 초안을 자동 삭제하지 않는다. 미지원 mock 결과는 `UserAnswer`나 `Correction`으로 저장할 수 없다.

## IndexedDB

- DB 이름: `tsc-study-part4-fixture-v1` 유지
- 버전: `5`

DB 이름에 Part 4가 남아 있지만 기존 개인 데이터 보존을 위해 이름은
바꾸지 않았다. v4는 `question | visual_question` 대상 인덱스를 additive하게
추가하며 v3 레코드를 `target_type = question`으로 보존한다. v5는 store나
인덱스를 다시 만들지 않고 `visual_set` target을 허용한다. 이름 변경은
명시적 migration 설계가 필요한 기술 부채다.

| object store | keyPath | 규칙 |
|---|---|---|
| `userAnswers` | `user_answer_id` | unique `question_id`, 승인 답변만 upsert |
| `reviewStates` | `review_state_id` | unique 대상, 사용자가 상태를 선택할 때만 생성 |
| `corrections` | `correction_id` | 승인 답변의 실제 변경만 저장 |
| `practiceDrafts` | `practice_draft_id` | unique target, 빈 개인 내용 금지, Question·VisualQuestion·VisualSet당 활성 초안 하나 upsert |
| `reusablePhrases` | `reusable_phrase_id` | 사용자가 명시적으로 저장한 개인 원문 표현과 source target |
| `recallAttempts` | `recall_attempt_id` | 대상별 암기 모드와 사용자가 선택한 상세 회상 결과 |

v2→v3의 기존 store 추가 뒤 v3→v4는 target 필드와 인덱스만 추가한다.
v4→v5는 다형 target 값만 넓히는 비파괴 migration이다.
기존 UserAnswer·Correction·ReviewState·PracticeDraft·ReusablePhrase·
RecallAttempt를 보존하며 검수 전용 DB에는 영향을 주지 않는다.

## 구현 화면

- HOME: 193문제와 Part별 초안·완료·복습 상태, 이어서 보기, 랜덤 시작
- Part 2: 12세트 목록·상태 필터·랜덤, 큰 그림·확대, 48개 세부 질문
- Part 2 답변·암기: 자유 입력 초안, 접힌 검수 전 추천 답변, 그림+질문·그림·질문 회상
- Part 7: 12세트 목록·상태 필터·랜덤, 큰 그림·확대, StoryGuide와 공통 지시문 경계
- Part 7 답변·암기: 내 키워드·순서 포인트·전체 답변, 그림·포인트 조합 회상
- Part 1·3·4·5·6: 공통 검색, 유형·복습·작성 상태 필터, 결과 내 랜덤
- 문제 상세: 이전·다음·랜덤, 병음·한국어 토글, AnswerPoint, 출처 성격이 분리된 공통 강의 자료
- 답변 작성: Part 4 네 구간 구조화 입력 유지, 다른 Part는 자유 입력 초안·완료 저장
- 암기 연습: Part 4 전용 네 모드와 다른 Part의 전체·답변·질문 모드
- 나의 답변: `교정 완료`와 `연습 초안` 분리 및 Part 필터
- 복습: 텍스트 193개, Part 2 시각 48개와 Part 7 세트 12개, Part·종류·검색·유형·상태 필터, 랜덤
- 실수 노트: 승인 저장에서 생성된 개인 Correction만 표시

## mock 교정과 ModelAnswer

P4-006의 문서화된 중국어 입력과 이미 교정된 입력만 완전한 성공 결과를
지원한다. 텍스트 Question의 `ModelAnswer`는 0개다. Part 2에는 workbook
원문 추천 답변 48개가 있지만 검수 전 출처 답변으로만 표시하며 내 답변으로
자동 저장하거나 AI 결과로 취급하지 않는다.

## 검증

전체 fixture 생성·검증, Python unittest, IndexedDB migration 테스트,
Vitest 143개, typecheck, lint, production build, `npm run check:data`와
`npm run check`를 통과했다. 320px 실제 브라우저에서 Part 7 이야기
작성·복원·완료·회상·나의 답변·복습, Part 2와 텍스트 파트 회귀를
확인했고 console 오류와 가로 오버플로는 0건이었다. Part 7의 상세 결과는
[PART7_STORY_VISUAL_APP_SLICE.md](PART7_STORY_VISUAL_APP_SLICE.md)에
기록한다.

## 알려진 제한

- 50문제는 모두 raw/review_needed working 데이터이며 사람 검수 전이다.
- 중국어·병음·한국어를 수정하지 않았고 `ModelAnswer`를 만들지 않았다.
- 실제 AI와 자연스럽게·Level 8 확장 결과는 없다.
- 강의 기반 가이드는 3급 과정 맥락의 기초 전략이며 Level 8 공식 기준이 아니다.
- 개인 데이터는 현재 브라우저와 origin에 종속된다.
- 전체 253 Question 중 텍스트 193개와 별도 VisualQuestion 48개를
  working 학습에 연결했다. Part 7은 Question 연결 없이 VisualSet 12개를
  직접 학습 대상으로 연결했다.
- Part 2·7 이미지 권리는 미검수다. 기본 production에서는 제외하며,
  명시적 deployment opt-in에서만 검증된 60개를 표시한다.
- Part 7 번호 후보 12건은 실제 QuestionVisualSet 관계가 아니다.

## 다음 추천 작업

1. `/data-review/part4`에서 Part 4 언어·출처와 AnswerPoint를 사람이 검수하고 결정 JSON을 내보낸다.
2. 내보낸 결정을 검토한 뒤 승격 CLI로 승인 항목만 reviewed JSON에 반영한다.
3. reviewed 부분 데이터의 앱 연결 정책을 별도 결정한다.
4. 실제 AI 공급자와 비밀키를 보호할 서버 경계를 승인 후 결정한다.
5. Part 7 번호 후보 12건과 Part 2·7 이미지 공개 권리를 사람이
   검수하고, 승인 결과와 reviewed 앱 연결 정책을 별도 결정한다.

## Part 4 로컬 검수 도구

- fixture: `part4-review-fixture-v1`, 50개 검수 항목
- 화면: 개발 환경의 `/data-review/part4`
- 저장: 학습 DB와 분리된 `tsc-study-data-review-v1` / `part4ReviewDecisions`
- 기능: 일곱 필드 결정, 전체 상태 계산, 검색·필터, stale 판정, JSON 내보내기·가져오기·초기화
- 승격: `scripts/promote_part4_reviewed_data.py --decisions <path>`

도구와 승격 규칙만 구현했다. 실제 사람 결정 파일, 기본 경로의 reviewed 데이터와 앱 source 전환은 아직 없다. 자세한 계약은 [PART4_REVIEW_WORKFLOW.md](PART4_REVIEW_WORKFLOW.md)를 따른다.
