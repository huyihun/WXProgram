/**
 * 唯一播放器：BackgroundAudioManager
 * - 原生母带（super_player）：仅 Wi‑Fi，长超时 download → temp → BAM
 * - 其它无损（flac/qs/by）：同样下载再播，不强制 Wi‑Fi
 * - VIP专属（vip）：resolvePlaySource（本地缓存 / 蜂窝 temp）
 * - 当前曲 onPlay 后静默预热下一首；切到预热中的曲复用下载不重来
 * - 切歌 abort 旧下载 + playGeneration 防竞态
 * - 置顶/删除/默认歌单走 music_prefs
 */
import {
  getPlayUrl,
  isWifiNetwork,
  withMusicPrefs,
  togglePinMusic,
  isMusicPinned,
  markMusicRemoved,
  deleteMusicFile,
  resolvePlaySource,
  clearPlaySourceCache,
  syncMusicPrefs,
  VIP_PLAYLIST,
} from '@/utils/playlist'
import { SUPER_PLAYER_PLAYLIST } from '@/utils/superPlayerPlaylist'
import { FLAC_PLAYLIST } from '@/utils/flacPlaylist'
import { QS_PLAYLIST } from '@/utils/qsPlaylist'
import { BY_PLAYLIST } from '@/utils/byPlaylist'
import { getDefaultMusicMode, setDefaultMusicMode as saveDefaultMusicMode } from '@/api/musicPrefs'
import {
  MUSIC_MODE_SUPER_PLAYER,
  MUSIC_MODE_VIP,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  normalizeMusicMode,
  isMasterMusicMode,
  isWifiOnlyMusicMode,
  getModeMeta,
} from '@/utils/musicModes'

export {
  MUSIC_MODE_SUPER_PLAYER,
  MUSIC_MODE_VIP,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  normalizeMusicMode,
  isMasterMusicMode,
  isWifiOnlyMusicMode,
  getModeMeta,
  getPlaylistOptions,
} from '@/utils/musicModes'

/** 母带很大，单次下载给足时间（毫秒） */
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000

const RAW_BY_MODE = {}
RAW_BY_MODE[MUSIC_MODE_SUPER_PLAYER] = SUPER_PLAYER_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_VIP] = VIP_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_FLAC] = FLAC_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_QS] = QS_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_BY] = BY_PLAYLIST

let mode = MUSIC_MODE_SUPER_PLAYER
let index = 0
let playing = false
let loading = false
let ready = false
let bound = false
let wantPlay = false
/** 0–100；非下载中为 0（仅母带） */
let downloadProgress = 0
let lastProgressEmitAt = 0
let lastProgressEmitVal = -1
let playGeneration = 0
let downloadTask = null
const srcMem = {}
const listeners = []
const inflight = {}

function isMasterMode() {
  return isMasterMusicMode(mode)
}

function isWifiOnlyMode() {
  return isWifiOnlyMusicMode(mode)
}

function setDownloadProgress(percent) {
  const next = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)))
  downloadProgress = next
  loading = true
  const now = Date.now()
  if (next < 100 && next === lastProgressEmitVal && now - lastProgressEmitAt < 160) return
  if (next < 100 && next - lastProgressEmitVal < 1 && now - lastProgressEmitAt < 120) return
  lastProgressEmitVal = next
  lastProgressEmitAt = now
  emit()
}

function clearDownloadProgress() {
  downloadProgress = 0
  lastProgressEmitVal = -1
}

function hasLocalFile(path) {
  if (!path) return false
  if (String(path).indexOf('http') === 0) return false
  try {
    uni.getFileSystemManager().accessSync(path)
    return true
  } catch (e) {
    return false
  }
}

function friendlyDownloadError(errMsg) {
  const msg = String(errMsg || '')
  if (msg.indexOf('abort') >= 0) return ''
  if (msg.indexOf('internal server') >= 0) {
    return '云下载失败，请重试'
  }
  if (msg.indexOf('exceed max file size') >= 0 || msg.indexOf('maximum size') >= 0) {
    return '文件过大（需<200MB）'
  }
  if (msg.indexOf('timeout') >= 0) {
    return '下载超时，请检查网络'
  }
  if (msg.indexOf('url not in domain list') >= 0) {
    return '需配置downloadFile域名'
  }
  return msg.slice(0, 20) || '下载失败'
}

