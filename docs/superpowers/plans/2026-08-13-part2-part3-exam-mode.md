# Part 2·3 실전 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 학습 화면을 유지하면서 Part 2와 Part 3에 음성 질문, 준비·답변 카운트다운, 자기평가를 갖춘 시험형 연습을 추가한다.

**Architecture:** 순수 reducer 기반 상태 머신이 시험 단계와 카운트다운을 관리하고, React hook이 단일 timeout 및 음성 어댑터의 생명주기를 소유한다. Part 2와 Part 3 화면은 동일 엔진에 서로 다른 단계 순서와 시간을 주입한다.

**Tech Stack:** React 19, TypeScript, React Router, Vitest fake timers, Testing Library, Web Speech API

---

## File map

- Create `src/features/exam/examSession.ts`: 상태·이벤트·파트별 설정과 순수 reducer.
- Create `src/features/exam/examSession.test.ts`: 전이와 countdown 단위 테스트.
- Create `src/features/exam/questionSpeech.ts`: SpeechSynthesis 어댑터와 무음 fallback.
- Create `src/features/exam/useExamSession.ts`: timeout·speech cleanup을 소유하는 hook.
- Create `src/features/exam/ExamStage.tsx`: 공통 카운트다운·시작·종료 UI.
- Create `src/features/exam/Part2ExamScreen.tsx`: 세트 Q1~Q4 연속 실전.
- Create `src/features/exam/Part3ExamScreen.tsx`: 단일 Part 3 문제 실전과 다음 문제.
- Create `src/features/exam/ExamScreens.test.tsx`: fake timer 기반 통합 테스트.
- Modify `src/app/router.tsx`: 실전 전용 라우트.
- Modify `src/features/part2/Part2SetScreen.tsx`: Part 2 실전 시작 CTA.
- Modify `src/features/question/QuestionScreen.tsx`: Part 3 실전 시작 CTA.
- Modify `src/styles/components.css`: 모바일 카운트다운 및 상태 스타일.

### Task 1: 순수 상태 머신

- [ ] **Step 1: 실패하는 상태 전이 테스트 작성**

`src/features/exam/examSession.test.ts`에 다음 계약을 작성한다.

```ts
import { describe, expect, it } from 'vitest'
import { createExamState, examReducer, PART2_EXAM_CONFIG, PART3_EXAM_CONFIG } from './examSession'

describe('examReducer', () => {
  it('Part 2는 준비 3초 뒤 질문 재생, 답변 6초 뒤 종료한다', () => {
    let state = examReducer(createExamState(), { type: 'START', config: PART2_EXAM_CONFIG })
    expect(state).toMatchObject({ phase: 'preparing', remainingSeconds: 3 })
    state = examReducer(state, { type: 'TICK' })
    state = examReducer(state, { type: 'TICK' })
    state = examReducer(state, { type: 'TICK' })
    expect(state.phase).toBe('playing_question')
    state = examReducer(state, { type: 'QUESTION_FINISHED' })
    expect(state).toMatchObject({ phase: 'answering', remainingSeconds: 6 })
    for (let index = 0; index < 6; index += 1) state = examReducer(state, { type: 'TICK' })
    expect(state.phase).toBe('finished')
  })

  it('Part 3은 질문 재생 뒤 준비 2초와 답변 15초를 적용한다', () => {
    let state = examReducer(createExamState(), { type: 'START', config: PART3_EXAM_CONFIG })
    expect(state.phase).toBe('playing_question')
    state = examReducer(state, { type: 'QUESTION_FINISHED' })
    expect(state).toMatchObject({ phase: 'preparing', remainingSeconds: 2 })
  })
})
```

- [ ] **Step 2: 테스트가 정의 누락으로 실패하는지 실행**

Run: `npm run test:run -- src/features/exam/examSession.test.ts`
Expected: FAIL because `examSession.ts` does not exist.

- [ ] **Step 3: 최소 상태 머신 구현**

`examSession.ts`에 `ExamPhase`, `ExamConfig`, `ExamState`, `ExamEvent`, 두 config와 reducer를 정의한다. `START`는 config의 `firstPhase`, `QUESTION_FINISHED`는 config의 `afterQuestionPhase`, `TICK`은 0에서 다음 단계로 전이하고 `RESET`은 idle로 돌린다.

```ts
export type ExamPhase = 'idle' | 'preparing' | 'playing_question' | 'answering' | 'finished'
export interface ExamConfig {
  preparationSeconds: number
  answerSeconds: number
  firstPhase: 'preparing' | 'playing_question'
  afterQuestionPhase: 'preparing' | 'answering'
}
export const PART2_EXAM_CONFIG: ExamConfig = {
  preparationSeconds: 3, answerSeconds: 6,
  firstPhase: 'preparing', afterQuestionPhase: 'answering',
}
export const PART3_EXAM_CONFIG: ExamConfig = {
  preparationSeconds: 2, answerSeconds: 15,
  firstPhase: 'playing_question', afterQuestionPhase: 'preparing',
}
```

- [ ] **Step 4: 상태 머신 테스트 통과 확인**

Run: `npm run test:run -- src/features/exam/examSession.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: 커밋**

```sh
git add src/features/exam/examSession.ts src/features/exam/examSession.test.ts
git commit -m "feat: add exam session state machine"
```

### Task 2: 음성 및 timer cleanup hook

- [ ] **Step 1: fake speech와 unmount cleanup 테스트 추가**

`ExamScreens.test.tsx`의 작은 harness에서 `vi.useFakeTimers()`, `play: vi.fn(({onEnd}) => onEnd())`, `cancel: vi.fn()`을 주입한다. unmount 뒤 `vi.advanceTimersByTime(30_000)`을 실행해 phase callback이 추가 호출되지 않고 `cancel`이 한 번 이상 호출되는지 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/features/exam/ExamScreens.test.tsx`
Expected: FAIL because the hook and speech adapter are absent.

