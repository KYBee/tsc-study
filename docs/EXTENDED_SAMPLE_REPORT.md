# Part 5~7·시각 자료 확장 표본 보고서

## 표본 개요

| 항목 | 결과 |
|---|---|
| 원본 파일 | `data/raw/TSC_파트별_문제은행_그림포함.xlsx` |
| 원본 SHA-256 | `a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f` |
| 사용 시트 | `문제은행`, `Part2 그림 연습`, `Part2 정답`, `Part7 스토리 그림`, `Part7 정답 포인트`, `그림 활용 안내` |
| Question 표본 | Part 5 6개, Part 6 4개, Part 7 4개: 합계 14개 |
| 시각 표본 | Part 2 그림 세트 2개·질문 8개·원본 추천 답변 8개, Part 7 그림 세트 2개·`StoryGuide` 2개 |
| 이미지 | Part 2 2개, Part 7 2개: 합계 4개 |
| 생성 위치 | `data/working/extended-sample/` |

전체 253개 Question, 전체 그림 세트, 공식 샘플 이미지와 다른 정답·가이드는 추출하지 않았다.

## Part 5~7 Question 선정

Part 5와 Part 6은 중국어 원문 중복을 제외하고 새 유형과 새 `(자료 등급, 원문성)` 조합을 차례로 우선했다. Part 7은 공통 지시문 반복을 허용하되 `question_id`, `answer_point`, `source_locator`가 서로 다른 행만 선택했다. 이후 유형과 `(자료 등급, 원문성)` 조합의 다양성을 우선하고 동점이면 원본 행이 빠른 항목을 선택했다.

| question_id | Part | 유형 | 자료 등급 | 원문성 | source_locator | 선정 이유 |
|---|---:|---|---|---|---|---|
| `P5-001` | 5 | 학력·소득 | A 공식 샘플 | 공식 원문 | `문제은행!A188:N188` | 첫 고유 유형·조합 |
| `P5-002` | 5 | 자동차 선택 | A 공식 샘플 | 공식 원문 | `문제은행!A189:N189` | 다른 유형 |
| `P5-003` | 5 | 신용카드 | A 공식 샘플 | 공식 원문 | `문제은행!A190:N190` | 다른 유형 |
| `P5-004` | 5 | 오디션 프로그램 | A 공식 샘플 | 공식 원문 | `문제은행!A191:N191` | 다른 유형 |
| `P5-005` | 5 | 성형 | C 공개 기출형 | 기출형 정규화 | `문제은행!A192:N192` | 다른 유형·조합 |
| `P5-023` | 5 | 남녀평등 | D 빈출 유형 변형 | 연습 변형 | `문제은행!A210:N210` | 다른 유형·조합 |
| `P6-001` | 6 | 일정 변경 | A 공식 샘플 | 공식 상황 원문 | `문제은행!A224:N224` | 첫 고유 유형·조합 |
| `P6-004` | 6 | 분실 위로 | C 공개 기출형 | 상황 요약/변형 | `문제은행!A227:N227` | 다른 유형·조합 |
| `P6-009` | 6 | 식당 항의 | C 응시후기 회상 | 상황 요약/변형 | `문제은행!A232:N232` | 다른 유형·조합 |
| `P6-012` | 6 | 수하물 | B 강의 기출·복원 | 상황 요약/변형 | `문제은행!A235:N235` | 다른 유형·조합 |
| `P7-001` | 7 | 공식 샘플 | A 공식 샘플 | 스토리 소재 | `문제은행!A243:N243` | 첫 고유 ID·답변 포인트·조합 |
| `P7-002` | 7 | 운전 사고 | C 응시후기 회상 | 스토리 소재 | `문제은행!A244:N244` | 다른 ID·답변 포인트·유형·조합 |
| `P7-005` | 7 | 휴대전화 분실 | D 유형 변형 | 스토리 소재 | `문제은행!A247:N247` | 다른 ID·답변 포인트·유형·조합 |
| `P7-007` | 7 | 생일 케이크 | E 연습 변형 | 스토리 소재 | `문제은행!A249:N249` | 다른 ID·답변 포인트·유형·조합 |

### Part 7 공통 지시문

Part 7의 12개 Question은 다음 공통 지시문을 사용한다.

- 中文: `请根据四幅连续的图片，讲述一个完整的故事。`
- Pinyin: `qǐng gēn jù sì fú lián xù de tú piàn ， jiǎng shù yí gè wán zhěng de gù shì 。`
- 한국어: 네 장의 연속된 그림을 바탕으로 완전한 이야기를 말하세요.

공통 지시문만으로 문제의 고유성을 판단할 수 없다. Part 7은 `question_id`, 그림 세트, `answer_point`의 조합으로 구분되며, 같은 문장은 제거 대상 중복이 아니라 의도된 반복이다. 따라서 `question_zh`는 `Question`의 고유키가 될 수 없다. 완전히 같은 문장을 찾는 검사는 데이터 정체성 검사와 의미상 중복 후보 검사로 구분해야 한다.

