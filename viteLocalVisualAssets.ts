import { createHash } from 'node:crypto'
import {
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { extname, resolve, sep } from 'node:path'

import type { Plugin } from 'vite'

interface AssetRecord {
  visual_asset_id: string
  repository_path: string
  media_type: 'image/png' | 'image/jpeg' | 'image/gif'
  file_size: number
  sha256: string
}

const ROUTE_PREFIX = '/__local-visual-assets/'
const LEGACY_PART2_PREFIX = '/__local-part2-assets/'
const SAFE_ROOT = resolve('data/working/app-assets/tsc-individual-images-v1')
const FIXTURE_PATHS = [
  resolve(
    'data/working/app-fixtures/part2-visual-v1/visual-assets.json',
  ),
  resolve(
    'data/working/app-fixtures/part7-visual-v1/visual-assets.json',
  ),
]
const ASSET_ID = /^(?:va-P2-V(?:0[1-9]|1[0-2])-01|va-P7-V(?:0[1-9]|1[0-2])-0[1-4])$/
const EXTENSIONS: Record<AssetRecord['media_type'], ReadonlySet<string>> = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/gif': new Set(['.gif']),
}
const MAGIC: Record<AssetRecord['media_type'], ReadonlyArray<Uint8Array>> = {
  'image/png': [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/jpeg': [Uint8Array.from([0xff, 0xd8, 0xff])],
  'image/gif': [
    Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
}

function startsWith(bytes: Buffer, signature: Uint8Array): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

export function createLocalVisualAssetAllowlist(): Map<
  string,
  AssetRecord & { absolutePath: string }
> {
  const allowlist = new Map<string, AssetRecord & { absolutePath: string }>()
  for (const fixturePath of FIXTURE_PATHS) {
    const records = JSON.parse(
      readFileSync(fixturePath, 'utf8'),
    ) as AssetRecord[]
    for (const record of records) {
      if (!ASSET_ID.test(record.visual_asset_id)) {
        throw new Error(`Unsafe local visual asset ID: ${record.visual_asset_id}`)
      }
      const absolutePath = resolve(record.repository_path)
      if (
        !absolutePath.startsWith(`${SAFE_ROOT}${sep}`) ||
        !EXTENSIONS[record.media_type].has(extname(absolutePath).toLowerCase())
      ) {
        throw new Error(`Unsafe local visual asset path: ${record.repository_path}`)
      }
      if (allowlist.has(record.visual_asset_id)) {
        throw new Error(`Duplicate local visual asset ID: ${record.visual_asset_id}`)
      }
      allowlist.set(record.visual_asset_id, { ...record, absolutePath })
    }
  }
  if (allowlist.size !== 60) {
    throw new Error('Local visual asset allowlist must contain exactly 60 assets')
  }
  return allowlist
}

export function routeLocalVisualAssetId(pathname: string): string | undefined {
  const prefix = pathname.startsWith(ROUTE_PREFIX)
    ? ROUTE_PREFIX
    : pathname.startsWith(LEGACY_PART2_PREFIX)
      ? LEGACY_PART2_PREFIX
      : undefined
  if (!prefix) return undefined
  let assetId: string
  try {
    assetId = decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    return ''
  }
  if (pathname !== `${prefix}${encodeURIComponent(assetId)}`) return ''
  if (!ASSET_ID.test(assetId)) return ''
  if (prefix === LEGACY_PART2_PREFIX && !assetId.startsWith('va-P2-')) return ''
  return assetId
}

export function localVisualAssetsPlugin(): Plugin {
  return {
    name: 'local-visual-assets',
    apply: 'serve',
    configureServer(server) {
      const allowlist = createLocalVisualAssetAllowlist()
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(
          request.url ?? '/',
          'http://localhost',
        ).pathname
        const assetId = routeLocalVisualAssetId(pathname)
        if (assetId === undefined) {
          next()
          return
        }
        const record = allowlist.get(assetId)
        if (!record || !['GET', 'HEAD'].includes(request.method ?? '')) {
          response.statusCode = 404
          response.end('Not found')
          return
        }
        try {
          const realRoot = realpathSync(SAFE_ROOT)
          const realPath = realpathSync(record.absolutePath)
          if (!realPath.startsWith(`${realRoot}${sep}`)) {
            response.statusCode = 404
            response.end('Not found')
            return
          }
          const bytes = readFileSync(realPath)
          const stat = statSync(realPath)
          const actualHash = createHash('sha256').update(bytes).digest('hex')
          const validMagic = MAGIC[record.media_type].some((signature) =>
            startsWith(bytes, signature),
          )
          if (
            actualHash !== record.sha256 ||
            stat.size !== record.file_size ||
            !validMagic
          ) {
            response.statusCode = 409
            response.end('Local asset integrity mismatch')
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
