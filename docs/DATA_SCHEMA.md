# 데이터 스키마 초안

## 범위와 표기

이 문서는 특정 데이터베이스나 파일 형식을 정하지 않는 개념 스키마다. Excel, CSV, JSON 또는 데이터베이스 문법으로 바로 해석하지 않는다.

- `Identifier`: 엔터티를 구분하는 안정적인 값
- `Text`: 문자열
- `Integer`: 정수
- `Date` / `DateTime`: 날짜 또는 시각
- `Enum`: 문서에 정의된 값 중 하나
- `List<T>`: 같은 형식 값의 목록
- `Reference<T>`: 다른 엔터티 식별자

필수 여부가 `조건부`인 필드는 원본 적재 중에는 비어 있을 수 있지만 특정 상태나 용도에서는 반드시 필요하다.

## 공통 언어 묶음: `LanguageSet`

중국어 문제·표현·답변을 검수 완료하거나 사이트에 표시할 때 함께 관리하는 값이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `zh` | `Text` | 조건부 | 중국어 원문. 검수 완료·표시 데이터에서는 필수 | `我喜欢在家运动。` |
| `pinyin` | `Text` | 조건부 | 중국어 전체에 대응하는 성조 포함 병음. 검수 완료·표시 데이터에서는 필수 | `Wǒ xǐhuan zài jiā yùndòng.` |
| `ko` | `Text` | 조건부 | 문맥을 반영한 한국어 뜻. 검수 완료·표시 데이터에서는 필수 | `저는 집에서 운동하는 것을 좋아합니다.` |

## `Source`

강의 분석, Excel, PDF, 강사 교정, 자체 제작 자료의 출처와 사용 조건을 기록한다. 실제 자료를 확인하지 않고 Source 레코드를 만들지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `source_id` | `Identifier` | 필수 | 저장소 안에서 사용하는 출처 식별자 | `src-expected-questions-001` |
| `title` | `Text` | 필수 | 자료 제목 또는 식별 가능한 설명 | `예상 문제 정리 1차` |
| `source_type` | `Enum` | 필수 | `course_analysis`, `excel`, `pdf`, `instructor_correction`, `self_created`, `other` | `excel` |
| `provenance_status` | `Enum` | 필수 | `verified_source`, `unverified_source`, `self_created` | `unverified_source` |
| `creator_or_provider` | `Text` | 선택 | 강사, 작성자, 제공처. 모르면 비워 둠 | `사용자 제공` |
| `original_file_name` | `Text` | 선택 | 변경 전 원본 파일명 | `expected_questions.xlsx` |
| `file_ref` | `Text` | 선택 | 저장소 또는 별도 보관 위치 | `data/raw/expected_questions.xlsx` |
| `acquired_date` | `Date` | 선택 | 사용자가 자료를 확보하거나 제공한 날짜 | `2026-07-24` |
| `rights_status` | `Enum` | 필수 | `review_needed`, `private_use`, `public_allowed` | `review_needed` |
| `notes` | `Text` | 선택 | 범위, 판본, 확인 필요 사항 | `공개 저장소 업로드 전 확인 필요` |

## `Question`

문제 자체만 관리한다. 모범답안 필드를 포함하지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `question_id` | `Identifier` | 필수 | 질문 식별자 | `q-part4-0001` |
| `source_id` | `Reference<Source>` | 조건부 | 원본 또는 자체 제작 출처. `verified`에서는 필수 | `src-expected-questions-001` |
| `source_locator` | `Text` | 조건부 | 시트·행·문단 등 원본 위치. 출처 문제의 `verified`에서는 필수 | `Sheet1!A12` |
| `question_zh` | `Text` | 조건부 | 중국어 문제. `normalized` 이상에서는 필수 | `你喜欢在哪儿运动？` |
| `question_pinyin` | `Text` | 조건부 | 전체 병음. `verified` 및 표시 데이터에서는 필수 | `Nǐ xǐhuan zài nǎr yùndòng?` |
| `question_ko` | `Text` | 조건부 | 한국어 뜻. `verified` 및 표시 데이터에서는 필수 | `어디에서 운동하는 것을 좋아하나요?` |
| `part` | `Integer` | 조건부 | 1~7. `verified`에서는 필수 | `4` |
| `question_type` | `Text` | 조건부 | 검수된 문제 유형. 확실하지 않으면 비워 둠 | `개인 선호 설명` |
| `question_status` | `Enum` | 필수 | `raw`, `normalized`, `verified` | `normalized` |
| `normalization_notes` | `Text` | 선택 | 원본에서 바꾼 내용과 이유 | `문장부호만 통일` |
| `tags` | `List<Text>` | 선택 | 검색·분류 보조 태그 | `운동`, `일상` |

## `ModelAnswer`

