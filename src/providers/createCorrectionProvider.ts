import type { CorrectionProvider } from './CorrectionProvider'
import { HttpCorrectionProvider } from './HttpCorrectionProvider'
import { MockCorrectionProvider } from './MockCorrectionProvider'

interface CorrectionProviderEnvironment {
  VITE_TSC_CORRECTION_API_URL?: string
}

export function createCorrectionProvider(
  environment: CorrectionProviderEnvironment,
): CorrectionProvider {
  const endpoint = environment.VITE_TSC_CORRECTION_API_URL?.trim()
  return endpoint
    ? new HttpCorrectionProvider({ endpoint })
    : new MockCorrectionProvider()
}
