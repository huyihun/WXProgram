/**
 * 生成业务仓页面/文件索引
 * modules: [{ root, name, id, pages: [{ path, title, file }] }]
 *
 * 策略（自动）：
 *   A) src 下模块 pages.json（含 root）—— uni 分包模块
 *   B) 根 pages.json 主包 + subpackages —— 标准 uni
 *   C) 目录扫描 modules / views / pages 下的 .vue
 *
 * 用法：
 *   node code-assist/scripts/gen-page-index.mjs
 *   node code-assist/scripts/gen-page-index.mjs --source /path --out ./out.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadSourcesFile, parseSourcesArg } from './sources-util.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = path.resolve(__dirname, '..')
const ROOT = path.resolve(TOOL_ROOT, '..')
const CONFIG_PATH = path.join(TOOL_ROOT, 'config.json')
const DEFAULT_OUT = path.join(TOOL_ROOT, 'xiaohei-page-index.json')

const SKIP_DIRS = {
  node_modules: 1,
  unpackage: 1,
  dist: 1,
  '.git': 1,
  coverage: 1,
  components: 1,
  component: 1,
  static: 1,
  assets: 1,
  mixins: 1,
  utils: 1,
  store: 1,
  vuex: 1,
  api: 1,
  styles: 1,
  style: 1,
  css: 1,
  img: 1,
  images: 1,
  font: 1,
  fonts: 1,
  locales: 1,
  i18n: 1,
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
  if (!fs.existsSync(CONFIG_PATH)) throw new Error('缺少 code-assist/config.json')
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
}

function resolveSourceAndOutFromArgs(args) {
  let source = args.source
  const outPath = path.resolve(args.outPath || DEFAULT_OUT)
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
      source = (hit && hit.source) || ''
    }
  }
  if (!source) throw new Error('缺少 --source 或 config.source')
  return { source: path.resolve(source), outPath: outPath }
}

function prefixModules(modules, key, label) {
  const out = []
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i] || {}
    const pages = []
    const list = mod.pages || []
    for (let j = 0; j < list.length; j++) {
      const pg = list[j] || {}
      pages.push({
        path: pg.path,
        title: pg.title,
        file: pg.file ? key + '/' + pg.file : '',
      })
    }
    const name = mod.name ? label + '·' + mod.name : label
    out.push({
      root: key + '/' + mod.root,
      name: name,
      id: mod.id || '',
      pages: pages,
    })
  }
  return out
}

function buildMultiIndex(sources) {
  const allModules = []
  const parts = []
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]
    const built = buildIndex(s.path)
    const prefixed = prefixModules(built.modules || [], s.key, s.label)
    for (let j = 0; j < prefixed.length; j++) allModules.push(prefixed[j])
    parts.push(s.key + ':' + built.strategy)
  }
  return { strategy: 'multi:' + parts.join('+'), modules: sortModules(allModules) }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const outPath = path.resolve(args.outPath || DEFAULT_OUT)
  const sources = args.sourcesFile ? loadSourcesFile(args.sourcesFile) : []

  if (sources.length) {
    const built = buildMultiIndex(sources)
    const modules = built.modules || []
    const pageCount = countPages(modules)
    const payload = {
      generatedAt: new Date().toISOString(),
      source: 'multi',
      sources: sources.map(function (s) {
        return { key: s.key, label: s.label, path: s.path }
      }),
      strategy: built.strategy,
      count: modules.length,
      modules: modules,
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log(
      '已生成 ' +
        path.relative(ROOT, outPath) +
        '（策略 ' +
        built.strategy +
        ' · ' +
        modules.length +
        ' 个模块 · ' +
        pageCount +
        ' 个页面）'
    )
    if (!pageCount) console.warn('警告：未扫到任何页面')
    return
  }

  const resolved = resolveSourceAndOutFromArgs(args)
  const source = resolved.source
  if (!fs.existsSync(source)) throw new Error('source 不存在：' + source)

  const built = buildIndex(source)
  const modules = built.modules || []
  const pageCount = countPages(modules)
  const payload = {
    generatedAt: new Date().toISOString(),
    source: source,
    strategy: built.strategy,
    count: modules.length,
    modules: modules,
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(
    '已生成 ' +
      path.relative(ROOT, outPath) +
      '（策略 ' +
      built.strategy +
      ' · ' +
      modules.length +
      ' 个模块 · ' +
      pageCount +
      ' 个页面）'
  )
  if (!pageCount) console.warn('警告：未扫到任何页面')
}

function toPackPath(source, absFile) {
  return path.relative(source, absFile).split(path.sep).join('/')
}

function pageTitle(item) {
  if (!item || typeof item === 'string') return ''
  if (item.navigationBarTitleText != null) {
    return String(item.navigationBarTitleText).trim()
  }
  if (item.style && item.style.navigationBarTitleText != null) {
    return String(item.style.navigationBarTitleText).trim()
  }
  return ''
}

function pagePathOf(item) {
  if (typeof item === 'string') return item.trim()
  if (item && item.path != null) return String(item.path).trim()
  return ''
}

function resolveFileUnder(source, relBase, pagePath) {
  const rel = String(pagePath || '')
    .replace(/^\/+/, '')
    .replace(/\.vue$/i, '')
  if (!rel) return ''
  const bases = []
  if (relBase) bases.push(path.join(source, relBase, rel))
  bases.push(path.join(source, 'src', rel))
  bases.push(path.join(source, rel))
  for (let b = 0; b < bases.length; b++) {
    const base = bases[b]
    const candidates = [
      base + '.vue',
      path.join(base, 'index.vue'),
      base + '.js',
      path.join(base, 'index.js'),
      base + '.ts',
      path.join(base, 'index.ts'),
    ]
    for (let i = 0; i < candidates.length; i++) {
      if (fs.existsSync(candidates[i]) && fs.statSync(candidates[i]).isFile()) {
        return toPackPath(source, candidates[i])
      }
    }
  }
  return ''
}

function walkNamedFiles(dir, fileName, out) {
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
      if (SKIP_DIRS[ent.name] || ent.name.charAt(0) === '.') continue
      walkNamedFiles(full, fileName, out)
      continue
    }
    if (ent.isFile() && ent.name === fileName) out.push(full)
  }
}

function countPages(modules) {
  let n = 0
  for (let i = 0; i < modules.length; i++) {
    n += (modules[i].pages && modules[i].pages.length) || 0
  }
  return n
}

function sortModules(modules) {
  modules.sort(function (a, b) {
    return String(a.root).localeCompare(String(b.root))
  })
  return modules
}

/** A: 模块 pages.json（含 root） */
function strategyModulePagesJson(source) {
  const files = []
  walkNamedFiles(path.join(source, 'src'), 'pages.json', files)
  const seen = {}
  const modules = []
  for (let i = 0; i < files.length; i++) {
    const rel = toPackPath(source, files[i])
    if (rel === 'src/pages.json' || rel === 'pages.json') continue
    let doc
    try {
      doc = JSON.parse(fs.readFileSync(files[i], 'utf8'))
    } catch (e) {
      continue
    }
    const root = doc && doc.root ? String(doc.root).trim() : ''
    if (!root || seen[root]) continue
    seen[root] = 1
    const pages = []
    const pageSeen = {}
    const list = (doc && doc.pages) || []
    for (let j = 0; j < list.length; j++) {
      const item = list[j]
      const p = pagePathOf(item)
      if (!p) continue
      const file = resolveFileUnder(source, path.join('src', root), p)
      if (!file || pageSeen[file]) continue
      pageSeen[file] = 1
      pages.push({ path: p, title: pageTitle(item), file: file })
    }
    modules.push({
      root: root,
      name: doc.name != null ? String(doc.name).trim() : '',
      id: doc.id != null ? String(doc.id).trim() : '',
      pages: pages,
    })
  }
  return sortModules(modules)
}

