/**
 * 首页天气循环视频：云存储 fileID + 本地下载缓存
 * 经 getMusicUrl 换临时链，与飞龙/音乐同一套路
 *
 * 云存储目录：fx/
 * 注意：晴天文件名为 weather_suney.mp4（上传时拼写）
 */
import { getPlayUrl } from '@/utils/playlist'

/** kind → fileID（与云控制台一致） */
export const WEATHER_FX_FILE_IDS = {
  sunny:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/fx/weather_suney.mp4',
  cloudy:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/fx/weather_cloudy.mp4',
  rainy:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/fx/weather_rainy.mp4',
  snowy:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/fx/weather_snowy.mp4',
  fog:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/fx/weather_fog.mp4',
  storm:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/fx/weather_storm.mp4',
}

const memPathByKind = {}
const inflightByKind = {}

function getPersistPath(kind) {
  const root = (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) || ''
  if (!root) return ''
  return root + '/fx_weather_' + kind + '.mp4'
}

function hasLocalFile(path) {
  if (!path) return false
  try {
    uni.getFileSystemManager().accessSync(path)
    return true
  } catch (e) {
    return false
  }
}

function downloadToPath(url, filePath) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载天气视频失败 ' + (res.statusCode || '')))
          return
        }
        if (!filePath) {
          resolve(res.tempFilePath)
          return
        }
        try {
          uni.getFileSystemManager().saveFile({
            tempFilePath: res.tempFilePath,
            filePath: filePath,
            success: () => resolve(filePath),
            fail: () => resolve(res.tempFilePath),
          })
        } catch (e) {
          resolve(res.tempFilePath)
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '下载天气视频失败'
        if (String(msg).indexOf('url not in domain list') >= 0) {
          reject(new Error('需配置downloadFile域名'))
          return
        }
        reject(new Error(msg))
      },
    })
  })
}

async function ensureDownloaded(kind) {
  const fileID = WEATHER_FX_FILE_IDS[kind]
  if (!fileID) return ''

  if (memPathByKind[kind] && hasLocalFile(memPathByKind[kind])) {
    return memPathByKind[kind]
  }

  const persistPath = getPersistPath(kind)
  if (hasLocalFile(persistPath)) {
    memPathByKind[kind] = persistPath
    return persistPath
  }

  if (inflightByKind[kind]) return inflightByKind[kind]

  inflightByKind[kind] = (async () => {
    const url = await getPlayUrl(fileID)
    const path = await downloadToPath(url, persistPath)
    memPathByKind[kind] = path
    return path
  })()

  try {
    return await inflightByKind[kind]
  } finally {
    inflightByKind[kind] = null
  }
}

/** 预热某一天气片；失败静默 */
export async function warmWeatherFx(kind) {
  try {
    return await ensureDownloaded(kind)
  } catch (err) {
    console.error('预热天气视频失败', kind, err)
    return ''
  }
}

/** 取可播本地路径；未配置/下载失败则抛错或返回空由调用方回退 CSS */
export async function getWeatherFxLocalPath(kind) {
  return ensureDownloaded(kind)
}
