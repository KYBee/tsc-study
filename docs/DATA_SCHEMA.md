# 데이터 스키마 v1.1

## 범위와 표기

이 문서는 두 차례의 대표 표본 검증과 TSC 1~7강 분석 자료 반입 검토를 반영한 구현 기술 독립적인 개념 스키마다. 특정 데이터베이스, ORM, Excel, CSV 또는 JSON 문법을 정하지 않는다. 현재 `data/working`의 CSV와 JSON은 원본 반입과 구조 검증을 위한 작업 형식이며, 이 문서의 canonical 스키마와 동일한 물리 구조일 필요는 없다.

v1.1은 v1에 학습 표현, 발음 항목, 실전 드릴, 강의 인사이트와 근거 종류를 추가한 additive 변경이다. 기존 Part 4 앱의 `Question`, `AnswerPoint`, `ModelAnswer`, 개인 데이터 계약과 기존 상태값을 제거하거나 바꾸지 않는다.

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
10. 직접 문서·화면, 강사 발언, 분석자 통합, 재구성 학습 자료를 같은 근거로 취급하지 않는다.
11. 강의가 명시한 목표가 TSC 3급이면 `course_target_context = level_3`로 보존하며 Level 8 근거로 바꾸지 않는다.

## 공통 언어 묶음: `LanguageSet`

중국어 문제·표현·답변을 검수 완료하거나 사이트에 표시할 때 함께 관리하는 값이다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `zh` | `Text` | 조건부 | 중국어 원문. 검수 완료·표시 데이터에서는 필수 | `我喜欢在家运动。` |
| `pinyin` | `Text` | 조건부 | 중국어 전체에 대응하는 성조 포함 병음. 검수 완료·표시 데이터에서는 필수 | `Wǒ xǐhuan zài jiā yùndòng.` |
| `ko` | `Text` | 조건부 | 문맥을 반영한 한국어 뜻. 검수 완료·표시 데이터에서는 필수 | `저는 집에서 운동하는 것을 좋아합니다.` |

## 공통 근거 구분: `EvidenceKind`

강의 자료에서 만든 각 콘텐츠와 출처 관계는 무엇을 직접 확인했는지 아래 값 중 하나로 기록한다.

| 값 | 의미 | 운영 원칙 |
|---|---|---|
| `document_text` | PDF·DOCX 추출문에서 직접 확인된 텍스트 | 저장소에 원본 바이너리가 없으면 검수 상태는 `review_needed`로 유지 |
| `screen_text` | 영상 화면에서 직접 확인된 중국어·병음·한국어 | 화면 인덱스 OCR만으로 확정하지 않고 필요한 화면을 직접 확인 |
| `instructor_speech` | 상세 분석과 타임스탬프에 보존된 강사의 실제 발언 | 원본 영상이 없으면 `review_needed`; 공식 시험 규칙으로 자동 승격하지 않음 |
| `analyst_synthesis` | 여러 강의 근거를 분석자가 요약·통합한 내용 | 강사 직접 발언이나 공식 근거로 표시하지 않음 |
| `generated_study_material` | 분석을 바탕으로 재배열한 암기장·체크리스트·템플릿 | 출처 답변이나 강사 원문으로 표시하지 않음 |

근거 우선순위는 중국어 원문 확인 시 `document_text`와 직접 확인한 `screen_text`를 우선하고, 그다음 구체 타임스탬프가 있는 `instructor_speech`, `analyst_synthesis`, `generated_study_material` 순으로 검토한다. 자동 중국어 전사만으로 중국어 원문을 확정하지 않는다.

