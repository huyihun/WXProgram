/**
 * 用云函数管理端权限读云存储：
 * - 默认：换临时 HTTPS（音乐 / 特效 / 心情图）
 * - fileList：批量换链
 * - asJson：直接返回 JSON 内容（小说，避免真机 request 合法域名）
 * - action=delete：删除云存储音乐文件（仅 /music/）
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function isAllowedPath(id) {
  const s = String(id || '')
  return (
    s.indexOf('/music/') >= 0 ||
    s.indexOf('/fx/') >= 0 ||
    s.indexOf('/book/') >= 0 ||
    s.indexOf('/books/') >= 0 ||
    s.indexOf('/mood/') >= 0
  )
}

exports.main = async (event) => {
  // 批量换临时链（心情表情）
  const batch = event && event.fileList
  if (batch && batch.length) {
    const list = []
    for (let i = 0; i < batch.length; i++) {
      if (isAllowedPath(batch[i])) list.push(batch[i])
    }
    if (!list.length) {
      return { ok: false, errMsg: '非法文件路径' }
    }
    try {
      const res = await cloud.getTempFileURL({ fileList: list })
      const fileList = (res && res.fileList) || []
      const urls = {}
      for (let i = 0; i < fileList.length; i++) {
        const row = fileList[i]
        if (row.fileID && row.tempFileURL) urls[row.fileID] = row.tempFileURL
      }
      return { ok: true, urls }
    } catch (err) {
      return {
        ok: false,
        errMsg: (err && err.message) || '批量获取临时链接异常',
      }
    }
  }

  const fileID = event && event.fileID
  if (!fileID) {
    return { ok: false, errMsg: '缺少 fileID' }
  }

  const id = String(fileID)
  if (!isAllowedPath(id)) {
    return { ok: false, errMsg: '非法文件路径' }
  }

  // 删除音乐文件（只开放 /music/，防止误删小说等）
  if (event && event.action === 'delete') {
    if (id.indexOf('/music/') < 0) {
      return { ok: false, errMsg: '仅支持删除音乐文件' }
    }
    try {
      const res = await cloud.deleteFile({ fileList: [id] })
      const row = res.fileList && res.fileList[0]
      const msg = (row && (row.errMsg || row.errmsg)) || ''
      const ok =
        row &&
        (row.status === 0 ||
          msg === 'ok' ||
          String(msg).indexOf('STORAGE_FILE_NONEXIST') >= 0 ||
          String(msg).indexOf('does not exist') >= 0)
      if (!ok) {
        return {
          ok: false,
          errMsg: msg || '删除失败',
        }
      }
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        errMsg: (err && err.message) || '删除异常',
      }
    }
  }

  // 小说：云端读文件，客户端不走 uni.request 外网域名
  if (event && event.asJson) {
    try {
      const dl = await cloud.downloadFile({ fileID: id })
      const buf = dl.fileContent
      if (!buf) {
        return { ok: false, errMsg: '文件内容为空' }
      }
      const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)
      const data = JSON.parse(text)
      return { ok: true, data }
    } catch (err) {
      return {
        ok: false,
        errMsg: (err && err.message) || '读取 JSON 失败',
      }
    }
  }

  try {
    const res = await cloud.getTempFileURL({
      fileList: [fileID],
    })
    const row = res.fileList && res.fileList[0]
    if (!row || !row.tempFileURL) {
      return {
        ok: false,
        errMsg: (row && row.errMsg) || '获取临时链接失败',
      }
    }
    return {
      ok: true,
      tempFileURL: row.tempFileURL,
    }
  } catch (err) {
    return {
      ok: false,
      errMsg: (err && err.message) || '获取临时链接异常',
    }
  }
}
