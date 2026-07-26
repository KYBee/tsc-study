import type { ReactNode } from 'react'

interface ErrorStateProps {
  title: string
  message?: string
  action?: ReactNode
}

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p className="error-state__title">{title}</p>
      {message && <p>{message}</p>}
      {action && <div className="error-state__action">{action}</div>}
    </div>
  )
}
