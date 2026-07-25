import type { CorrectionProviderResult, CorrectionRequest } from '../domain/correction'

export interface CorrectionProvider {
  correct(request: CorrectionRequest): Promise<CorrectionProviderResult>
}
