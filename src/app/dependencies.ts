import { createContext, useContext } from 'react'

import type { UserDataRepository } from '../data/userDataRepository'
import type { PublicContentRepository } from '../domain/repositories'
import type { CorrectionProvider } from '../providers/CorrectionProvider'

export interface AppDependencies {
  publicRepository: PublicContentRepository
  userRepository: UserDataRepository
  correctionProvider: CorrectionProvider
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
