/**
 * 分身对话共享大脑：舞台场景内聊天与 AiChatSheet 面板共用
 * 同一套上下文（人设/状态/记忆/语气/形象协议）与云端历史（loadChat/saveChat）
 */
import { chatWithAi } from '@/api/aiChat'
import {
  addMemoryUnique,
  getAvatar,
  getPersona,
  getStatus,
  listMemories,
  loadChat,
  saveChat,
  saveStatus,
  formatPersonaText,
  formatStatusText,
  formatMemoryDigest,
  looksLikeFactOrCorrection,
  shouldUpdateNextActions,
} from '@/api/aiTwin'
import { buildStyleText } from '@/api/twinProfile'

export const AVATAR_PROTOCOL =
  '你有一张当前形象照片。当用户想看你的照片、形象时，单独输出一行【展示形象】表示把照片发出去，其余文字照常。'

const AVATAR_MARKER_RE = /[\[【]展示形象[\]】]/

let avatarFileId = ''

/** 上下文构建 + 缓存形象 fileID（供【展示形象】标记转换用） */
export async function buildTwinContext() {
  const opts = { mode: 'twin' }
  try {
    const parts = await Promise.all([getPersona(), getStatus(), listMemories(), getAvatar()])
    opts.personaText = formatPersonaText(parts[0])
    opts.statusText = formatStatusText(parts[1])
    opts.memoryDigest = formatMemoryDigest(parts[2])
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

/** 事实/纠正写入长期记忆；行程写入状态（调用方 fire-and-forget 即可） */
export async function recordTwinFacts(text) {
  const t = (text || '').trim()
  if (!t) return
  try {
    if (looksLikeFactOrCorrection(t)) {
      const mem = await listMemories()
      await addMemoryUnique(t, mem)
    }
    if (shouldUpdateNextActions(t)) {
      const s = await getStatus()
      await saveStatus(Object.assign({}, s, { nextActions: t }))
    }
  } catch (err) {
    console.warn('分身记忆写入失败', err)
  }
}

/** 场景内发一句消息：云端历史 → 请求 → 回复 + 持久化，返回分身回复；
 * 传 localPath 时附带识图（客户端已压缩，chatWithAi 内部走 CDN 通道） */
export async function sendTwinText(text, localPath) {
  const t = (text || '').trim()
  const img = localPath || ''
  if (!t && !img) throw new Error('先写点什么')
  const msgs = (await loadChat()) || []
  msgs.push({ role: 'user', content: t || '（附图）' })
  if (t) recordTwinFacts(t)
  const ctx = await buildTwinContext()
  const opts = img ? Object.assign({ localPath: img, mime: 'image/jpeg' }, ctx) : ctx
  const raw = await chatWithAi(msgs, 'zhipu', opts)
  let reply = String(raw || '').trim()
  if (!reply) throw new Error('模型未返回内容')
  // 【展示形象】标记在场景内剔除，看照片去完整面板
  reply = applyAvatarMarker(reply).text
  msgs.push({ role: 'assistant', content: reply })
  try {
    await saveChat(msgs)
  } catch (err) {
    console.warn('分身对话保存失败', err)
  }
  return reply
}
