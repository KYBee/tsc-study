import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import {
  createNavigationContext,
  getSafeReturnPath,
} from '../../app/navigationContext'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import type { PersonalCorrectionInput, UserAnswerInput } from '../../data/userDataRepository'
import {
  clearCorrectionSession,
  loadCorrectionSession,
  saveCorrectionSession,
  type CorrectionSession,
} from '../answer/correctionSession'

export function CorrectionResultScreen() {
  const { questionId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = getSafeReturnPath(location.state)
  const navigationState = createNavigationContext(returnTo)
  const { publicRepository, userRepository, correctionProvider } =
    useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const question = await publicRepository.getQuestionById(questionId)
    return {
      question:
        question && question.part === 4 ? question : undefined,
      session: loadCorrectionSession(questionId),
    }
  }, [publicRepository, questionId])
  const [sessionOverride, setSessionOverride] = useState<
    { questionId: string; session: CorrectionSession } | undefined
  >()
  const [saving, setSaving] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [saveError, setSaveError] = useState('')

  if (loading) {
    return <LoadingState message="교정 결과를 불러오는 중입니다" />
  }
  if (error || !data?.question) {
    return (
      <div className="page">
        <ErrorState
          title={error ? '교정 결과를 불러오지 못했습니다' : '문제를 찾을 수 없습니다'}
          action={
            <Link className="primary-button" to="/parts/4">
              Part 4로 돌아가기
            </Link>
          }
        />
      </div>
    )
  }

  const session =
    sessionOverride?.questionId === questionId
      ? sessionOverride.session
      : data.session
  const { question } = data
  if (!session || !session.provider_result) {
    return (
      <div className="page">
        <ErrorState
          title="교정 세션을 찾을 수 없습니다"
          message="저장 전 교정 결과는 질문별 임시 세션으로만 보관됩니다."
          action={
            <Link
              className="primary-button"
              to={`/questions/${question.question_id}/answer`}
              state={navigationState}
            >
              답변 다시 작성
            </Link>
          }
        />
      </div>
    )
  }

  const providerResult = session.provider_result
  const completeSuccess =
    providerResult.status === 'success' &&
    Boolean(
      providerResult.result.corrected_zh &&
        providerResult.result.pinyin &&
        providerResult.result.ko,
    )

  const handleSave = async () => {
    if (!completeSuccess || providerResult.status !== 'success' || saving) {
      return
    }
    setSaving(true)
    setSaveError('')
    const userAnswerId = `ua-${question.question_id}`
    const answer: UserAnswerInput = {
      user_answer_id: userAnswerId,
      question_id: question.question_id,
      input_language: session.input_language,
      original_input: session.original_input,
      corrected_zh: providerResult.result.corrected_zh,
      corrected_pinyin: providerResult.result.pinyin,
      corrected_ko: providerResult.result.ko,
      correction_mode: session.correction_mode,
      change_summary: providerResult.result.changes.map((change) => ({
        ...change,
      })),
      structure_segments: providerResult.result.structure_segments.map(
        (segment) => ({ ...segment }),
      ),
      save_status: 'user_approved',
    }
    const corrections: PersonalCorrectionInput[] =
      providerResult.result.changes.map((change, index) => ({
        correction_id: `c-${userAnswerId}-${String(index + 1).padStart(3, '0')}`,
        wrong_zh: change.before,
        correct_zh: change.after,
        error_type: '개인 교정',
        reason: change.reason,
        source_kind: 'user_answer',
        data_scope: 'personal',
        correction_status: 'review_needed',
      }))

    try {
      await userRepository.saveApprovedAnswer(answer, corrections)
      clearCorrectionSession(question.question_id)
      navigate('/my-answers')
    } catch (cause: unknown) {
      console.error(cause)
      setSaveError('답변을 저장하지 못했습니다. 결과를 유지한 채 다시 시도해 주세요.')
      setSaving(false)
    }
  }

  const handleRetry = async () => {
    if (retrying) {
      return
    }
    setRetrying(true)
    try {
      const nextResult = await correctionProvider.correct({
        question_id: question.question_id,
        part: question.part,
        question_zh: question.question_zh,
        input_language: session.input_language,
        original_input: session.original_input,
        correction_mode: session.correction_mode,
      })
      const updated = { ...session, provider_result: nextResult }
      saveCorrectionSession(updated)
      setSessionOverride({ questionId, session: updated })
    } catch (cause: unknown) {
      console.error(cause)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link
          className="back-link"
          to={`/questions/${question.question_id}/answer`}
          state={navigationState}
        >
          ← 다시 쓰기
        </Link>
        <p className="eyebrow">{question.question_id}</p>
        <h1>교정 결과</h1>
      </header>

      {providerResult.status === 'success' && (
        <>
          <section className="card result-card" aria-labelledby="result-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow success-text">CORRECTION COMPLETE</p>
                <h2 id="result-heading">교정 완료</h2>
              </div>
              <span className="count-label">
                수정 {providerResult.result.changes.length}개
              </span>
            </div>
            {providerResult.result.message && (
              <p className="success-message">{providerResult.result.message}</p>
            )}
            <LanguageBlock
              label="교정된 답변"
              language={{
                zh: providerResult.result.corrected_zh,
                pinyin: providerResult.result.pinyin,
                ko: providerResult.result.ko,
              }}
            />
          </section>

          <section className="card" aria-labelledby="changes-heading">
            <h2 id="changes-heading">수정 전후와 이유</h2>
            {providerResult.result.changes.length === 0 ? (
              <EmptyState title="수정할 부분이 없습니다" />
            ) : (
              <ol className="change-list">
                {providerResult.result.changes.map((change, index) => (
                  <li key={`${change.before}-${index}`}>
                    <span className="change-number">변경 {index + 1}</span>
                    <div className="change-comparison" lang="zh-CN">
                      <div className="change-side">
                        <span className="change-label" lang="ko">
                          수정 전
                        </span>
                        <del>{change.before}</del>
                      </div>
                      <span aria-hidden="true">→</span>
                      <div className="change-side">
                        <span className="change-label" lang="ko">
                          수정 후
                        </span>
                        <ins>{change.after}</ins>
                      </div>
                    </div>
                    <p>{change.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card" aria-labelledby="review-notes-heading">
            <h2 id="review-notes-heading">관련성과 확인 사항</h2>
            <p>
              {providerResult.result.relevance_note ||
                '질문과의 관련성 문제 없음'}
            </p>
            {providerResult.result.uncertainties.length > 0 ? (
              <ul>
                {providerResult.result.uncertainties.map((uncertainty) => (
                  <li key={uncertainty.message}>{uncertainty.message}</li>
                ))}
              </ul>
            ) : (
              <p>확인이 필요한 불확실성 없음</p>
            )}
          </section>
        </>
      )}

      {providerResult.status === 'unsupported_by_mock' && (
        <section className="card unsupported-card" aria-labelledby="unsupported-heading">
          <p className="eyebrow">DEVELOPMENT MOCK</p>
          <h2 id="unsupported-heading">{providerResult.message}</h2>
          <p>{providerResult.explanation}</p>
          <div className="original-input">
            <span>입력 원문</span>
            <p>{providerResult.original_input}</p>
          </div>
        </section>
      )}

      {providerResult.status === 'failure' && (
        <>
          <ErrorState
            title={providerResult.message}
            message="입력 원문은 유지되었습니다. 다시 시도하거나 직접 수정할 수 있습니다."
            action={
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? '다시 시도 중…' : '다시 시도'}
                </button>
                <Link
                  className="secondary-button"
                  to={`/questions/${question.question_id}/answer`}
                  state={navigationState}
                >
                  답변 수정
                </Link>
              </div>
            }
          />
          <section className="card original-input" aria-label="보존된 입력 원문">
            <span>입력 원문</span>
            <p>{providerResult.original_input}</p>
          </section>
        </>
      )}

      <section className="card" aria-labelledby="model-answer-empty-heading">
        <h2 id="model-answer-empty-heading">모범답안 비교</h2>
        <EmptyState title="아직 모범답안 없음" />
      </section>

      {saveError && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="sticky-actions">
        <button
          className="primary-button"
          type="button"
          onClick={handleSave}
          disabled={!completeSuccess || saving}
        >
          {saving ? '저장 중…' : '나의 답변으로 저장'}
        </button>
        <Link
          className="secondary-button"
          to={`/questions/${question.question_id}/answer`}
          state={navigationState}
        >
          다시 쓰기
        </Link>
      </div>
    </div>
  )
}
