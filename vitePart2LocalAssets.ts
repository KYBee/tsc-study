// Compatibility export for code that still imports the old Part 2 plugin name.
// The common plugin preserves /__local-part2-assets/:id for Part 2 only and
// serves Part 2/7 through the shared, validated allowlist.
export { localVisualAssetsPlugin as part2LocalAssetsPlugin } from './viteLocalVisualAssets.js'
