# 실제 AI 교정 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 CorrectionProvider 계약을 유지하면서 설정된 HTTPS endpoint를 실제 호출하고 Part 1·3·5·6의 답변 완료 흐름에서 교정 후 암기를 기본 행동으로 제공한다.

**Architecture:** `HttpCorrectionProvider`가 fetch와 Zod 응답 검증을 담당하고 factory가 endpoint 유무에 따라 HTTP 또는 기존 mock을 선택한다. 공통 correction session과 result screen을 Part 1·3·4·5·6으로 확장하되 사용자 승인 전 저장 금지와 원문 보존을 유지한다.

**Tech Stack:** TypeScript, Fetch API, Zod, React, sessionStorage, Vitest, Testing Library

---

## File map

- Create `src/providers/HttpCorrectionProvider.ts`: timeout·HTTP·schema validation.
- Create `src/providers/HttpCorrectionProvider.test.ts`: success/failure/schema/timeout tests.
- Create `src/providers/createCorrectionProvider.ts`: env 기반 provider 선택.
- Create `src/providers/createCorrectionProvider.test.ts`: endpoint 유무 회귀.
- Modify `src/domain/correction.ts`: endpoint에 필요한 additive `key_expressions?: string[]`.
- Modify `src/features/answer/correctionSession.ts`: text fixture dataset을 허용하는 session v2 migration.
- Modify `src/features/answer/correctionSession.test.ts`: v1 호환과 v2 저장.
- Modify `src/features/answer/GenericAnswerEditorContent.tsx`: 교정 요청·기본 CTA·원문 보존.
- Modify `src/features/answer/AnswerEditorScreen.tsx`: provider 전달.
- Modify `src/features/correction/CorrectionResultScreen.tsx`: Part 제한 제거와 원문 섹션.
- Modify `src/app/App.tsx`: provider factory 사용.
- Modify `.env.example`, `README.md`, `docs/AI_CORRECTION_RULES.md`, `docs/DECISIONS.md`: endpoint 계약과 secret 경계.
- Modify `src/app/App.integration.test.tsx`: generic correction success/failure/retry.

### Task 1: HTTP provider 계약

- [ ] **Step 1: success와 failure 테스트 작성**

```ts
it('valid success response를 기존 provider result로 반환한다', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(validSuccess), { status: 200 }))
  const provider = new HttpCorrectionProvider({ endpoint: 'https://example.test/correct', fetcher })
  await expect(provider.correct(request)).resolves.toEqual(validSuccess)
  expect(fetcher).toHaveBeenCalledWith('https://example.test/correct', expect.objectContaining({ method: 'POST' }))
})

it('HTTP 실패에서도 original_input을 보존한다', async () => {
  const provider = new HttpCorrectionProvider({
    endpoint: 'https://example.test/correct',
    fetcher: vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })),
  })
  await expect(provider.correct(request)).resolves.toMatchObject({
    status: 'failure', original_input: request.original_input, error_code: 'http_503',
  })
})
```

잘못된 JSON, schema mismatch, network reject, timeout에서도 `failure.original_input`이 동일함을 추가한다.

또한 중국어 입력 `我周末两个次运动。`에 대한 synthetic endpoint 응답이 `我一般周末运动两次。`, 전체 병음, 한국어 뜻, `两个次 → 两次` 변경을 손실 없이 통과시키는 계약 테스트를 추가한다. 이 테스트는 클라이언트가 답을 생성하는 것이 아니라 서버 응답 계약을 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/providers/HttpCorrectionProvider.test.ts`
Expected: FAIL because the provider does not exist.

- [ ] **Step 3: provider 구현**

`HttpCorrectionProvider` 생성자는 `endpoint`, optional `fetcher`, `timeoutMs=15000`을 받는다. endpoint는 `https:` 또는 same-origin relative URL만 허용한다. POST body는 `CorrectionRequest` JSON이고 `credentials: 'same-origin'`, `Content-Type: application/json`을 사용한다. AbortController timeout을 clear하고 모든 오류를 discriminated `failure`로 변환한다.

Zod schema는 `success` 응답의 `corrected_zh`, `pinyin`, `ko`를 `min(1)`, changes·segments·uncertainties의 최대 개수와 문자열 최대 길이를 제한한다.

- [ ] **Step 4: provider 테스트 통과 확인**

Run: `npm run test:run -- src/providers/HttpCorrectionProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```sh
git add src/providers/HttpCorrectionProvider.ts src/providers/HttpCorrectionProvider.test.ts src/domain/correction.ts
git commit -m "feat: add validated HTTP correction provider"
```

### Task 2: 안전한 provider 선택

- [ ] **Step 1: factory 실패 테스트 작성**

