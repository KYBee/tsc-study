# Part 4 첫 수직 기능 구현 계획

> 실제 구현 작업자는 이 계획을 한 단계씩 수행하고 각 완료 조건을 확인한다. 이번 문서는 계획만 정의하며 앱 코드, 패키지와 JSON 데이터를 생성하지 않는다.

**목표:** Part 4 표본으로 문제 조회부터 최소 교정 mock, 승인 답변 저장과 복습 상태 변경까지 한 흐름을 검증한다.

**구조:** 공용 학습 데이터는 읽기 전용 저장소 경계 뒤에 두고, 개인 데이터는 IndexedDB 저장소 경계로 분리한다. 화면은 React Router Declarative 방식으로 연결하며 교정 처리는 교체 가능한 `CorrectionProvider`를 사용한다.

**기술 기준:** React, TypeScript, Vite, React Router Declarative, 일반 CSS와 CSS 변수, IndexedDB

---

## 입력 표본과 공통 제한

- 입력은 `data/working/question-sample/questions.csv`의 Part 4 여섯 행이다.
- 대상 ID는 `P4-001`, `P4-002`, `P4-003`, `P4-006`, `P4-036`, `P4-039`다.
- 여섯 행은 모두 `raw`이며 언어 필드가 있어도 검수 완료 데이터가 아니다.
- `model_answers.csv`는 헤더만 있고 답변 행이 없다.
- `P4-006`의 빈 `source_url`은 정상이며 `P4-039.originality = 정규화`는 `question_status = normalized`를 뜻하지 않는다.
- CSV 원문, 기존 추출 스크립트와 목업 HTML을 수정하지 않는다.
- 목업의 `P4-SPORT-001`과 하드코딩 교정 결과를 실제 데이터로 사용하지 않는다.
- `question_zh`를 식별자나 라우트 키로 사용하지 않는다.
- `AI_CORRECTION_RULES.md`의 P4-006 예시는 교정 계약 테스트 사례이며 ModelAnswer가 아니다.

## 1. 프로젝트 초기화

| 항목 | 내용 |
|---|---|
| 목적 | 합의된 MVP 기술 기준으로 최소 SPA 개발·검증 환경을 만든다. |
| 입력 | `IMPLEMENTATION_BASELINE.md`, `DECISIONS.md`, 현재 빈 앱 코드 상태 |
| 출력 | React + TypeScript + Vite 프로젝트, React Router Declarative 사용 준비, 일반 CSS 진입점, 타입 검사와 테스트 실행 명령 |
| 완료 조건 | 개발 서버와 기본 빌드·타입 검사를 실행할 수 있고, 선택한 패키지 버전과 테스트 도구가 문서화되어 있다. |
| 제외 사항 | UI 라이브러리, 백엔드, 실제 AI, 인증, PWA, 배포 설정 |
| 관련 스키마 엔터티 | 없음. 이 단계에서는 도메인 데이터를 만들지 않는다. |

## 2. 스키마 v1 TypeScript 타입 정의

| 항목 | 내용 |
|---|---|
| 목적 | 구현 코드가 canonical 필드, 상태와 관계를 임의로 바꾸지 않게 한다. |
| 입력 | `DATA_SCHEMA.md`, `SCHEMA_V1_SUMMARY.md`, `SCREEN_DATA_CONTRACT.md` |
| 출력 | 스키마 v1의 공용·개인 엔터티 타입, raw import 행 타입과 화면용 `CorrectionRequest`·`CorrectionResult` 타입 |
| 완료 조건 | `question_id`가 Question 식별자이고 `question_zh`가 unique가 아님을 타입 사용 규칙에 반영한다. 빈 `source_url`과 raw 상태를 표현하고, 질문·답변·AnswerPoint, 공용·개인 데이터, StoryGuide·ModelAnswer와 화면용 CorrectionResult가 분리된 상태로 타입 검사가 통과한다. |
| 제외 사항 | 데이터베이스 모델, ORM, 실제 데이터 인스턴스, CorrectionResult 전체를 canonical Correction으로 취급하는 타입 |
| 관련 스키마 엔터티 | `Source`, `SourceReference`, `Question`, `AnswerPoint`, `ModelAnswer`, `PartGuide`, `Correction`, `UserAnswer`, `ReviewState`와 시각 자료 엔터티 |

## 3. 표본 CSV를 임시 앱 JSON으로 변환

