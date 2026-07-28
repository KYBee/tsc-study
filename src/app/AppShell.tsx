import { useEffect, useRef, type PropsWithChildren } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

import { BottomNavigation } from '../components/BottomNavigation'

export function AppShell({ children }: PropsWithChildren) {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const dataReviewRoute = pathname.startsWith('/data-review/')
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'PUSH') {
      mainRef.current?.focus()
    }
  }, [navigationType, pathname])

  return (
    <div className={dataReviewRoute ? 'app-shell app-shell--data-review' : 'app-shell'}>
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <main
        ref={mainRef}
        id="main-content"
        className="app-content"
        tabIndex={-1}
      >
        {children}
      </main>
      {!dataReviewRoute && <BottomNavigation />}
    </div>
  )
}
