/**
 * 云相册：照片上传/列表/删除
 *
 * 使用前在云开发控制台创建集合「album」（仅创建者可读写）
 * 照片原图上传到云存储 album/ 目录（App 内上传 → 创建者本人可读）
 * 删除云存储文件走 getMusicUrl 云函数管理端（albumDelete，仅主人 + /album/ 路径）
 *
 * 单次 get 最多 20 条；列表分页 skip+limit。
 */
const db = wx.cloud.database()
const BATCH = 20
const COL = 'album'

/** 上传单张原图并写入相册记录，返回新记录 { _id, fileID, size, createdAt } */
export async function uploadPhoto(tempFilePath, size) {
  const p = String(tempFilePath || '')
  if (!p) throw new Error('无图片')
  const at = p.lastIndexOf('.')
  const ext = at >= 0 ? p.slice(at + 1).toLowerCase() : 'jpg'
  const cloudPath = 'album/' + Date.now() + '_' + Math.floor(Math.random() * 100000) + '.' + ext

  const fileID = await new Promise(function (resolve, reject) {
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: p,
      success: function (res) {
        if (res && res.fileID) resolve(res.fileID)
        else reject(new Error('上传失败'))
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '上传失败'))
      },
    })
  })

  const data = { fileID: fileID, size: Number(size) || 0, createdAt: Date.now() }
  const add = await db.collection(COL).add({ data: data })
  return Object.assign({ _id: add._id }, data)
}

/** 分页拉取：offset 起一页（新在前） */
export async function listPhotos(offset) {
  const res = await db
    .collection(COL)
    .orderBy('createdAt', 'desc')
    .skip(Number(offset) || 0)
    .limit(BATCH)
    .get()
  return res.data || []
}

export function countPhotos() {
  return db.collection(COL).count()
}

/** 删除数据库记录 */
export function removePhotoDoc(id) {
  if (!id) return Promise.resolve()
  return db.collection(COL).doc(id).remove()
}

/** 删除云存储文件（getMusicUrl 管理端，仅主人 + /album/ 路径） */
export function albumDeleteFile(fileID) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: 'getMusicUrl',
      data: { action: 'albumDelete', fileID: fileID },
      success: function (res) {
        const body = (res && res.result) || {}
        if (body.ok) resolve(true)
        else reject(new Error(body.errMsg || '删除失败'))
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '删除失败'))
      },
    })
  })
}

/** 批量换临时链接（预览用，创建者本人可换） */
export function getPhotoTempUrls(fileIds) {
  const list = (fileIds || []).map(function (f) {
    return { fileID: f }
  })
  if (!list.length) return Promise.resolve([])
  return new Promise(function (resolve, reject) {
    wx.cloud.getTempFileURL({
      fileList: list,
      success: function (res) {
        const out = (res.fileList || []).map(function (row) {
          return row && row.tempFileURL ? row.tempFileURL : ''
        })
        resolve(out)
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '换链失败'))
      },
    })
  })
}
