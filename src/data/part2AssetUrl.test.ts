import { describe, expect, it } from 'vitest'

import type { VisualAsset } from '../domain/entities'
import { createPart2LocalAssetUrl } from './part2AssetUrl'

const asset = {
  visual_asset_id: 'va-P2-V01-01',
  source_id: 'src-001',
  source_locator: "'Part2 그림 연습'!A2",
  repository_path:
    'data/working/generated-assets/full-import-v1/part2__P2-V01.png',
  media_type: 'image/png',
  file_size: 100,
  sha256: 'a'.repeat(64),
  rights_status: 'review_needed',
  asset_status: 'raw',
} satisfies VisualAsset

describe('createPart2LocalAssetUrl', () => {
  it('creates a development-only URL from a registered stable asset ID', () => {
    expect(createPart2LocalAssetUrl(asset, true)).toBe(
      '/__local-part2-assets/va-P2-V01-01',
    )
  })

  it('returns no URL in production', () => {
    expect(createPart2LocalAssetUrl(asset, false)).toBeUndefined()
  })

  it('rejects unsafe IDs and non-review-needed rights states', () => {
    expect(
      createPart2LocalAssetUrl(
        { ...asset, visual_asset_id: '../secret' },
        true,
      ),
    ).toBeUndefined()
    expect(
      createPart2LocalAssetUrl(
        { ...asset, rights_status: 'public_allowed' },
        true,
      ),
    ).toBeUndefined()
  })
})