| 항목 | 내용 |
|---|---|
| 목적 | 전체 추출 없이 Part 4 표본을 첫 수직 기능에서 읽을 수 있는 개발 전용 입력으로 만든다. |
| 입력 | `data/working/question-sample/questions.csv`, 헤더만 있는 `model_answers.csv`, `DATA_FORMAT_DECISION.md` |
| 출력 | `data/working/app-fixtures/part4/` 아래 Part 4 여섯 Question, 원문 그대로의 `AnswerPoint`, 실제 workbook `Source`와 `SourceReference`를 담은 deterministic 개발 전용 JSON |
| 완료 조건 | 여섯 canonical ID와 원본 문자열·빈 값·상태·`source_locator`를 보존하고 JSON 배열은 안정적인 ID 순서로 생성한다. 원본 행 순서는 검증 근거로 비교하되 암묵적인 화면 순서로 사용하지 않는다. `answer_point`는 자동 분해하지 않고 결정적 ID, `point_type = unclassified`, `point_status = raw`인 한 엔터티로 분리한다. SourceReference도 결정적 ID, 실제 Source, 관계·검수 상태를 갖는다. ModelAnswer는 0건이며 fixture는 production 반입·빌드에서 제외된다. |
| 제외 사항 | 전체 253개, 다른 Part, 문장·병음·번역 교정, 새 답변, 원본 출처 검증, 기존 CSV 수정 |
| 관련 스키마 엔터티 | `Question`, `AnswerPoint`, `Source`, `SourceReference`; `ModelAnswer`는 0개 |

## 4. 데이터 저장소 인터페이스

| 항목 | 내용 |
|---|---|
| 목적 | 화면이 JSON 파일이나 IndexedDB를 직접 다루지 않게 공용·개인 저장 경계를 분리한다. |
| 입력 | TypeScript 타입, 화면 데이터 계약, 개발 전용 JSON, IndexedDB 결정 |
| 출력 | 읽기 전용 공용 학습 데이터 저장소 계약과 개인 학습 데이터 저장소 계약 |
| 완료 조건 | Part 목록·Question·AnswerPoint 조회, UserAnswer 저장·조회, ReviewState 조회·갱신 책임이 분리된다. 데이터 없음과 조회 실패를 구분하고 안정적인 ID만 사용한다. raw fixture와 reviewed/production 개인 저장 영역을 DB 이름 또는 dataset namespace로 분리하는 계약을 포함한다. |
| 제외 사항 | 서버 저장소, 네트워크 API, 캐시 최적화, 동기화 |
| 관련 스키마 엔터티 | `Question`, `AnswerPoint`, `ModelAnswer`, `PartGuide`, `UserAnswer`, `Correction`, `ReviewState` |

## 5. 화면 라우팅

| 항목 | 내용 |
|---|---|
| 목적 | 첫 수직 기능 화면을 안정적인 ID와 진입 문맥으로 연결한다. |
| 입력 | `NAVIGATION_FLOW.md`, React Router Declarative 기준, 화면 ID |
| 출력 | `HOME`, `PART_DETAIL`, `TEXT_QUESTION`, `ANSWER_EDITOR`, `CORRECTION_RESULT`, `MY_ANSWERS`, `REVIEW` 라우트 맵과 뒤로가기 문맥 |
| 완료 조건 | Part 4와 `question_id`로 각 화면에 진입하고 새로고침·뒤로가기에서 필요한 문맥을 복원한다. 알 수 없는 ID와 Part 불일치를 정상적인 찾을 수 없음 상태로 처리하고 `question_zh`는 URL이나 key로 사용하지 않는다. |
| 제외 사항 | Part 2·7 전용 라우트, 인증 보호 라우트, 최종 URL 영구 호환 약속 |
| 관련 스키마 엔터티 | `Question`, `UserAnswer`, `ReviewState` |

## 6. 공통 언어 표시 컴포넌트

| 항목 | 내용 |
|---|---|
| 목적 | 중국어 → 병음 → 한국어 순서와 표시·숨김 규칙을 한 곳에서 적용한다. |
| 입력 | `LanguageSet` 규칙, Question·AnswerPoint·교정 결과 언어 값, 접근성 원칙 |
| 출력 | 언어 묶음 표시, 병음 표시 제어와 누락·검수 상태 표현 |
| 완료 조건 | 세 언어 순서, 원본 줄바꿈, 언어별 마크업, 충분한 글자 크기와 키보드 접근성을 지킨다. 원본에 없는 값을 생성하지 않고 숨김 상태를 blur만으로 구현하지 않는다. raw 표본은 검수 완료로 오해되지 않게 개발용 상태를 표시한다. |
| 제외 사항 | 음성 재생, 발음 평가, 자동 병음 생성, 태블릿 전용 표현 |
| 관련 스키마 엔터티 | `LanguageSet`, `Question`, `ModelAnswer`, `UserAnswer`, `Correction` |