function findRootPagesJson(source) {
  const cands = [
    path.join(source, 'src', 'pages.json'),
    path.join(source, 'pages.json'),
  ]
  for (let i = 0; i < cands.length; i++) {
    if (fs.existsSync(cands[i]) && fs.statSync(cands[i]).isFile()) return cands[i]
  }
  return ''
}

/** B: 根 pages.json + subpackages */
function strategyRootPagesJson(source) {
  const jsonPath = findRootPagesJson(source)
  if (!jsonPath) return []
  let doc
  try {
    doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  } catch (e) {
    return []
  }
  if (!doc) return []
  const modules = []

  const mainPages = doc.pages || []
  if (mainPages.length) {
    const pages = []
    const pageSeen = {}
    for (let i = 0; i < mainPages.length; i++) {
      const item = mainPages[i]
      const p = pagePathOf(item)
      if (!p) continue
      const file = resolveFileUnder(source, 'src', p)
      if (!file || pageSeen[file]) continue
      pageSeen[file] = 1
      pages.push({ path: p, title: pageTitle(item), file: file })
    }
    if (pages.length) {
      modules.push({ root: 'pages', name: '主包', id: '', pages: pages })
    }
  }

  const subs = doc.subPackages || doc.subpackages || []
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i]
    if (!sub) continue
    const subRoot = String(sub.root || '').replace(/^\/+|\/+$/g, '')
    if (!subRoot) continue
    const list = sub.pages || []
    const pages = []
    const pageSeen = {}
    for (let j = 0; j < list.length; j++) {
      const item = list[j]
      const p = pagePathOf(item)
      if (!p) continue
      const fullPath = (subRoot + '/' + p).replace(/\/+/g, '/')
      const file = resolveFileUnder(source, 'src', fullPath)
      if (!file || pageSeen[file]) continue
      pageSeen[file] = 1
      pages.push({ path: p, title: pageTitle(item), file: file })
    }
    modules.push({
      root: subRoot,
      name: sub.name != null ? String(sub.name).trim() : '',
      id: '',
      pages: pages,
    })
  }
  return sortModules(modules)
}

