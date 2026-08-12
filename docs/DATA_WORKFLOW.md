# 데이터 작업 흐름

## 목적

원본 Excel과 강의 분석 자료를 보존하면서 문제, 출처, 언어 정보를 점진적으로 검수한다. 이 저장소는 완성된 데이터만 적재하는 곳이 아니라 문제를 검수하고 모범답안을 함께 만들어 가는 작업 공간이다.

## 데이터 단계

### `raw`

- 사용자가 제공한 Excel, 강의 분석 텍스트 등 원본 파일
- 파일 내용과 원래 파일명을 그대로 유지한다. 메타데이터는 원본 파일과 분리해 기록한다.
- 정리된 이름이나 영어 이름은 `working` 또는 `reviewed` 파생본에만 사용하고, `original_file_name`으로 raw 원본 이름을 추적한다.
- 병음, 한국어 뜻, 문제 유형, 답변이 비어 있어도 정상이다.
- 수정이 필요하면 원본을 덮어쓰지 않고 `working`에 파생 파일을 만든다.

### `working`

- 원본에서 추출하거나 정리 중인 문제
- 중복, 오탈자, 중국어 정규화, 병음, 번역, 유형, 출처를 검토하는 단계
- 불확실한 값은 추측으로 채우지 않고 확인 필요 상태와 근거를 남긴다.
- 문제와 모범답안을 별도 데이터로 관리한다.
- 표 형태의 중간 작업에는 CSV를, 여러 엔터티의 관계·근거를 검증하는 반입 bundle에는 JSON을 사용할 수 있다. 둘 다 reviewed canonical 데이터가 아니다.

### `reviewed`

- 중국어, 병음, 한국어 뜻, 문제 유형, 출처를 검수한 문제
- 원본과의 연결 정보가 남아 있어야 한다.
- 실제 출처 문제와 자체 제작 변형 문제가 구분되어야 한다.
- 사이트 표시 데이터로 사용할 수 있지만, 공개 전 저작권과 사용 범위는 별도로 확인한다.

## 처리 순서

1. **원본 보관:** 원래 내용과 파일명을 유지한 원본 파일을 `data/raw`에 보관하고 `sources` 지침에 따라 출처 메타데이터를 별도로 기록한다.
2. **문제 추출:** 원본의 행, 시트, 문단 등 위치를 추적할 수 있게 문제 후보를 추출한다.
3. **중복 확인:** 문장 자체가 같은 경우와 표현만 다른 유사 문제를 구분한다. 근거 없이 하나로 합치지 않는다.
4. **중국어 정리:** 인코딩, 명백한 오탈자, 공백과 문장부호를 정리하되 의미 변경은 검토 대상으로 남긴다.
5. **병음 및 한국어 추가:** 중국어 전체에 대응하는 병음과 한국어 뜻을 작성한다.
6. **문제 유형 지정:** 확인된 근거에 따라 Part와 유형을 지정한다. 확실하지 않으면 미확정으로 둔다.
7. **출처 검수:** 원본 위치, 실제 강의 자료 여부, 자체 생성 여부를 확인한다.
8. **`reviewed` JSON 생성:** 필수 항목과 출처 검수 조건을 충족한 엔터티만 검증한 뒤 결정적으로 `data/reviewed` JSON에 반영한다.
9. **필요 시 모범답안 작성:** 문제 검수와 별개로 답변 작업 항목을 만들고 초안·검수 상태를 관리한다.

## 현재 전체 workbook working 반입

`scripts/build_full_workbook_import.py`는 원본 Excel을 읽기 전용으로 처리해 `data/working/full-import-v1/`을 결정적으로 생성한다.