질문과 분리된 모범답안 작업 항목이다. 하나의 질문에 여러 항목을 연결할 수 있다. `missing` 상태에서는 답변 본문이 비어 있는 것이 정상이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `answer_id` | `Identifier` | 필수 | 모범답안 식별자 | `a-q-part4-0001-basic-01` |
| `question_id` | `Reference<Question>` | 필수 | 답변이 연결되는 질문 | `q-part4-0001` |
| `answer_variant` | `Enum` | 필수 | `basic`, `level_8_expansion`, `other` | `basic` |
| `target_level` | `Text` | 선택 | 목표 수준 설명. 확인되지 않은 채점 기준을 뜻하지 않음 | `기본 정확성 우선` |
| `answer_zh` | `Text` | 조건부 | 중국어 답변. `draft` 이상에서는 필수 | `我喜欢在家运动。` |
| `answer_pinyin` | `Text` | 조건부 | 전체 병음. `reviewed` 이상과 표시 데이터에서는 필수 | `Wǒ xǐhuan zài jiā yùndòng.` |
| `answer_ko` | `Text` | 조건부 | 한국어 뜻. `reviewed` 이상과 표시 데이터에서는 필수 | `저는 집에서 운동하는 것을 좋아합니다.` |
| `structure_segments` | `List<StructureSegment>` | 선택 | Part 구조 단계와 해당 문장 구간 | `직접 답변: 我喜欢在家运动。` |
| `answer_status` | `Enum` | 필수 | `missing`, `draft`, `review_needed`, `reviewed`, `approved` | `missing` |
| `provenance_kind` | `Enum` | 필수 | `verified_source`, `project_created`, `unverified_source` | `project_created` |
| `source_id` | `Reference<Source>` | 조건부 | 출처 답변이면 필수, 프로젝트 작성이면 선택 | `src-lecture-analysis-001` |
| `review_notes` | `Text` | 선택 | 언어·구조 검수 기록 | `연결 표현 확인 필요` |

## `Correction`

강의의 대표 오류와 사용자 개인 오류를 같은 필드 구조로 기록하되 범위와 출처를 구분한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `correction_id` | `Identifier` | 필수 | 교정 식별자 | `c-user-0001` |
| `wrong_zh` | `Text` | 필수 | 잘못되거나 매우 부자연스러운 중국어 | `工作很忙，没有时间去健身房。` |
| `correct_zh` | `Text` | 필수 | 문맥을 반영한 올바른 중국어 | `因为工作很忙，我没有时间去健身房。` |
| `correct_pinyin` | `Text` | 조건부 | 올바른 중국어의 전체 병음. 검수·표시 시 필수 | `Yīnwèi gōngzuò hěn máng, wǒ méiyǒu shíjiān qù jiànshēnfáng.` |
| `correct_ko` | `Text` | 조건부 | 올바른 문장의 한국어 뜻. 검수·표시 시 필수 | `일이 매우 바빠서 저는 헬스장에 갈 시간이 없습니다.` |
| `error_type` | `Text` | 필수 | 문법, 어순, 단어 선택, 연결 등 오류 유형 | `내용 연결` |
| `reason` | `Text` | 필수 | 최소 수정 이유 | `앞 문장을 이유로 명확히 연결함` |
| `source_kind` | `Enum` | 필수 | `instructor`, `user_answer` | `user_answer` |
| `source_id` | `Reference<Source>` | 조건부 | 강의 교정이면 필수 | `src-lecture-analysis-001` |
| `user_answer_id` | `Reference<UserAnswer>` | 조건부 | 개인 답변 교정이면 필수 | `ua-0001` |
| `data_scope` | `Enum` | 필수 | `shared`, `personal` | `personal` |
| `correction_status` | `Enum` | 필수 | `draft`, `review_needed`, `reviewed` | `reviewed` |
| `learning_status` | `Enum` | 필수 | `못 외움`, `헷갈림`, `외움` | `헷갈림` |

## `PartGuide`

Part 1~7의 학습 가이드다. 확인되지 않은 파트 구조나 시험 규칙은 `reviewed`로 만들지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `part_guide_id` | `Identifier` | 필수 | 가이드 식별자 | `part-guide-04` |
| `part` | `Integer` | 필수 | 1~7 | `4` |
| `goal` | `Text` | 조건부 | 파트 학습 목표. 검수 완료 시 필수 | `질문에 직접 답하고 근거와 경험을 연결한다.` |
| `preparation_tips` | `List<Text>` | 조건부 | 준비 요령. 검수 완료 시 필수 | `먼저 직접 답변을 한 문장으로 정한다.` |
| `response_structure` | `List<Text>` | 조건부 | 순서가 있는 답변 구조 | `직접 답변`, `이유`, `구체적 설명이나 경험`, `결론` |
| `key_expressions` | `List<LanguageSet>` | 선택 | 반드시 외울 표현. 각 항목은 세 언어 필드를 함께 관리 | `我觉得…… / Wǒ juéde... / 저는 …라고 생각합니다` |
| `representative_question_ids` | `List<Reference<Question>>` | 선택 | 검수된 대표 문제 | `q-part4-0001` |
| `frequent_correction_ids` | `List<Reference<Correction>>` | 선택 | 자주 하는 실수 | `c-shared-0001` |
| `source_ids` | `List<Reference<Source>>` | 조건부 | 가이드 근거. 검수 완료 시 필수 | `src-lecture-analysis-001` |
| `guide_status` | `Enum` | 필수 | `draft`, `review_needed`, `reviewed` | `draft` |