function abortDownload() {
  if (!downloadTask) return
  try {
    downloadTask.abort()
  } catch (e) {
    // ignore
  }
  downloadTask = null
}

function bumpGeneration() {
  playGeneration += 1
  abortDownload()
  return playGeneration
}

function isStale(gen) {
  return gen !== playGeneration
}

function downloadHttpsToTemp(url, onProgress) {
  return new Promise((resolve, reject) => {
    abortDownload()
    const task = uni.downloadFile({
      url,
      timeout: DOWNLOAD_TIMEOUT_MS,
      success: (res) => {
        if (downloadTask === task) downloadTask = null
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载失败 ' + (res.statusCode || '')))
          return
        }
        resolve(res.tempFilePath)
      },
      fail: (err) => {
        if (downloadTask === task) downloadTask = null
        const raw = (err && err.errMsg) || ''
        if (String(raw).indexOf('abort') >= 0) {
          reject(new Error('abort'))
          return
        }
        reject(new Error(friendlyDownloadError(raw)))
      },
    })
    downloadTask = task

    if (task && typeof task.onProgressUpdate === 'function' && onProgress) {
      task.onProgressUpdate((p) => {
        if (downloadTask !== task) return
        onProgress(p && p.progress != null ? p.progress : 0)
      })
    }
  })
}

async function resolveMasterSource(track, gen, silent) {
  if (!track || !track.fileID) return ''

  if (srcMem[track.id] && hasLocalFile(srcMem[track.id])) {
    return srcMem[track.id]
  }

  if (inflight[track.id]) {
    const path = await inflight[track.id]
    if (isStale(gen)) throw new Error('abort')
    return path
  }

  inflight[track.id] = (async () => {
    if (isWifiOnlyMode()) {
      const wifi = await isWifiNetwork()
      if (!wifi) throw new Error('请连接 Wi‑Fi 后播放')
      if (isStale(gen)) throw new Error('abort')
    }

    const url = await getPlayUrl(track.fileID)
    if (!url) throw new Error('获取播放地址失败')
    if (isStale(gen)) throw new Error('abort')

    if (!silent) setDownloadProgress(0)
    const path = await downloadHttpsToTemp(url, silent
      ? null
      : (percent) => {
          if (isStale(gen)) return
          setDownloadProgress(percent)
        })
    if (isStale(gen)) throw new Error('abort')

    if (!silent) setDownloadProgress(100)
    srcMem[track.id] = path
    return path
  })()

  try {
    return await inflight[track.id]
  } finally {
    inflight[track.id] = null
  }
}

async function resolveVipSource(track) {
  if (!track || !track.fileID) return ''
  if (srcMem[track.id] && hasLocalFile(srcMem[track.id])) {
    return srcMem[track.id]
  }
  const list = activeList()
  const next = list.length > 1 ? list[(index + 1) % list.length] : null
  const protectIds = [track.id]
  if (next && next.id) protectIds.push(next.id)
  const src = await resolvePlaySource(track, { protectIds: protectIds })
  srcMem[track.id] = src
  return src
}

/** 当前曲开始播放后，静默预热下一首（不打断进度条 UI） */
function prefetchNextTrack() {
  const list = activeList()
  if (list.length < 2) return
  const next = list[(index + 1) % list.length]
  if (!next || !next.fileID) return
  if (srcMem[next.id] && hasLocalFile(srcMem[next.id])) return
  if (inflight[next.id]) return

  const run = async () => {
    if (isWifiOnlyMode()) {
      const wifi = await isWifiNetwork()
      if (!wifi) return
    }
    const gen = playGeneration
    try {
      if (isMasterMode()) {
        await resolveMasterSource(next, gen, true)
      } else {
        await resolveVipSource(next)
      }
    } catch (e) {
      // 切歌 abort / 网络失败：忽略
    }
  }
  run()
}

function rawList() {
  return RAW_BY_MODE[mode] || SUPER_PLAYER_PLAYLIST
}

