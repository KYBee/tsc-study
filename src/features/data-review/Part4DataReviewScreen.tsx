import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { createReviewDecisionRepository } from '../../data/reviewDecisionRepository'
import { loadPart4ReviewItems } from '../../data/reviewFixtureLoader'
import {
  calculateReviewOverallStatus,
  createEmptyFieldDecisions,
  isPromotionEligible,
  isReviewDecisionStale,
  PART4_REVIEW_FIELDS,
  type Part4ReviewItem,
} from '../../domain/dataReview'
import type {
  Part4ReviewDecision,
  Part4ReviewField,
  Part4ReviewFieldStatus,
} from '../../domain/entities'
import {
  buildReviewDecisionExport,
  downloadReviewDecisionExport,
  previewReviewDecisionImport,
  type ReviewImportPreview,
} from './reviewDecisionTransfer'

const FIELD_LABELS: Record<Part4ReviewField, string> = {
  chinese_text: '중국어',
  pinyin: '병음',
  korean_translation: '한국어',
  question_type: '문제 유형',
  answer_point: 'AnswerPoint',
  source_locator: '원본 위치',
  claimed_source_metadata: '출처 주장 메타데이터',
}

const FIELD_STATUS_LABELS: Record<Part4ReviewFieldStatus, string> = {
  approved: '승인',
  needs_fix: '수정 필요',
  not_checked: '미검수',
}

function fieldContent(item: Part4ReviewItem, field: Part4ReviewField) {
  const questionReference = item.question_source_references[0]
  const answerPointReference = item.answer_point_source_references[0]
  switch (field) {
    case 'chinese_text':
      return item.question.question_zh
    case 'pinyin':
      return item.question.question_pinyin || '제공되지 않음'
    case 'korean_translation':
      return item.question.question_ko || '제공되지 않음'
    case 'question_type':
      return item.question.question_type || '제공되지 않음'
    case 'answer_point':
      return item.answer_point.content
    case 'source_locator':
      return `Question: ${questionReference?.source_locator || '없음'}\nAnswerPoint: ${answerPointReference?.source_locator || '없음'}`
    case 'claimed_source_metadata':
      return [
        `이름: ${questionReference?.claimed_source_name || '없음'}`,
        `URL: ${questionReference?.claimed_source_url || '없음'}`,
        `자료 등급: ${questionReference?.source_grade || '없음'}`,
        `원문성: ${questionReference?.originality || '없음'}`,
        `검증 상태: ${questionReference?.verification_status || '없음'}`,
      ].join('\n')
  }
}

function statusLabel(decision: Part4ReviewDecision | undefined, stale: boolean) {
  if (!decision) return '미검수'
  if (stale) return 'stale'
  if (decision.overall_status === 'approved') return '승인'
  if (decision.overall_status === 'needs_fix') return '수정 필요'
  return '보류'
}

