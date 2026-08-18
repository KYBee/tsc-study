# TSC 실전 모드·AI 교정·시각 자료 정합성 설계

## 목적

현재 학습 모드를 유지하면서 Part 2와 Part 3에 시험형 연습을 추가하고, 기존 `CorrectionProvider` 계약을 실제 HTTPS 교정 endpoint까지 확장한다. 동시에 Part 2의 12개 그림과 Part 7의 48개 스토리 그림을 원본 질문·답변·StoryGuide에 대조하여, 학습에 방해가 되는 의미·품질·연속성 문제만 수정한다.

이번 변경은 복습 알고리즘, 홈 CTA 개편, 데이터 상태 UI 정리, 로그인·동기화·별도 백엔드 구축을 포함하지 않는다.

## 현재 구조와 보존 경계

- 기존 학습 화면과 PracticeDraft, UserAnswer, Correction, ReviewState, RecallAttempt 저장 의미를 유지한다.
- Part 2는 VisualSet 12개, VisualQuestion 48개, 원본 추천 ModelAnswer 48개를 유지한다.
- Part 7은 VisualSet 12개와 StoryGuide 12개를 중심으로 사용하며 StoryGuide를 ModelAnswer로 변환하지 않는다.
- 이미지의 `rights_status=review_needed`, `public_allowed=false`를 유지한다.
- 이미지 공개는 기존 production opt-in 경계를 유지하며 이번 작업에서 권리를 승인하지 않는다.
- 질문·추천답·StoryGuide를 새 그림에 맞추기 위해 임의 변경하지 않는다. 원본 콘텐츠 오류가 발견되면 별도 문제로 보고한다.

## 1. 공통 실전 진행 엔진

### 상태 머신

공통 상태는 다음 다섯 단계로 정의한다.

1. `idle`: 시작 전
2. `preparing`: 준비 카운트다운
3. `playing_question`: 중국어 질문 음성 재생 요청
4. `answering`: 답변 카운트다운
5. `finished`: 종료 후 원문·도움말·자기평가 공개

상태 전이는 이벤트 기반 reducer와 단일 scheduler로 관리한다. 타이머 ID와 SpeechSynthesis 발화를 한 곳에서 소유하고 다음 경우 모두 정리한다.

- 화면 unmount
- 문제 변경
- 세션 재시작
- 다음 문제 이동
- 사용자의 명시적 중단

음성 완료 이벤트가 오지 않거나 SpeechSynthesis가 없는 환경에서도 정해진 fallback을 통해 답변 단계로 진행한다. 이전 문제의 타이머나 음성이 다음 문제에 남지 않게 generation/session token으로 늦게 도착한 이벤트를 무시한다.

### 음성 어댑터

브라우저 API를 직접 화면에서 호출하지 않고 `QuestionSpeechPlayer` 인터페이스 뒤에 둔다.

- 가능한 경우 `speechSynthesis.getVoices()`에서 `zh-CN`을 우선 선택한다.
- 음성 API 미지원, voice 부재, `speak` 실패는 시험 흐름을 중단하지 않는다.
- 기본 실전에서는 한 번만 재생한다.
- 종료 후 연습용 다시 듣기만 제공한다.
- 테스트는 fake speech player를 사용해 시간과 완료 이벤트를 제어한다.

### Part 2

전이 순서는 `idle → preparing(3초) → playing_question → answering(6초) → finished`이다.

- 진행 중에는 그림과 카운트다운만 보여준다.
- 중국어 질문·병음·한국어·원본 추천 답변을 숨긴다.
- 종료 후에만 숨겨진 내용을 열 수 있다.
- 한 VisualSet의 Q1~Q4를 원본 안정 순서로 연속 진행한다.
- 각 문제 종료 후 자기평가를 저장하고 다음 문제로 이동한다.
- 기존 RecallAttempt 결과와 ReviewState 매핑을 재사용한다.

라우트는 기존 Part 2 세트 경로에 `/exam`을 추가한다.

### Part 3

