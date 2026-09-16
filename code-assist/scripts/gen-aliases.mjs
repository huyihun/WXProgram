/**
 * 从业务仓各模块 pages.json 生成中文业务词 → 路径片段对照表
 * 用法：node code-assist/scripts/gen-aliases.mjs
 * 输出：xiaohei-aliases.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadSourcesFile } from './sources-util.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = path.resolve(__dirname, '..')
const ROOT = path.resolve(TOOL_ROOT, '..')
const CONFIG_PATH = path.join(TOOL_ROOT, 'config.json')
const OUT_PATH = path.join(TOOL_ROOT, 'xiaohei-aliases.json')

const NOISE_TITLES = {
  操作结果: 1,
  操作成功: 1,
  成功: 1,
  结果: 1,
  加载中: 1,
  详情: 1,
}

function parseArgs(argv) {
  const out = { source: '', outPath: '', sourcesFile: '' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--source' || a === '-s') {
      out.source = String(argv[i + 1] || '').trim()
      i += 1
    } else if (a === '--out' || a === '-o') {
      out.outPath = String(argv[i + 1] || '').trim()
      i += 1
    } else if (a === '--sources-file') {
      out.sourcesFile = String(argv[i + 1] || '').trim()
      i += 1
    }
  }
  return out
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('缺少 code-assist/config.json')
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
}

function resolveSourceAndOutFromArgs(args) {
  let source = args.source
  if (!source) {
    const cfg = loadConfig()
    if (cfg.source) {
      source = cfg.source
    } else if (Array.isArray(cfg.projects) && cfg.projects.length) {
      const slug = cfg.defaultSlug || cfg.projects[0].slug
      let hit = null
      for (let i = 0; i < cfg.projects.length; i++) {
        if (cfg.projects[i] && cfg.projects[i].slug === slug) {
          hit = cfg.projects[i]
          break
        }
      }
      if (!hit) hit = cfg.projects[0]
      source = hit.source || ''
    }
  }
  if (!source) throw new Error('缺少 --source 或 config.source')
  return { source: path.resolve(source) }
}

function walkPagesJson(dir, out) {
  if (!fs.existsSync(dir)) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return
  }
  for (let i = 0; i < entries.length; i++) {
    const ent = entries[i]
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'unpackage' || ent.name === 'dist') {
        continue
      }
      walkPagesJson(full, out)
      continue
    }
    if (ent.isFile() && ent.name === 'pages.json') {
      out.push(full)
    }
  }
}

function addUnique(arr, seen, val) {
  const s = String(val || '').trim()
  if (!s || s.length < 2) return
  const key = s.toLowerCase()
  if (seen[key]) return
  seen[key] = 1
  arr.push(s)
}

function enTokensFromRoot(root) {
  const en = []
  const seen = {}
  const r = String(root || '').trim()
  if (!r) return en
  addUnique(en, seen, r)
  const noPrefix = r.replace(/^ghb_/, '')
  if (noPrefix !== r) addUnique(en, seen, noPrefix)
  const parts = noPrefix.split(/[_-]/)
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && parts[i].length >= 3) addUnique(en, seen, parts[i])
  }
  return en
}

function collectZh(doc) {
  const zh = []
  const seen = {}
  addUnique(zh, seen, doc.name)
  const pages = Array.isArray(doc.pages) ? doc.pages : []
  for (let i = 0; i < pages.length; i++) {
    const style = (pages[i] && pages[i].style) || {}
    const title = style.navigationBarTitleText
    if (!title) continue
    const t = String(title).trim()
    if (NOISE_TITLES[t]) continue
    addUnique(zh, seen, t)
  }
  return zh
}

function buildGroupsFromSource(source, key) {
  const srcDir = path.join(source, 'src')
  const files = []
  walkPagesJson(srcDir, files)

  const groups = []
  for (let i = 0; i < files.length; i++) {
    let doc
    try {
      doc = JSON.parse(fs.readFileSync(files[i], 'utf8'))
    } catch (e) {
      continue
    }
    if (!doc || !doc.root) continue
    const rootRaw = String(doc.root).trim()
    const root = key ? key + '/' + rootRaw : rootRaw
    const zh = collectZh(doc)
    const en = enTokensFromRoot(doc.root)
    const enPrefixed = []
    const enSeen = {}
    addUnique(enPrefixed, enSeen, root)
    for (let j = 0; j < en.length; j++) {
      if (key) addUnique(enPrefixed, enSeen, key + '/' + en[j])
      addUnique(enPrefixed, enSeen, en[j])
    }
    if (!zh.length || !enPrefixed.length) continue
    groups.push({
      root: root,
      zh: zh,
      en: enPrefixed,
    })
  }
  return groups
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const OUT = path.resolve(args.outPath || OUT_PATH)
  const sources = args.sourcesFile ? loadSourcesFile(args.sourcesFile) : []

  if (sources.length) {
    let groups = []
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      const part = buildGroupsFromSource(s.path, s.key)
      groups = groups.concat(part)
    }
    groups.sort(function (a, b) {
      return String(a.root).localeCompare(String(b.root))
    })
    const payload = {
      generatedAt: new Date().toISOString(),
      source: 'multi',
      sources: sources.map(function (s) {
        return { key: s.key, label: s.label, path: s.path }
      }),
      count: groups.length,
      groups: groups,
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log('已生成 ' + path.relative(ROOT, OUT) + '（' + groups.length + ' 个模块）')
    return
  }

  const resolved = resolveSourceAndOutFromArgs(args)
  const source = resolved.source
  if (!source || !fs.existsSync(source)) {
    throw new Error('source 不存在：' + source)
  }
  const groups = buildGroupsFromSource(source, '')
  groups.sort(function (a, b) {
    return String(a.root).localeCompare(String(b.root))
  })
  const payload = {
    generatedAt: new Date().toISOString(),
    source: source,
    count: groups.length,
    groups: groups,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(
    '已生成 ' +
      path.relative(ROOT, OUT) +
      '（' +
      groups.length +
      ' 个模块）'
  )
}

main()
