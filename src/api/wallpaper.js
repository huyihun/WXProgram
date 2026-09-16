/**
 * 壁纸：拉目录、换临时链、保存相册、主人删除
 */
import { getPlayUrl } from '@/utils/playlist'
import {
  getWallpaperCatalogFileID,
  getWallpaperFileID,
} from '@/utils/wallpaperCatalog'

/** fileID → 临时 HTTPS */
const urlMem = {}

let catalogCache = null

const REMOVED_KEY = 'wallpaper_removed_ids_v1'

function readRemovedIds() {
  try {
    const list = uni.getStorageSync(REMOVED_KEY)
    return list && list.length ? list.slice() : []
  } catch (e) {
    return []
  }
}

function writeRemovedIds(list) {
  try {
    uni.setStorageSync(REMOVED_KEY, list || [])
  } catch (e) {
    // ignore
  }
}

function markWallpaperRemoved(id) {
  if (!id) return
  const list = readRemovedIds()
  if (list.indexOf(id) >= 0) return
  list.push(id)
  writeRemovedIds(list)
}

function filterRemovedItems(items) {
  const removed = readRemovedIds()
  if (!removed.length) return items || []
  const skip = {}
  for (let i = 0; i < removed.length; i++) {
    if (removed[i]) skip[removed[i]] = true
  }
  const out = []
  const list = items || []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (!t || !t.id || skip[t.id]) continue
    out.push(t)
  }
  return out
}

async function fetchJsonByCloud(fid) {
  if (!wx.cloud) throw new Error('云能力不可用')
  const res = await wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: { fileID: fid, asJson: true },
  })
  const body = res.result || {}
  if (!body.ok) throw new Error(body.errMsg || '加载失败')
  return body.data
}

export async function fetchWallpaperCatalog(force) {
  if (!force && catalogCache) return catalogCache
  const data = await fetchJsonByCloud(getWallpaperCatalogFileID())
  catalogCache = {
    title: (data && data.title) || '壁纸',
    items: filterRemovedItems((data && data.items) || []),
  }
  return catalogCache
}

export function getCachedWallpaperCatalog() {
  return catalogCache
}

export function clearWallpaperCatalogCache() {
  catalogCache = null
}

/** 换链失败的条目从前端列表去掉并记住 */
export function dropWallpaperItems(ids) {
  if (!ids || !ids.length) return
  for (let i = 0; i < ids.length; i++) {
    markWallpaperRemoved(ids[i])
  }
  if (!catalogCache) return
  catalogCache = {
    title: catalogCache.title || '壁纸',
    items: filterRemovedItems(catalogCache.items || []),
  }
}

export async function resolveWallpaperUrl(item) {
  const fid = getWallpaperFileID(item)
  if (!fid) return ''
  if (urlMem[fid]) return urlMem[fid]
  const url = await getPlayUrl(fid)
  if (url) urlMem[fid] = url
  return url || ''
}

export function forgetWallpaperUrl(item) {
  const fid = getWallpaperFileID(item)
  if (fid && urlMem[fid]) delete urlMem[fid]
}

function ensureAlbumAuth() {
  return new Promise(function (resolve, reject) {
    uni.getSetting({
      success: function (setting) {
        const auth = setting.authSetting || {}
        if (auth['scope.writePhotosAlbum']) {
          resolve(true)
          return
        }
        uni.authorize({
          scope: 'scope.writePhotosAlbum',
          success: function () {
            resolve(true)
          },
          fail: function () {
            uni.showModal({
              title: '需要相册权限',
              content: '请在设置中开启保存到相册',
              confirmText: '去设置',
              success: function (r) {
                if (r.confirm) uni.openSetting({})
              },
            })
            reject(new Error('无相册权限'))
          },
        })
      },
      fail: function (err) {
        reject(err)
      },
    })
  })
}

export async function saveWallpaperToAlbum(item) {
  await ensureAlbumAuth()
  const url = await resolveWallpaperUrl(item)
  if (!url) throw new Error('获取地址失败')

  const tempPath = await new Promise(function (resolve, reject) {
    uni.downloadFile({
      url: url,
      success: function (res) {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载失败'))
          return
        }
        resolve(res.tempFilePath)
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '下载失败'))
      },
    })
  })

  await new Promise(function (resolve, reject) {
    uni.saveImageToPhotosAlbum({
      filePath: tempPath,
      success: function () {
        resolve()
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '保存失败'))
      },
    })
  })
}

export async function deleteWallpaper(item) {
  if (!item || !item.id) throw new Error('缺少条目')
  if (!wx.cloud) throw new Error('云能力不可用')

  const fileID = getWallpaperFileID(item)
  const catalogFileID = getWallpaperCatalogFileID()
  const res = await wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: {
      action: 'wallpaperDelete',
      fileID: fileID,
      catalogFileID: catalogFileID,
      entryId: item.id,
    },
  })
  const body = res.result || {}
  if (!body.ok) throw new Error(body.errMsg || '删除失败')

  forgetWallpaperUrl(item)
  markWallpaperRemoved(item.id)

  if (body.items && body.items.length >= 0) {
    catalogCache = {
      title: body.title || '壁纸',
      items: filterRemovedItems(body.items),
    }
  } else {
    clearWallpaperCatalogCache()
  }
  return body
}