function activeList() {
  return withMusicPrefs(rawList(), mode)
}

function currentTrack() {
  const list = activeList()
  return list[index] || null
}

function emptyTrack() {
  return { id: '', title: '', artist: '', fileID: '' }
}

function emit() {
  const track = currentTrack()
  const state = {
    mode,
    index,
    playing,
    loading,
    ready,
    downloadProgress,
    playlist: activeList(),
    track: track || emptyTrack(),
  }
  for (let i = 0; i < listeners.length; i++) {
    listeners[i](state)
  }
}

function getMgr() {
  return uni.getBackgroundAudioManager()
}

function applyMeta(track) {
  const bg = getMgr()
  const meta = getModeMeta(mode)
  bg.title = (track && track.title) || '音乐'
  bg.epname = (meta && meta.label) || '音乐'
  bg.singer = (track && track.artist) || ''
}

function tryPlay() {
  try {
    getMgr().play()
  } catch (e) {
    console.error('播放失败', e)
  }
}

function ensureBound() {
  if (bound) return
  bound = true
  const bg = getMgr()

  bg.onPlay(() => {
    playing = true
    loading = false
    ready = true
    wantPlay = false
    clearDownloadProgress()
    emit()
    prefetchNextTrack()
  })
  bg.onPause(() => {
    playing = false
    emit()
  })
  bg.onStop(() => {
    playing = false
    ready = false
    emit()
  })
  bg.onEnded(() => {
    playing = false
    playNextInnerMusic()
  })
  bg.onWaiting(() => {
    if (playing) {
      loading = true
      emit()
    }
  })
  bg.onCanplay(() => {
    ready = true
    loading = false
    clearDownloadProgress()
    emit()
    if (wantPlay) {
      wantPlay = false
      tryPlay()
    }
  })
  bg.onError((err) => {
    console.error('播放失败', err)
    wantPlay = false
    playing = false
    loading = false
    ready = false
    clearDownloadProgress()
    emit()
    const raw = (err && (err.errMsg || err.errCode)) || '播放失败'
    const tip = friendlyDownloadError(raw)
    if (tip) uni.showToast({ title: tip, icon: 'none' })
  })
}

async function loadAndPlay(autoPlay) {
  ensureBound()
  const track = currentTrack()
  if (!track || !track.fileID) return

  // 若下一首正在预热，复用同一下载，避免切歌时 abort 重下
  let gen
  if (inflight[track.id]) {
    gen = playGeneration
  } else {
    gen = bumpGeneration()
  }

  if (isWifiOnlyMode()) {
    const wifi = await isWifiNetwork()
    if (!wifi) {
      if (isStale(gen)) return
      uni.showToast({ title: '请连接 Wi‑Fi 后播放', icon: 'none' })
      wantPlay = false
      loading = false
      emit()
      return
    }
  }

  wantPlay = !!autoPlay
  loading = true
  ready = false
  clearDownloadProgress()
  emit()

  try {
    let src = ''
    if (isMasterMode()) {
      src = await resolveMasterSource(track, gen, false)
    } else {
      src = await resolveVipSource(track)
    }
    if (isStale(gen)) return

    applyMeta(track)
    const bg = getMgr()
    bg.src = src
    if (autoPlay) tryPlay()
  } catch (err) {
    if (isStale(gen) || (err && err.message === 'abort')) return
    console.error('加载失败', err)
    wantPlay = false
    loading = false
    clearDownloadProgress()
    emit()
    const msg = (err && err.message) || '加载失败'
    const tip = friendlyDownloadError(msg) || String(msg).slice(0, 20)
    if (tip) uni.showToast({ title: tip, icon: 'none' })
  }
}

