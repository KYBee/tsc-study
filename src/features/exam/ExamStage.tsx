import type { ExamState } from './examSession'

export function ExamStage({
  state,
  onStart,
}: {
  state: ExamState
  onStart: () => void
}) {
  return (
    <section className="card exam-stage" aria-live="polite">
      {state.phase === 'idle' && (
        <>
          <p>시작할 준비가 되면 버튼을 누르세요.</p>
          <button className="primary-button" type="button" onClick={onStart}>
            문제 시작
          </button>
        </>
      )}
      {state.phase === 'preparing' && (
        <p className="exam-countdown" role="timer">
          준비 <strong>{state.remainingSeconds}</strong>초
        </p>
      )}
      {state.phase === 'playing_question' && (
        <p className="exam-phase-label">질문 음성 재생 중</p>
      )}
      {state.phase === 'answering' && (
        <p className="exam-countdown" role="timer">
          답변 <strong>{state.remainingSeconds}</strong>초
        </p>
      )}
      {state.phase === 'finished' && (
        <p className="exam-phase-label">실전 답변 시간이 끝났습니다.</p>
      )}
    </section>
  )
}
