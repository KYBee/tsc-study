import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  CorrectionProviderResult,
  CorrectionRequest,
} from '../domain/correction'
import { HttpCorrectionProvider } from './HttpCorrectionProvider'

const request: CorrectionRequest = {
  question_id: 'P3-001',
  part: 3,
  question_zh: '你周末一般做什么？',
  input_language: 'zh',
  original_input: '我周末两个次运动。',
  correction_mode: 'minimal',
}

const success: CorrectionProviderResult = {
  status: 'success',
  original_input: request.original_input,
  result: {
    corrected_zh: '我一般周末运动两次。',
    pinyin: 'Wǒ yìbān zhōumò yùndòng liǎng cì.',
    ko: '저는 보통 주말에 두 번 운동합니다.',
    changes: [
      {
        before: '两个次',
        after: '两次',
        reason: '횟수를 셀 때는 两次라고 합니다.',
      },
    ],
    structure_segments: [
      { label: '직접 답변', content: '我一般周末运动两次。' },
    ],
    relevance_note: '',
    uncertainties: [],
    key_expressions: ['周末运动两次'],
  },
}

afterEach(() => vi.useRealTimers())

describe('HttpCorrectionProvider', () => {
  it('returns a validated minimal-correction response without changing its content', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(success), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const provider = new HttpCorrectionProvider({
      endpoint: 'https://example.test/correct',
      fetcher,
    })

    await expect(provider.correct(request)).resolves.toEqual(success)
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/correct',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify(request),
      }),
    )
  })

  it('preserves the original input for HTTP and schema failures', async () => {
    const httpProvider = new HttpCorrectionProvider({
      endpoint: '/api/tsc-correction',
      fetcher: vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })),
    })
    const schemaProvider = new HttpCorrectionProvider({
      endpoint: '/api/tsc-correction',
      fetcher: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'success', result: {} }), { status: 200 }),
      ),
    })

    await expect(httpProvider.correct(request)).resolves.toMatchObject({
      status: 'failure',
      original_input: request.original_input,
      error_code: 'http_503',
    })
    await expect(schemaProvider.correct(request)).resolves.toMatchObject({
      status: 'failure',
      original_input: request.original_input,
      error_code: 'invalid_response',
    })
  })

  it('aborts a request that exceeds the configured timeout', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    )
    const provider = new HttpCorrectionProvider({
      endpoint: '/api/tsc-correction',
      fetcher,
      timeoutMs: 100,
    })

    const resultPromise = provider.correct(request)
    await vi.advanceTimersByTimeAsync(100)
    await expect(resultPromise).resolves.toMatchObject({
      status: 'failure',
      original_input: request.original_input,
      error_code: 'timeout',
    })
  })
})
