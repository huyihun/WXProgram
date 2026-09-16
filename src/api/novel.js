/**
 * 小说：云存储 book/{shelf}/
 * catalog.json + {bookId}.json（一书一文件，含全部章节）
 * shelf 默认 dongye；珍藏为 zhencang
 */
import { getPlayUrl } from '@/utils/playlist'

const CLOUD_ROOT =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/book/'

const DEFAULT_SHELF = 'dongye'

/** 珍藏书架 fileID（来自 books-dist/zhencang/zc.json 云导出） */
const ZHENCANG_FILE_IDS = {
  catalog:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/book/zhencang/catalog.json',
  renshengjiajianfa:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/book/zhencang/renshengjiajianfa.json',
}

/** shelf → catalog */
const catalogCacheByShelf = {}
/** cacheKey → book */
const bookCache = {}
/** cacheKey → Promise */
const bookInflight = {}

export function normalizeShelf(shelf) {
  const s = String(shelf || '').trim()
  if (s === 'zhencang') return 'zhencang'
  return DEFAULT_SHELF
}

function shelfPrefix(shelf) {
  return CLOUD_ROOT + normalizeShelf(shelf) + '/'
}

function fileId(shelf, relPath) {
  const s = normalizeShelf(shelf)
  if (s === 'zhencang') {
    if (relPath === 'catalog.json') return ZHENCANG_FILE_IDS.catalog
    const bookId = String(relPath || '').replace(/\.json$/i, '')
    if (ZHENCANG_FILE_IDS[bookId]) return ZHENCANG_FILE_IDS[bookId]
  }
  return shelfPrefix(s) + relPath
}

function bookCacheKey(shelf, bookId) {
  return normalizeShelf(shelf) + ':' + bookId
}

function progressKey(shelf, bookId) {
  const s = normalizeShelf(shelf)
  if (s === DEFAULT_SHELF) return 'novelProgress_' + bookId
  return 'novelProgress_' + s + '_' + bookId
}

/** 小 JSON：云函数直接返回 */
async function fetchJsonByCloud(fid) {
  if (!wx.cloud) throw new Error('云能力不可用')

  const res = await wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: { fileID: fid, asJson: true },
  })
  const body = res.result || {}
  if (!body.ok) {
    throw new Error(body.errMsg || '加载失败')
  }
  return body.data
}

/** 大 JSON：临时链 + downloadFile + readFile（避开云函数约 1MB 返回上限） */
async function fetchJsonByDownload(fid) {
  const url = await getPlayUrl(fid)
  const tempPath = await new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载失败 ' + (res.statusCode || '')))
          return
        }
        resolve(res.tempFilePath)
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '下载失败'
        if (String(msg).indexOf('url not in domain list') >= 0) {
          reject(new Error('需配置downloadFile域名'))
          return
        }
        reject(new Error(msg))
      },
    })
  })

  const text = await new Promise((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath: tempPath,
      encoding: 'utf8',
      success: (r) => resolve(r.data),
      fail: (err) => reject(err),
    })
  })

  if (typeof text !== 'string') {
    throw new Error('读取文件失败')
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error('JSON 解析失败')
  }
}

/** 书架目录 */
export async function fetchNovelCatalog(shelf) {
  const s = normalizeShelf(shelf)
  if (catalogCacheByShelf[s]) return catalogCacheByShelf[s]
  const data = await fetchJsonByCloud(fileId(s, 'catalog.json'))
  const books = (data && data.books) || []
  const defaultAuthor = s === 'zhencang' ? '珍藏' : '东野圭吾'
  catalogCacheByShelf[s] = {
    author: (data && data.author) || defaultAuthor,
    title: (data && data.title) || defaultAuthor,
    shelf: s,
    books,
  }
  return catalogCacheByShelf[s]
}

export function getCachedCatalog(shelf) {
  return catalogCacheByShelf[normalizeShelf(shelf)] || null
}