function walkVueFiles(dir, out) {
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
      if (SKIP_DIRS[ent.name] || ent.name.charAt(0) === '.') continue
      walkVueFiles(full, out)
      continue
    }
    if (ent.isFile() && /\.vue$/i.test(ent.name)) out.push(full)
  }
}

function titleFromFile(absFile) {
  const base = path.basename(absFile, path.extname(absFile))
  if (base && base !== 'index') return base
  return path.basename(path.dirname(absFile)) || base || ''
}

function moduleFromVueDir(source, modRoot, absDir) {
  const files = []
  walkVueFiles(absDir, files)
  const pages = []
  const pageSeen = {}
  for (let i = 0; i < files.length; i++) {
    const file = toPackPath(source, files[i])
    if (!file || pageSeen[file]) continue
    pageSeen[file] = 1
    let rel = path.relative(absDir, files[i]).split(path.sep).join('/')
    rel = rel.replace(/\.vue$/i, '').replace(/\/index$/i, '')
    pages.push({
      path: rel || path.basename(files[i], '.vue'),
      title: titleFromFile(files[i]),
      file: file,
    })
  }
  pages.sort(function (a, b) {
    return String(a.path).localeCompare(String(b.path))
  })
  return { root: modRoot, name: '', id: '', pages: pages }
}

/** C: 目录扫描 */
function strategyDirectoryScan(source) {
  const modules = []
  const modulesDir = path.join(source, 'src', 'modules')
  if (fs.existsSync(modulesDir) && fs.statSync(modulesDir).isDirectory()) {
    const entries = fs.readdirSync(modulesDir, { withFileTypes: true })
    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i]
      if (!ent.isDirectory()) continue
      if (SKIP_DIRS[ent.name] || ent.name.charAt(0) === '.') continue
      const mod = moduleFromVueDir(
        source,
        ent.name,
        path.join(modulesDir, ent.name)
      )
      if (mod.pages.length) modules.push(mod)
    }
    if (modules.length) return sortModules(modules)
  }

  const bases = [
    { key: 'views', abs: path.join(source, 'src', 'views') },
    { key: 'pages', abs: path.join(source, 'src', 'pages') },
  ]
  for (let b = 0; b < bases.length; b++) {
    const base = bases[b]
    if (!fs.existsSync(base.abs) || !fs.statSync(base.abs).isDirectory()) continue
    const entries = fs.readdirSync(base.abs, { withFileTypes: true })
    const subDirs = []
    for (let i = 0; i < entries.length; i++) {
      if (
        entries[i].isDirectory() &&
        !SKIP_DIRS[entries[i].name] &&
        entries[i].name.charAt(0) !== '.'
      ) {
        subDirs.push(entries[i].name)
      }
    }
    if (subDirs.length) {
      for (let i = 0; i < subDirs.length; i++) {
        const name = subDirs[i]
        const mod = moduleFromVueDir(
          source,
          base.key + '/' + name,
          path.join(base.abs, name)
        )
        if (mod.pages.length) modules.push(mod)
      }
    } else {
      const mod = moduleFromVueDir(source, base.key, base.abs)
      if (mod.pages.length) modules.push(mod)
    }
    if (modules.length) return sortModules(modules)
  }
  return modules
}

function buildIndex(source) {
  let modules = strategyModulePagesJson(source)
  if (countPages(modules) > 0) {
    return { strategy: 'A:module-pages.json', modules: modules }
  }
  modules = strategyRootPagesJson(source)
  if (countPages(modules) > 0) {
    return { strategy: 'B:root-pages.json', modules: modules }
  }
  modules = strategyDirectoryScan(source)
  return { strategy: 'C:directory-scan', modules: modules }
}

main()
