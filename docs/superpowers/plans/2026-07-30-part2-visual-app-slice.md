# Part 2 Visual App Slice Implementation Plan

> 실행 범위: 로컬 working 학습 slice. Git commit/push, 이미지 공개, AI 호출,
> 원문 수정, 임의 canonical 연결은 수행하지 않는다.

## 설계 결정

- 기존 `text-parts-v1` fixture와 앱 흐름은 그대로 유지하고, Part 2 전용
  `part2-visual-v1` fixture를 Repository에서 함께 읽는다.
- VisualQuestion을 canonical Question 연결 여부와 무관한 독립 학습 대상으로
  사용한다. 원본의 18개 `question_id` 연결은 보존하되 나머지 30개를 추측해
  연결하지 않는다.
- 이미지 바이트는 기존 full workbook builder로만 추출하고 Git에서 제외된
  `data/working/generated-assets/full-import-v1/`에 둔다.
- Vite 개발 서버는 fixture에 등록된 Part 2 asset ID만 허용하는 개발 전용
  endpoint를 제공한다. production plugin/route는 생성하지 않으며 앱은
  production에서 그림 학습 비활성 안내를 표시한다.
- 기존 학습 DB 이름과 store를 유지한다. v4 migration에서 PracticeDraft,
  ReusablePhrase, RecallAttempt에 `target_type`/`target_id`를 additive하게
  보완하고 기존 Question 레코드를 migration한다. ReviewState는
  `visual_question` target을 허용한다.
- Part 2에서는 PracticeDraft, RecallAttempt, ReviewState만 생성한다.
  UserAnswer와 Correction은 생성하지 않는다.

## Task 1: Part 2 fixture 계약과 builder

- Python unittest에 12/12/12/48/48 수, 연결 18/미연결 30, 공식 샘플 제외,
  원문·상태·참조·권리·경로·deterministic 조건을 먼저 작성한다.
- `scripts/build_part2_visual_app_fixture.py`를 기존 atomic builder 관례에 맞춰
  구현한다.
- fixture README와 manifest에 로컬 전용 권리 경계와 원본 working 상태를
  기록한다.

## Task 2: 런타임 검증과 Repository

- VisualSet/VisualAsset/VisualSetAsset/VisualQuestion용 Zod schema 및
  Part 2 manifest 검증을 추가한다.
- fixture loader와 PublicContentRepository에 Part 2 조회 메서드를 추가한다.
- Part 2 카탈로그를 개발 환경에서 활성화하고 production에서는 권리 안내
  상태를 반환한다.

## Task 3: 개발 전용 이미지 경계

- Vite `serve` 전용 plugin으로 asset ID allowlist endpoint를 만든다.
- 절대경로, `..`, 미등록 ID, 미지원 확장자/MIME을 거부한다.
- 로컬 asset SHA/format/Git-ignore 검증과 dist 바이트 부재 검증 스크립트를
  추가한다.

## Task 4: 개인 데이터 v4 migration

- entity와 repository 테스트에 visual_question 대상 저장/조회와 v3→v4 기존
  데이터 보존 실패 테스트를 추가한다.
- 기존 레코드와 API를 유지하면서 target 기반 API를 추가한다.
- 마지막 학습 위치도 text Question과 VisualQuestion을 구분해 저장한다.

## Task 5: Part 2 화면과 라우팅

- HOME Part 2 카드, 세트 목록, 세트 상세, VisualQuestion 상세, 답변 작성,
  회상 화면을 구현한다.
- 그림 썸네일/큰 그림/확대, 미준비 안내, 검수 전 원본 추천 답변을 구현한다.
- 사용자 입력은 원문 그대로만 저장하며 ModelAnswer를 개인 답변으로
  가져오거나 자동 비교/판정하지 않는다.

## Task 6: 나의 답변과 복습 통합

- PracticeDraft 기반 Part 2 항목을 나의 답변에 추가한다.
- Review 화면에 텍스트/그림 유형 및 Part 2 항목을 추가한다.
- 그림 문제 회상에서 이미지가 함께 보이도록 한다.

## Task 7: 문서와 전체 검증

- 새 `PART2_VISUAL_APP_SLICE.md`와 요청된 기존 문서를 최소 갱신한다.
- fixture 두 번 생성, validate-only, Python unittest, `check:data`,
  typecheck, lint, Vitest, build, check를 실행한다.
- production dist에 이미지 바이트가 없는지 검증한다.
- Playwright로 요청된 개발 브라우저 흐름, 320px, 콘솔 오류를 확인한다.
