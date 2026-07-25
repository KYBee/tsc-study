# MVP 구현 기준

## 결정 배경

데이터 스키마 v1, 모바일 UI 명세와 화면 데이터 계약까지 문서화되었으므로 첫 실제 구현을 시작하기 전에 필요한 최소 기술 경계를 정한다. 이 기준은 전체 제품의 영구 아키텍처가 아니라 Part 4 첫 수직 기능을 일관되게 구현하기 위한 MVP 기준이다.

이번 문서화 단계에서는 앱 코드, 패키지, JSON 데이터와 저장소를 만들지 않는다. 구체적인 패키지 버전과 아직 필요성이 확인되지 않은 도구도 선택하지 않는다.

## 프론트엔드 기준

| 항목 | MVP 기준 |
|---|---|
| UI 프레임워크 | React |
| 언어 | TypeScript |
| 개발·빌드 도구 | Vite |
| 앱 형태 | 모바일 우선 SPA |
| 라우팅 | React Router의 Declarative 방식 |
| 스타일 | 일반 CSS와 CSS 변수 |
| UI 컴포넌트 라이브러리 | 초기 MVP에서는 사용하지 않음 |
| 시각 참고 | `docs/mockups/tsc-mock-v2.html`의 Theme B |
| 반응형 범위 | 일반 모바일 반응형. 태블릿 전용 별도 레이아웃은 만들지 않음 |

선택 이유:

- 화면 상태와 반복되는 학습 컴포넌트가 많아 선언적인 화면 구성이 필요하다.
- TypeScript로 스키마 v1과 화면 데이터 계약을 타입으로 표현할 수 있다.
- 목업의 CSS 변수와 일반 CSS 구조를 비교적 직접적으로 옮길 수 있다.
- 첫 수직 기능에서는 별도 UI 라이브러리의 추상화와 의존성을 추가할 필요가 없다.

React, TypeScript, Vite와 React Router의 구체적인 버전은 프로젝트 초기화 단계에서 호환성을 확인한 뒤 고정한다.

## 공용 학습 데이터

공용 데이터의 단계별 기준은 [DATA_FORMAT_DECISION.md](DATA_FORMAT_DECISION.md)를 따른다.

- `data/raw`의 원본 Excel은 내용과 파일명을 변경하지 않는다.
- `data/working`의 CSV는 추출·검수용 중간 형식이며 서비스 기준 데이터가 아니다.
- 검수 완료 공용 콘텐츠의 canonical 형식은 엔터티별 JSON이다.
- JSON 관계는 `question_id` 등 스키마 v1의 안정적인 ID로 연결한다.
- 배열과 객체의 직렬화 순서를 결정적으로 유지하고 사람이 검토할 수 있도록 들여쓰기한다.
- 런타임 앱은 검증을 통과한 reviewed JSON을 읽기 전용 공용 데이터로 사용한다.
- 공용 JSON에는 `UserAnswer`, 개인 `Correction`, `ReviewState`와 개인 설정을 넣지 않는다.

예상 엔터티 파일 후보는 다음과 같다. 실제 파일명은 초기 변환 작업에서 소폭 조정할 수 있다.

- `questions.json`
- `answer-points.json`
- `model-answers.json`
- `part-guides.json`
- `corrections.json`
- `source-references.json`
- `visual-assets.json`
- `visual-sets.json`
- `visual-set-assets.json`
- `question-visual-sets.json`
- `visual-questions.json`
- `story-guides.json`
- `sources.json`

`SourceReference.source_id`가 참조하는 `Source` 레코드는 reviewed/runtime 데이터에 반드시 포함한다. 기본 파일은 `sources.json`이며, 파일 묶음 이름을 조정하더라도 Source의 명시적인 물리 위치와 참조 무결성을 유지한다.

### 첫 수직 기능의 임시 데이터 예외

현재 `data/working/question-sample/questions.csv`의 Part 4 표본 6개는 모두 `question_status = raw`다. 첫 수직 기능에서는 이 CSV로부터 개발 전용 임시 앱 JSON을 결정적으로 만들 수 있지만, 이를 reviewed canonical JSON이나 배포 가능한 검수 완료 데이터로 부르지 않는다.

