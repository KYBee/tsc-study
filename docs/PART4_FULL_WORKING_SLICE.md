# Part 4 전체 working slice

## 목적과 데이터 출처

기존 6문제 수직 기능을 유지하면서 실제 AI 없이도 Part 4 전체 50문제를 작성·저장·복습할 수 있도록 확장했다.

- 공용 문제·AnswerPoint·workbook 가이드: `data/working/full-import-v1/`
- 강의 기반 공통 가이드·표현·드릴·인사이트: `data/working/course-import-v1/`
- 앱 fixture: `data/working/app-fixtures/part4-full/`
- dataset ID: `part4-full-working-development-fixture-v2`

fixture는 raw/review_needed working 데이터이며 reviewed 또는 production 데이터가 아니다. 원본의 중국어·병음·한국어를 수정하지 않았고 `ModelAnswer`를 만들지 않았다. workbook 가이드와 3급 목표 강의 자료도 검수된 하나의 전략으로 병합하지 않는다.

## 범위

| 데이터 | 수 |
|---|---:|
| `Question` | 50 |
| `AnswerPoint` | 50 |
| `PartGuide` | 2 |
| `LearningExpression` | 13 |
| `PracticeDrill` | 2 |
| `CourseInsight` | 6 |
| `ModelAnswer` | 0 |

기존 6문제 fixture는 회귀 검증용으로 그대로 보존한다.

## PracticeDraft와 UserAnswer

`PracticeDraft`는 교정 전 원문이다. 사용자가 `연습 초안 저장`을 눌렀을 때만 IndexedDB에 저장하고 질문당 활성 초안 하나를 upsert한다. 교정 중국어·병음·한국어 또는 개인 `Correction`을 만들지 않는다.

`UserAnswer`는 지원되는 mock 성공 결과를 사용자가 명시적으로 승인한 경우만 저장한다. 같은 Question에 `PracticeDraft`와 `UserAnswer`가 동시에 있어도 정상이며, 승인 저장 시 초안을 자동 삭제하지 않는다.

## IndexedDB migration

- DB 이름: `tsc-study-part4-fixture-v1` 유지
- v1: `userAnswers`, `reviewStates`, `corrections`
- v2: 기존 store와 레코드를 보존하고 `practiceDrafts` 추가
- `practiceDrafts` keyPath: `practice_draft_id`
- unique index: `question_id`

v1 데이터를 실제로 만든 뒤 v2로 열어 기존 `UserAnswer`, `ReviewState`, `Correction`이 유지되는지 테스트한다.

## 화면 흐름

```text
HOME
→ Part 4 50문제
→ 검색·유형·복습 상태·작성 상태 필터 또는 랜덤
→ 문제 상세
→ 연습 초안 저장
→ 지원되는 경우 mock 교정
→ 사용자 승인 후 UserAnswer
→ 나의 답변의 교정 완료/연습 초안
→ 50문제 복습
```

문제 상세에서는 이전·다음·랜덤 이동, 병음·한국어 표시 제어, workbook 원본 AnswerPoint, 강의 기반 기초 구조·표현·드릴·인사이트를 출처 성격별로 제공한다. 마지막으로 방문한 유효 question_id는 HOME의 이어서 보기에 사용한다.

## mock 제한

P4-006의 문서화된 운동 장소 중국어 입력과 이미 교정된 결과만 완전한 deterministic 성공을 지원한다. 다른 입력은 원문을 보존한 `unsupported_by_mock`이며 초안 저장은 가능하지만 `UserAnswer`와 `Correction` 저장은 불가능하다. 실제 AI API, 백엔드와 API 키는 없다.

## 검증 결과

- fixture 2회 생성 JSON SHA-256: 모두 동일
- `--validate-only`: 파일 변경 없음
- Part 4 full fixture Python unittest: 10개 통과
- course-import Python unittest: 58개 통과
- full-import Python unittest: 27개 통과
- Vitest: 9개 파일, 58개 통과
- IndexedDB v1→v2 migration: 기존 `UserAnswer`·`ReviewState`·`Correction` 보존 테스트 통과
- TypeScript typecheck, ESLint, Vite production build: 통과
- `npm run check:data`, `npm run check`: 통과
- 실제 브라우저: 320×800, 가로 overflow 없음(`scrollWidth = clientWidth = 320`), 최종 콘솔 오류 0건

브라우저에서 중·한 검색, 유형 필터, 결과 내 랜덤, 문제 상세, 표시 토글, 초안 저장과 새로고침 복원, 연습 초안 탭, 미지원 mock 차단, P4-006 성공 교정과 승인, 동일 Question의 초안·승인 답변 공존, 복습 상태 변경과 HOME 이어서 보기를 확인했다.

fixture JSON SHA-256:

| 파일 | SHA-256 |
|---|---|
| `questions.json` | `7232921b5a9a8d21af4d2d962a027af5362d7c2590ccdece8c644c803baf6d04` |
| `answer-points.json` | `1ab5a599b0e26eafbf48a8448ffac7cb43aff617ddd25fec6f4d1ba1b83759bd` |
| `sources.json` | `0314c4d7d74eaec6534046828ad1bfab32216320cd2e89c0cf5aa2cb5b1ab39a` |
| `source-references.json` | `ffa2b7235cc7b83dd023dd4607cb3a5dac1d874602175f6c2a2f13f4b87634fe` |
| `part-guides.json` | `869b4af2a5bd8c9fb068cba201345e5ec8464da5890cbac05f9ce4a8404ee5af` |
| `learning-expressions.json` | `c0dfa3c3a5dd7c0ab92a2aa5261311bb354b8fdef53f65ce7b8a14a4f77605a0` |
| `practice-drills.json` | `da9e15cd72aefa853b69ed0ed8dae12b5d60b52b636b8939a28d92967a543d42` |
| `course-insights.json` | `8110c81927ae155d912c22fb50bd81b39c905a2b4d53222df52dfca92a5ae1b4` |
| `model-answers.json` | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` |
| `manifest.json` | `3d86028aa1cc1c1e8b6dec62621a9bb18c9aaa208691c50158902bab5c5587ff` |

## 알려진 제한

- 모든 문제는 사람 검수 전 working 데이터다.
- `ModelAnswer`가 없고 실제 AI도 없다.
- 공통 강의 자료는 특정 Question의 정답이 아니다.
- Part 1·2·3·5·6·7과 시각 자료 화면은 구현하지 않았다.
- 개인 데이터는 현재 브라우저와 origin에 종속된다.
- 로그인, 동기화, 내보내기·가져오기와 배포는 없다.

## 다음 작업

1. Part 4 원문·병음·한국어·출처·AnswerPoint를 사람 검수한다.
2. 검수 통과 데이터의 reviewed canonical JSON 승격 절차를 만든다.
3. 실제 AI 공급자와 서버 경계를 별도 승인한다.
4. 개인 데이터 백업·이관 요구를 결정한다.
5. 다음 Part 구현은 해당 데이터와 화면 계약 검수 후 시작한다.