전이 순서는 `idle → playing_question → preparing(2초) → answering(15초) → finished`이다.

- 진행 중에는 질문 중국어·병음·한국어를 모두 숨긴다.
- 종료 후 원문을 공개하고 기존 회상 결과를 저장한다.
- 다음 canonical question_id로 이동할 수 있다.
- 기존 학습 상세 화면은 그대로 유지한다.

Part 3 문제 경로에는 시험형 전용 하위 경로를 추가한다.

## 2. 실제 AI 교정 연결

### Provider 선택

기존 `CorrectionProvider`와 discriminated union 결과 계약을 유지한다.

- `VITE_TSC_CORRECTION_API_URL`이 설정된 경우 `HttpCorrectionProvider`를 사용한다.
- URL이 없으면 기존 `MockCorrectionProvider`를 사용한다.
- 브라우저 번들에 API 키를 넣지 않는다.
- `VITE_*` 환경변수는 공개 정보이므로 endpoint URL 외의 비밀값을 두지 않는다.
- 인증이 필요하면 운영 endpoint가 same-origin 세션 또는 서버 측 secret으로 처리한다.

### Endpoint 계약

클라이언트는 기존 `CorrectionRequest`에 질문 target, part, 원문, 감지된 입력 언어, 최소 교정 모드를 담아 JSON POST로 전송한다. 성공 응답은 기존 `CorrectionResult` 형식을 따른다.

- `corrected_zh`
- 전체 `pinyin`
- 전체 `ko`
- 실제 수정 `changes`
- 답변 구조 `structure_segments`
- 관련성·불확실성 메모
- 재사용 가능한 핵심 표현(계약에 additive하게 포함 가능한 경우)

응답은 Zod로 검증한다. HTTP 오류, timeout, 잘못된 JSON, schema 불일치는 `failure`로 변환하고 개발자 로그에는 진단 정보를 남기되 화면에는 스택을 노출하지 않는다.

### 입력별 지시와 UX

- 한국어: 의미와 개인 경험을 보존한 짧고 말하기 쉬운 중국어, 병음, 한국어 뜻, 핵심 표현을 요청한다.
- 중국어: 최소 교정, 병음, 한국어 뜻, 변경 이유를 요청한다.
- 혼합: 의도를 보존해 자연스러운 구어체 중국어로 정리하도록 요청한다.

Part 1·3·5·6의 자유 입력 완료 화면에 `교정 후 암기`를 기본 CTA로 제공한다. `교정 없이 암기`는 보조 행동으로 남긴다. Part 4의 기존 교정 세션·결과·사용자 승인 저장 흐름을 공통 화면으로 재사용한다.

교정 실패 시 PracticeDraft와 입력 원문을 유지하고 `재시도`와 `답변 수정`을 제공한다. success 결과도 사용자가 승인하기 전에는 UserAnswer나 Correction으로 저장하지 않는다.

Part 2와 Part 7은 현재 개인 target 구조를 깨지 않도록 provider 호출 가능한 연결점만 공통화하되, 이번 변경에서 별도 대규모 답변 화면 재구성은 하지 않는다.

## 3. Part 2 이미지 전수검사와 수정

### 감사 기준

각 VisualSet에 대해 Q1~Q4별로 다음 표를 작성한다.

- 질문 원문
- 추천 답변 원문
- 그림에서 판별해야 하는 사람·행동·위치·수량·시간·가격·비교 정보
- 실제 그림에서의 판별 가능 여부
- 수정 필요 여부와 이유

질문과 추천답은 변경하지 않는다. 그림만으로 답을 판별하기 어렵거나, 수량·숫자·위치가 모호하거나, 기존 538×444 이미지의 품질과 스타일이 학습을 방해하는 경우 수정 대상으로 삼는다.

### 이미지 방향

- 기준 해상도와 비율은 개선된 Set 1·8·11·12의 1448×1086을 우선한다.
- 단순 확대는 하지 않는다.
- 필요한 이미지는 semi-realistic educational illustration로 새로 생성한다.
- 한눈에 사람·행동·위치·수량·숫자를 구분할 수 있게 하고 불필요한 배경 요소를 제한한다.
- 기존 의미가 분명한 고해상도 자산은 유지한다.

