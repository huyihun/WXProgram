/**
 * 心情表情目录（云数据库）
 *
 * 控制台创建集合 mood_emojis，权限建议：
 * - 所有用户可读，仅管理端可写
 * （所有人要选心情；目录是公共配置，不是每人一份）
 *
 * 云存储目录建议：mood/emoji/001.png … 100.png
 * 上传后把 fileID 写回对应文档
 *
 * 文档字段见 src/data/moodCatalog.json
 */

import fallbackList from '@/data/moodCatalog.json'

const COL = 'mood_emojis'
const PAGE_SIZE = 20
const cache = { list: null, at: 0 }
const CACHE_MS = 5 * 60 * 1000
/** HTTPS 临时链内存缓存（云临时链约 2h，留余量） */
const URL_CACHE_MS = 90 * 60 * 1000
const urlCache = { map: {}, at: 0 }
/** 本地下载路径：fileID -> 本地文件路径（二次打开秒显） */
const localPathCache = {}
let prefetchPromise = null
// 与云存储环境一致；fileID 必须以完整文件名结尾（含空格与扩展名）
const CLOUD_FILE_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/'

function isUrlCacheFresh() {
  return urlCache.at > 0 && Date.now() - urlCache.at < URL_CACHE_MS
}

function hasLocalFile(path) {
  if (!path) return false
  try {
    uni.getFileSystemManager().accessSync(path)
    return true
  } catch (e) {
    return false
  }
}

function getMoodLocalPath(fileID) {
  const root = (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) || ''
  if (!root || !fileID) return ''
  const name = String(fileID).split('/').pop() || 'mood.png'
  // 用 id 数字段避免中文路径兼容问题：从 "圆梦精品素材 (12).png" 取序号
  const m = name.match(/\((\d+)\)\.png$/i)
  const safe = m ? 'mood_' + m[1] + '.png' : 'mood_' + name.replace(/[^\w.-]/g, '_')
  return root + '/mood_img/' + safe
}

function downloadMoodToPath(url, filePath) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载心情图失败'))
          return
        }
        if (!filePath) {
          resolve(res.tempFilePath)
          return
        }
        try {
          const fs = uni.getFileSystemManager()
          const dir = filePath.substring(0, filePath.lastIndexOf('/'))
          try {
            fs.accessSync(dir)
          } catch (e) {
            try {
              fs.mkdirSync(dir, true)
            } catch (e2) {
              // ignore
            }
          }
          fs.saveFile({
            tempFilePath: res.tempFilePath,
            filePath: filePath,
            success: () => resolve(filePath),
            fail: () => resolve(res.tempFilePath),
          })
        } catch (e) {
          resolve(res.tempFilePath)
        }
      },
      fail: reject,
    })
  })
}

/** 把已换好的 HTTPS 图落到本地，供下次秒开 */
async function warmLocalMoodImages(urlMap) {
  const ids = Object.keys(urlMap || {})
  const CONCUR = 4
  let i = 0
  async function worker() {
    while (i < ids.length) {
      const id = ids[i]
      i += 1
      if (localPathCache[id] && hasLocalFile(localPathCache[id])) continue
      const persist = getMoodLocalPath(id)
      if (hasLocalFile(persist)) {
        localPathCache[id] = persist
        continue
      }
      try {
        const path = await downloadMoodToPath(urlMap[id], persist)
        if (path) localPathCache[id] = path
      } catch (err) {
        // 单张失败不影响整体
      }
    }
  }
  const jobs = []
  for (let n = 0; n < CONCUR; n++) jobs.push(worker())
  await Promise.all(jobs)
}

function displayUrlFor(fileID) {
  if (!fileID) return ''
  if (localPathCache[fileID] && hasLocalFile(localPathCache[fileID])) {
    return localPathCache[fileID]
  }
  const persist = getMoodLocalPath(fileID)
  if (hasLocalFile(persist)) {
    localPathCache[fileID] = persist
    return persist
  }
  if (isUrlCacheFresh() && urlCache.map[fileID]) return urlCache.map[fileID]
  return ''
}

function getDb() {
  return wx.cloud.database()
}

/** 补全被截断的 fileID（曾误写成 …/圆梦精品素材，缺 " (N).png"） */
function ensureFileID(item) {
  if (!item) return item
  const id = item.fileID || ''
  if (id.indexOf('.png') >= 0 || id.indexOf('.jpg') >= 0 || id.indexOf('.webp') >= 0) {
    return item
  }
  if (item.cloudPath) {
    item.fileID = CLOUD_FILE_PREFIX + item.cloudPath
  }
  return item
}

async function fetchAll(buildQuery) {
  const all = []
  let skip = 0
  while (true) {
    const res = await buildQuery().skip(skip).limit(PAGE_SIZE).get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) {
      all.push(batch[i])
    }
    if (batch.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }
  return all
}

function normalizeItem(row) {
  if (!row) return null
  const theme = row.theme || {}
  return {
    _id: row._id || '',
    id: row.id,
    key: row.key,
    label: row.label,
    sort: row.sort || row.id || 0,
    enabled: row.enabled !== false,
    file: row.file || '',
    cloudPath: row.cloudPath || '',
    fileID: row.fileID || '',
    theme: {
      primary: theme.primary || '#8B5E3C',
      primaryDark: theme.primaryDark || '#6B4423',
      bg: theme.bg || '#F3EBE3',
      nav: theme.nav || theme.bg || '#EDE2D6',
      title: theme.title || '#3E2723',
      subtitle: theme.subtitle || theme.primaryDark || '#8D6E63',
      cardSoft: theme.cardSoft || '#FAF6F2',
      gradientHero:
        theme.gradientHero ||
        'linear-gradient(180deg, ' + (theme.bg || '#F3EBE3') + ' 0%, #FFFFFF 100%)',
    },
  }
}

