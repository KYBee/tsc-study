# 데이터 스키마 v1

## 범위와 표기

이 문서는 두 차례의 대표 표본 검증 결과를 반영한 구현 기술 독립적인 개념 스키마다. 특정 데이터베이스, ORM, Excel, CSV 또는 JSON 문법을 정하지 않는다. 현재 `data/working`의 CSV는 원본 반입과 구조 검증을 위한 작업 형식이며, 이 문서의 canonical 스키마와 동일한 물리 구조일 필요는 없다.

MVP의 물리 데이터 단계와 저장 경계는 [DATA_FORMAT_DECISION.md](DATA_FORMAT_DECISION.md)를 따른다.

- `Identifier`: 엔터티를 구분하는 안정적인 값
- `Text`: 문자열
- `Integer`: 정수
- `Date` / `DateTime`: 날짜 또는 시각
- `Enum`: 문서에 정의된 값 중 하나
- `List<T>`: 같은 형식 값의 목록
- `Reference<T>`: 다른 엔터티 식별자

필수 여부가 `조건부`인 필드는 원본 적재 중에는 비어 있을 수 있지만 특정 상태나 용도에서는 반드시 필요하다. `source_reference_ids`는 논리적인 연결을 나타내며, 실제 저장 방식에서 식별자 목록을 중복 저장하라는 뜻은 아니다. canonical 관계는 `SourceReference.target_type`과 `target_id`로 조회할 수 있다.

## 핵심 원칙

1. `Question`의 고유 식별자는 `question_id`다.
2. `question_zh`는 고유값이 아니며 unique 제약을 두지 않는다.
3. 같은 중국어 문장이라도 그림, `AnswerPoint`, 출처 맥락이 다르면 서로 다른 `Question`일 수 있다.
4. Part 7의 공통 지시문 반복은 의도된 정상 데이터다.
5. `Question`과 `ModelAnswer`는 분리한다. 하나의 `Question`에는 `ModelAnswer`가 없거나 여러 개 있을 수 있다.
6. `AnswerPoint`와 `StoryGuide`는 완성된 `ModelAnswer`가 아니다.
7. 공용 콘텐츠와 `UserAnswer`, 개인 `Correction`, `ReviewState` 같은 개인 학습 기록은 저장 범위를 분리한다.
8. 실제로 반입·확인한 파일과 그 파일 안에 적힌 세부 출처 주장을 구분한다.
9. 시각 자료의 공개 가능 여부는 `VisualAsset` 단위로 관리한다.

## 공통 언어 묶음: `LanguageSet`

중국어 문제·표현·답변을 검수 완료하거나 사이트에 표시할 때 함께 관리하는 값이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `zh` | `Text` | 조건부 | 중국어 원문. 검수 완료·표시 데이터에서는 필수 | `我喜欢在家运动。` |
| `pinyin` | `Text` | 조건부 | 중국어 전체에 대응하는 성조 포함 병음. 검수 완료·표시 데이터에서는 필수 | `Wǒ xǐhuan zài jiā yùndòng.` |
| `ko` | `Text` | 조건부 | 문맥을 반영한 한국어 뜻. 검수 완료·표시 데이터에서는 필수 | `저는 집에서 운동하는 것을 좋아합니다.` |

## 공용 콘텐츠 엔터티

### `Source`

실제로 반입하거나 확인한 강의 분석 파일, Excel, PDF, 강사 교정 자료, 자체 제작 자료의 출처와 사용 조건을 기록한다. 원본 안에 이름이나 URL만 적혀 있다는 이유로 별도의 검증된 `Source`를 만들지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `source_id` | `Identifier` | 필수 | 저장소 안에서 사용하는 출처 식별자 | `src-001` |
| `title` | `Text` | 필수 | 자료 제목 또는 식별 가능한 설명 | `TSC 파트별 문제은행 그림 포함` |
| `source_type` | `Enum` | 필수 | `course_analysis`, `excel`, `pdf`, `instructor_correction`, `self_created`, `other` | `excel` |
| `provenance_status` | `Enum` | 필수 | `verified_source`, `unverified_source`, `self_created` | `unverified_source` |
| `creator_or_provider` | `Text` | 선택 | 강사, 작성자, 제공처. 모르면 비워 둠 | `사용자 제공` |
| `original_file_name` | `Text` | 조건부 | 실제 원본 파일의 원래 파일명. 파생본 이름이 달라지면 필수 | `TSC_파트별_문제은행_그림포함.xlsx` |
| `file_ref` | `Text` | 선택 | 저장소 또는 별도 보관 위치 | `data/raw/TSC_파트별_문제은행_그림포함.xlsx` |
| `acquired_date` | `Date` | 선택 | 사용자가 자료를 확보하거나 제공한 날짜 | `2026-07-24` |
| `rights_status` | `Enum` | 필수 | `review_needed`, `private_use`, `public_allowed`, `restricted` | `review_needed` |
| `notes` | `Text` | 선택 | 범위, 판본, 확인 필요 사항 | `공개 저장소 사용 전 별도 확인 필요` |

