import { useState } from 'react'

import { createPart2LocalAssetUrl } from '../../data/part2AssetUrl'
import type { VisualAsset } from '../../domain/entities'

interface Part2VisualImageProps {
  asset?: VisualAsset
  setNumber: number
  thumbnail?: boolean
  expandable?: boolean
}

export function Part2VisualImage({
  asset,
  setNumber,
  thumbnail = false,
  expandable = false,
}: Part2VisualImageProps) {
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const source = asset
    ? createPart2LocalAssetUrl(asset, import.meta.env.DEV)
    : undefined
  const unavailable = !source || failed

  if (unavailable) {
    return (
      <div className="visual-asset-missing" role="status">
        <strong>로컬 그림 자산이 준비되지 않았습니다.</strong>
        <code>python3 scripts/build_full_workbook_import.py --extract-assets</code>
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
      alt={`Part 2 세트 ${setNumber} 검수 전 그림`}
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
          aria-label={`세트 ${setNumber} 그림 확대`}
          onClick={() => setExpanded(true)}
        >
          {image}
        </button>
      ) : image}
      {expanded && (
        <div className="visual-lightbox" role="dialog" aria-modal="true" aria-label="그림 확대 보기">
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
              alt={`Part 2 세트 ${setNumber} 검수 전 그림 확대`}
              width={asset?.width}
              height={asset?.height}
            />
          </div>
        </div>
      )}
    </>
  )
}
