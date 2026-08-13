import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import type {
  ModelAnswer,
  RecallResult,
  VisualAsset,
  VisualQuestion,
  VisualSet,
} from '../../domain/entities'
import { mapRecallResultToReviewStatus } from '../answer/part4AnswerDraft'
import { Part2VisualImage } from '../part2/Part2VisualImage'
import { SourceModelAnswerPanel } from '../part2/SourceModelAnswerPanel'
import { ExamStage } from './ExamStage'
import { PART2_EXAM_CONFIG } from './examSession'
import { createBrowserQuestionSpeechPlayer } from './questionSpeech'
import { useExamSession } from './useExamSession'

const RECALL_RESULTS: Array<{ value: RecallResult; label: string }> = [
  { value: 'could_not_say', label: '못 말함' },
  { value: 'used_keywords', label: '어느 정도 말함' },
  { value: 'almost', label: '거의 말함' },
  { value: 'memorized', label: '외워서 말함' },
]

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

interface Part2ExamData {
  visualSet: VisualSet
  asset?: VisualAsset
  questions: VisualQuestion[]
  answersByQuestionId: Map<string, ModelAnswer[]>
}

export function Part2ExamScreen() {
  const { visualSetId = '' } = useParams()
  const { publicRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async (): Promise<Part2ExamData | undefined> => {
    const visualSet = await publicRepository.getVisualSetById(visualSetId)
    if (!visualSet || visualSet.part !== 2) return undefined
    const [assets, questions] = await Promise.all([
      publicRepository.listVisualAssetsBySetId(visualSetId),
      publicRepository.listVisualQuestionsBySetId(visualSetId),
    ])
    const answerEntries = await Promise.all(
      questions.map(async (question) => [
        question.visual_question_id,
        await publicRepository.listModelAnswersByVisualQuestionId(
          question.visual_question_id,
        ),
      ] as const),
    )
    return {
      visualSet,
      asset: assets[0],
      questions,
      answersByQuestionId: new Map(answerEntries),
    }
  }, [publicRepository, visualSetId])

  if (loading) return <LoadingState message="Part 2 실전 문제를 준비하는 중입니다" />
  if (error || !data || data.questions.length !== 4) {
    return <ErrorState title="Part 2 실전 세트를 열 수 없습니다" message={visualSetId} />
  }
  return <Part2ExamContent key={visualSetId} data={data} />
}

function Part2ExamContent({ data }: { data: Part2ExamData }) {
  const { userRepository, questionSpeechPlayer } = useAppDependencies()
  const [questionIndex, setQuestionIndex] = useState(0)
  const [message, setMessage] = useState('')
  const speechPlayer = useMemo(
    () => questionSpeechPlayer ?? createBrowserQuestionSpeechPlayer(),
    [questionSpeechPlayer],
  )
  const question = data.questions[questionIndex]
  const exam = useExamSession({
    config: PART2_EXAM_CONFIG,
    questionText: question.question_zh ?? '',
    speechPlayer,
  })
  const number = setNumber(data.visualSet.visual_set_id)

  const recordRecall = async (result: RecallResult) => {
    const timestamp = new Date().toISOString()
    await userRepository.addRecallAttempt({
      recall_attempt_id: `ra-exam-${question.visual_question_id}-${timestamp}`,
      question_id: question.visual_question_id,
      target_type: 'visual_question',
      target_id: question.visual_question_id,
      recall_mode: 'visual_question',
      result,
      attempted_at: timestamp,
    })
    await userRepository.upsertReviewState({
      review_state_id: `rs-visual-question-${question.visual_question_id}`,
      target_type: 'visual_question',
      target_id: question.visual_question_id,
      learning_status: mapRecallResultToReviewStatus(result),
      last_reviewed_at: timestamp,
    })
    setMessage('회상 결과와 복습 상태를 저장했습니다')
  }

  const moveNext = () => {
    exam.reset()
    setMessage('')
    setQuestionIndex((current) => current + 1)
  }

  return (
    <div className="page exam-page">
      <header className="page-header">
        <Link className="back-link" to={`/parts/2/sets/${data.visualSet.visual_set_id}`}>
          ← 그림 세트로 돌아가기
        </Link>
        <p className="eyebrow">PART 2 · 그림 세트 {number}</p>
        <h1>Part 2 실전 모드</h1>
        <p>질문 {questionIndex + 1} / {data.questions.length}</p>
      </header>
      <aside className="notice">
        진행 중에는 그림만 보고 답합니다. 질문·병음·한국어·추천 답변은 종료 후 확인할 수 있습니다.
      </aside>
      <section className="card visual-set-main">
        <Part2VisualImage asset={data.asset} setNumber={number} expandable />
      </section>
      <ExamStage state={exam.state} onStart={exam.start} />

      {exam.state.phase === 'finished' && (
        <>
          <section className="card">
            <h2>문제 확인</h2>
            <LanguageBlock
              label={`질문 ${question.item_number}`}
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
          <SourceModelAnswerPanel
            answers={data.answersByQuestionId.get(question.visual_question_id) ?? []}
          />
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
            {questionIndex < data.questions.length - 1 ? (
              <button className="primary-button" type="button" onClick={moveNext}>
                다음 문제
              </button>
            ) : (
              <Link className="primary-button" to={`/parts/2/sets/${data.visualSet.visual_set_id}`}>
                세트 연습 완료
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
