# Part 2 로컬 시각 학습 slice

## 목적과 범위

`full-import-v1`의 Part 2 working 데이터를 원문 변경 없이 로컬 학습 앱에
연결한다. 이 slice는 공식·reviewed 데이터나 공개 배포 기능이 아니다.

| 엔터티 | 수 | 상태 |
|---|---:|---|
| `VisualSet` | 12 | `raw` |
| `VisualAsset` | 12 | `rights_status = review_needed` |
| `VisualSetAsset` | 12 | working 연결 |
| `VisualQuestion` | 48 | `raw` |
| `ModelAnswer` | 48 | `review_needed`, `unverified_source` |

fixture ID는 `part2-visual-working-development-fixture-v1`, 경로는
`data/working/app-fixtures/part2-visual-v1/`이다. workbook 공식 샘플
이미지 한 장은 포함하지 않는다.

## VisualSet과 VisualQuestion

한 `VisualSet`은 이미지 한 장과 순서가 있는 `VisualQuestion` 네 개를
가진다. `VisualQuestion.question_id`가 엄격한 근거로 연결된 항목은
18개이고 연결되지 않은 항목은 30개다. 이 연결 여부는 Part 2 학습
가능성을 제한하지 않는다. 앱은 48개 모두를 안정적인
`visual_question_id`로 직접 다룬다. 미연결 항목을 행 순서·접미사·의미
유사성으로 canonical Question에 연결하지 않는다.

## 로컬 이미지 추출과 권리 경계

이미지 원본 바이트는 다음 명령으로 workbook에서 그대로 추출한다.

```sh
python3 scripts/build_full_workbook_import.py --extract-assets
```

생성 경로는 `data/working/generated-assets/full-import-v1/`이며 디렉터리
전체가 Git에서 제외된다. fixture JSON은 base64 바이트가 아닌
`VisualAsset` 메타데이터만 보존한다.

- Part 2 이미지 12개 모두 `rights_status = review_needed`다.
- `public_allowed`는 false로 유지한다.
- 개발 서버는 fixture에 등록된 정확한 asset ID만
  `/__local-part2-assets/<visual_asset_id>`로 제공한다.
- 절대경로, `..`, 허용 루트 밖 경로, 미등록 ID, 지원하지 않는 확장자와
  MIME, SHA-256 불일치를 거부한다.
- 이 Vite 미들웨어는 `serve`에만 적용된다. production build에는 이미지
  바이트가 복사되지 않고 production 화면은 로컬 그림 학습을 비활성화한다.
- 자산이 없으면 깨진 이미지 대신 추출 명령과 로컬 준비 안내를 표시한다.

`scripts/validate_part2_local_assets.py`는 12개 파일 존재·크기·형식·SHA,
Git ignore/비추적 상태와 `dist/` 내 원본 이미지 바이트 부재를 검사한다.

## 화면 흐름

```text
HOME
→ /parts/2
→ /parts/2/sets/:visualSetId
→ /visual-questions/:visualQuestionId
→ /visual-questions/:visualQuestionId/answer
→ /visual-questions/:visualQuestionId/recall
```

- 홈은 개발 환경에서 Part 2를 활성화하고 12세트·48문항과 개인 상태를
  표시한다. Part 7은 계속 준비 중이다.
- 세트 목록은 미작성·작성 중·완료·헷갈림·외움과 결과 내 랜덤을 제공한다.
- 세트 상세는 원본 비율의 큰 그림, 단순 확대, 질문 네 개와 세트 이동을
  제공한다.
- 질문 상세는 그림을 유지하며 중국어→병음→한국어, 표시 토글, 이전·다음
  질문과 개인 복습 상태를 제공한다.
- 답변 화면은 한국어·중국어·혼합 자유 입력을 원문 그대로
  `PracticeDraft`에 저장한다. 번역·교정·병음·이미지 설명을 생성하지 않는다.

## 출처 ModelAnswer 상태

48개 답변은 workbook 원문을 보존한 `VisualQuestion` 대상 출처 답변이다.
접힌 `원본 추천 답변` 영역에서 다음 안내와 함께 표시한다.

> 원본 workbook에 포함된 검수 전 답변입니다. 공식 정답이나 검수 완료
> 답변이 아닙니다.

답변은 내 초안을 덮어쓰거나 `UserAnswer`로 저장하지 않는다. 정답 판정,
점수, 유사도, 자동 diff와 복습 상태 자동 변경도 하지 않는다.

## 개인 데이터 대상 일반화

학습 IndexedDB의 이름은 기존 개인 데이터를 보존하기 위해
`tsc-study-part4-fixture-v1`로 유지하고 버전을 4로 올렸다.
`PracticeDraft`, `ReviewState`, `RecallAttempt`는
`target_type = question | visual_question`, `target_id`를 사용한다.
`ReusablePhrase`는 같은 방식의 source target을 선택적으로 보존한다.

v3→v4 migration은 기존 `question_id`를 `target_type = question`과 같은
`target_id`로 채우고 기존 object store와 레코드를 삭제하지 않는다.
새 target 인덱스를 additive하게 만들며 검수 전용 IndexedDB에는 영향을
주지 않는다. Part 2에서는 교정 공급자가 없으므로 `UserAnswer`와
`Correction`을 만들지 않는다.

## 암기와 복습

저장된 개인 `PracticeDraft`만 암기 대상으로 사용한다.

- 그림 + 질문 + 내 답변 전체
- 그림 + 질문만
- 그림만
- 질문만

답변 공개 뒤 사용자가 회상 결과를 직접 선택한다. 상세 결과는
`RecallAttempt`, 세 단계 상태는 `ReviewState`에 저장한다. 원본 추천
답변은 개인 암기 답변으로 자동 사용하지 않는다. `/my-answers`와 `/review`
모두 Part 2 target, 썸네일, 질문과 개인 상태를 지원한다.

## 검증

- fixture builder와 unittest가 정확한 수·참조·상태·결정성·validate-only
  무변경을 검사한다.
- Zod는 ID, 관계, 권리, 상태, 경로와 18/30 연결 수를 런타임 검증한다.
- fake-indexeddb 테스트는 v3→v4 migration과 텍스트 개인 데이터 보존을
  확인한다.
- React 테스트는 홈, 12세트, 48질문, 이미지/실패/확대, 초안, 출처 답변,
  회상, 나의 답변, 복습과 기존 텍스트 흐름 회귀를 확인한다.
- production build 뒤 로컬 이미지 원본 바이트가 `dist/`에 없음을 별도
  검증한다.

## 알려진 제한과 다음 작업

- 문제·답변·출처와 이미지 권리는 사람 검수 전이다.
- 실제 AI, 자동 번역·병음·이미지 분석은 없다.
- `ModelAnswer`는 추천 출처 답변이며 공식 정답이 아니다.
- 이미지 공개·배포는 차단되어 있고 로컬 개발 환경에서만 볼 수 있다.
- Part 7은 구현하지 않았다.

다음 권장 작업은 Part 2 질문·추천 답변·이미지 권리의 사람 검수다. 이후
Part 7은 공통 지시문과 `StoryGuide`를 `ModelAnswer`와 분리하고, 검증된
`QuestionVisualSet` 관계만 사용하는 별도 로컬 slice로 구현한다.
