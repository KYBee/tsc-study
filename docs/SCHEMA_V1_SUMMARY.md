# 데이터 스키마 v1.1 요약

## 확정 배경

Part 1~4 Question 20개 표본과 Part 5~7 Question 14개·시각 자료 표본을 검증한 결과, 기존 텍스트 중심 스키마만으로는 출처 주장, 그림 묶음, 시각 하위 질문, 출처 답변과 StoryGuide를 정확히 구분하기 어려웠다. 이에 전체 데이터를 추출하기 전에 구현 기술과 기준 파일 형식에 독립적인 canonical 스키마 v1을 문서로 확정했다.

스키마 v1은 현재 작업용 CSV의 물리 구조를 확정하거나 데이터베이스를 선택한 결과가 아니다. 기존 CSV는 표본 검증 결과 그대로 유지하며, 전체 추출·정규화·검수도 아직 수행하지 않는다.

v1.1은 `other-output`의 3급 목표 강의 분석을 working 데이터로 반입하기 전에 근거 수준과 재사용 학습 콘텐츠를 표현할 수 있도록 additive하게 확장한 버전이다. 기존 Part 4 앱 계약과 v1 엔터티·상태값은 유지한다.

## 강의 자료 검토에서 발견한 문제

- 이번 강의 canonical import의 실제 `Source`는 저장소에 있는 분석·학습·추출 Markdown이다. 원본 MP4·PDF·DOCX는 없으므로 존재하지 않는 경로를 실제 `Source.file_ref`로 만들 수 없다. 충돌 재확인용 screenshot과 screen index는 필요할 때만 별도 근거로 다룬다.
- 강의는 주로 TSC 3급 목표 과정이다. 정확성·감점 방지 내용은 Level 8 준비의 기초가 될 수 있지만 과정 자체를 Level 8 전략으로 바꿀 수 없다.
- 직접 문서·화면, 타임스탬프가 있는 강사 발언, 분석자 통합, 재구성 학습 자료의 신뢰도와 의미가 다르다.
- 표현집의 다수 병음은 `자료에서 확인 불가`, 존재 설명 또는 단어 일부뿐이다. 이를 전체 문장 병음으로 채울 수 없다.
- 교정 후보에는 정확한 전후 중국어가 있어도 전체 병음이 없거나, 잘못된 중국어 자체가 한국어 설명으로만 남은 사례가 있다.
- `每天…` 교정 후보는 통합 분석의 전후 문장과 PDF 직접 텍스트의 전후 문장도 서로 달라, 병음 누락과 별개로 원문 충돌 검수가 필요하다.
- Part 6·7은 시간·구성 언급에 비해 상세 훈련, 표현, 답변 자료가 부족하다.
- 강의 자료의 실전 과제에는 녹음이 포함되지만, 이를 구조화하는 것이 현재 MVP에 음성 인식·평가를 추가한다는 뜻은 아니다.

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
| 학습 표현 | `LearningExpression` | 여러 문제·Part에서 재사용할 표현과 문장 구조 |
| 발음 학습 | `PronunciationItem` | 강의에서 직접 확인된 발음·성조·얼화와 혼동 음 항목 |
| 실전 연습 | `PracticeDrill` | 준비·답변 시간과 학습 행동을 가진 근거 기반 과제 |
| 강의 인사이트 | `CourseInsight` | 전략·경고·공부법·평가 관점과 과정 범위 제한 |
| 오류 콘텐츠 | `Correction` | 잘못된 표현, 올바른 표현과 수정 이유 |
| 개인 기록 | `UserAnswer` | 사용자가 저장을 승인한 개인 답변 |
| 개인 기록 | `ReviewState` | 사용자별 `못 외움`, `헷갈림`, `외움` 상태 |

각 필드, 필수 조건, 상태값과 관계의 canonical 정의는 [DATA_SCHEMA.md](DATA_SCHEMA.md)를 따른다.

