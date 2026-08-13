import { z } from 'zod'

import type {
  CorrectionProviderResult,
  CorrectionRequest,
} from '../domain/correction'
import type { CorrectionProvider } from './CorrectionProvider'

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface HttpCorrectionProviderOptions {
  endpoint: string
  fetcher?: Fetcher
  timeoutMs?: number
}

const shortText = z.string().max(4_000)
const answerText = z.string().min(1).max(20_000)
const resultSchema = z
  .object({
    corrected_zh: answerText,
    pinyin: answerText,
    ko: answerText,
    changes: z
      .array(
        z
          .object({
            before: shortText,
            after: shortText,
            reason: shortText,
          })
          .strict(),
      )
      .max(100),
    structure_segments: z
      .array(
        z
          .object({ label: shortText, content: answerText })
          .strict(),
      )
      .max(50),
    relevance_note: shortText,
    uncertainties: z
      .array(z.object({ message: shortText }).strict())
      .max(50),
    key_expressions: z.array(shortText).max(50).optional(),
    message: shortText.optional(),
  })
  .strict()

const providerResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('success'),
      original_input: z.string().max(20_000),
      result: resultSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('unsupported_by_mock'),
      original_input: z.string().max(20_000),
      message: shortText,
      explanation: shortText,
    })
    .strict(),
  z
    .object({
      status: z.literal('failure'),
      original_input: z.string().max(20_000),
      message: shortText,
      error_code: z.string().max(100).optional(),
    })
    .strict(),
])

function validateEndpoint(value: string): string {
  const endpoint = value.trim()
  if (endpoint.startsWith('/') && !endpoint.startsWith('//')) return endpoint
  try {
    const url = new URL(endpoint)
    if (url.protocol === 'https:' && !url.username && !url.password) {
      return url.toString()
    }
  } catch {
    // The common error below deliberately avoids exposing parser details.
  }
  throw new Error('교정 endpoint는 same-origin 상대 경로 또는 HTTPS URL이어야 합니다')
}

const failure = (
  request: CorrectionRequest,
  message: string,
  errorCode: string,
): CorrectionProviderResult => ({
  status: 'failure',
  original_input: request.original_input,
  message,
  error_code: errorCode,
})

export class HttpCorrectionProvider implements CorrectionProvider {
  private readonly endpoint: string
  private readonly fetcher: Fetcher
  private readonly timeoutMs: number

  constructor({
    endpoint,
    fetcher = fetch,
    timeoutMs = 15_000,
  }: HttpCorrectionProviderOptions) {
    this.endpoint = validateEndpoint(endpoint)
    this.fetcher = fetcher
    this.timeoutMs = timeoutMs
  }

  async correct(request: CorrectionRequest): Promise<CorrectionProviderResult> {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      if (!response.ok) {
        return failure(
          request,
          '교정 서버가 요청을 처리하지 못했습니다',
          `http_${response.status}`,
        )
      }
      const responseText = await response.text()
      if (responseText.length > 256_000) {
        return failure(request, '교정 응답 형식이 올바르지 않습니다', 'invalid_response')
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(responseText)
      } catch {
        return failure(request, '교정 응답 형식이 올바르지 않습니다', 'invalid_response')
      }
      const result = providerResultSchema.safeParse(parsed)
      if (!result.success || result.data.original_input !== request.original_input) {
        return failure(request, '교정 응답 형식이 올바르지 않습니다', 'invalid_response')
      }
      return result.data
    } catch (cause: unknown) {
      if (controller.signal.aborted) {
        return failure(request, '교정 요청 시간이 초과되었습니다', 'timeout')
      }
      console.error('Correction endpoint request failed', cause)
      return failure(request, '교정 서버에 연결하지 못했습니다', 'network_error')
    } finally {
      window.clearTimeout(timeoutId)
    }
  }
}
