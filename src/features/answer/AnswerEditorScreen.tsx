import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import {
  createNavigationContext,
  getSafeReturnPath,
} from '../../app/navigationContext'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type { InputLanguage } from '../../domain/entities'
import type { StoredPracticeDraft } from '../../data/userDataRepository'
import {
  createCorrectionSession,
  loadCorrectionSession,
  saveCorrectionSession,
} from './correctionSession'

function inferInputLanguage(value: string): InputLanguage {
  const hasKorean = /[\uac00-\ud7af]/u.test(value)
  const hasChinese = /[\u3400-\u9fff]/u.test(value)
  if (hasKorean && hasChinese) {
    return 'mixed'
  }
  return hasKorean ? 'ko' : 'zh'
}

export function AnswerEditorScreen() {
  const { questionId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = getSafeReturnPath(location.state)
  const navigationState = createNavigationContext(returnTo)
  const { publicRepository, userRepository, correctionProvider } =
    useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const question = await publicRepository.getQuestionById(questionId)
    if (!question || question.part !== 4) {
      return { question: undefined, initialInput: '', practiceDraft: undefined }
    }
    const session = loadCorrectionSession(questionId)
    const [answer, practiceDraft] = await Promise.all([
      userRepository.getUserAnswerByQuestionId(questionId),
      userRepository.getPracticeDraftByQuestionId(questionId),
    ])
    return {
      question,
      practiceDraft,
      initialInput:
        session?.original_input ??
        practiceDraft?.original_input ??
        answer?.original_input ??
        '',
    }
  }, [publicRepository, questionId, userRepository])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [validationMessage, setValidationMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [draftError, setDraftError] = useState('')
  const [draftOverride, setDraftOverride] = useState<StoredPracticeDraft | null>()

  if (loading) {
    return <LoadingState message="답변 작성 화면을 준비하는 중입니다" />
  }
  if (error) {
    return (
      <ErrorState
        title="답변 작성 화면을 불러오지 못했습니다"
        message="작성한 답변은 브라우저의 임시 세션에 남아 있습니다."
      />
    )
  }
  if (!data?.question) {
    return (
      <div className="page">
        <ErrorState
          title="문제를 찾을 수 없습니다"
          action={
            <Link className="primary-button" to="/parts/4">
              Part 4로 돌아가기
            </Link>
          }
        />
      </div>
    )
  }

  const { question } = data
  const input = drafts[question.question_id] ?? data.initialInput
  const practiceDraft =
    draftOverride === undefined ? data.practiceDraft : draftOverride

  const preserveDraft = (value: string) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [question.question_id]: value,
    }))
    setValidationMessage('')
    setDraftMessage('')
    saveCorrectionSession(
      createCorrectionSession({
        question_id: question.question_id,
        correction_mode: 'minimal',
        input_language: inferInputLanguage(value),
        original_input: value,
        provider_result: null,
      }),
    )
  }

  const handleSaveDraft = async () => {
    if (!input.trim() || savingDraft) {
      setValidationMessage('답변을 입력해 주세요')
      return
    }
    setSavingDraft(true)
    setDraftError('')
    setDraftMessage('')
    try {
      const saved = await userRepository.upsertPracticeDraft({
        practice_draft_id: `pd-${question.question_id}`,
        question_id: question.question_id,
        input_language: inferInputLanguage(input),
        original_input: input,
        draft_status: 'draft',
      })
      setDraftOverride(saved)
      setDraftMessage('연습 초안을 저장했습니다')
    } catch (cause: unknown) {
      console.error(cause)
      setDraftError('연습 초안을 저장하지 못했습니다. 입력은 그대로 유지됩니다.')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleDeleteDraft = async () => {
    if (!practiceDraft || !window.confirm('저장된 연습 초안을 삭제할까요?')) {
      return
    }
    setDraftError('')
    try {
      await userRepository.deletePracticeDraft(practiceDraft.practice_draft_id)
      setDraftOverride(null)
      setDraftMessage('저장된 연습 초안을 삭제했습니다')
    } catch (cause: unknown) {
      console.error(cause)
      setDraftError('연습 초안을 삭제하지 못했습니다.')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.trim()) {
      setValidationMessage('답변을 입력해 주세요')
      return
    }
    if (submitting) {
      return
    }

    setSubmitting(true)
    setValidationMessage('')
    const inputLanguage = inferInputLanguage(input)
    const baseSession = createCorrectionSession({
      question_id: question.question_id,
      correction_mode: 'minimal',
      input_language: inputLanguage,
      original_input: input,
      provider_result: null,
    })
    saveCorrectionSession(baseSession)

    try {
      const providerResult = await correctionProvider.correct({
        question_id: question.question_id,
        part: question.part,
        question_zh: question.question_zh,
        input_language: inputLanguage,
        original_input: input,
        correction_mode: 'minimal',
      })
      saveCorrectionSession({ ...baseSession, provider_result: providerResult })
    } catch (cause: unknown) {
      console.error(cause)
      saveCorrectionSession({
        ...baseSession,
        provider_result: {
          status: 'failure',
          original_input: input,
          message: '교정 요청을 처리하지 못했습니다',
          error_code: 'provider_exception',
        },
      })
    }

    navigate(`/questions/${question.question_id}/correction`, {
      state: navigationState,
    })
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link
          className="back-link"
          to={`/questions/${question.question_id}`}
          state={navigationState}
        >
          ← 문제로 돌아가기
        </Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="raw" />
        </div>
        <p className="eyebrow">{question.question_id}</p>
        <h1>나의 답변 작성</h1>
        <p>한국어와 중국어를 섞어 써도 원문을 그대로 보존합니다.</p>
      </header>

      <div className="card question-context">
        <LanguageBlock
          label="답변할 질문"
          language={{
            zh: question.question_zh,
            pinyin: question.question_pinyin,
            ko: question.question_ko,
          }}
        />
      </div>

      <form className="card answer-form" onSubmit={handleSubmit}>
        <fieldset className="mode-fieldset">
          <legend>교정 모드</legend>
          <label className="mode-option mode-option--selected">
            <input type="radio" name="correction-mode" value="minimal" defaultChecked />
            <span>
              <strong>최소 교정</strong>
              <small>기본값 · 사용자 표현을 최대한 유지</small>
            </span>
          </label>
          <label className="mode-option mode-option--disabled">
            <input type="radio" name="correction-mode" value="natural" disabled />
            <span>
              <strong>자연스럽게</strong>
              <small>준비 중</small>
            </span>
          </label>
          <label className="mode-option mode-option--disabled">
            <input
              type="radio"
              name="correction-mode"
              value="level_8_expansion"
              disabled
            />
            <span>
              <strong>Level 8 확장</strong>
              <small>준비 중</small>
            </span>
          </label>
        </fieldset>

        <div className="form-field">
          <label htmlFor="answer-input">내 답변</label>
          <textarea
            id="answer-input"
            rows={8}
            value={input}
            onChange={(event) => preserveDraft(event.target.value)}
            placeholder="한국어·중국어 모두 괜찮아요. 틀려도 그대로 적으세요."
            aria-describedby={validationMessage ? 'answer-error' : 'answer-help'}
          />
          <p id="answer-help" className="field-help">
            현재 개발용 mock은 문서에 정한 P4-006 운동 예시만 완전 교정합니다.
          </p>
          {validationMessage && (
            <p id="answer-error" className="field-error" role="alert">
              {validationMessage}
            </p>
          )}
          {draftMessage && (
            <p className="success-message" role="status">
              {draftMessage}
            </p>
          )}
          {draftError && (
            <p className="field-error" role="alert">
              {draftError}
            </p>
          )}
        </div>

        <div className="button-row">
          <button
            className="secondary-button"
            type="button"
            disabled={savingDraft}
            onClick={() => void handleSaveDraft()}
          >
            {savingDraft ? '초안 저장 중…' : '연습 초안 저장'}
          </button>
          {practiceDraft && (
            <button
              className="danger-button"
              type="button"
              onClick={() => void handleDeleteDraft()}
            >
              저장된 초안 삭제
            </button>
          )}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? '교정 중…' : '교정하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
