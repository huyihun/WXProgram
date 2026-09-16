/**
 * 音乐歌单与取源（微信云存储 fileID）
 *
 * VIP / 无损共用 USER_DATA 落盘（约 200MB LRU）。听过的歌下次直接播。
 * BackgroundAudioManager 对流式 HTTPS 不稳，一律本地下载后再播。
 */

import {
  getMusicPrefsState,
  ensureMusicPrefs,
  ensureLocalMusicPrefs,
  saveMusicPrefs,
  saveRemovedLocalOnly,
} from '@/api/musicPrefs'

import { FLAC_PLAYLIST } from '@/utils/flacPlaylist'
import { QS_PLAYLIST } from '@/utils/qsPlaylist'
import { BY_PLAYLIST } from '@/utils/byPlaylist'
import { ZJL_PLAYLIST } from '@/utils/zjlPlaylist'
import { ZM_PLAYLIST } from '@/utils/zmPlaylist'
import { XUSONG_PLAYLIST } from '@/utils/xusongPlaylist'
import { DY_PLAYLIST } from '@/utils/dyPlaylist'
import { ALIN_PLAYLIST } from '@/utils/alinPlaylist'
import { GT_PLAYLIST } from '@/utils/gtPlaylist'
import { BLIND_PLAYLIST } from '@/utils/blindPlaylist'
import {
  MUSIC_MODE_VIP,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  MUSIC_MODE_ZJL,
  MUSIC_MODE_ZM,
  MUSIC_MODE_XS,
  MUSIC_MODE_DY,
  MUSIC_MODE_ALIN,
  MUSIC_MODE_GT,
  MUSIC_MODE_BLIND,
  normalizeMusicMode,
} from '@/utils/musicModes'

export {
  MUSIC_MODE_VIP,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  MUSIC_MODE_ZJL,
  MUSIC_MODE_ZM,
  MUSIC_MODE_XS,
  MUSIC_MODE_DY,
  MUSIC_MODE_ALIN,
  MUSIC_MODE_GT,
  MUSIC_MODE_BLIND,
}


/** VIP 专属歌单（云存储 music/vip/） */
const VIP_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/vip/'

export const VIP_PLAYLIST = [
  {
    id: 'vip-xiaoban',
    title: '小半',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒- 小半.mp3',
  },
  {
    id: 'vip-wumingderen',
    title: '无名的人',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-无名的人.mp3',
  },
  {
    id: 'vip-xiaochou',
    title: '消愁',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 消愁(1).mp3',
  },
  {
    id: 'vip-zouma',
    title: '走马',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-走马.mp3',
  },
  {
    id: 'vip-xiangwo',
    title: '像我这样的人',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易+-+像我这样的人.mp3',
  },
  {
    id: 'vip-muma-chengshi',
    title: '牧马城市',
    artist: '毛不易',
    fileID: VIP_PREFIX + '牧马城市.mp3',
  },

  {
    id: 'vip-jie',
    title: '借',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易+-+借.mp3',
  },
  {
    id: 'vip-deng',
    title: '等',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易+-+等.mp3',
  },
  {
    id: 'vip-shiguangzhe',
    title: '拾光者',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-拾光者.mp3',
  },
  {
    id: 'vip-shengxia',
    title: '盛夏',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-盛夏.mp3',
  },
  {
    id: 'vip-ruhai',
    title: '入海',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-入海.mp3',
  },
  {
    id: 'vip-qingchun',
    title: '青春',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-青春.mp3',
  },
  {
    id: 'vip-nifeng',
    title: '逆风',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-逆风.mp3',
  },
  {
    id: 'vip-buran',
    title: '不染',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-不染.mp3',
  },
  {
    id: 'vip-17',
    title: '17',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-17.mp3',
  },
  {
    id: 'vip-yuan',
    title: '愿',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 愿.mp3',
  },
  {
    id: 'vip-yiyu',
    title: '呓语',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 呓语.mp3',
  },

  {
    id: 'vip-wuwen',
    title: '无问',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 无问.mp3',
  },
  {
    id: 'vip-muma-live',
    title: '牧马城市(Live)',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 牧马城市(Live).mp3',
  },
  {
    id: 'vip-huohua',
    title: '火花',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 火花.mp3',
  },
  {
    id: 'vip-hong',
    title: '红',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 红.mp3',
  },
  {
    id: 'vip-caomu',
    title: '草右',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 草右.mp3',
  },
  {
    id: 'vip-zhuxing',
    title: '祝星',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒+-+祝星.mp3',
  },

  {
    id: 'vip-yiranyi',
    title: '易燃易爆炸',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-易燃易爆炸.mp3',
  },
  {
    id: 'vip-xuni',
    title: '虚拟',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-虚拟.mp3',
  },
  {
    id: 'vip-guang',
    title: '光',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-光.mp3',
  },

  {
    id: 'vip-zidu',
    title: '自渡',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 自渡.mp3',
  },
  {
    id: 'vip-xingye',
    title: '星夜',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 星夜.mp3',
  },
  {
    id: 'vip-xitai',
    title: '戏台',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 戏台.mp3',
  },
  {
    id: 'vip-wangchuan',
    title: '望穿',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 望穿.mp3',
  },
  {
    id: 'vip-sihai',
    title: '四海',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 四海.mp3',
  },
  {
    id: 'vip-qingzhu',
    title: '庆祝',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 庆祝.mp3',
  },
  {
    id: 'vip-qilou',
    title: '七楼',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 七楼.mp3',
  },
  {
    id: 'vip-guoshi',
    title: '果实',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 果实.mp3',
  },
  {
    id: 'vip-congtou',
    title: '从头',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 从头.mp3',
  },
  {
    id: 'vip-buchao',
    title: '不妙',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 不妙.mp3',
  },
  {
    id: 'vip-airuo',
    title: '爱若',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 爱若.mp3',
  },
  {
    id: 'vip-star',
    title: '★',
    artist: '陈粒',
    fileID: VIP_PREFIX + '/陈粒 - ★.mp3',
  },
]


