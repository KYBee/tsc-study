import { describe, expect, it } from 'vitest'

import type { VisualAsset } from '../domain/entities'
import {
  createLocalVisualAssetUrl,
  createVisualAssetUrl,
  isReviewVisualAssetsEnabled,
} from './localVisualAssetUrl'

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

  it('returns no production URL when the deployment opt-in is disabled', () => {
    expect(
      createVisualAssetUrl(
        { ...base, visual_asset_id: 'va-P2-V01-01' },
        {
          development: false,
          productionEnabled: false,
          baseUrl: '/',
        },
      ),
    ).toBeUndefined()
  })

  it('returns an emitted production URL when the deployment opts in', () => {
    expect(
      createVisualAssetUrl(
        { ...base, visual_asset_id: 'va-P7-V01-01' },
        {
          development: false,
          productionEnabled: true,
          baseUrl: '/',
        },
      ),
    ).toBe('/tsc-visual-assets/va-P7-V01-01.png')
  })

  it('honors a Vite sub-path base URL in production', () => {
    expect(
      createVisualAssetUrl(
        { ...base, visual_asset_id: 'va-P7-V01-01' },
        {
          development: false,
          productionEnabled: true,
          baseUrl: '/tsc-study/',
        },
      ),
    ).toBe('/tsc-study/tsc-visual-assets/va-P7-V01-01.png')
  })

  it('enables review visuals only for development or the exact true flag', () => {
    expect(isReviewVisualAssetsEnabled(true, undefined)).toBe(true)
    expect(isReviewVisualAssetsEnabled(false, 'true')).toBe(true)
    expect(isReviewVisualAssetsEnabled(false, 'TRUE')).toBe(false)
    expect(isReviewVisualAssetsEnabled(false, '1')).toBe(false)
    expect(isReviewVisualAssetsEnabled(false, undefined)).toBe(false)
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
    expect(
      createVisualAssetUrl(
        {
          ...base,
          visual_asset_id: 'va-P7-V01-01',
          rights_status: 'public_allowed',
        },
        {
          development: false,
          productionEnabled: true,
          baseUrl: '/',
        },
      ),
    ).toBeUndefined()
  })
})