`course_target_context`는 과정이 직접 밝힌 목표를 보존한다. 현재 강의 반입에서 확인된 값은 `level_3`이며, 자료가 목표 수준을 밝히지 않으면 `not_specified`로 둔다. `foundation_for_level_8` 같은 활용 평가는 `CourseInsight.notes`나 별도 기획 문서에 기록하며 원래 과정 목표를 덮어쓰지 않는다.

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
| `original_file_name` | `Text` | 조건부 | 직접 반입한 `Source` 파일의 원래 파일명. 파생 Markdown Source라면 그 Markdown 파일명을 기록하며, 저장소에 없는 상위 원본 이름은 이 필드에 넣지 않음 | `TSC_파트별_문제은행_그림포함.xlsx` |
| `file_ref` | `Text` | 선택 | 저장소 또는 별도 보관 위치 | `data/raw/TSC_파트별_문제은행_그림포함.xlsx` |
| `claimed_original_names` | `List<Text>` | 선택 | 분석·추출 파일이 참조했다고 주장하는 원 MP4·PDF·DOCX 이름 또는 문서 안의 별칭. 실제 `file_ref`가 아니며 존재 확인을 뜻하지 않음 | `01강 / V01a` |
| `sha256` | `Text` | 선택 | 직접 확인한 저장소 파일 바이트의 SHA-256 | `64자리 16진수` |
| `acquired_date` | `Date` | 선택 | 사용자가 자료를 확보하거나 제공한 날짜 | `2026-07-24` |
| `rights_status` | `Enum` | 필수 | `review_needed`, `private_use`, `public_allowed`, `restricted` | `review_needed` |
| `source_status` | `Enum` | 선택 | `raw`, `review_needed`, `reviewed`. 강의 working import에서는 `review_needed` | `review_needed` |
| `evidence_kind` | `EvidenceKind` | 조건부 | 이 Source 자체의 자료 성격. 강의 반입 Source에서는 필수 | `analyst_synthesis` |
| `notes` | `Text` | 선택 | 범위, 판본, 확인 필요 사항 | `공개 저장소 사용 전 별도 확인 필요` |

### `SourceReference`

특정 콘텐츠가 어떤 실제 `Source`에서 왔는지, 그 안의 어느 위치인지, 원본이 주장하는 세부 출처가 무엇인지를 연결한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `source_reference_id` | `Identifier` | 필수 | 출처 관계 식별자 | `sr-q-p4-001-extracted` |
| `target_type` | `Enum` | 필수 | `question`, `model_answer`, `correction`, `part_guide`, `visual_set`, `visual_question`, `question_visual_set`, `story_guide`, `answer_point`, `learning_expression`, `pronunciation_item`, `practice_drill`, `course_insight` | `question` |
| `target_id` | `Identifier` | 필수 | 출처 관계가 연결되는 콘텐츠 식별자 | `P4-001` |
| `source_id` | `Reference<Source>` | 필수 | 실제로 확인한 자료 | `src-001` |
| `source_locator` | `Text` | 조건부 | 시트·행·페이지·문단 등 실제 위치. 위치가 있는 자료에서는 필수 | `문제은행!A138:N138` |
| `relationship_kind` | `Enum` | 필수 | `extracted_from`, `claimed_origin`, `derived_from`, `supports`, `self_created` | `extracted_from` |
| `claimed_source_name` | `Text` | 선택 | 원본 내부에 적힌 세부 출처 이름을 주장 그대로 보존 | `YBM 공식 샘플` |
| `claimed_source_url` | `Text` | 선택 | 원본 내부에 적힌 URL. 존재만으로 검증되지 않음 | `원본에 기록된 URL` |
| `source_grade` | `Text` | 선택 | 해당 콘텐츠 관계에 기록된 자료 등급 | `A 공식 샘플` |
| `originality` | `Text` | 선택 | 해당 콘텐츠 관계에 기록된 원문성 | `공식 원문` |
| `verification_status` | `Enum` | 필수 | `unverified`, `review_needed`, `verified`, `rejected` | `unverified` |
| `evidence_kind` | `EvidenceKind` | 조건부 | 이 관계로 뒷받침하는 근거의 성격. 강의 반입에서는 필수 | `document_text` |
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
- 저장소에 없는 원본 MP4·PDF·DOCX는 실제 `Source.file_ref`로 만들지 않는다. 분석 Markdown이 주장하는 원본 파일명과 타임스탬프는 `notes`와 `source_locator`에 보존한다.
- 분석·추출 Markdown이 주장하는 원본 이름이나 별칭은 `Source.claimed_original_names`에 보존할 수 있다. 값에 원본 확장자가 있어도 실제 저장소 파일이나 검증된 Source라는 뜻은 아니다.
- 분석 결과를 재구성한 study 문서는 `source_type = self_created`, `provenance_status = self_created`, `evidence_kind = generated_study_material`로 원 강의 분석과 구분한다.
- 타임스탬프가 있어도 원본 영상이 저장소에 없으면 `verification_status = review_needed`로 둔다.

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
| `evidence_kind` | `EvidenceKind` | 조건부 | 출처 기반 답변 후보를 확인한 근거 종류 | `document_text` |
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
| `evidence_kind` | `EvidenceKind` | 조건부 | 공용 강의 교정의 직접 근거 종류. 개인 교정에는 선택 | `screen_text` |

`Correction`에는 `learning_status`를 저장하지 않는다.

