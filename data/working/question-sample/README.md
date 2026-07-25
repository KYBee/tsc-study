# Question 대표 표본

이 디렉터리는 최종 서비스 데이터가 아니라 원본 Excel 매핑과 스키마 적합성을 확인하기 위한 Phase 1 작업 표본이다.

## 원본과 실행 방법

- 원본: `data/raw/TSC_파트별_문제은행_그림포함.xlsx`
- 시트: `문제은행`
- 현재 환경에서 실행:

```bash
python3 scripts/extract_question_sample.py
```

`python`이 Python 3을 가리키는 환경에서는 `python scripts/extract_question_sample.py`로도 실행할 수 있다. 현재 환경에는 `python` 명령과 `openpyxl`이 없어 `python3`과 Python 표준 라이브러리로 XLSX 내부 OOXML을 읽는다. 패키지를 추가로 설치하지 않으며 원본 Excel을 저장하거나 수정하지 않는다.

## 표본 선정 방식

- Part 1은 원본 4행을 모두 선택한다.
- Part 2~4는 아직 선택하지 않은 중국어 원문만 후보로 둔다.
- 각 단계에서 새 `유형`을 가장 먼저 우선하고, 새 `자료 등급`과 새 `원문성`을 얼마나 추가하는지 비교한다.
- 점수가 같으면 Excel 행 번호가 가장 작은 문제를 선택한다.
- 최종 출력은 Part 순서와 원본 Excel 행 순서로 정렬한다.

이 규칙은 무작위 값을 사용하지 않으므로 같은 원본에서 항상 같은 20개를 선택한다. 실제 선택 결과와 선정 이유는 [표본 반입 보고서](../../../docs/SAMPLE_IMPORT_REPORT.md)에 기록한다.

## `questions.csv`

| 컬럼 | 설명 |
|---|---|
| `question_id` | Excel의 `ID` 원문 |
| `source_id` | 직접 추출한 원본인 `src-001` |
| `source_locator` | 원본 시트와 실제 행 범위 |
| `part` | Excel의 `Part` 원문 |
| `question_type` | Excel의 `유형` 원문 |
| `question_zh` | 중국어 문제 또는 상황 원문 |
| `question_pinyin` | 원본 병음 |
| `question_ko` | 원본 한국어 뜻 또는 상황 |
| `source_grade` | Excel의 `자료 등급` 원문 |
| `source_name` | Excel의 `출처` 원문 |
| `source_url` | Excel의 `출처 URL` 원문 |
| `originality` | Excel의 `원문성` 원문 |
| `answer_point` | Excel의 `답변 포인트` 원문 |
| `question_status` | 표본 단계 상태인 `raw` |
| `normalization_notes` | 정규화하지 않았으므로 빈 값 |

`source_locator`가 `문제은행!A47:N47`이면 원본의 `문제은행` 시트 47행 전체를 뜻한다. 이를 이용해 CSV 값을 원본 셀과 다시 대조할 수 있다.

`연습 상태`, `최근 연습일`, `내 답변 메모`는 사용자별 개인 데이터이므로 공용 `questions.csv`에서 제외한다.

## `model_answers.csv`

이번 작업은 Question 표본만 검증하므로 `model_answers.csv`에는 요구된 헤더만 있고 데이터 행은 없다. 질문이 있다는 이유로 빈 `ModelAnswer` 행이나 모범답안을 만들지 않는다. 답변이 없는 문제는 정상이다.

향후 명시적인 답변 작업 항목이 필요하면 `answer_status = missing` 행을 사용할 수 있지만, 헤더만 두는 현재 방식은 표본 검증을 위한 임시 방식이며 최종 결정이 아니다.

## 현재 상태와 제한

- 20개 문제는 모두 `raw` 상태다.
- 중국어, 병음, 한국어는 원본 그대로이며 아직 검수 완료 상태가 아니다.
- 오탈자, 문장부호, 병음, 번역을 교정하지 않았다.
- CSV는 이번 표본의 작업용 출력일 뿐 최종 기준 데이터 형식이 아니다.
- Part 5~7, 그림 시트, 정답 시트와 전체 253개 문제는 추출하지 않았다.
