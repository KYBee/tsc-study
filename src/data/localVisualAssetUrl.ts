import type { VisualAsset } from '../domain/entities'

const LOCAL_ASSET_ID = /^va-P(?:2|7)-V(?:0[1-9]|1[0-2])-01$/

export function createLocalVisualAssetUrl(
  asset: VisualAsset,
  development: boolean,
): string | undefined {
  if (
    !development ||
    asset.rights_status !== 'review_needed' ||
    !LOCAL_ASSET_ID.test(asset.visual_asset_id)
  ) {
    return undefined
  }
  return `/__local-visual-assets/${encodeURIComponent(asset.visual_asset_id)}`
}