function loadPinnedFileIds(mode) {
  const prefs = getMusicPrefsState()
  const list = prefs.pinned && prefs.pinned[mode || 'flac']
  return list && list.length ? list : []
}

function filterRemoved(list) {
  const prefs = getMusicPrefsState()
  const removedList = prefs.removed || []
  if (!removedList.length) return list
  const removed = {}
  for (let i = 0; i < removedList.length; i++) {
    removed[removedList[i]] = true
  }
  const out = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (t && t.fileID && removed[t.fileID]) continue
    out.push(t)
  }
  return out
}

/** 置顶曲目排前，其余保持原顺序 */
function applyPinnedOrder(list, mode) {
  const pinned = loadPinnedFileIds(mode)
  if (!pinned.length) return list

  const byId = {}
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (t && t.fileID) byId[t.fileID] = t
  }

  const top = []
  const used = {}
  for (let i = 0; i < pinned.length; i++) {
    const fid = pinned[i]
    if (!byId[fid] || used[fid]) continue
    top.push(byId[fid])
    used[fid] = true
  }

  const rest = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (!t || !t.fileID || used[t.fileID]) continue
    rest.push(t)
  }
  return top.concat(rest)
}

/** 盲盒：好听/不好听移出抽歌池 */
function filterBlindRated(list, mode) {
  if (mode !== MUSIC_MODE_BLIND) return list
  const prefs = getMusicPrefsState()
  const skip = {}
  const liked = prefs.blindLiked || []
  const disliked = prefs.blindDisliked || []
  for (let i = 0; i < liked.length; i++) {
    if (liked[i]) skip[liked[i]] = true
  }
  for (let i = 0; i < disliked.length; i++) {
    if (disliked[i]) skip[disliked[i]] = true
  }
  if (!Object.keys(skip).length) return list
  const out = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (!t || !t.id || skip[t.id]) continue
    out.push(t)
  }
  return out
}

/** 应用已删过滤 + 盲盒评分过滤 + 置顶排序 */
export function withMusicPrefs(list, mode) {
  return applyPinnedOrder(filterBlindRated(filterRemoved(list), mode), mode)
}

/** 盲盒好听/不好听列表（仅过滤已删，保留评分曲） */
export function getBlindRatedPlaylist(kind) {
  const prefs = getMusicPrefsState()
  const ids = kind === 'dislike' ? prefs.blindDisliked || [] : prefs.blindLiked || []
  if (!ids.length) return []
  const base = filterRemoved(BLIND_PLAYLIST)
  const byId = {}
  for (let i = 0; i < base.length; i++) {
    const t = base[i]
    if (t && t.id) byId[t.id] = t
  }
  const out = []
  for (let i = 0; i < ids.length; i++) {
    const t = byId[ids[i]]
    if (t) out.push(t)
  }
  return out
}

