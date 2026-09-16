/**
 * 唯一播放器：BackgroundAudioManager
 * - 无损 / VIP：resolvePlaySource 落盘 USER_DATA（约 200MB LRU），听过秒开
 * - 当前曲 onPlay 后静默预热下一首；切到预热中的曲复用下载不重来
 * - 切歌 abort 旧下载 + playGeneration 防竞态
 * - 置顶/删除/默认歌单走 music_prefs
 */
import {
  isWifiNetwork,
  withMusicPrefs,
  togglePinMusic,
  isMusicPinned,
  markMusicRemoved,
  deleteMusicFile,
  resolvePlaySource,
  clearPlaySourceCache,
  invalidateLocalMusic,
  abortMusicDownload,
  clearAllMusicDiskCache,
  isPlaySourceInflight,
  syncMusicPrefs,
  trimPlaySourceMemory,
  VIP_PLAYLIST,
} from '@/utils/playlist'
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
  getDefaultMusicMode,
  getMusicPrefsState,
  setDefaultMusicMode as saveDefaultMusicMode,
} from '@/api/musicPrefs'
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
  isMasterMusicMode,
  isWifiOnlyMusicMode,
  isBlindMusicMode,
  getModeMeta,
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
  normalizeMusicMode,
  isMasterMusicMode,
  isWifiOnlyMusicMode,
  isBlindMusicMode,
  getModeMeta,
  getPlaylistOptions,
} from '@/utils/musicModes'

/** 0–100；非下载中为 0 */
const RAW_BY_MODE = {}
RAW_BY_MODE[MUSIC_MODE_VIP] = VIP_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_FLAC] = FLAC_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_QS] = QS_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_BY] = BY_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_ZJL] = ZJL_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_XS] = XUSONG_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_ZM] = ZM_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_DY] = DY_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_ALIN] = ALIN_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_GT] = GT_PLAYLIST
RAW_BY_MODE[MUSIC_MODE_BLIND] = BLIND_PLAYLIST

export const PLAY_MODE_SEQ = 'seq'
export const PLAY_MODE_SHUFFLE = 'shuffle'
export const PLAY_MODE_LOOP = 'loop'
const PLAY_MODE_KEY = 'music_play_mode'
const VALID_PLAY_MODES = [PLAY_MODE_SEQ, PLAY_MODE_SHUFFLE, PLAY_MODE_LOOP]

function readPlayMode() {
  try {
    const v = uni.getStorageSync(PLAY_MODE_KEY)
    if (VALID_PLAY_MODES.indexOf(v) >= 0) return v
  } catch (e) {
    // ignore
  }
  return PLAY_MODE_SEQ
}

function writePlayMode(m) {
  try {
    uni.setStorageSync(PLAY_MODE_KEY, m)
  } catch (e) {
    // ignore
  }
}

let mode = MUSIC_MODE_FLAC
let index = 0
let playing = false
let loading = false
let ready = false
let bound = false
let wantPlay = false
let downloadProgress = 0
let lastProgressEmitAt = 0
let lastProgressEmitVal = -1
let playGeneration = 0
let playMode = readPlayMode()
let shuffleOrder = []
let shufflePos = 0
const srcMem = {}
const listeners = []
let playErrorRetryId = ''
let assignedSrc = ''
let memoryWarnBound = false

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
  emit({ includePlaylist: false })
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
  abortMusicDownload()
}

function bumpGeneration() {
  playGeneration += 1
  abortDownload()
  return playGeneration
}

function isStale(gen) {
  return gen !== playGeneration
}

