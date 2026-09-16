/**
 * 将珍藏书架 .mobi 转为「一书一 JSON」
 *
 * 用法：npm run books:zhencang
 * 转换优先级：
 *   1) 本机 Calibre ebook-convert（mobi → epub → 解压）
 *   2) 项目内 .venv-mobi 的 Python mobi 包（单 html 抽出）
 *
 * 输出：books-dist/zhencang/{bookId}.json + catalog.json
 * 章节策略：少拆；篇数过多或单页 mobi 则合并为「全文」
 */
import fs from 'fs'
import path from 'path'
import { execFileSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SOURCE_DIR = path.join(ROOT, 'assets', 'book', 'zhencang')
const OUT_DIR = path.join(ROOT, 'books-dist', 'zhencang')
const TMP_ROOT = path.join(ROOT, 'books-dist', '.tmp-zhencang')

const BOOK_ID = 'renshengjiajianfa'
const FALLBACK_TITLE = '人生加减法（珍藏版）'
const MAX_SPLIT_CHAPTERS = 12

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function findEbookConvert() {
  const candidates = [
    'ebook-convert',
    '/Applications/calibre.app/Contents/MacOS/ebook-convert',
    '/usr/local/bin/ebook-convert',
    '/opt/homebrew/bin/ebook-convert',
  ]
  for (let i = 0; i < candidates.length; i++) {
    const bin = candidates[i]
    try {
      if (bin.indexOf('/') >= 0) {
        if (fs.existsSync(bin)) return bin
      } else {
        execFileSync('which', [bin], { stdio: 'pipe' })
        return bin
      }
    } catch (e) {
      // continue
    }
  }
  return ''
}

function findPythonMobi() {
  const venvPy = path.join(ROOT, '.venv-mobi', 'bin', 'python')
  if (fs.existsSync(venvPy)) return venvPy
  return ''
}

function stripHtml(html) {
  let s = String(html || '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<mbp:pagebreak\s*\/?>/gi, '\n\n')
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

function readText(filePath) {
  let buf = fs.readFileSync(filePath)
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

  let creator = ''
  const creatorM = xml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)
  if (creatorM) creator = stripHtml(creatorM[1]) || ''

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

function maybeMergeChapters(chapters) {
  if (!chapters.length) return chapters
  if (chapters.length <= MAX_SPLIT_CHAPTERS) return chapters
  const merged = []
  for (let i = 0; i < chapters.length; i++) {
    if (i > 0) merged.push('\n\n')
    if (chapters[i].title) {
      merged.push(chapters[i].title)
      merged.push('\n\n')
    }
    merged.push(chapters[i].content)
  }
  return [
    {
      index: 1,
      title: '全文',
      content: merged.join('').replace(/\n{3,}/g, '\n\n').trim(),
    },
  ]
}

function cleanMobiPlainText(text) {
  let s = String(text || '').trim()
  const marker = '之所以有本书的创意'
  const i = s.indexOf(marker)
  if (i >= 0) {
    const head = s.lastIndexOf('序', i)
    if (head >= 0 && i - head < 40) s = s.slice(head)
    else s = '序\n\n' + s.slice(i)
  }
  const cuts = ['Table of Contents', 'of Contents\n\n序\n\n第一章']
  for (let c = 0; c < cuts.length; c++) {
    const j = s.lastIndexOf(cuts[c])
    if (j > s.length / 2) {
      s = s.slice(0, j).replace(/\s+$/, '')
      break
    }
  }
  const dup = s.lastIndexOf('\n序\n\n第一章 加入智慧的光芒(1)')
  if (dup > s.length / 2) s = s.slice(0, dup).replace(/\s+$/, '')
  return s.replace(/\n{3,}/g, '\n\n').trim()
}

function extractChaptersFromEpub(epubPath) {
  const workTmp = path.join(TMP_ROOT, 'epub-work')
  rmrf(workTmp)
  ensureDir(workTmp)

  try {
    execFileSync('unzip', ['-qq', '-o', epubPath, '-d', workTmp], { stdio: 'pipe' })
  } catch (err) {
    throw new Error('解压 epub 失败: ' + ((err && err.message) || ''))
  }

  const opfRel = findOpfPath(workTmp)
  if (!opfRel) throw new Error('找不到 OPF')
  const opfAbs = path.join(workTmp, opfRel)
  const { opfDir, spine, docTitle, creator } = parseOpf(opfAbs)

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

  if (!chapters.length) throw new Error('无有效正文')

  return {
    title: docTitle || FALLBACK_TITLE,
    author: creator || '',
    chapters: maybeMergeChapters(chapters),
  }
}

function convertViaCalibre(mobiPath) {
  const convertBin = findEbookConvert()
  if (!convertBin) return null

  ensureDir(TMP_ROOT)
  const epubPath = path.join(TMP_ROOT, BOOK_ID + '.epub')
  if (fs.existsSync(epubPath)) fs.unlinkSync(epubPath)

  console.log('使用 Calibre 转换 mobi → epub …')
  execFileSync(convertBin, [mobiPath, epubPath], { stdio: 'inherit' })
  if (!fs.existsSync(epubPath)) throw new Error('未生成 epub')
  return extractChaptersFromEpub(epubPath)
}

function convertViaPythonMobi(mobiPath) {
  const py = findPythonMobi()
  if (!py) return null

  console.log('使用 Python mobi 抽取正文 …')
  const helper = `
import json, re, sys
from mobi import extract

src = sys.argv[1]
fpath, ebook_path = extract(src)
raw = open(ebook_path, 'rb').read().decode('utf-8', 'replace')
s = raw
s = re.sub(r'<script[\\s\\S]*?</script>', '', s, flags=re.I)
s = re.sub(r'<style[\\s\\S]*?</style>', '', s, flags=re.I)
s = re.sub(r'<mbp:pagebreak\\\\s*/?>', '\\n\\n', s, flags=re.I)
s = re.sub(r'<br\\\\s*/?>', '\\n', s, flags=re.I)
s = re.sub(r'</p>', '\\n\\n', s, flags=re.I)
s = re.sub(r'</div>', '\\n', s, flags=re.I)
s = re.sub(r'</h[1-6]>', '\\n\\n', s, flags=re.I)
s = re.sub(r'<[^>]+>', '', s)
import html as H
s = H.unescape(s).replace('\\r\\n', '\\n').replace('\\r', '\\n')
s = re.sub(r'[ \\t]+\\n', '\\n', s)
s = re.sub(r'\\n{3,}', '\\n\\n', s).strip()
print(json.dumps({'title': ${JSON.stringify(FALLBACK_TITLE)}, 'text': s}, ensure_ascii=False))
`
  // Simpler: write helper file
  const helperPath = path.join(TMP_ROOT, 'extract_mobi.py')
  ensureDir(TMP_ROOT)
  fs.writeFileSync(
    helperPath,
    [
      'import json, re, sys, html as H',
      'from mobi import extract',
      'src = sys.argv[1]',
      'fpath, ebook_path = extract(src)',
      "raw = open(ebook_path, 'rb').read().decode('utf-8', 'replace')",
      's = raw',
      "s = re.sub(r'<script[\\s\\S]*?</script>', '', s, flags=re.I)",
      "s = re.sub(r'<style[\\s\\S]*?</style>', '', s, flags=re.I)",
      "s = re.sub(r'<mbp:pagebreak\\s*/?>', '\\n\\n', s, flags=re.I)",
      "s = re.sub(r'<br\\s*/?>', '\\n', s, flags=re.I)",
      "s = re.sub(r'</p>', '\\n\\n', s, flags=re.I)",
      "s = re.sub(r'</div>', '\\n', s, flags=re.I)",
      "s = re.sub(r'</h[1-6]>', '\\n\\n', s, flags=re.I)",
      "s = re.sub(r'<[^>]+>', '', s)",
      "s = H.unescape(s).replace('\\r\\n', '\\n').replace('\\r', '\\n')",
      "s = re.sub(r'[ \\t]+\\n', '\\n', s)",
      "s = re.sub(r'\\n{3,}', '\\n\\n', s).strip()",
      "print(json.dumps({'text': s}, ensure_ascii=False))",
    ].join('\n'),
    'utf8'
  )

  const res = spawnSync(py, [helperPath, mobiPath], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || 'python mobi 失败').slice(0, 500))
  }
  const data = JSON.parse(res.stdout)
  const text = cleanMobiPlainText(data.text || '')
  if (!text || text.length < 40) throw new Error('抽取正文过短')
  return {
    title: FALLBACK_TITLE,
    author: '',
    chapters: [{ index: 1, title: '全文', content: text }],
  }
}

function convertMobi(mobiPath) {
  let extracted = null
  try {
    extracted = convertViaCalibre(mobiPath)
  } catch (e) {
    console.warn('Calibre 转换失败，尝试 Python 回退:', (e && e.message) || e)
  }
  if (extracted) return extracted

  extracted = convertViaPythonMobi(mobiPath)
  if (extracted) return extracted

  console.error('无法转换 mobi。请任选其一：')
  console.error('  1) 安装 Calibre（ebook-convert）')
  console.error('  2) python3 -m venv .venv-mobi && .venv-mobi/bin/pip install mobi')
  process.exit(1)
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('源目录不存在:', SOURCE_DIR)
    process.exit(1)
  }

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((n) => /\.mobi$/i.test(n))
    .map((n) => path.join(SOURCE_DIR, n))
    .sort()

  if (!files.length) {
    console.error('未找到 .mobi，请放到', SOURCE_DIR)
    process.exit(1)
  }

  rmrf(OUT_DIR)
  ensureDir(OUT_DIR)
  rmrf(TMP_ROOT)
  ensureDir(TMP_ROOT)

  const mobiPath = files[0]
  console.log('源文件:', path.basename(mobiPath))

  const extracted = convertMobi(mobiPath)
  const book = {
    id: BOOK_ID,
    title: extracted.title || FALLBACK_TITLE,
    author: extracted.author || '',
    chapterCount: extracted.chapters.length,
    chapters: extracted.chapters,
  }

  fs.writeFileSync(path.join(OUT_DIR, BOOK_ID + '.json'), JSON.stringify(book), 'utf8')

  const catalog = {
    author: '珍藏',
    shelf: 'zhencang',
    title: '珍藏',
    books: [
      {
        id: book.id,
        title: book.title,
        author: book.author,
        chapterCount: book.chapterCount,
      },
    ],
  }
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8')

  rmrf(TMP_ROOT)
  console.log('OK', book.id, book.title, book.chapterCount + '章')
  console.log('输出:', OUT_DIR)
  console.log('请将 books-dist/zhencang/ 上传到云存储 book/zhencang/')
}

main()
