# 데이터 스키마 v1 요약

## 확정 배경

Part 1~4 Question 20개 표본과 Part 5~7 Question 14개·시각 자료 표본을 검증한 결과, 기존 텍스트 중심 스키마만으로는 출처 주장, 그림 묶음, 시각 하위 질문, 출처 답변과 StoryGuide를 정확히 구분하기 어려웠다. 이에 전체 데이터를 추출하기 전에 구현 기술과 기준 파일 형식에 독립적인 canonical 스키마 v1을 문서로 확정했다.

스키마 v1은 현재 작업용 CSV의 물리 구조를 확정하거나 데이터베이스를 선택한 결과가 아니다. 기존 CSV는 표본 검증 결과 그대로 유지하며, 전체 추출·정규화·검수도 아직 수행하지 않는다.

## 표본 검증에서 발견한 문제

- workbook 자체는 실제 반입 파일이지만, 그 안의 출처 이름·URL·자료 등급·원문성은 workbook이 주장하는 세부 정보다.
- `answer_point`에는 답변 구조, 시간 안내, 힌트, 출처 메모와 이야기 포인트가 섞여 있어 `Question`의 단일 본문 필드로 확정하기 어렵다.
- Part 2 그림 세트에는 canonical `Question`과 연결되지 않아도 유효한 하위 질문과 그 질문을 대상으로 하는 원본 추천 답변이 있다.
- Part 7의 12개 질문은 같은 공통 지시문을 사용한다. 문장만으로 문제의 정체성을 판단하거나 그림과 질문을 연결할 수 없다.
- 실제 이미지 파일의 바이트·원본 위치·권리 상태와 그 이미지가 사용되는 학습 맥락을 분리해야 한다.
- Part 7의 추천 이야기 흐름은 완성된 중국어 답변이 아니므로 `ModelAnswer`로 취급할 수 없다.

## 핵심 엔터티

| 구분 | 엔터티 | 역할 |
|---|---|---|
| 출처 | `Source` | 실제로 반입하거나 확인한 파일·자료 |
| 출처 | `SourceReference` | 콘텐츠, 실제 Source와 그 위치, 원본 내부의 세부 출처 주장을 연결 |
| 문제 | `Question` | `question_id`로 식별하는 canonical 문제 |
| 문제 보조 | `AnswerPoint` | 질문별 구조·힌트·시간 안내·주의사항·이야기 포인트 |
| 답변 | `ModelAnswer` | `Question` 또는 `VisualQuestion`을 대상으로 하는 분리된 답변 |
| 시각 자료 | `VisualAsset` | 실제 이미지 파일, 해시, 원본 위치와 권리 상태 |
| 시각 자료 | `VisualSet` | 한 학습 맥락에서 함께 쓰는 시각 자료 묶음 |
| 시각 자료 | `VisualSetAsset` | `VisualSet`과 `VisualAsset`의 N:M 연결 |
| 시각 자료 | `QuestionVisualSet` | `Question`과 `VisualSet`의 검증된 N:M 연결 |
| 시각 자료 | `VisualQuestion` | 그림 세트 안의 하위 질문 |
| 스토리 보조 | `StoryGuide` | Part 7 이야기 흐름과 연결어를 보존하는 보조 콘텐츠 |
| 파트 학습 | `PartGuide` | Part 1~7의 목표·구조·표현 가이드 |
| 오류 콘텐츠 | `Correction` | 잘못된 표현, 올바른 표현과 수정 이유 |
| 개인 기록 | `UserAnswer` | 사용자가 저장을 승인한 개인 답변 |
| 개인 기록 | `ReviewState` | 사용자별 `못 외움`, `헷갈림`, `외움` 상태 |

각 필드, 필수 조건, 상태값과 관계의 canonical 정의는 [DATA_SCHEMA.md](DATA_SCHEMA.md)를 따른다.

## 공용 데이터와 개인 데이터