### `SourceReference`

특정 콘텐츠가 어떤 실제 `Source`에서 왔는지, 그 안의 어느 위치인지, 원본이 주장하는 세부 출처가 무엇인지를 연결한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `source_reference_id` | `Identifier` | 필수 | 출처 관계 식별자 | `sr-q-p4-001-extracted` |
| `target_type` | `Enum` | 필수 | `question`, `model_answer`, `correction`, `part_guide`, `visual_set`, `visual_question`, `question_visual_set`, `story_guide`, `answer_point` | `question` |
| `target_id` | `Identifier` | 필수 | 출처 관계가 연결되는 콘텐츠 식별자 | `P4-001` |
| `source_id` | `Reference<Source>` | 필수 | 실제로 확인한 자료 | `src-001` |
| `source_locator` | `Text` | 조건부 | 시트·행·페이지·문단 등 실제 위치. 위치가 있는 자료에서는 필수 | `문제은행!A138:N138` |
| `relationship_kind` | `Enum` | 필수 | `extracted_from`, `claimed_origin`, `derived_from`, `supports`, `self_created` | `extracted_from` |
| `claimed_source_name` | `Text` | 선택 | 원본 내부에 적힌 세부 출처 이름을 주장 그대로 보존 | `YBM 공식 샘플` |
| `claimed_source_url` | `Text` | 선택 | 원본 내부에 적힌 URL. 존재만으로 검증되지 않음 | `원본에 기록된 URL` |
| `source_grade` | `Text` | 선택 | 해당 콘텐츠 관계에 기록된 자료 등급 | `A 공식 샘플` |
| `originality` | `Text` | 선택 | 해당 콘텐츠 관계에 기록된 원문성 | `공식 원문` |
| `verification_status` | `Enum` | 필수 | `unverified`, `review_needed`, `verified`, `rejected` | `unverified` |
| `notes` | `Text` | 선택 | 연결 근거와 확인할 사항 | `URL 미검증` |

운영 원칙:

- `source_id`는 직접 확인한 실제 `Source`를 참조한다.
- `claimed_source_name`과 `claimed_source_url`은 원본 내부의 주장이다.
- 주장된 이름이나 URL을 검증된 `Source`로 자동 등록하지 않는다.
- 하나의 콘텐츠에는 실제 추출 파일, 주장된 원출처, 파생 관계 등 여러 `SourceReference`가 연결될 수 있다.
- `target_type`과 `target_id`는 서로 일치하는 실제 콘텐츠 하나를 가리켜야 한다.
- 최초 반입에서는 `extracted_from` 관계에 실제 파일과 위치를 기록하고 원본 내부의 이름·URL·등급·원문성 주장을 함께 보존할 수 있다. 주장된 원출처를 별도 `Source`로 확인한 뒤에는 추가 `claimed_origin` 관계로 연결한다.
- `relationship_kind = self_created`이면 `provenance_status = self_created`인 실제 `Source`를 참조한다.
- 현재 작업용 CSV의 출처 컬럼은 canonical `SourceReference`로 매핑한다. CSV 호환 필드를 즉시 삭제하거나 원본 CSV를 바꾸라는 뜻은 아니다.

### `Question`

문제 자체만 관리한다. 출처 관계, 답변 포인트, 모범답안, 개인 학습 상태와 개인 메모를 본문 필드에 넣지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `question_id` | `Identifier` | 필수 | 질문의 고유 식별자 | `P4-001` |
| `part` | `Integer` | 필수 | 1~7 | `4` |
| `question_type` | `Text` | 조건부 | 검수된 문제 유형. 확실하지 않으면 비워 둠 | `개인 선호 설명` |
| `question_zh` | `Text` | 필수 | 중국어 문제 원문. 고유값이 아님 | `你喜欢在哪儿运动？` |
| `question_pinyin` | `Text` | 조건부 | 전체 병음. `verified` 및 표시 데이터에서는 필수 | `Nǐ xǐhuan zài nǎr yùndòng?` |
| `question_ko` | `Text` | 조건부 | 한국어 뜻. `verified` 및 표시 데이터에서는 필수 | `어디에서 운동하는 것을 좋아하나요?` |
| `question_status` | `Enum` | 필수 | `raw`, `normalized`, `verified` | `raw` |
| `normalization_notes` | `Text` | 선택 | 원본에서 바꾼 내용과 이유 | `문장부호만 통일` |
| `tags` | `List<Text>` | 선택 | 검색·분류 보조 태그 | `운동`, `일상` |

