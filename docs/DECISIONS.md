# 의사결정 기록

## 원칙

Phase 0에서 요구사항과 데이터 운영 원칙을 정리했고, Phase 1의 두 차례 대표 표본 검증을 바탕으로 구현 기술 독립적인 데이터 스키마 v1을 확정했다. 강의 분석 working 반입 검토에서 근거 종류와 재사용 학습 콘텐츠를 additive하게 더한 v1.1을 문서화했다. 첫 수직 기능을 시작하기 위한 MVP 구현 기준과 데이터 저장 경계도 [IMPLEMENTATION_BASELINE.md](IMPLEMENTATION_BASELINE.md)와 [DATA_FORMAT_DECISION.md](DATA_FORMAT_DECISION.md)에서 결정했다.

`MVP 결정`은 현재 MVP의 구현 기준이며 영구적인 기술 고정을 뜻하지 않는다. 재검토 조건이 생기기 전까지 이 기준을 따른다. 첫 Part 4 수직 기능에서 사용한 패키지 버전은 `package-lock.json`으로 고정했지만, 이후 기능의 추가 패키지와 장기 버전 정책을 모두 확정한 것은 아니다.

## 확정된 스키마 v1 결정

| ID | 결정 | 내용 |
|---|---|---|
| `S-001` | `Question` 식별 | `question_id`가 고유 식별자이며 `question_zh`는 unique가 아니다. |
| `S-002` | 질문과 답변 분리 | `Question`과 `ModelAnswer`를 분리하고 한 질문에 답변이 없거나 여러 개일 수 있게 한다. |
| `S-003` | 답변 포인트 분리 | 원본 `answer_point`는 `Question` 본문이 아니라 별도 `AnswerPoint`로 관리한다. |
| `S-004` | 출처 관계 분리 | 실제 반입 파일과 파일 내부의 출처 주장을 `SourceReference`로 구분하고 연결한다. |
| `S-005` | 이미지와 사용 묶음 분리 | 실제 파일은 `VisualAsset`, 학습 맥락의 묶음은 `VisualSet`으로 관리하고 `VisualSetAsset`으로 연결한다. |
| `S-006` | 질문과 시각 세트 연결 | `Question`과 `VisualSet`의 관계는 `QuestionVisualSet`에서 명시적으로 관리한다. |
| `S-007` | 독립 시각 하위 질문 | `VisualQuestion`은 canonical `Question`에 연결되지 않아도 유효하다. |
| `S-008` | 답변 대상 일반화 | `ModelAnswer`는 `answer_target_type`과 `answer_target_id`로 `Question` 또는 `VisualQuestion`을 대상으로 한다. |
| `S-009` | 스토리 가이드 분리 | `StoryGuide`는 이야기 구성 보조 콘텐츠이며 `ModelAnswer`가 아니다. |
| `S-010` | 이미지 권리 관리 | 공개 가능 여부는 각 `VisualAsset.rights_status`에서 관리한다. |
| `S-011` | 중복과 정체성 분리 | 동일 문장 탐지는 `duplicate_candidate` 검수이며 `question_id` 기반 정체성 검증과 구분한다. Part 7 공통 지시문 반복은 정상일 수 있다. |

기존 `D-010`의 시각 자료 엔터티 구조 검토는 `S-003`~`S-010`과 [데이터 스키마 v1.1](DATA_SCHEMA.md)로 해소되었다.

## 확정된 스키마 v1.1 결정

TSC 1~7강 분석 자료의 대표 근거를 working 데이터로 구조화하기 위해 다음 additive 결정을 확정한다. 기존 v1 엔터티와 Part 4 앱 계약은 변경하지 않는다.