수정한 PNG는 기존 파일명과 asset 연결을 유지하고 importer로 file size, SHA-256, width, height, manifest, fixture metadata를 재생성한다.

## 4. Part 7 이미지·StoryGuide 전수검사와 수정

### 감사 기준

각 세트의 4장을 다음 관점으로 검사한다.

- 1장 사건 시작, 2장 전개, 3장 문제·반전, 4장 결과가 명확한가
- 동일 인물의 성별·옷·외형이 연속되는가
- 물건과 행동이 갑자기 생기거나 사라지지 않는가
- 그림만으로 원인과 결과를 합리적으로 추론할 수 있는가
- StoryGuide와 그림 설명·실제 이미지가 충돌하지 않는가

우선순위는 의미 오류, 사건 연결 불가, 인물·행동 식별 실패, 품질·스타일 문제 순이다. 48장을 일괄 재생성하지 않고 실제 실패 장면만 수정한다.

### V03

StoryGuide와 source locator를 먼저 확인한다. 원본 이야기 흐름이 수박 실종과 강아지 범인으로 일관되고 첫 장면의 귤 상자가 파생 이미지 설명에서만 추가된 것이라면, 첫 장면을 수박의 존재와 이웃 방문이 자연스럽게 보이도록 수정한다. 반대로 원본 근거 자체가 충돌하면 콘텐츠를 임의 수정하지 않고 충돌로 보고한다.

### 데이터 처리

- StoryGuide를 ModelAnswer로 만들지 않는다.
- QuestionVisualSet 후보를 승인하지 않는다.
- 수정 PNG의 기존 asset ID·파일명을 유지한다.
- named visual importer로 metadata와 Part 7 fixture를 재생성한다.
- provenance는 실제 새 바이트를 반영하며 과거 archive에서 byte-preserved되었다는 거짓 기록을 남기지 않는다.

## 5. 오류 처리와 안전 경계

- 화면 이동 시 타이머·음성 cleanup 실패는 테스트 실패로 처리한다.
- 실제 AI endpoint 오류는 원문 손실 없이 복구한다.
- 브라우저에 secret을 포함하지 않는다.
- 이미지 importer의 allowlist, SHA, 크기, PNG 검증을 완화하지 않는다.
- `data/working` 전체를 공개하지 않고 기존 opt-in production image pipeline만 사용한다.
- 권리 metadata를 변경하지 않는다.

## 6. 테스트와 검증

### 단위·컴포넌트 테스트

- Part 2: 질문 숨김, 3초 준비, 음성 단계, 6초 답변, 종료, 다음 문제, unmount cleanup
- Part 3: 질문 숨김, 음성 단계, 2초 준비, 15초 답변, 종료
- SpeechSynthesis 미지원 fallback
- HTTP correction success, failure, timeout/schema failure, retry, 원문 보존, 사용자 승인 전 미저장
- 기존 P4-006 mock 회귀
- Part 2 asset 12개와 Part 7 asset 48개 mapping·manifest integrity

### 데이터·빌드 검증

- named visual asset import/validation
- Part 2·7 fixture 재생성·검증
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run check:data`
- 가능한 경우 저장소의 전체 `npm run check`

이미지 감사 결과는 세트별 OK/수정/근거를 문서에 남겨 이후 사람이 재검수할 수 있게 한다.

## 완료 판단

기존 학습 모드가 유지되고, Part 2·3 실전 흐름이 타이머와 음성 fallback을 포함해 동작하며, 환경변수 endpoint가 설정된 경우 교정 요청을 실제로 보낼 수 있어야 한다. Part 2와 Part 7은 모든 세트가 질문·답 또는 StoryGuide에 대조되어야 하며, 발견된 실제 의미·연속성 오류는 데이터 provenance를 해치지 않는 범위에서 자산과 metadata까지 갱신되어야 한다.