- 계획 출력 위치는 `data/working/app-fixtures/part4/`이며 production 데이터 반입·빌드에서 제외한다.
- 대상 ID는 `P4-001`, `P4-002`, `P4-003`, `P4-006`, `P4-036`, `P4-039`다.
- 원문, 병음, 한국어, 출처 주장과 `answer_point`를 수정하지 않는다.
- `answer_point`는 `Question` 본문에 합치지 않고 `AnswerPoint` 변환 후보로 분리한다.
- `model_answers.csv`가 헤더만 있는 상태를 유지하고 임시 답변을 생성하지 않는다.
- 개발 전용 표본은 전체 추출이나 검수 완료를 뜻하지 않으며 공개·배포 전에 별도 검수가 필요하다.
- fixture의 Question, AnswerPoint, Source와 SourceReference는 canonical 필드 형태를 따르되 상태는 raw·unverified로 보존한다.

## 개인 데이터 저장

초기 MVP에서는 다음 개인 데이터를 현재 브라우저 origin의 IndexedDB에 저장한다.

- `UserAnswer`
- 개인 `Correction`
- `ReviewState`
- 마지막 학습 위치
- 병음 표시 여부처럼 구조화된 사용자 표시 설정

운영 원칙:

- 로그인, 인증과 서버 동기화는 초기 MVP에서 제외한다.
- 개인 데이터는 현재 브라우저, 프로필과 origin에 종속된다.
- 공용 reviewed JSON과 개인 IndexedDB 데이터를 저장 범위에서 분리한다.
- `localStorage`는 테마처럼 매우 단순한 설정에만 사용할 수 있다.
- `UserAnswer`, 개인 `Correction`, `ReviewState`의 본문은 `localStorage`에 저장하지 않는다.
- 내보내기·가져오기, 백업과 기기 간 이전은 후속 기능이다.
- IndexedDB 직접 API와 작은 래퍼 라이브러리 중 무엇을 사용할지는 프로젝트 초기화 단계에서 결정한다.
- raw Part 4 fixture 환경의 IndexedDB는 reviewed/production 데이터 환경과 DB 이름 또는 dataset namespace로 분리한다. 개발 개인 기록을 production 기록으로 자동 승격하지 않는다.

첫 수직 기능에서도 사용자가 교정 결과를 명시적으로 승인한 뒤에만 `UserAnswer`를 저장한다. `ReviewState`가 없는 문제를 자동으로 `못 외움`으로 만들지 않는다.

## 백엔드와 AI 경계

첫 수직 기능에는 백엔드와 실제 AI 호출이 없다.

- 브라우저 코드에 API 키나 다른 비밀값을 넣지 않는다.
- 교정 기능은 교체 가능한 `CorrectionProvider` 경계를 전제로 한다.
- 초기 구현은 같은 입력과 문맥에 같은 결과를 반환하는 deterministic mock provider를 사용한다.
- mock은 최소 교정 흐름과 결과 화면 계약을 검증하기 위한 것으로, 실제 AI 품질이나 모범답안을 가장하지 않는다.
- mock 결과도 사용자의 의미와 경험을 바꾸거나 새로운 사실을 만들지 않는다.
- provider가 반환하는 화면용 `CorrectionResult`는 canonical 오류 콘텐츠인 `Correction`과 다르다. 결과 전체를 공용·개인 Correction으로 자동 저장하지 않는다.
- 실제 AI 공급자와 모델은 품질, 구조화 결과, 비용과 개인정보 처리를 비교한 뒤 선택한다.
- 실제 AI 연결에는 비밀키를 보호하는 서버 측 경계가 필요하다.
- 백엔드 기술과 배포 방식은 실제 AI, 인증 또는 동기화가 필요해질 때 다시 결정한다.

## CSS와 UI 라이브러리 방침

- Theme B의 색상·간격 방향을 CSS 변수의 초기 참고값으로 사용한다.
- 목업 HTML과 CSS를 서비스 코드로 복사했다고 간주하지 않으며 목업의 더미 동작을 구현 계약으로 사용하지 않는다.
- 일반 CSS로 공통 토큰, 레이아웃과 상태 스타일을 관리한다.
- 초기 MVP에서는 별도 UI 컴포넌트 라이브러리나 CSS 프레임워크를 사용하지 않는다.
- 색상만으로 상태를 구분하지 않는 등 [UI_SPEC.md](UI_SPEC.md)의 접근성 원칙을 구현 조건으로 사용한다.

## 라우팅 방침

- React Router의 Declarative 방식을 사용한다.
- 화면 ID는 [SCREEN_DATA_CONTRACT.md](SCREEN_DATA_CONTRACT.md)의 `HOME`, `PART_DETAIL`, `TEXT_QUESTION`, `ANSWER_EDITOR`, `CORRECTION_RESULT`, `MY_ANSWERS`, `REVIEW`를 기준으로 매핑한다.
- 구체적인 URL 문자열은 프로젝트 초기화와 라우트 설계 단계에서 확정한다.
- URL과 화면 식별에는 안정적인 ID를 사용하고 `question_zh`를 키로 사용하지 않는다.
- 첫 수직 기능에서는 Part 2·7 전용 라우트와 전체 Part 화면을 구현하지 않는다.

