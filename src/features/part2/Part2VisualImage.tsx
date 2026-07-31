import { LocalVisualAssetImage } from '../../components/LocalVisualAssetImage'
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
  return (
    <LocalVisualAssetImage
      asset={asset}
      partNumber={2}
      setNumber={setNumber}
      thumbnail={thumbnail}
      expandable={expandable}
    />
  )
}
