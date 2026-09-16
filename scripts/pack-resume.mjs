/**
 * 打包简历模板：去重、短 id，生成待上传目录 + resumeCatalog.js
 *
 * 用法：npm run resources:resume
 * 源：/Users/mac/Desktop/漫画/58套稻壳儿收费简历模板
 * 出：assets/resources/resume/ + src/utils/resumeCatalog.js
 *
 * 上传：开发者工具把 assets/resources/resume/ 传到云存储 resume/
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SOURCE_DIR =
  process.env.RESUME_SRC ||
  path.join('/Users/mac/Desktop/漫画', '58套稻壳儿收费简历模板')
const OUT_DIR = path.join(ROOT, 'assets', 'resources', 'resume')
const CATALOG_JS = path.join(ROOT, 'src', 'utils', 'resumeCatalog.js')

const CLOUD_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/resume/'

const DOC_EXT = /\.(docx?)$/i

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function padId(n) {
  const s = String(n)
  if (s.length >= 3) return 'r' + s
  return 'r' + ('000' + s).slice(-3)
}

/** 去掉 (1)(2) 等副本后缀，得到去重键 */
function dedupeKey(fileName) {
  const ext = path.extname(fileName)
  let base = path.basename(fileName, ext)
  base = base.replace(/(\s*\(\d+\))+$/g, '').trim()
  return base.toLowerCase() + ext.toLowerCase()
}

function displayTitle(fileName) {
  const ext = path.extname(fileName)
  let base = path.basename(fileName, ext)
  base = base.replace(/(\s*\(\d+\))+$/g, '').trim()
  return base || fileName
}

function scorePreferOriginal(fileName) {
  // 无 (n) 后缀优先；越短越好
  const hasCopy = /\(\d+\)/.test(fileName) ? 1 : 0
  return hasCopy * 10000 + fileName.length
}

function listDocs(dir) {
  const names = fs.readdirSync(dir)
  const list = []
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (name === '.DS_Store') continue
    if (!DOC_EXT.test(name)) continue
    const full = path.join(dir, name)
    if (!fs.statSync(full).isFile()) continue
    list.push({ name: name, full: full })
  }
  return list
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('源目录不存在:', SOURCE_DIR)
    process.exit(1)
  }

  const raw = listDocs(SOURCE_DIR)
  const byKey = {}
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    const key = dedupeKey(item.name)
    const prev = byKey[key]
    if (!prev || scorePreferOriginal(item.name) < scorePreferOriginal(prev.name)) {
      byKey[key] = item
    }
  }

  const unique = Object.keys(byKey)
    .map(function (k) {
      return byKey[k]
    })
    .sort(function (a, b) {
      return displayTitle(a.name).localeCompare(displayTitle(b.name), 'zh')
    })

  rmrf(OUT_DIR)
  ensureDir(OUT_DIR)

  const items = []
  const fileIds = {}

  for (let i = 0; i < unique.length; i++) {
    const src = unique[i]
    const ext = path.extname(src.name).toLowerCase()
    const id = padId(i + 1)
    const file = id + ext
    const dest = path.join(OUT_DIR, file)
    fs.copyFileSync(src.full, dest)
    items.push({
      id: id,
      title: displayTitle(src.name),
      ext: ext.replace('.', ''),
      file: file,
    })
    fileIds[file] = CLOUD_PREFIX + file
  }

  const catalog = {
    title: '简历模板',
    count: items.length,
    items: items,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8')

  let js =
    '/**\n' +
    ' * 简历模板目录：云路径 resume/\n' +
    ' * 由 npm run resources:resume 生成；上传到云存储 resume/ 后即可用\n' +
    ' */\n\n' +
    'export const RESUME_CATALOG_FILE_ID =\n' +
    "  '" +
    CLOUD_PREFIX +
    "catalog.json'\n\n" +
    '/** 文件名 → fileID */\n' +
    'export const RESUME_FILE_IDS = {\n'

  const files = Object.keys(fileIds).sort()
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    js += "  '" + f + "': '" + fileIds[f] + "',\n"
  }
  js +=
    '}\n\n' +
    'export function getResumeCatalogFileID() {\n' +
    '  return RESUME_CATALOG_FILE_ID\n' +
    '}\n\n' +
    'export function getResumeFileID(item) {\n' +
    '  if (!item) return \'\'\n' +
    '  if (item.fileID) return item.fileID\n' +
    '  const file = item.file || \'\'\n' +
    '  return RESUME_FILE_IDS[file] || \'\'\n' +
    '}\n'

  fs.writeFileSync(CATALOG_JS, js, 'utf8')

  console.log('源文件:', raw.length, '去重后:', unique.length)
  console.log('输出:', OUT_DIR)
  console.log('catalog:', CATALOG_JS)
  console.log('请上传 assets/resources/resume/ → 云存储 resume/')
}

main()