function shuffleArray(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function rebuildShuffle(keepCurrent) {
  const list = activeList()
  const n = list.length
  if (n <= 0) {
    shuffleOrder = []
    shufflePos = 0
    return
  }
  const cur = keepCurrent ? index : 0
  const rest = []
  for (let i = 0; i < n; i++) {
    if (i !== cur) rest.push(i)
  }
  shuffleOrder = [cur].concat(shuffleArray(rest))
  shufflePos = 0
}

/** 盲盒：全量重洗，首曲真正随机（不钉死 index=0） */
function rebuildBlindShuffleFresh() {
  const list = activeList()
  const n = list.length
  if (n <= 0) {
    shuffleOrder = []
    shufflePos = 0
    index = 0
    return
  }
  const order = []
  for (let i = 0; i < n; i++) order.push(i)
  shuffleOrder = shuffleArray(order)
  shufflePos = 0
  index = shuffleOrder[0]
}

function rebuildShuffleAvoidRepeat() {
  const list = activeList()
  const n = list.length
  const prev = index
  const rest = []
  for (let i = 0; i < n; i++) {
    if (i !== prev) rest.push(i)
  }
  const shuffled = shuffleArray(rest)
  shuffleOrder = shuffled.length ? shuffled : [prev]
  shufflePos = 0
}

function peekNextIndex() {
  const list = activeList()
  const n = list.length
  if (n <= 0) return -1
  if (playMode === PLAY_MODE_LOOP) return index
  if (playMode === PLAY_MODE_SHUFFLE) {
    if (!shuffleOrder.length) rebuildShuffle(true)
    if (shuffleOrder.length < 2) return shuffleOrder[0]
    const nextPos = shufflePos + 1
    if (nextPos < shuffleOrder.length) return shuffleOrder[nextPos]
    if (n < 2) return index
    let pick = Math.floor(Math.random() * n)
    if (pick === index) pick = (pick + 1) % n
    return pick
  }
  return (index + 1) % n
}

function peekNextTrack() {
  if (playMode === PLAY_MODE_LOOP) return null
  const list = activeList()
  const i = peekNextIndex()
  if (i < 0) return null
  return list[i] || null
}

function advanceIndex(dir) {
  const list = activeList()
  const n = list.length
  if (!n) return
  if (playMode === PLAY_MODE_SHUFFLE) {
    if (!shuffleOrder.length) rebuildShuffle(true)
    if (dir > 0) {
      shufflePos += 1
      if (shufflePos >= shuffleOrder.length) rebuildShuffleAvoidRepeat()
      index = shuffleOrder[shufflePos]
    } else {
      shufflePos -= 1
      if (shufflePos < 0) shufflePos = shuffleOrder.length - 1
      index = shuffleOrder[shufflePos]
    }
    return
  }
  index = (index + dir + n) % n
}

function protectIdsFor(track) {
  const ids = []
  if (track && track.id) ids.push(track.id)
  const next = peekNextTrack()
  if (next && next.id && next.id !== (track && track.id)) ids.push(next.id)
  return ids
}

async function resolveTrackSource(track, gen, silent) {
  if (!track || !track.fileID) return ''

  if (srcMem[track.id]) {
    if (hasLocalFile(srcMem[track.id])) return srcMem[track.id]
    delete srcMem[track.id]
  }

  if (isWifiOnlyMode()) {
    const wifi = await isWifiNetwork()
    if (!wifi) throw new Error('请连接 Wi‑Fi 后播放')
    if (isStale(gen)) throw new Error('abort')
  }

  if (!silent) setDownloadProgress(0)
  const src = await resolvePlaySource(track, {
    protectIds: protectIdsFor(track),
    onProgress: silent
      ? null
      : (percent) => {
          if (isStale(gen)) return
          setDownloadProgress(percent)
        },
  })
  if (isStale(gen)) throw new Error('abort')
  if (!silent) setDownloadProgress(100)
  srcMem[track.id] = src
  return src
}

/** 当前曲开始播放后，静默预热下一首（不打断进度条 UI） */
function prefetchNextTrack() {
  const next = peekNextTrack()
  if (!next || !next.fileID) return
  if (srcMem[next.id] && hasLocalFile(srcMem[next.id])) return
  if (isPlaySourceInflight(next.id)) return

  const run = async () => {
    if (isWifiOnlyMode()) {
      const wifi = await isWifiNetwork()
      if (!wifi) return
    }
    const gen = playGeneration
    try {
      await resolveTrackSource(next, gen, true)
    } catch (e) {
      // 切歌 abort / 网络失败：忽略
    }
  }
  run()
}

function rawList() {
  return RAW_BY_MODE[mode] || FLAC_PLAYLIST
}

function activeList() {
  return withMusicPrefs(rawList(), mode)
}

let lastPlaylist = null
let lastPlaylistSig = ''

/** 列表签名未变时复用同一引用，避免高频 emit 触发整表 setData 抖动 */
function playlistSig() {
  const prefs = getMusicPrefsState()
  const pinned = (prefs.pinned && prefs.pinned[mode]) || []
  return [
    mode,
    rawList().length,
    (prefs.removed || []).length,
    pinned.join(','),
    (prefs.blindLiked || []).length,
    (prefs.blindDisliked || []).length,
  ].join('|')
}

function currentPlaylist() {
  const sig = playlistSig()
  if (lastPlaylist && sig === lastPlaylistSig) return lastPlaylist
  lastPlaylistSig = sig
  lastPlaylist = activeList()
  return lastPlaylist
}

/** 好听/不好听列表点播时，曲目可能已不在盲盒池内 */
let forceTrack = null

function currentTrack() {
  if (forceTrack) return forceTrack
  const list = activeList()
  return list[index] || null
}

function emptyTrack() {
  return { id: '', title: '', artist: '', fileID: '' }
}

function emit(opts) {
  const track = currentTrack()
  const state = {
    mode,
    index,
    playing,
    loading,
    ready,
    downloadProgress,
    playMode,
    track: track || emptyTrack(),
  }
  // 下载进度等高频路径不带 playlist，避免大歌单反复拷贝触发内存压力
  if (!opts || opts.includePlaylist !== false) {
    state.playlist = currentPlaylist()
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

/** 同曲恢复只 play 不重赋 src，避免原生层重复加载整曲缓冲积攒内存 */
function assignSrc(src, force) {
  const next = src || ''
  if (!force && next && next === assignedSrc) return
  assignedSrc = next
  getMgr().src = next
}

function stopMgr() {
  assignedSrc = ''
  try {
    getMgr().stop()
  } catch (e) {
    // ignore
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
    assignedSrc = ''
    playing = false
    ready = false
    emit()
  })
  bg.onEnded(() => {
    if (playMode === PLAY_MODE_LOOP) {
      // 播完后 seek/play 常无效且不抛错；须重赋 src 才能再播
      const track = currentTrack()
      const cached = track && track.id ? srcMem[track.id] : ''
      if (cached && hasLocalFile(cached)) {
        wantPlay = true
        applyMeta(track)
        assignSrc(cached, true)
        tryPlay()
        return
      }
      loadAndPlay(true)
      return
    }
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
    const track = currentTrack()
    if (track && track.id && playErrorRetryId === track.id) {
      playErrorRetryId = ''
    }
    emit()
    if (wantPlay) {
      wantPlay = false
      tryPlay()
    }
  })
  bg.onError((err) => {
    console.error('播放失败', err)
    const track = currentTrack()
    const tid = track && track.id
    if (tid && playErrorRetryId !== tid) {
      playErrorRetryId = tid
      delete srcMem[tid]
      invalidateLocalMusic(tid, track.fileID)
      assignedSrc = ''
      wantPlay = false
      playing = false
      loading = true
      ready = false
      clearDownloadProgress()
      emit()
      loadAndPlay(true)
      return
    }
    playErrorRetryId = ''
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

  if (!memoryWarnBound) {
    memoryWarnBound = true
    try {
      wx.onMemoryWarning(() => {
        trimInnerMusicMemory()
      })
    } catch (e) {
      // ignore
    }
  }
}

async function loadAndPlay(autoPlay) {
  ensureBound()
  const track = currentTrack()
  if (!track || !track.fileID) return

  // 若下一首正在预热，复用同一下载，避免切歌时 abort 重下
  let gen
  if (isPlaySourceInflight(track.id)) {
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
    const src = await resolveTrackSource(track, gen, false)
    if (isStale(gen)) return

    applyMeta(track)
    assignSrc(src, true)
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
    playMode,
    playlist: currentPlaylist(),
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
    await resolveTrackSource(track, playGeneration, true)
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
    assignSrc(cached)
    tryPlay()
    return
  }

  loadAndPlay(true)
}

export async function playPrevInnerMusic() {
  forceTrack = null
  const list = activeList()
  if (!list.length) return
  advanceIndex(-1)
  ready = false
  emit()
  await loadAndPlay(true)
}

export async function playNextInnerMusic() {
  forceTrack = null
  const list = activeList()
  if (!list.length) return
  advanceIndex(1)
  ready = false
  emit()
  await loadAndPlay(true)
}

export async function playInnerTrackAt(i) {
  forceTrack = null
  const list = activeList()
  if (!list.length) return
  let next = Number(i)
  if (!isFinite(next) || next < 0) next = 0
  if (next >= list.length) next = list.length - 1
  index = next
  if (playMode === PLAY_MODE_SHUFFLE) rebuildShuffle(true)
  ready = false
  emit()
  await loadAndPlay(true)
}

/** 盲盒好听/不好听列表点播（曲目可已移出抽歌池） */
export async function playBlindCatalogTrack(trackId) {
  ensureBound()
  if (!trackId) return
  const raw = RAW_BY_MODE[MUSIC_MODE_BLIND] || []
  let track = null
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] && raw[i].id === trackId) {
      track = raw[i]
      break
    }
  }
  if (!track || !track.fileID) return

  if (!isBlindMusicMode(mode)) {
    bumpGeneration()
    wantPlay = false
    playing = false
    loading = false
    ready = false
    clearDownloadProgress()
    stopMgr()
    mode = MUSIC_MODE_BLIND
    playMode = PLAY_MODE_SHUFFLE
    writePlayMode(playMode)
    rebuildBlindShuffleFresh()
  }

  const list = activeList()
  let at = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === trackId) {
      at = i
      break
    }
  }
  if (at >= 0) {
    forceTrack = null
    await playInnerTrackAt(at)
    return
  }

  forceTrack = track
  ready = false
  emit()
  await loadAndPlay(true)
}

