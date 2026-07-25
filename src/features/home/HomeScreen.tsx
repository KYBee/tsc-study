import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { useAsyncData } from '../../app/useAsyncData'

export function HomeScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const [parts, reviewStates] = await Promise.all([
      publicRepository.listParts(),
      userRepository.listReviewStates(),
    ])
    return { parts, reviewStates }
  }, [publicRepository, userRepository])

  if (loading) {
    return <LoadingState message="학습 홈을 불러오는 중입니다" />
  }
  if (error || !data) {
    return (
      <ErrorState
        title="학습 홈을 불러오지 못했습니다"
        message="잠시 후 다시 시도해 주세요."
      />
    )
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">TSC STUDY</p>
        <h1>오늘도 정확하게 말해 볼까요?</h1>
        <p>어려운 표현보다 자주 하는 실수를 줄이는 연습부터 시작합니다.</p>
      </header>

      <section className="card" aria-labelledby="today-review-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">REVIEW</p>
            <h2 id="today-review-heading">오늘 복습</h2>
          </div>
          {data.reviewStates.length > 0 && (
            <Link className="text-link" to="/review">
              복습하기
            </Link>
          )}
        </div>
        {data.reviewStates.length === 0 ? (
          <EmptyState title="아직 복습할 항목이 없습니다" />
        ) : (
          <p>복습 상태가 기록된 항목 {data.reviewStates.length}개가 있습니다.</p>
        )}
      </section>

      <section className="card" aria-labelledby="continue-heading">
        <p className="eyebrow">CONTINUE</p>
        <h2 id="continue-heading">이어서 학습</h2>
        <p>아직 저장된 마지막 학습 위치가 없습니다.</p>
        <Link className="primary-button" to="/parts/4">
          Part 4 학습 시작
        </Link>
      </section>

      <section aria-labelledby="part-list-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LEARN</p>
            <h2 id="part-list-heading">Part 1~7</h2>
          </div>
        </div>
        <ul className="card-list" aria-label="Part 목록">
          {data.parts.map((part) => (
            <li key={part.part} className="part-card">
              {part.availability === 'available' ? (
                <Link className="part-card__link" to={`/parts/${part.part}`}>
                  <span className="part-card__number">Part {part.part}</span>
                  <span className="part-card__body">
                    <strong>{part.name}</strong>
                    <small>{part.available_question_count}개 개발 표본</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="part-card__disabled" aria-disabled="true">
                  <span className="part-card__number">Part {part.part}</span>
                  <span className="part-card__body">
                    <strong>{part.name}</strong>
                    <small>아직 학습 콘텐츠가 없습니다</small>
                  </span>
                  <span className="coming-soon">준비 중</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