운영 원칙:

- `question_id`는 필수이며 고유하다. `question_zh`는 식별자로 사용하지 않는다.
- `raw` 단계에서는 병음이나 한국어 뜻이 비어 있을 수 있다.
- `verified` 또는 사이트 표시 단계에서는 중국어, 병음, 한국어 뜻이 모두 필요하다.
- 출처 관련 값은 `SourceReference`를 통해 관리한다.
- 현재 작업용 CSV의 `source_id`, `source_locator`, `source_grade`, `source_name`, `source_url`, `originality`는 canonical `SourceReference`로 매핑한다.
- 현재 작업용 CSV의 `answer_point`는 canonical `AnswerPoint`로 매핑한다.

### `AnswerPoint`

질문에 딸린 답변 구조, 시간 안내, 핵심 힌트, 주의사항, 출처 메모 또는 이야기 구성 포인트를 보존한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `answer_point_id` | `Identifier` | 필수 | 답변 포인트 식별자 | `ap-P7-001-01` |
| `question_id` | `Reference<Question>` | 필수 | 연결되는 질문 | `P7-001` |
| `point_type` | `Enum` | 필수 | `response_structure`, `key_hint`, `time_guidance`, `evaluation_focus`, `source_note`, `story_point`, `unclassified`, `other` | `unclassified` |
| `content` | `Text` | 필수 | 원본 또는 검수된 답변 포인트 내용 | `구매 → 자랑 → 문제 발생 → 수습` |
| `sequence` | `Integer` | 선택 | 같은 질문 안에서의 표시 순서 | `1` |
| `point_status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `raw` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 선택 | 이 콘텐츠의 출처 관계 | `sr-ap-P7-001-extracted` |
| `notes` | `Text` | 선택 | 분류 또는 검수 메모 | `유형 분류 필요` |

운영 원칙:

- 처음 반입할 때 원본 `answer_point`를 `content`에 그대로 저장할 수 있다.
- 아직 분류되지 않았다면 `point_type = unclassified`로 둔다.
- 원본 값을 근거 없이 여러 문장이나 포인트로 분해하지 않는다.
- 하나의 `Question`에 여러 `AnswerPoint`가 연결될 수 있다.
- `AnswerPoint`는 완성된 `ModelAnswer`가 아니다.

### `VisualAsset`

실제 이미지 파일, 바이트 식별 정보, 원본 위치와 권리 상태를 관리한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `visual_asset_id` | `Identifier` | 필수 | 시각 파일 식별자 | `va-P2-V01-01` |
| `source_id` | `Reference<Source>` | 필수 | 이미지 바이트를 추출한 실제 자료 | `src-001` |
| `source_locator` | `Text` | 필수 | 원본 파일 안의 media 경로와 worksheet anchor 등 실제 위치 | `Part2 그림 연습!anchor-1` |
| `repository_path` | `Text` | 필수 | 검수 상태에 맞는 저장소 안의 파일 경로. reviewed 데이터에서는 working 추출 경로를 그대로 사용하지 않음 | `data/reviewed/assets/part2__P2-V01.png` |
| `media_type` | `Text` | 필수 | 원본 미디어 형식 | `image/png` |
| `file_size` | `Integer` | 필수 | 바이트 단위 파일 크기 | `123456` |
| `sha256` | `Text` | 필수 | 이미지 바이트의 SHA-256 | `64자리 16진수` |
| `width` | `Integer` | 선택 | 원본 이미지 너비(px) | `800` |
| `height` | `Integer` | 선택 | 원본 이미지 높이(px) | `600` |
| `rights_status` | `Enum` | 필수 | `review_needed`, `private_use`, `public_allowed`, `restricted` | `review_needed` |
| `asset_status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `raw` |
| `notes` | `Text` | 선택 | anchor 근거, 파생 여부, 확인 사항 | `원본 바이트 그대로 추출` |

운영 원칙:

- `visual_asset_id`가 레코드 식별자이며 `sha256`은 동일 바이트 확인에 사용한다.
- 같은 `sha256`이어도 사용 맥락은 `VisualSet`에서 별도로 관리한다.
- 원본 이미지를 가공했다면 원본과 파생 이미지를 구분하고 파생 근거를 남긴다.
- 현재 표본에서 추출한 이미지의 `rights_status`는 `review_needed`다.
- `source_id`와 `source_locator`는 이미지 바이트의 실제 컨테이너와 위치를 가리킨다. 원본 내부의 출처 주장은 `VisualSet` 등에 연결된 `SourceReference`로 관리한다.

