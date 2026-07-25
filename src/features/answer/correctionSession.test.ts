import { beforeEach, describe, expect, it } from 'vitest'

import type { CorrectionProviderResult } from '../../domain/correction'
import {
  clearCorrectionSession,
  createCorrectionSession,
  getCorrectionSessionKey,
  loadCorrectionSession,
  saveCorrectionSession,
} from './correctionSession'

const unsupportedResult: CorrectionProviderResult = {
  status: 'unsupported_by_mock',
  original_input: '지원하지 않는 입력',
  message: '현재 개발용 mock이 지원하지 않는 입력입니다',
  explanation: '실제 AI가 연결되지 않아 이 입력의 번역이나 교정을 생성하지 않습니다.',
}

describe('correction sessionStorage helper', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('uses a dataset-scoped key for each question', () => {
    expect(getCorrectionSessionKey('P4-006')).toBe(
      'tsc-study:part4-fixture:v1:correction-session:P4-006',
    )
  })

  it('round-trips a question-specific draft and provider result', () => {
    const session = createCorrectionSession(
      {
        question_id: 'P4-006',
        correction_mode: 'minimal',
        input_language: 'zh',
        original_input: '지원하지 않는 입력',
        provider_result: unsupportedResult,
      },
      () => '2026-07-26T10:00:00.000Z',
    )

    saveCorrectionSession(session)

    expect(loadCorrectionSession('P4-006')).toEqual(session)
    expect(loadCorrectionSession('P4-001')).toBeUndefined()
  })

  it('stores a draft before a provider result exists and clears it explicitly', () => {
    const session = createCorrectionSession(
      {
        question_id: 'P4-001',
        correction_mode: 'minimal',
        input_language: 'mixed',
        original_input: '친구하고 爱好一样',
        provider_result: null,
      },
      () => '2026-07-26T10:00:00.000Z',
    )

    saveCorrectionSession(session)
    clearCorrectionSession('P4-001')

    expect(loadCorrectionSession('P4-001')).toBeUndefined()
  })
})
