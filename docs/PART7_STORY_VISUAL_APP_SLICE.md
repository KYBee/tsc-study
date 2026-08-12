# Part 7 스토리 그림 로컬 학습 slice

## 목적과 범위

`part7-visual-working-development-fixture-v1`은 전체 workbook working
반입에서 Part 7 스토리 그림 학습에 필요한 자료만 결정적으로 선별한다.
모두 검수 전 working 데이터이며 reviewed 또는 공식 문제·정답이 아니다.

| 데이터 | 수 | 학습 앱의 의미 |
|---|---:|---|
| `VisualSet` | 12 | 앱의 직접 학습 대상 |
| `VisualAsset` | 48 | 세트별 순서 1~4가 명시된 개발 환경 그림 |
| `VisualSetAsset` | 48 | 그림 세트와 네 장면의 순서 관계 |
| `StoryGuide` | 12 | 원본의 이야기 흐름 참고 |
| Part 7 `Question` | 12 | 특정 세트가 아닌 공통 지시문 자료 |
| Question 연결 후보 | 12 | 숫자 접미사만 일치하는 검수 큐 |
| 확정 `QuestionVisualSet` | 0 | 자동 연결하지 않음 |
| `ModelAnswer` | 0 | StoryGuide를 답변으로 변환하지 않음 |

공식 샘플 이미지와 Part 2 데이터는 이 fixture에서 제외한다.

## VisualSet 중심 설계

현재 workbook에는 `VisualSet`과 `StoryGuide`의 명시 관계가 있지만 Part 7
`Question`과 `VisualSet`의 확정 관계는 없다. `P7-001`과 `P7-V01`처럼
숫자 접미사가 같은 12건은 `candidate`, `review_needed`,
`not_canonical` 상태로만 보존한다. 앱은 후보를 실제 관계로 읽지 않고
VisualSet을 직접 학습 대상으로 사용한다.

Part 7 Question 12개의 중국어와 병음이 모두 같은 경우에만 공통 지시문으로
표시한다. 한국어 필드는 행마다 이야기 상황이 달라 확정 관계 없이
VisualSet에 붙이지 않는다. 이 지시문은 `Part 7 공통 안내`이며 특정
세트의 Question으로 표시하지 않는다.

## StoryGuide와 ModelAnswer

StoryGuide는 상황, 추천 이야기 흐름과 원본 연결어를 보존하는 구성 참고
자료다. 화면 제목은 `원본 이야기 흐름 참고`이고 완성 답변이나 공식
정답이 아니라는 안내를 함께 표시한다.

사용자가 StoryGuide를 참고하려면 미리보기와 확인을 거쳐야 한다. 확인한
원문은 편집 중인 내 이야기 포인트 하나로만 복사되고 자동 저장되지 않는다.
중국어 문장, 병음, 번역 또는 ModelAnswer를 생성하지 않는다.

## 로컬 이미지와 권리 경계

이미 추출되어 Git에 보존된 이름 지정 자산을 다음 명령으로 검증한다.

```sh
npm run assets:visual-local
```

기존 `npm run assets:part2-local`은 호환 alias로 유지한다. 압축 원본은 추출
검증 후 저장소에서 제거했고, 생성 위치는
`data/working/app-assets/tsc-individual-images-v1/`이다. Part 7 48개와
Part 2 12개는 ID와 fixture allowlist로 구분한다. Part 7 파일명의 세트·장면
번호와 동봉 CSV를 근거로 각 세트의 네 장면을 1→4 순서로 표시한다.

공용 개발 서버 경로는
`/__local-visual-assets/:visualAssetId`다. 기존 Part 2 전용 경로
`/__local-part2-assets/:visualAssetId`는 Part 2 ID에 한해 유지한다.
미들웨어는 등록 ID, 경로 정규화, realpath root, 확장자·MIME magic,
파일 크기와 SHA-256을 확인한다. 절대경로·상위 경로·symlink 이탈과
미등록 ID를 거부한다.

모든 asset은 `rights_status = review_needed`이며 `public_allowed`로
승격하지 않았다. 사용자의 명시적 요청에 따라 이미지 바이트는 working
앱 자산으로 Git에 보존하지만 public이나 JSON에는 넣지 않는다. 기본
production build는 이미지 바이트를 제외하고 Part 7 그림 학습을
비활성화한다. 운영자가 build 시
`VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS=true`를 정확히 설정한 경우에만 Part 2
12장과 Part 7 48장, 총 60개 allowlist를 realpath·PNG MIME·크기·SHA-256·
치수 검증 후 `BASE_URL` 아래에 emit한다. 이 deployment opt-in은 공개 권리
승인이나 metadata 상태 변경이 아니다.

## 화면 흐름