강의 교정을 공용 `Correction`으로 반입하려면 정확한 `wrong_zh`와 `correct_zh`가 같은 교정 사례로 확인되어야 한다. 표시용 교정에는 수정 문장 전체에 대응하는 병음과 한국어 뜻이 필요하며, 누락된 병음을 일반 지식으로 생성하지 않는다. 잘못된 중국어가 한국어 설명으로만 남은 사례는 `CourseInsight`나 `PracticeDrill`로 보존하고 빈 `wrong_zh`를 만들지 않는다.

### `PartGuide`

Part 1~7의 학습 가이드다. 확인되지 않은 파트 구조나 시험 규칙은 `reviewed`로 만들지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `part_guide_id` | `Identifier` | 필수 | 가이드 식별자 | `part-guide-04` |
| `part` | `Integer` | 필수 | 1~7 | `4` |
| `goal` | `Text` | 조건부 | 파트 학습 목표. 검수 완료 시 필수 | `질문에 직접 답하고 근거와 경험을 연결한다.` |
| `preparation_tips` | `List<Text>` | 조건부 | 준비 요령. 검수 완료 시 필수 | `먼저 직접 답변을 한 문장으로 정한다.` |
| `response_structure` | `List<Text>` | 조건부 | 순서가 있는 답변 구조 | `직접 답변`, `이유`, `구체적 설명이나 경험`, `결론` |
| `preparation_seconds` | `Integer` | 선택 | 해당 과정 자료에서 확인된 준비 시간 주장 | `15` |
| `response_seconds` | `Integer` | 선택 | 해당 과정 자료에서 확인된 답변 시간 주장 | `25` |
| `key_expressions` | `List<LanguageSet>` | 선택 | 반드시 외울 표현. 각 항목은 세 언어 필드를 함께 관리 | `我觉得…… / Wǒ juéde... / 저는 …라고 생각합니다` |
| `key_expression_ids` | `List<Reference<LearningExpression>>` | 선택 | 재사용 가능한 독립 표현 참조 | `le-course-016` |
| `representative_question_ids` | `List<Reference<Question>>` | 선택 | 검수된 대표 문제 | `P4-001` |
| `frequent_correction_ids` | `List<Reference<Correction>>` | 선택 | 자주 하는 실수 | `c-shared-0001` |
| `representative_drill_ids` | `List<Reference<PracticeDrill>>` | 선택 | 이 Part의 근거 있는 대표 연습 | `drill-course-p4-timed` |
| `course_target_context` | `Enum` | 조건부 | `level_3`, `not_specified`. 강의 반입 가이드에서는 필수 | `level_3` |
| `evidence_kind` | `EvidenceKind` | 조건부 | 가이드 내용을 구성한 주 근거 성격 | `analyst_synthesis` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 조건부 | 가이드 근거. 검수 완료 시 필수 | `sr-part-guide-04` |
| `guide_status` | `Enum` | 필수 | `draft`, `review_needed`, `reviewed` | `draft` |
| `notes` | `Text` | 선택 | 과정 범위, 근거 부족과 검수 메모 | `TSC 3급 과정 근거, Level 8 전략 아님` |

강의 반입 `PartGuide`의 시간과 구조는 당시 과정이 설명한 내용으로 보존한다. 최신 공식 시험 규칙이나 Level 8 전략으로 표시하지 않는다. Part 6·7처럼 상세 훈련 근거가 부족하면 빈 필드를 임의 템플릿으로 채우지 않고 `notes`에 범위 제한을 기록한다.

### `LearningExpression`

