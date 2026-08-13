import {
  Component,
  useMemo,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'

import { createPublicContentRepository } from '../data/publicContentRepository'
import { createUserDataRepository } from '../data/userDataRepository'
import { createReviewDecisionRepository } from '../data/reviewDecisionRepository'
import { MockCorrectionProvider } from '../providers/MockCorrectionProvider'
import { createBrowserQuestionSpeechPlayer } from '../features/exam/questionSpeech'
import { ErrorState } from '../components/ErrorState'
import { AppShell } from './AppShell'
import {
  AppDependenciesContext,
  type AppDependencies,
} from './dependencies'
import { AppRouter } from './router'

export interface AppProps {
  dependencies?: AppDependencies
  dependenciesFactory?: () => AppDependencies
  initialEntries?: string[]
}

function AppProviders({
  dependencies,
  children,
}: PropsWithChildren<{ dependencies: AppDependencies }>) {
  return (
    <AppDependenciesContext.Provider value={dependencies}>
      {children}
    </AppDependenciesContext.Provider>
  )
}

interface DevelopmentDataBoundaryState {
  error?: Error
}

class DevelopmentDataBoundary extends Component<
  PropsWithChildren,
  DevelopmentDataBoundaryState
> {
  state: DevelopmentDataBoundaryState = {}

  static getDerivedStateFromError(cause: unknown): DevelopmentDataBoundaryState {
    return {
      error: cause instanceof Error ? cause : new Error(String(cause)),
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('개발 fixture bootstrap validation failed', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="app-content">
          <div className="page">
            <ErrorState
              title="개발 데이터 오류"
              message="Part 4 개발 fixture를 검증하지 못했습니다. 콘솔의 원인을 확인해 주세요."
            />
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

function createDefaultDependencies(): AppDependencies {
  return {
    publicRepository: createPublicContentRepository(),
    userRepository: createUserDataRepository(),
    correctionProvider: new MockCorrectionProvider(),
    questionSpeechPlayer: createBrowserQuestionSpeechPlayer(),
    reviewDecisionRepository: createReviewDecisionRepository(),
  }
}

function AppRuntime({
  dependencies,
  dependenciesFactory,
  initialEntries,
}: AppProps) {
  const resolvedDependencies = useMemo<AppDependencies>(
    () =>
      dependencies ??
      (dependenciesFactory ?? createDefaultDependencies)(),
    [dependencies, dependenciesFactory],
  )

  const content = (
    <AppProviders dependencies={resolvedDependencies}>
      <AppShell>
        <AppRouter />
      </AppShell>
    </AppProviders>
  )

  return initialEntries ? (
    <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>
  ) : (
    <BrowserRouter>{content}</BrowserRouter>
  )
}

export function App(props: AppProps) {
  return (
    <DevelopmentDataBoundary>
      <AppRuntime {...props} />
    </DevelopmentDataBoundary>
  )
}