### `VisualSet`

한 문제나 학습 활동에서 함께 사용하는 시각 자료 묶음이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `visual_set_id` | `Identifier` | 필수 | 시각 자료 묶음 식별자 | `vs-P2-V01` |
| `part` | `Integer` | 필수 | 1~7 | `2` |
| `set_type` | `Enum` | 필수 | `four_question_image`, `story_image`, `official_sample`, `other` | `four_question_image` |
| `set_status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `raw` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 선택 | 세트의 원본 블록과 세부 출처 관계 | `sr-vs-P2-V01-extracted` |
| `notes` | `Text` | 선택 | 세트 구조와 확인 사항 | `질문 4개 포함` |

### `VisualSetAsset`

`VisualSet`과 `VisualAsset`의 N:M 연결을 관리한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `visual_set_asset_id` | `Identifier` | 필수 | 연결 식별자 | `vsa-P2-V01-01` |
| `visual_set_id` | `Reference<VisualSet>` | 필수 | 시각 자료 묶음 | `vs-P2-V01` |
| `visual_asset_id` | `Reference<VisualAsset>` | 필수 | 연결할 이미지 파일 | `va-P2-V01-01` |
| `sequence` | `Integer` | 필수 | 세트 안의 표시 순서 | `1` |
| `role` | `Text` | 선택 | 대표 이미지, 연속 장면 등 역할 | `primary` |
| `mapping_status` | `Enum` | 필수 | `raw`, `review_needed`, `verified` | `review_needed` |
| `notes` | `Text` | 선택 | anchor와 세트 연결 근거 | `명시적 그림 ID 확인` |

현재 세트당 이미지가 한 개여도 향후 여러 이미지가 연결되거나 같은 이미지가 여러 세트에서 사용될 수 있도록 N:M 구조를 사용한다.

### `QuestionVisualSet`

`Question`과 `VisualSet`의 N:M 관계를 명시적으로 관리한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `question_visual_set_id` | `Identifier` | 필수 | 질문과 시각 세트 연결 식별자 | `qvs-0001` |
| `question_id` | `Reference<Question>` | 필수 | 연결할 질문 | `q-visual-0001` |
| `visual_set_id` | `Reference<VisualSet>` | 필수 | 연결할 시각 자료 묶음 | `vs-0001` |
| `relationship_kind` | `Enum` | 필수 | `primary`, `supporting`, `variation`, `unverified` | `primary` |
| `mapping_status` | `Enum` | 필수 | `raw`, `review_needed`, `verified` | `review_needed` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 선택 | 연결을 뒷받침하는 원본 위치와 근거 | `sr-qvs-P7-001-P7-V01` |
| `notes` | `Text` | 선택 | 연결 방법과 검수 메모 | `명시적 ID 확인 필요` |

운영 원칙:

- 단순히 원본 행 순서나 비슷한 접미사가 같다는 이유만으로 연결하지 않는다.
- 명시적인 ID 또는 검증 가능한 근거가 있을 때만 관계를 만든다.
- 연결 근거가 부족하면 관계 레코드를 만들지 않을 수 있으며, 작업용 `linked_question_id`가 빈 값인 것은 오류가 아니다.
- Part 7 문제의 실질적 학습 단위는 `Question + VisualSet + StoryGuide` 조합이 될 수 있다.

### `VisualQuestion`

Part 2처럼 하나의 `VisualSet`에 포함된 여러 하위 질문을 관리한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `visual_question_id` | `Identifier` | 필수 | 시각 하위 질문 식별자 | `vq-P2-V01-Q1` |
| `visual_set_id` | `Reference<VisualSet>` | 필수 | 소속 시각 자료 묶음 | `vs-P2-V01` |
| `item_number` | `Integer` | 필수 | 세트 안의 표시 순서 | `1` |
| `question_id` | `Reference<Question>` | 조건부 | canonical 질문과 명확히 연결될 때만 입력 | `P2-006` |
| `question_zh` | `Text` | 조건부 | 연결이 없을 때 원문 질문을 보존. 자체 표시 시 필수 | `男的在做什么？` |
| `question_pinyin` | `Text` | 조건부 | 전체 병음. 검수 완료·표시 시 필수 | `Nán de zài zuò shénme?` |
| `question_ko` | `Text` | 조건부 | 한국어 뜻. 검수 완료·표시 시 필수 | `남자는 무엇을 하고 있습니까?` |
| `visual_question_status` | `Enum` | 필수 | `raw`, `normalized`, `verified` | `raw` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 선택 | 질문 원본 위치와 세부 출처 관계 | `sr-vq-P2-V01-Q1` |
| `notes` | `Text` | 선택 | 연결 방법과 검수 사항 | `중국어 단일 완전 일치` |

운영 원칙:

- `question_id`는 원본의 명시적 ID 연결 또는 단 하나의 `question_zh` 완전 일치처럼 검증 가능한 근거가 있을 때만 입력한다.
- canonical `Question`에 연결되지 않아도 `VisualQuestion` 자체는 유효하다.
- `question_id`가 없으면 자체 언어 필드로 원본 질문을 보존한다.
- 의미 유사성, 행 순서, ID 접미사만으로 연결하지 않는다. 같은 중국어 원문과 완전히 일치하는 `Question`이 여러 개라면 임의로 하나를 연결하지 않는다.

### `ModelAnswer`

`Question` 또는 `VisualQuestion`과 분리된 모범답안·출처 답변 작업 항목이다. 대상 하나에 답변이 없거나 여러 개 있을 수 있다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `answer_id` | `Identifier` | 필수 | 답변 식별자 | `a-vq-P2-V01-Q1-basic-01` |
| `answer_target_type` | `Enum` | 필수 | `question`, `visual_question` | `visual_question` |
| `answer_target_id` | `Identifier` | 필수 | 선택한 대상 타입의 식별자 | `vq-P2-V01-Q1` |
| `answer_variant` | `Enum` | 필수 | `basic`, `level_8_expansion`, `other` | `basic` |
| `target_level` | `Text` | 선택 | 목표 수준 설명. 확인되지 않은 채점 기준을 뜻하지 않음 | `기본 정확성 우선` |
| `answer_zh` | `Text` | 조건부 | 중국어 답변. `draft` 이상에서는 필수 | `男的正在跑步。` |
| `answer_pinyin` | `Text` | 조건부 | 전체 병음. `reviewed` 이상과 표시 데이터에서는 필수 | `Nán de zhèngzài pǎobù.` |
| `answer_ko` | `Text` | 조건부 | 한국어 뜻. `reviewed` 이상과 표시 데이터에서는 필수 | `남자는 달리고 있습니다.` |
| `structure_segments` | `List<StructureSegment>` | 선택 | Part 구조 단계와 해당 문장 구간 | `핵심 정보: 男的正在跑步。` |
| `answer_status` | `Enum` | 필수 | `missing`, `draft`, `review_needed`, `reviewed`, `approved` | `review_needed` |
| `provenance_kind` | `Enum` | 필수 | `verified_source`, `project_created`, `unverified_source` | `unverified_source` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 조건부 | 출처 답변이면 필수인 원본 위치 관계. 프로젝트 생성 답변은 선택 | `sr-a-vq-P2-V01-Q1` |
| `review_notes` | `Text` | 선택 | 언어·구조 검수 기록 | `원본 추천 답변, 미검수` |

운영 원칙:

- `answer_target_type`과 `answer_target_id`는 반드시 실제로 존재하는 대상 하나를 함께 가리킨다.
- 기존 작업용 CSV의 `question_id`는 `answer_target_type = question`인 경우의 import 필드로 매핑한다.
- Part 2 그림 답변은 `answer_target_type = visual_question`으로 연결할 수 있다.
- 원본 추천 답변은 `answer_status = review_needed`, `provenance_kind = unverified_source`로 유지한다.
- 출처 답변과 프로젝트가 새로 만든 답변을 구분한다. `provenance_kind`가 `verified_source` 또는 `unverified_source`이면 `source_reference_ids`가 필요하며, `source_locator`는 해당 `SourceReference`에서 관리한다.
- 답변이 없는 문제는 정상이다. 작업 항목을 명시적으로 관리할 필요가 없다면 `answer_status = missing`인 빈 레코드를 반드시 만들지 않는다.

### `StoryGuide`

Part 7 그림을 보고 이야기를 구성하도록 돕는 보조 콘텐츠다. 완성된 중국어 답변이 아니다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `story_guide_id` | `Identifier` | 필수 | 스토리 가이드 식별자 | `sg-P7-V01-01` |
| `visual_set_id` | `Reference<VisualSet>` | 필수 | 연결되는 스토리 그림 묶음 | `vs-P7-V01` |
| `question_id` | `Reference<Question>` | 조건부 | 명확한 근거로 연결할 수 있을 때만 입력 | `—` |
| `situation_ko` | `Text` | 선택 | 상황 요약 | `새 옷을 보여주다가 음료를 쏟는 상황` |
| `recommended_flow` | `Text` | 필수 | 원본의 추천 이야기 흐름 | `구매 → 자랑 → 문제 발생 → 수습` |
| `recommended_connectors_zh` | `Text` | 선택 | 원본이 제시한 중국어 연결어 | `一开始 → 后来 → 最后` |
| `material_nature` | `Text` | 선택 | 자료의 성격을 원문 기준으로 보존 | `공식 샘플 소재 재구성` |
| `guide_status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `raw` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 선택 | 가이드의 원본 위치와 세부 출처 관계 | `sr-sg-P7-V01-01` |
| `notes` | `Text` | 선택 | 연결 근거와 검수 사항 | `Question 연결 미검증` |