export function getPlaylistByMode(mode) {
  const m = normalizeMusicMode(mode)
  const map = {}
  map[MUSIC_MODE_VIP] = VIP_PLAYLIST
  map[MUSIC_MODE_FLAC] = FLAC_PLAYLIST
  map[MUSIC_MODE_QS] = QS_PLAYLIST
  map[MUSIC_MODE_BY] = BY_PLAYLIST
  map[MUSIC_MODE_ZJL] = ZJL_PLAYLIST
  map[MUSIC_MODE_XS] = XUSONG_PLAYLIST
  map[MUSIC_MODE_ZM] = ZM_PLAYLIST
  map[MUSIC_MODE_DY] = DY_PLAYLIST
  map[MUSIC_MODE_ALIN] = ALIN_PLAYLIST
  map[MUSIC_MODE_GT] = GT_PLAYLIST
  map[MUSIC_MODE_BLIND] = BLIND_PLAYLIST
  const list = map[m] || FLAC_PLAYLIST
  return withMusicPrefs(list, m)
}

/** 拉取云端偏好（启动时调用） */
export async function syncMusicPrefs() {
  await ensureMusicPrefs()
}

/** 是否已置顶 */
export function isMusicPinned(mode, fileID) {
  if (!fileID) return false
  return loadPinnedFileIds(mode).indexOf(fileID) >= 0
}

/** 置顶到第一位（再次点击仍移到第一位，不取消） */
export async function togglePinMusic(mode, fileID) {
  if (!fileID) return false
  await ensureMusicPrefs()
  const prefs = getMusicPrefsState()
  if (!prefs.pinned) prefs.pinned = {}
  const key = mode || MUSIC_MODE_FLAC
  const list = (prefs.pinned[key] || []).slice()
  const at = list.indexOf(fileID)
  if (at >= 0) list.splice(at, 1)
  list.unshift(fileID)
  prefs.pinned[key] = list
  await saveMusicPrefs()
  return true
}

function clearPinnedFileId(fileID) {
  if (!fileID) return false
  const prefs = getMusicPrefsState()
  if (!prefs.pinned) return false
  let changed = false
  const modes = Object.keys(prefs.pinned)
  for (let i = 0; i < modes.length; i++) {
    const list = prefs.pinned[modes[i]]
    if (!list || !list.length) continue
    const at = list.indexOf(fileID)
    if (at < 0) continue
    list.splice(at, 1)
    changed = true
  }
  return changed
}

/** 从列表隐藏（先写本地，再由 deleteMusicFile 同步云库 removed） */
export function markMusicRemoved(fileID) {
  if (!fileID) return
  const prefs = ensureLocalMusicPrefs()
  if (!prefs.removed) prefs.removed = []
  if (prefs.removed.indexOf(fileID) < 0) {
    prefs.removed.push(fileID)
  }
  clearPinnedFileId(fileID)
  saveRemovedLocalOnly()
}

/** 同步 removed/pinned 到云库，并删除云存储 mp3 */
export async function deleteMusicFile(fileID) {
  if (!fileID) return

  try {
    await ensureMusicPrefs()
    await saveMusicPrefs()
  } catch (e) {
    console.warn('[playlist] 删除记录同步云库失败', e)
  }

  if (!wx.cloud) return

  try {
    const res = await wx.cloud.callFunction({
      name: 'getMusicUrl',
      data: { fileID, action: 'delete' },
    })
    const body = res.result || {}
    if (!body.ok) {
      console.warn('[playlist] 删除文件失败', body.errMsg)
    }
  } catch (e) {
    console.warn('[playlist] 删除文件异常', e)
  }
}

const memCache = {}
const inflight = {}

/** 微信用户文件目录约 200MB，顶满再 LRU */
const MUSIC_CACHE_MAX_BYTES = 200 * 1024 * 1024
const MUSIC_CACHE_TARGET_RATIO = 0.9
const MUSIC_CACHE_META_KEY = 'music_cache_meta_v1'
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000

let downloadTask = null
let progressListener = null
let lastDlPercent = 0

function emitDlProgress(percent) {
  const n = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)))
  lastDlPercent = n
  if (progressListener) progressListener(n)
}

