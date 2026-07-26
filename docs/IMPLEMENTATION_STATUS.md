# 구현 상태

## 현재 구현 범위

Part 4 raw 개발 표본 6개로 첫 번째 모바일 수직 기능을 구현했다.

```text
HOME
→ Part 4
→ 문제 선택
→ 답변 작성
→ deterministic mock 교정
→ 사용자 승인
→ 나의 답변
→ 복습 상태 변경
→ 개인 실수 확인
```

구현 화면:

- 학습 홈
- Part 4 문제 목록
- 일반 텍스트 문제 상세
- 답변 작성
- 교정 결과
- 나의 답변
- 문제 복습
- 개인 실수 노트
- 찾을 수 없음 및 개발 데이터 오류

하단 메뉴는 `학습`, `복습`, `나의 답변`, `실수 노트` 네 개다.

## 개발 fixture

dataset ID는 `part4-raw-development-fixture-v1`이다. 다음 canonical `question_id`만 포함한다.

- `P4-001`
- `P4-002`
- `P4-003`
- `P4-006`
- `P4-036`
- `P4-039`

데이터 수:

| 엔터티 | 수 |
|---|---:|
| `Question` | 6 |
| `AnswerPoint` | 6 |
| `Source` | 1 |
| `SourceReference` | 12 |
| `ModelAnswer` | 0 |

fixture는 `data/working`의 raw 표본을 앱 경계와 스키마를 검증하기 위해 변환한 개발 자료다. reviewed 또는 production 데이터가 아니며 전체 문제 추출도 아니다. zod 검증이 실패하면 앱은 빈 데이터처럼 계속하지 않고 개발 데이터 오류를 표시한다.

## 전체 workbook working 데이터

앱과 분리된 `data/working/full-import-v1/`에는 Question·AnswerPoint 253개, VisualAsset·VisualSet·VisualSetAsset 25개, Part 2 VisualQuestion·출처 ModelAnswer 48개와 Part 7 StoryGuide 12개가 있다. Part 2의 엄격 일치 18건만 `QuestionVisualSet`으로 구조화했고, Part 7 접미사 12건은 후보로만 남겼다.

이 데이터셋은 사람 검수 전 working 산출물이다. 현재 React 앱의 Repository와 라우트는 변경하지 않았으며 계속 Part 4 개발 fixture 6개만 읽는다.

## 데이터 흐름

공용 데이터:

```text
working CSV
→ scripts/build_part4_app_fixture.py
→ development fixture JSON
→ zod 검증
→ read-only PublicContentRepository
→ 화면
```

개인 데이터:

```text
답변 입력
→ 질문별 sessionStorage 임시 교정 세션
→ MockCorrectionProvider
→ 사용자 저장 승인
→ IndexedDB UserAnswer + 실제 변경 Correction

복습 상태 버튼 선택
→ IndexedDB ReviewState
```

`CorrectionResult` 전체를 canonical 개인 `Correction`으로 자동 저장하지 않는다. 사용자가 성공 결과를 승인했을 때 실제 변경 항목만 개인 `Correction`으로 저장한다.

## IndexedDB 구조

- DB 이름: `tsc-study-part4-fixture-v1`
- 버전: `1`

| object store | keyPath | 주요 인덱스와 규칙 |
|---|---|---|
| `userAnswers` | `user_answer_id` | unique `question_id`; 한 Question의 활성 답변 하나를 upsert |
| `reviewStates` | `review_state_id` | unique `[target_type, target_id]`; 사용자가 상태를 누를 때만 생성 |
| `corrections` | `correction_id` | `user_answer_id`; 개인 오류만 저장 |

답변을 다시 승인하면 같은 Question의 기존 활성 `UserAnswer`를 갱신하고 개인 `Correction`을 현재 변경 항목으로 교체한다. 답변 삭제는 연결된 개인 `Correction`도 함께 삭제한다. `Correction`에는 학습 상태를 저장하지 않는다.

## mock 교정

완전한 성공 결과를 지원하는 입력은 `P4-006`의 다음 중국어 원문 하나와 그 이미 교정된 결과뿐이다.

```text
我喜欢在家运动。工作很忙，没有时间去健身房。在家看视频运动很方便。
```

이미 교정된 문장을 다시 입력하면 변경 0건과 `수정할 부분이 없습니다`를 반환한다. 그 밖의 중국어·한국어·혼합 입력은 원문을 유지한 `unsupported_by_mock` 결과로 처리하며 중국어, 병음, 번역을 임의 생성하지 않는다. 미지원 또는 실패 결과는 `UserAnswer`로 저장할 수 없다.

실제 AI API, 외부 요청, 환경 변수와 API 키는 사용하지 않는다.

## 검증 결과

실행한 주요 명령:

```sh
npm run fixture:part4
npm run fixture:part4
npm run validate:fixtures
python3 -m unittest scripts.tests.test_build_part4_app_fixture -v
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run check
```

현재 결과:

- fixture Python 테스트: 25개 통과
- Vitest: 6개 파일, 40개 테스트 통과
- TypeScript typecheck: 통과
- ESLint: 경고 없이 통과
- Vite production build: 통과
- 같은 fixture 명령 2회 실행 후 JSON SHA-256: 동일
- 320px 실제 브라우저 수직 흐름: 통과
- 브라우저 확인 흐름의 최종 콘솔 오류: 0건

브라우저에서는 HOME → Part 4 → P4-006 → 교정 → 새로고침 세션 복원 → 승인 저장 → 나의 답변 → 복습 상태 선택 → 개인 실수 노트를 확인했다.

## 알려진 제한

- 앱의 공용 데이터는 여전히 raw 개발 fixture 6개이며 검수 완료 데이터가 아니다. 전체 workbook working 데이터는 앱에 연결하지 않았다.
- `ModelAnswer`는 0개다. 화면은 이를 정상적인 `아직 모범답안 없음` 상태로 처리한다.
- 실제 AI, 백엔드, 인증, 서버 동기화와 배포가 없다.
- Part 1·2·3·5·6·7의 실제 문제 화면과 Part 2·7 시각 화면은 구현하지 않았다.
- 자연스럽게와 Level 8 확장 모드는 준비 중이며 비활성화 상태다.
- 마지막 학습 위치, 데이터 내보내기·가져오기, PWA와 오프라인 지원은 없다.
- 개인 데이터는 현재 브라우저와 origin에 종속된다.
- npm audit는 React Router의 사용하지 않는 RSC 모드 관련 high 경고를 보고한다. 현재 앱은 브라우저 Declarative SPA이며 RSC·서버 action을 사용하지 않는다. 패치 릴리스가 제공되면 재검토한다.

## 다음 추천 작업

1. 현재 수직 기능을 여러 실제 모바일 브라우저에서 확인한다.
2. `full-import-v1`의 Question 언어·출처, 시각 연결과 이미지 권리 검수 큐를 처리한다.
3. 승인된 항목만 reviewed canonical JSON으로 승격하고 앱 연결 계약을 별도 검증한다.
4. 실제 AI 후보를 비교하고 비밀키를 보호하는 서버 경계를 별도 결정한다.
5. Part 4 흐름의 사용성 피드백을 반영한 뒤 다음 Part 구현 순서를 정한다.
6. 로그인이나 동기화 전에 개인 데이터 내보내기·복구 요구를 검토한다.