| ID | 결정 | 내용 |
|---|---|---|
| `S-012` | 근거 종류 분리 | `document_text`, `screen_text`, `instructor_speech`, `analyst_synthesis`, `generated_study_material`을 구분하고 분석·재구성 자료를 강사 직접 근거로 승격하지 않는다. |
| `S-013` | 과정 목표 보존 | 강의가 밝힌 3급 목표는 `course_target_context = level_3`로 보존하며 Level 8 전략이나 공식 채점 기준으로 이름을 바꾸지 않는다. |
| `S-014` | 학습 표현 분리 | 여러 문제·Part에서 재사용할 표현은 `LearningExpression`으로 관리하고 부분 병음을 전체 문장 병음으로 사용하지 않는다. |
| `S-015` | 발음 항목 분리 | 강의에서 확인된 발음·성조·얼화와 혼동 음은 `PronunciationItem`으로 관리하며 확인되지 않은 음가를 생성하지 않는다. |
| `S-016` | 실전 과제 분리 | 시간과 학습 행동을 가진 연습은 `PracticeDrill`로 관리하고 강의에 없는 반복 횟수·복습 간격을 만들지 않는다. |
| `S-017` | 강의 인사이트 분리 | 강사의 전략·경고·공부법과 분석자의 범위 정리는 `CourseInsight`로 관리하고 `evidence_kind`로 성격을 구분한다. |
| `S-018` | 엄격한 교정 반입 | 정확한 전후 중국어가 확인되고 표시용 전체 병음·한국어 조건을 충족할 때만 공용 `Correction`으로 반입한다. 한국어 설명뿐인 오류나 병음 누락을 임의로 채우지 않는다. |
| `S-019` | 실제 Source만 등록 | `Source.file_ref`는 저장소에서 직접 확인 가능한 파일만 가리킨다. 분석 Markdown이 주장하지만 저장소에 없는 MP4·PDF·DOCX는 실제 Source 경로로 만들지 않는다. |
| `S-020` | ModelAnswer 후보 게이트 | 특정 Question 또는 VisualQuestion, 완성 중국어, 전체 병음, 전체 한국어와 실제 출처 위치가 모두 확인된 경우에만 출처 `ModelAnswer` 후보를 만든다. |
| `S-021` | 주장 원본 이름과 생성 자료 구분 | 저장소에 없는 원본 이름·별칭은 `Source.claimed_original_names`에 주장 메타데이터로 보존한다. 분석을 재구성한 study 문서는 `source_type`과 `provenance_status`를 `self_created`, 근거를 `generated_study_material`로 표시한다. |
| `S-022` | 발언 타임스탬프와 분석 통합 분리 | 상세분석에 강사 발언과 타임스탬프가 함께 기록된 근거는 `instructor_speech`, 통합 설명은 `analyst_synthesis` 관계로 구분한다. 원본 영상 부재 시 둘 다 `review_needed`를 유지한다. |

`data/working/course-import-v1`의 JSON은 스키마와 근거 구조를 검증하는 working 산출물이다. 이는 `D-007`의 reviewed canonical JSON으로 자동 승격된 데이터가 아니며 앱 런타임 데이터에 직접 합치지 않는다.

## 전체 workbook working 반입 운영 결정

| ID | 결정 | 내용 |
|---|---|---|
| `W-001` | 전체 구조 반입과 reviewed 승격 분리 | `full-import-v1`은 253개 Question과 전체 시각 자료의 검수 전 working JSON이며 reviewed canonical이나 앱 런타임 데이터가 아니다. |
| `W-002` | 엄격한 시각 연결 | Part 2는 유일한 원문 완전 일치처럼 검증 가능한 근거가 있는 관계만 만들고, 미연결 항목은 검수 큐에 둔다. Part 7 숫자 접미사는 후보일 뿐 실제 관계가 아니다. |
| `W-003` | 출처 답변 상태 보존 | workbook의 Part 2 추천 답변은 `VisualQuestion` 대상 `unverified_source`, `review_needed` ModelAnswer로 반입하며 승인된 공식 답변으로 표시하지 않는다. |
| `W-004` | 생성 이미지와 권리 경계 | workbook 이미지 바이트와 메타데이터를 변경하지 않고, 모든 VisualAsset의 권리를 `review_needed`로 유지한다. 생성 이미지 경로는 공개·배포 자산 경계가 아니다. |
| `W-005` | cross-dataset 후보와 관계 분리 | course 콘텐츠의 literal 근거 후보는 사람 검수 큐이며 SourceReference나 canonical Question 관계로 자동 승격하지 않는다. |

현재 manifest 기준 수와 후속 검수 범위는 [전체 workbook working 반입 보고서](FULL_WORKBOOK_IMPORT_REPORT.md)와 [강의 콘텐츠 연결 후보 보고서](COURSE_QUESTION_LINK_REPORT.md)에 기록한다.

## 기술·운영 결정 상태

