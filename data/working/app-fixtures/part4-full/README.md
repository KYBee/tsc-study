# Part 4 전체 working 앱 fixture

이 디렉터리는 Part 4 전체 50문제를 앱에서 검증하기 위한 개발 fixture다.

- `full-import-v1`과 `course-import-v1`의 working/raw 레코드만 선별한다.
- 검수 완료 또는 production 데이터가 아니다.
- Question 50개와 AnswerPoint 50개를 원문 그대로 보존한다.
- workbook 기반 PartGuide와 3급 과정 기반 PartGuide를 병합하지 않는다.
- LearningExpression, PracticeDrill, CourseInsight는 Part 4 공통 학습 자료이며 특정 Question의 정답이 아니다.
- ModelAnswer는 생성하지 않으며 `model-answers.json`은 빈 배열이다.
- 기존 6문제 fixture와 원본 working 데이터는 수정하지 않는다.

생성:

```sh
python3 scripts/build_part4_full_app_fixture.py
```

검증만 수행:

```sh
python3 scripts/build_part4_full_app_fixture.py --validate-only
```