## `UserAnswer`

사용자의 원래 입력과 사용자가 승인한 교정 결과를 보관하는 개인 데이터다. 저장 위치와 사용자 식별 방식은 아직 미결정이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `user_answer_id` | `Identifier` | 필수 | 사용자 답변 식별자 | `ua-0001` |
| `learner_ref` | `Identifier` | 조건부 | 개인 데이터 소유자 식별자. 인증 결정 후 구체화 | `local-user` |
| `question_id` | `Reference<Question>` | 필수 | 답변 대상 질문 | `q-part4-0001` |
| `input_language` | `Enum` | 필수 | `ko`, `zh`, `mixed` | `zh` |
| `original_input` | `Text` | 필수 | 사용자가 입력한 원문 | `我喜欢在家运动。工作很忙……` |
| `corrected_zh` | `Text` | 필수 | 승인할 교정 중국어 | `我喜欢在家运动。因为工作很忙……` |
| `corrected_pinyin` | `Text` | 필수 | 교정 중국어 전체 병음 | `Wǒ xǐhuan zài jiā yùndòng. Yīnwèi...` |
| `corrected_ko` | `Text` | 필수 | 교정 답변의 한국어 뜻 | `저는 집에서 운동하는 것을 좋아합니다. 일이 바빠서……` |
| `correction_mode` | `Enum` | 필수 | 기본값 `minimal`; 향후 `easy`, `natural`, `level_8_expansion` 분리 가능 | `minimal` |
| `change_summary` | `List<ChangeReason>` | 필수 | 수정 전후 표현과 간단한 이유 | `工作很忙 → 因为工作很忙 / 이유 연결` |
| `structure_segments` | `List<StructureSegment>` | 필수 | Part 구조별 답변 구간 | `직접 답변: 我喜欢在家运动。` |
| `save_status` | `Enum` | 필수 | `draft`, `user_approved` | `user_approved` |
| `created_at` | `DateTime` | 필수 | 생성 시각 | `2026-07-24T22:00:00+09:00` |

## `ReviewState`

문제, 사용자 답변, 오류 등 복습 대상에 대한 개인 학습 상태다. 공용 콘텐츠와 분리한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `review_state_id` | `Identifier` | 필수 | 복습 상태 식별자 | `rs-0001` |
| `learner_ref` | `Identifier` | 조건부 | 개인 데이터 소유자 식별자 | `local-user` |
| `target_type` | `Enum` | 필수 | `question`, `user_answer`, `correction` | `question` |
| `target_id` | `Identifier` | 필수 | 복습 대상 식별자 | `q-part4-0001` |
| `learning_status` | `Enum` | 필수 | `못 외움`, `헷갈림`, `외움` | `못 외움` |
| `last_reviewed_at` | `DateTime` | 선택 | 마지막 복습 시각 | `2026-07-24T22:00:00+09:00` |
| `review_count` | `Integer` | 필수 | 복습 횟수, 초기값 0 | `3` |

## 관계

| 관계 | 설명 |
|---|---|
| `Source` 1 → N `Question` | 한 출처에서 여러 질문을 추출할 수 있다. |
| `Question` 1 → 0..N `ModelAnswer` | 질문에 답변이 하나도 없거나 여러 목표·변형 답변이 있을 수 있다. |
| `Question` 1 → N `UserAnswer` | 같은 질문에 사용자가 여러 답변을 저장할 수 있다. |
| `UserAnswer` 1 → 0..N `Correction` | 한 사용자 답변에서 여러 개인 오류가 나올 수 있다. |
| `Source` 1 → N `Correction` | 한 강의 출처에서 여러 대표 오류를 추출할 수 있다. |
| `PartGuide` N ↔ N `Question` | 한 가이드는 여러 대표 문제를 가지며, 문제는 필요에 따라 여러 가이드 맥락에서 참조될 수 있다. |
| 학습자 1 → N `ReviewState` | 개인 복습 상태는 공용 콘텐츠와 별도로 저장한다. |

## 공통 검증 규칙

- `Question`에는 모범답안 본문을 넣지 않는다.
- `ModelAnswer.answer_status = missing`이면 답변 언어 필드가 비어 있어도 유효하다.
- `reviewed` 또는 사이트 표시용 중국어 문제·표현·답변은 중국어, 병음, 한국어 뜻이 모두 있어야 한다.
- `raw`와 `working` 단계의 누락 필드는 오류가 아니라 검수할 작업으로 다룬다.
- 출처 기반 데이터와 `self_created` 데이터를 같은 출처 상태로 표시하지 않는다.
- `UserAnswer`, 개인 `Correction`, `ReviewState`는 공용 문제·모범답안과 저장 범위를 분리한다.
- 기준 파일 형식, 데이터베이스, 사용자 식별 방식은 `DECISIONS.md`에서 미결정으로 유지한다.