| ID | 항목 | 상태 | MVP 결정 또는 남은 확인 사항 |
|---|---|---|---|
| `D-001` | 프론트엔드 기술 스택 | MVP 구현 | React 19.2.8 + TypeScript 6.0.3 + Vite 8.1.5의 모바일 우선 SPA. React Router DOM 7.18.1 Declarative, 일반 CSS와 CSS 변수, 초기 UI 라이브러리 없음 |
| `D-002` | 백엔드 유무와 기술 스택 | MVP 경계 결정 | 첫 수직 기능에는 백엔드가 없다. 실제 AI, 서버 동기화 또는 인증 도입 전에 필요성과 기술을 다시 결정 |
| `D-003` | AI API 제공자 및 모델 | 미결정 | 중국어 교정 품질, 구조화 결과, 비용, 개인정보 처리, 모델 변경 가능성 |
| `D-004` | 데이터베이스 | MVP 결정 | 초기 MVP에는 서버 데이터베이스가 없다. 공용 데이터는 정적 reviewed JSON, 개인 데이터는 브라우저 IndexedDB. 다중 사용자 도입 시 재결정 |
| `D-005` | 인증 방식 | 미결정 | 단일 사용자 또는 다중 사용자 여부, 동기화와 배포 범위 |
| `D-006` | 배포 환경 | 미결정 | 공개 범위, 운영 비용, 비밀키 관리, 데이터 보호 |
| `D-007` | 기준 데이터 형식 | MVP 결정 | raw는 Excel, 표 구조 working은 CSV, reviewed 공용 canonical은 엔터티별 JSON, 개인 기록은 IndexedDB. 다중 엔터티 근거 관계를 검증하는 `data/working` JSON은 허용하지만 reviewed canonical로 간주하지 않음 |
| `D-008` | 병음 생성 및 검수 방식 | 미결정 | 자동 생성 정확도, 경성·다음자 처리, 사람 검수 기준 |
| `D-009` | 사용자 개인 데이터 저장 방식 | MVP 구현 | 현재 browser origin의 IndexedDB와 `idb` 8.0.3을 사용. 인증·서버 동기화 없음, 내보내기·가져오기는 후속 |
| `D-011` | 이미지 공개 가능 여부 | 미결정 | `VisualAsset`별 권리 근거, 원본 링크와 이미지의 공개·배포 허용 범위 |

계속 미결정인 항목은 실제 AI 공급자·모델, 실제 백엔드 기술, 인증, 배포, 이미지 공개 가능 여부, 병음 자동 생성·검수 방식과 장기 패키지 업그레이드 정책이다.

## 첫 Part 4 수직 기능 구현 결정

2026-07-26에 첫 수직 기능을 초기화하며 다음을 구현 기준으로 선택했다.

