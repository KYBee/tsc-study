import type {
  CorrectionProviderResult,
  CorrectionRequest,
  CorrectionResult,
} from '../domain/correction'
import type { CorrectionProvider } from './CorrectionProvider'

export const EXERCISE_INPUT =
  '我喜欢在家运动。工作很忙，没有时间去健身房。在家看视频运动很方便。'

export const CORRECTED_EXERCISE_INPUT =
  '我喜欢在家运动。因为工作很忙，我没有时间去健身房。在家一边看视频一边运动很方便。'

const PINYIN =
  'Wǒ xǐhuan zài jiā yùndòng. Yīnwèi gōngzuò hěn máng, wǒ méiyǒu shíjiān qù jiànshēnfáng. Zài jiā yìbiān kàn shìpín yìbiān yùndòng hěn fāngbiàn.'

const KOREAN =
  '저는 집에서 운동하는 것을 좋아합니다. 일이 매우 바빠서 저는 헬스장에 갈 시간이 없습니다. 집에서 영상을 보면서 운동하는 것은 매우 편리합니다.'

const STRUCTURE_SEGMENTS = [
  { label: '직접 답변', content: '我喜欢在家运动。' },
  { label: '이유', content: '因为工作很忙，我没有时间去健身房。' },
  {
    label: '설명 또는 경험',
    content: '在家一边看视频一边运动很方便。',
  },
]

const CHANGES = [
  {
    before: '工作很忙，没有时间去健身房。',
    after: '因为工作很忙，我没有时间去健身房。',
    reason: '바쁜 것이 헬스장에 갈 시간이 없는 이유임을 명확히 연결하고 주어를 보완했다.',
  },
  {
    before: '在家看视频运动很方便。',
    after: '在家一边看视频一边运动很方便。',
    reason: '동시에 이루어지는 두 행동의 관계를 자연스럽게 표현했다.',
  },
]

const makeCorrection = (alreadyCorrected: boolean): CorrectionResult => ({
  corrected_zh: CORRECTED_EXERCISE_INPUT,
  pinyin: PINYIN,
  ko: KOREAN,
  changes: alreadyCorrected ? [] : CHANGES.map((change) => ({ ...change })),
  structure_segments: STRUCTURE_SEGMENTS.map((segment) => ({ ...segment })),
  relevance_note: '',
  uncertainties: [],
  ...(alreadyCorrected ? { message: '수정할 부분이 없습니다' } : {}),
})

export class MockCorrectionProvider implements CorrectionProvider {
  async correct(request: CorrectionRequest): Promise<CorrectionProviderResult> {
    const supportsContext =
      request.question_id === 'P4-006' &&
      request.part === 4 &&
      request.correction_mode === 'minimal' &&
      request.input_language === 'zh'

    if (
      supportsContext &&
      (request.original_input === EXERCISE_INPUT ||
        request.original_input === CORRECTED_EXERCISE_INPUT)
    ) {
      return {
        status: 'success',
        original_input: request.original_input,
        result: makeCorrection(request.original_input === CORRECTED_EXERCISE_INPUT),
      }
    }

    return {
      status: 'unsupported_by_mock',
      original_input: request.original_input,
      message: '현재 개발용 mock이 지원하지 않는 입력입니다',
      explanation: '실제 AI가 연결되지 않아 이 입력의 번역이나 교정을 생성하지 않습니다.',
    }
  }
}