export function Part4DataReviewScreen() {
  const { reviewDecisionRepository } = useAppDependencies()
  const [repository] = useState(
    () => reviewDecisionRepository ?? createReviewDecisionRepository(),
  )
  const [items] = useState(() => loadPart4ReviewItems())
  const [revision, setRevision] = useState(0)
  const {
    data: decisions,
    error: loadError,
    loading,
  } = useAsyncData(() => repository.list(), [repository, revision])
  const [selectedId, setSelectedId] = useState('P4-001')
  const [query, setQuery] = useState('')
  const [questionType, setQuestionType] = useState('all')
  const [overallFilter, setOverallFilter] = useState('all')
  const [staleFilter, setStaleFilter] = useState('all')
  const [unreviewedOnly, setUnreviewedOnly] = useState(false)
  const [editor, setEditor] = useState({
    questionId: '',
    fieldDecisions: createEmptyFieldDecisions(),
    reviewerNote: '',
    reviewedBy: '',
  })
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [importPreview, setImportPreview] = useState<ReviewImportPreview>()

  const decisionByQuestion = useMemo(
    () => new Map((decisions ?? []).map((decision) => [decision.question_id, decision])),
    [decisions],
  )
  const itemByQuestion = useMemo(
    () => new Map(items.map((item) => [item.question_id, item])),
    [items],
  )
  const selectedItem = itemByQuestion.get(selectedId) ?? items[0]
  const existingSelectedDecision = decisionByQuestion.get(
    selectedItem.question_id,
  )
  const effectiveEditor =
    editor.questionId === selectedItem.question_id
      ? editor
      : {
          questionId: selectedItem.question_id,
          fieldDecisions: existingSelectedDecision
            ? { ...existingSelectedDecision.field_decisions }
            : createEmptyFieldDecisions(),
          reviewerNote: existingSelectedDecision?.reviewer_note ?? '',
          reviewedBy:
            existingSelectedDecision?.reviewed_by ?? editor.reviewedBy,
        }

  const questionTypes = useMemo(
    () =>
      [...new Set(items.map((item) => item.question.question_type).filter(Boolean))]
        .sort((left, right) => left!.localeCompare(right!, 'ko')) as string[],
    [items],
  )

  const filteredItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return items.filter((item) => {
      const decision = decisionByQuestion.get(item.question_id)
      const stale = decision ? isReviewDecisionStale(decision, item) : false
      const matchesQuery =
        !term ||
        [
          item.question_id,
          item.question.question_zh,
          item.question.question_ko ?? '',
        ].some((value) => value.toLocaleLowerCase().includes(term))
      return (
        matchesQuery &&
        (questionType === 'all' ||
          item.question.question_type === questionType) &&
        (overallFilter === 'all' ||
          (overallFilter === 'unreviewed'
            ? !decision
            : decision?.overall_status === overallFilter)) &&
        (staleFilter === 'all' ||
          (staleFilter === 'stale' ? stale : !stale)) &&
        (!unreviewedOnly || !decision)
      )
    })
  }, [
    decisionByQuestion,
    items,
    overallFilter,
    query,
    questionType,
    staleFilter,
    unreviewedOnly,
  ])

  const summary = useMemo(() => {
    const counts = {
      approved: 0,
      needs_fix: 0,
      deferred: 0,
      unreviewed: 0,
      stale: 0,
      eligible: 0,
    }
    for (const item of items) {
      const decision = decisionByQuestion.get(item.question_id)
      if (!decision) counts.unreviewed += 1
      else counts[decision.overall_status] += 1
      if (decision && isReviewDecisionStale(decision, item)) counts.stale += 1
      if (isPromotionEligible(decision, item)) counts.eligible += 1
    }
    return counts
  }, [decisionByQuestion, items])

  const updateField = (
    field: Part4ReviewField,
    status: Part4ReviewFieldStatus,
  ) => {
    setEditor({
      ...effectiveEditor,
      fieldDecisions: {
        ...effectiveEditor.fieldDecisions,
        [field]: status,
      },
    })
  }

  const saveDecision = async () => {
    const reviewer = effectiveEditor.reviewedBy.trim()
    const overall = calculateReviewOverallStatus(effectiveEditor.fieldDecisions)
    if (!reviewer) {
      setFormError('검수자 표시명을 입력해 주세요')
      return
    }
    if (overall === 'needs_fix' && !effectiveEditor.reviewerNote.trim()) {
      setFormError('수정 필요 사유를 검수 메모에 입력해 주세요')
      return
    }
    const decision: Part4ReviewDecision = {
      review_decision_id: `p4-review-decision-${selectedItem.question_id}`,
      dataset_id: 'part4-review-fixture-v1',
      question_id: selectedItem.question_id,
      field_decisions: { ...effectiveEditor.fieldDecisions },
      overall_status: overall,
      reviewer_note: effectiveEditor.reviewerNote,
      reviewed_by: reviewer,
      reviewed_at: new Date().toISOString(),
      source_question_hash: selectedItem.source_question_hash,
      source_answer_point_hash: selectedItem.source_answer_point_hash,
      decision_version: 1,
    }
    try {
      await repository.upsert(decision)
      setRevision((current) => current + 1)
      setFeedback(`${selectedItem.question_id} 검수 결정을 저장했습니다`)
      setFormError('')
    } catch (cause) {
      console.error(cause)
      setFormError('검수 결정을 저장하지 못했습니다')
    }
  }

  const openNextUnreviewed = () => {
    const next = items.find((item) => !decisionByQuestion.has(item.question_id))
    if (next) setSelectedId(next.question_id)
  }

  const exportDecisions = () => {
    try {
      const value = buildReviewDecisionExport(
        decisions ?? [],
        effectiveEditor.reviewedBy.trim(),
      )
      downloadReviewDecisionExport(value)
      setFeedback('검수 결정 JSON을 내보냈습니다')
    } catch (cause) {
      console.error(cause)
      setFormError('검수 결정 JSON을 내보내지 못했습니다')
    }
  }

  const previewImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const preview = previewReviewDecisionImport(
        await file.text(),
        items,
        decisions ?? [],
      )
      setImportPreview(preview)
      setFormError('')
    } catch (cause) {
      setImportPreview(undefined)
      setFormError(
        cause instanceof Error ? cause.message : '가져오기 파일을 검증하지 못했습니다',
      )
    }
  }

  const applyImport = async () => {
    if (!importPreview) return
    if (!window.confirm('미리보기의 검수 결정을 적용할까요?')) return
    try {
      await repository.upsertMany(importPreview.applicableDecisions)
      setRevision((current) => current + 1)
      setImportPreview(undefined)
      setFeedback('검수 결정 JSON을 적용했습니다')
    } catch (cause) {
      console.error(cause)
      setFormError('검수 결정 JSON을 적용하지 못했습니다')
    }
  }

  const resetDecisions = async () => {
    if (!window.confirm('로컬 Part 4 검수 결정을 모두 초기화할까요?')) return
    await repository.clear()
    setRevision((current) => current + 1)
    setFeedback('로컬 검수 결정을 초기화했습니다')
  }

  if (!import.meta.env.DEV) {
    return (
      <div className="page">
        <ErrorState
          title="로컬 검수 도구를 사용할 수 없습니다"
          message="이 화면은 개발 환경에서만 사용할 수 있습니다."
        />
      </div>
    )
  }
  if (loadError) {
    return (
      <ErrorState
        title="검수 결정을 불러오지 못했습니다"
        message={loadError.message}
      />
    )
  }
  if (loading || !decisions) {
    return <LoadingState message="Part 4 검수 결정을 불러오는 중입니다" />
  }

  const selectedIndex = items.findIndex(
    (item) => item.question_id === selectedItem.question_id,
  )
  return (
    <div className="page data-review-page">
      <header className="page-header">
        <Link className="back-link" to="/">
          ← 학습 앱
        </Link>
        <div className="badge-row">
          <span className="status-badge status-badge--review-needed">
            데이터 검수 · 로컬 전용
          </span>
        </div>
        <p className="eyebrow">PART 4 DATA REVIEW</p>
        <h1>Part 4 원문 검수</h1>
        <p>
          원문을 수정하지 않고 필드별 판단만 기록합니다. 화면 진입만으로
          승인되지 않습니다.
        </p>
      </header>

      <section className="card" aria-labelledby="review-summary-heading">
        <h2 id="review-summary-heading">검수 현황</h2>
        <dl className="review-stats">
          <div><dt>전체</dt><dd>50</dd></div>
          <div><dt>승인</dt><dd>{summary.approved}</dd></div>
          <div><dt>수정 필요</dt><dd>{summary.needs_fix}</dd></div>
          <div><dt>보류</dt><dd>{summary.deferred}</dd></div>
          <div><dt>미검수</dt><dd>{summary.unreviewed}</dd></div>
          <div><dt>stale</dt><dd>{summary.stale}</dd></div>
          <div><dt>승격 가능</dt><dd>{summary.eligible}</dd></div>
        </dl>
      </section>

      <section className="card filter-panel" aria-labelledby="review-filter-heading">
        <h2 id="review-filter-heading">검수 대상 찾기</h2>
        <div className="filter-grid">
          <label>
            <span>질문 검색</span>
            <input
              aria-label="검수 질문 검색"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID·중국어·한국어"
            />
          </label>
          <label>
            <span>유형</span>
            <select
              aria-label="검수 유형 필터"
              value={questionType}
              onChange={(event) => setQuestionType(event.target.value)}
            >
              <option value="all">전체</option>
              {questionTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>전체 상태</span>
            <select
              aria-label="검수 상태 필터"
              value={overallFilter}
              onChange={(event) => setOverallFilter(event.target.value)}
            >
              <option value="all">전체</option>
              <option value="unreviewed">미검수</option>
              <option value="approved">승인</option>
              <option value="needs_fix">수정 필요</option>
              <option value="deferred">보류</option>
            </select>
          </label>
          <label>
            <span>stale 여부</span>
            <select
              aria-label="stale 필터"
              value={staleFilter}
              onChange={(event) => setStaleFilter(event.target.value)}
            >
              <option value="all">전체</option>
              <option value="current">현재 원문</option>
              <option value="stale">stale</option>
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={unreviewedOnly}
            onChange={(event) => setUnreviewedOnly(event.target.checked)}
          />
          미검수만 보기
        </label>
        <p className="count-label" aria-live="polite">현재 결과 {filteredItems.length}개</p>
      </section>

      <div className="data-review-layout">
        <section className="card review-item-list" aria-labelledby="review-list-heading">
          <div className="section-heading">
            <h2 id="review-list-heading">검수 대상</h2>
            <button className="secondary-button" type="button" onClick={openNextUnreviewed}>
              다음 미검수
            </button>
          </div>
          <ul aria-label="Part 4 검수 대상 목록">
            {filteredItems.map((item) => {
              const decision = decisionByQuestion.get(item.question_id)
              const stale = decision ? isReviewDecisionStale(decision, item) : false
              return (
                <li key={item.question_id}>
                  <button
                    type="button"
                    aria-current={selectedItem.question_id === item.question_id}
                    onClick={() => {
                      setSelectedId(item.question_id)
                      setFormError('')
                      setFeedback('')
                    }}
                  >
                    <strong>{item.question_id}</strong>
                    <span>{item.question.question_type || '유형 없음'}</span>
                    <span>{statusLabel(decision, stale)}</span>
                    <small lang="zh-CN">{item.question.question_zh}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="review-detail" aria-labelledby="review-detail-heading">
          <div className="card">
            <p className="eyebrow">{selectedItem.question_id}</p>
            <h2 id="review-detail-heading">개별 검수</h2>
            <p className="field-help">
              {selectedIndex + 1} / 50 · 상태{' '}
              {statusLabel(
                decisionByQuestion.get(selectedItem.question_id),
                Boolean(
                  decisionByQuestion.get(selectedItem.question_id) &&
                  isReviewDecisionStale(
                    decisionByQuestion.get(selectedItem.question_id)!,
                    selectedItem,
                  ),
                ),
              )}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={selectedIndex === 0}
                onClick={() => setSelectedId(items[selectedIndex - 1].question_id)}
              >
                이전 항목
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={selectedIndex === items.length - 1}
                onClick={() => setSelectedId(items[selectedIndex + 1].question_id)}
              >
                다음 항목
              </button>
            </div>
          </div>

          {PART4_REVIEW_FIELDS.map((field) => (
            <section className="card review-field" key={field} aria-label={`${FIELD_LABELS[field]} 검수`}>
              <h2>{FIELD_LABELS[field]}</h2>
              <pre lang={field === 'chinese_text' ? 'zh-CN' : field === 'korean_translation' ? 'ko' : undefined}>
                {fieldContent(selectedItem, field)}
              </pre>
              <div className="review-field-actions" role="group" aria-label={`${FIELD_LABELS[field]} 상태`}>
                {(['approved', 'needs_fix', 'not_checked'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="status-button"
                    aria-pressed={effectiveEditor.fieldDecisions[field] === status}
                    onClick={() => updateField(field, status)}
                  >
                    {FIELD_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section className="card">
            <h2>결정 저장</h2>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setEditor({
                    ...effectiveEditor,
                    fieldDecisions: Object.fromEntries(
                      PART4_REVIEW_FIELDS.map((field) => [field, 'approved']),
                    ) as Part4ReviewDecision['field_decisions'],
                  })
                }
              >
                전체 필드 승인
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setEditor({
                    ...effectiveEditor,
                    fieldDecisions: Object.fromEntries(
                      PART4_REVIEW_FIELDS.map((field) => [field, 'needs_fix']),
                    ) as Part4ReviewDecision['field_decisions'],
                  })
                }
              >
                전체 수정 필요
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setEditor({
                    ...effectiveEditor,
                    fieldDecisions: createEmptyFieldDecisions(),
                  })
                }
              >
                보류
              </button>
            </div>
            <label className="form-field">
              <span>검수자 표시명</span>
              <input
                value={effectiveEditor.reviewedBy}
                maxLength={200}
                onChange={(event) =>
                  setEditor({
                    ...effectiveEditor,
                    reviewedBy: event.target.value,
                  })
                }
              />
            </label>
            <label className="form-field">
              <span>검수 메모</span>
              <textarea
                value={effectiveEditor.reviewerNote}
                maxLength={10_000}
                onChange={(event) =>
                  setEditor({
                    ...effectiveEditor,
                    reviewerNote: event.target.value,
                  })
                }
              />
            </label>
            <p>
              계산된 전체 상태:{' '}
              <strong>{statusLabel({
                overall_status: calculateReviewOverallStatus(
                  effectiveEditor.fieldDecisions,
                ),
              } as Part4ReviewDecision, false)}</strong>
            </p>
            {formError && <p className="field-error" role="alert">{formError}</p>}
            {feedback && <p className="success-message" role="status">{feedback}</p>}
            <button className="primary-button full-width" type="button" onClick={() => void saveDecision()}>
              검수 결정 저장
            </button>
          </section>
        </section>
      </div>

      <section className="card" aria-labelledby="review-transfer-heading">
        <h2 id="review-transfer-heading">결정 JSON 내보내기·가져오기</h2>
        <p className="field-help">
          학습자의 PracticeDraft·UserAnswer는 포함하지 않습니다.
        </p>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={exportDecisions}>
            결정 JSON 내보내기
          </button>
          <label className="secondary-button file-button">
            결정 JSON 가져오기
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void previewImport(event.target.files?.[0])}
            />
          </label>
          <button className="danger-button" type="button" onClick={() => void resetDecisions()}>
            로컬 결정 초기화
          </button>
        </div>
        {importPreview && (
          <div className="import-preview" aria-label="가져오기 미리보기">
            <p>새 결정 {importPreview.newDecisions.length}개</p>
            <p>덮어쓰기 {importPreview.overwriteDecisions.length}개</p>
            <p>동일 {importPreview.identicalDecisions.length}개</p>
            <p>stale {importPreview.staleDecisions.length}개</p>
            <p>거부 {importPreview.rejectedDecisions.length}개</p>
            <button className="primary-button" type="button" onClick={() => void applyImport()}>
              미리보기 결정 적용
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
