/**
 * 音乐歌单与取源（微信云存储 fileID）
 *
 * VIP：Wi‑Fi 整首落 USER_DATA 持久缓存（上限 300MB，LRU）；蜂窝下临时文件再播
 * 原生母带歌单见 superPlayerPlaylist.js，由 innerMusic 单独下载
 */

import {
  getMusicPrefsState,
  ensureMusicPrefs,
  ensureLocalMusicPrefs,
  saveMusicPrefs,
  saveRemovedLocalOnly,
} from '@/api/musicPrefs'

import { SUPER_PLAYER_PLAYLIST } from '@/utils/superPlayerPlaylist'
import { FLAC_PLAYLIST } from '@/utils/flacPlaylist'
import { QS_PLAYLIST } from '@/utils/qsPlaylist'
import { BY_PLAYLIST } from '@/utils/byPlaylist'
import {
  MUSIC_MODE_VIP,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  MUSIC_MODE_SUPER_PLAYER,
  normalizeMusicMode,
} from '@/utils/musicModes'

export {
  MUSIC_MODE_VIP,
  MUSIC_MODE_SUPER_PLAYER,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
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
  const list = prefs.pinned && prefs.pinned[mode || 'super_player']
  return list && list.length ? list : []
}

function filterRemoved(list) {
  const prefs = getMusicPrefsState()
  const removedList = prefs.removed || []
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

/** 应用已删过滤 + 置顶排序（超级播放器歌单也可复用） */
export function withMusicPrefs(list, mode) {
  return applyPinnedOrder(filterRemoved(list), mode)
}

export function getPlaylistByMode(mode) {
  const m = normalizeMusicMode(mode)
  const map = {}
  map[MUSIC_MODE_VIP] = VIP_PLAYLIST
  map[MUSIC_MODE_FLAC] = FLAC_PLAYLIST
  map[MUSIC_MODE_QS] = QS_PLAYLIST
  map[MUSIC_MODE_BY] = BY_PLAYLIST
  map[MUSIC_MODE_SUPER_PLAYER] = SUPER_PLAYER_PLAYLIST
  const list = map[m] || SUPER_PLAYER_PLAYLIST
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
  const key = mode || MUSIC_MODE_SUPER_PLAYER
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

const MUSIC_CACHE_MAX_BYTES = 300 * 1024 * 1024
const MUSIC_CACHE_TARGET_RATIO = 0.9
const MUSIC_CACHE_META_KEY = 'music_cache_meta_v1'

function getUserDataRoot() {
  return (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) || ''
}

function getPersistPath(trackId) {
  const root = getUserDataRoot()
  if (!root || !trackId) return ''
  return root + '/music_' + trackId + '.mp3'
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

function isHttpUrl(src) {
  return src && (src.indexOf('http://') === 0 || src.indexOf('https://') === 0)
}

/** 清除某曲的可播地址内存缓存（临时链失效时重拉） */
export function clearPlaySourceCache(trackId) {
  if (!trackId) return
  delete memCache[trackId]
  inflight[trackId] = null
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
  meta[trackId] = Date.now()
  writeCacheMeta(meta)
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
    if (name.slice(-4) !== '.mp3') continue
    const trackId = name.slice(6, -4)
    const path = root + '/' + name
    let size = 0
    try {
      const info = fs.statSync(path)
      size = (info && info.size) || 0
    } catch (e) {
      continue
    }
    out.push({ trackId, path, size })
  }
  return out
}

function unlinkCacheFile(path, trackId) {
  try {
    uni.getFileSystemManager().unlinkSync(path)
  } catch (e) {
    // ignore
  }
  if (trackId && memCache[trackId] === path) {
    delete memCache[trackId]
  }
}

/** 超 300MB 时按 LRU 删最久未访问的本地曲（保护当前/下一首） */
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
    if (ids[i]) protect[ids[i]] = true
  }

  files.sort((a, b) => {
    const ta = meta[a.trackId] || 0
    const tb = meta[b.trackId] || 0
    return ta - tb
  })

  const target = MUSIC_CACHE_MAX_BYTES * MUSIC_CACHE_TARGET_RATIO
  for (let i = 0; i < files.length; i++) {
    if (total <= target) break
    const item = files[i]
    if (protect[item.trackId]) continue
    unlinkCacheFile(item.path, item.trackId)
    total -= item.size || 0
    if (meta[item.trackId]) delete meta[item.trackId]
  }
  writeCacheMeta(meta)
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

function downloadToPath(url, filePath) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载音频失败 ' + (res.statusCode || '')))
          return
        }
        if (!filePath) {
          resolve(res.tempFilePath)
          return
        }
        try {
          uni.getFileSystemManager().saveFile({
            tempFilePath: res.tempFilePath,
            filePath,
            success: () => resolve(filePath),
            fail: () => resolve(res.tempFilePath),
          })
        } catch (e) {
          resolve(res.tempFilePath)
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '下载音频失败'
        if (String(msg).indexOf('url not in domain list') >= 0) {
          reject(new Error('需配置downloadFile域名'))
          return
        }
        reject(new Error(msg))
      },
    })
  })
}

/**
 * 解析可播路径
 * @param {object} track
 * @param {{ protectIds?: string[] }} [options] 落盘后 LRU 时保护的 trackId
 */
export async function resolvePlaySource(track, options) {
  if (!track) return ''
  if (track.src) {
    memCache[track.id] = track.src
    return track.src
  }
  if (!track.fileID) return ''

  const persistPath = getPersistPath(track.id)
  if (hasLocalFile(persistPath)) {
    touchCacheMeta(track.id)
    memCache[track.id] = persistPath
    return persistPath
  }

  const cached = memCache[track.id]
  if (cached) {
    // 旧版蜂窝流式 HTTPS 不可靠，一律丢弃改走本地下载
    if (isHttpUrl(cached)) {
      delete memCache[track.id]
    } else if (hasLocalFile(cached)) {
      touchCacheMeta(track.id)
      return cached
    } else {
      delete memCache[track.id]
    }
  }

  if (inflight[track.id]) return inflight[track.id]

  const protectIds = (options && options.protectIds) || []

  inflight[track.id] = (async () => {
    const wifi = await isWifiNetwork()
    const url = await getPlayUrl(track.fileID)
    // 蜂窝也下到临时文件再播：BackgroundAudioManager 对云临时 HTTPS 流式常失败
    if (!wifi) {
      const tempPath = await downloadToPath(url, '')
      memCache[track.id] = tempPath
      return tempPath
    }
    const path = await downloadToPath(url, persistPath)
    memCache[track.id] = path
    if (path === persistPath) {
      touchCacheMeta(track.id)
      enforceMusicCacheLimit(protectIds.concat([track.id]))
    }
    return path
  })()

  try {
    return await inflight[track.id]
  } finally {
    inflight[track.id] = null
  }
}

/** 启动预热：仅 Wi‑Fi 整首落盘；蜂窝跳过，点播时再下临时文件 */
export async function warmMusicCache(track) {
  if (!track) return ''
  const wifi = await isWifiNetwork()
  if (!wifi) return ''
  return resolvePlaySource(track, { protectIds: track.id ? [track.id] : [] })
}