function attachDownloadProgress(fn) {
  progressListener = fn || null
  if (progressListener) progressListener(lastDlPercent)
}

function getUserDataRoot() {
  return (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) || ''
}

function getAudioExt(fileID) {
  const s = String(fileID || '').toLowerCase()
  if (s.slice(-5) === '.flac') return '.flac'
  if (s.slice(-4) === '.wav') return '.wav'
  if (s.slice(-4) === '.m4a') return '.m4a'
  return '.mp3'
}

/** ASCII 短 hash，避免 DevTools __usr__ 代理中文路径 500 */
function hashKey(s) {
  const str = String(s || '')
  let h1 = 5381
  let h2 = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = (h1 * 33 + c) >>> 0
    h2 = (h2 * 65599 + c) >>> 0
  }
  return h1.toString(16) + h2.toString(16).slice(0, 4)
}

const MIN_AUDIO_BYTES = 8 * 1024

function getPersistPath(trackId, fileID) {
  const root = getUserDataRoot()
  if (!root || !trackId) return ''
  return root + '/music_' + hashKey(trackId) + getAudioExt(fileID)
}

function getLegacyPersistPath(trackId, fileID) {
  const root = getUserDataRoot()
  if (!root || !trackId) return ''
  return root + '/music_' + trackId + getAudioExt(fileID)
}

function cacheKeyFromName(name) {
  const rest = String(name || '').slice(6)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0) return rest
  return rest.slice(0, dot)
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

function localFileSize(path) {
  if (!path) return 0
  try {
    const info = uni.getFileSystemManager().statSync(path)
    return (info && info.size) || 0
  } catch (e) {
    return 0
  }
}

function isHttpUrl(src) {
  return src && (src.indexOf('http://') === 0 || src.indexOf('https://') === 0)
}

function unlinkQuiet(path) {
  if (!path) return
  try {
    uni.getFileSystemManager().unlinkSync(path)
  } catch (e) {
    // ignore
  }
}

/** 清除某曲的可播地址内存缓存（临时链失效时重拉） */
export function clearPlaySourceCache(trackId) {
  if (!trackId) return
  delete memCache[trackId]
  inflight[trackId] = null
}

/** 内存告警：清播放地址缓存，保留指定曲目 */
export function trimPlaySourceMemory(keepIds) {
  const keep = {}
  const ids = keepIds || []
  for (let i = 0; i < ids.length; i++) keep[ids[i]] = true
  const keys = Object.keys(memCache)
  for (let i = 0; i < keys.length; i++) {
    if (!keep[keys[i]]) delete memCache[keys[i]]
  }
}

/** 删除本地落盘（含旧中文路径）并清内存缓存，供播放失败重试 */
export function invalidateLocalMusic(trackId, fileID) {
  if (!trackId) return
  clearPlaySourceCache(trackId)
  unlinkQuiet(getPersistPath(trackId, fileID))
  unlinkQuiet(getLegacyPersistPath(trackId, fileID))
  const meta = readCacheMeta()
  if (meta[trackId] != null) {
    delete meta[trackId]
    writeCacheMeta(meta)
  }
}

export function abortMusicDownload() {
  if (!downloadTask) return
  try {
    downloadTask.abort()
  } catch (e) {
    // ignore
  }
  downloadTask = null
  lastDlPercent = 0
}

/** 一键清：删 USER_DATA 下 music_*、meta 与内存缓存 */
export function clearAllMusicDiskCache() {
  abortMusicDownload()
  const files = listMusicCacheFiles()
  for (let i = 0; i < files.length; i++) {
    unlinkQuiet(files[i].path)
  }
  const memKeys = Object.keys(memCache)
  for (let i = 0; i < memKeys.length; i++) delete memCache[memKeys[i]]
  const inflightKeys = Object.keys(inflight)
  for (let i = 0; i < inflightKeys.length; i++) inflight[inflightKeys[i]] = null
  writeCacheMeta({})
  try {
    uni.removeStorageSync(MUSIC_CACHE_META_KEY)
  } catch (e) {
    // ignore
  }
}

export function isPlaySourceInflight(trackId) {
  return !!(trackId && inflight[trackId])
}

function readCacheMeta() {
  try {
    const raw = uni.getStorageSync(MUSIC_CACHE_META_KEY)
    if (raw && typeof raw === 'object') return raw
  } catch (e) {
    // ignore
  }
  return {}
}

