/**
 * 小黑：本机预处理源码包
 *
 * 输出 xiaohei-pack.json；日常请用 npm run code-assist:publish 一键发布。
 *
 * 用法：
 *   npm run code-assist:pack -- /path/to/project
 *   npm run code-assist:pack -- /path/to/project -o ./xiaohei-pack.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadSourcesFile, parseSourcesArg } from './sources-util.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = path.resolve(__dirname, '..')

const SKIP_DIR = {
  node_modules: 1,
  '.git': 1,
  dist: 1,
  unpackage: 1,
  '.svn': 1,
  coverage: 1,
  '.idea': 1,
  '.vscode': 1,
  '.cursor': 1,
}
const SKIP_EXT = {
  '.png': 1,
  '.jpg': 1,
  '.jpeg': 1,
  '.gif': 1,
  '.webp': 1,
  '.ico': 1,
  '.bmp': 1,
  '.mp3': 1,
  '.mp4': 1,
  '.wav': 1,
  '.mov': 1,
  '.pdf': 1,
  '.zip': 1,
  '.gz': 1,
  '.woff': 1,
  '.woff2': 1,
  '.ttf': 1,
  '.eot': 1,
  '.otf': 1,
  '.exe': 1,
  '.dll': 1,
  '.so': 1,
  '.dylib': 1,
  '.map': 1,
  '.xlsx': 1,
  '.xls': 1,
  '.doc': 1,
  '.docx': 1,
}
/** 单文件过大不收正文（路径仍进目录） */
const MAX_FILE_BYTES = 500 * 1024
/** 整包体积告警阈值（不截断） */
const WARN_PACK_MB = 20

function normalizeRel(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
}

function fileExt(rel) {
  const base = String(rel || '').split('/').pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot).toLowerCase()
}

function shouldSkipPath(rel) {
  const parts = rel.split('/')
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    if (!seg) continue
    if (SKIP_DIR[seg]) return true
    if (seg === '.DS_Store') return true
  }
  const base = parts[parts.length - 1] || ''
  if (base.slice(-7) === '.min.js') return true
  const ext = fileExt(rel)
  if (SKIP_EXT[ext]) return true
  return false
}

/** 默认不收正文：降噪，不是为了省名额 */
function contentSkipReason(rel) {
  const base = String(rel || '').split('/').pop() || ''
  const ext = fileExt(rel)
  if (base === 'package-lock.json' || base === 'yarn.lock' || base === 'pnpm-lock.yaml') {
    return 'lock'
  }
  if (base.indexOf('.env') === 0) return 'env'
  if (ext === '.svg') return 'svg'
  if (ext === '.scss' || ext === '.css' || ext === '.less' || ext === '.sass') {
    return 'style'
  }
  return ''
}

function isProbablyText(buf) {
  if (!buf || !buf.length) return false
  const n = Math.min(buf.length, 800)
  let weird = 0
  for (let i = 0; i < n; i++) {
    const b = buf[i]
    if (b === 0) return false
    if (b < 7 && b !== 9 && b !== 10 && b !== 13) weird++
  }
  return weird < n * 0.05
}

function walkFiles(dir, baseRel, outPaths) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return
  }
  for (let i = 0; i < entries.length; i++) {
    const ent = entries[i]
    const name = ent.name
    const rel = baseRel ? baseRel + '/' + name : name
    if (ent.isDirectory()) {
      if (SKIP_DIR[name]) continue
      walkFiles(path.join(dir, name), rel, outPaths)
      continue
    }
    if (!ent.isFile()) continue
    outPaths.push(rel)
  }
}

function topDir(rel) {
  const slash = rel.indexOf('/')
  return slash < 0 ? '_root' : rel.slice(0, slash)
}

function countLines(text) {
  if (!text) return 0
  let n = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++
  }
  return n
}

function parseArgs(argv) {
  let src = ''
  let out = path.join(TOOL_ROOT, 'xiaohei-pack.json')
  let sourcesFile = ''
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-o' || a === '--out') {
      out = path.resolve(argv[i + 1] || out)
      i++
      continue
    }
    if (a === '--sources-file') {
      sourcesFile = String(argv[i + 1] || '').trim()
      i++
      continue
    }
    if (a.indexOf('-') === 0) continue
    if (!src) src = path.resolve(a)
  }
  return { src: src, out: out, sourcesFile: sourcesFile }
}