여러 문제와 Part에서 재사용할 수 있는 중국어 표현과 문장 구조를 독립적으로 관리한다. 개인 사실이 담긴 완성 답변 전체를 만능 표현으로 일반화하지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `expression_id` | `Identifier` | 필수 | 표현 식별자 | `le-course-016` |
| `language` | `LanguageSet` | 필수 | 중국어, 확인된 전체 병음, 한국어 뜻. 미확인 병음은 빈 값 | `恭喜你！ / gōngxǐ nǐ / 축하합니다!` |
| `part_numbers` | `List<Integer>` | 선택 | 근거에서 확인된 사용 Part | `3` |
| `expression_type` | `Enum` | 필수 | `fixed_response`, `reaction`, `connector`, `grammar_pattern`, `comparison`, `location`, `opinion_structure`, `conclusion`, `reusable_sentence`, `other` | `reaction` |
| `usage_context` | `Text` | 선택 | 어떤 문제·상황에서 사용하는지 | `좋은 소식에 축하할 때` |
| `pattern_or_slots` | `Text` | 선택 | `XX`, A/B와 같은 교체 슬롯 또는 구조 | `A比B更+형용사` |
| `cautions` | `Text` | 선택 | 사용 제한, 강의에서 확인된 흔한 오류 | `축하 대상 확인` |
| `related_correction_ids` | `List<Reference<Correction>>` | 선택 | 같은 오류를 설명하는 공용 교정 | `c-course-001` |
| `status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `review_needed` |
| `evidence_kind` | `EvidenceKind` | 필수 | 표현 레코드를 구성한 주 근거 | `generated_study_material` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 필수 | 표현과 근거 위치의 관계 | `sr-le-course-016-study` |
| `notes` | `Text` | 선택 | 부분 병음, 중복 근거와 검수 메모 | `암기장에서 재구성됨` |

운영 원칙:

- 동일 중국어 표현은 하나의 `expression_id`에 여러 `SourceReference`를 연결할 수 있다. 다만 의미와 사용 맥락이 다르면 자동 병합하지 않는다.
- `자료에서 확인 불가`, `문서에 병음 표기`, `화면 병음` 같은 설명이나 단어 일부의 병음은 전체 문장 병음으로 저장하지 않는다.
- 슬롯이 있는 원문은 `pattern_or_slots`로 보존하고 임의의 개인 정보를 채우지 않는다.
- `LearningExpression`은 `ModelAnswer`가 아니다.

### `PronunciationItem`

강의에서 직접 확인된 발음·성조·얼화와 혼동 음 학습 항목을 보존한다. 음성 평가 결과나 새 음성 파일을 뜻하지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `pronunciation_item_id` | `Identifier` | 필수 | 발음 항목 식별자 | `pi-course-f-mouth` |
| `target_text` | `Text` | 필수 | 강의에서 다룬 문자·단어·음 구분 | `f` |
| `pinyin_or_sound` | `Text` | 선택 | 자료에서 직접 확인된 병음이나 소리 표기만 저장 | `—` |
| `pronunciation_focus` | `Text` | 필수 | 입 모양, 성조, 혼동 음 등 초점 | `윗니와 아랫입술을 사용하는 입 모양` |
| `explanation_ko` | `Text` | 필수 | 근거가 있는 한국어 설명 | `강사가 f 발음의 입 모양을 직접 지도함` |
| `example_expression_ids` | `List<Reference<LearningExpression>>` | 선택 | 해당 발음을 포함하는 검수 대상 표현 | `le-course-007` |
| `part_numbers` | `List<Integer>` | 선택 | 관련 Part | `2` |
| `status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `review_needed` |
| `evidence_kind` | `EvidenceKind` | 필수 | 항목의 근거 종류 | `instructor_speech` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 필수 | 타임스탬프·문서 위치 관계 | `sr-pi-course-f-mouth` |
| `notes` | `Text` | 선택 | 원본 미보유, 음가 확인 필요 사항 | `원본 영상 부재` |

강의가 구체적인 방법이나 소리값을 제시하지 않았다면 내용을 추측해 추가하지 않는다. 정확한 병음이 없으면 `pinyin_or_sound`를 비워 둔다.

### `PracticeDrill`

