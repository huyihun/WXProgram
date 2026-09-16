/**
 * 音乐偏好云同步（置顶 + 已删列表 + 默认歌单 + 盲盒已揭示/好听/不好听）
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - music_prefs
 *
 * 云文档字段：
 * - pinned: { [mode]: string[] }  mode 见 musicModes.VALID_MUSIC_MODES
 * - removed: string[]  已删除的 fileID（清缓存后仍生效）
 * - defaultMode: string  启动时默认歌单 mode
 * - blindRevealed: string[]  盲盒已揭示真实歌名的 track.id
 * - blindLiked: string[]  盲盒好听 track.id
 * - blindDisliked: string[]  盲盒不好听 track.id
 */
import { VALID_MUSIC_MODES, normalizeMusicMode } from '@/utils/musicModes'

const COLLECTION = 'music_prefs'
const LOCAL_KEY = 'music_prefs_v1'
const LOCAL_REMOVED_KEY = 'music_removed_file_ids'
const LOCAL_BLIND_KEY = 'music_blind_revealed'
const LOCAL_BLIND_LIKED_KEY = 'music_blind_liked'
const LOCAL_BLIND_DISLIKED_KEY = 'music_blind_disliked'
const FALLBACK_DEFAULT_MODE = 'flac'
const VALID_MODES = VALID_MUSIC_MODES

let state = null
let loading = null

function normalizeMode(mode) {
  return normalizeMusicMode(mode) || FALLBACK_DEFAULT_MODE
}

function readLocalRemoved() {
  try {
    const list = uni.getStorageSync(LOCAL_REMOVED_KEY)
    return list && list.length ? list.slice() : []
  } catch (e) {
    return []
  }
}

function writeLocalRemoved(list) {
  try {
    uni.setStorageSync(LOCAL_REMOVED_KEY, list || [])
  } catch (e) {
    // ignore
  }
}

function readLocalIdList(key) {
  try {
    const list = uni.getStorageSync(key)
    return list && list.length ? list.slice() : []
  } catch (e) {
    return []
  }
}

function writeLocalIdList(key, list) {
  try {
    uni.setStorageSync(key, list || [])
  } catch (e) {
    // ignore
  }
}

function readLocalBlindRevealed() {
  return readLocalIdList(LOCAL_BLIND_KEY)
}

function writeLocalBlindRevealed(list) {
  writeLocalIdList(LOCAL_BLIND_KEY, list)
}

function readLocalBlindLiked() {
  return readLocalIdList(LOCAL_BLIND_LIKED_KEY)
}

function writeLocalBlindLiked(list) {
  writeLocalIdList(LOCAL_BLIND_LIKED_KEY, list)
}

function readLocalBlindDisliked() {
  return readLocalIdList(LOCAL_BLIND_DISLIKED_KEY)
}

function writeLocalBlindDisliked(list) {
  writeLocalIdList(LOCAL_BLIND_DISLIKED_KEY, list)
}

function readLocalPinned() {
  try {
    const raw = uni.getStorageSync(LOCAL_KEY)
    if (raw && raw.pinned) return raw.pinned
  } catch (e) {
    // ignore
  }
  const pinned = {}
  for (let i = 0; i < VALID_MODES.length; i++) {
    const mode = VALID_MODES[i]
    try {
      const list = uni.getStorageSync('music_pinned_' + mode) || []
      if (list.length) pinned[mode] = list.slice()
    } catch (e) {
      // ignore
    }
  }
  return pinned
}

function readLocalDefaultMode() {
  try {
    const raw = uni.getStorageSync(LOCAL_KEY)
    if (raw && raw.defaultMode) return normalizeMode(raw.defaultMode)
  } catch (e) {
    // ignore
  }
  return FALLBACK_DEFAULT_MODE
}

function writeLocalPrefs(pinned, defaultMode) {
  try {
    uni.setStorageSync(LOCAL_KEY, {
      pinned: pinned || {},
      defaultMode: normalizeMode(defaultMode),
    })
  } catch (e) {
    // ignore
  }
}

function getDb() {
  return wx.cloud.database()
}

function clonePinned(pinned) {
  const src = pinned || {}
  const out = {}
  const keys = Object.keys(src)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const list = src[k]
    out[k] = list && list.length ? list.slice() : []
  }
  return out
}