| 범위 | 포함 데이터 | 원칙 |
|---|---|---|
| 공용 콘텐츠 | `Source`, `SourceReference`, `Question`, `AnswerPoint`, `ModelAnswer`, 시각 자료 엔터티, `StoryGuide`, `PartGuide`, 공용 `Correction` | 출처·검수 상태를 보존하고 개인 학습 상태를 넣지 않는다. |
| 개인 기록 | `UserAnswer`, 개인 `Correction`, `ReviewState` | 학습자 소유 범위로 분리하고 초기 MVP에서는 IndexedDB에 저장한다. 인증과 서버 동기화는 포함하지 않는다. |

`ReviewState`만 개인 학습 상태를 관리한다. `Question`, `Correction`, `ModelAnswer`에 사용자별 `못 외움`, `헷갈림`, `외움`을 저장하지 않는다.

## 주요 학습 흐름과 관계도

아래 관계도는 주요 연결을 간단히 나타낸다. 분기된 화살표는 서로 독립적인 관계이며, 실제 참조 필드와 N:M 연결 엔터티는 `DATA_SCHEMA.md`의 관계 표가 기준이다.

### 텍스트 문제

```text
Source
→ SourceReference
→ Question
  ├→ AnswerPoint
  └→ ModelAnswer
```

`AnswerPoint`와 `ModelAnswer`는 각각 `Question`에 연결되는 별도 콘텐츠이며 둘 다 없을 수 있다.

### Part 2 시각 문제

```text
Question
→ QuestionVisualSet
→ VisualSet
  ├→ VisualQuestion
  └→ VisualSetAsset
     └→ VisualAsset

Question 또는 VisualQuestion
→ ModelAnswer
```

`VisualQuestion`은 `VisualSet`에 속한다. `ModelAnswer`는 이미지가 아니라 `Question` 또는 `VisualQuestion`을 대상으로 한다. `VisualQuestion.question_id`는 원본의 명시적 ID 또는 단 하나의 `question_zh` 완전 일치가 있을 때만 채운다. 의미 유사성, 행 순서, ID 접미사 또는 복수 완전 일치만 있는 경우에는 비워 두며, 연결되지 않은 시각 질문과 그 출처 답변도 유효하다.

### Part 7 스토리 문제

```text
Question
→ QuestionVisualSet
→ VisualSet
  ├→ VisualSetAsset
  │  └→ VisualAsset
  └→ StoryGuide
```

Part 7의 실질적 학습 맥락은 `Question + VisualSet + StoryGuide` 조합일 수 있다. 같은 공통 지시문이나 행 순서만으로 `QuestionVisualSet`을 만들지 않는다.

### 개인 학습

```text
Question
→ UserAnswer
→ Correction

Question / UserAnswer / Correction
→ ReviewState
```

## 출처 추적 구조

- `Source`는 직접 반입하거나 실제로 확인한 자료다. 현재 workbook은 `src-001`이다.
- `SourceReference.source_id`는 그 실제 `Source`를 가리키고 `source_locator`는 시트·행·페이지·문단 등 실제 위치를 기록한다.
- `claimed_source_name`과 `claimed_source_url`은 원본 내부의 주장이다. URL이 있다는 이유만으로 검증된 `Source`로 승격하지 않는다.
- 한 콘텐츠에는 `extracted_from`, `claimed_origin`, `derived_from`, `supports`, `self_created` 등 여러 출처 관계가 연결될 수 있다.
- 현재 CSV의 `source_id`, `source_locator`, `source_name`, `source_url`, `source_grade`, `originality`는 전체 반입 시 canonical `SourceReference`로 매핑한다.

## 질문, 답변 포인트와 답변