운영 원칙:

- `visual_set_id`는 필수이고 `question_id`는 명확히 연결될 때만 사용한다.
- `recommended_flow`를 중국어 `ModelAnswer`로 자동 변환하지 않는다.
- 하나의 `VisualSet`에 여러 `StoryGuide`가 연결될 수 있다.

### `Correction`

강의의 대표 오류와 사용자 개인 오류를 같은 필드 구조로 기록하되 범위와 출처를 구분한다. 사용자별 학습 상태는 포함하지 않고 `ReviewState`에서만 관리한다.

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
| `source_reference_ids` | `List<Reference<SourceReference>>` | 선택 | 강의 대표 오류 등의 출처 관계 | `sr-c-shared-0001` |
| `user_answer_id` | `Reference<UserAnswer>` | 조건부 | 개인 답변 교정이면 필수 | `ua-0001` |
| `data_scope` | `Enum` | 필수 | `shared`, `personal` | `personal` |
| `correction_status` | `Enum` | 필수 | `draft`, `review_needed`, `reviewed` | `reviewed` |

`Correction`에는 `learning_status`를 저장하지 않는다.

### `PartGuide`

Part 1~7의 학습 가이드다. 확인되지 않은 파트 구조나 시험 규칙은 `reviewed`로 만들지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `part_guide_id` | `Identifier` | 필수 | 가이드 식별자 | `part-guide-04` |
| `part` | `Integer` | 필수 | 1~7 | `4` |
| `goal` | `Text` | 조건부 | 파트 학습 목표. 검수 완료 시 필수 | `질문에 직접 답하고 근거와 경험을 연결한다.` |
| `preparation_tips` | `List<Text>` | 조건부 | 준비 요령. 검수 완료 시 필수 | `먼저 직접 답변을 한 문장으로 정한다.` |
| `response_structure` | `List<Text>` | 조건부 | 순서가 있는 답변 구조 | `직접 답변`, `이유`, `구체적 설명이나 경험`, `결론` |
| `key_expressions` | `List<LanguageSet>` | 선택 | 반드시 외울 표현. 각 항목은 세 언어 필드를 함께 관리 | `我觉得…… / Wǒ juéde... / 저는 …라고 생각합니다` |
| `representative_question_ids` | `List<Reference<Question>>` | 선택 | 검수된 대표 문제 | `P4-001` |
| `frequent_correction_ids` | `List<Reference<Correction>>` | 선택 | 자주 하는 실수 | `c-shared-0001` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 조건부 | 가이드 근거. 검수 완료 시 필수 | `sr-part-guide-04` |
| `guide_status` | `Enum` | 필수 | `draft`, `review_needed`, `reviewed` | `draft` |