- Question과 AnswerPoint 253개를 분리한다.
- 실제 workbook Source와 workbook 내부의 출처 주장을 SourceReference로 구분한다.
- Part 2 시각 질문과 출처 추천 답변, Part 7 StoryGuide를 서로 다른 엔터티로 보존한다.
- 명시적 근거가 없는 질문·그림·강의 콘텐츠 관계는 후보 또는 검수 큐에만 둔다.
- Excel 개인 컬럼으로 개인 학습 레코드를 만들지 않는다.
- 생성 이미지 바이트는 working JSON과 별도 경계에 두고 권리 검수 전 공개하지 않는다.

```sh
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py --validate-only
npm run check:data
```

현재 bundle은 전체 원문을 구조적으로 반입한 결과이지 언어·출처·권리를 검수한 결과가 아니다. `reviewed` 승격과 앱 런타임 연결은 별도 작업이다.

## 전체 텍스트 Part 앱 working fixture

`scripts/build_text_parts_app_fixture.py`는 `full-import-v1`과
`course-import-v1`을 수정하지 않고 Part 1·3·4·5·6 Question·AnswerPoint
193개와 해당 공통 참고 자료만 결정적으로 선별한다.

```sh
python3 scripts/build_text_parts_app_fixture.py
python3 scripts/build_text_parts_app_fixture.py --validate-only
```

이 fixture는 앱 사용성 검증을 위한 working 입력이다. Part 2·7 시각
엔터티와 ModelAnswer를 포함하지 않고, 강의 표현을 특정 문제 답변으로
연결하지 않는다. 앱에서 생성되는 PracticeDraft·ReusablePhrase·
RecallAttempt·ReviewState는 개인 IndexedDB에만 저장하며 working 또는
reviewed 공용 JSON으로 되돌려 쓰지 않는다.

## Part 2 로컬 시각 앱 working fixture

`scripts/build_part2_visual_app_fixture.py`는 `full-import-v1`과
`course-import-v1`에서 Part 2 VisualSet·VisualAsset·VisualSetAsset
각 12개, VisualQuestion·검수 전 출처 ModelAnswer 각 48개와 Part 공통
자료를 결정적으로 선별한다.

```sh
python3 scripts/build_full_workbook_import.py --extract-assets
python3 scripts/build_part2_visual_app_fixture.py
python3 scripts/build_part2_visual_app_fixture.py --validate-only
```

사용자가 제공한 이름 지정 압축 원본은 추출 검증 후 저장소에서 제거했다.
`scripts/import_named_visual_assets.py`로 명시적 외부 `--archive`를 다시 반입할
수 있고, 기본 자산 명령은 이미 추출된 PNG 60장과 파일명·CSV 매핑을
`data/working/app-assets/tsc-individual-images-v1/`에서 검증한다. 이 working 앱
자산은 Git에 보존하지만 reviewed·public 자산으로 승격하지 않는다. 앱은
development 서버에서 등록 asset ID와 SHA-256이 일치할 때만 읽고 production
build에는 포함하지 않는다. 개인 PracticeDraft·ReviewState·RecallAttempt는
`visual_question` target으로 IndexedDB에 저장하며 working 공용 JSON을
수정하지 않는다.

Part 7 로컬 앱 fixture는 같은 이미지 추출 경계를 재사용한다.

```sh
python3 scripts/build_part7_visual_app_fixture.py
python3 scripts/build_part7_visual_app_fixture.py --validate-only
```

Part 7은 VisualSet·StoryGuide·Question 각 12개와 VisualAsset·
VisualSetAsset 각 48개(세트별 장면 4개)를 보존하되 확정 QuestionVisualSet
0개, 검수 후보 12개,
ModelAnswer 0개를 유지한다. 후보는 canonical 관계로 승격하지 않는다.
개인 키워드·이야기 포인트·전체 답변은 `visual_set` target IndexedDB에만
저장하고 StoryGuide나 working JSON을 수정하지 않는다. Part 2·7 이미지
60개는 공용 개발 서버 allowlist로만 제공하며 production에서 비활성이다.

## Part 4 사람 검수와 부분 승격