export function subscribeInnerMusic(fn) {
  ensureBound()
  listeners.push(fn)
  fn({
    mode,
    index,
    playing,
    loading,
    ready,
    downloadProgress,
    playlist: activeList(),
    track: currentTrack() || emptyTrack(),
  })
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export async function prefetchInnerMusic() {
  ensureBound()
  if (isMasterMode()) {
    ready = false
    loading = false
    emit()
    return
  }
  const track = currentTrack()
  if (!track || !track.fileID) {
    ready = false
    loading = false
    emit()
    return
  }
  loading = true
  emit()
  try {
    await resolveVipSource(track)
    ready = true
    loading = false
    emit()
  } catch (err) {
    console.error('预加载失败', err)
    loading = false
    emit()
  }
}

export function toggleInnerMusic() {
  ensureBound()
  const track = currentTrack()
  if (!track || !track.fileID) return
  const bg = getMgr()

  if (playing) {
    wantPlay = false
    try {
      bg.pause()
    } catch (e) {
      // ignore
    }
    return
  }

  const cached = srcMem[track.id]
  if (cached && hasLocalFile(cached)) {
    wantPlay = true
    loading = true
    emit()
    applyMeta(track)
    bg.src = cached
    tryPlay()
    return
  }

  loadAndPlay(true)
}

export async function playPrevInnerMusic() {
  const list = activeList()
  if (!list.length) return
  index = (index - 1 + list.length) % list.length
  ready = false
  emit()
  await loadAndPlay(true)
}

export async function playNextInnerMusic() {
  const list = activeList()
  if (!list.length) return
  index = (index + 1) % list.length
  ready = false
  emit()
  await loadAndPlay(true)
}

export async function playInnerTrackAt(i) {
  const list = activeList()
  if (!list.length) return
  let next = Number(i)
  if (!isFinite(next) || next < 0) next = 0
  if (next >= list.length) next = list.length - 1
  index = next
  ready = false
  emit()
  await loadAndPlay(true)
}

export async function switchMusicMode(nextMode) {
  ensureBound()
  const normalized = normalizeMusicMode(nextMode)
  if (normalized === mode) {
    emit()
    return mode
  }

  bumpGeneration()
  wantPlay = false
  playing = false
  loading = false
  ready = false
  clearDownloadProgress()
  try {
    getMgr().stop()
  } catch (e) {
    // ignore
  }

  mode = normalized
  index = 0
  emit()
  await prefetchInnerMusic()
  return mode
}

export async function loadMusicPrefsAndRefresh() {
  await syncMusicPrefs()
  emit()
}

export function getPreferredMusicMode() {
  return normalizeMusicMode(getDefaultMusicMode())
}

export async function setPreferredMusicMode(nextMode) {
  const saved = await saveDefaultMusicMode(normalizeMusicMode(nextMode))
  return normalizeMusicMode(saved)
}

export async function pinInnerTrackAt(i) {
  const list = activeList()
  if (!list.length) return false
  let at = Number(i)
  if (!isFinite(at) || at < 0 || at >= list.length) return false

  const track = list[at]
  if (!track || !track.fileID) return false

  const currentId = list[index] && list[index].id
  const pinned = await togglePinMusic(mode, track.fileID)

  const nextList = activeList()
  if (currentId) {
    for (let j = 0; j < nextList.length; j++) {
      if (nextList[j].id === currentId) {
        index = j
        break
      }
    }
  }
  emit()
  return pinned
}

export function isInnerTrackPinned(fileID) {
  return isMusicPinned(mode, fileID)
}

export async function removeInnerTrackAt(i) {
  ensureBound()
  const list = activeList()
  if (!list.length) return
  let at = Number(i)
  if (!isFinite(at) || at < 0 || at >= list.length) return

  const track = list[at]
  if (!track || !track.fileID) return

  const wasCurrent = at === index
  const wasPlaying = playing && wasCurrent

  markMusicRemoved(track.fileID)
  delete srcMem[track.id]
  clearPlaySourceCache(track.id)

  const nextList = activeList()
  if (!nextList.length) {
    bumpGeneration()
    index = 0
    playing = false
    ready = false
    loading = false
    wantPlay = false
    try {
      getMgr().stop()
    } catch (e) {
      // ignore
    }
    emit()
  } else if (wasCurrent) {
    if (at >= nextList.length) index = 0
    else index = at
    ready = false
    emit()
  } else {
    if (at < index) index = index - 1
    emit()
  }

  await deleteMusicFile(track.fileID)

  if (wasCurrent && wasPlaying && activeList().length) {
    await loadAndPlay(true)
  } else if (wasCurrent && activeList().length) {
    emit()
  }
}
