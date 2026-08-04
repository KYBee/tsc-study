import { describe, expect, it } from 'vitest'

import {
  createLocalVisualAssetAllowlist,
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
})
