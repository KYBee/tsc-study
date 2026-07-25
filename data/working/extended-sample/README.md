# 확장 표본

이 디렉터리는 전체 데이터가 아니라 Part 5~7과 시각 자료의 추가 스키마 검증용 `working` 표본이다. CSV는 작업용 중간 형식이며 reviewed 공용 canonical 형식은 [MVP 데이터 형식 결정](../../../docs/DATA_FORMAT_DECISION.md)에 따라 JSON을 사용한다.

## 원본과 실행

- 원본: `data/raw/TSC_파트별_문제은행_그림포함.xlsx`
- 실행: `python3 scripts/extract_extended_sample.py`
- 원본은 읽기 전용으로 사용하며 저장하거나 수정하지 않는다.
- 같은 원본에서는 같은 행, CSV, 이미지 바이트와 SHA-256이 생성된다.
- 재실행 시 이 README는 보존하고 검증된 CSV·이미지 bundle 전체를 교체하므로 이전 생성 잔여 파일을 남기지 않는다.

## 표본 범위와 선정

- `문제은행`: Part 5 6개, Part 6 4개, Part 7 4개
- `Part2 그림 연습`과 `Part2 정답`: 그림 ID가 앞선 2세트, 질문 8개, 원본 추천 답변 8개
- `Part7 스토리 그림`과 `Part7 정답 포인트`: 그림 ID가 앞선 2세트, `StoryGuide` 2개
- 이미지: Part 2 2개와 Part 7 2개

Part 5와 Part 6은 새 유형과 새 `(자료 등급, 원문성)` 조합을 우선하면서 같은 중국어 문제를 제외한다. Part 7은 공통 지시문을 반복하는 구조이므로 중국어 문장 중복을 허용하고, 서로 다른 `question_id`, `answer_point`, `source_locator`를 우선한다. 모든 동점은 원본 Excel 행 번호가 빠른 순서로 결정한다.

## 파일 역할

| 파일 | 역할 |
|---|---|
| `questions_part5_7.csv` | Part 5~7 공용 `Question` 후보 14개 |
| `visual_sets.csv` | 그림 세트, 원본 anchor, 추출 이미지와 권리 상태 |
| `visual_questions.csv` | Part 2 그림별 질문과 기존 `Question` 연결 후보 |
| `visual_model_answers.csv` | Excel 원본에 포함된 Part 2 추천 답변 |
| `story_guides.csv` | Part 7의 상황, 이야기 흐름, 연결어와 자료 성격 |
| `assets/` | XLSX 내부 바이트를 재가공하지 않고 복사한 이미지 4개 |

`questions_part5_7.csv`의 `연습 상태`, `최근 연습일`, `내 답변 메모`는 개인 학습 데이터이므로 제외했다. 질문은 모두 `raw` 상태이며 중국어, 병음, 한국어도 아직 검수 완료 상태가 아니다.

## 답변·가이드·연결 원칙

`visual_model_answers.csv`의 8개 답변은 프로젝트가 새로 만든 답변이 아니라 Excel 원본의 추천 답변이다. 따라서 `answer_status=review_needed`, `provenance_kind=unverified_source`로 두며 승인된 답변으로 취급하지 않는다.

`StoryGuide`는 이야기의 상황·흐름·연결어를 담는 보조 자료이며 완성된 `ModelAnswer`가 아니다. Part 7 흐름을 중국어 모범답안으로 변환하지 않았다.

`linked_question_id`는 명시적 ID 연결 또는 중국어 원문 완전 일치가 한 건일 때만 채운다. 일치가 없거나 여러 후보가 있으면 비워 두며, 빈 값은 오류가 아니다. 원본 위치는 `source_locator`로 찾아간다. 예를 들어 `'Part2 그림 연습'!H3:K5`는 해당 시트의 질문 블록을 뜻한다.

## 이미지와 권리

이미지는 압축 해제 후 XLSX 내부 미디어 바이트를 그대로 복사했다. 재압축, 크기 변경, 자르기, 포맷 변환을 하지 않았다. 현재 그림은 `oneCellAnchor`라 시작 행과 크기만 명시되어 있고 종료 행은 없으므로 `anchor_row_end`를 비워 두었다.

모든 이미지의 `rights_status`는 `review_needed`다. 공개 저장소에서 사용할 수 있는지는 별도 확인해야 한다.
