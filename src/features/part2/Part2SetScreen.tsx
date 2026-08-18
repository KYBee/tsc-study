import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LearningStatusButtons } from '../../components/LearningStatusButtons'
import { LoadingState } from '../../components/LoadingState'
import { SimpleAnswerEditor } from '../../components/SimpleAnswerEditor'
import { Part2VisualImage } from './Part2VisualImage'

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function Part2SetScreen() {
  const { visualSetId = '' } = useParams()
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const { data, error, loading } = useAsyncData(async () => {
    const visualSet = await publicRepository.getVisualSetById(visualSetId)
    if (!visualSet || visualSet.part !== 2) return undefined
    const [sets, assets, questions, drafts, reviews] = await Promise.all([
      publicRepository.listVisualSetsByPart(2),
      publicRepository.listVisualAssetsBySetId(visualSetId),
      publicRepository.listVisualQuestionsBySetId(visualSetId),
      userRepository.listPracticeDrafts(),
      userRepository.listReviewStates(),
    ])
    return { visualSet, sets, asset: assets[0], questions, drafts, reviews }
  }, [publicRepository, userRepository, visualSetId])

  if (loading) return <LoadingState message="그림 세트를 불러오는 중입니다" />
  if (error || !data) {
    return <ErrorState title="그림 세트를 찾을 수 없습니다" message={visualSetId} />
  }
  const number = setNumber(data.visualSet.visual_set_id)
  const index = data.sets.findIndex((item) => item.visual_set_id === visualSetId)
  const previous = data.sets[index - 1]
  const next = data.sets[index + 1]
  const randomSet = () => {
    const selected = data.sets[Math.floor(Math.random() * data.sets.length)]
    navigate(`/parts/2/sets/${selected.visual_set_id}`)
  }

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <Link className="back-link" to="/parts/2">← Part 2 세트 목록</Link>
        <p className="eyebrow">PART 2 · 세트 {number}</p>
        <h1>Part 2 그림 세트 {number}</h1>
        <p>그림을 보고 질문마다 내 답변을 따로 저장하세요.</p>
      </header>
      <section className="card visual-set-main">
        <Part2VisualImage asset={data.asset} setNumber={number} expandable />
      </section>
      <div className="button-row">
        <Link className="primary-button" to={`/parts/2/sets/${visualSetId}/exam`}>
          4문제 실전 연습
        </Link>
      </div>
      <nav className="question-navigation" aria-label="그림 세트 이동">
        {previous ? <Link className="secondary-button" to={`/parts/2/sets/${previous.visual_set_id}`}>이전 세트</Link> : <span />}
        <button className="secondary-button" type="button" onClick={randomSet}>랜덤 세트</button>
        {next ? <Link className="secondary-button" to={`/parts/2/sets/${next.visual_set_id}`}>다음 세트</Link> : <span />}
      </nav>
      <section>
        <h2>세부 질문 4개</h2>
        <ul className="card-list" aria-label="세부 질문 4개">
          {data.questions.map((question) => {
            const targetId = question.visual_question_id
            const draft = data.drafts.find(
              (item) =>
                (item.target_type ?? 'question') === 'visual_question' &&
                (item.target_id ?? item.question_id) === targetId,
            )
            const review = data.reviews.find(
              (item) =>
                item.target_type === 'visual_question' &&
                item.target_id === targetId,
            )
            return (
              <li key={targetId} className="card visual-question-learning-card">
                <article aria-label={`질문 ${question.item_number} 학습`}>
                  <span className="eyebrow">질문 {question.item_number}</span>
                  <p className="question-card__zh" lang="zh-CN">
                    {question.question_zh || '중국어 제공되지 않음'}
                  </p>
                  <p className="question-card__ko" lang="ko">
                    {question.question_ko || '한국어 제공되지 않음'}
                  </p>
                  <SimpleAnswerEditor
                    targetType="visual_question"
                    targetId={targetId}
                    initialDraft={draft}
                    userRepository={userRepository}
                    label={`질문 ${question.item_number} 내 답변`}
                    rows={3}
                  />
                  <div className="inline-learning-status">
                    <h3>암기 상태</h3>
                    <LearningStatusButtons
                      targetType="visual_question"
                      targetId={targetId}
                      initialReviewState={review}
                      userRepository={userRepository}
                    />
                  </div>
                  <Link className="text-link" to={`/visual-questions/${targetId}`}>
                    질문 자세히 보기
                  </Link>
                </article>
              </li>
            )
          })}
        </ul>
      </section>
      <details className="card details-panel supporting-materials">
        <summary>추가 학습 자료 보기</summary>
        <p>
          이 그림은 현재 배포 설정에서 사용하는 검수 전 학습 자료입니다.
          출처 답변과 병음은 각 질문의 자세히 보기에서 확인할 수 있습니다.
        </p>
      </details>
    </div>
  )
}
