# 전체 텍스트 파트 working 앱 fixture

이 디렉터리는 시각 자료가 필요하지 않은 Part 1·3·4·5·6 문제를 앱에서
연습하기 위한 개발용 working fixture다.

- Question 193개와 AnswerPoint 193개를 원문 그대로 보존한다.
- Part별 Question 수는 4·84·50·36·19개다.
- Part 2와 Part 7은 시각 자료 연결이 필요하므로 포함하지 않는다.
- 검수 완료 또는 production 데이터가 아니다.
- workbook 기반 PartGuide와 3급 과정 기반 PartGuide를 병합하지 않는다.
- LearningExpression, PracticeDrill, CourseInsight는 해당 Part의 공통 참고
  자료이며 특정 Question의 정답이 아니다.
- ModelAnswer를 생성하지 않으며 `model-answers.json`은 빈 배열이다.
- 기존 Part 4 fixture와 원본 working 데이터는 수정하지 않는다.

생성:

```sh
python3 scripts/build_text_parts_app_fixture.py
```

검증만 수행:

```sh
python3 scripts/build_text_parts_app_fixture.py --validate-only
```
