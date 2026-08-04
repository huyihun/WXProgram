/**
 * 将东野圭吾 epub 转为「一书一 JSON」，供小程序云存储阅读
 *
 * 用法：把源 epub 放到 xiaoshuo/…（见 SOURCE_DIR）后执行
 *       node scripts/epub-to-chapters.mjs
 * 输出：books-dist/dongye/{bookId}.json（含全部章节）
 *       books-dist/dongye/catalog.json
 *
 * 注：xiaoshuo / books-dist 已 gitignore，仅本地转换用，不进仓库。
 */
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SOURCE_DIR = path.join(
  ROOT,
  'xiaoshuo',
  '【电子书-小说】精华：《全球推理小说大集合》精选版(1)',
  '【日】东野圭吾（作品集）'
)
const OUT_DIR = path.join(ROOT, 'books-dist', 'dongye')
const TMP_ROOT = path.join(ROOT, 'books-dist', '.tmp-epub')

/** 书名 → bookId（拼音/slug） */
const TITLE_ID_MAP = {
  白夜行: 'baiyehang',
  嫌疑人X的献身: 'xianyirenx',
  恶意: 'eyi',
  放学后: 'fangxuehou',
  时生: 'shisheng',
  幻夜: 'huanye',
  分身: 'fenshen',
  信: 'xin',
  流星之绊: 'liuxingzhiban',
  红色手指: 'hongseshouzhi',
  沉睡的森林: 'chenshuidesenlin',
  湖边凶杀案: 'hubianxiongsanan',
  神探伽利略: 'shentanqialilue',
  名侦探的守则: 'mingzhentandeshouze',
  美丽的凶器: 'meilidexiongqi',
  回廊亭杀人事件: 'huilangting',
  伊豆旅馆的神秘案: 'yidulvguan',
  毕业前杀人游戏: 'biyeqiansharen',
  '超·杀人事件': 'chaosharen',
  过去我死去的家: 'guoquwosiqudejia',
  使命与心之极限: 'shimingyuxin',
  十一字杀人: 'shiyizisharen',
  '濒死之眼 Dying Eye': 'binsizhiyan',
  濒死之眼: 'binsizhiyan',
  预知梦: 'yuzhimeng',
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function stripHtml(html) {
  let s = String(html || '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/p>/gi, '\n\n')
  s = s.replace(/<\/div>/gi, '\n')
  s = s.replace(/<\/h[1-6]>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  return normalizeChapterContent(s.trim(), '')
}

/** 去掉章首重复标题、孤立节号、多余空行 */
function normalizeChapterContent(content, title) {
  let s = String(content || '')
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  s = s.replace(/^bookcover\s*\n*/i, '')
  s = s.replace(/^[ \t\u3000]*$/gm, '')
  s = s.replace(/\n{3,}/g, '\n\n')
  s = s.replace(/^\n+/, '')

  function compactLine(line) {
    return String(line || '').replace(/[\s\u3000]/g, '')
  }

  function isSectionNum(line) {
    const t = compactLine(line)
    if (!t) return false
    if (/^[0-9０-９]{1,3}$/.test(t)) return true
    if (/^[一二三四五六七八九十百]+$/.test(t) && t.length <= 3) return true
    return false
  }

  function stripLeading(pred, maxTimes) {
    for (let n = 0; n < maxTimes; n++) {
      const m = s.match(/^([^\n]*)(\n*)/)
      if (!m) break
      if (!pred(m[1])) break
      s = s.slice(m[0].length)
    }
  }

  const titleKey = compactLine(title)
  if (titleKey) {
    stripLeading((line) => compactLine(line) === titleKey, 4)
  }
  stripLeading(isSectionNum, 3)

  s = s.replace(/^\n+/, '')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.replace(/\s+$/, '')
}

function formatChapterTitle(title, index) {
  const t = String(title || '').trim()
  const n = Number(index) || 1
  if (!t) return '第' + n + '章'
  const compact = t.replace(/[\s\u3000]/g, '')
  if (/^[0-9０-９]{1,3}$/.test(compact)) return '第' + compact + '节'
  return t
}

function extractTitleFromFilename(filename) {
  let name = filename.replace(/\.epub$/i, '')
  name = name.replace(/^东野[圭奎]吾[（(]?日?[）)]?\s*-\s*/, '')
  name = name.replace(/^东野圭吾\s*-\s*/, '')
  return name.trim() || filename
}

function toBookId(title, filename) {
  if (TITLE_ID_MAP[title]) return TITLE_ID_MAP[title]
  for (const key of Object.keys(TITLE_ID_MAP)) {
    if (title.indexOf(key) >= 0 || key.indexOf(title) >= 0) return TITLE_ID_MAP[key]
  }
  const hash = createHash('md5').update(filename).digest('hex').slice(0, 8)
  const safe = title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '')
    .slice(0, 12)
  return (safe || 'book') + '_' + hash
}

function readText(filePath) {
  let buf = fs.readFileSync(filePath)
  // strip UTF-8 BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.slice(3)
  }
  return buf.toString('utf8')
}

function resolveHref(baseDir, href) {
  const clean = String(href || '').split('#')[0].split('?')[0]
  if (!clean) return ''
  return path.normalize(path.join(baseDir, clean))
}

function parseXmlAttr(tag, attr) {
  const re = new RegExp(attr + '\\s*=\\s*["\']([^"\']+)["\']', 'i')
  const m = tag.match(re)
  return m ? m[1] : ''
}

function findOpfPath(extractDir) {
  const container = path.join(extractDir, 'META-INF', 'container.xml')
  if (!fs.existsSync(container)) {
    // fallback: search *.opf
    const walk = (dir) => {
      const names = fs.readdirSync(dir)
      for (let i = 0; i < names.length; i++) {
        const p = path.join(dir, names[i])
        const st = fs.statSync(p)
        if (st.isDirectory()) {
          const found = walk(p)
          if (found) return found
        } else if (/\.opf$/i.test(names[i])) {
          return path.relative(extractDir, p)
        }
      }
      return ''
    }
    return walk(extractDir)
  }
  const xml = readText(container)
  const m = xml.match(/full-path\s*=\s*["']([^"']+)["']/i)
  return m ? m[1] : ''
}

function parseOpf(opfPath) {
  const xml = readText(opfPath)
  const opfDir = path.dirname(opfPath)
  const manifest = {}
  const itemRe = /<item\b[^>]*>/gi
  let m
  while ((m = itemRe.exec(xml))) {
    const tag = m[0]
    const id = parseXmlAttr(tag, 'id')
    const href = parseXmlAttr(tag, 'href')
    const media = parseXmlAttr(tag, 'media-type')
    if (id && href) {
      manifest[id] = { href, media }
    }
  }

  const spine = []
  const itemrefRe = /<itemref\b[^>]*>/gi
  while ((m = itemrefRe.exec(xml))) {
    const idref = parseXmlAttr(m[0], 'idref')
    if (idref && manifest[idref]) spine.push(manifest[idref])
  }

  let docTitle = ''
  const titleM = xml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)
  if (titleM) docTitle = stripHtml(titleM[1])

  let creator = '东野圭吾'
  const creatorM = xml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)
  if (creatorM) creator = stripHtml(creatorM[1]) || creator

  return { opfDir, spine, docTitle, creator }
}