function writeCacheMeta(meta) {
  try {
    uni.setStorageSync(MUSIC_CACHE_META_KEY, meta || {})
  } catch (e) {
    // ignore
  }
}

function touchCacheMeta(trackId) {
  if (!trackId) return
  const meta = readCacheMeta()
  meta[trackId] = { t: Date.now(), k: hashKey(trackId) }
  writeCacheMeta(meta)
}

function metaAtime(meta, cacheKey) {
  if (!cacheKey) return 0
  const direct = meta[cacheKey]
  if (typeof direct === 'number') return direct
  if (direct && direct.t) return direct.t
  const keys = Object.keys(meta)
  for (let i = 0; i < keys.length; i++) {
    const id = keys[i]
    const v = meta[id]
    if (v && v.k === cacheKey) return v.t || 0
    if (hashKey(id) === cacheKey) {
      if (typeof v === 'number') return v
      if (v && v.t) return v.t
    }
  }
  return 0
}

function listMusicCacheFiles() {
  const root = getUserDataRoot()
  if (!root) return []
  const fs = uni.getFileSystemManager()
  let names = []
  try {
    names = fs.readdirSync(root) || []
  } catch (e) {
    return []
  }
  const out = []
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (!name || name.indexOf('music_') !== 0) continue
    const cacheKey = cacheKeyFromName(name)
    if (!cacheKey) continue
    const path = root + '/' + name
    let size = 0
    try {
      const info = fs.statSync(path)
      size = (info && info.size) || 0
    } catch (e) {
      continue
    }
    out.push({ cacheKey, path, size })
  }
  return out
}

function findCachedPath(trackId, fileID) {
  const preferred = getPersistPath(trackId, fileID)
  if (preferred && hasLocalFile(preferred) && localFileSize(preferred) >= MIN_AUDIO_BYTES) {
    return preferred
  }
  // 旧中文路径在 DevTools __usr__ 下易 500，不再命中；失败重试时会删掉
  return ''
}

function unlinkCacheFile(path, cacheKey) {
  unlinkQuiet(path)
  const meta = readCacheMeta()
  const keys = Object.keys(meta)
  for (let i = 0; i < keys.length; i++) {
    const id = keys[i]
    const v = meta[id]
    if (id === cacheKey || (v && v.k === cacheKey) || hashKey(id) === cacheKey) {
      delete meta[id]
      if (memCache[id]) delete memCache[id]
    }
  }
  writeCacheMeta(meta)
}

/** 超 200MB 时按 LRU 删最久未访问的本地曲（保护当前/下一首） */
function enforceMusicCacheLimit(protectIds) {
  const files = listMusicCacheFiles()
  if (!files.length) return

  let total = 0
  for (let i = 0; i < files.length; i++) total += files[i].size || 0
  if (total <= MUSIC_CACHE_MAX_BYTES) return

  const meta = readCacheMeta()
  const protect = {}
  const ids = protectIds || []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (!id) continue
    protect[id] = true
    protect[hashKey(id)] = true
  }

  files.sort((a, b) => metaAtime(meta, a.cacheKey) - metaAtime(meta, b.cacheKey))

  const target = MUSIC_CACHE_MAX_BYTES * MUSIC_CACHE_TARGET_RATIO
  for (let i = 0; i < files.length; i++) {
    if (total <= target) break
    const item = files[i]
    if (protect[item.cacheKey]) continue
    unlinkCacheFile(item.path, item.cacheKey)
    total -= item.size || 0
  }
}

function saveTempToPersist(tempPath, persistPath, protectIds) {
  return new Promise((resolve, reject) => {
    if (!tempPath || !persistPath) {
      resolve(tempPath || '')
      return
    }
    const fs = uni.getFileSystemManager()
    const trySave = (retried) => {
      fs.saveFile({
        tempFilePath: tempPath,
        filePath: persistPath,
        success: () => {
          if (tempPath !== persistPath) unlinkQuiet(tempPath)
          const size = localFileSize(persistPath)
          if (size < MIN_AUDIO_BYTES) {
            unlinkQuiet(persistPath)
            reject(new Error('音频文件过小'))
            return
          }
          resolve(persistPath)
        },
        fail: () => {
          if (!retried) {
            enforceMusicCacheLimit(protectIds)
            trySave(true)
            return
          }
          const size = localFileSize(tempPath)
          if (size < MIN_AUDIO_BYTES) {
            unlinkQuiet(tempPath)
            reject(new Error('音频文件过小'))
            return
          }
          resolve(tempPath)
        },
      })
    }
    try {
      trySave(false)
    } catch (e) {
      resolve(tempPath)
    }
  })
}

