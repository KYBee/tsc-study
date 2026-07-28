import { createContext, useContext } from 'react'

import type { UserDataRepository } from '../data/userDataRepository'
import type { ReviewDecisionRepository } from '../data/reviewDecisionRepository'
import type { PublicContentRepository } from '../domain/repositories'
import type { CorrectionProvider } from '../providers/CorrectionProvider'

export interface AppDependencies {
  publicRepository: PublicContentRepository
  userRepository: UserDataRepository
  correctionProvider: CorrectionProvider
  reviewDecisionRepository?: ReviewDecisionRepository
}

export const AppDependenciesContext = createContext<
  AppDependencies | undefined
>(undefined)

export function useAppDependencies(): AppDependencies {
  const dependencies = useContext(AppDependenciesContext)
  if (!dependencies) {
    throw new Error('App dependencies are unavailable')
  }
  return dependencies
}