```text
HOME
→ /parts/7
→ /parts/7/sets/:visualSetId
→ /parts/7/sets/:visualSetId/answer
→ 저장 또는 작성 완료
→ /parts/7/sets/:visualSetId/recall
→ RecallAttempt + ReviewState
→ 나의 답변 또는 복습
```

세트 목록은 작성·완료·복습 상태 필터, 랜덤 세트와 마지막 위치를
제공한다. 목록 썸네일은 첫 장면을 쓰고, 세트 상세·답변·회상·복습은
네 장면을 순서대로 제공한다. 세트 상세는 그림 확대, StoryGuide, 공통 지시문, 내 답변 및
복습 상태와 이전·다음·랜덤 이동을 제공한다. 데이터 연결 상태는 접힌
개발 정보로만 표시한다.

## 내 이야기 설계와 PracticeDraft

Part 7 사용자는 다음 개인 내용을 직접 입력한다.

- `story_keywords: string[]`
- `story_points: { point_id, text, order }[]`
- `full_text`
- `completion_status`, `completed_at`

포인트는 추가·수정·삭제·위/아래 이동할 수 있다. 공용 StoryGuide와 개인
story point는 분리한다. 한국어·중국어·혼합 입력을 저장하지만 번역,
교정, 병음, 이미지 설명 또는 이야기를 자동 생성하지 않는다.

## 개인 데이터 대상과 IndexedDB v5

기존 학습 DB 이름 `tsc-study-part4-fixture-v1`은 개인 데이터 보존을 위해
변경하지 않는다. 버전 5는 기존 compound index를 재작성하지 않고
`target_type = visual_set`을 타입과 repository 계약에 additive하게
허용한다.

Part 7의 `PracticeDraft`, `ReviewState`, `RecallAttempt`,
`ReusablePhrase` source와 마지막 학습 위치는 VisualSet ID를 대상으로
한다. 기존 `question`과 `visual_question`, 모든 store, UserAnswer와
Correction은 그대로 보존한다. 검수 전용 DB에는 영향이 없다.

## 암기와 복습

저장된 내 PracticeDraft만 암기 대상으로 사용한다.

- 그림 + 내 이야기 포인트 + 내 답변
- 그림 + 내 이야기 포인트
- 그림만
- 내 이야기 포인트만
- 공통 지시문 + 그림
- 공통 지시문만

공통 지시문이 확인되지 않으면 마지막 두 모드는 표시하지 않는다.
StoryGuide는 암기 답변으로 자동 사용하지 않는다. 회상 결과는
`could_not_say → 못 외움`, `used_keywords/almost → 헷갈림`,
`memorized → 외움`으로 ReviewState에 매핑하고 상세 모드는
RecallAttempt에 남긴다. 복습 간격과 다음 날짜는 만들지 않는다.

## 검증

- Part 7 Python fixture 테스트 10개 통과: 선택 수, 참조·권리·후보 경계,
  결정성, validate-only, 입력 불변
- 전체 data 검증 통과: course-import 58개, full-import 27개 테스트
- Vitest 22개 파일, 143개 테스트 통과: IndexedDB v4→v5와 모든 기존
  target/store 보존, 홈·목록·상세·확대·StoryGuide, 이야기
  편집·저장·복원·회상, 나의 답변·복습, Part 2·텍스트·Part 4 회귀
- 자산: Part 2 12개·Part 7 48개, SHA·크기·MIME, Git ignore 비대상,
  production 원본 바이트 부재
- typecheck, lint, production build와 `npm run check`, `npm run check:data`
  통과. build에는 기존 단일 번들의 500 kB 초과 경고가 남아 있다.
- 실제 320px 브라우저에서 홈→목록→상세·확대→StoryGuide→이야기
  편집·재정렬·저장·새로고침 복원→완료→그림만 회상→결과 저장→
  나의 답변→복습을 확인했다. 가로 오버플로와 console 오류는 0건이다.
- 기본 production preview에서는 Part 7 홈 카드와 직접 경로가 비활성이고
  asset 요청이 발생하지 않는다. opt-in preview에서는 emitted asset URL로
  네 장면을 표시한다.

## 알려진 제한과 다음 조건

- Question–VisualSet 후보 12건은 사람이 승인하지 않았다.
- 이미지 공개 권리를 검수하지 않았다.
- StoryGuide와 공통 지시문은 모두 working 원문이다.
- ModelAnswer, 실제 AI, 자동 번역·병음·교정, 음성 기능이 없다.
- reviewed 승격과 배포는 하지 않았다.

다음 단계는 12개 후보와 이미지 권리를 사람이 검수하고, Part 7 문제·가이드
원문을 reviewed로 승격할 수 있는 결정 근거를 만드는 것이다.
