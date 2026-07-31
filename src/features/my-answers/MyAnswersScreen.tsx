import { useState } from 'react'
import { Link } from 'react-router-dom'

import { createNavigationContext } from '../../app/navigationContext'
import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { LocalVisualAssetImage } from '../../components/LocalVisualAssetImage'
import { StatusBadge } from '../../components/StatusBadge'
import { getDraftFullText } from '../answer/part4AnswerDraft'
import { Part2VisualImage } from '../part2/Part2VisualImage'

type AnswerView = 'approved' | 'drafts'
type DraftFilter = 'all' | 'in_progress' | 'completed' | 'needs_recall' | 'confused' | 'memorized'

const INPUT_LANGUAGE_LABELS = {
  ko: '한국어',
  zh: '중국어',
  mixed: '한국어·중국어 혼합',
} as const

const RECALL_RESULT_LABELS = {
  could_not_say: '못 말함',
  used_keywords: '키워드 보고 말함',
  almost: '거의 말함',
  memorized: '외워서 말함',
} as const

export function MyAnswersScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const [activeView, setActiveView] = useState<AnswerView>('approved')
  const [partFilter, setPartFilter] = useState('all')
  const [draftFilter, setDraftFilter] = useState<DraftFilter>('all')
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteError, setDeleteError] = useState('')
  const { data, error, loading } = useAsyncData(async () => {
    const [answers, drafts, attempts] = await Promise.all([
      userRepository.listUserAnswers(),
      userRepository.listPracticeDrafts(),
      userRepository.listRecallAttempts(),
    ])
    const approvedItems = await Promise.all(
      answers.map(async (answer) => ({
        answer,
        question: await publicRepository.getQuestionById(answer.question_id),
        reviewState: await userRepository.getReviewState(
          'question',
          answer.question_id,
        ),
      })),
    )
    const draftItems = await Promise.all(
      drafts.map(async (draft) => {
        const targetType = draft.target_type ?? 'question'
        const targetId = draft.target_id ?? draft.question_id
        const visualQuestion =
          targetType === 'visual_question'
            ? await publicRepository.getVisualQuestionById(targetId)
            : undefined
        const visualSet =
          targetType === 'visual_set'
            ? await publicRepository.getVisualSetById(targetId)
            : visualQuestion
              ? await publicRepository.getVisualSetById(
                  visualQuestion.visual_set_id,
                )
              : undefined
        const visualAssets = visualSet
          ? await publicRepository.listVisualAssetsBySetId(visualSet.visual_set_id)
          : []
        return {
          draft,
          targetType,
          targetId,
          question:
            targetType === 'question'
              ? await publicRepository.getQuestionById(targetId)
              : undefined,
          visualQuestion,
          visualSet,
          visualAsset: visualAssets[0],
          reviewState: await userRepository.getReviewState(targetType, targetId),
        }
      }),
    )
    return { approvedItems, draftItems, attempts }
  }, [publicRepository, reloadKey, userRepository])

  const deleteAnswer = async (userAnswerId: string) => {
    if (!window.confirm('이 답변과 연결된 개인 실수를 삭제할까요?')) return
    setDeleteError('')
    try {
      await userRepository.deleteUserAnswer(userAnswerId)
      setReloadKey((value) => value + 1)
    } catch (cause: unknown) {
      console.error(cause)
      setDeleteError('답변을 삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const deleteDraft = async (practiceDraftId: string) => {
    if (!window.confirm('이 연습 초안을 삭제할까요?')) return
    setDeleteError('')
    try {
      await userRepository.deletePracticeDraft(practiceDraftId)
      setReloadKey((value) => value + 1)
    } catch (cause: unknown) {
      console.error(cause)
      setDeleteError('연습 초안을 삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  if (loading) return <LoadingState message="저장한 답변을 불러오는 중입니다" />
  if (error || !data) {
    return (
      <ErrorState
        title="나의 답변을 불러오지 못했습니다"
        message="브라우저 저장소를 확인해 주세요."
      />
    )
  }

  const { approvedItems, draftItems, attempts } = data
  const filteredApprovedItems = approvedItems.filter(
    ({ question }) =>
      partFilter === 'all' || question?.part === Number(partFilter),
  )
  const filteredDraftItems = draftItems.filter(({
    draft,
    question,
    targetId,
    targetType,
    reviewState,
  }) => {
    const part =
      targetType === 'visual_question'
        ? 2
        : targetType === 'visual_set'
          ? 7
          : question?.part
    if (partFilter !== 'all' && part !== Number(partFilter)) return false
    if (draftFilter === 'all') return true
    if (draftFilter === 'in_progress') return draft.completion_status !== 'completed'
    if (draftFilter === 'completed') return draft.completion_status === 'completed'
    if (draftFilter === 'needs_recall') {
      return (
        draft.completion_status === 'completed' &&
        !attempts.some(
          (attempt) =>
            (attempt.target_type ?? 'question') === targetType &&
            (attempt.target_id ?? attempt.question_id) === targetId,
        )
      )
    }
    if (draftFilter === 'confused') return reviewState?.learning_status === '헷갈림'
    return reviewState?.learning_status === '외움'
  })

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">MY ANSWERS</p>
        <h1>나의 답변</h1>
        <p>교정 완료 답변과 교정 전 연습 초안을 서로 구분해 관리합니다.</p>
      </header>

      <div className="segmented-control" role="tablist" aria-label="답변 종류">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'approved'}
          className={activeView === 'approved' ? 'segmented-control__active' : ''}
          onClick={() => setActiveView('approved')}
        >
          교정 완료 {approvedItems.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'drafts'}
          className={activeView === 'drafts' ? 'segmented-control__active' : ''}
          onClick={() => setActiveView('drafts')}
        >
          연습 초안 {draftItems.length}
        </button>
      </div>

      <label className="card compact-filter">
        파트 필터
        <select value={partFilter} onChange={(event) => setPartFilter(event.target.value)}>
          <option value="all">전체 학습 파트</option>
          {[1, 2, 3, 4, 5, 6, 7].map((part) => (
            <option key={part} value={part}>Part {part}</option>
          ))}
        </select>
      </label>

      {deleteError && (
        <p className="field-error" role="alert">
          {deleteError}
        </p>
      )}

      {activeView === 'approved' &&
        (approvedItems.length === 0 ? (
          <EmptyState
            title="아직 교정 완료 답변이 없습니다"
            description="지원되는 mock 교정 결과를 직접 승인하면 이곳에 저장됩니다."
            action={
              <Link className="primary-button" to="/">
                문제 선택
              </Link>
            }
          />
        ) : filteredApprovedItems.length === 0 ? (
          <EmptyState title="선택한 Part에 교정 완료 답변이 없습니다" />
        ) : (
          <ul className="answer-list" aria-label="교정 완료 답변">
            {filteredApprovedItems.map(({ answer, question, reviewState }) => (
              <li key={answer.user_answer_id} className="card answer-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      Part {question?.part ?? 4} · {answer.question_id}
                    </p>
                    <h2>{question?.question_type || '문제 유형 미분류'}</h2>
                  </div>
                  <StatusBadge status={reviewState?.learning_status ?? 'unstarted'} />
                </div>
                {question && (
                  <p className="answer-card__question" lang="zh-CN">
                    {question.question_zh}
                  </p>
                )}
                <LanguageBlock
                  label={`${answer.question_id} 저장 답변`}
                  language={{
                    zh: answer.corrected_zh,
                    pinyin: answer.corrected_pinyin,
                    ko: answer.corrected_ko,
                  }}
                />
                <p className="timestamp">
                  마지막 수정일 <time dateTime={answer.updated_at}>{answer.updated_at}</time>
                </p>
                <div className="button-row">
                  <Link
                    className="secondary-button"
                    to={`/questions/${answer.question_id}`}
                    state={createNavigationContext('/my-answers')}
                  >
                    연결된 문제
                  </Link>
                  <Link
                    className="secondary-button"
                    to={`/questions/${answer.question_id}/answer`}
                    state={createNavigationContext('/my-answers')}
                  >
                    다시 작성
                  </Link>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void deleteAnswer(answer.user_answer_id)}
                  >
                    답변 삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {activeView === 'drafts' &&
        <>
          <label className="card compact-filter">
            연습 답변 필터
            <select
              value={draftFilter}
              onChange={(event) => setDraftFilter(event.target.value as DraftFilter)}
            >
              <option value="all">전체</option>
              <option value="in_progress">작성 중</option>
              <option value="completed">답변 완성</option>
              <option value="needs_recall">암기 필요</option>
              <option value="confused">헷갈림</option>
              <option value="memorized">외움</option>
            </select>
          </label>
          {draftItems.length === 0 ? (
          <EmptyState
            title="아직 연습 초안이 없습니다"
            description="실제 AI가 지원하지 않는 입력도 원문 그대로 초안에 저장할 수 있습니다."
            action={
              <Link className="primary-button" to="/">
                문제 선택
              </Link>
            }
          />
          ) : filteredDraftItems.length === 0 ? (
            <EmptyState title="조건에 맞는 연습 답변이 없습니다" />
          ) : (
          <ul className="answer-list" aria-label="연습 초안">
            {filteredDraftItems.map(({
              draft,
              question,
              visualQuestion,
              visualSet,
              visualAsset,
              targetType,
              targetId,
              reviewState,
            }) => {
              const isVisualQuestion = targetType === 'visual_question'
              const isStorySet = targetType === 'visual_set'
              const setNumber = visualSet
                ? Number(visualSet.visual_set_id.match(/V(\d+)$/)?.[1] ?? 0)
                : 0
              const latestAttempt = attempts.findLast(
                (attempt) =>
                  (attempt.target_type ?? 'question') === targetType &&
                  (attempt.target_id ?? attempt.question_id) === targetId,
              )
              const editPath = isStorySet
                ? `/parts/7/sets/${targetId}/answer`
                : isVisualQuestion
                  ? `/visual-questions/${targetId}/answer`
                  : `/questions/${targetId}/answer`
              const recallPath = isStorySet
                ? `/parts/7/sets/${targetId}/recall`
                : isVisualQuestion
                  ? `/visual-questions/${targetId}/recall`
                  : `/questions/${targetId}/answer?step=recall`

              return (
              <li key={draft.practice_draft_id} className="card answer-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      {isStorySet
                        ? `Part 7 · 스토리 그림 세트 ${setNumber}`
                        : isVisualQuestion
                        ? `Part 2 · 세트 ${setNumber} · 질문 ${visualQuestion?.item_number ?? ''}`
                        : `Part ${question?.part ?? 4} · ${targetId}`}
                    </p>
                    <h2>
                      {isStorySet
                        ? '내 스토리 답변'
                        : isVisualQuestion
                        ? visualQuestion?.question_zh || '그림 세부 질문'
                        : question?.question_type || '문제 유형 미분류'}
                    </h2>
                  </div>
                  <div className="badge-row">
                    <StatusBadge status="has_draft" />
                    <StatusBadge status={reviewState?.learning_status ?? 'unstarted'} />
                  </div>
                </div>
                {question && (
                  <p className="answer-card__question" lang="zh-CN">
                    {question.question_zh}
                  </p>
                )}
                {isVisualQuestion && visualQuestion && (
                  <>
                    <Part2VisualImage
                      asset={visualAsset}
                      setNumber={setNumber}
                      thumbnail
                    />
                    {visualQuestion.question_ko && (
                      <p className="answer-card__question" lang="ko">
                        {visualQuestion.question_ko}
                      </p>
                    )}
                  </>
                )}
                {isStorySet && (
                  <LocalVisualAssetImage
                    asset={visualAsset}
                    partNumber={7}
                    setNumber={setNumber}
                    thumbnail
                  />
                )}
                <div className="draft-preview">
                  <span className="language-label">
                    원본 입력 · {INPUT_LANGUAGE_LABELS[draft.input_language]}
                  </span>
                  <p>{getDraftFullText(draft)}</p>
                  <strong>
                    {draft.completion_status === 'completed' ? '답변 완성' : '작성 중'}
                  </strong>
                  {draft.planning_keywords && (
                    <p className="keyword-line">
                      키워드:{' '}
                      {Object.values(draft.planning_keywords).flat().join(' · ') || '없음'}
                    </p>
                  )}
                  {draft.story_keywords && draft.story_keywords.length > 0 && (
                    <p className="keyword-line">
                      내 핵심 키워드: {draft.story_keywords.join(' · ')}
                    </p>
                  )}
                  {draft.story_points && draft.story_points.length > 0 && (
                    <ol>
                      {draft.story_points.map((point) => (
                        <li key={point.point_id}>{point.text}</li>
                      ))}
                    </ol>
                  )}
                  {latestAttempt && (
                    <small>
                      마지막 회상 결과:{' '}
                      {RECALL_RESULT_LABELS[latestAttempt.result]}
                    </small>
                  )}
                </div>
                <p className="timestamp">
                  마지막 수정일 <time dateTime={draft.updated_at}>{draft.updated_at}</time>
                </p>
                <div className="button-row">
                  <Link
                    className="secondary-button"
                    to={editPath}
                    state={createNavigationContext('/my-answers')}
                  >
                    이어서 편집
                  </Link>
                  {!isVisualQuestion && question?.part === 4 && (
                    <Link
                      className="secondary-button"
                      to={editPath}
                      state={createNavigationContext('/my-answers')}
                    >
                      mock 교정 시도
                    </Link>
                  )}
                  {draft.completion_status === 'completed' && (
                    <Link
                      className="primary-button"
                      to={recallPath}
                      state={createNavigationContext('/my-answers')}
                    >
                      암기 시작
                    </Link>
                  )}
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void deleteDraft(draft.practice_draft_id)}
                  >
                    초안 삭제
                  </button>
                </div>
              </li>
              )
            })}
          </ul>
          )}
        </>}
    </div>
  )
}
