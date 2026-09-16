/**
 * 将 xiaohei-pack.json 按模块切成 shard + 轻量 manifest
 * 用法：node code-assist/scripts/split-shards.mjs [pack.json]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = path.resolve(__dirname, '..')
const ROOT = path.resolve(TOOL_ROOT, '..')
const PACK_PATH = path.join(TOOL_ROOT, 'xiaohei-pack.json')
const OUT_DIR = path.join(TOOL_ROOT, 'xiaohei-shards')
const MANIFEST_PATH = path.join(TOOL_ROOT, 'xiaohei-manifest.json')
/** 单 shard 过大则再按路径哈希拆分 */
const MAX_SHARD_BYTES = 3 * 1024 * 1024

function topDir(rel) {
  const i = String(rel || '').indexOf('/')
  if (i < 0) return '_root'
  return rel.slice(0, i)
}

function modulePrefixInner(parts) {
  if (!parts.length) return '_root'
  if (parts[0] === 'src' && parts[1] === 'components' && parts.length >= 3) {
    return 'src/components/' + parts[2]
  }
  if (parts[0] === 'src' && parts[1] && parts[1].indexOf('ghb_') === 0) {
    return 'src/' + parts[1]
  }
  if (parts[0] === 'src' && parts[1] === 'modules' && parts[2]) {
    return 'src/modules/' + parts[2]
  }
  // wxbank 等：src/pages/payroll/... → src/pages/payroll
  if (parts[0] === 'src' && parts[1] === 'pages' && parts[2]) {
    return 'src/pages/' + parts[2]
  }
  if (parts[0] === 'src' && parts[1] === 'views' && parts[2]) {
    return 'src/views/' + parts[2]
  }
  if (
    (parts[0] === 'src' || parts[0] === 'lib' || parts[0] === 'cloudfunctions') &&
    parts.length >= 2
  ) {
    return parts[0] + '/' + parts[1]
  }
  return parts[0]
}

function modulePrefix(rel, sourceKeys) {
  const parts = String(rel || '').split('/').filter(Boolean)
  if (!parts.length) return '_root'
  let offset = 0
  let prefix = ''
  if (sourceKeys && sourceKeys[parts[0]]) {
    prefix = parts[0] + '/'
    offset = 1
  }
  const rest = parts.slice(offset)
  if (!rest.length) return prefix.slice(0, -1) || '_root'
  return prefix + modulePrefixInner(rest)
}

function safeKey(shardId) {
  return String(shardId || '_other')
    .replace(/[^a-zA-Z0-9._-]+/g, '__')
    .slice(0, 180)
}

function hashBucket(filePath, n) {
  let h = 0
  const s = String(filePath || '')
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h % n
}

function main() {
  const packPath = path.resolve(process.argv[2] || PACK_PATH)
  const OUT_DIR = path.join(path.dirname(packPath), 'xiaohei-shards')
  const MANIFEST_PATH = path.join(path.dirname(packPath), 'xiaohei-manifest.json')
  if (!fs.existsSync(packPath)) {
    throw new Error('缺少 pack：' + packPath)
  }
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
  const files = Array.isArray(pack.files) ? pack.files : []
  if (!files.length) throw new Error('pack 无 files')

  const sourceKeys = {}
  if (Array.isArray(pack.sources)) {
    for (let i = 0; i < pack.sources.length; i++) {
      const s = pack.sources[i]
      if (s && s.key) sourceKeys[s.key] = 1
    }
  }

  // module -> [{path, content, size}]
  const byMod = {}
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    if (!f || !f.path) continue
    const mod = modulePrefix(f.path, sourceKeys)
    if (!byMod[mod]) byMod[mod] = []
    const content = f.content != null ? String(f.content) : ''
    byMod[mod].push({
      path: f.path,
      content: content,
      size: content.length,
    })
  }

  if (fs.existsSync(OUT_DIR)) {
    const old = fs.readdirSync(OUT_DIR)
    for (let i = 0; i < old.length; i++) {
      fs.unlinkSync(path.join(OUT_DIR, old[i]))
    }
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const shardsMeta = {}
  const pathEntries = []

  const mods = Object.keys(byMod).sort()
  for (let m = 0; m < mods.length; m++) {
    const mod = mods[m]
    const list = byMod[mod]
    let bytes = 0
    for (let i = 0; i < list.length; i++) bytes += list[i].size

    let parts = 1
    if (bytes > MAX_SHARD_BYTES) {
      parts = Math.ceil(bytes / MAX_SHARD_BYTES)
      if (parts < 2) parts = 2
    }

    const buckets = []
    for (let p = 0; p < parts; p++) buckets.push([])
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const b = parts === 1 ? 0 : hashBucket(item.path, parts)
      buckets[b].push({ path: item.path, content: item.content })
    }

    for (let p = 0; p < parts; p++) {
      const shardId = parts === 1 ? mod : mod + '#' + p
      const key = safeKey(shardId)
      const shardFiles = buckets[p]
      if (!shardFiles.length) continue
      let shardBytes = 0
      for (let i = 0; i < shardFiles.length; i++) {
        shardBytes += (shardFiles[i].content || '').length
        pathEntries.push({ path: shardFiles[i].path, shard: shardId })
      }
      const outFile = path.join(OUT_DIR, key + '.json')
      fs.writeFileSync(
        outFile,
        JSON.stringify({ shard: shardId, files: shardFiles }),
        'utf8'
      )
      shardsMeta[shardId] = {
        key: key,
        bytes: shardBytes,
        fileCount: shardFiles.length,
        file: key + '.json',
      }
    }
  }

  const manifest = {
    version: 1,
    createdAt: Date.now(),
    source: pack.source || '',
    pathCount: pathEntries.length,
    shardCount: Object.keys(shardsMeta).length,
    paths: pathEntries,
    shards: shardsMeta,
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest), 'utf8')

  const manMb = (fs.statSync(MANIFEST_PATH).size / 1024).toFixed(1)
  console.log(
    '已切 shards：' +
      Object.keys(shardsMeta).length +
      ' 个 · paths ' +
      pathEntries.length +
      ' → ' +
      path.relative(ROOT, OUT_DIR)
  )
  console.log('manifest ≈ ' + manMb + ' KB → ' + path.relative(ROOT, MANIFEST_PATH))
}

main()
