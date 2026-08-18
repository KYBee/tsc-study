import { describe, expect, it } from 'vitest'

import { HttpCorrectionProvider } from './HttpCorrectionProvider'
import { MockCorrectionProvider } from './MockCorrectionProvider'
import { createCorrectionProvider } from './createCorrectionProvider'

describe('createCorrectionProvider', () => {
  it('keeps the deterministic mock when no endpoint is configured', () => {
    expect(createCorrectionProvider({})).toBeInstanceOf(MockCorrectionProvider)
  })

  it('selects the HTTP provider for a same-origin correction endpoint', () => {
    expect(
      createCorrectionProvider({
        VITE_TSC_CORRECTION_API_URL: '/api/tsc-correction',
      }),
    ).toBeInstanceOf(HttpCorrectionProvider)
  })

  it('rejects an unsafe correction endpoint', () => {
    expect(() =>
      createCorrectionProvider({
        VITE_TSC_CORRECTION_API_URL: 'javascript:alert(1)',
      }),
    ).toThrow(/HTTPS URL/)
  })
})
