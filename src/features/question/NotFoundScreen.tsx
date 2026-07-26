import { Link } from 'react-router-dom'

import { ErrorState } from '../../components/ErrorState'

export function NotFoundScreen() {
  return (
    <div className="page">
      <ErrorState
        title="페이지를 찾을 수 없습니다"
        message="주소를 다시 확인하거나 Part 4 목록으로 돌아가 주세요."
        action={
          <Link className="primary-button" to="/parts/4">
            Part 4로 돌아가기
          </Link>
        }
      />
    </div>
  )
}
