/**
 * 音乐偏好云同步（置顶 + 已删列表）
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - music_prefs
 *
 * 云文档字段：
 * - pinned: { [mode]: string[] }
 * - removed: string[]  已删除的 fileID（清缓存后仍生效）
 */

const COLLECTION = 'music_prefs'
const LOCAL_KEY = 'music_prefs_v1'
const LOCAL_REMOVED_KEY = 'music_removed_file_ids'

let state = null
let loading = null

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

function readLocalPinned() {
  try {
    const raw = uni.getStorageSync(LOCAL_KEY)
    if (raw && raw.pinned) return raw.pinned
  } catch (e) {
    // ignore
  }
  const pinned = {}
  const modes = ['default', 'vip', 'super', 'jx']
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i]
    try {
      const list = uni.getStorageSync('music_pinned_' + mode) || []
      if (list.length) pinned[mode] = list.slice()
    } catch (e) {
      // ignore
    }
  }
  return pinned
}

function writeLocalPinned(pinned) {
  try {
    uni.setStorageSync(LOCAL_KEY, { pinned: pinned || {} })
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

/** 内存中的偏好；未加载时回落本地 */
export function getMusicPrefsState() {
  if (state) return state
  return {
    removed: readLocalRemoved(),
    pinned: readLocalPinned(),
  }
}

/** 从云库拉取置顶 + 已删；与本地合并 */
export async function ensureMusicPrefs() {
  if (state) return state
  if (loading) return loading

  loading = (async () => {
    const localPinned = readLocalPinned()

    try {
      if (!wx.cloud) {
        state = { removed: readLocalRemoved(), pinned: localPinned }
        return state
      }
      const res = await getDb().collection(COLLECTION).limit(1).get()
      const row = res.data && res.data[0]
      // 异步结束后再读本地，避免期间删除被旧快照盖掉
      const localRemoved = readLocalRemoved()
      if (row) {
        state = {
          removed: mergeIdList(row.removed, localRemoved),
          pinned: row.pinned ? clonePinned(row.pinned) : localPinned,
        }
        writeLocalRemoved(state.removed)
        writeLocalPinned(state.pinned)
        return state
      }

      state = {
        removed: localRemoved,
        pinned: clonePinned(localPinned),
      }
      return state
    } catch (err) {
      console.warn('[musicPrefs] 云读取失败，使用本地', err)
      state = { removed: readLocalRemoved(), pinned: localPinned }
      return state
    } finally {
      loading = null
    }
  })()

  return loading
}

/**
 * 同步 pinned + removed 到云库（本地先写）
 * 嵌套对象/数组必须用 _.set 整段替换
 */
export async function saveMusicPrefs() {
  ensureLocalMusicPrefs()
  state = {
    removed: (state.removed || []).slice(),
    pinned: clonePinned(state.pinned),
  }
  writeLocalRemoved(state.removed)
  writeLocalPinned(state.pinned)

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
          updatedAt: now,
        },
      })
      return
    }
    await col.doc(list[0]._id).update({
      data: {
        pinned: _.set(state.pinned),
        removed: _.set(state.removed),
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

/** 确保内存 state 已初始化（避免改到临时对象，删除不生效） */
export function ensureLocalMusicPrefs() {
  if (state) return state
  state = {
    removed: readLocalRemoved(),
    pinned: readLocalPinned(),
  }
  return state
}

/** 先落本地，云同步由 saveMusicPrefs 负责 */
export function saveRemovedLocalOnly() {
  ensureLocalMusicPrefs()
  writeLocalRemoved(state.removed || [])
  writeLocalPinned(state.pinned || {})
}
