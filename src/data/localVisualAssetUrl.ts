import type { VisualAsset } from '../domain/entities'

const LOCAL_ASSET_ID = /^(?:va-P2-V(?:0[1-9]|1[0-2])-01|va-P7-V(?:0[1-9]|1[0-2])-0[1-4])$/
const PRODUCTION_ASSET_DIRECTORY = 'tsc-visual-assets'

export interface VisualAssetUrlEnvironment {
  development: boolean
  productionEnabled: boolean
  baseUrl: string
}

export function isReviewVisualAssetsEnabled(
  development: boolean,
  productionFlag: string | undefined,
): boolean {
  return development || productionFlag === 'true'
}

export const REVIEW_VISUAL_ASSETS_ENABLED = isReviewVisualAssetsEnabled(
  import.meta.env.DEV,
  import.meta.env.VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS,
)

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export function createVisualAssetUrl(
  asset: VisualAsset,
  environment: VisualAssetUrlEnvironment,
): string | undefined {
  if (
    asset.rights_status !== 'review_needed' ||
    !LOCAL_ASSET_ID.test(asset.visual_asset_id)
  ) {
    return undefined
  }
  const encodedAssetId = encodeURIComponent(asset.visual_asset_id)
  if (environment.development) {
    return `/__local-visual-assets/${encodedAssetId}`
  }
  if (!environment.productionEnabled) return undefined
  return `${normalizeBaseUrl(environment.baseUrl)}${PRODUCTION_ASSET_DIRECTORY}/${encodedAssetId}.png`
}

export function createRuntimeVisualAssetUrl(
  asset: VisualAsset,
): string | undefined {
  return createVisualAssetUrl(asset, {
    development: import.meta.env.DEV,
    productionEnabled: REVIEW_VISUAL_ASSETS_ENABLED,
    baseUrl: import.meta.env.BASE_URL,
  })
}

export function createLocalVisualAssetUrl(
  asset: VisualAsset,
  development: boolean,
): string | undefined {
  return createVisualAssetUrl(asset, {
    development,
    productionEnabled: false,
    baseUrl: '/',
  })
}