선택된 Part 7의 답변 포인트는 다음과 같다.

| question_id | answer_point |
|---|---|
| `P7-001` | 새 원피스 구매 → 자랑 → 음료를 쏟음 → 세탁·수습 |
| `P7-002` | 면허 취득 → 운전 → 사고 → 높은 수리비 |
| `P7-005` | 택시 탑승 → 분실 발견 → 기사 연락 → 회수 |
| `P7-007` | 생일 준비 → 주인공 등장 → 깜짝 축하 → 함께 식사 |

## 시각 세트와 이미지

| 그림 ID | Part | 세트 유형 | 원본 anchor | asset_path | SHA-256 |
|---|---:|---|---|---|---|
| `P2-V01` | 2 | `four_question_image` | `A2`, `oneCellAnchor` | `data/working/extended-sample/assets/part2__P2-V01.png` | `8b21b811fb9c62c7c955d15f542acb3412c9c33bd2c5a7e531e279421b5190b5` |
| `P2-V02` | 2 | `four_question_image` | `A21`, `oneCellAnchor` | `data/working/extended-sample/assets/part2__P2-V02.png` | `cb66ee5388641423f55d5ab14ea95f494378dc011ea7440dfa1bb30cc89f6ff4` |
| `P7-V01` | 7 | `story_image` | `A2`, `oneCellAnchor` | `data/working/extended-sample/assets/part7__P7-V01.png` | `8018d6e0dff6ec3859d28734bd71db790b453f9fedd68938d74b6b123154d2d5` |
| `P7-V02` | 7 | `story_image` | `A20`, `oneCellAnchor` | `data/working/extended-sample/assets/part7__P7-V02.png` | `cc5f74948e404942ad1114c2e4b9da2e2a3999f24accecdc19d07f1645e0f55d` |

네 이미지는 대상 worksheet의 drawing relationship에서 anchor와 media relationship을 따라 연결했다. 이미지 바이트를 재압축·크기 변경·자르기·포맷 변환하지 않았다. 네 연결은 명확하며 모호한 이미지 연결은 없다. `oneCellAnchor`에는 명시적 종료 행이 없으므로 `anchor_row_end`를 추측하지 않고 비워 두었다. 모든 `rights_status`는 `review_needed`다.

공식 샘플 이미지는 별도 `공식 샘플 이미지` worksheet 관계에 있으며 이번 allowlist에 포함하지 않았다.

## 기존 Question 연결

### Part 2 시각 질문

`linked_question_id`는 명시적 ID 또는 중국어 원문 완전 일치가 한 건일 때만 채웠다.

| visual_question_id | linked_question_id | mapping_status | 근거 |
|---|---|---|---|
| `vq-p2-v01-q1` | `P2-006` | `matched_exact_zh` | 중국어 원문 완전 일치 1건 |
| `vq-p2-v01-q2` |  | `unmatched` | 완전 일치 없음 |
| `vq-p2-v01-q3` | `P2-009` | `matched_exact_zh` | 중국어 원문 완전 일치 1건 |
| `vq-p2-v01-q4` | `P2-027` | `matched_exact_zh` | 중국어 원문 완전 일치 1건 |
| `vq-p2-v02-q1` | `P2-036` | `matched_exact_zh` | 중국어 원문 완전 일치 1건 |
| `vq-p2-v02-q2` | `P2-035` | `matched_exact_zh` | 중국어 원문 완전 일치 1건 |
| `vq-p2-v02-q3` |  | `unmatched` | 완전 일치 없음 |
| `vq-p2-v02-q4` |  | `unmatched` | 완전 일치 없음 |

Part 2 시각 질문은 5개가 기존 Question과 연결되고 3개는 연결되지 않았다.

### Part 7 StoryGuide

`P7-V01`과 `P7-V02`의 그림과 정답 포인트는 동일한 원본 그림 ID로 각각 `VisualSet`과 `StoryGuide`를 연결했다. 그러나 `P7-V01 → P7-001`, `P7-V02 → P7-002`를 직접 증명하는 원본 외래키는 없다. 공통 중국어 지시문도 문제은행의 12개 Part 7 행과 모두 일치하므로 단일 Question을 정할 수 없다.

따라서 두 `StoryGuide.linked_question_id`는 비워 두었다. 빈 값은 오류가 아니며, 행 순서나 숫자 접미사만으로 연결을 강제하지 않았다.

## 필드 품질과 데이터 성격

| Question 필드 | 빈 값 수 |
|---|---:|
| `question_zh` | 0 |
| `question_pinyin` | 0 |
| `question_ko` | 0 |
| `question_type` | 0 |
| `source_grade` | 0 |
| `source_name` | 0 |
| `source_url` | 3 |
| `originality` | 0 |
| `answer_point` | 0 |