## 개인 학습 엔터티

### `UserAnswer`

사용자가 저장을 승인한 원래 입력과 교정 결과를 보관하는 개인 데이터다. 편집 중 초안은 canonical `UserAnswer`로 보지 않는다. 초기 MVP의 물리 저장은 IndexedDB이며 사용자 식별 방식은 아직 미결정이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `user_answer_id` | `Identifier` | 필수 | 사용자 답변 식별자 | `ua-0001` |
| `learner_ref` | `Identifier` | 조건부 | 개인 데이터 소유자 식별자. 인증 결정 후 구체화 | `local-user` |
| `question_id` | `Reference<Question>` | 필수 | 답변 대상 질문 | `P4-001` |
| `input_language` | `Enum` | 필수 | `ko`, `zh`, `mixed` | `zh` |
| `original_input` | `Text` | 필수 | 사용자가 입력한 원문 | `我喜欢在家运动。工作很忙……` |
| `corrected_zh` | `Text` | 필수 | 사용자가 승인한 교정 중국어 | `我喜欢在家运动。因为工作很忙……` |
| `corrected_pinyin` | `Text` | 필수 | 교정 중국어 전체 병음 | `Wǒ xǐhuan zài jiā yùndòng. Yīnwèi...` |
| `corrected_ko` | `Text` | 필수 | 교정 답변의 한국어 뜻 | `저는 집에서 운동하는 것을 좋아합니다. 일이 바빠서……` |
| `correction_mode` | `Enum` | 필수 | 기본값 `minimal`; 향후 `easy`, `natural`, `level_8_expansion` 분리 가능 | `minimal` |
| `change_summary` | `List<ChangeReason>` | 필수 | 수정 전후 표현과 간단한 이유 | `工作很忙 → 因为工作很忙 / 이유 연결` |
| `structure_segments` | `List<StructureSegment>` | 필수 | Part 구조별 답변 구간 | `직접 답변: 我喜欢在家运动。` |
| `save_status` | `Enum` | 필수 | canonical 저장값 `user_approved` | `user_approved` |
| `created_at` | `DateTime` | 필수 | 생성 시각 | `2026-07-24T22:00:00+09:00` |

