import type { VisualAsset } from '../domain/entities'

const PART2_ASSET_ID = /^va-P2-V(?:0[1-9]|1[0-2])-01$/

export function createPart2LocalAssetUrl(
  asset: VisualAsset,
  development: boolean,
): string | undefined {
  if (
    !development ||
    asset.rights_status !== 'review_needed' ||
    !PART2_ASSET_ID.test(asset.visual_asset_id)
  ) {
    return undefined
  }
  return `/__local-part2-assets/${encodeURIComponent(asset.visual_asset_id)}`
}