`source_url`이 빈 3행은 원본 상태를 유지한 것이며 오류로 단정하지 않는다.

Part 2의 답변 8개는 `Part2 정답` 시트의 원본 추천 답변이다. 새 답변을 만들지 않았으며 `answer_variant=basic`, `answer_status=review_needed`, `provenance_kind=unverified_source`, `source_id=src-001`로 기록했다. Part 7의 흐름 2개는 `StoryGuide`이며 `ModelAnswer`로 변환하지 않았다.

## 스키마 검토 사항

### 필요한 엔터티 후보

- `VisualAsset`: 이미지 경로, 미디어 유형, 해시, 권리 상태와 원본 anchor
- `VisualSet`: 그림 ID, Part, 세트 유형과 하나 이상의 시각 자료 묶음
- `VisualQuestion`: 시각 세트 안의 문항 번호와 언어 묶음
- `StoryGuide`: Part 7 상황, 순서형 이야기 흐름, 연결어와 자료 성격
- `AnswerPoint`: Question 또는 시각 세트에 연결되는 답변 보조 정보

Part 7에는 `Question → VisualSet → VisualAsset → StoryGuide 또는 AnswerPoint` 관계가 필요하다. 시각 문제의 `Question`과 `VisualSet` 연결에는 연결 방법과 검수 상태도 필요하다.

### 식별자와 중복 검사

- `Question` 식별자는 `question_id`를 기준으로 한다.
- `question_zh`에는 unique 제약을 두지 않는다.
- 같은 `question_zh`라도 연결된 그림이나 답변 포인트가 다르면 서로 다른 문제일 수 있다.
- 완전 일치 문장 검사는 식별자 검증이 아니라 별도 `duplicate_candidate` 검사로 관리한다.
- 데이터 정체성 중복과 학습 내용의 의미상 중복을 별도로 검수한다.

### 답변·출처 필드

- 출처가 있는 `ModelAnswer`에는 workbook의 답변 행을 다시 찾을 수 있는 조건부 `source_locator`가 필요하다.
- 기존 `ModelAnswer.question_id`가 필수인 구조는 기존 Question에 연결되지 않은 `VisualQuestion` 3개의 원본 답변을 직접 표현하기 어렵다. 시각 질문을 독립 Question으로 승격하거나 답변 대상 유형을 확장할지 결정해야 한다.
- `answer_point`에는 문항별 답변 구조와 Part 7 스토리 흐름 등 서로 다른 성격이 섞여 있다. 현재 raw 필드는 보존하되 `Question`, `AnswerPoint`, `StoryGuide`, `PartGuide` 중 최종 위치를 분류 후 결정해야 한다.
- `source_id=src-001`은 직접 추출한 workbook을 뜻한다. workbook 내부의 `source_name`과 `source_url`은 workbook이 주장하는 세부 출처이므로 검수된 `Source`와 동일시하지 말고 `claimed_origin` 같은 관계 후보를 검토해야 한다.

## 전체 추출 전 필요한 결정

1. `VisualAsset`, `VisualSet`, `VisualQuestion`, `StoryGuide`, `AnswerPoint`의 최소 필드와 관계를 정한다.
2. 연결되지 않은 시각 질문의 정체성과 원본 답변 대상을 표현하는 방식을 정한다.
3. `ModelAnswer.source_locator`와 시각 연결의 `link_method`·`mapping_status`를 개념 스키마에 반영할지 결정한다.
4. `answer_point`의 성격을 Part별로 분류하고 최종 위치를 정한다.
5. workbook 직접 출처와 workbook 내부의 주장된 세부 출처 관계를 정한다.
6. 이미지 공개 가능 여부를 확인한다.
7. CSV는 계속 작업용 표본으로만 사용하고 기준 데이터 형식은 별도 결정한다.

## 결론

**스키마 구조 결정 전에 추가 검증 필요**

Question의 핵심 필드와 원본 추적, Part 2의 복합 키, 이미지 anchor·바이트, Part 7 그림 ID와 StoryGuide 연결은 표본으로 표현할 수 있었다. 그러나 기존 Question에 연결되지 않은 시각 질문의 정체성, `ModelAnswer`의 대상, `answer_point` 위치와 시각 엔터티 관계가 아직 미결정이므로 전체 추출을 시작하지 않는다.

## 원본 보존과 재실행

작업 전후 원본 SHA-256은 모두 `a150fd8a732d6ce2a309a6d5a41feb3788bb5b7b03142472d0d9fdf1fae1f37f`였다. 원본 Excel을 다시 저장하거나 수정하지 않았다. 같은 원본으로 재실행한 CSV와 이미지 SHA-256은 동일했다.
