/**
 * 游戏相关 API 薄封装
 * 人生重开大数据在分包 pages/game/lifeRestart/loadData.js
 *
 * 云路径：game/catalog.json（可选）
 *         game/lifeRestart/zh-cn/*.json
 */
const CLOUD_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/game/'

const cache = {}

function fileId(relPath) {
  return CLOUD_PREFIX + relPath
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

async function loadGameCatalog() {
  if (cache.catalog) return cache.catalog
  try {
    const data = await fetchJsonByCloud(fileId('catalog.json'))
    cache.catalog = data
    return data
  } catch (e) {
    cache.catalog = {
      games: [{ id: 'lifeRestart', name: '人生重开模拟器' }],
    }
    return cache.catalog
  }
}

export { CLOUD_PREFIX, loadGameCatalog }
