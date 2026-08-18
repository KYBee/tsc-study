import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
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
      <header className="page-header">
        <Link className="back-link" to="/parts/2">← Part 2 세트 목록</Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="review_needed" />
        </div>
        <p className="eyebrow">{data.visualSet.visual_set_id}</p>
        <h1>Part 2 그림 세트 {number}</h1>
      </header>
      <aside className="notice">
        사용자가 제공한 이름 지정 묶음의 검수 전 그림입니다. 공개 권리 승인과 별개로 현재 배포 설정에서만 사용합니다.
      </aside>
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
              <li key={targetId} className="question-card">
                <Link to={`/visual-questions/${targetId}`}>
                  <span className="eyebrow">질문 {question.item_number}</span>
                  <p lang="zh-CN">{question.question_zh || '중국어 제공되지 않음'}</p>
                  <p lang="ko">{question.question_ko || '한국어 제공되지 않음'}</p>
                  <div className="badge-row">
                    {draft && <StatusBadge status="has_draft" />}
                    <StatusBadge status={review?.learning_status ?? 'unstarted'} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