| ID | 결정 | 내용 | 재검토 조건 |
|---|---|---|---|
| `D-012` | 패키지 관리 | npm 11.12.1과 `package-lock.json`을 사용한다. | 조직 공통 도구나 배포 환경이 다른 관리자를 요구할 때 |
| `D-013` | 런타임 데이터 검증 | 개발 fixture와 향후 공용 JSON의 런타임 경계에서 `zod` 4.4.3을 사용한다. 검증 실패를 정상 빈 데이터로 숨기지 않는다. | reviewed 데이터 빌드 파이프라인이 별도 검증 계층을 제공할 때 |
| `D-014` | IndexedDB 접근 | 개인 데이터 저장에 `idb` 8.0.3을 사용한다. 서버 데이터베이스 선택은 아니다. | 로그인·서버 동기화 또는 복잡한 migration이 필요할 때 |
| `D-015` | 임시 교정 세션 | 승인 전 입력과 provider 결과는 질문별 `sessionStorage`에 저장한다. 승인된 `UserAnswer`와 분리하며 민감 정보나 API 키는 저장하지 않는다. | 서버 교정·다중 기기 복원·개인정보 정책을 설계할 때 |
| `D-016` | 교정 공급자 경계 | `CorrectionProvider` 인터페이스와 deterministic mock을 사용한다. 실제 외부 AI 호출과 클라이언트 API 키는 허용하지 않는다. | 공급자 비교와 비밀키를 보호할 서버 경계를 승인할 때 |
| `D-017` | 테스트 도구 | Vitest, React Testing Library, jest-dom, user-event, jsdom, fake-indexeddb로 타입·도메인·저장소·사용자 흐름을 검증한다. | 브라우저 E2E 또는 다른 실행 환경을 정식 도입할 때 |
| `D-018` | Part 4 전체 working fixture | `full-import-v1`과 `course-import-v1`에서 Part 4 범위만 deterministic하게 추출한 `part4-full-working-development-fixture-v2`를 앱 기본 데이터로 사용한다. reviewed 승격은 아니다. | 사람 검수를 통과한 reviewed canonical JSON이 준비될 때 |
| `D-019` | 교정 전 연습 초안 | `PracticeDraft`를 승인된 `UserAnswer`와 분리해 IndexedDB에 저장한다. 질문당 활성 초안 하나를 upsert하며 둘은 동시에 존재할 수 있다. | 다중 기기 동기화나 답변 버전 이력이 필요할 때 |
| `D-020` | IndexedDB v2 migration | 기존 DB 이름을 유지하고 버전 2에서 `practiceDrafts` store만 additive하게 추가한다. 기존 답변·복습 상태·개인 오류를 삭제하지 않는다. | 추가 개인 엔터티 또는 장기 migration 정책이 필요할 때 |
| `D-021` | 로컬 데이터 검수 저장소 | `Part4ReviewDecision`은 학습 DB와 분리된 `tsc-study-data-review-v1` IndexedDB의 `part4ReviewDecisions`에 Question당 하나를 저장한다. | 여러 검수자 병합이나 서버 검수 도입 시 |
| `D-022` | reviewed 승격 게이트 | 일곱 필드 전체 승인과 현재 Question·AnswerPoint 해시 일치가 있을 때만 원문을 그대로 승격한다. stale·미검수·수정 요청·보류는 제외한다. | 수정안 자체를 구조화하는 후속 워크플로 도입 시 |
| `D-023` | 출처 주장 승인 의미 | `claimed_source_metadata` 승인은 workbook에 기록된 값을 확인했다는 뜻이며 외부 URL·원출처 진위 검증으로 자동 승격하지 않는다. | 실제 외부 출처 검증 절차와 상태 모델이 마련될 때 |
| `D-024` | Part 4 답변 만들기·회상 | 기존 자유 입력 `PracticeDraft`를 유지하면서 네 구조의 키워드·문장을 additive하게 저장한다. 사용자가 명시적으로 저장한 `ReusablePhrase`와 상세 `RecallAttempt`는 학습 IndexedDB v3의 별도 store로 관리하고, 회상 결과만 기존 `ReviewState` 세 단계로 매핑한다. | 서버 동기화, 답변 버전 이력 또는 간격 반복 정책을 도입할 때 |
| `D-025` | 전체 텍스트 Part working fixture | `full-import-v1`과 `course-import-v1`에서 Part 1·3·4·5·6의 Question·AnswerPoint 193개를 선별한 `text-parts-working-development-fixture-v1`을 앱 기본 source로 사용한다. Part 2·7은 시각 연결 전까지 제외하고 ModelAnswer는 생성하지 않는다. Part 4 구조화 UX는 유지하며 다른 Part는 자유 입력 PracticeDraft를 사용한다. 기존 학습 DB 이름과 store는 개인 데이터 보존을 위해 변경하지 않는다. | 시각 Part를 구현하거나 reviewed canonical을 기본 source로 전환할 때 |
| `D-026` | Part 2 로컬 시각 working fixture | `part2-visual-working-development-fixture-v1`의 VisualSet·VisualAsset·VisualSetAsset 각 12개와 VisualQuestion·검수 전 출처 ModelAnswer 각 48개를 텍스트 fixture와 병행 로드한다. 엄격 연결 18개와 미연결 30개를 그대로 유지하고 Part 7·공식 샘플은 제외한다. | Part 2 reviewed 데이터 또는 권리 승인 자산이 준비될 때 |
| `D-027` | 로컬 이미지 권리 경계 | `rights_status = review_needed` Part 2 바이트는 Git ignore 생성 경로에 두고 Vite `serve` 전용 allowlist 미들웨어로만 제공한다. production build에는 바이트를 넣지 않으며 production 화면에서 Part 2를 비활성화한다. | VisualAsset별 공개 권리 근거가 승인될 때 |
| `D-028` | 개인 데이터 다형 대상과 IndexedDB v4 | 기존 DB 이름과 모든 레코드를 유지하며 `PracticeDraft`, `ReviewState`, `RecallAttempt`, `ReusablePhrase` source에 `question | visual_question` target을 additive하게 추가한다. v3 레코드는 `question` 대상으로 migration한다. Part 2는 UserAnswer·Correction을 자동 생성하지 않는다. | 실제 시각 문제 교정 공급자 또는 서버 동기화를 설계할 때 |

