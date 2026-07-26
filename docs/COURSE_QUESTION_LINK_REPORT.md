# 강의 콘텐츠와 Question 연결 후보 보고서

## 비교 범위

다음 두 검수 전 working 데이터셋을 비교했다.

- workbook: `data/working/full-import-v1/`
- 강의 분석: `data/working/course-import-v1/`

비교 목적은 canonical 관계를 자동 확정하는 것이 아니라, 근거가 충분한 사람 검수 후보만 찾는 것이다. 기존 `course-import-v1`과 workbook 원본은 수정하지 않았다.

## 실제 관계를 만들지 않은 이유

강의 콘텐츠의 Part, 주제 또는 대표 키워드가 비슷하다는 사실만으로 특정 Question을 확정할 수 없다. 특히 분석자가 통합한 대표 주제와 생성 학습 자료는 강의 화면의 특정 문제 ID나 원문을 직접 증명하지 않는다.

따라서 이번 반입은 course 콘텐츠와 canonical Question 사이의 실제 관계를 만들지 않았다. 후보가 승인되더라도 출처 위치와 언어 원문을 다시 확인한 뒤 별도 관계로 반영해야 한다.

## 엄격한 후보 기준

Question 연결 후보는 다음 근거만 허용한다.

1. 강의 데이터에 canonical `question_id`가 명시됨
2. 완전한 중국어 질문이 정확히 일치하고 후보가 하나임
3. 중국어·병음·한국어가 모두 정확히 일치함
4. 상세 분석의 구체 출처 위치에 특정 문제 ID가 명시됨

학습 화면 사용 후보는 다음 조건을 동시에 만족할 때만 만든다.

- Part가 명확히 일치함
- 강의 표현의 완전한 중국어 문자열이 Question 원문에 실제로 포함됨

Part 또는 주제만 같은 경우, 단어 일부만 겹치는 경우와 의미 유사성만 있는 경우는 후보를 만들지 않는다.

## 결과

| 후보 종류 | 수 | 상태 |
|---|---:|---|
| course 콘텐츠 → canonical Question 연결 후보 | 0 | 후보 없음이 정상 |
| Question 화면용 course 콘텐츠 사용 후보 | 4 | `review_needed` |
| workbook Part 7 접미사 연결 후보 | 12 | `review_needed`, 별도 검수 |

course 콘텐츠 사용 후보 중 3건은 `LearningExpression` `le-course-016`의 `恭喜你！`가 Part 3 Question 원문에 문자 그대로 포함된 경우다. 나머지 1건은 `PronunciationItem` `pi-course-pangbian-erhua`의 `旁边`이 Part 2 Question 원문에 문자 그대로 포함된 경우다.

| Question | match basis |
|---|---|
| `P3-047` | Part 일치 + 완전한 중국어 표현 포함 |
| `P3-048` | Part 일치 + 완전한 중국어 표현 포함 |
| `P3-049` | Part 일치 + 완전한 중국어 표현 포함 |
| `P2-011` | Part 일치 + 발음 항목 중국어 문자열 포함 |

이 네 건은 SourceReference나 canonical 연결이 아니라 학습 화면 사용 가능성을 검토하는 큐다.

## 충돌과 검수 필요 항목

- workbook PartGuide와 course-import PartGuide는 실제 출처와 과정 목표 맥락이 다르므로 자동 병합하지 않는다.
- 강의 분석은 3급 목표 과정이며, workbook 문제에 연결되더라도 Level 8 전략이나 공식 채점 기준으로 승격하지 않는다.
- `LearningExpression`의 포함 일치는 해당 표현이 그 Question의 필수 정답임을 뜻하지 않는다.
- Part 7의 숫자 접미사 12건은 명시적 외래키가 아니며 공통 지시문만으로 고유성을 판단할 수 없다.
- 원본 영상이 저장소에 없는 강의 타임스탬프는 실제 화면·발언을 직접 재확인한 상태가 아니다.

## 다음 검수 절차

1. 후보의 course SourceReference와 상세 문서 위치를 연다.
2. 해당 위치에 정확한 문제 문장 또는 canonical ID가 있는지 확인한다.
3. workbook Question의 중국어·병음·한국어와 충돌 여부를 비교한다.
4. `evidence_kind`와 과정 목표 `level_3` 맥락을 유지한다.
5. 연결을 승인할 경우 관계 종류와 승인 근거를 별도로 기록한다.
6. 근거가 부족하면 후보를 거절하거나 `review_needed`로 유지한다.

후보가 0개인 것은 오류가 아니다. 더 많은 관계를 만들기 위해 의미 유사성이나 행 순서를 연결 근거로 완화하지 않는다.
