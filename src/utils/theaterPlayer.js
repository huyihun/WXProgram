/**
 * 剧场播放：云函数换链流式播，不落 USER_DATA
 */
import { getPlayUrl } from '@/utils/playlist'
import { getEpisode, THEATER_SHOW } from '@/utils/theaterCatalog'

/** fileID → 临时 HTTPS（内存） */
const urlMem = {}

const PROGRESS_KEY = 'theater_progress_taizi'

export async function resolveEpisodeUrl(ep) {
  const item = getEpisode(ep)
  if (!item || !item.fileID) return ''
  if (urlMem[item.fileID]) return urlMem[item.fileID]
  const url = await getPlayUrl(item.fileID)
  if (url) urlMem[item.fileID] = url
  return url || ''
}

/** 静默预取下一集临时链 */
export function prefetchNextEpisode(ep) {
  const next = Number(ep) + 1
  if (next > THEATER_SHOW.episodeCount) return
  resolveEpisodeUrl(next).catch(function () {
    // ignore
  })
}

export async function resolveCoverUrl() {
  const fid = THEATER_SHOW.coverFileID
  if (!fid) return ''
  if (urlMem[fid]) return urlMem[fid]
  try {
    const url = await getPlayUrl(fid)
    if (url) urlMem[fid] = url
    return url || ''
  } catch (e) {
    return ''
  }
}

export function readProgressMap() {
  try {
    const raw = uni.getStorageSync(PROGRESS_KEY)
    if (raw && typeof raw === 'object') return raw
  } catch (e) {
    // ignore
  }
  return {}
}

export function getEpisodeProgress(ep) {
  const map = readProgressMap()
  const v = map[String(ep)]
  const n = Number(v)
  return isFinite(n) && n > 0 ? n : 0
}

export function saveEpisodeProgress(ep, seconds) {
  const map = readProgressMap()
  const t = Math.floor(Number(seconds) || 0)
  if (t < 3) {
    delete map[String(ep)]
  } else {
    map[String(ep)] = t
  }
  try {
    uni.setStorageSync(PROGRESS_KEY, map)
  } catch (e) {
    // ignore
  }
}

export function clearEpisodeProgress(ep) {
  const map = readProgressMap()
  delete map[String(ep)]
  try {
    uni.setStorageSync(PROGRESS_KEY, map)
  } catch (e) {
    // ignore
  }
}
