# Part 4 로컬 검수 fixture

이 디렉터리는 Part 4 working Question 50개의 사람 검수를 위한 결정적 입력이다.

- dataset ID: `part4-review-fixture-v1`
- 원문 Question, AnswerPoint와 SourceReference를 수정하지 않는다.
- `ReviewDecision`과 사용자 승인 결과는 fixture에 포함하지 않는다.
- 화면 진입이나 fixture 생성만으로 어떤 항목도 승인되지 않는다.
- `source_question_hash`와 `source_answer_point_hash`는 원문 변경 후 기존 결정을 stale로 판정하는 데 사용한다.
- 이 데이터는 reviewed 또는 production 데이터가 아니다.

생성:

```sh
python3 scripts/build_part4_review_fixture.py
```

검증:

```sh
python3 scripts/build_part4_review_fixture.py --validate-only
```
