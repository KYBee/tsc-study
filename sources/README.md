# 출처 자료 운영 지침

## 목적

강의 분석 텍스트, 예상 문제 Excel, PDF 등 사용자가 제공하는 자료가 어디에서 왔고 어떻게 사용할 수 있는지 추적한다. 실제 자료에서 확인한 내용과 프로젝트가 자체 제작한 내용을 섞지 않는다.

## `data/raw`와 `sources`의 역할

- 실제 변환 입력으로 사용하는 원본 파일의 기준 보관 위치는 `data/raw/`이며 내용과 원래 파일명을 유지한다.
- `sources/`에는 각 원본의 출처 메타데이터, 보관 위치, 권리 확인 상태와 참고 관계를 기록한다.
- 공개 가능한 별도 참고 자료를 `sources/`에 둘 수 있지만, 같은 원본을 두 디렉터리에 중복 복사하지 않는다.
- 저작권이나 공개 가능 여부가 불확실한 원본은 저장소 밖에 보관하고 메타데이터에 외부 보관 사실만 기록한다.

기준 메타데이터 파일 형식은 아직 결정하지 않았다. 실제 자료를 확인한 뒤 Excel, CSV, JSON 중 기준 데이터 형식 결정과 함께 정한다.

## 파생 파일 권장 이름

`working` 또는 `reviewed` 파생본에 새 이름이 필요할 때만 다음 형식을 권장한다. 이 형식은 `raw` 원본에는 적용하지 않는다.

```text
<source_id>__<date-or-undated>__<short_english_title>.<extension>
```

예시 형식:

```text
src-001__undated__expected_questions.xlsx
```

이 예시는 파생본 이름 형식만 보여 주며 실제 출처가 존재한다는 뜻이 아니다. raw 원본의 이름은 변경하지 않고, 파생본은 메타데이터의 `original_file_name`으로 원래 이름을 반드시 추적한다.

## 출처 메타데이터

| 필드명 | 필수 여부 | 설명 |
|---|---|---|
| `source_id` | 필수 | 저장소 안에서 중복되지 않는 영어 식별자 |
| `title` | 필수 | 자료를 식별할 수 있는 제목 |
| `source_type` | 필수 | `course_analysis`, `excel`, `pdf`, `instructor_correction`, `self_created`, `other` |
| `provenance_status` | 필수 | `verified_source`, `unverified_source`, `self_created` |
| `creator_or_provider` | 선택 | 강사, 작성자, 제공처. 모르면 비워 둠 |
| `original_file_name` | 조건부 | 실제 원본 파일이 있으면 필수인, 사용자가 제공한 원래 파일명 |
| `file_ref` | 선택 | `data/raw` 또는 별도 보관 위치 |
| `acquired_date` | 선택 | 확보 또는 제공 날짜 |
| `rights_status` | 필수 | `review_needed`, `private_use`, `public_allowed` |
| `notes` | 선택 | 판본, 범위, 누락, 확인 필요 사항 |

모르는 작성자, 강의명, 날짜를 추측하지 않는다. `unverified_source`를 `verified_source`처럼 표시하지 않는다.

## 자료별 주의

- **강의 분석 텍스트:** 원본 강의와 분석 작성자를 구분하고, 어느 구간을 근거로 했는지 기록한다.
- **Excel:** 시트명과 행 또는 셀 위치를 문제 데이터의 `source_locator`로 추적한다.
- **PDF:** 판본과 페이지를 기록하고 텍스트 추출 과정에서 바뀐 문자를 검수한다.
- **강사 교정:** 잘못된 문장, 올바른 문장, 설명이 실제 강사 교정인지 확인한다.
- **자체 제작 자료:** `self_created`로 표시하고 실제 강의 출처처럼 보이게 하지 않는다.

## 저작권과 공개 저장소

저작권이 있는 원본 강의 영상, PDF, 교재, 유료 강의 자료를 공개 저장소에 올리기 전에는 권리와 공개 가능 범위를 별도로 확인해야 한다. 확인 전에는 `rights_status: review_needed` 또는 `private_use`로 기록하고 Git에 추가하지 않는다.

원본 전체를 공개할 수 없더라도 출처 메타데이터와 허용된 범위의 파생 데이터 공개 가능 여부는 각각 따로 확인한다.
