/**
 * 简历模板：拉目录、云函数换临时链后 downloadFile + openDocument
 * （不用客户端 wx.cloud.downloadFile，避免存储权限导致 empty download url）
 */
import { getPlayUrl } from '@/utils/playlist'
import {
  getResumeCatalogFileID,
  getResumeFileID,
} from '@/utils/resumeCatalog'

let catalogCache = null

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

export async function fetchResumeCatalog(force) {
  if (!force && catalogCache) return catalogCache
  const data = await fetchJsonByCloud(getResumeCatalogFileID())
  catalogCache = {
    title: (data && data.title) || '简历模板',
    items: (data && data.items) || [],
  }
  return catalogCache
}

export function getCachedResumeCatalog() {
  return catalogCache
}

function downloadToTemp(url) {
  return new Promise(function (resolve, reject) {
    uni.downloadFile({
      url: url,
      success: function (res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error('下载失败'))
      },
      fail: function (err) {
        const msg = (err && (err.errMsg || err.message)) || '下载失败'
        if (msg.indexOf('域名') >= 0 || msg.indexOf('url not in domain') >= 0) {
          reject(new Error('需配置 downloadFile 合法域名'))
          return
        }
        reject(new Error(msg))
      },
    })
  })
}

function openLocalDoc(filePath, fileType) {
  return new Promise(function (resolve, reject) {
    const opts = {
      filePath: filePath,
      showMenu: true,
      success: function () {
        resolve()
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '打开失败'))
      },
    }
    if (fileType) opts.fileType = fileType
    uni.openDocument(opts)
  })
}

function friendlyResumeErr(err) {
  const msg = (err && (err.message || err.errMsg)) || ''
  if (
    msg.indexOf('503003') >= 0 ||
    msg.indexOf('not exists') >= 0 ||
    msg.indexOf('empty download') >= 0 ||
    msg.indexOf('STORAGE_FILE') >= 0 ||
    msg.indexOf('获取播放地址') >= 0 ||
    msg.indexOf('获取临时链接') >= 0
  ) {
    return '云文件不存在或无权限，请检查 resume/ 上传与存储权限'
  }
  return msg || '打开失败'
}

/** 下载并预览 / 打开（Word 无法进相册，靠系统菜单另存） */
export async function openResumeDoc(item) {
  const fid = getResumeFileID(item)
  if (!fid) throw new Error('缺少文件')
  let url = ''
  try {
    url = await getPlayUrl(fid)
  } catch (err) {
    throw new Error(friendlyResumeErr(err))
  }
  if (!url) {
    throw new Error('云文件不存在或无权限，请检查 resume/ 上传与存储权限')
  }
  let local = ''
  try {
    local = await downloadToTemp(url)
  } catch (err) {
    throw new Error(friendlyResumeErr(err))
  }
  const ext = (item && item.ext) || ''
  const fileType = ext === 'docx' || ext === 'doc' ? ext : ''
  await openLocalDoc(local, fileType)
}