/** 拉取整书（带内存缓存） */
export async function fetchNovelBook(bookId, shelf) {
  if (!bookId) throw new Error('缺少 bookId')
  const s = normalizeShelf(shelf)
  const key = bookCacheKey(s, bookId)
  if (bookCache[key]) return bookCache[key]
  if (bookInflight[key]) return bookInflight[key]

  bookInflight[key] = (async () => {
    const data = await fetchJsonByDownload(fileId(s, bookId + '.json'))
    if (!data || !data.id) throw new Error('书籍数据无效')
    bookCache[key] = data
    return data
  })()

  try {
    return await bookInflight[key]
  } finally {
    bookInflight[key] = null
  }
}

/** 单书 meta（走整书缓存） */
export async function fetchNovelMeta(bookId, shelf) {
  const book = await fetchNovelBook(bookId, shelf)
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    chapterCount: book.chapterCount,
  }
}

/** 清洗章首：去重复标题、孤立节号、多余空行、bookcover 杂质 */
export function normalizeChapterContent(content, title) {
  let s = String(content || '')
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  s = s.replace(/^bookcover\s*\n*/i, '')
  // 仅空白（含全角空格）的行视为空行
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
    stripLeading(function (line) {
      return compactLine(line) === titleKey
    }, 4)
  }

  // 章首孤立「1 / 2 / 一」等节号（常与标题重复）
  stripLeading(isSectionNum, 3)

  s = s.replace(/^\n+/, '')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.replace(/\s+$/, '')
}

/** 纯数字标题改为「第N节」，避免和正文节号叠成「三个1」 */
export function formatChapterTitle(title, index) {
  const t = String(title || '').trim()
  const n = Number(index) || 1
  if (!t) return '第' + n + '章'
  const compact = t.replace(/[\s\u3000]/g, '')
  if (/^[0-9０-９]{1,3}$/.test(compact)) return '第' + compact + '节'
  return t
}

function polishChapter(ch) {
  if (!ch) return null
  if (ch._polished) return ch
  const rawTitle = ch.title || ''
  ch.content = normalizeChapterContent(ch.content, rawTitle)
  ch.title = formatChapterTitle(rawTitle, ch.index)
  ch._polished = true
  return ch
}

/** 单章：从已缓存整书取，不再请求单章文件 */
export async function fetchNovelChapter(bookId, index, shelf) {
  const book = await fetchNovelBook(bookId, shelf)
  const list = book.chapters || []
  const n = Number(index) || 1
  for (let i = 0; i < list.length; i++) {
    if (Number(list[i].index) === n) return polishChapter(list[i])
  }
  if (n >= 1 && n <= list.length) return polishChapter(list[n - 1])
  throw new Error('章节不存在')
}

/** 同步取章（整书已在缓存时用，切章零请求） */
export function getCachedChapter(bookId, index, shelf) {
  const book = bookCache[bookCacheKey(shelf, bookId)]
  if (!book) return null
  const list = book.chapters || []
  const n = Number(index) || 1
  for (let i = 0; i < list.length; i++) {
    if (Number(list[i].index) === n) return polishChapter(list[i])
  }
  if (n >= 1 && n <= list.length) return polishChapter(list[n - 1])
  return null
}

export function getCachedBook(bookId, shelf) {
  return bookCache[bookCacheKey(shelf, bookId)] || null
}

export function getNovelProgress(bookId, shelf) {
  try {
    const raw = uni.getStorageSync(progressKey(shelf, bookId))
    const n = Number(raw)
    return isFinite(n) && n >= 1 ? n : 1
  } catch (e) {
    return 1
  }
}

export function setNovelProgress(bookId, chapterIndex, shelf) {
  const n = Number(chapterIndex)
  if (!bookId || !isFinite(n) || n < 1) return
  try {
    uni.setStorageSync(progressKey(shelf, bookId), n)
  } catch (e) {
    // ignore
  }
}

export function shelfCloudPrefix(shelf) {
  return shelfPrefix(shelf)
}

export const CLOUD_PREFIX = shelfPrefix(DEFAULT_SHELF)
