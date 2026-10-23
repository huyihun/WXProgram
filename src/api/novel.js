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

/* ---------- 阅读进度：本地即时写 + 云端 novel_prefs 单文档同步 ---------- */
const PROGRESS_CLOUD_COL = 'novel_prefs'
const PROGRESS_SYNC_DELAY = 1500

let progressCloudDocId = ''
let progressCloudLoaded = false
let progressSyncTimer = null
let progressSyncDirty = false
let progressSyncing = false

function normalizeProgressEntry(raw) {
  if (!raw) return null
  if (typeof raw === 'object' && raw.chapter) {
    return {
      chapter: Number(raw.chapter) || 1,
      page: Number(raw.page) || 1,
      updatedAt: Number(raw.updatedAt) || 0,
    }
  }
  const n = Number(raw)
  if (isFinite(n) && n >= 1) return { chapter: n, page: 1, updatedAt: 0 }
  return null
}

function readLocalProgressEntry(shelf, bookId) {
  try {
    return normalizeProgressEntry(uni.getStorageSync(progressKey(shelf, bookId)))
  } catch (e) {
    return null
  }
}

function writeProgressByKey(key, entry) {
  try {
    uni.setStorageSync(key, entry)
  } catch (e) {
    // ignore
  }
}

/** 枚举本地全部阅读进度（storage keys 前缀过滤） */
function collectLocalProgress() {
  let keys = []
  try {
    const info = uni.getStorageInfoSync()
    keys = (info && info.keys) || []
  } catch (e) {
    return {}
  }
  const out = {}
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (!k || k.indexOf('novelProgress_') !== 0) continue
    try {
      const entry = normalizeProgressEntry(uni.getStorageSync(k))
      if (entry) out[k] = entry
    } catch (e) {
      // ignore
    }
  }
  return out
}

/** 拉取云端进度，按 updatedAt 新者胜合并回本地（跨设备/重装恢复） */
export async function syncNovelProgressFromCloud() {
  if (!wx.cloud || progressCloudLoaded) return
  progressCloudLoaded = true
  try {
    const db = wx.cloud.database()
    const res = await db.collection(PROGRESS_CLOUD_COL).limit(1).get()
    const row = res.data && res.data[0]
    if (!row) return
    progressCloudDocId = row._id || ''
    const cloudMap = row.progress || {}
    const keys = Object.keys(cloudMap)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const c = normalizeProgressEntry(cloudMap[k])
      if (!c || !k || k.indexOf('novelProgress_') !== 0) continue
      let local = null
      try {
        local = normalizeProgressEntry(uni.getStorageSync(k))
      } catch (e) {
        local = null
      }
      if (!local || (Number(c.updatedAt) || 0) > (Number(local.updatedAt) || 0)) {
        writeProgressByKey(k, c)
      }
    }
  } catch (err) {
    console.warn('[novel] 进度云拉取失败', err)
  }
}

/** 云推送（防抖）：进度写入后自动触发 */
function queueNovelProgressSync() {
  progressSyncDirty = true
  if (progressSyncTimer) return
  progressSyncTimer = setTimeout(function () {
    progressSyncTimer = null
    flushNovelProgressSync()
  }, PROGRESS_SYNC_DELAY)
}

/** 立即冲刷待同步进度（onHide/onUnload 时调用） */
export function flushNovelProgressSync() {
  if (progressSyncTimer) {
    clearTimeout(progressSyncTimer)
    progressSyncTimer = null
  }
  if (!progressSyncDirty || progressSyncing || !wx.cloud) return
  progressSyncing = true
  const progress = collectLocalProgress()
  const db = wx.cloud.database()
  const _ = db.command
  const now = Date.now()
  const run = progressCloudDocId
    ? db
        .collection(PROGRESS_CLOUD_COL)
        .doc(progressCloudDocId)
        .update({ data: { progress: _.set(progress), updatedAt: now } })
    : db.collection(PROGRESS_CLOUD_COL).add({ data: { progress: progress, updatedAt: now } })
  run
    .then(function (res) {
      if (res && res._id) progressCloudDocId = res._id
      progressSyncDirty = false
      progressSyncing = false
    })
    .catch(function (err) {
      console.warn('[novel] 进度云同步失败', err)
      progressSyncing = false
    })
}

export function getNovelProgress(bookId, shelf) {
  const e = readLocalProgressEntry(shelf, bookId)
  return e && e.chapter >= 1 ? e.chapter : 1
}

/** 上次阅读停留在章内第几页（1 起） */
export function getNovelProgressPage(bookId, shelf) {
  const e = readLocalProgressEntry(shelf, bookId)
  return e && Number(e.page) >= 1 ? Number(e.page) : 1
}

export function setNovelProgress(bookId, chapterIndex, shelf, page) {
  const n = Number(chapterIndex)
  if (!bookId || !isFinite(n) || n < 1) return
  const entry = {
    chapter: n,
    page: Math.max(1, Number(page) || 1),
    updatedAt: Date.now(),
  }
  try {
    uni.setStorageSync(progressKey(shelf, bookId), entry)
  } catch (e) {
    // ignore
  }
  queueNovelProgressSync()
}

export function shelfCloudPrefix(shelf) {
  return shelfPrefix(shelf)
}

export const CLOUD_PREFIX = shelfPrefix(DEFAULT_SHELF)
