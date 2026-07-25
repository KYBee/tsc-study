import { Link, useLocation } from 'react-router-dom'

import { getSafeReturnPath } from '../app/navigationContext'

const TABS = [
  { label: '학습', path: '/' },
  { label: '복습', path: '/review' },
  { label: '나의 답변', path: '/my-answers' },
  { label: '실수 노트', path: '/mistakes' },
] as const

function isActiveTab(
  pathname: string,
  path: (typeof TABS)[number]['path'],
  returnTo: string,
) {
  const isQuestionFlow = pathname.startsWith('/questions/')
  if (isQuestionFlow && returnTo === '/my-answers') {
    return path === '/my-answers'
  }
  if (path === '/') {
    return (
      pathname === '/' ||
      pathname.startsWith('/parts/') ||
      pathname.startsWith('/questions/')
    )
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function BottomNavigation() {
  const { pathname, state } = useLocation()
  const returnTo = getSafeReturnPath(state)

  return (
    <nav className="bottom-navigation" aria-label="하단 메뉴">
      <div className="bottom-navigation__inner">
        {TABS.map((tab) => {
          const active = isActiveTab(pathname, tab.path, returnTo)
          return (
            <Link
              key={tab.path}
              className={active ? 'bottom-tab bottom-tab--active' : 'bottom-tab'}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
            >
              <span className="bottom-tab__mark" aria-hidden="true">
                {tab.label.slice(0, 1)}
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
