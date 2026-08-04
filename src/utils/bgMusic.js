/**
 * 全局背景音乐（BackgroundAudioManager）
 * 切页、切后台可继续播；HomeMusicBar 只做 UI
 * 支持默认 / VIP / 超级VIP 歌单（随首页版本同步）
 */
import {
  PLAYLIST,
  VIP_PLAYLIST,
  SUPER_VIP_PLAYLIST,
  JX_PLAYLIST,
  MUSIC_MODE_DEFAULT,
  MUSIC_MODE_VIP,
  MUSIC_MODE_SUPER,
  MUSIC_MODE_JX,
  getPlaylistByMode,
  resolvePlaySource,
  deleteMusicFile,
  markMusicRemoved,
  togglePinMusic,
  isMusicPinned,
  syncMusicPrefs,
} from '@/utils/playlist'

let mode = MUSIC_MODE_DEFAULT
let index = 0
let playing = false
let loading = false
let ready = false
let pendingPlay = false
let bound = false
const srcMem = {}
const listeners = []

function getMgr() {
  return uni.getBackgroundAudioManager()
}

function activeList() {
  return getPlaylistByMode(mode)
}

function currentTrack() {
  const list = activeList()
  return list[index] || null
}

function emptyTrack() {
  return { id: '', title: '', artist: '', fileID: '' }
}

function normalizeMode(nextMode) {
  if (nextMode === MUSIC_MODE_SUPER) return MUSIC_MODE_SUPER
  if (nextMode === MUSIC_MODE_VIP) return MUSIC_MODE_VIP
  if (nextMode === MUSIC_MODE_JX) return MUSIC_MODE_JX
  return MUSIC_MODE_DEFAULT
}

function emit() {
  const track = currentTrack()
  const state = {
    mode,
    index,
    playing,
    loading,
    ready,
    playlist: activeList(),
    track: track || emptyTrack(),
  }
  for (let i = 0; i < listeners.length; i++) {
    listeners[i](state)
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
    pendingPlay = false
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
    playNextBgMusic()
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
    emit()
  })
  bg.onError((err) => {
    console.error('背景音乐失败', err)
    pendingPlay = false
    playing = false
    loading = false
    ready = false
    emit()
    const msg = (err && err.errMsg) || '播放失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  })
}

async function resolveSrc(track) {
  if (!track || !track.fileID) return ''
  if (srcMem[track.id]) return srcMem[track.id]
  const src = await resolvePlaySource(track)
  srcMem[track.id] = src
  return src
}

/** 静默预下载下一首，切歌时尽量秒开 */
function prefetchNextTrack() {
  const list = activeList()
  if (list.length < 2) return
  const next = list[(index + 1) % list.length]
  if (!next || !next.fileID || srcMem[next.id]) return
  resolveSrc(next).catch(() => {})
}

function applyMeta(track) {
  const bg = getMgr()
  bg.title = track.title || '音乐'
  if (mode === MUSIC_MODE_SUPER) {
    bg.epname = '超级VIP'
  } else if (mode === MUSIC_MODE_VIP) {
    bg.epname = 'VIP专属'
  } else if (mode === MUSIC_MODE_JX) {
    bg.epname = '就几首歌而已'
  } else {
    bg.epname = track.title || '音乐'
  }
  bg.singer = track.artist || ''
}

/** 订阅状态变化，返回取消函数 */
export function subscribeBgMusic(fn) {
  ensureBound()
  listeners.push(fn)
  fn({
    mode,
    index,
    playing,
    loading,
    ready,
    playlist: activeList(),
    track: currentTrack() || emptyTrack(),
  })
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

/** 预下载当前曲，不自动播 */
export async function prefetchBgMusic() {
  ensureBound()
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
    await resolveSrc(track)
    ready = true
    loading = false
    emit()
    prefetchNextTrack()
  } catch (err) {
    console.error('预加载歌曲失败', err)
    loading = false
    emit()
  }
}

async function loadAndPlay(autoPlay) {
  ensureBound()
  const track = currentTrack()
  if (!track || !track.fileID) return

  loading = true
  pendingPlay = !!autoPlay
  emit()

  try {
    const src = await resolveSrc(track)
    const bg = getMgr()
    applyMeta(track)
    prefetchNextTrack()
    if (autoPlay) {
      bg.src = src
    } else {
      ready = true
      loading = false
      pendingPlay = false
      emit()
    }
  } catch (err) {
    console.error('加载歌曲失败', err)
    pendingPlay = false
    loading = false
    emit()
    const msg = (err && err.message) || '加载歌曲失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  }
}

export function toggleBgMusic() {
  ensureBound()
  const track = currentTrack()
  if (!track || !track.fileID) return
  const bg = getMgr()

  if (playing) {
    pendingPlay = false
    bg.pause()
    return
  }

  if (ready && bg.src) {
    try {
      bg.play()
    } catch (e) {
      loadAndPlay(true)
    }
    return
  }

  loadAndPlay(true)
}

export async function playPrevBgMusic() {
  const list = activeList()
  if (!list.length) return
  index = (index - 1 + list.length) % list.length
  ready = false
  emit()
  await loadAndPlay(true)
}

export async function playNextBgMusic() {
  const list = activeList()
  if (!list.length) return
  index = (index + 1) % list.length
  ready = false
  emit()
  await loadAndPlay(true)
}

/** 按当前歌单下标选歌并播放 */
export async function playTrackAt(i) {
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

/** 启动时拉取云端删除/置顶偏好 */
export async function loadMusicPrefsAndRefresh() {
  await syncMusicPrefs()
  emit()
}

/** 置顶 / 取消置顶当前歌单中的一首，并同步云端 */
export async function pinTrackAt(i) {
  ensureBound()
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

export function isTrackPinned(fileID) {
  return isMusicPinned(mode, fileID)
}

/**
 * 从当前歌单删除一首：先本地隐藏刷新列表，再删云文件
 */
export async function removeTrackAt(i) {
  ensureBound()
  const list = activeList()
  if (!list.length) return
  let at = Number(i)
  if (!isFinite(at) || at < 0 || at >= list.length) return

  const track = list[at]
  if (!track || !track.fileID) return

  const wasCurrent = at === index
  const wasPlaying = playing && wasCurrent

  // 先本地隐藏，立刻刷新列表，避免异步失败导致还看得到
  markMusicRemoved(track.fileID)
  delete srcMem[track.id]

  const nextList = activeList()
  if (!nextList.length) {
    index = 0
    playing = false
    ready = false
    loading = false
    pendingPlay = false
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
    await prefetchBgMusic()
  }
}

/** 切换歌单；切换前若在播则自动播新歌单第一首 */
export async function switchMusicMode(nextMode) {
  ensureBound()
  const target = normalizeMode(nextMode)
  if (target === mode) return

  const wasPlaying = playing
  const bg = getMgr()
  try {
    bg.stop()
  } catch (e) {
    // ignore
  }

  mode = target
  index = 0
  playing = false
  ready = false
  loading = false
  pendingPlay = false
  emit()

  if (wasPlaying) {
    await loadAndPlay(true)
    return
  }
  await prefetchBgMusic()
}

export function getBgMusicState() {
  return {
    mode,
    index,
    playing,
    loading,
    ready,
    playlist: activeList(),
    track: currentTrack() || emptyTrack(),
  }
}

export {
  MUSIC_MODE_DEFAULT,
  MUSIC_MODE_VIP,
  MUSIC_MODE_SUPER,
  MUSIC_MODE_JX,
  PLAYLIST,
  VIP_PLAYLIST,
  SUPER_VIP_PLAYLIST,
  JX_PLAYLIST,
}