function mergeIdList(a, b) {
  const map = {}
  const out = []
  const lists = [a || [], b || []]
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i]
    for (let j = 0; j < list.length; j++) {
      const id = list[j]
      if (!id || map[id]) continue
      map[id] = true
      out.push(id)
    }
  }
  return out
}

function sliceIds(list) {
  return list && list.length ? list.slice() : []
}

function buildState(removed, pinned, defaultMode, blindRevealed, blindLiked, blindDisliked) {
  return {
    removed: removed || [],
    pinned: clonePinned(pinned),
    defaultMode: normalizeMode(defaultMode),
    blindRevealed: sliceIds(blindRevealed),
    blindLiked: sliceIds(blindLiked),
    blindDisliked: sliceIds(blindDisliked),
  }
}

function persistBlindLists() {
  writeLocalBlindRevealed(state.blindRevealed || [])
  writeLocalBlindLiked(state.blindLiked || [])
  writeLocalBlindDisliked(state.blindDisliked || [])
}

/** 内存中的偏好；未加载时回落本地 */
export function getMusicPrefsState() {
  if (state) return state
  return buildState(
    readLocalRemoved(),
    readLocalPinned(),
    readLocalDefaultMode(),
    readLocalBlindRevealed(),
    readLocalBlindLiked(),
    readLocalBlindDisliked()
  )
}

/** 当前默认歌单 mode（未设置时回落 FLAC） */
export function getDefaultMusicMode() {
  return getMusicPrefsState().defaultMode || FALLBACK_DEFAULT_MODE
}

export function isBlindTrackRevealed(trackId) {
  if (!trackId) return false
  const list = getMusicPrefsState().blindRevealed || []
  return list.indexOf(trackId) >= 0
}

export function getBlindLikedIds() {
  return sliceIds(getMusicPrefsState().blindLiked)
}

export function getBlindDislikedIds() {
  return sliceIds(getMusicPrefsState().blindDisliked)
}

/** '' | 'like' | 'dislike' */
export function getBlindTrackRate(trackId) {
  if (!trackId) return ''
  const s = getMusicPrefsState()
  if ((s.blindLiked || []).indexOf(trackId) >= 0) return 'like'
  if ((s.blindDisliked || []).indexOf(trackId) >= 0) return 'dislike'
  return ''
}

/** 标记盲盒曲目已揭示真实歌名，并同步云端 */
export async function revealBlindTrack(trackId) {
  if (!trackId) return false
  await ensureMusicPrefs()
  ensureLocalMusicPrefs()
  const list = (state.blindRevealed || []).slice()
  if (list.indexOf(trackId) >= 0) return true
  list.push(trackId)
  state.blindRevealed = list
  writeLocalBlindRevealed(list)
  await saveMusicPrefs()
  return true
}

/**
 * 盲盒好听/不好听（互斥），同步云端
 * @param {'like'|'dislike'} kind
 */
export async function rateBlindTrack(trackId, kind) {
  if (!trackId) return ''
  if (kind !== 'like' && kind !== 'dislike') return getBlindTrackRate(trackId)
  await ensureMusicPrefs()
  ensureLocalMusicPrefs()
  let liked = (state.blindLiked || []).slice()
  let disliked = (state.blindDisliked || []).slice()
  const li = liked.indexOf(trackId)
  if (li >= 0) liked.splice(li, 1)
  const di = disliked.indexOf(trackId)
  if (di >= 0) disliked.splice(di, 1)
  if (kind === 'like') liked.push(trackId)
  else disliked.push(trackId)
  state.blindLiked = liked
  state.blindDisliked = disliked
  persistBlindLists()
  await saveMusicPrefs()
  return kind
}

/** 取消好听/不好听评分 */
export async function clearBlindRate(trackId) {
  if (!trackId) return false
  await ensureMusicPrefs()
  ensureLocalMusicPrefs()
  let liked = (state.blindLiked || []).slice()
  let disliked = (state.blindDisliked || []).slice()
  const li = liked.indexOf(trackId)
  if (li >= 0) liked.splice(li, 1)
  const di = disliked.indexOf(trackId)
  if (di >= 0) disliked.splice(di, 1)
  state.blindLiked = liked
  state.blindDisliked = disliked
  persistBlindLists()
  await saveMusicPrefs()
  return true
}

