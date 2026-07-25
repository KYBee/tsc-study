import { useId, useState } from 'react'

import type { LanguageSet } from '../domain/entities'

interface LanguageBlockProps {
  language: LanguageSet
  label?: string
  pinyinInitiallyVisible?: boolean
}

export function LanguageBlock({
  language,
  label = '언어 정보',
  pinyinInitiallyVisible = true,
}: LanguageBlockProps) {
  const [showPinyin, setShowPinyin] = useState(pinyinInitiallyVisible)
  const pinyinId = useId()

  return (
    <section className="language-block" aria-label={label}>
      <div className="language-row">
        <span className="language-label">중국어</span>
        {language.zh ? (
          <p className="language-zh" lang="zh-CN">
            {language.zh}
          </p>
        ) : (
          <p className="missing-value">제공되지 않음</p>
        )}
      </div>

      <div className="language-row">
        <div className="language-row__heading">
          <span className="language-label">병음</span>
          {language.pinyin && (
            <button
              className="text-button"
              type="button"
              aria-controls={pinyinId}
              aria-expanded={showPinyin}
              onClick={() => setShowPinyin((visible) => !visible)}
            >
              {showPinyin ? '병음 숨기기' : '병음 보기'}
            </button>
          )}
        </div>
        <div id={pinyinId}>
          {language.pinyin ? (
            showPinyin ? (
              <p className="language-pinyin">{language.pinyin}</p>
            ) : (
              <p className="missing-value">병음이 숨겨져 있습니다</p>
            )
          ) : (
            <p className="missing-value">제공되지 않음</p>
          )}
        </div>
      </div>

      <div className="language-row">
        <span className="language-label">한국어</span>
        {language.ko ? (
          <p className="language-ko" lang="ko">
            {language.ko}
          </p>
        ) : (
          <p className="missing-value">제공되지 않음</p>
        )}
      </div>
    </section>
  )
}
