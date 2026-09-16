/**
 * 打包赚钱思路 / 赚钱点子：抽正文 JSON，上传云 ideas/
 *
 * 用法：npm run resources:ideas
 * 源：/Users/mac/Desktop/漫画/赚钱思路和赚钱点子
 * 出：assets/resources/ideas/ + src/utils/ideasCatalog.js
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadDep(name) {
  try {
    return require(name)
  } catch (e1) {
    try {
      return require('/tmp/ideas-pack-deps/node_modules/' + name)
    } catch (e2) {
      throw new Error(
        '缺少依赖 ' +
          name +
          '，请执行: cd /tmp && mkdir -p ideas-pack-deps && cd ideas-pack-deps && npm i mammoth@1.8.0 pdf-parse@1.1.1'
      )
    }
  }
}

const mammoth = loadDep('mammoth')
const pdfParse = loadDep('pdf-parse')

const SOURCE_ROOT =
  process.env.IDEAS_SRC || path.join('/Users/mac/Desktop/漫画', '赚钱思路和赚钱点子')
const OUT_DIR = path.join(ROOT, 'assets', 'resources', 'ideas')
const CATALOG_JS = path.join(ROOT, 'src', 'utils', 'ideasCatalog.js')

const CLOUD_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/ideas/'

const CATEGORIES = [
  { key: 'sixiang', dir: '赚钱思路', label: '思路' },
  { key: 'dianzi', dir: '赚钱点子', label: '点子' },
]

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function padId(n) {
  const s = String(n)
  if (s.length >= 3) return 'i' + s
  return 'i' + ('000' + s).slice(-3)
}

function cleanTitle(name) {
  let t = path.basename(name, path.extname(name))
  t = t.replace(/【[^】]*】/g, '')
  t = t.replace(/（公众号[：:][^）]*）/g, '')
  t = t.replace(/\(公众号[：:][^)]*\)/g, '')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/^[\d．.\s]+/, '').trim()
  return t || name
}

async function extractDocx(filePath) {
  const res = await mammoth.extractRawText({ path: filePath })
  return String((res && res.value) || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(filePath) {
  const buf = fs.readFileSync(filePath)
  const data = await pdfParse(buf)
  return String((data && data.text) || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return []
  const names = fs.readdirSync(dir)
  const out = []
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (name === '.DS_Store') continue
    const ext = path.extname(name).toLowerCase()
    if (exts.indexOf(ext) < 0) continue
    const full = path.join(dir, name)
    if (!fs.statSync(full).isFile()) continue
    out.push({ name: name, full: full, ext: ext })
  }
  out.sort(function (a, b) {
    return a.name.localeCompare(b.name, 'zh')
  })
  return out
}

async function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error('源目录不存在:', SOURCE_ROOT)
    process.exit(1)
  }

  rmrf(OUT_DIR)
  ensureDir(OUT_DIR)

  const items = []
  const fileIds = {}
  let seq = 0
  let textOk = 0
  let pdfFallback = 0

  for (let c = 0; c < CATEGORIES.length; c++) {
    const cat = CATEGORIES[c]
    const dir = path.join(SOURCE_ROOT, cat.dir)
    const files = listFiles(dir, ['.docx', '.pdf', '.doc'])
    console.log(cat.label, '文件数', files.length)

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      seq += 1
      const id = padId(seq)
      const title = cleanTitle(f.name)
      let body = ''
      let mode = 'text'
      let pdfFile = ''

      try {
        if (f.ext === '.docx') {
          body = await extractDocx(f.full)
        } else if (f.ext === '.pdf') {
          body = await extractPdf(f.full)
        } else {
          mode = 'pdf'
        }
      } catch (err) {
        console.warn('抽取失败', f.name, (err && err.message) || err)
        body = ''
      }

      if (!body || body.length < 20) {
        if (f.ext === '.pdf') {
          mode = 'pdf'
          pdfFile = id + '.pdf'
          fs.copyFileSync(f.full, path.join(OUT_DIR, pdfFile))
          fileIds[pdfFile] = CLOUD_PREFIX + pdfFile
          pdfFallback += 1
          body = ''
        } else {
          console.warn('正文过短，跳过', f.name)
          seq -= 1
          continue
        }
      } else {
        textOk += 1
      }

      const jsonFile = id + '.json'
      const doc = {
        id: id,
        title: title,
        category: cat.key,
        mode: mode,
        body: body,
      }
      if (pdfFile) doc.pdfFile = pdfFile

      fs.writeFileSync(path.join(OUT_DIR, jsonFile), JSON.stringify(doc), 'utf8')
      fileIds[jsonFile] = CLOUD_PREFIX + jsonFile

      const catalogItem = {
        id: id,
        title: title,
        category: cat.key,
        mode: mode,
        file: jsonFile,
      }
      if (pdfFile) catalogItem.pdfFile = pdfFile
      items.push(catalogItem)

      if (seq % 40 === 0) console.log('…已处理', seq)
    }
  }

  const catalog = {
    title: '赚钱合集',
    count: items.length,
    categories: CATEGORIES.map(function (c) {
      return { key: c.key, label: c.label }
    }),
    items: items,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8')
  fileIds['catalog.json'] = CLOUD_PREFIX + 'catalog.json'

  let js =
    '/**\n' +
    ' * 赚钱合集目录：云路径 ideas/\n' +
    ' * 由 npm run resources:ideas 生成\n' +
    ' */\n\n' +
    'export const IDEAS_CATALOG_FILE_ID =\n' +
    "  '" +
    CLOUD_PREFIX +
    "catalog.json'\n\n" +
    'export const IDEAS_FILE_IDS = {\n'

  const keys = Object.keys(fileIds).sort()
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    js += "  '" + k + "': '" + fileIds[k] + "',\n"
  }
  js +=
    '}\n\n' +
    'export function getIdeasCatalogFileID() {\n' +
    '  return IDEAS_CATALOG_FILE_ID\n' +
    '}\n\n' +
    'export function getIdeasFileID(file) {\n' +
    "  if (!file) return ''\n" +
    '  return IDEAS_FILE_IDS[file] || \'\'\n' +
    '}\n\n' +
    'export function getIdeasItemFileID(item) {\n' +
    "  if (!item) return ''\n" +
    '  if (item.fileID) return item.fileID\n' +
    '  return getIdeasFileID(item.file)\n' +
    '}\n\n' +
    'export function getIdeasPdfFileID(item) {\n' +
    "  if (!item || !item.pdfFile) return ''\n" +
    '  return getIdeasFileID(item.pdfFile)\n' +
    '}\n'

  fs.writeFileSync(CATALOG_JS, js, 'utf8')

  console.log('完成：条目', items.length, '正文', textOk, 'PDF回退', pdfFallback)
  console.log('输出:', OUT_DIR)
  console.log('请上传 assets/resources/ideas/ → 云存储 ideas/')
}

main().catch(function (err) {
  console.error(err)
  process.exit(1)
})