```ts
expect(createCorrectionProvider({})).toBeInstanceOf(MockCorrectionProvider)
expect(createCorrectionProvider({ VITE_TSC_CORRECTION_API_URL: '/api/tsc-correction' })).toBeInstanceOf(HttpCorrectionProvider)
expect(() => createCorrectionProvider({ VITE_TSC_CORRECTION_API_URL: 'javascript:alert(1)' })).toThrow()
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/providers/createCorrectionProvider.test.ts`
Expected: FAIL because the factory is absent.

- [ ] **Step 3: factory와 App 연결 구현**

`createCorrectionProvider(env)`는 공백을 trim하고 endpoint가 없으면 mock, 있으면 HTTP provider를 반환한다. `App.tsx`의 `new MockCorrectionProvider()`를 `createCorrectionProvider(import.meta.env)`로 교체한다.

- [ ] **Step 4: 테스트·typecheck 통과 확인**

Run: `npm run test:run -- src/providers/createCorrectionProvider.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: 커밋**

```sh
git add src/providers/createCorrectionProvider.ts src/providers/createCorrectionProvider.test.ts src/app/App.tsx
git commit -m "feat: select correction provider from environment"
```

### Task 3: generic answer 교정 세션

- [ ] **Step 1: Part 3 완료 답변의 교정 요청 테스트 작성**

App integration test에서 Part 3 draft를 완료하고 `교정 후 암기`를 누른다. injected provider가 `question_id`, `part=3`, 입력 언어, 원문, `minimal`을 받고 결과 route가 원문과 교정 결과를 모두 표시하는지 검증한다. provider가 failure를 반환한 경우 원문과 `재시도`가 남고, retry success 뒤 결과가 바뀌는지도 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/app/App.integration.test.tsx -t "교정 후 암기"`
Expected: FAIL because generic answers do not call the provider.

- [ ] **Step 3: session v2와 generic CTA 구현**

correction session v2는 특정 Part 4 dataset literal 대신 `dataset_id` 문자열과 `target_type: 'question'`, `part`를 저장한다. loader는 기존 v1 세션을 읽어 v2 메모리 형태로 변환한다.

`GenericAnswerEditorContent`에 `correctionProvider`를 전달하고 complete 단계에 다음 행동을 둔다.

```tsx
<button className="primary-button" disabled={correcting} onClick={() => void requestCorrection()}>
  교정 후 암기
</button>
<button className="secondary-button" onClick={() => moveTo('recall')}>
  교정 없이 암기
</button>
```

`requestCorrection`은 현재 draft 원문으로 session을 먼저 저장한 다음 provider를 호출해 결과를 갱신하고 `/questions/:id/correction`으로 이동한다. 예외여도 failure result와 원문을 저장한다.

- [ ] **Step 4: CorrectionResultScreen 일반화**

question part 제한을 `[1,3,4,5,6]`으로 바꾸고 상단에 `내가 입력한 답변` 섹션을 추가한다. save는 success 및 세 언어 완전성 조건을 유지한다. failure의 retry는 session 원문을 그대로 다시 보낸다.

- [ ] **Step 5: generic 교정 통합 테스트 통과 확인**

Run: `npm run test:run -- src/app/App.integration.test.tsx src/features/answer/correctionSession.test.ts`
Expected: PASS, including success/failure/retry/original preservation.

- [ ] **Step 6: 기존 P4 mock 회귀 확인**

Run: `npm run test:run -- src/providers/MockCorrectionProvider.test.ts src/app/App.integration.test.tsx -t "P4-006|교정"`
Expected: PASS.

- [ ] **Step 7: 커밋**

```sh
git add src/features/answer/GenericAnswerEditorContent.tsx src/features/answer/AnswerEditorScreen.tsx src/features/answer/correctionSession.ts src/features/answer/correctionSession.test.ts src/features/correction/CorrectionResultScreen.tsx src/app/App.integration.test.tsx
git commit -m "feat: make correction the default memorization flow"
```

### Task 4: 환경변수와 운영 계약 문서화

- [ ] **Step 1: `.env.example`에 공개 endpoint만 추가**

```dotenv
VITE_TSC_CORRECTION_API_URL=
```

주석으로 API 키나 provider secret을 이 파일과 `VITE_*`에 넣지 말라고 명시한다.

- [ ] **Step 2: endpoint request/response와 fallback 문서화**

README와 AI 규칙 문서에 endpoint 미설정 시 기존 P4-006 mock만 지원, 설정 시 validated HTTPS 호출, 장애 시 원문 보존을 기록한다. 별도 백엔드는 저장소에 추가하지 않았음을 명시한다.

- [ ] **Step 3: lint/typecheck/build 실행**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 4: 커밋**

```sh
git add .env.example README.md docs/AI_CORRECTION_RULES.md docs/DECISIONS.md
git commit -m "docs: document correction endpoint contract"
```
