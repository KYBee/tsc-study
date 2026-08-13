import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import type { Question, RecallResult } from '../../domain/entities'
import { mapRecallResultToReviewStatus } from '../answer/part4AnswerDraft'
import { ExamStage } from './ExamStage'
import { PART3_EXAM_CONFIG } from './examSession'
import { createBrowserQuestionSpeechPlayer } from './questionSpeech'
import { useExamSession } from './useExamSession'

const RECALL_RESULTS: Array<{ value: RecallResult; label: string }> = [
  { value: 'could_not_say', label: '못 말함' },
  { value: 'used_keywords', label: '어느 정도 말함' },
  { value: 'almost', label: '거의 말함' },
  { value: 'memorized', label: '외워서 말함' },
]

export function Part3ExamScreen() {
  const { questionId = '' } = useParams()
  const { publicRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const question = await publicRepository.getQuestionById(questionId)
    if (!question || question.part !== 3) return undefined
    const questions = await publicRepository.listQuestionsByPart(3)
    return { question, questions }
  }, [publicRepository, questionId])

  if (loading) return <LoadingState message="Part 3 실전 문제를 준비하는 중입니다" />
  if (error || !data) {
    return <ErrorState title="Part 3 실전 문제를 찾을 수 없습니다" message={questionId} />
  }
  return <Part3ExamContent key={questionId} {...data} />
}

function Part3ExamContent({
  question,
  questions,
}: {
  question: Question
  questions: Question[]
}) {
  const { userRepository, questionSpeechPlayer } = useAppDependencies()
  const [message, setMessage] = useState('')
  const speechPlayer = useMemo(
    () => questionSpeechPlayer ?? createBrowserQuestionSpeechPlayer(),
    [questionSpeechPlayer],
  )
  const exam = useExamSession({
    config: PART3_EXAM_CONFIG,
    questionText: question.question_zh,
    speechPlayer,
  })
  const questionIndex = questions.findIndex((item) => item.question_id === question.question_id)
  const nextQuestion = questions[questionIndex + 1]

  const recordRecall = async (result: RecallResult) => {
    const timestamp = new Date().toISOString()
    await userRepository.addRecallAttempt({
      recall_attempt_id: `ra-exam-${question.question_id}-${timestamp}`,
      question_id: question.question_id,
      target_type: 'question',
      target_id: question.question_id,
      recall_mode: 'question_only',
      result,
      attempted_at: timestamp,
    })
    await userRepository.upsertReviewState({
      review_state_id: `rs-question-${question.question_id}`,
      target_type: 'question',
      target_id: question.question_id,
      learning_status: mapRecallResultToReviewStatus(result),
      last_reviewed_at: timestamp,
    })
    setMessage('회상 결과와 복습 상태를 저장했습니다')
  }

  return (
    <div className="page exam-page">
      <header className="page-header">
        <Link className="back-link" to={`/questions/${question.question_id}`}>
          ← 학습 문제로 돌아가기
        </Link>
        <p className="eyebrow">PART 3 · {question.question_id}</p>
        <h1>Part 3 실전 모드</h1>
        <p>질문 음성을 듣고 준비 2초 뒤 15초 동안 답합니다.</p>
      </header>
      <aside className="notice">
        실전 진행 중에는 질문 중국어·병음·한국어를 표시하지 않습니다.
      </aside>
      <ExamStage state={exam.state} onStart={exam.start} />

      {exam.state.phase === 'finished' && (
        <>
          <section className="card">
            <h2>문제 확인</h2>
            <LanguageBlock
              label="Part 3 질문"
              language={{
                zh: question.question_zh,
                pinyin: question.question_pinyin,
                ko: question.question_ko,
              }}
            />
            <button className="secondary-button" type="button" onClick={exam.replayQuestion}>
              연습용으로 질문 다시 듣기
            </button>
          </section>
          <section className="card">
            <h2>스스로 말하기 결과</h2>
            <div className="status-button-group">
              {RECALL_RESULTS.map((result) => (
                <button key={result.value} type="button" onClick={() => void recordRecall(result.value)}>
                  {result.label}
                </button>
              ))}
            </div>
          </section>
          {message && <p className="success-message" role="status">{message}</p>}
          <div className="button-row sticky-action">
            {nextQuestion && (
              <Link className="primary-button" to={`/questions/${nextQuestion.question_id}/exam`}>
                다음 문제
              </Link>
            )}
            <button className="secondary-button" type="button" onClick={exam.start}>
              같은 문제 다시 하기
            </button>
          </div>
        </>
      )}
    </div>
  )
}