function downloadToPersist(url, persistPath, protectIds) {
  return new Promise((resolve, reject) => {
    abortMusicDownload()
    lastDlPercent = 0
    const task = uni.downloadFile({
      url,
      timeout: DOWNLOAD_TIMEOUT_MS,
      success: (res) => {
        if (downloadTask === task) downloadTask = null
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载音频失败 ' + (res.statusCode || '')))
          return
        }
        const tempPath = res.tempFilePath
        if (!persistPath) {
          resolve(tempPath)
          return
        }
        saveTempToPersist(tempPath, persistPath, protectIds).then(resolve).catch(reject)
      },
      fail: (err) => {
        if (downloadTask === task) downloadTask = null
        const msg = (err && err.errMsg) || '下载音频失败'
        if (String(msg).indexOf('abort') >= 0) {
          reject(new Error('abort'))
          return
        }
        if (String(msg).indexOf('url not in domain list') >= 0) {
          reject(new Error('需配置downloadFile域名'))
          return
        }
        reject(new Error(msg))
      },
    })
    downloadTask = task

    if (task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate((p) => {
        if (downloadTask !== task) return
        emitDlProgress(p && p.progress != null ? p.progress : 0)
      })
    }
  })
}

/** 是否当前为 Wi‑Fi（失败时按非 Wi‑Fi，避免误整首下载） */
export function isWifiNetwork() {
  return new Promise((resolve) => {
    try {
      uni.getNetworkType({
        success: (res) => resolve(res.networkType === 'wifi'),
        fail: () => resolve(false),
      })
    } catch (e) {
      resolve(false)
    }
  })
}

/** 云函数换临时 HTTPS */
export async function getPlayUrl(fileID) {
  if (!fileID) return ''
  if (!wx.cloud) throw new Error('云能力不可用')

  const res = await wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: { fileID },
  })
  const body = res.result || {}
  if (!body.ok || !body.tempFileURL) {
    throw new Error(body.errMsg || '获取播放地址失败')
  }
  return body.tempFileURL
}

/**
 * 解析可播路径：命中本地秒开，否则整首下载并落盘。
 * @param {object} track
 * @param {{ protectIds?: string[], onProgress?: function }} [options]
 */
export async function resolvePlaySource(track, options) {
  if (!track) return ''
  if (track.src) {
    memCache[track.id] = track.src
    return track.src
  }
  if (!track.fileID) return ''

  const hit = findCachedPath(track.id, track.fileID)
  if (hit) {
    touchCacheMeta(track.id)
    memCache[track.id] = hit
    return hit
  }

  const cached = memCache[track.id]
  if (cached) {
    if (isHttpUrl(cached)) {
      delete memCache[track.id]
    } else if (hasLocalFile(cached)) {
      touchCacheMeta(track.id)
      return cached
    } else {
      delete memCache[track.id]
    }
  }

  if (options && options.onProgress) attachDownloadProgress(options.onProgress)
  else if (!inflight[track.id]) attachDownloadProgress(null)

  if (inflight[track.id]) return inflight[track.id]

  const protectIds = (options && options.protectIds) || []
  const persistPath = getPersistPath(track.id, track.fileID)
  const protect = protectIds.concat(track.id ? [track.id] : [])

  inflight[track.id] = (async () => {
    const url = await getPlayUrl(track.fileID)
    const path = await downloadToPersist(url, persistPath, protect)
    memCache[track.id] = path
    if (path === persistPath) {
      touchCacheMeta(track.id)
      enforceMusicCacheLimit(protect)
    }
    return path
  })()

  try {
    return await inflight[track.id]
  } finally {
    inflight[track.id] = null
  }
}

/** 启动预热：仅 Wi‑Fi 整首落盘；蜂窝跳过，点播时再下 */
export async function warmMusicCache(track) {
  if (!track) return ''
  const wifi = await isWifiNetwork()
  if (!wifi) return ''
  return resolvePlaySource(track, { protectIds: track.id ? [track.id] : [] })
}