function chapterTitleFromHtml(html, fallback) {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (h) {
    const t = stripHtml(h[1])
    if (t && t.length < 80) return t
  }
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleTag) {
    const t = stripHtml(titleTag[1])
    if (t && t.length < 80 && t.indexOf('.htm') < 0) return t
  }
  return fallback
}

function convertOneEpub(epubPath) {
  const filename = path.basename(epubPath)
  const titleFromFile = extractTitleFromFilename(filename)
  const bookId = toBookId(titleFromFile, filename)
  const workTmp = path.join(TMP_ROOT, bookId)
  rmrf(workTmp)
  ensureDir(workTmp)

  try {
    execFileSync('unzip', ['-qq', '-o', epubPath, '-d', workTmp], { stdio: 'pipe' })
  } catch (err) {
    console.error('解压失败', filename, err.message)
    return null
  }

  const opfRel = findOpfPath(workTmp)
  if (!opfRel) {
    console.error('找不到 OPF', filename)
    return null
  }
  const opfAbs = path.join(workTmp, opfRel)
  const { opfDir, spine, docTitle, creator } = parseOpf(opfAbs)
  const title = docTitle || titleFromFile

  const chapters = []
  for (let i = 0; i < spine.length; i++) {
    const item = spine[i]
    const media = (item.media || '').toLowerCase()
    if (media && media.indexOf('html') < 0 && media.indexOf('xml') < 0) continue
    const filePath = resolveHref(opfDir, item.href)
    if (!filePath || !fs.existsSync(filePath)) continue
    let html = ''
    try {
      html = readText(filePath)
    } catch (e) {
      continue
    }
    const rawContent = stripHtml(html)
    if (!rawContent || rawContent.length < 40) continue
    const idx = chapters.length + 1
    const rawTitle = chapterTitleFromHtml(html, '第' + idx + '章')
    const content = normalizeChapterContent(rawContent, rawTitle)
    if (!content || content.length < 20) continue
    chapters.push({
      index: idx,
      title: formatChapterTitle(rawTitle, idx),
      content,
    })
  }

  if (!chapters.length) {
    console.error('无有效章节', filename)
    return null
  }

  const book = {
    id: bookId,
    title,
    author: creator || '东野圭吾',
    chapterCount: chapters.length,
    chapters,
  }
  fs.writeFileSync(path.join(OUT_DIR, bookId + '.json'), JSON.stringify(book), 'utf8')

  console.log('OK', bookId, title, chapters.length + '章')
  return {
    id: bookId,
    title,
    author: book.author,
    chapterCount: chapters.length,
  }
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('源目录不存在:', SOURCE_DIR)
    process.exit(1)
  }
  // 清空旧的分章目录，避免残留
  rmrf(OUT_DIR)
  ensureDir(OUT_DIR)
  rmrf(TMP_ROOT)
  ensureDir(TMP_ROOT)

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((n) => /\.epub$/i.test(n))
    .map((n) => path.join(SOURCE_DIR, n))
    .sort()

  console.log('共', files.length, '本 epub')
  const catalog = []
  for (let i = 0; i < files.length; i++) {
    const meta = convertOneEpub(files[i])
    if (meta) catalog.push(meta)
  }

  catalog.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh'))
  fs.writeFileSync(
    path.join(OUT_DIR, 'catalog.json'),
    JSON.stringify({ author: '东野圭吾', books: catalog }, null, 2),
    'utf8'
  )

  rmrf(TMP_ROOT)
  console.log('完成：', catalog.length, '本 →', OUT_DIR)
  console.log('请将 books-dist/dongye/ 上传到云存储 book/dongye/')
}

main()
