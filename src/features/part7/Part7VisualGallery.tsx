import { LocalVisualAssetImage } from '../../components/LocalVisualAssetImage'
import type { VisualAsset } from '../../domain/entities'

interface Part7VisualGalleryProps {
  assets: VisualAsset[]
  setNumber: number
  thumbnail?: boolean
  expandable?: boolean
}

export function Part7VisualGallery({
  assets,
  setNumber,
  thumbnail = false,
  expandable = false,
}: Part7VisualGalleryProps) {
  if (assets.length === 0) {
    return (
      <LocalVisualAssetImage partNumber={7} setNumber={setNumber} />
    )
  }

  return (
    <div
      className={`story-visual-gallery${thumbnail ? ' story-visual-gallery--thumbnail' : ''}`}
      aria-label={`Part 7 세트 ${setNumber} 이야기 그림 순서`}
    >
      {assets.map((asset, index) => (
        <figure key={asset.visual_asset_id}>
          <LocalVisualAssetImage
            asset={asset}
            partNumber={7}
            setNumber={setNumber}
            frameNumber={index + 1}
            thumbnail={thumbnail}
            expandable={expandable}
          />
          <figcaption>장면 {index + 1}</figcaption>
        </figure>
      ))}
    </div>
  )
}
