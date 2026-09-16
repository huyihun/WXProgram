/**
 * 用云函数管理端权限读云存储：
 * - 默认：换临时 HTTPS（音乐 / 特效 / 壁纸等）
 * - asJson：直接返回 JSON 内容（小说，避免真机 request 合法域名）
 * - asLrc：读歌词文本（UTF-8 / GBK 自动识别）
 * - action=delete：删除云存储音乐文件（仅 /music/）
 * - action=wallpaperDelete：主人删除壁纸并更新 catalog（仅 /wallpaper/）
 */
const cloud = require('wx-server-sdk')
const iconv = require('iconv-lite')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/** 与客户端 src/utils/owner.js 保持一致 */
const OWNER_OPENIDS = ['o3VZC5RgtNM4gxj-BWWhHA2tsjWQ']

function isOwnerOpenId(openid) {
  if (!openid || !OWNER_OPENIDS.length) return false
  return OWNER_OPENIDS.indexOf(openid) >= 0
}

function isAllowedPath(id) {
  return (
    id.indexOf('/music/') >= 0 ||
    id.indexOf('/fx/') >= 0 ||
    id.indexOf('/book/') >= 0 ||
    id.indexOf('/books/') >= 0 ||
    id.indexOf('/game/') >= 0 ||
    id.indexOf('/picturebook/') >= 0 ||
    id.indexOf('/video/') >= 0 ||
    id.indexOf('/wallpaper/') >= 0 ||
    id.indexOf('/resources/') >= 0 ||
    id.indexOf('/resume/') >= 0 ||
    id.indexOf('/ideas/') >= 0 ||
    id.indexOf('/twin/') >= 0
  )
}

/** 校验是否为合法 UTF-8 字节序列（GBK 歌词会在此失败） */
function isValidUtf8Buffer(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  let i = 0
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3
  while (i < b.length) {
    const c = b[i]
    if (c <= 0x7f) {
      i += 1
      continue
    }
    if ((c & 0xe0) === 0xc0) {
      if (i + 1 >= b.length || (b[i + 1] & 0xc0) !== 0x80) return false
      if ((c & 0xfe) === 0xc0) return false
      i += 2
      continue
    }
    if ((c & 0xf0) === 0xe0) {
      if (i + 2 >= b.length || (b[i + 1] & 0xc0) !== 0x80 || (b[i + 2] & 0xc0) !== 0x80) {
        return false
      }
      i += 3
      continue
    }
    if ((c & 0xf8) === 0xf0) {
      if (
        i + 3 >= b.length ||
        (b[i + 1] & 0xc0) !== 0x80 ||
        (b[i + 2] & 0xc0) !== 0x80 ||
        (b[i + 3] & 0xc0) !== 0x80
      ) {
        return false
      }
      i += 4
      continue
    }
    return false
  }
  return true
}

function decodeTextBuffer(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  if (!b.length) return ''
  // UTF-16 BOM
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return b.slice(2).toString('utf16le')
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    const swapped = Buffer.alloc(b.length - 2)
    for (let i = 2; i + 1 < b.length; i += 2) {
      swapped[i - 2] = b[i + 1]
      swapped[i - 1] = b[i]
    }
    return swapped.toString('utf16le')
  }
  // 无 BOM 但大量 \0：按 UTF-16LE 试
  if (b.length >= 4 && b[1] === 0 && b[3] === 0 && b[0] !== 0) {
    let t = b.toString('utf16le')
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)
    if (t.indexOf('[') >= 0) return t
  }
  if (isValidUtf8Buffer(b)) {
    let t = b.toString('utf8')
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)
    return t
  }
  let t = iconv.decode(b, 'gbk')
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)
  return t
}

async function deleteCloudFile(fileID) {
  const res = await cloud.deleteFile({ fileList: [fileID] })
  const row = res.fileList && res.fileList[0]
  const msg = (row && (row.errMsg || row.errmsg)) || ''
  const ok =
    row &&
    (row.status === 0 ||
      msg === 'ok' ||
      String(msg).indexOf('STORAGE_FILE_NONEXIST') >= 0 ||
      String(msg).indexOf('does not exist') >= 0)
  return { ok: !!ok, msg: msg || '' }
}

async function wallpaperDelete(event) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext && wxContext.OPENID
  if (!isOwnerOpenId(openid)) {
    return { ok: false, errMsg: '无权限' }
  }

  const fileID = String((event && event.fileID) || '')
  const catalogFileID = String((event && event.catalogFileID) || '')
  const entryId = String((event && event.entryId) || '')
  if (!fileID || !catalogFileID || !entryId) {
    return { ok: false, errMsg: '缺少参数' }
  }
  if (fileID.indexOf('/wallpaper/') < 0 || catalogFileID.indexOf('/wallpaper/') < 0) {
    return { ok: false, errMsg: '仅支持壁纸目录' }
  }

  // 先改 catalog，再删图，避免 catalog 更新失败后留下空白占位
  let nextItems = []
  let title = '壁纸'
  try {
    const dl = await cloud.downloadFile({ fileID: catalogFileID })
    const buf = dl.fileContent
    if (!buf) return { ok: false, errMsg: 'catalog 为空' }
    const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)
    const data = JSON.parse(text)
    title = (data && data.title) || '壁纸'
    const items = (data && data.items) || []
    const next = []
    for (let i = 0; i < items.length; i++) {
      const row = items[i]
      if (!row) continue
      const rid = String(row.id || '')
      const rfile = String(row.file || '')
      // id 或 file 任一命中即去掉
      if (rid === entryId || rfile === entryId || rfile === entryId + '.jpg' || rfile === entryId + '.png') {
        continue
      }
      next.push(row)
    }
    data.items = next
    nextItems = next
    const cloudPath = 'wallpaper/zhencang/catalog.json'
    await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    })
  } catch (err) {
    return {
      ok: false,
      errMsg: (err && err.message) || '更新 catalog 失败',
    }
  }

  const del = await deleteCloudFile(fileID)
  if (!del.ok) {
    // catalog 已更新，图删失败也算半成功：前端列表已不含该条
    return {
      ok: true,
      remain: nextItems.length,
      title: title,
      items: nextItems,
      warn: del.msg || '图片删除失败',
    }
  }

  return {
    ok: true,
    remain: nextItems.length,
    title: title,
    items: nextItems,
  }
}

exports.main = async (event) => {
  // 壁纸删除：不要求走通用 fileID 白名单入口以外的逻辑，但仍校验路径
  if (event && event.action === 'wallpaperDelete') {
    return wallpaperDelete(event)
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
      const del = await deleteCloudFile(id)
      if (!del.ok) {
        return { ok: false, errMsg: del.msg || '删除失败' }
      }
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        errMsg: (err && err.message) || '删除异常',
      }
    }
  }

  // 小说 / catalog：云端读文件，客户端不走 uni.request 外网域名
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

  // 歌词：UTF-8 / GBK 自动识别，统一返回 UTF-8 文本
  if (event && event.asLrc) {
    if (id.indexOf('/music/') < 0) {
      return { ok: false, errMsg: '仅支持音乐目录歌词' }
    }
    try {
      const dl = await cloud.downloadFile({ fileID: id })
      const buf = dl.fileContent
      if (!buf) {
        return { ok: false, errMsg: '歌词为空' }
      }
      const text = decodeTextBuffer(buf)
      return { ok: true, text: text }
    } catch (err) {
      return {
        ok: false,
        errMsg: (err && err.message) || '读取歌词失败',
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