설치되어 `package-lock.json`에 고정된 직접 의존성은 다음과 같다.

| 구분 | 패키지 | 버전 |
|---|---|---:|
| 런타임 | `react` | 19.2.8 |
| 런타임 | `react-dom` | 19.2.8 |
| 런타임 | `react-router-dom` | 7.18.1 |
| 런타임 | `idb` | 8.0.3 |
| 런타임 | `zod` | 4.4.3 |
| 빌드·타입 | `typescript` | 6.0.3 |
| 빌드·타입 | `vite` | 8.1.5 |
| 빌드·타입 | `@vitejs/plugin-react` | 6.0.4 |
| 테스트 | `vitest` | 4.1.10 |
| 테스트 | `@testing-library/react` | 16.3.2 |
| 테스트 | `@testing-library/jest-dom` | 7.0.0 |
| 테스트 | `@testing-library/user-event` | 14.6.1 |
| 테스트 | `jsdom` | 29.1.1 |
| 테스트 | `fake-indexeddb` | 6.2.5 |
| 정적 검사 | `eslint` | 10.8.0 |
| 정적 검사 | `typescript-eslint` | 8.65.0 |
| 정적 검사 | `@eslint/js` | 10.0.1 |
| 정적 검사 | `eslint-plugin-react-hooks` | 7.1.1 |
| 정적 검사 | `eslint-plugin-react-refresh` | 0.5.3 |
| 타입 | `@types/react` | 19.2.17 |
| 타입 | `@types/react-dom` | 19.2.3 |
| 타입 | `@types/node` | 24.13.3 |
| 보조 | `globals` | 17.7.0 |

React Router DOM 7.18.1에는 npm audit가 RSC 모드 관련 high 경고를 보고한다. 현재 앱은 서버·RSC·action을 사용하지 않는 브라우저 Declarative SPA라 해당 실행 경로를 사용하지 않지만, 패치 릴리스가 제공되면 우선 재검토한다. 경고를 숨기기 위해 강제 downgrade하지 않는다.

## 이미 확정된 제품·데이터 원칙

다음은 기술 선택이 아니라 현재 요구사항으로 확정되어 있다.

- 질문과 모범답안은 분리한다.
- 답변이 없는 문제는 정상 상태다.
- 하나의 질문에 여러 목표·변형 답변이 연결될 수 있다.
- `question_id`가 질문의 고유 식별자이며 `question_zh`는 고유값이 아니다.
- 동일 중국어 문장도 그림, 답변 포인트와 출처 맥락이 다르면 별개의 문제일 수 있다.
- 검수 완료 및 사이트 표시 중국어 데이터는 중국어, 병음, 한국어 뜻을 함께 관리한다.
- 기본 교정은 사용자의 의미와 표현을 유지하는 최소 교정이다.
- 실제 출처, 출처 미확인, 자체 생성 데이터를 구분한다.
- 공용 데이터와 사용자 개인 학습 기록을 분리한다.
- 사용자별 학습 상태는 `ReviewState`에서만 관리한다.
- 녹음과 음성 평가는 현재 우선순위에서 제외한다.

## 확정된 제품·UI 원칙

다음은 목업의 기술을 채택한 결정이 아니라 MVP의 제품·표시 원칙이다.

- 일반 모바일 반응형을 우선한다.
- 하단 메뉴는 `학습`, `복습`, `나의 답변`, `실수 노트` 네 개를 사용한다.
- 중국어 콘텐츠는 중국어 → 병음 → 한국어 순서로 표시한다.
- 교정 모드의 기본값은 최소 교정이다.
- `ModelAnswer`가 없는 문제도 답변 작성과 복습이 가능하다.
- `StoryGuide`는 이야기 구성 도움이며 `ModelAnswer`와 구분한다.
- Part 2와 Part 7은 일반 텍스트 문제와 구분되는 전용 시각 화면을 사용한다.
- 태블릿 전용 별도 설계는 현재 범위에서 제외한다.

Theme B는 기본 시각 참고이며 `D-001`의 React·CSS 기준과 별개로 목업 코드를 그대로 채택한다는 뜻이 아니다.

## 향후 결정 기록 형식

결정할 때 다음 항목을 추가한다.

- 결정 ID와 날짜
- 결정한 문제
- 선택한 내용
- 검토한 대안
- 선택 이유와 제약
- 영향을 받는 문서와 데이터
- 재검토 조건