## 7. HOME

| 항목 | 내용 |
|---|---|
| 목적 | 사용자가 Part 1~7 목록과 첫 구현 대상 Part 4에 바로 진입하게 한다. |
| 입력 | Part 메타데이터, Part별 사용 가능한 문제 수, 마지막 학습 위치와 ReviewState가 있으면 그 요약 |
| 출력 | 모바일 학습 홈, 하단 메뉴, Part 목록과 Part 4 진입 행동 |
| 완료 조건 | Part 1~7을 구분해 표시하되 Part 4만 실제 표본 흐름으로 연결한다. 구현되지 않은 Part에 더미 문제를 표시하지 않고, 전체 253개가 적재된 것처럼 통계를 만들지 않는다. ReviewState 없음은 `못 외움`으로 계산하지 않으며 근거 없는 오늘 복습 일정도 만들지 않는다. |
| 제외 사항 | 복잡한 통계, 전체 Part 실제 기능, 추천 알고리즘 |
| 관련 스키마 엔터티 | `PartGuide`, `Question`, `ReviewState`, `UserAnswer` |

## 8. PART_DETAIL

| 항목 | 내용 |
|---|---|
| 목적 | Part 4의 목표·구조와 여섯 표본 문제를 선택할 수 있게 한다. |
| 입력 | Part 4 `PartGuide`가 있으면 검수 상태와 함께 사용, Part 4 Question·AnswerPoint 목록 |
| 출력 | Part 4 상세와 canonical ID 기반 문제 목록 |
| 완료 조건 | Part 4만 필터링하고 정확히 여섯 canonical ID를 안정적인 ID 순서로 표시한다. 모든 행이 raw임을 개발용으로 구분하고, workbook의 `source_name`·`source_url`을 검증된 원출처로 승격하지 않는다. `P4-006`의 빈 URL은 정상이며 AnswerPoint를 검수된 PartGuide나 ModelAnswer처럼 표시하지 않는다. |
| 제외 사항 | 다른 Part 상세, 검수되지 않은 시험 규칙 생성, 시각 세트 |
| 관련 스키마 엔터티 | `PartGuide`, `Question`, `AnswerPoint`, `SourceReference` |

## 9. TEXT_QUESTION

| 항목 | 내용 |
|---|---|
| 목적 | 선택한 Part 4 문제를 이해하고 자신의 답변 작성을 시작하게 한다. |
| 입력 | `question_id`로 조회한 Question, 0..N AnswerPoint, 0..N ModelAnswer, 기존 UserAnswer·ReviewState |
| 출력 | 질문 언어 묶음, AnswerPoint, 답변 작성 CTA와 `아직 모범답안 없음` 상태 |
| 완료 조건 | 여섯 문제를 ID로 구분하고 raw 상태와 원본 힌트의 검수 필요 상태를 숨기지 않는다. ModelAnswer 0개를 오류 없이 처리하며, 답변 작성 전에 모범답안을 강제로 노출하거나 `missing` 빈 답변 레코드를 만들지 않는다. |
| 제외 사항 | Part 2·7 시각 문제, 자동 모범답안, 출처 URL 인터넷 검증 |
| 관련 스키마 엔터티 | `Question`, `AnswerPoint`, `ModelAnswer`, `SourceReference`, `UserAnswer`, `ReviewState` |

## 10. 답변 입력

| 항목 | 내용 |
|---|---|
| 목적 | 사용자가 한국어·중국어·혼합 원문을 잃지 않고 최소 교정을 요청하게 한다. |
| 입력 | Question, Part 4 구조·AnswerPoint, 사용자의 원문과 입력 언어, `minimal` 모드 |
| 출력 | 비영속 답변 초안과 `CorrectionProvider` 요청 값 |
| 완료 조건 | 세 입력 유형을 허용하고 빈 입력 요청을 차단한다. 이동·실패 후에도 원문을 유지하며 첫 수직 기능에서는 최소 교정만 활성화한다. |
| 제외 사항 | 자연스럽게·Level 8 실제 결과, 자동 저장, 새 개인 경험 생성 |
| 관련 스키마 엔터티 | `Question`, `AnswerPoint`; 저장 전이므로 `UserAnswer`는 생성하지 않음 |

## 11. mock CorrectionProvider