강의에서 확인된 준비 시간, 답변 시간과 학습 행동을 실행 가능한 연습 단위로 보존한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `drill_id` | `Identifier` | 필수 | 연습 식별자 | `drill-course-p4-timed` |
| `part` | `Integer` | 선택 | 특정 Part 연습이면 1~7 | `4` |
| `drill_type` | `Enum` | 필수 | `timed_response`, `shadowing`, `correction_recall`, `picture_accuracy`, `reaction_drill`, `structure_recall`, `pronunciation`, `self_recording`, `other` | `timed_response` |
| `prompt_or_task` | `Text` | 필수 | 학습자가 수행할 근거 있는 과제 | `15초 준비 후 25초 안에 답한다.` |
| `preparation_seconds` | `Integer` | 선택 | 자료에서 직접 확인된 준비 시간 | `15` |
| `response_seconds` | `Integer` | 선택 | 자료에서 직접 확인된 답변 시간 | `25` |
| `completion_criteria` | `Text` | 선택 | 강의에서 확인된 완료 판단 기준 | `직답, 이유, 구체 예, 정리 순서를 사용` |
| `required_content_ids` | `List<Identifier>` | 선택 | 필요한 표현·가이드·교정 참조 | `part-guide-04` |
| `status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `review_needed` |
| `evidence_kind` | `EvidenceKind` | 필수 | 과제의 근거 종류 | `instructor_speech` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 필수 | 과제 근거 위치 | `sr-drill-course-p4-timed` |
| `notes` | `Text` | 선택 | 범위와 검수 메모 | `반복 횟수는 자료에 없음` |

강의에서 정하지 않은 반복 횟수, 하루 학습량과 복습 간격을 추가하지 않는다. `self_recording`은 학습 행동 데이터이며 현재 MVP에 음성 인식·평가 기능을 추가한다는 뜻이 아니다.

### `CourseInsight`

강사의 전략·경고·공부법·평가 관점과 분석자가 통합한 범위 제한을 출처 성격과 함께 보존한다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `insight_id` | `Identifier` | 필수 | 인사이트 식별자 | `ci-course-accuracy-first` |
| `part_numbers` | `List<Integer>` | 선택 | 관련 Part | `2`, `4` |
| `insight_type` | `Enum` | 필수 | `strategy`, `evaluation_focus`, `time_guidance`, `common_risk`, `study_method`, `test_day_behavior`, `scope_limitation`, `other` | `strategy` |
| `content_ko` | `Text` | 필수 | 근거를 과장하지 않은 한국어 내용 | `고급 어휘보다 발음·딕션·성조와 정확성을 우선한다.` |
| `course_target_context` | `Enum` | 필수 | `level_3`, `not_specified` | `level_3` |
| `evidence_kind` | `EvidenceKind` | 필수 | 직접 발언인지 분석 통합인지 구분 | `instructor_speech` |
| `confidence_or_status` | `Enum` | 필수 | `raw`, `review_needed`, `reviewed` | `review_needed` |
| `source_reference_ids` | `List<Reference<SourceReference>>` | 필수 | 인사이트와 근거 위치의 관계 | `sr-ci-course-accuracy-first` |
| `notes` | `Text` | 선택 | 당시 과정 범위, 충돌과 적용 제한 | `공식 Level 8 채점 기준 아님` |

`analyst_synthesis`와 `generated_study_material`을 `instructor_speech`로 승격하지 않는다. 시험 규칙·평가 기준으로 보이는 내용도 현재 공식 자료가 아니라 강의의 주장이라면 그 범위를 `notes`에 명시한다.

## 검수 운영 엔터티

### `Part4ReviewDecision`

Part 4 working Question 한 건에 대해 사용자가 명시적으로 저장한 로컬 검수 결정이다. 공용 콘텐츠도 개인 학습 기록도 아니며, 수정된 언어 콘텐츠를 포함하지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `review_decision_id` | `Identifier` | 필수 | dataset과 Question에 대해 안정적인 결정 ID | `rd-part4-review-fixture-v1-P4-001` |
| `dataset_id` | `Identifier` | 필수 | 결정이 검수한 fixture ID | `part4-review-fixture-v1` |
| `question_id` | `Reference<Question>` | 필수 | 검수 대상 Question | `P4-001` |
| `field_decisions` | `Map<Field, Enum>` | 필수 | 일곱 필수 필드별 `approved`, `needs_fix`, `not_checked` | `chinese_text: approved` |
| `overall_status` | `Enum` | 필수 | `approved`, `needs_fix`, `deferred` | `approved` |
| `reviewer_note` | `Text` | 선택 | 수정 필요 이유와 보류 메모 | `병음 표기 재확인 필요` |
| `reviewed_by` | `Text` | 필수 | 사용자가 입력한 로컬 표시명 | `reviewer-a` |
| `reviewed_at` | `DateTime` | 필수 | 사용자가 결정을 저장한 시각 | `2026-07-28T12:00:00+09:00` |
| `source_question_hash` | `SHA256` | 필수 | 검수한 Question canonical JSON 해시 | `…` |
| `source_answer_point_hash` | `SHA256` | 필수 | 검수한 AnswerPoint canonical JSON 해시 | `…` |
| `decision_version` | `Integer` | 필수 | 결정 계약 버전 | `1` |

필수 검수 필드는 `chinese_text`, `pinyin`, `korean_translation`, `question_type`, `answer_point`, `source_locator`, `claimed_source_metadata`다. 전체 `approved`는 모두 승인됐을 때만 유효하다. 현재 원문 해시와 다르면 stale이며 승격에 사용할 수 없다. 출처 주장 필드 승인은 workbook에 값이 존재함을 확인한 것이지 외부 출처 진위를 확인한 것이 아니다.

## 개인 학습 엔터티

### `PracticeDraft`

실제 교정 결과가 없어도 사용자가 명시적으로 저장할 수 있는 교정 전 개인 연습 원문이다. canonical `UserAnswer`와 분리하며 공용 JSON에 포함하지 않는다.

| 필드명 | 타입 | 필수 여부 | 설명 | 예시 |
|---|---|---|---|---|
| `practice_draft_id` | `Identifier` | 필수 | 연습 초안 식별자 | `pd-P4-006` |
| `learner_ref` | `Identifier` | 조건부 | 개인 데이터 소유자 식별자 | `local-user` |
| `question_id` | `Identifier` | 호환 | 기존 레코드·질의 호환용 대상 ID. 새 레코드는 `target_id`와 같은 값 | `P4-006` |
| `target_type` | `Enum` | 필수 | `question`, `visual_question`, `visual_set` | `visual_set` |
| `target_id` | `Identifier` | 필수 | 실제 초안 대상의 안정적인 ID | `vs-P7-V01` |
| `input_language` | `Enum` | 필수 | `ko`, `zh`, `mixed` | `mixed` |
| `original_input` | `Text` | 조건부 | 사용자가 작성한 원문. 키워드 설계만 저장한 동안은 빈 값 가능 | `我喜欢在家运动。` |
| `planning_keywords` | `Part4PlanningKeywords` | 선택 | 직접 답변·이유·경험/예시·마무리에 사용자가 직접 입력한 키워드 | `reasons: ["편리함"]` |
| `structured_answer` | `Part4StructuredAnswer` | 선택 | 네 구간별 사용자 원문. 연결어를 자동 생성하지 않음 | `reasons: "在家运动很方便。"` |
| `full_text` | `Text` | 선택 | 구조 구간을 사용자 입력 순서대로 합친 값 또는 자유 입력 전체 답변 | `我喜欢在家运动。` |
| `story_keywords` | `List<Text>` | 선택 | Part 7에서 사용자가 직접 적은 이야기 핵심 키워드 | `["아침", "버스"]` |
| `story_points` | `List<StoryPoint>` | 선택 | Part 7에서 사용자가 직접 정렬한 `{ point_id, text, order }` | `[{ "point_id": "sp-vs-P7-V01-001", "text": "버스를 탄다", "order": 1 }]` |
| `completion_status` | `Enum` | 선택 | `in_progress`, `completed` | `completed` |
| `completed_at` | `DateTime` | 조건부 | 사용자가 완료를 명시적으로 누른 시각 | `2026-07-28T13:00:00+09:00` |
| `understanding_confirmed` | `Boolean` | 선택 | 사용자가 질문 이해 완료를 명시적으로 확인했는지 | `true` |
| `skipped_sections` | `List<Enum>` | 선택 | 사용자가 생략하기로 한 구조 구간 | `["conclusion"]` |
| `draft_status` | `Enum` | 필수 | 현재 값 `draft` | `draft` |
| `created_at` | `DateTime` | 필수 | 최초 저장 시각 | `2026-07-28T10:00:00+09:00` |
| `updated_at` | `DateTime` | 필수 | 마지막 명시적 저장 시각 | `2026-07-28T10:05:00+09:00` |

Question, VisualQuestion 또는 VisualSet당 활성 초안 하나를 upsert할 수 있다.
`PracticeDraft`에는 교정 중국어·병음·한국어와 수정 내역을 넣지 않고 개인
`Correction`도 생성하지 않는다. `UserAnswer`가 생겨도 자동 삭제하지
않으며 둘은 동시에 존재할 수 있다.

Part 1·3·4·5·6의 `question_id`를 동일하게 지원한다. Part 4의
`planning_keywords`와 `structured_answer`는 선택적 확장 필드이며 다른
Part에 강제하지 않는다. 다른 텍스트 Part는 `original_input`, `full_text`,
`completion_status`만으로 유효한 자유 입력 초안이 될 수 있다. fixture
변경이나 Part 확장을 이유로 기존 개인 초안을 자동 삭제하지 않는다.

Part 7의 `story_keywords`와 `story_points`는 개인 입력이다. 공용
`StoryGuide`를 자동 복사하거나 저장하지 않으며, 사용자가 미리보기와
확인을 거쳐 편집 상태에 추가한 뒤 명시적으로 저장해야 한다.

기존 자유 입력 초안에는 구조화 필드가 없어도 유효하며 이 경우 `original_input`을 `full_text`처럼 표시한다. `completed`는 네 구간이 모두 채워졌다는 자동 판정이 아니라 사용자의 명시적 완료 행동이다.

### `ReusablePhrase`

사용자가 직접 작성한 원문 중 명시적으로 재사용 저장한 개인 표현이다. 공용 `LearningExpression`과 분리하며 자동 번역·요약·문장 분해를 하지 않는다.

필드는 `reusable_phrase_id`, `text`, `language`, `phrase_type`,
`source_kind = user_created`, 호환용 `source_question_id`, 선택적인
`source_target_type = question | visual_question | visual_set`, `source_target_id`,
`created_at`, `updated_at`이다.

### `RecallAttempt`

저장된 연습 답변을 보지 않고 말한 뒤 사용자가 직접 남기는 회상 이력이다.
필드는 `recall_attempt_id`, 호환용 `question_id`,
`target_type = question | visual_question | visual_set`, `target_id`, 선택적인
`practice_draft_id` 또는 `user_answer_id`, `recall_mode`, `result`,
`attempted_at`이다. `recall_mode`는 `full`, `answer_only`,
`chinese_only`, `keywords_only`, `question_only`, Part 2의
`visual_question`, `visual_only`, Part 7의 `story_full`,
`story_visual_points`, `story_points_only`, `instruction_visual`,
`instruction_only`를 사용한다. 결과는 `could_not_say`,
`used_keywords`, `almost`, `memorized`다. `keywords_only`는 실제
`planning_keywords`가 있는 구조화 초안에서만 표시한다.

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
| `target_type` | `Enum` | 필수 | `question`, `visual_question`, `visual_set`, `user_answer`, `correction` | `visual_set` |
| `target_id` | `Identifier` | 필수 | 복습 대상 식별자 | `P4-001` |
| `learning_status` | `Enum` | 필수 | `못 외움`, `헷갈림`, `외움` | `못 외움` |
| `last_reviewed_at` | `DateTime` | 선택 | 마지막 복습 시각 | `2026-07-24T22:00:00+09:00` |
| `review_count` | `Integer` | 필수 | 복습 횟수, 초기값 0 | `3` |

개인 데이터 원칙:

- `PracticeDraft`는 교정 전 원문이며 `UserAnswer`나 승인 답변으로 취급하지 않는다.
- `UserAnswer`는 사용자가 승인한 답변만 canonical 데이터로 저장한다.
- `ReviewState`만 사용자별 `못 외움`, `헷갈림`, `외움`을 관리한다.
- 공용 `Correction`과 개인 `Correction` 모두 콘텐츠 자체에는 학습 상태를 저장하지 않는다.
- `UserAnswer`, 개인 `Correction`, `ReviewState`는 공용 콘텐츠와 저장 범위를 분리한다.
- 초기 MVP의 개인 데이터는 공용 JSON과 분리해 IndexedDB에 저장하며 현재 구현은 `idb` 래퍼를 사용한다. 사용자 인증, 서버 동기화와 장기 마이그레이션 정책은 아직 결정하지 않는다.

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
| 공용 콘텐츠 1 → N `SourceReference` | 질문·답변뿐 아니라 표현, 발음 항목, 드릴과 강의 인사이트도 실제 Markdown과 위치를 추적한다. |
| `Question` 1 → N `SourceReference` | 한 질문에 실제 추출 파일과 주장된 원출처 등 여러 관계가 연결될 수 있다. |
| `Question` 1 → 0..N `AnswerPoint` | 질문에 답변 포인트가 없거나 여러 개 있을 수 있다. |
| `Question` 1 → 0..N `ModelAnswer` | `answer_target_type = question`인 경우이며, 답변이 없거나 여러 개일 수 있다. |
| `VisualSet` N ↔ N `VisualAsset` | `VisualSetAsset`으로 연결하며 한 세트의 여러 이미지와 이미지 재사용을 허용한다. |
| `VisualSet` 1 → N `VisualQuestion` | 한 Part 2 그림 세트에 여러 하위 질문이 연결될 수 있다. |
| `Question` N ↔ N `VisualSet` | `QuestionVisualSet`으로 연결하며 추측한 관계는 만들지 않는다. |
| `VisualQuestion` 1 → 0..N `ModelAnswer` | `answer_target_type = visual_question`인 경우이며 출처 답변이 여러 개일 수 있다. |
| `VisualSet` 1 → 0..N `StoryGuide` | 한 그림 세트에 스토리 가이드가 없거나 여러 개일 수 있다. |
| `Question` 또는 `VisualQuestion` 1 → 0..1 활성 `PracticeDraft` | target type과 ID별 활성 연습 초안 하나를 개인 IndexedDB에 upsert한다. |
| `Question` 또는 `VisualQuestion` 1 → N `ReusablePhrase` | 사용자가 명시적으로 저장한 원문 표현이며 source target과 공용 표현을 분리한다. |
| `Question` 또는 `VisualQuestion` 1 → N `RecallAttempt` | 대상별 암기 모드와 상세 회상 결과 이력이다. |
| `Question` 1 → 0..1 활성 `Part4ReviewDecision` | 한 검수 dataset에서 Question당 활성 결정 하나를 별도 검수 IndexedDB에 저장한다. |
| `Question` 1 → N `UserAnswer` | 같은 질문에 사용자가 승인한 여러 답변을 저장할 수 있다. |
| `UserAnswer` 1 → 0..N `Correction` | 한 사용자 답변에서 여러 개인 오류가 나올 수 있다. |
| 학습자 1 → N `ReviewState` | 개인 복습 상태는 공용 콘텐츠와 별도로 저장한다. |
| `PartGuide` N ↔ N `Question` | 한 가이드는 여러 대표 문제를 가지며 문제는 여러 가이드에서 참조될 수 있다. |
| `PartGuide` N ↔ N `LearningExpression` | `key_expression_ids`로 재사용 표현을 연결하며 기존 내장 `key_expressions` 계약도 유지한다. |
| `PartGuide` N ↔ N `PracticeDrill` | `representative_drill_ids`로 근거가 있는 대표 연습을 연결한다. |
| `LearningExpression` N ↔ N `Correction` | 표현의 반복 오류가 정확한 교정 레코드로 존재할 때만 연결한다. |
| `LearningExpression` N ↔ N `PronunciationItem` | 발음 항목의 예시 표현 연결이며 전체 병음을 생성하는 관계가 아니다. |

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
- 강의 working import에서는 모든 콘텐츠에 `evidence_kind`와 최소 하나의 `SourceReference`를 기록한다.
- `generated_study_material`은 강사의 직접 발언이나 출처 기반 `ModelAnswer`로 표시하지 않는다.
- 상세분석에 실제 강사 발언과 타임스탬프가 함께 기록된 관계는 `instructor_speech`로 보존하되, 원본 영상이 저장소에 없으면 `verification_status = review_needed`를 유지한다. 분석자가 통합한 설명은 별도 `analyst_synthesis` 관계로 남길 수 있다.
- 자동 음성 전사만으로 중국어 원문을 확정하지 않는다. 중국어는 `document_text` 또는 직접 확인한 `screen_text`를 우선한다.
- `자료에서 확인 불가`, 전체 문장 범위를 덮지 않는 부분 병음과 병음 존재 설명은 전체 병음으로 간주하지 않는다.
- 완전한 병음이 없는 강의 교정 후보를 표시용 공용 `Correction`으로 생성하지 않는다. 잘못된 표현 자체가 중국어로 확인되지 않은 사례도 빈 값을 채워 만들지 않는다.
- `ModelAnswer` 후보는 특정 `Question` 또는 `VisualQuestion`, 완성 중국어, 전체 병음, 전체 한국어 뜻과 실제 Source 위치가 모두 확인될 때만 만든다.
- 강의가 명시한 3급 목표 전략은 `course_target_context = level_3`로 보존하고 Level 8 전략이나 공식 채점 기준으로 이름을 바꾸지 않는다.
- Part 6·7처럼 상세 훈련 근거가 부족하면 임의의 구조·표현·답변을 추가하지 않고 범위 제한을 기록한다.
- 시각 자료 연결은 명시적 ID나 검증 가능한 근거로만 만들며 행 순서, 접미사 또는 복수의 중국어 완전 일치만으로 연결하지 않는다.
- `raw` 원본의 내용과 파일명은 유지하며 파생본 이름이 달라지면 `original_file_name`으로 추적한다.
- 출처 기반 데이터, 출처 미확인 데이터, `self_created` 데이터를 같은 출처 상태로 표시하지 않는다.
- 원본 내부의 이름과 URL은 검증 전까지 주장으로만 보존한다.
- `Correction`에는 `learning_status`를 두지 않고 사용자별 학습 상태를 `ReviewState`에서만 관리한다.
- `UserAnswer`, 개인 `Correction`, `ReviewState`는 공용 문제·답변·가이드와 저장 범위를 분리한다.
- MVP 물리 형식과 저장 경계는 `DATA_FORMAT_DECISION.md`와 `DECISIONS.md`를 따른다. 사용자 식별, 실제 백엔드·서버 데이터베이스, IndexedDB 장기 마이그레이션과 이미지 공개 가능 여부는 계속 미결정이다.
