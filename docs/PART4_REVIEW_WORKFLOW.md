# Part 4 로컬 검수 워크플로

## 목적

Part 4 working Question 50개를 자동 수정하지 않고 사람이 필드별로 확인한 뒤, 명시적으로 승인된 항목만 reviewed canonical JSON으로 승격한다. 검수 도구는 학습 앱과 저장소를 분리하며, 현재 학습 앱의 기본 데이터는 계속 `part4-full-working-development-fixture-v2`다.

## 검수 대상

- 입력 fixture: `data/working/review-fixtures/part4-v1/`
- dataset ID: `part4-review-fixture-v1`
- 생성 명령: `npm run fixture:part4-review`
- 검증 명령: `npm run validate:part4-review`
- 로컬 화면: `/data-review/part4`

Question 하나가 검수 단위다. 중국어, 병음, 한국어, 유형, AnswerPoint, 원본 locator, workbook 내부 출처 주장 메타데이터를 함께 표시한다. 각 필드는 `approved`, `needs_fix`, `not_checked` 중 하나로 기록한다.

필수 필드는 다음 일곱 개다.

- `chinese_text`
- `pinyin`
- `korean_translation`
- `question_type`
- `answer_point`
- `source_locator`
- `claimed_source_metadata`

## ReviewDecision

`Part4ReviewDecision`은 공용 학습 콘텐츠나 개인 학습 기록이 아닌 로컬 데이터 검수 운영 기록이다.

- `review_decision_id`
- `dataset_id`
- `question_id`
- `field_decisions`
- `overall_status`
- `reviewer_note`
- `reviewed_by`
- `reviewed_at`
- `source_question_hash`
- `source_answer_point_hash`
- `decision_version`

전체 `approved`는 필수 필드가 모두 `approved`일 때만 가능하다. `needs_fix`에는 사유 메모가 필요하다. `deferred`는 승격 대상이 아니다. 결정 파일에는 수정된 질문·병음·번역·AnswerPoint를 저장하지 않는다.

## 해시와 stale 판정

검수 fixture는 Question과 AnswerPoint의 canonical JSON SHA-256을 별도로 기록한다. 저장 결정의 해시와 현재 fixture 해시가 하나라도 다르면 stale이다. stale 결정은 보존하지만 현황과 가져오기 미리보기에서 구분하며 reviewed 승격에는 사용하지 않는다.

## 로컬 검수 화면과 저장 분리

검수 화면은 일반 하단 메뉴에 포함하지 않으며 개발 환경에서만 동작한다. `tsc-study-data-review-v1` IndexedDB의 `part4ReviewDecisions` store에 Question당 활성 결정 하나를 저장한다. 학습 DB의 PracticeDraft, UserAnswer, Correction, ReviewState에는 접근하거나 영향을 주지 않는다.

화면 진입만으로 결정이나 승인을 만들지 않는다. 전체 필드 승인, 전체 수정 요청, 보류도 사용자가 직접 선택하고 저장해야 한다. 초기화는 확인 뒤 수행한다.

## JSON 내보내기와 가져오기

내보내기 파일의 최상위 필드는 `dataset_id`, `review_schema_version`, `exported_at`, `reviewer`, `decisions`다. 로컬 표시명 외의 이메일이나 계정 정보는 자동 수집하지 않는다.

가져오기에서는 스키마·dataset ID·Question ID·중복 결정·enum·날짜·문자열 크기·전체 상태 일관성을 검사한다. 적용 전 새 결정, 덮어쓸 결정, 동일 결정, stale 결정, 거부 결정을 미리 보여주며 사용자 확인 후 반영한다.

로컬 IndexedDB 내용은 자동으로 Git에 포함되지 않는다. 내보낸 실제 결정 파일을 저장소에 포함할지는 사용자가 별도로 결정한다. 샘플 승인 파일은 제공하지 않는다.

## reviewed 승격

```sh
python3 scripts/promote_part4_reviewed_data.py \
  --decisions <review-decisions-path>
```

검증만 하려면 `--validate-only`, 테스트 출력에는 `--output-dir <path>`를 사용한다. 기본 출력은 `data/reviewed/part4-v1/`이지만 승인 가능한 항목이 0개면 아무 데이터셋도 생성하지 않는다.

승격 조건은 다음과 같다.

- `overall_status = approved`
- 일곱 필드가 모두 `approved`
- 현재 Question과 AnswerPoint 해시 일치
- 참조하는 Source와 SourceReference 존재
- 결정 구조와 enum이 유효함

승격 시 원문은 그대로 복사하고 Question은 `verified`, AnswerPoint는 `reviewed` 상태로 바꾼다. `claimed_source_metadata` 승인은 workbook에 해당 값이 기록돼 있음을 확인했다는 뜻이다. 외부 URL이나 주장 출처가 공식임을 확인했다는 뜻이 아니므로 SourceReference의 외부 검증 상태는 자동으로 `verified`로 바꾸지 않는다.

승격되지 않은 항목은 `excluded-items.json`에 `no_decision`, `deferred`, `needs_fix`, `incomplete_field_review`, `stale_source_hash` 등의 이유로 기록한다. 같은 working fixture와 decision 파일에 대한 출력은 생성 시각 없이 결정적이어야 한다.

## 알려진 제한과 다음 작업

- 실제 50문제 사람 검수와 실제 decision 파일은 아직 없다.
- 기본 reviewed 경로에는 사용자 승인 없이 데이터를 생성하지 않는다.
- reviewed 데이터는 아직 학습 앱에 연결하지 않는다.
- SourceReference 승인만으로 외부 출처 URL을 검증하지 않는다.
- ModelAnswer, AI 교정, Level 8 확장 답변은 만들지 않는다.

다음 단계는 사용자가 로컬 검수 화면에서 결정 파일을 내보낸 뒤 이를 별도로 검토하고, CLI로 부분 reviewed 데이터를 생성하는 것이다. reviewed 데이터를 학습 앱에 연결하는 작업은 부분 데이터 처리 정책을 결정한 뒤 별도 수행한다.
