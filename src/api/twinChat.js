/**
 * 分身对话共享大脑：舞台场景内聊天与 AiChatSheet 面板共用
 * 同一套上下文（人设/状态/记忆/语气/形象协议）与云端历史（loadChat/saveChat）
 */
import { chatWithAi, getAiDefaultProvider } from '@/api/aiChat'
import {
  addFeedRecord,
  addGrowthExp,
  addMemoryUnique,
  buildChatFeedText,
  calcFeedExp,
  digestTwinMaterial,
  getAvatar,
  getChatFeedCursor,
  getPersona,
  getStatus,
  listMemories,
  loadChat,
  saveChat,
  saveStatus,
  setChatFeedCursor,
  shouldAutoFeedChat,
  formatPersonaText,
  formatStatusText,
  selectMemoryDigest,
  looksLikeFactOrCorrection,
  shouldUpdateNextActions,
  shouldUpdateNowDoing,
  shouldClearNowDoing,
} from '@/api/aiTwin'
import { buildStyleText } from '@/api/twinProfile'

export const AVATAR_PROTOCOL =
  '你有一张当前形象照片。当用户想看你的照片、形象时，单独输出一行【展示形象】表示把照片发出去，其余文字照常。'

const AVATAR_MARKER_RE = /[\[【]展示形象[\]】]/

let avatarFileId = ''
/** 手动投喂进行中时禁止自动投喂 */
let manualFeedBusy = false
/** 自动投喂互斥 */
let autoFeedBusy = false

/** 舞台手动投喂时调用，避免与自动投喂并行 */
export function setTwinManualFeedBusy(busy) {
  manualFeedBusy = !!busy
}

/**
 * 上下文构建 + 缓存形象 fileID（供【展示形象】标记转换用）
 * @param {string} [queryText] 本轮用户句，用于记忆相关检索
 */
export async function buildTwinContext(queryText) {
  const opts = { mode: 'twin' }
  try {
    const parts = await Promise.all([getPersona(), getStatus(), listMemories(), getAvatar()])
    opts.personaText = formatPersonaText(parts[0])
    opts.statusText = formatStatusText(parts[1])
    opts.memoryDigest = selectMemoryDigest(parts[2], queryText || '')
    opts.styleText = buildStyleText(parts[2])
    avatarFileId = parts[3] && parts[3].mainFileID ? parts[3].mainFileID : ''
    opts.avatarDesc = avatarFileId ? AVATAR_PROTOCOL : ''
  } catch (err) {
    console.warn('分身上下文加载失败', err)
  }
  return opts
}

/** 回复中的【展示形象】标记 → 剔除标记；有形象照时返回 fileID */
export function applyAvatarMarker(reply) {
  const text = String(reply || '')
  if (!AVATAR_MARKER_RE.test(text) || !avatarFileId) return { text: text, imageUrl: '' }
  const cleaned = text.replace(AVATAR_MARKER_RE, '').replace(/\n{2,}/g, '\n').trim()
  return { text: cleaned || '这就是我现在的形象。', imageUrl: avatarFileId }
}

/** 事实/纠正写入长期记忆；行程/此刻写入状态（调用方 fire-and-forget 即可） */
export async function recordTwinFacts(text) {
  const t = (text || '').trim()
  if (!t) return
  try {
    if (looksLikeFactOrCorrection(t)) {
      const mem = await listMemories()
      await addMemoryUnique(t, mem)
    }
    const needNext = shouldUpdateNextActions(t)
    const needNow = shouldUpdateNowDoing(t)
    const clearNow = shouldClearNowDoing(t)
    if (!needNext && !needNow && !clearNow) return
    const s = await getStatus()
    const patch = Object.assign({}, s)
    if (needNext) patch.nextActions = t
    if (needNow) patch.nowDoing = t
    if (clearNow) patch.nowDoing = ''
    await saveStatus(patch)
  } catch (err) {
    console.warn('分身记忆写入失败', err)
  }
}

/** 达量则消化未投喂窗口；失败返回 null，不抛到 UI */
async function maybeAutoFeedAfterChat(msgs) {
  if (autoFeedBusy || manualFeedBusy) return null
  const cursor = await getChatFeedCursor()
  if (!shouldAutoFeedChat(msgs, cursor)) return null
  const built = buildChatFeedText(msgs, cursor)
  if (!built.text) return null

  autoFeedBusy = true
  try {
    const digest = await digestTwinMaterial({ text: built.text })
    const exp = calcFeedExp(digest.chars)
    const memList = await listMemories()
    await addMemoryUnique(digest.summary, memList)
    await addFeedRecord({
      title: '聊天自动投喂',
      sourceType: 'chat_auto',
      chars: digest.chars,
      exp: exp,
      summary: digest.summary,
    })
    const g = await addGrowthExp(exp, digest.chars)
    await setChatFeedCursor(built.nextCursor)
    return {
      exp: exp,
      level: g.level,
      growthExp: g.exp,
      totalFeeds: g.totalFeeds,
      totalChars: g.totalChars,
      levelUp: g.levelUp,
      stageUp: g.stageUp,
      stage: g.stage,
    }
  } catch (err) {
    console.warn('自动投喂失败', err)
    return null
  } finally {
    autoFeedBusy = false
  }
}

/**
 * 场景内发一句：云端历史 → 请求 → 回复 + 持久化；
 * 返回 { reply, autoFeed }；传 localPath 时附带识图（CDN）
 */
export async function sendTwinText(text, localPath) {
  const t = (text || '').trim()
  const img = localPath || ''
  if (!t && !img) throw new Error('先写点什么')
  const msgs = (await loadChat()) || []
  const now = Date.now()
  msgs.push({ role: 'user', content: t || '（附图）', at: now })
  if (t) recordTwinFacts(t)
  // 落库用全量 msgs；调模型只用短窗口，避免 callFunction 过大
  const API_CTX_MAX = 40
  let opts
  let sendMsgs = msgs
  if (img) {
    opts = { localPath: img, mime: 'image/jpeg', mode: 'twin' }
    if (sendMsgs.length > 4) sendMsgs = sendMsgs.slice(sendMsgs.length - 4)
  } else {
    opts = await buildTwinContext(t)
    if (sendMsgs.length > API_CTX_MAX) {
      sendMsgs = sendMsgs.slice(sendMsgs.length - API_CTX_MAX)
    }
  }
  let provider = 'zhipu'
  try {
    provider = await getAiDefaultProvider()
  } catch (err) {
    // 回退智谱
  }
  if (img && provider === 'minimax') provider = 'zhipu'
  const raw = await chatWithAi(sendMsgs, provider, opts)
  let reply = String(raw || '').trim()
  if (!reply) throw new Error('模型未返回内容')
  // 【展示形象】标记在场景内剔除，看照片去完整面板
  reply = applyAvatarMarker(reply).text
  msgs.push({ role: 'assistant', content: reply, at: Date.now() })
  try {
    await saveChat(msgs)
  } catch (err) {
    console.warn('分身对话保存失败', err)
  }
  let autoFeed = null
  try {
    autoFeed = await maybeAutoFeedAfterChat(msgs)
  } catch (err) {
    console.warn('自动投喂检查失败', err)
  }
  return { reply: reply, autoFeed: autoFeed }
}
