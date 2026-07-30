import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

import type { Plugin } from 'vite'

interface AssetRecord {
  visual_asset_id: string
  repository_path: string
  media_type: 'image/png' | 'image/jpeg' | 'image/gif'
  sha256: string
}

const ROUTE_PREFIX = '/__local-part2-assets/'
const SAFE_ROOT = resolve(
  'data/working/generated-assets/full-import-v1',
)
const FIXTURE_PATH = resolve(
  'data/working/app-fixtures/part2-visual-v1/visual-assets.json',
)
const ASSET_ID = /^va-P2-V(?:0[1-9]|1[0-2])-01$/
const EXTENSIONS: Record<AssetRecord['media_type'], ReadonlySet<string>> = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/gif': new Set(['.gif']),
}

function createAllowlist(): Map<string, AssetRecord & { absolutePath: string }> {
  const records = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as AssetRecord[]
  const allowlist = new Map<string, AssetRecord & { absolutePath: string }>()
  for (const record of records) {
    if (!ASSET_ID.test(record.visual_asset_id)) {
      throw new Error(`Unsafe Part 2 asset ID: ${record.visual_asset_id}`)
    }
    const absolutePath = resolve(record.repository_path)
    const extension = absolutePath.slice(absolutePath.lastIndexOf('.')).toLowerCase()
    if (
      !absolutePath.startsWith(`${SAFE_ROOT}${sep}`) ||
      !EXTENSIONS[record.media_type].has(extension)
    ) {
      throw new Error(`Unsafe Part 2 asset path: ${record.repository_path}`)
    }
    allowlist.set(record.visual_asset_id, { ...record, absolutePath })
  }
  if (allowlist.size !== 12) {
    throw new Error('Part 2 local asset allowlist must contain exactly 12 assets')
  }
  return allowlist
}

export function part2LocalAssetsPlugin(): Plugin {
  return {
    name: 'part2-local-assets',
    apply: 'serve',
    configureServer(server) {
      const allowlist = createAllowlist()
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(
          request.url ?? '/',
          'http://localhost',
        ).pathname
        if (!pathname.startsWith(ROUTE_PREFIX)) {
          next()
          return
        }
        const assetId = decodeURIComponent(pathname.slice(ROUTE_PREFIX.length))
        const record = allowlist.get(assetId)
        if (
          !record ||
          pathname !== `${ROUTE_PREFIX}${encodeURIComponent(assetId)}` ||
          !['GET', 'HEAD'].includes(request.method ?? '')
        ) {
          response.statusCode = 404
          response.end('Not found')
          return
        }
        try {
          const bytes = readFileSync(record.absolutePath)
          const actualHash = createHash('sha256').update(bytes).digest('hex')
          if (actualHash !== record.sha256) {
            response.statusCode = 409
            response.end('Local asset hash mismatch')
            return
          }
          response.setHeader('Content-Type', record.media_type)
          response.setHeader('Content-Length', bytes.byteLength)
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('X-Content-Type-Options', 'nosniff')
          response.statusCode = 200
          response.end(request.method === 'HEAD' ? undefined : bytes)
        } catch {
          response.statusCode = 404
          response.end('Local asset is not prepared')
        }
      })
    },
  }
}
