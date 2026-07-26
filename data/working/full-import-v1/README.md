# Full workbook working import v1

이 디렉터리는 `data/raw/TSC_파트별_문제은행_그림포함.xlsx` 전체 구조를 스키마 v1.1 형태로 보존한 검수 전 working 데이터다.

- reviewed 또는 production 데이터가 아니다.
- 원본 Excel, 기존 sample CSV, Part 4 fixture와 course-import-v1을 수정하지 않는다.
- Question 253개와 AnswerPoint 253개를 원문 그대로 분리한다.
- Part 2 원본 추천 답변은 `review_needed` 출처 답변이며 승인된 공식 정답이 아니다.
- Part 7 StoryGuide는 ModelAnswer가 아니다.
- Part 2의 엄격한 언어 일치 관계만 working 연결로 만들고, Part 7 접미사 대응은 후보로만 둔다.
- workbook 내부 출처 이름·URL은 검증된 Source가 아니라 `SourceReference`의 주장이다.
- 이미지 권리는 모두 `review_needed`다.
- 이 데이터셋은 현재 Part 4 앱 런타임에 연결되지 않는다.

## 실행

```sh
python3 scripts/build_full_workbook_import.py
python3 scripts/build_full_workbook_import.py --validate-only
python3 scripts/build_full_workbook_import.py --extract-assets
```

`--extract-assets`는 원본 이미지 바이트 25개를 `data/working/generated-assets/full-import-v1/`에 미가공 상태로 생성한다. 이 경로는 Git에서 제외되며 공개 배포 자산이 아니다. `--output-dir`을 사용한 테스트 추출은 출력 디렉터리와 같은 부모의 `<name>-generated-assets/`에 검증용 미러를 만든다. JSON의 `repository_path`는 머신별 임시 경로를 기록하지 않고 canonical 저장소 생성 경로를 유지하며, 테스트 미러의 참조 무결성은 파일명과 SHA-256으로 확인한다.

## 파일 역할

- `questions.json`, `answer-points.json`: 전체 공용 문제와 원본 답변 포인트
- `sources.json`, `source-references.json`: 실제 workbook과 workbook 내부 출처 주장
- `part-guides.json`: workbook 시트에 직접 대응하는 source-specific 가이드
- `visual-*.json`, `question-visual-sets.json`: 이미지, 세트, Part 2 하위 질문과 엄격 연결
- `model-answers.json`: Part 2 시각 질문 대상 원본 추천 답변
- `story-guides.json`: Part 7 이야기 구성 도움
- `*-candidates.json`: 승인 전 연결·화면 사용 검수 후보
- `unmapped-content.json`: canonical 엔터티에 안전하게 넣지 않은 원문
- `review-queue.json`: 다음 사람 검수 항목
- `manifest.json`: 입력·출력 해시, 수와 검증 결과

전체 문제를 앱에서 사용하거나 reviewed로 승격하려면 언어·출처·시각 연결·권리와 후보 관계를 사람이 검수해야 한다.
