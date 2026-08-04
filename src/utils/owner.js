/**
 * 主人身份：openid 白名单
 * 真机预览一次，从控制台复制 openid 填入 OWNER_OPENIDS
 *
 * 依赖云函数 login（需已上传部署）
 */
const OWNER_OPENIDS = [
  'o3VZC5RgtNM4gxj-BWWhHA2tsjWQ',
  // 例：'oXXXX...'
]

const STORAGE_KEY = 'owner_openid'
const LOG_OPENID = false

let cachedOpenId = ''
let cachedIsOwner = false
let loaded = false
let inflight = null

function inWhitelist(openid) {
  if (!openid || !OWNER_OPENIDS.length) return false
  return OWNER_OPENIDS.indexOf(openid) >= 0
}

function cloudApi() {
  if (typeof wx !== 'undefined' && wx.cloud) return wx.cloud
  if (typeof uni !== 'undefined' && uni.cloud) return uni.cloud
  return null
}

/** 同步：是否已判定为主人（未加载完前为 false） */
export function isOwnerSync() {
  return cachedIsOwner
}

export function getCachedOpenId() {
  return cachedOpenId
}

function callLogin() {
  const cloud = cloudApi()
  if (!cloud || typeof cloud.callFunction !== 'function') {
    return Promise.reject(new Error('云能力不可用'))
  }

  // 用回调包一层，避免部分端上 Promise 形态异常
  return new Promise((resolve, reject) => {
    cloud.callFunction({
      name: 'login',
      success: (res) => {
        const body = (res && res.result) || {}
        const openid = body.openid || (body.result && body.result.openid) || ''
        if (!openid) {
          reject(new Error('login 未返回 openid'))
          return
        }
        resolve(openid)
      },
      fail: (err) => {
        const msg = (err && (err.errMsg || err.message)) || 'login 调用失败'
        reject(new Error(msg))
      },
    })
  })
}

async function fetchOpenId() {
  if (cachedOpenId) return cachedOpenId
  try {
    const local = uni.getStorageSync(STORAGE_KEY)
    if (local) {
      cachedOpenId = local
      return cachedOpenId
    }
  } catch (e) {
    // ignore
  }

  const openid = await callLogin()
  cachedOpenId = openid
  try {
    uni.setStorageSync(STORAGE_KEY, openid)
  } catch (e) {
    // ignore
  }
  return cachedOpenId
}

/**
 * 拉取 openid 并刷新主人标记
 * 失败不抛错，返回 false，且允许下次重试
 */
export async function loadOwnerFlag() {
  if (loaded && cachedOpenId) return cachedIsOwner
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const openid = await fetchOpenId()
      if (LOG_OPENID) {
        console.log('[owner] 当前 openid（填入 OWNER_OPENIDS）:', openid)
      }
      cachedIsOwner = inWhitelist(openid)
      loaded = true
    } catch (err) {
      const msg = (err && (err.errMsg || err.message)) || String(err)
      console.warn('[owner] 身份加载失败', msg)
      // 常见：云函数 login 未部署 → FunctionName could not be found
      if (
        String(msg).indexOf('FUNCTION_NOT_FOUND') >= 0 ||
        String(msg).indexOf('FunctionName') >= 0
      ) {
        console.warn('[owner] 请在微信开发者工具上传并部署云函数 login')
      }
      cachedIsOwner = false
      loaded = false
    } finally {
      inflight = null
    }
    return cachedIsOwner
  })()

  return inflight
}

/** 确保有 openid（不强制主人判定） */
export async function ensureOpenId() {
  return fetchOpenId()
}