### `ReviewState`

문제, 사용자 답변, 오류 등 복습 대상에 대한 개인 학습 상태를 단독으로 관리한다. `못 외움`, `헷갈림`, `외움` 상태는 공용 콘텐츠나 `Correction`에 저장하지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `review_state_id` | `Identifier` | 필수 | 복습 상태 식별자 | `rs-0001` |
| `learner_ref` | `Identifier` | 조건부 | 개인 데이터 소유자 식별자 | `local-user` |
| `target_type` | `Enum` | 필수 | `question`, `user_answer`, `correction` | `question` |
| `target_id` | `Identifier` | 필수 | 복습 대상 식별자 | `P4-001` |
| `learning_status` | `Enum` | 필수 | `못 외움`, `헷갈림`, `외움` | `못 외움` |
| `last_reviewed_at` | `DateTime` | 선택 | 마지막 복습 시각 | `2026-07-24T22:00:00+09:00` |
| `review_count` | `Integer` | 필수 | 복습 횟수, 초기값 0 | `3` |

개인 데이터 원칙:

- `UserAnswer`는 사용자가 승인한 답변만 canonical 데이터로 저장한다.
- `ReviewState`만 사용자별 `못 외움`, `헷갈림`, `외움`을 관리한다.
- 공용 `Correction`과 개인 `Correction` 모두 콘텐츠 자체에는 학습 상태를 저장하지 않는다.
- `UserAnswer`, 개인 `Correction`, `ReviewState`는 공용 콘텐츠와 저장 범위를 분리한다.
- 초기 MVP의 개인 데이터는 공용 JSON과 분리해 IndexedDB에 저장한다. 사용자 인증, 서버 동기화와 IndexedDB 래퍼는 아직 결정하지 않는다.

## 현재 작업용 CSV에서 canonical 스키마로의 매핑

기존 CSV를 이번 작업에서 수정하지 않는다. 아래는 전체 반입 단계에서 사용할 방향이다.

| 현재 import 필드 | canonical 대상 | 원칙 |
|---|---|---|
| `source_id` | `SourceReference.source_id` | 실제 추출 파일인 `src-001`을 참조 |
| `source_locator` | `SourceReference.source_locator` | 시트와 행·범위를 그대로 보존 |
| `source_name` | `SourceReference.claimed_source_name` | workbook 내부 주장으로 보존 |
| `source_url` | `SourceReference.claimed_source_url` | 검증된 Source로 자동 승격하지 않음 |
| `source_grade` | `SourceReference.source_grade` | 콘텐츠와 출처 관계의 속성으로 보존 |
| `originality` | `SourceReference.originality` | 원본 값을 임의 통합하지 않음 |
| `answer_point` | `AnswerPoint.content` | 우선 `point_type = unclassified`, 원문 그대로 반입 |
| `linked_question_id` | `VisualQuestion.question_id` 또는 `QuestionVisualSet` | 명확한 연결 근거가 있을 때만 매핑 |
| 시각 질문의 출처 답변 | `ModelAnswer` | `answer_target_type = visual_question`으로 매핑 |
| Part 7 추천 흐름 | `StoryGuide` | `ModelAnswer`로 변환하지 않음 |

## 관계

