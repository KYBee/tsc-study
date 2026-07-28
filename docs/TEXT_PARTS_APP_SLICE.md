# 전체 텍스트 파트 앱 slice

## 목적과 범위

기존 Part 4 전용 앱을 시각 자료 없이 학습할 수 있는 전체 텍스트 파트로
확장했다. 공용 데이터는 검수 전 working 상태이며 reviewed 데이터나 공식
정답이 아니다.

| Part | Question | AnswerPoint | 입력 방식 |
|---|---:|---:|---|
| 1 | 4 | 4 | 자유 입력 |
| 3 | 84 | 84 | 자유 입력 |
| 4 | 50 | 50 | 기존 네 구간 구조화 입력 |
| 5 | 36 | 36 | 자유 입력 |
| 6 | 19 | 19 | 자유 입력 |
| 합계 | 193 | 193 |  |

Part 2와 Part 7은 이미지와 검증된 시각 연결이 필요하므로 제외한다. 홈에서는
`그림 문제 준비 중`으로 표시하며 존재하지 않는 학습 화면으로 이동시키지
않는다.

## fixture

- dataset ID: `text-parts-working-development-fixture-v1`
- 경로: `data/working/app-fixtures/text-parts-v1/`
- builder: `scripts/build_text_parts_app_fixture.py`
- 입력: `data/working/full-import-v1/`,
  `data/working/course-import-v1/`

fixture에는 Question·AnswerPoint, 실제 필요한 Source·SourceReference,
workbook/course PartGuide, 해당 파트의 LearningExpression·PracticeDrill·
CourseInsight가 들어간다. workbook 가이드와 3급 강의 가이드는 합치지
않으며 강의의 `course_target_context = level_3`을 유지한다.

`ModelAnswer`는 0개다. 표현·드릴·인사이트를 문제별 정답으로 연결하거나
답변으로 변환하지 않는다. 중국어·병음·한국어 원문도 변경하지 않는다.

```sh
python3 scripts/build_text_parts_app_fixture.py
python3 scripts/build_text_parts_app_fixture.py --validate-only
python3 -m unittest scripts.tests.test_build_text_parts_app_fixture -v
```

같은 입력으로 재실행하면 모든 출력 바이트와 SHA-256이 같다.
`--validate-only`는 파일을 변경하지 않는다. 기존 6문제 및 Part 4 50문제
fixture도 삭제하거나 수정하지 않는다.

## 공통 목록과 상세

`/parts/:part`는 Part 1·3·4·5·6에서 공통으로 다음 기능을 제공한다.

- 중국어·한국어·ID·유형 검색
- `question_type`, 복습 상태, 작성 상태 필터
- 현재 결과 안에서 랜덤 문제 선택
- 이전 학습 문제 이어서 보기
- 문제 수와 현재 결과 수

`/questions/:questionId`는 안정적인 `question_id`로 조회하며 중국어 문장을
URL 키로 사용하지 않는다. 문제, 병음, 한국어, AnswerPoint, 실제 존재하는
workbook/강의 가이드, 이전·다음·랜덤 이동과 ReviewState를 표시한다.
병음과 한국어는 사용자가 숨길 수 있다.

## Part 4 전용 UX 유지

Part 4에는 기존 질문 이해 → 답변 설계 → 답변 작성 → 암기 연습 흐름을
그대로 유지한다. 네 구간은 직접 답변, 이유, 경험 또는 예시, 마무리다.
ReusablePhrase, RecallAttempt, P4-006 deterministic mock, 승인 후
UserAnswer·Correction 저장도 유지한다.

다른 파트에 이 구조를 강제하지 않는다. PartGuide나 AnswerPoint 문구를
자동으로 입력 폼 구조로 변환하지도 않는다.

## Part 1·3·5·6 자유 입력

사용자는 한국어·중국어·혼합 중 입력 방식을 고르고 자신의 원문을 쓴다.

- `연습 초안 저장`: `PracticeDraft.completion_status = in_progress`
- `답변 작성 완료`: `PracticeDraft.completion_status = completed`
- `재사용 표현으로 저장`: 사용자가 명시적으로 누른 원문만 개인
  `ReusablePhrase`에 저장
- 삭제: 해당 개인 PracticeDraft만 삭제

앱은 번역, 중국어, 병음, 개인 경험, 요약 또는 표현을 자동 생성하지 않는다.
자유 입력은 mock 교정을 지원하는 것처럼 표시하지 않으며 UserAnswer로
자동 승인하지 않는다.

## 개인 데이터와 암기

기존 학습 DB `tsc-study-part4-fixture-v1`, 버전 3과 모든 object store를
그대로 사용한다. DB 이름에 Part 4가 남아 있는 것은 기존 개인 데이터를
잃지 않기 위한 호환성 결정이며 후속 기술 부채다.

- `practiceDrafts`: 모든 텍스트 파트의 질문별 활성 초안
- `reusablePhrases`: 사용자가 명시적으로 저장한 개인 표현
- `recallAttempts`: 사용자가 선택한 암기 모드와 결과
- `reviewStates`: 사용자가 누른 상태만 저장
- `userAnswers`, `corrections`: 기존 승인 교정 결과

비-Part 4 암기 모드는 전체 보기, 답변만 보기, 질문만 보기다. Part 4의
키워드 모드는 `planning_keywords`가 있을 때만 기존 전용 화면에서 제공한다.
답변 없는 문제도 질문 회상과 ReviewState 기록이 가능하다.

홈·나의 답변·복습은 다섯 파트를 집계하고 필터링한다. fixture 전환 때문에
개인 레코드를 삭제하거나 자동으로 상태를 만들지 않는다. 개발용
`/data-review/part4`와 검수 DB도 변경하지 않는다.

## 검증

- Python은 193 Question, 193 AnswerPoint, Part별 수, P2/P7 제외,
  ModelAnswer 0, 참조 무결성, 결정성, validate-only 무변경을 검사한다.
- Zod는 런타임에서 동일 계약과 SourceReference 대상을 검사하며 오류를 빈
  배열로 숨기지 않는다.
- Vitest는 홈·공통 목록·상세·검색·필터·자유 입력·새로고침 복원·파트별
  나의 답변·복습·회상 및 기존 Part 4 회귀를 검사한다.
- 전체 검증은 `npm run check`, 원본 working 데이터 검증은
  `npm run check:data`로 분리한다.

2026-07-28 실행 결과:

- text-parts Python unittest: 9개 통과
- Vitest: 15개 파일, 98개 테스트 통과
- `npm run typecheck`, `npm run lint`, `npm run build`: 통과
- `npm run check`, `npm run check:data`: 통과
- 실제 Chromium에서 Part 1·3·4·5·6 목록과 상세, 검색·필터·랜덤,
  Part 1·3·5·6 초안 저장과 새로고침 복원, 나의 답변·복습 파트 필터,
  Part 4 구조별 작성 화면을 확인
- 320px viewport에서 문서 가로 overflow 없음
- 위 브라우저 검증 중 console error 0개

## 알려진 제한과 다음 작업

- 193문제는 모두 사람 검수 전 working 데이터다.
- ModelAnswer와 실제 AI가 없다.
- Part 2·7 시각 화면과 이미지 권리 검수가 없다.
- Part 1·3·5·6의 파트별 구조화 답변 UX는 실제 사용 후 결정한다.
- 실제 사용자 답변을 사용해 개인 경험·키워드 뱅크를 설계하되 자동 생성은
  하지 않는다.
- reviewed 데이터 앱 연결, 로그인·동기화·배포는 별도 결정이 필요하다.
