import { useState } from 'react'

import { createLocalVisualAssetUrl } from '../data/localVisualAssetUrl'
import type { PartNumber, VisualAsset } from '../domain/entities'

interface LocalVisualAssetImageProps {
  asset?: VisualAsset
  partNumber: Extract<PartNumber, 2 | 7>
  setNumber: number
  frameNumber?: number
  thumbnail?: boolean
  expandable?: boolean
}

export function LocalVisualAssetImage({
  asset,
  partNumber,
  setNumber,
  frameNumber,
  thumbnail = false,
  expandable = false,
}: LocalVisualAssetImageProps) {
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const source = asset
    ? createLocalVisualAssetUrl(asset, import.meta.env.DEV)
    : undefined
  const unavailable = !source || failed
  const frameLabel = frameNumber ? ` 장면 ${frameNumber}` : ''

  if (unavailable) {
    return (
      <div className="visual-asset-missing" role="status">
        <strong>로컬 그림 자산이 준비되지 않았습니다.</strong>
        <code>npm run assets:visual-local</code>
        {!import.meta.env.DEV && (
          <small>권리 검수 전 그림은 production에서 표시하지 않습니다.</small>
        )}
      </div>
    )
  }

  const image = (
    <img
      className={thumbnail ? 'visual-image visual-image--thumbnail' : 'visual-image'}
      src={source}
      alt={`Part ${partNumber} 세트 ${setNumber} 검수 전 그림${frameLabel}`}
      width={asset?.width}
      height={asset?.height}
      loading={thumbnail ? 'lazy' : 'eager'}
      onError={() => setFailed(true)}
    />
  )

  return (
    <>
      {expandable ? (
        <button
          className="visual-image-button"
          type="button"
          aria-label={`세트 ${setNumber} 그림${frameLabel} 확대`}
          onClick={() => setExpanded(true)}
        >
          {image}
        </button>
      ) : image}
      {expanded && (
        <div
          className="visual-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="그림 확대 보기"
        >
          <div className="visual-lightbox__content">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setExpanded(false)}
            >
              확대 닫기
            </button>
            <img
              src={source}
              alt={`Part ${partNumber} 세트 ${setNumber} 검수 전 그림${frameLabel} 확대`}
              width={asset?.width}
              height={asset?.height}
            />
          </div>
        </div>
      )}
    </>
  )
}