Part 4 검수 입력은 `scripts/build_part4_review_fixture.py`가 working 앱 fixture와 review queue에서 결정적으로 만든다. 원문은 수정하지 않고 Question·AnswerPoint 해시와 일곱 필수 검수 영역을 보존한다.

사용자 결정은 `/data-review/part4`의 별도 IndexedDB에 저장하고 JSON 파일로 명시적으로 내보낸다. 학습자의 PracticeDraft, UserAnswer, Correction, ReviewState는 검수 결정에 포함하지 않는다.

`scripts/promote_part4_reviewed_data.py --decisions <path>`는 모든 필드가 승인되고 현재 해시와 일치하는 항목만 `data/reviewed/part4-v1/` 후보로 생성한다. 승인 가능한 항목이 0개면 출력하지 않는다. SourceReference의 workbook 내부 주장 승인만으로 외부 출처 검증 상태를 변경하지 않는다. 실제 reviewed 데이터와 학습 앱 연결은 별도 사용자 결정 전까지 미완료다.

## 상태 관리

### 질문 상태

| 상태 | 의미 |
|---|---|
| `raw` | 원본에서 확인했지만 아직 정리하지 않음 |
| `normalized` | 중국어와 기본 필드를 정리했으나 전체 검수가 끝나지 않음 |
| `verified` | 중국어, 병음, 한국어, 유형, 출처를 검수함 |

질문 상태는 디렉터리 단계와 관련되지만 동일한 개념은 아니다. 예를 들어 `working` 파일 안에 `raw`와 `normalized` 질문이 함께 있을 수 있다. reviewed canonical JSON에 반영하는 질문은 `verified`여야 한다.

### 모범답안 상태

| 상태 | 의미 |
|---|---|
| `missing` | 답변이 아직 없으며 정상적인 작업 상태 |
| `draft` | 첫 초안이 작성됨 |
| `review_needed` | 중국어, 내용, 구조 또는 출처 확인이 필요함 |
| `reviewed` | 언어와 구조를 검수함 |
| `approved` | 사이트 기본 답변 등 정해진 용도로 승인함 |

`missing`은 오류가 아니다. 답변이 없다는 이유로 질문의 검수를 막거나 임의 답변을 생성하지 않는다.

## 검수 완료 조건

질문을 `verified` 및 `reviewed` 단계로 다루려면 다음을 확인한다.

- 중국어 원문
- 전체 병음
- 한국어 뜻
- Part와 문제 유형
- 출처 식별자와 원본 위치
- 출처 확인 상태 또는 자체 생성 표시
- 원본에서 바뀐 내용과 변경 이유

모범답안은 질문과 독립적으로 검수한다. 하나의 질문에 기본 답변, 다른 목표 수준의 답변 등 여러 답변을 연결할 수 있다.

## 변경 및 출처 원칙

- `raw` 원본은 덮어쓰거나 이름을 변경하지 않는다.
- 새 파일명은 `working` 또는 `reviewed` 파생본에만 사용하며 `original_file_name`으로 raw 원본 이름을 추적한다.
- 정규화와 번역 과정은 원본 위치까지 추적 가능해야 한다.
- 실제 강의 내용, 출처 미확인 내용, 자체 제작 변형 문제를 섞지 않는다.
- 출처를 확인할 수 없는 내용을 확정 사실이나 강의 내용으로 표시하지 않는다.
- 공용 질문·모범답안과 사용자 답변·복습 상태·개인 오류를 분리한다.
- `Correction`에는 오류 콘텐츠와 출처를 기록하고, 사용자별 학습 상태는 `ReviewState`에서만 관리한다.
- raw는 원본 Excel, working은 CSV와 관계 검증용 JSON 등 중간 형식, reviewed 공용 canonical은 엔터티별 JSON을 사용한다. 세부 생성·검증 규칙은 `DATA_FORMAT_DECISION.md`를 따른다.
