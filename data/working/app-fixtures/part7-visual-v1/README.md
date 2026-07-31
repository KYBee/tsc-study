# Part 7 스토리 그림 working 앱 fixture

이 디렉터리는 원본 workbook의 Part 7 스토리 그림 세트 12개를 로컬 개발
앱에서 연습하기 위한 deterministic working fixture다.

- VisualSet·VisualAsset·VisualSetAsset·StoryGuide는 각각 12개다.
- Part 7 Question 12개는 공통 지시문 자료로만 보존한다.
- 숫자 접미사 기반 Question 연결 후보 12개는 `review_needed`인
  `not_canonical` 후보일 뿐 실제 QuestionVisualSet 관계가 아니다.
- 확정 QuestionVisualSet은 0개이며 앱은 VisualSet을 직접 학습 대상으로 쓴다.
- StoryGuide는 원본의 이야기 흐름 참고 자료이며 ModelAnswer가 아니다.
- ModelAnswer를 만들지 않으며 `model-answers.json`은 빈 배열이다.
- 공식 샘플 이미지와 Part 2 자료는 포함하지 않는다.
- 이미지 권리는 모두 `review_needed`이며 공개 허용으로 승격하지 않는다.
- 이미지 바이트는 JSON 또는 Git에 포함하지 않는다.

```sh
python3 scripts/build_full_workbook_import.py --extract-assets
python3 scripts/build_part7_visual_app_fixture.py
python3 scripts/build_part7_visual_app_fixture.py --validate-only
```

이미지는 개발 서버에서만 등록된 asset ID를 통해 제공한다. production
빌드에는 이미지 바이트가 포함되지 않으며 권리 검수 전에는 배포할 수 없다.