/** 评分后刷新盲盒池；若评的是当前曲则自动切下一首随机 */
export async function refreshAfterBlindRate(ratedId) {
  ensureBound()
  if (!isBlindMusicMode(mode)) {
    emit()
    return
  }
  const cur = currentTrack()
  const wasCurrent = !!(ratedId && cur && cur.id === ratedId)
  forceTrack = null

  if (!wasCurrent && cur && cur.id) {
    const list = activeList()
    let found = -1
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === cur.id) {
        found = i
        break
      }
    }
    if (found >= 0) {
      index = found
      rebuildShuffle(true)
      emit()
      return
    }
  }

  const list = activeList()
  if (!list.length) {
    bumpGeneration()
    playing = false
    ready = false
    loading = false
    wantPlay = false
    stopMgr()
    emit()
    return
  }
  rebuildBlindShuffleFresh()
  ready = false
  emit()
  if (wasCurrent || playing) {
    await loadAndPlay(true)
  } else {
    await prefetchInnerMusic()
  }
}

export function getPlayMode() {
  return playMode
}

export function cyclePlayMode() {
  if (isBlindMusicMode(mode)) {
    if (playMode !== PLAY_MODE_SHUFFLE) {
      playMode = PLAY_MODE_SHUFFLE
      writePlayMode(playMode)
      rebuildShuffle(true)
      emit()
      if (playing) prefetchNextTrack()
    }
    return playMode
  }
  const order = [PLAY_MODE_SEQ, PLAY_MODE_SHUFFLE, PLAY_MODE_LOOP]
  const at = order.indexOf(playMode)
  playMode = order[(at + 1) % order.length]
  writePlayMode(playMode)
  if (playMode === PLAY_MODE_SHUFFLE) rebuildShuffle(true)
  emit()
  if (playing) prefetchNextTrack()
  return playMode
}

