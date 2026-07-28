# 구현 상태

## 현재 구현 범위

현재 React 앱은 Part 4의 검수 전 working 문제 50개를 대상으로 다음 흐름을 제공한다.

```text
HOME
→ Part 4 50문제 검색·필터·랜덤 선택
→ 문제 상세와 공통 강의 자료
→ 연습 초안 저장
→ 지원되는 경우 deterministic mock 교정
→ 사용자 승인 후 교정 완료 답변 저장
→ 50문제 복습 상태 변경
→ 개인 실수와 마지막 학습 위치 확인
```

Part 1·2·3·5·6·7 화면, 실제 AI, 백엔드, 로그인·동기화와 배포는 구현하지 않았다.

## 앱 개발 fixture

- dataset ID: `part4-full-working-development-fixture-v2`
- 경로: `data/working/app-fixtures/part4-full/`
- 입력: `data/working/full-import-v1/`, `data/working/course-import-v1/`

| 엔터티 | 수 |
|---|---:|
| `Question` | 50 |
| `AnswerPoint` | 50 |
| `PartGuide` | 2 |
| `LearningExpression` | 13 |
| `PracticeDrill` | 2 |
| `CourseInsight` | 6 |
| `ModelAnswer` | 0 |

workbook과 강의 `PartGuide`를 하나의 검수된 가이드로 병합하지 않는다. 강의 자료의 `course_target_context = level_3`도 유지한다. 표현·드릴·인사이트는 Part 4 공통 보조 자료이며 특정 Question의 정답이 아니다. 기존 6문제 fixture `part4-raw-development-fixture-v1`도 삭제하지 않았다.

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
- 버전: `3`

| object store | keyPath | 규칙 |
|---|---|---|
| `userAnswers` | `user_answer_id` | unique `question_id`, 승인 답변만 upsert |
| `reviewStates` | `review_state_id` | unique 대상, 사용자가 상태를 선택할 때만 생성 |
| `corrections` | `correction_id` | 승인 답변의 실제 변경만 저장 |
| `practiceDrafts` | `practice_draft_id` | unique `question_id`, 빈 원문 금지, 질문당 활성 초안 하나 upsert |
| `reusablePhrases` | `reusable_phrase_id` | 사용자가 명시적으로 저장한 개인 원문 표현 |
| `recallAttempts` | `recall_attempt_id` | 암기 모드와 사용자가 선택한 상세 회상 결과 |

v2에서 v3로 올릴 때 기존 네 store와 레코드를 유지한 채 재사용 표현과 회상 이력 store만 추가한다. 검수 전용 DB에는 영향을 주지 않는다.

## 구현 화면

- HOME: 50문제, 초안·교정 답변·복습 상태 통계, 이어서 보기, 랜덤 시작
- Part 4: 중국어·한국어 검색, 유형·복습·작성 상태 필터, 결과 내 랜덤
- 문제 상세: 이전·다음·랜덤, 병음·한국어 토글, AnswerPoint, 출처 성격이 분리된 공통 강의 자료
- 답변 작성: 질문 이해, 네 구간 키워드 설계, 구조별/전체 작성, 초안·완료 저장, 기존 mock 교정
- 암기 연습: 전체·중국어·키워드·질문만 보기, 명시적 답변 공개와 회상 결과 저장
- 나의 답변: `교정 완료`와 `연습 초안` 분리
- 복습: 상태 없음 포함 50문제, 검색·유형·상태 필터, 랜덤, 상세 이동
- 실수 노트: 승인 저장에서 생성된 개인 Correction만 표시

## mock 교정과 ModelAnswer

P4-006의 문서화된 중국어 입력과 이미 교정된 입력만 완전한 성공 결과를 지원한다. 그 밖의 중국어·한국어·혼합 입력은 원문을 유지한 `unsupported_by_mock`으로 처리한다. `ModelAnswer`는 0개이며 화면에서 `아직 모범답안 없음`을 정상 상태로 표시한다.

## 검증

완료 전 전체 fixture 생성·검증, Python unittest, IndexedDB migration 테스트, Vitest, typecheck, lint, production build, `npm run check:data`, `npm run check`와 320px 실제 브라우저 흐름을 실행한다. 최종 명령별 수와 결과는 [PART4_FULL_WORKING_SLICE.md](PART4_FULL_WORKING_SLICE.md)에 기록한다.

## 알려진 제한

- 50문제는 모두 raw/review_needed working 데이터이며 사람 검수 전이다.
- 중국어·병음·한국어를 수정하지 않았고 `ModelAnswer`를 만들지 않았다.
- 실제 AI와 자연스럽게·Level 8 확장 결과는 없다.
- 강의 기반 가이드는 3급 과정 맥락의 기초 전략이며 Level 8 공식 기준이 아니다.
- 개인 데이터는 현재 브라우저와 origin에 종속된다.
- 전체 253문제, 시각 문제와 다른 Part는 앱에 연결하지 않았다.

## 다음 추천 작업

1. `/data-review/part4`에서 Part 4 언어·출처와 AnswerPoint를 사람이 검수하고 결정 JSON을 내보낸다.
2. 내보낸 결정을 검토한 뒤 승격 CLI로 승인 항목만 reviewed JSON에 반영한다.
3. reviewed 부분 데이터의 앱 연결 정책을 별도 결정한다.
4. 실제 AI 공급자와 비밀키를 보호할 서버 경계를 승인 후 결정한다.
5. 다음 Part는 데이터 검수와 화면별 계약을 확인한 뒤 선택한다.

## Part 4 로컬 검수 도구

- fixture: `part4-review-fixture-v1`, 50개 검수 항목
- 화면: 개발 환경의 `/data-review/part4`
- 저장: 학습 DB와 분리된 `tsc-study-data-review-v1` / `part4ReviewDecisions`
- 기능: 일곱 필드 결정, 전체 상태 계산, 검색·필터, stale 판정, JSON 내보내기·가져오기·초기화
- 승격: `scripts/promote_part4_reviewed_data.py --decisions <path>`

도구와 승격 규칙만 구현했다. 실제 사람 결정 파일, 기본 경로의 reviewed 데이터와 앱 source 전환은 아직 없다. 자세한 계약은 [PART4_REVIEW_WORKFLOW.md](PART4_REVIEW_WORKFLOW.md)를 따른다.
