import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  collectProductionVisualAssets,
  createLocalVisualAssetAllowlist,
  readVerifiedVisualAsset,
  routeLocalVisualAssetId,
} from './viteLocalVisualAssets'

describe('local visual asset boundary', () => {
  it('allows exactly the registered Part 2 and Part 7 asset IDs', () => {
    const allowlist = createLocalVisualAssetAllowlist()
    expect(allowlist.size).toBe(60)
    expect([...allowlist.keys()].filter((id) => id.startsWith('va-P2-'))).toHaveLength(12)
    expect([...allowlist.keys()].filter((id) => id.startsWith('va-P7-'))).toHaveLength(48)
  })

  it('allows every explicitly registered Part 7 story frame', () => {
    expect(
      routeLocalVisualAssetId('/__local-visual-assets/va-P7-V01-04'),
    ).toBe('va-P7-V01-04')
    expect(
      routeLocalVisualAssetId('/__local-visual-assets/va-P2-V01-02'),
    ).toBe('')
  })

  it('keeps the legacy endpoint Part 2-only', () => {
    expect(
      routeLocalVisualAssetId('/__local-part2-assets/va-P2-V01-01'),
    ).toBe('va-P2-V01-01')
    expect(
      routeLocalVisualAssetId('/__local-part2-assets/va-P7-V01-01'),
    ).toBe('')
  })

  it('rejects traversal, extra path segments, and malformed encoding', () => {
    expect(
      routeLocalVisualAssetId('/__local-visual-assets/..%2Fsecret'),
    ).toBe('')
    expect(
      routeLocalVisualAssetId('/__local-visual-assets/va-P7-V01-01/extra'),
    ).toBe('')
    expect(routeLocalVisualAssetId('/__local-visual-assets/%E0%A4%A')).toBe('')
    expect(routeLocalVisualAssetId('/unrelated')).toBeUndefined()
  })

  it('emits no production assets unless the deployment explicitly opts in', () => {
    expect(collectProductionVisualAssets(false)).toEqual([])
  })

  it('collects exactly 12 Part 2 and 48 Part 7 verified PNGs', () => {
    const assets = collectProductionVisualAssets(true)
    expect(assets).toHaveLength(60)
    expect(assets.filter(({ assetId }) => assetId.startsWith('va-P2-'))).toHaveLength(12)
    expect(assets.filter(({ assetId }) => assetId.startsWith('va-P7-'))).toHaveLength(48)
    expect(new Set(assets.map(({ assetId }) => assetId)).size).toBe(60)
    expect(new Set(assets.map(({ fileName }) => fileName)).size).toBe(60)
    for (const asset of assets) {
      expect(asset.fileName).toBe(`tsc-visual-assets/${asset.assetId}.png`)
      expect(asset.record.rights_status).toBe('review_needed')
      expect(asset.source.byteLength).toBe(asset.record.file_size)
      expect(createHash('sha256').update(asset.source).digest('hex')).toBe(
        asset.record.sha256,
      )
    }
  })

  it('fails closed when bytes no longer match the registered SHA', () => {
    const record = createLocalVisualAssetAllowlist().get('va-P2-V01-01')
    expect(record).toBeDefined()
    if (!record) return
    const directory = mkdtempSync(join(tmpdir(), 'tsc-visual-integrity-'))
    const copiedPath = join(directory, 'asset.png')
    const bytes = readFileSync(record.absolutePath)
    writeFileSync(copiedPath, Buffer.concat([bytes, Buffer.from([0])]))

    expect(() =>
      readVerifiedVisualAsset(
        { ...record, absolutePath: copiedPath },
        directory,
      ),
    ).toThrow(/integrity mismatch/i)
  })
})
