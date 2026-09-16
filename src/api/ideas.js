/**
 * 赚钱合集：拉目录、拉正文 JSON；PDF 回退系统打开
 */
import { getPlayUrl } from '@/utils/playlist'
import {
  getIdeasCatalogFileID,
  getIdeasItemFileID,
  getIdeasPdfFileID,
} from '@/utils/ideasCatalog'

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

export async function fetchIdeasCatalog(force) {
  if (!force && catalogCache) return catalogCache
  const data = await fetchJsonByCloud(getIdeasCatalogFileID())
  catalogCache = {
    title: (data && data.title) || '赚钱合集',
    categories: (data && data.categories) || [],
    items: (data && data.items) || [],
  }
  return catalogCache
}

export async function fetchIdeaDoc(item) {
  const fid = getIdeasItemFileID(item)
  if (!fid) throw new Error('缺少文件')
  return fetchJsonByCloud(fid)
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
        reject(new Error((err && err.errMsg) || '下载失败'))
      },
    })
  })
}

/** PDF 回退：换链下载后系统打开 */
export async function openIdeaPdf(item) {
  const fid = getIdeasPdfFileID(item)
  if (!fid) throw new Error('无 PDF 文件')
  const url = await getPlayUrl(fid)
  if (!url) throw new Error('获取链接失败')
  const local = await downloadToTemp(url)
  return new Promise(function (resolve, reject) {
    uni.openDocument({
      filePath: local,
      fileType: 'pdf',
      showMenu: true,
      success: function () {
        resolve()
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '打开失败'))
      },
    })
  })
}