export async function switchMusicMode(nextMode) {
  ensureBound()
  const normalized = normalizeMusicMode(nextMode)
  if (normalized === mode) {
    if (isBlindMusicMode(normalized) && playMode !== PLAY_MODE_SHUFFLE) {
      playMode = PLAY_MODE_SHUFFLE
      writePlayMode(playMode)
      rebuildShuffle(true)
      emit()
    } else {
      emit()
    }
    return mode
  }

  bumpGeneration()
  wantPlay = false
  playing = false
  loading = false
  ready = false
  clearDownloadProgress()
  stopMgr()

  mode = normalized
  forceTrack = null
  if (isBlindMusicMode(mode)) {
    playMode = PLAY_MODE_SHUFFLE
    writePlayMode(playMode)
    rebuildBlindShuffleFresh()
  } else {
    index = 0
    if (playMode === PLAY_MODE_SHUFFLE) {
      rebuildShuffle(true)
    }
  }
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
  if (playMode === PLAY_MODE_SHUFFLE) rebuildShuffle(true)
  emit()
  return pinned
}

export function isInnerTrackPinned(fileID) {
  return isMusicPinned(mode, fileID)
}

/** 一键清音乐缓存：停播、清内存路径、删本地 music_* */
export function clearInnerMusicLocalCache() {
  ensureBound()
  bumpGeneration()
  wantPlay = false
  playing = false
  loading = false
  ready = false
  clearDownloadProgress()
  const ids = Object.keys(srcMem)
  for (let i = 0; i < ids.length; i++) delete srcMem[ids[i]]
  stopMgr()
  clearAllMusicDiskCache()
  emit()
}

/** 内存告警时释放地址缓存（保留当前曲与下一首，不影响播放） */
export function trimInnerMusicMemory() {
  const keep = []
  const cur = currentTrack()
  if (cur && cur.id) keep.push(cur.id)
  const next = peekNextTrack()
  if (next && next.id) keep.push(next.id)
  const ids = Object.keys(srcMem)
  for (let i = 0; i < ids.length; i++) {
    if (keep.indexOf(ids[i]) < 0) delete srcMem[ids[i]]
  }
  trimPlaySourceMemory(keep)
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
  invalidateLocalMusic(track.id, track.fileID)

  const nextList = activeList()
  if (!nextList.length) {
    bumpGeneration()
    index = 0
    playing = false
    ready = false
    loading = false
    wantPlay = false
    stopMgr()
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

  if (playMode === PLAY_MODE_SHUFFLE && activeList().length) rebuildShuffle(true)

  await deleteMusicFile(track.fileID)

  if (wasCurrent && wasPlaying && activeList().length) {
    await loadAndPlay(true)
  } else if (wasCurrent && activeList().length) {
    emit()
  }
}
