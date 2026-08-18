import type { InputLanguage } from '../domain/entities'

export function detectInputLanguage(
  text: string,
  fallback: InputLanguage = 'mixed',
): InputLanguage {
  const hasChinese = /[\u3400-\u9fff]/u.test(text)
  const hasKorean = /[\uac00-\ud7a3]/u.test(text)
  if (hasChinese && !hasKorean) return 'zh'
  if (hasKorean && !hasChinese) return 'ko'
  if (hasChinese && hasKorean) return 'mixed'
  return fallback
}