| 항목 | 내용 |
|---|---|
| 목적 | 외부 AI 없이 교정 요청·성공·실패 계약을 deterministic하게 검증한다. |
| 입력 | Question 문맥, Part, 원문, 입력 언어, `minimal` 모드와 `AI_CORRECTION_RULES.md` 결과 형식 |
| 출력 | 교정 중국어·전체 병음·한국어, 수정 전후·이유, 구조 구간, 관련성·불확실성을 갖는 mock 결과 또는 명시적 실패 |
| 완료 조건 | 같은 지원 입력에 같은 결과를 반환하고 한국어·중국어·혼합 대표 fixture에서 성공, 수정 없음, 질문 비관련, 불확실성, 실패와 불완전 응답을 재현한다. 지원하지 않는 임의 입력을 실제 AI처럼 추측하지 않으며, test-only mock을 ModelAnswer나 공용 Correction으로 반입하지 않는다. |
| 제외 사항 | 네트워크 호출, API 키, 실제 AI 품질 평가, Level 8 확장 |
| 관련 스키마 엔터티 | `Question`, `AnswerPoint`; 출력 전체는 저장 전 후보이며 canonical `Correction`이나 `ModelAnswer`가 아님 |

## 12. 교정 결과

| 항목 | 내용 |
|---|---|
| 목적 | 사용자가 mock 결과를 검토하고 저장 또는 다시 쓰기를 선택하게 한다. |
| 입력 | 원문, 최소 교정 결과, 수정 목록·이유, 관련성·불확실성, Question 문맥 |
| 출력 | `CORRECTION_RESULT` 화면과 승인 가능한 `UserAnswer` 후보 |
| 완료 조건 | 중국어·병음·한국어와 수정 개수를 표시하고 수정 전후를 색상 외 라벨·화살표로 구분한다. 수정이 없으면 `수정 없음`을 명시한다. provider 실패 시 원문을 유지하고 다시 시도할 수 있게 하며, 필수 결과가 불완전하면 저장 후보로 만들지 않는다. 저장은 완전한 결과에 대한 명시적 승인 후에만 요청하며 ModelAnswer가 없으면 비교 영역을 생략한다. |
| 제외 사항 | 결과 자동 저장, 모범답안 생성, 실제 AI 비교, 비슷한 문제 추천 |
| 관련 스키마 엔터티 | `Question`, `UserAnswer` 후보; 개별 오류를 저장할 때만 개인 `Correction` 후보 |

## 13. IndexedDB UserAnswer 저장

| 항목 | 내용 |
|---|---|
| 목적 | 승인한 개인 답변을 공용 JSON과 분리해 현재 브라우저에 보존한다. |
| 입력 | 승인된 UserAnswer 후보, IndexedDB 저장소 계약, `question_id` |
| 출력 | IndexedDB의 `UserAnswer` 레코드와 저장 성공·실패 결과 |
| 완료 조건 | 승인 전에는 저장하지 않고 `input_language`, `original_input`, `correction_mode = minimal`, 중국어·병음·한국어, 변경·구조 필드, `save_status = user_approved`, `created_at` 등 canonical 필수 필드를 보존한다. 같은 저장 동작의 중복 클릭은 중복 레코드를 만들지 않되, 사용자가 별도로 승인한 같은 Question의 여러 답변은 스키마 원칙에 따라 허용한다. raw fixture 전용 namespace에 저장하고 production 영역으로 자동 승격하지 않는다. 새로고침 후 조회되며 본문을 localStorage나 공용 JSON에 쓰지 않는다. 저장 실패 시 화면 결과와 원문을 유지한다. |
| 제외 사항 | 서버 동기화, 인증, 내보내기·가져오기, 삭제·보관 방식 확정 |
| 관련 스키마 엔터티 | `UserAnswer`, 연결된 `Question`; 필요한 경우 개인 `Correction`은 별도 레코드 |

## 14. ReviewState 변경

| 항목 | 내용 |
|---|---|
| 목적 | 첫 수직 기능에서는 Question의 개인 학습 상태를 명시적으로 변경한다. |
| 입력 | `target_type = question`, canonical `question_id`, 기존 ReviewState, 사용자의 상태 선택 |
| 출력 | IndexedDB의 생성 또는 갱신된 `ReviewState` |
| 완료 조건 | 상태 없음과 `못 외움`·`헷갈림`·`외움`을 구분하고 사용자가 선택할 때만 저장한다. 로컬 학습자 범위와 `(target_type, target_id)`별 현재 레코드 한 건을 upsert하며, 세 상태 전환·허용되지 않은 상태 거부·`last_reviewed_at` 갱신과 `review_count` 증가 규칙을 명시한다. 학습 상태는 `ReviewState`에만 저장하며 `Question`, `UserAnswer`나 `Correction`에 복제하지 않는다. 저장 실패 시 다음 항목으로 이동하지 않는다. |
| 제외 사항 | 자동 `못 외움`, 복습 예정일·간격 알고리즘, 서버 동기화 |
| 관련 스키마 엔터티 | `ReviewState`, 대상 `Question` 또는 `UserAnswer` |