- [ ] **Step 3: 어댑터와 hook 구현**

```ts
export interface QuestionSpeechPlayer {
  play(text: string, callbacks: { onEnd: () => void; onError: () => void }): void
  cancel(): void
}

export function createBrowserQuestionSpeechPlayer(): QuestionSpeechPlayer {
  return {
    play(text, callbacks) {
      if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        callbacks.onError(); return
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.voice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase() === 'zh-cn') ?? null
      utterance.onend = callbacks.onEnd
      utterance.onerror = callbacks.onError
      window.speechSynthesis.speak(utterance)
    },
    cancel() { window.speechSynthesis?.cancel() },
  }
}
```

`useExamSession`은 phase가 `preparing` 또는 `answering`일 때만 1초 timeout 하나를 만들고 cleanup에서 clear한다. `playing_question`에서는 session generation을 캡처해 늦게 도착한 callback을 무시하며, 음성 실패도 `QUESTION_FINISHED`로 처리한다. 음성 완료 이벤트가 오지 않는 브라우저를 위해 8초 watchdog timeout을 두고, 만료 시 음성을 cancel한 뒤 다음 단계로 진행한다.

- [ ] **Step 4: hook cleanup 테스트 통과 확인**

Run: `npm run test:run -- src/features/exam/ExamScreens.test.tsx`
Expected: PASS for fallback, 8-second watchdog and unmount cleanup tests.

- [ ] **Step 5: 커밋**

```sh
git add src/features/exam/questionSpeech.ts src/features/exam/useExamSession.ts src/features/exam/ExamScreens.test.tsx
git commit -m "feat: add cleanup-safe exam timing and speech"
```

### Task 3: Part 2 세트 실전 화면

- [ ] **Step 1: 질문 숨김·시간·다음 문제 테스트 작성**

MemoryRouter로 `/parts/2/sets/vs-P2-V01/exam`을 열고 시작 직후 중국어 질문이 보이지 않으며 `준비 3초`가 보이는지, 3초 뒤 fake speech가 질문 원문을 받는지, 질문 완료 후 `답변 6초`, 6초 뒤 원문 공개와 자기평가가 보이는지 검증한다. 평가 후 Q2 표시가 아니라 새 idle 세션으로 이동하는지도 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/features/exam/ExamScreens.test.tsx -t "Part 2"`
Expected: FAIL because the route and screen are absent.

- [ ] **Step 3: 화면과 route 구현**

`Part2ExamScreen`은 repository에서 set, asset, 4 questions를 읽고 currentIndex를 local state로 관리한다. 진행 중 DOM에는 `Part2VisualImage`, phase label, countdown만 둔다. `finished`에만 `LanguageBlock`, `SourceModelAnswerPanel`, 네 recall 결과 버튼을 렌더링하며 기존 repository로 RecallAttempt와 ReviewState를 저장한다.

`router.tsx`에 다음 route를 추가한다.

```tsx
<Route path="/parts/2/sets/:visualSetId/exam" element={<Part2ExamScreen />} />
```

`Part2SetScreen`에 하나의 명확한 CTA를 추가한다.

```tsx
<Link className="primary-button" to={`/parts/2/sets/${visualSetId}/exam`}>
  4문제 실전 연습
</Link>
```

- [ ] **Step 4: Part 2 테스트 통과 확인**

Run: `npm run test:run -- src/features/exam/ExamScreens.test.tsx -t "Part 2"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```sh
git add src/features/exam/Part2ExamScreen.tsx src/features/exam/ExamStage.tsx src/features/exam/ExamScreens.test.tsx src/app/router.tsx src/features/part2/Part2SetScreen.tsx src/styles/components.css
git commit -m "feat: add Part 2 exam practice"
```

### Task 4: Part 3 실전 화면

- [ ] **Step 1: Part 3 fake timer 테스트 작성**

시작 시 질문 원문이 없고 fake speech가 한 번 호출되는지, speech 완료 뒤 `준비 2초`, 2초 뒤 `답변 15초`, 15초 뒤 finished와 질문 원문 공개가 되는지 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/features/exam/ExamScreens.test.tsx -t "Part 3"`
Expected: FAIL because `Part3ExamScreen` is absent.

- [ ] **Step 3: Part 3 route와 화면 구현**

```tsx
<Route path="/questions/:questionId/exam" element={<Part3ExamScreen />} />
```

`Part3ExamScreen`은 part가 3인지 검증하고 repository 안정 순서의 다음 질문을 찾는다. finished에서 기존 recall mapping을 저장하고 다음 문제 링크를 제공한다. `QuestionScreen`은 `question.part === 3`일 때만 `실전 모드` CTA를 노출한다.

- [ ] **Step 4: Part 3 테스트와 전체 실전 테스트 통과 확인**

Run: `npm run test:run -- src/features/exam/ExamScreens.test.tsx`
Expected: PASS.

- [ ] **Step 5: 접근성·모바일 스타일 추가 후 lint/typecheck 실행**

카운트다운은 `role="timer"`, phase 전환은 `aria-live="polite"`, 시작·평가 버튼은 44px 이상 터치 영역을 사용한다.

Run: `npm run typecheck && npm run lint`
Expected: both PASS.

- [ ] **Step 6: 커밋**

```sh
git add src/features/exam/Part3ExamScreen.tsx src/features/exam/ExamScreens.test.tsx src/features/question/QuestionScreen.tsx src/app/router.tsx src/styles/components.css
git commit -m "feat: add Part 3 exam practice"
```
