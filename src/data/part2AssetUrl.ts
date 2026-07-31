import type { VisualAsset } from '../domain/entities'

import { createLocalVisualAssetUrl } from './localVisualAssetUrl'

export function createPart2LocalAssetUrl(
  asset: VisualAsset,
  development: boolean,
): string | undefined {
  if (!asset.visual_asset_id.startsWith('va-P2-')) {
    return undefined
  }
  const url = createLocalVisualAssetUrl(asset, development)
  return url?.replace('/__local-visual-assets/', '/__local-part2-assets/')
}