- `question_id`는 `Question`의 고유 식별자다.
- `question_zh`는 unique가 아니며 Part 7 공통 지시문 반복은 정상일 수 있다.
- 동일 문장 탐지는 `duplicate_candidate` 검수이고 식별자 중복 검사와 별개다.
- 원본 `answer_point`는 우선 `AnswerPoint.content`에 그대로 보존하고, 분류 근거가 없으면 `point_type = unclassified`로 둔다.
- `Question`과 `ModelAnswer`는 분리되어 있으므로 답변이 없는 문제는 정상이다.
- 작업을 표시할 필요가 없다면 빈 `ModelAnswer`나 `answer_status = missing` 레코드를 반드시 만들지 않는다.
- Part 2 원본 추천 답변은 새로 만든 답변이 아니며 검수 전에는 `answer_status = review_needed`, `provenance_kind = unverified_source`다.
- `StoryGuide.recommended_flow`를 `ModelAnswer`로 자동 변환하지 않는다.

## 시각 자료와 권리

- 실제 파일은 `VisualAsset`, 사용 맥락은 `VisualSet`에서 관리한다.
- 동일 바이트 여부는 `sha256`으로 확인하지만, 같은 이미지의 서로 다른 사용 맥락은 별도 `VisualSet`으로 보존할 수 있다.
- `VisualSetAsset`은 한 세트에 여러 이미지가 있거나 이미지가 재사용되는 경우를 허용한다.
- 질문과 그림의 연결은 `QuestionVisualSet`에서 명시적 ID나 검증 가능한 근거로만 만든다.
- 권리 상태는 `VisualAsset.rights_status`에서 관리한다. 현재 추출 이미지의 값은 `review_needed`이며 공개 허용을 뜻하지 않는다.

## MVP 구현 기준과 아직 결정하지 않은 사항

MVP 프론트엔드는 React + TypeScript + Vite, 공용 reviewed 데이터는 엔터티별 JSON, 개인 데이터는 브라우저 IndexedDB를 기준으로 한다. 세부 내용은 [IMPLEMENTATION_BASELINE.md](IMPLEMENTATION_BASELINE.md)와 [DATA_FORMAT_DECISION.md](DATA_FORMAT_DECISION.md)를 따른다.

계속 미결정인 사항:

- 실제 백엔드 기술과 서버 데이터베이스
- 인증과 서버 동기화
- 배포 환경
- AI API 제공자와 모델
- 이미지별 실제 공개 가능 여부
- 자동 병음 생성과 검수 방식
- IndexedDB 래퍼와 구체적인 패키지 버전

세부 상태는 [DECISIONS.md](DECISIONS.md)를 따른다.

## 전체 데이터 추출 시 지켜야 할 규칙

1. 원본 Excel을 수정·재저장하거나 원본 파일명을 바꾸지 않는다.
2. 기존 `question_id`와 원문 값을 유지하고 `question_zh`를 고유키로 사용하지 않는다.
3. 출처 import 필드는 `SourceReference`로 옮기되 실제 파일과 원본 내부 주장을 구분한다.
4. 원본 `answer_point`는 임의 분해하지 않고 `AnswerPoint`의 미분류 원문으로 먼저 보존한다.
5. 질문과 `ModelAnswer`를 분리하고 답변이 없다는 이유로 새 답변을 생성하지 않는다.
6. 시각 자료는 `VisualAsset`, `VisualSet`, 연결 엔터티와 `VisualQuestion`으로 분리한다.
7. 행 순서, 비슷한 ID 접미사 또는 복수의 완전 일치 문장만으로 시각 자료 연결을 추측하지 않는다.
8. Part 7 공통 지시문을 자동 병합·삭제하지 않는다.
9. `StoryGuide`를 중국어 답변으로 변환하지 않는다.
10. 공용 콘텐츠에 개인 연습 상태, 최근 연습일이나 개인 메모를 넣지 않는다.
11. `verified` 또는 사이트 표시용 중국어 콘텐츠는 중국어, 병음, 한국어 뜻을 함께 검수한다.
12. reviewed 공용 데이터는 엔터티별 JSON으로 만들고 관계를 안정적인 ID로 연결한다. working CSV와 개인 IndexedDB 데이터를 공용 canonical JSON에 섞지 않는다.