| 관계 | 설명 |
|---|---|
| `Source` 1 → N `SourceReference` | 한 실제 자료가 여러 콘텐츠의 출처 관계를 제공할 수 있다. |
| `Question` 1 → N `SourceReference` | 한 질문에 실제 추출 파일과 주장된 원출처 등 여러 관계가 연결될 수 있다. |
| `Question` 1 → 0..N `AnswerPoint` | 질문에 답변 포인트가 없거나 여러 개 있을 수 있다. |
| `Question` 1 → 0..N `ModelAnswer` | `answer_target_type = question`인 경우이며, 답변이 없거나 여러 개일 수 있다. |
| `VisualSet` N ↔ N `VisualAsset` | `VisualSetAsset`으로 연결하며 한 세트의 여러 이미지와 이미지 재사용을 허용한다. |
| `VisualSet` 1 → N `VisualQuestion` | 한 Part 2 그림 세트에 여러 하위 질문이 연결될 수 있다. |
| `Question` N ↔ N `VisualSet` | `QuestionVisualSet`으로 연결하며 추측한 관계는 만들지 않는다. |
| `VisualQuestion` 1 → 0..N `ModelAnswer` | `answer_target_type = visual_question`인 경우이며 출처 답변이 여러 개일 수 있다. |
| `VisualSet` 1 → 0..N `StoryGuide` | 한 그림 세트에 스토리 가이드가 없거나 여러 개일 수 있다. |
| `Question` 1 → N `UserAnswer` | 같은 질문에 사용자가 승인한 여러 답변을 저장할 수 있다. |
| `UserAnswer` 1 → 0..N `Correction` | 한 사용자 답변에서 여러 개인 오류가 나올 수 있다. |
| 학습자 1 → N `ReviewState` | 개인 복습 상태는 공용 콘텐츠와 별도로 저장한다. |
| `PartGuide` N ↔ N `Question` | 한 가이드는 여러 대표 문제를 가지며 문제는 여러 가이드에서 참조될 수 있다. |

`ModelAnswer`는 다형 대상 관계를 사용한다. `answer_target_type`이 `question`이면 `answer_target_id`는 `Question.question_id`, `visual_question`이면 `VisualQuestion.visual_question_id`를 참조해야 한다.

## 중복 검증 규칙

- `question_id`는 고유해야 한다.
- `question_zh`는 고유할 필요가 없으며 unique 제약을 두지 않는다.
- 동일한 `question_zh`를 즉시 삭제하거나 병합하지 않는다.
- 동일한 중국어 문장은 `duplicate_candidate`로 표시해 별도 검수할 수 있다.
- 중복 판단에서는 `part`, `question_type`, 연결된 `VisualSet`, `AnswerPoint`, `SourceReference`, 실제 학습 맥락을 함께 비교한다.
- Part 7의 공통 지시문 반복은 그림과 답변 포인트가 다른 의도된 반복일 수 있다.
- 중복 후보 탐지와 `question_id` 기반 데이터 식별자 검증은 별개의 작업이다.

`DuplicateCandidate`는 현재 정식 엔터티가 아니라 검증 워크플로의 표시다.

## 공통 검증 규칙

- `Question`에는 `AnswerPoint`, `ModelAnswer` 본문, 개인 학습 상태나 개인 메모를 넣지 않는다.
- `answer_target_type`과 `answer_target_id`는 서로 일치하는 실제 대상 하나를 가리켜야 한다.
- `ModelAnswer.answer_status = missing`이면 답변 언어 필드가 비어 있어도 유효하지만, 그러한 레코드가 반드시 존재할 필요는 없다.
- `reviewed` 또는 사이트 표시용 중국어 문제·표현·답변은 중국어, 병음, 한국어 뜻이 모두 있어야 한다.
- `raw`와 `working` 단계의 누락 필드는 자동 오류가 아니라 검수할 작업으로 다룬다.
- 시각 자료 연결은 명시적 ID나 검증 가능한 근거로만 만들며 행 순서, 접미사 또는 복수의 중국어 완전 일치만으로 연결하지 않는다.
- `raw` 원본의 내용과 파일명은 유지하며 파생본 이름이 달라지면 `original_file_name`으로 추적한다.
- 출처 기반 데이터, 출처 미확인 데이터, `self_created` 데이터를 같은 출처 상태로 표시하지 않는다.
- 원본 내부의 이름과 URL은 검증 전까지 주장으로만 보존한다.
- `Correction`에는 `learning_status`를 두지 않고 사용자별 학습 상태를 `ReviewState`에서만 관리한다.
- `UserAnswer`, 개인 `Correction`, `ReviewState`는 공용 문제·답변·가이드와 저장 범위를 분리한다.
- MVP 물리 형식과 저장 경계는 `DATA_FORMAT_DECISION.md`와 `DECISIONS.md`를 따른다. 사용자 식별, 실제 백엔드·서버 데이터베이스, IndexedDB 래퍼와 이미지 공개 가능 여부는 계속 미결정이다.