function collectFromSource(src, pathPrefix, allPaths, collected, skipped, topSet, skippedByReason) {
  function bumpReason(reason) {
    skippedByReason[reason] = (skippedByReason[reason] || 0) + 1
  }

  const relPaths = []
  walkFiles(src, '', relPaths)
  relPaths.sort()

  for (let i = 0; i < relPaths.length; i++) {
    const relInner = normalizeRel(relPaths[i])
    if (!relInner || shouldSkipPath(relInner)) continue

    const rel = pathPrefix ? pathPrefix + '/' + relInner : relInner
    const abs = path.join(src, relInner)
    let st
    try {
      st = fs.statSync(abs)
    } catch (e) {
      skipped.push(rel + ' (无法读取)')
      bumpReason('无法读取')
      continue
    }
    if (!st.isFile()) continue

    allPaths.push(rel)
    topSet[topDir(rel)] = 1

    const noContent = contentSkipReason(relInner)
    if (noContent) {
      skipped.push(rel + ' (不收正文:' + noContent + ')')
      bumpReason('不收正文:' + noContent)
      continue
    }

    if (st.size > MAX_FILE_BYTES) {
      skipped.push(rel + ' (过大)')
      bumpReason('过大')
      continue
    }

    let buf
    try {
      buf = fs.readFileSync(abs)
    } catch (e) {
      skipped.push(rel + ' (读失败)')
      bumpReason('读失败')
      continue
    }
    if (!isProbablyText(buf)) {
      skipped.push(rel + ' (二进制)')
      bumpReason('二进制')
      continue
    }

    let text = ''
    try {
      text = buf.toString('utf8')
    } catch (e) {
      skipped.push(rel + ' (解码失败)')
      bumpReason('解码失败')
      continue
    }
    if (text.indexOf('\uFFFD') >= 0 && text.split('\uFFFD').length > 20) {
      skipped.push(rel + ' (编码异常)')
      bumpReason('编码异常')
      continue
    }

    const ext = fileExt(relInner)
    collected.push({
      path: rel,
      content: text,
      size: buf.length,
      lineCount: countLines(text),
      ext: ext,
    })
  }
}

function writePack(out, packMeta, collected, allPaths, skipped, skippedByReason) {
  if (!collected.length) {
    console.error('未解析到可读源码，请检查目录或过滤规则')
    process.exit(1)
  }

  const treeText = allPaths.slice().sort().join('\n')
  const groupKeys = Object.keys(packMeta.topSet).sort()
  const contentPaths = collected.map(function (f) {
    return f.path
  })

  const pack = {
    version: packMeta.version,
    source: packMeta.source,
    createdAt: Date.now(),
    fileCount: collected.length,
    pathCount: allPaths.length,
    files: collected,
    contentPaths: contentPaths,
    skipped: skipped.slice(0, 2000),
    treeText: treeText,
    fullTreeText: treeText,
    groupKeys: groupKeys,
    stats: {
      scanned: allPaths.length,
      withContent: collected.length,
      skipped: skipped.length,
      skippedByReason: skippedByReason,
    },
  }
  if (packMeta.sources) pack.sources = packMeta.sources

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(pack), 'utf8')

  const packBytes = fs.statSync(out).size
  const mb = (packBytes / (1024 * 1024)).toFixed(2)
  console.log('已写出 pack: ' + out)
  console.log(
    '目录 ' +
      allPaths.length +
      ' · 正文 ' +
      collected.length +
      ' · 跳过/不收正文 ' +
      skipped.length +
      ' · 顶层目录 ' +
      groupKeys.length +
      ' · pack 约 ' +
      mb +
      ' MB'
  )
  if (packBytes > WARN_PACK_MB * 1024 * 1024) {
    console.warn('警告：pack 约 ' + mb + ' MB，上传可能较慢（未截断）')
  }
  console.log('下一步：npm run code-assist:publish（或本机 local 脚本）上传并写库')
}

function main() {
  const { src, out, sourcesFile } = parseArgs(process.argv.slice(2))
  const sources = sourcesFile ? loadSourcesFile(sourcesFile) : []

  if (sources.length) {
    const allPaths = []
    const collected = []
    const skipped = []
    const topSet = {}
    const skippedByReason = {}
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      console.log('pack 源 ' + s.key + '：' + s.path)
      collectFromSource(s.path, s.key, allPaths, collected, skipped, topSet, skippedByReason)
    }
    writePack(
      out,
      {
        version: 3,
        source: 'multi',
        sources: sources.map(function (s) {
          return { key: s.key, label: s.label, path: s.path }
        }),
        topSet: topSet,
      },
      collected,
      allPaths,
      skipped,
      skippedByReason
    )
    return
  }

  if (!src) {
    console.error(
      '用法: node code-assist/scripts/pack.mjs <项目目录> [-o ./xiaohei-pack.json]\n' +
        '  或多源: node code-assist/scripts/pack.mjs --sources-file ./sources.json -o ./pack.json'
    )
    process.exit(1)
  }
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    console.error('目录不存在: ' + src)
    process.exit(1)
  }

  const allPaths = []
  const collected = []
  const skipped = []
  const topSet = {}
  const skippedByReason = {}
  collectFromSource(src, '', allPaths, collected, skipped, topSet, skippedByReason)
  writePack(
    out,
    { version: 2, source: src, topSet: topSet },
    collected,
    allPaths,
    skipped,
    skippedByReason
  )
}

main()