## 15. 나의 답변 화면

| 항목 | 내용 |
|---|---|
| 목적 | 저장된 Part 4 답변을 문제 문맥과 학습 상태로 다시 찾게 한다. |
| 입력 | IndexedDB UserAnswer, 연결 Question, 해당 ReviewState |
| 출력 | `MY_ANSWERS` 목록과 문제·복습 진입 행동 |
| 완료 조건 | `save_status = user_approved`인 답변만 표시한다. 공용 ModelAnswer와 개인 답변을 구분하고 Part, canonical question_id, 세 언어와 별도 조회한 ReviewState를 표시한다. 빈 상태, 저장 실패 후 미등장과 새로고침 후 복원을 확인한다. |
| 제외 사항 | 서버 계정, 다른 기기 데이터, 내보내기, 삭제·보관 물리 방식 |
| 관련 스키마 엔터티 | `UserAnswer`, `Question`, `ReviewState`, 선택적인 개인 `Correction` |

## 16. 기본 테스트

| 항목 | 내용 |
|---|---|
| 목적 | 첫 수직 기능의 타입·데이터·저장·화면 계약이 반복 실행에서 유지되는지 검증한다. |
| 입력 | 구현된 타입, 변환기, 저장소, provider와 화면 컴포넌트 |
| 출력 | 타입 검사, JSON 스키마·관계 검증, 유틸리티·provider·IndexedDB·주요 화면 테스트 결과 |
| 완료 조건 | 정확한 여섯 ID·locator·원본 순서·Part 4·raw 상태를 검증하고, 중국어·병음·한국어·유형·자료 등급·출처 이름·URL·원문성·답변 포인트·빈 값·`normalization_notes`가 CSV와 JSON 사이에서 그대로 보존되는지 비교한다. `P4-006` 빈 URL, `P4-039`의 originality와 question_status 분리, deterministic JSON과 ModelAnswer 0개를 검증한다. canonical ID 라우팅, 모범답안 없음, 세 입력 유형, 수정 없음·실패·불완전 mock, 필수 UserAnswer 필드, 승인 전 미저장, 중복 클릭 멱등 저장, 저장 실패 보존을 포함한다. ReviewState는 미설정과 세 상태 각각의 저장·전환, 허용되지 않은 값 거부, `review_count`·`last_reviewed_at` 갱신, 학습 상태가 다른 엔터티에 복제되지 않음과 upsert를 검증한다. fixture/production 저장 격리를 확인하고 live API를 호출하지 않는다. 테스트 명령이 한 번의 표준 흐름으로 재실행된다. |
| 제외 사항 | 실제 AI 품질 평가, 전체 Part 회귀 테스트, 성능·부하 테스트, E2E 도구의 선제 도입 |
| 관련 스키마 엔터티 | 첫 수직 기능에서 사용하는 모든 공용·개인 엔터티 |

## 17. 모바일 브라우저 확인

| 항목 | 내용 |
|---|---|
| 목적 | 실제 모바일 크기에서 첫 수직 기능의 탐색·입력·저장·복습 흐름을 확인한다. |
| 입력 | 테스트를 통과한 로컬 앱, 지원 대상으로 정한 모바일 브라우저와 viewport |
| 출력 | 수동 확인 기록과 발견된 결함 목록 |
| 완료 조건 | 확인한 브라우저·viewport를 기록한다. 하단 메뉴와 화면 키보드가 콘텐츠를 가리지 않고, 줄바꿈·스크롤·확대·포커스·reduced motion·언어 가독성을 확인한다. raw 표시와 모범답안 없음 상태를 포함해 HOME부터 Part 4 선택, 입력, mock 교정, 저장, 상태 변경과 나의 답변 조회까지 완료하며 새로고침 뒤 IndexedDB 값이 같은 origin에서 유지된다. |
| 제외 사항 | 태블릿 전용 설계, 배포 검증, 오프라인 PWA, 다중 브라우저 동기화 |
| 관련 스키마 엔터티 | `Question`, `AnswerPoint`, `UserAnswer`, `ReviewState` |

## 첫 수직 기능 완료 판단

17단계가 완료되어도 전체 데이터 추출, 전체 Part 구현, 실제 AI 연결 또는 MVP 전체 완료를 뜻하지 않는다. Part 4 raw 표본을 사용하는 개발 전용 흐름이 데이터·화면·개인 저장 경계를 실제로 통과했다는 것만 검증한다.
