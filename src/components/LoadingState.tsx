interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = '불러오는 중입니다' }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-state__indicator" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
