import { describe, expect, it } from 'vitest'

import type { VisualAsset } from '../domain/entities'
import { createLocalVisualAssetUrl } from './localVisualAssetUrl'

const base = {
  source_id: 'src-001',
  source_locator: "'Part7 스토리 그림'!A2",
  repository_path:
    'data/working/generated-assets/full-import-v1/part7__P7-V01.png',
  media_type: 'image/png',
  file_size: 100,
  sha256: 'a'.repeat(64),
  rights_status: 'review_needed',
  asset_status: 'raw',
} satisfies Omit<VisualAsset, 'visual_asset_id'>

describe('createLocalVisualAssetUrl', () => {
  it.each([
    ['va-P2-V01-01', '/__local-visual-assets/va-P2-V01-01'],
    ['va-P7-V12-01', '/__local-visual-assets/va-P7-V12-01'],
    ['va-P7-V12-04', '/__local-visual-assets/va-P7-V12-04'],
  ])('allows registered Part 2 and 7 IDs in development', (visualAssetId, url) => {
    expect(
      createLocalVisualAssetUrl(
        { ...base, visual_asset_id: visualAssetId },
        true,
      ),
    ).toBe(url)
  })

  it('returns no URL in production', () => {
    expect(
      createLocalVisualAssetUrl(
        { ...base, visual_asset_id: 'va-P7-V01-01' },
        false,
      ),
    ).toBeUndefined()
  })

  it.each([
    '../secret',
    'va-P7-V00-01',
    'va-P7-V13-01',
    'va-P7-V01-../../secret',
    'va-official-sample-workbook-01',
  ])('rejects an unregistered or unsafe ID: %s', (visualAssetId) => {
    expect(
      createLocalVisualAssetUrl(
        { ...base, visual_asset_id: visualAssetId },
        true,
      ),
    ).toBeUndefined()
  })

  it('rejects a right state other than review_needed', () => {
    expect(
      createLocalVisualAssetUrl(
        {
          ...base,
          visual_asset_id: 'va-P7-V01-01',
          rights_status: 'public_allowed',
        },
        true,
      ),
    ).toBeUndefined()
  })
})
