# Part 2 시각 문제 working 앱 fixture

이 디렉터리는 원본 workbook의 Part 2 그림 세트 12개와 세부 질문 48개를
로컬 개발 앱에서 연습하기 위한 deterministic working fixture다.

- VisualSet·VisualAsset·VisualSetAsset은 각각 12개다.
- VisualQuestion과 원본 추천 ModelAnswer는 각각 48개다.
- 공식 샘플 이미지와 Part 7 자료는 포함하지 않는다.
- canonical Question 연결 18개는 원본 working 관계를 보존하며, 미연결
  VisualQuestion 30개도 독립 학습 대상으로 유지한다.
- ModelAnswer는 `review_needed`/`unverified_source` 상태인 원본 추천
  답변이다. 공식 정답이나 검수 완료 답변이 아니다.
- 이미지 권리는 모두 `review_needed`이며 공개 허용으로 승격하지 않는다.
- 이미지 바이트는 JSON 또는 Git에 포함하지 않는다. 로컬에서 아래 명령으로
  원본 바이트를 준비한다.

```sh
python3 scripts/build_full_workbook_import.py --extract-assets
python3 scripts/build_part2_visual_app_fixture.py
```

검증만 수행:

```sh
python3 scripts/build_part2_visual_app_fixture.py --validate-only
```

이미지는 개발 서버에서만 등록된 asset ID를 통해 제공한다. production
빌드에는 이미지 바이트가 포함되지 않으며 권리 검수 전에는 배포할 수 없다.