## 테스트 방침

첫 구현부터 다음 검증을 실행할 수 있는 구조를 만든다.

- TypeScript 타입 검사
- reviewed JSON과 개발 전용 임시 JSON의 스키마·관계 검증
- 데이터 선택, 정렬과 저장 변환 같은 핵심 유틸리티 단위 테스트
- `CorrectionProvider`의 deterministic 결과와 실패 계약 테스트
- HOME부터 복습 상태 변경까지 주요 화면 컴포넌트 테스트
- IndexedDB 저장·조회 경계 테스트

구체적인 테스트 라이브러리와 버전은 프로젝트 초기화 단계에서 결정한다. 테스트 도구 선택이 실제 AI, 백엔드 또는 UI 라이브러리 도입을 뜻하지 않는다.

## 첫 수직 기능 범위

첫 구현은 Part 4 텍스트 문제 한 흐름만 대상으로 한다.

```text
HOME
→ PART_DETAIL
→ TEXT_QUESTION
→ 답변 작성
→ mock 교정 결과
→ 사용자 승인 후 UserAnswer 저장
→ 나의 답변 조회
→ 복습 상태 변경
```

포함:

- 모바일 하단 메뉴
- Part 1~7 목록과 Part 4 진입
- Part 4 표본 문제 목록
- 중국어 → 병음 → 한국어 표시
- `AnswerPoint` 표시
- 한국어·중국어·혼합 답변 입력
- 최소 교정 mock 결과
- 수정 전후 표현과 이유
- IndexedDB `UserAnswer` 저장·조회
- `ReviewState`의 `못 외움`, `헷갈림`, `외움` 변경
- `ModelAnswer`가 없는 정상 상태

하단 메뉴 네 개는 탐색 구조로 표시하되, 첫 수직 기능의 완성 대상 화면은 학습, 복습과 나의 답변 흐름이다. 실수 노트의 공용·개인 오류 전체 기능을 임의의 더미 데이터로 구현하지 않는다.

## 현재 제외 범위

- Part 1·2·3·5·6·7의 실제 학습 화면
- 전체 253개 문제와 전체 시각 자료 추출
- 실제 AI API와 Level 8 실제 확장 결과
- 로그인, 인증, 서버 동기화
- 서버 데이터베이스와 백엔드
- 이미지 권리 확정과 시각 자료 구현
- 배포와 오프라인 PWA
- 개인 데이터 내보내기·가져오기
- 비슷한 문제 추천
- 실수 노트 전체 기능

## 재검토 조건

다음 상황에서는 이 MVP 기준을 다시 검토한다.

- 실제 AI 공급자와 모델을 연결할 때
- 로그인, 여러 사용자 또는 기기 간 동기화가 필요할 때
- 정적 reviewed JSON의 크기나 갱신 방식이 앱 성능·운영 요구를 충족하지 못할 때
- IndexedDB의 데이터 이전, 백업 또는 스키마 마이그레이션이 복잡해질 때
- raw fixture에서 reviewed 데이터로 전환하며 기존 개인 기록의 연결·이전 정책이 필요할 때
- 일반 CSS만으로 접근성·재사용성·유지보수 요구를 충족하기 어려울 때
- Part 2·7 시각 화면과 권리 정책을 구현할 때
- 배포, 오프라인 지원 또는 PWA가 실제 요구가 될 때

공용 JSON 생성의 deterministic 요구는 개인 데이터의 시각·ID까지 재현하라는 뜻이 아니다. 개인 데이터 ID는 생성 후 안정적이고 고유해야 하며 IndexedDB 마이그레이션에서 보존한다.

## 다음 작업 순서

1. [VERTICAL_SLICE_PLAN.md](VERTICAL_SLICE_PLAN.md)의 프로젝트 초기화 단계부터 범위와 완료 조건을 검토한다.
2. React + TypeScript + Vite 프로젝트를 초기화하면서 호환되는 패키지 버전과 테스트 도구를 결정한다.
3. 스키마 v1 타입과 공용·개인 데이터 저장소 경계를 정의한다.
4. Part 4 raw 표본을 개발 전용 임시 JSON으로 결정적으로 변환한다.
5. mock 교정과 IndexedDB 저장을 포함한 화면 흐름을 순서대로 구현한다.
6. 타입·데이터·컴포넌트·모바일 브라우저 검증을 통과한 뒤 다음 Part 또는 실제 AI 연결을 별도로 결정한다.