## 공용 데이터와 개인 데이터

| 범위 | 포함 데이터 | 원칙 |
|---|---|---|
| 공용 콘텐츠 | `Source`, `SourceReference`, `Question`, `AnswerPoint`, `ModelAnswer`, 시각 자료 엔터티, `StoryGuide`, `PartGuide`, `LearningExpression`, `PronunciationItem`, `PracticeDrill`, `CourseInsight`, 공용 `Correction` | 출처·근거·검수 상태를 보존하고 개인 학습 상태를 넣지 않는다. |
| 개인 기록 | `PracticeDraft`, `UserAnswer`, 개인 `Correction`, `ReviewState` | 학습자 소유 범위로 분리하고 초기 MVP에서는 IndexedDB에 저장한다. `PracticeDraft`는 교정 전 원문이며 승인된 `UserAnswer`와 동시에 존재할 수 있다. 인증과 서버 동기화는 포함하지 않는다. |

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
- 강의 반입에서는 저장소에 실제 있는 통합 분석, 강의별 분석, study 문서, PDF·DOCX 추출 Markdown, 인벤토리와 검증 보고서를 `Source`로 등록한다. 분석 문서가 주장하는 원본 MP4·PDF·DOCX는 실제 파일이 없으므로 `claimed_original_names`, `notes`와 locator의 주장 메타데이터로만 보존한다.
- 분석을 재배열한 study 문서는 `self_created` Source이자 `generated_study_material`로 표시하고, 출처 기반 원문이나 강사 발언 Source처럼 취급하지 않는다.
- `EvidenceKind`는 `document_text`, `screen_text`, `instructor_speech`, `analyst_synthesis`, `generated_study_material`을 구분한다.
- 자동 품질 게이트 통과는 파일 처리 완전성을 뜻할 뿐 콘텐츠를 `reviewed` 또는 `verified`로 승격하는 근거가 아니다.

## 강의 학습 콘텐츠

- `LearningExpression`은 재사용 가능한 표현을 분리한다. 자료의 부분 병음이나 병음 존재 설명을 전체 병음으로 저장하지 않는다.
- `PronunciationItem`은 확인된 지도 내용만 보존하고 음가·병음을 일반 지식으로 보충하지 않는다.
- `PracticeDrill`은 강의가 말한 시간과 행동을 보존하되 반복 횟수, 하루 분량과 복습 간격을 만들지 않는다.
- `CourseInsight`는 직접 강사 발언과 분석자 통합을 `evidence_kind`로 구분하고 과정 목표를 `level_3`로 보존한다.
- 상세분석에 타임스탬프가 있는 발음 지도와 핵심 전략은 `instructor_speech` 관계를 보존하되 원본 영상 부재 때문에 `review_needed`로 유지한다.
- 정확한 전후 중국어와 전체 병음 요건을 충족하지 않는 강의 교정은 `Correction`으로 만들지 않고 충돌·검토 항목으로 남긴다.
- 특정 문제 연결과 중국어·전체 병음·한국어·실제 출처 위치가 모두 확인되지 않은 표현이나 템플릿은 `ModelAnswer` 후보가 아니다.

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
- IndexedDB 장기 마이그레이션과 백업 정책

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
13. 강의 자료는 각 레코드의 `evidence_kind`와 실제 Markdown `SourceReference`를 유지하고, 저장소에 없는 원본 매체를 확인한 Source처럼 등록하지 않는다.
14. 3급 과정 전략을 Level 8 전략으로 바꾸지 않고 `course_target_context = level_3`로 보존한다.
15. 전체 병음이 없는 표현·교정·답변 후보에 병음을 생성하지 않는다.
16. 분석자 통합과 재구성 학습 자료를 강사 직접 발언으로 표시하지 않는다.
17. Part 6·7의 부족한 근거를 임의의 가이드나 답변으로 채우지 않는다.