/** 从云库拉取偏好；与本地合并 */
export async function ensureMusicPrefs() {
  if (state) return state
  if (loading) return loading

  loading = (async () => {
    const localPinned = readLocalPinned()
    const localDefaultMode = readLocalDefaultMode()
    const localBlind = readLocalBlindRevealed()
    const localLiked = readLocalBlindLiked()
    const localDisliked = readLocalBlindDisliked()

    try {
      if (!wx.cloud) {
        state = buildState(
          readLocalRemoved(),
          localPinned,
          localDefaultMode,
          localBlind,
          localLiked,
          localDisliked
        )
        return state
      }
      const res = await getDb().collection(COLLECTION).limit(1).get()
      const row = res.data && res.data[0]
      const localRemoved = readLocalRemoved()
      if (row) {
        state = buildState(
          mergeIdList(row.removed, localRemoved),
          row.pinned ? clonePinned(row.pinned) : localPinned,
          row.defaultMode || localDefaultMode,
          mergeIdList(row.blindRevealed, localBlind),
          mergeIdList(row.blindLiked, localLiked),
          mergeIdList(row.blindDisliked, localDisliked)
        )
        writeLocalRemoved(state.removed)
        writeLocalPrefs(state.pinned, state.defaultMode)
        persistBlindLists()
        return state
      }

      state = buildState(
        localRemoved,
        localPinned,
        localDefaultMode,
        localBlind,
        localLiked,
        localDisliked
      )
      return state
    } catch (err) {
      console.warn('[musicPrefs] 云读取失败，使用本地', err)
      state = buildState(
        readLocalRemoved(),
        localPinned,
        localDefaultMode,
        localBlind,
        localLiked,
        localDisliked
      )
      return state
    } finally {
      loading = null
    }
  })()

  return loading
}

/**
 * 同步 pinned + removed + defaultMode + 盲盒字段到云库（本地先写）
 * 嵌套对象/数组必须用 _.set 整段替换
 */
export async function saveMusicPrefs() {
  ensureLocalMusicPrefs()
  state = buildState(
    state.removed,
    state.pinned,
    state.defaultMode,
    state.blindRevealed,
    state.blindLiked,
    state.blindDisliked
  )
  writeLocalRemoved(state.removed)
  writeLocalPrefs(state.pinned, state.defaultMode)
  persistBlindLists()

  if (!wx.cloud) return

  const db = getDb()
  const _ = db.command
  const col = db.collection(COLLECTION)
  const now = Date.now()

  try {
    const res = await col.limit(1).get()
    const list = res.data || []
    if (!list.length) {
      await col.add({
        data: {
          pinned: state.pinned,
          removed: state.removed,
          defaultMode: state.defaultMode,
          blindRevealed: state.blindRevealed || [],
          blindLiked: state.blindLiked || [],
          blindDisliked: state.blindDisliked || [],
          updatedAt: now,
        },
      })
      return
    }
    await col.doc(list[0]._id).update({
      data: {
        pinned: _.set(state.pinned),
        removed: _.set(state.removed),
        defaultMode: state.defaultMode,
        blindRevealed: _.set(state.blindRevealed || []),
        blindLiked: _.set(state.blindLiked || []),
        blindDisliked: _.set(state.blindDisliked || []),
        updatedAt: now,
      },
    })
  } catch (err) {
    console.warn('[musicPrefs] 保存云端失败', err)
    const msg = (err && (err.errMsg || err.message)) || '同步云端失败'
    if (String(msg).indexOf('not exist') >= 0 || String(msg).indexOf('ResourceNotFound') >= 0) {
      throw new Error('请先创建云库集合 music_prefs')
    }
    throw new Error(String(msg).slice(0, 40))
  }
}

/** 设为启动默认歌单，并同步云端 */
export async function setDefaultMusicMode(mode) {
  await ensureMusicPrefs()
  state.defaultMode = normalizeMode(mode)
  await saveMusicPrefs()
  return state.defaultMode
}

/** 确保内存 state 已初始化（避免改到临时对象，删除不生效） */
export function ensureLocalMusicPrefs() {
  if (state) return state
  state = buildState(
    readLocalRemoved(),
    readLocalPinned(),
    readLocalDefaultMode(),
    readLocalBlindRevealed(),
    readLocalBlindLiked(),
    readLocalBlindDisliked()
  )
  return state
}

/** 先落本地，云同步由 saveMusicPrefs 负责 */
export function saveRemovedLocalOnly() {
  ensureLocalMusicPrefs()
  writeLocalRemoved(state.removed || [])
  writeLocalPrefs(state.pinned || {}, state.defaultMode)
  persistBlindLists()
}