/** 本地清单兜底（云库未建 / 拉取失败时） */
export function getFallbackMoodCatalog() {
  const list = []
  for (let i = 0; i < fallbackList.length; i++) {
    const item = ensureFileID(normalizeItem(fallbackList[i]))
    if (item && item.enabled) list.push(item)
  }
  list.sort((a, b) => a.sort - b.sort)
  return list
}

/** 拉取心情表情目录（有缓存）
 * 以本地清单为准（控制展示数量），云库同 key 文档用来补 fileID / theme
 */
export async function listMoodEmojis(force) {
  if (!force && cache.list && Date.now() - cache.at < CACHE_MS) {
    return cache.list
  }

  const fallback = getFallbackMoodCatalog()
  const cloudByKey = {}

  try {
    const rows = await fetchAll(() => getDb().collection(COL).where({ enabled: true }))
    for (let i = 0; i < rows.length; i++) {
      const item = normalizeItem(rows[i])
      if (!item || !item.key) continue
      cloudByKey[item.key] = item
    }
  } catch (err) {
    console.warn('[moodCatalog] 云拉取失败，使用本地清单', err)
  }

  const list = []
  for (let i = 0; i < fallback.length; i++) {
    const base = fallback[i]
    const cloud = cloudByKey[base.key]
    const item = Object.assign({}, base)
    if (cloud) {
      // 主题色以本地目录为准；云库只补 fileID / 路径 / 文案
      if (cloud.fileID && cloud.fileID.indexOf('.png') >= 0) {
        item.fileID = cloud.fileID
      }
      if (cloud.cloudPath) item.cloudPath = cloud.cloudPath
      if (cloud.label) item.label = cloud.label
      if (cloud._id) item._id = cloud._id
    }
    ensureFileID(item)
    list.push(item)
  }
  list.sort((a, b) => a.sort - b.sort)
  cache.list = list
  cache.at = Date.now()
  return list
}

export async function getMoodEmojiByKey(key) {
  const list = await listMoodEmojis()
  for (let i = 0; i < list.length; i++) {
    if (list[i].key === key) return list[i]
  }
  return null
}

/**
 * 批量解析图片 HTTPS 地址（经 getMusicUrl 云函数换链，勿直接用 cloud:// 当 image src）
 * 命中内存缓存则跳过云函数；返回 map: fileID -> tempFileURL
 */
export async function resolveMoodImageUrls(items) {
  const ids = []
  const seen = {}
  for (let i = 0; i < items.length; i++) {
    const id = items[i].fileID
    if (!id || seen[id]) continue
    seen[id] = true
    ids.push(id)
  }
  if (!ids.length) return {}

  const fresh = isUrlCacheFresh()
  const map = {}
  const missing = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (fresh && urlCache.map[id]) {
      map[id] = urlCache.map[id]
    } else {
      missing.push(id)
    }
  }
  if (!missing.length) return map

  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50)
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMusicUrl',
        data: { fileList: chunk },
      })
      const body = (res && res.result) || {}
      if (!body.ok || !body.urls) {
        console.warn('[moodCatalog] 批量换链失败', body.errMsg)
        continue
      }
      const urls = body.urls
      const keys = Object.keys(urls)
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j]
        map[k] = urls[k]
        urlCache.map[k] = urls[k]
      }
      urlCache.at = Date.now()
    } catch (err) {
      console.warn('[moodCatalog] 批量换链异常', err)
    }
  }
  return map
}

function attachImageUrls(list, urlMap) {
  const next = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    let imageUrl = displayUrlFor(item.fileID)
    if (!imageUrl && item.fileID && urlMap[item.fileID]) {
      imageUrl = urlMap[item.fileID]
    }
    next.push(Object.assign({}, item, { imageUrl }))
  }
  return next
}

/**
 * 带 HTTPS / 本地 imageUrl 的目录（优先读缓存；缺链再换）
 */
export async function getMoodCatalogWithUrls() {
  const list = await listMoodEmojis()
  const urlMap = await resolveMoodImageUrls(list)
  return attachImageUrls(list, urlMap)
}

/**
 * 后台预热：拉目录 + 换链 + 本地下载（并发去重）
 */
export function prefetchMoodCatalog() {
  if (prefetchPromise) return prefetchPromise
  prefetchPromise = (async () => {
    try {
      const list = await listMoodEmojis()
      const urlMap = await resolveMoodImageUrls(list)
      // 不阻塞换链结果：下载在后台尽量完成
      warmLocalMoodImages(urlMap)
      return list
    } catch (err) {
      console.warn('[moodCatalog] 预热失败', err)
      return null
    } finally {
      prefetchPromise = null
    }
  })()
  return prefetchPromise
}

/** 缓存里是否已有可展示地址（本地优先，其次临时 HTTPS） */
export function getCachedMoodImageUrl(fileID) {
  return displayUrlFor(fileID)
}
