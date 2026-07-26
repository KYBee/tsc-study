import { describe, expect, it } from 'vitest'

import type { CorrectionRequest } from '../domain/correction'
import {
  CORRECTED_EXERCISE_INPUT,
  EXERCISE_INPUT,
  MockCorrectionProvider,
} from './MockCorrectionProvider'

const makeRequest = (originalInput: string): CorrectionRequest => ({
  question_id: 'P4-006',
  part: 4,
  question_zh: '你喜欢在哪儿运动？',
  input_language: 'zh',
  original_input: originalInput,
  correction_mode: 'minimal',
})

describe('MockCorrectionProvider', () => {
  const provider = new MockCorrectionProvider()

  it('returns the documented minimal correction for the exact exercise input', async () => {
    const result = await provider.correct(makeRequest(EXERCISE_INPUT))

    expect(result).toEqual({
      status: 'success',
      original_input: EXERCISE_INPUT,
      result: {
        corrected_zh: CORRECTED_EXERCISE_INPUT,
        pinyin:
          'Wǒ xǐhuan zài jiā yùndòng. Yīnwèi gōngzuò hěn máng, wǒ méiyǒu shíjiān qù jiànshēnfáng. Zài jiā yìbiān kàn shìpín yìbiān yùndòng hěn fāngbiàn.',
        ko: '저는 집에서 운동하는 것을 좋아합니다. 일이 매우 바빠서 저는 헬스장에 갈 시간이 없습니다. 집에서 영상을 보면서 운동하는 것은 매우 편리합니다.',
        changes: [
          {
            before: '工作很忙，没有时间去健身房。',
            after: '因为工作很忙，我没有时间去健身房。',
            reason:
              '바쁜 것이 헬스장에 갈 시간이 없는 이유임을 명확히 연결하고 주어를 보완했다.',
          },
          {
            before: '在家看视频运动很方便。',
            after: '在家一边看视频一边运动很方便。',
            reason: '동시에 이루어지는 두 행동의 관계를 자연스럽게 표현했다.',
          },
        ],
        structure_segments: [
          { label: '직접 답변', content: '我喜欢在家运动。' },
          {
            label: '이유',
            content: '因为工作很忙，我没有时间去健身房。',
          },
          {
            label: '설명 또는 경험',
            content: '在家一边看视频一边运动很方便。',
          },
        ],
        relevance_note: '',
        uncertainties: [],
      },
    })
  })

  it('does not invent a change for the exact already-corrected input', async () => {
    const result = await provider.correct(makeRequest(CORRECTED_EXERCISE_INPUT))

    expect(result.status).toBe('success')
    if (result.status !== 'success') {
      throw new Error('expected success')
    }
    expect(result.result.corrected_zh).toBe(CORRECTED_EXERCISE_INPUT)
    expect(result.result.changes).toEqual([])
    expect(result.result.message).toBe('수정할 부분이 없습니다')
  })

  it('preserves unsupported input without pretending to translate or correct it', async () => {
    const request = {
      ...makeRequest('저는 집에서 운동해요'),
      input_language: 'ko' as const,
    }

    const result = await provider.correct(request)

    expect(result).toEqual({
      status: 'unsupported_by_mock',
      original_input: request.original_input,
      message: '현재 개발용 mock이 지원하지 않는 입력입니다',
      explanation: '실제 AI가 연결되지 않아 이 입력의 번역이나 교정을 생성하지 않습니다.',
    })
    expect(result).not.toHaveProperty('corrected_zh')
    expect(result).not.toHaveProperty('result')
  })

  it('returns the same result for the same request', async () => {
    const request = makeRequest(EXERCISE_INPUT)

    await expect(provider.correct(request)).resolves.toEqual(await provider.correct(request))
  })
})
