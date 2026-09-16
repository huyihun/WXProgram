/**
 * AI 闲聊 / 生活百科
 *
 * 云函数：zhipuChat / minimaxChat（密钥仅存环境变量）
 * 默认大模型写入集合 ai_prefs（仅创建者可读写）
 *
 * 使用前请在云开发控制台创建集合：
 * - ai_prefs（字段 defaultProvider: zhipu | minimax）
 */
const COL = 'ai_prefs'
const LOCAL_KEY = 'ai_default_provider_v1'
const DEFAULT_PROVIDER = 'zhipu'

export const AI_PROVIDERS = [
  { id: 'zhipu', label: '智谱 5.3' },
  { id: 'minimax', label: 'MiniMax' },
]

function normalizeProvider(id) {
  if (id === 'minimax') return 'minimax'
  return 'zhipu'
}

function readLocalProvider() {
  try {
    const v = uni.getStorageSync(LOCAL_KEY)
    if (v === 'zhipu' || v === 'minimax') return v
  } catch (e) {
    // ignore
  }
  return ''
}

function writeLocalProvider(id) {
  try {
    uni.setStorageSync(LOCAL_KEY, id)
  } catch (e) {
    // ignore
  }
}

function getDb() {
  return wx.cloud.database()
}

/** 读默认大模型：本地缓存优先，再拉云；无记录则智谱 */
export async function getAiDefaultProvider() {
  const local = readLocalProvider()
  if (local) {
    // 后台再同步一次，不挡 UI
    syncProviderFromCloud().catch(function () {})
    return local
  }
  try {
    const fromCloud = await syncProviderFromCloud()
    if (fromCloud) return fromCloud
  } catch (err) {
    console.error('读取 AI 默认模型失败', err)
  }
  return DEFAULT_PROVIDER
}

async function syncProviderFromCloud() {
  const db = getDb()
  const res = await db.collection(COL).limit(1).get()
  const row = res.data && res.data[0]
  if (!row || !row.defaultProvider) return ''
  const id = normalizeProvider(row.defaultProvider)
  writeLocalProvider(id)
  return id
}

/** 切换并持久化为默认大模型 */
export async function setAiDefaultProvider(provider) {
  const id = normalizeProvider(provider)
  writeLocalProvider(id)
  const db = getDb()
  const now = Date.now()
  const res = await db.collection(COL).limit(1).get()
  const row = res.data && res.data[0]
  if (row && row._id) {
    await db.collection(COL).doc(row._id).update({
      data: { defaultProvider: id, updatedAt: now },
    })
    return id
  }
  await db.collection(COL).add({
    data: { defaultProvider: id, createdAt: now, updatedAt: now },
  })
  return id
}

export async function chatWithAi(messages, provider, imageOpts) {
  const opts = imageOpts || {}
  const hasImage = !!(opts.imageBase64 || opts.localPath)
  const id = normalizeProvider(provider)
  if (hasImage && id === 'minimax') {
    throw new Error('当前模型暂不支持图片，请切换到智谱')
  }

  let imageBase64 = opts.imageBase64 || ''
  const imageMime = opts.mime || 'image/jpeg'
  if (!imageBase64 && opts.localPath) {
    imageBase64 = await readFileBase64(opts.localPath)
  }

  const name = id === 'minimax' ? 'minimaxChat' : 'zhipuChat'
  const data = { messages: messages || [] }
  if (imageBase64) {
    data.imageBase64 = imageBase64
    data.imageMime = imageMime
  }
  if (opts.mode) data.mode = opts.mode
  if (opts.personaText) data.personaText = String(opts.personaText).slice(0, 6000)
  if (opts.statusText) data.statusText = String(opts.statusText).slice(0, 3000)
  if (opts.memoryDigest) data.memoryDigest = String(opts.memoryDigest).slice(0, 6000)
  if (opts.avatarDesc) data.avatarDesc = String(opts.avatarDesc).slice(0, 1000)
  if (opts.styleText) data.styleText = String(opts.styleText).slice(0, 2000)

  let res
  try {
    res = await wx.cloud.callFunction({
      name: name,
      data: data,
    })
  } catch (e) {
    const raw = (e && (e.message || e.errMsg)) || '云函数调用失败'
    const err = new Error(raw)
    err.code = /敏感|不安全|安全|审核|content/i.test(raw) ? 'CONTENT_FILTER' : ''
    throw err
  }

  const body = (res && res.result) || {}
  if (!body.ok) {
    const raw = body.message || body.errMsg || '对话失败'
    const err = new Error(raw)
    err.code = body.code || (/敏感|不安全|安全|审核|content/i.test(raw) ? 'CONTENT_FILTER' : '')
    throw err
  }
  const reply = body.reply != null ? String(body.reply).trim() : ''
  if (!reply) {
    throw new Error('模型未返回内容')
  }
  return reply
}

/** 气泡用完整短说明；toast 另用 toastTitle 防超长静默失败 */
export function formatAiChatError(err) {
  const msg = (err && (err.message || err.errMsg)) || ''
  const code = (err && err.code) || ''
  if (code === 'CONTENT_FILTER' || /敏感|不安全|安全|审核|content/i.test(msg)) {
    return {
      tip: '内容未通过安全审核，请换个说法，或切换到 MiniMax 再试',
      toast: '未通过安全审核',
    }
  }
  if (!msg) {
    return { tip: '传问失败，请稍后重试', toast: '传问失败' }
  }
  const tip = msg.length > 60 ? msg.slice(0, 60) + '…' : msg
  const toast = tip.length > 14 ? tip.slice(0, 14) + '…' : tip
  return { tip: tip, toast: toast }
}

function readFileBase64(filePath) {
  return new Promise(function (resolve, reject) {
    if (!filePath) {
      resolve('')
      return
    }
    uni.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: function (res) {
        resolve((res && res.data) || '')
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '读取图片失败'))
      },
    })
  })
}

/** @deprecated 使用 chatWithAi */
export async function chatWithZhipu(messages) {
  return chatWithAi(messages, 'zhipu')
}
