/**
 * 胡神分身：人设 / 形象 / 状态 / 记忆
 *
 * 云开发控制台创建集合「仅创建者可读写」：
 * - ai_twin（kind: persona | avatar | status | memory | chat）
 *
 * 单次 get 最多 20 条；列表必须 skip 循环拉全。
 */

const db = wx.cloud.database()
const BATCH = 20
const COL = 'ai_twin'

async function fetchAllWhere(where, orderField, orderDir) {
  const all = []
  let skip = 0
  while (true) {
    let query = db.collection(COL).where(where)
    if (orderField) {
      query = query.orderBy(orderField, orderDir || 'desc')
    }
    const res = await query.skip(skip).limit(BATCH).get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) {
      all.push(batch[i])
    }
    if (batch.length < BATCH) break
    skip += BATCH
  }
  return all
}

async function getSingleton(kind) {
  const res = await db.collection(COL).where({ kind: kind }).limit(1).get()
  return (res.data && res.data[0]) || null
}

async function upsertSingleton(kind, fields) {
  const now = Date.now()
  const row = await getSingleton(kind)
  const data = Object.assign({}, fields, { kind: kind, updatedAt: now })
  if (row && row._id) {
    await db.collection(COL).doc(row._id).update({ data: data })
    return Object.assign({}, row, data, { _id: row._id })
  }
  data.createdAt = now
  const res = await db.collection(COL).add({ data: data })
  return Object.assign({}, data, { _id: res._id })
}

export function emptyPersona() {
  return {
    appearance: '',
    personality: '',
    speechStyle: '',
    values: '',
    boundaries: '',
    goals: '',
    bio: '',
  }
}

export function emptyStatus() {
  return {
    nowDoing: '',
    innerThought: '',
    nextActions: '',
    sleepHabit: '',
    dietHabit: '',
    workHabit: '',
    syncAt: 0,
  }
}

/** 状态超过此时长视为可能过时（12h） */
const STATUS_STALE_MS = 12 * 60 * 60 * 1000
/** 非 profile 记忆按相关度取条数 */
const MEMORY_REST_TOP = 14
/** digest 总条数上限（含 profile） */
const MEMORY_DIGEST_MAX = 25

export function emptyAvatar() {
  return {
    mainFileID: '',
    fileIDs: [],
  }
}

/** 数码宝贝风五阶：等级达到 minLevel 进入该阶 */
export const TWIN_STAGES = [
  { id: 'baby', label: '幼年期', minLevel: 1 },
  { id: 'child', label: '成长期', minLevel: 3 },
  { id: 'adult', label: '成熟期', minLevel: 6 },
  { id: 'perfect', label: '完全体', minLevel: 10 },
  { id: 'ultimate', label: '究极体', minLevel: 15 },
]

export function stageForLevel(level) {
  const lv = Math.max(1, Number(level) || 1)
  let stage = TWIN_STAGES[0]
  for (let i = 0; i < TWIN_STAGES.length; i++) {
    if (lv >= TWIN_STAGES[i].minLevel) stage = TWIN_STAGES[i]
  }
  return stage
}

/** 灵气 = 20 + min(180, 字数/20)，单次 20~200 */
export function calcFeedExp(chars) {
  const n = Math.max(0, Number(chars) || 0)
  return 20 + Math.min(180, Math.floor(n / 20))
}

/** 升到下一级所需灵气 */
export function expToNext(level) {
  return 250 * Math.max(1, Number(level) || 1)
}

export function emptyGrowth() {
  return {
    level: 1,
    exp: 0,
    totalFeeds: 0,
    totalChars: 0,
  }
}

/** 把人设拼成注入模型的文本 */
export function formatPersonaText(persona) {
  const p = persona || emptyPersona()
  const lines = []
  if (p.bio) lines.push('简介：' + p.bio)
  if (p.appearance) lines.push('外貌：' + p.appearance)
  if (p.personality) lines.push('性格：' + p.personality)
  if (p.speechStyle) lines.push('说话语气：' + p.speechStyle)
  if (p.values) lines.push('价值观：' + p.values)
  if (p.boundaries) lines.push('底线：' + p.boundaries)
  if (p.goals) lines.push('目标感：' + p.goals)
  return lines.join('\n')
}

/** 北京时间下的年月日数字，用于跨日判断 */
function beijingYmd(ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(ts || Date.now()))
  const map = {}
  for (let i = 0; i < parts.length; i++) {
    map[parts[i].type] = parts[i].value
  }
  return (map.year || '') + '-' + (map.month || '') + '-' + (map.day || '')
}

function formatSyncAge(syncAt) {
  const t = Number(syncAt) || 0
  if (!t) return '未知（久未同步）'
  const ago = Date.now() - t
  if (ago < 0) return '刚刚'
  const min = Math.floor(ago / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + ' 分钟前'
  const hour = Math.floor(min / 60)
  if (hour < 48) return hour + ' 小时前'
  return Math.floor(hour / 24) + ' 天前'
}

/** 今晚/今天类行程是否已跨自然日（相对 syncAt） */
function isSameDayPlanStale(nextActions, syncAt) {
  const text = (nextActions || '').trim()
  if (!text || !/今晚|今天|今日/.test(text)) return false
  const t = Number(syncAt) || 0
  if (!t) return true
  return beijingYmd(t) !== beijingYmd(Date.now())
}

/** 问候/提醒用：行程是否仍可信 */
export function isStatusPlanFresh(status) {
  const s = status || emptyStatus()
  if (!(s.nextActions || '').trim()) return false
  const syncAt = Number(s.syncAt) || 0
  if (!syncAt || Date.now() - syncAt > STATUS_STALE_MS) return false
  if (isSameDayPlanStale(s.nextActions, syncAt)) return false
  return true
}

export function formatStatusText(status) {
  const s = status || emptyStatus()
  const syncAt = Number(s.syncAt) || 0
  const stale = !syncAt || Date.now() - syncAt > STATUS_STALE_MS
  const planStale = isSameDayPlanStale(s.nextActions, syncAt)
  const lines = []
  lines.push('状态同步：' + formatSyncAge(syncAt))
  if (stale || planStale) {
    lines.push(
      '时效提示：以下行程/此刻状态可能过时；不确定时说不知道，禁止当成正在发生'
    )
  }
  if (s.nowDoing) lines.push('此刻在做：' + s.nowDoing)
  if (s.innerThought) lines.push('心理活动：' + s.innerThought)
  if (s.nextActions && !planStale) {
    lines.push('接下来要做：' + s.nextActions)
  } else if (s.nextActions && planStale) {
    lines.push('（过期行程，勿引用）' + s.nextActions)
  }
  if (s.sleepHabit) lines.push('作息：' + s.sleepHabit)
  if (s.dietHabit) lines.push('饮食：' + s.dietHabit)
  if (s.workHabit) lines.push('工作：' + s.workHabit)
  return lines.join('\n')
}

/** 从查询句切出 2 字以上片段，用于记忆打分 */
function queryTokens(queryText) {
  const raw = String(queryText || '')
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, ' ')
    .trim()
  if (!raw) return []
  const parts = raw.split(/\s+/)
  const tokens = []
  const seen = {}
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p.length >= 2 && !seen[p]) {
      seen[p] = true
      tokens.push(p)
    }
  }
  // 中文连续串再切 2-gram，提高短句命中
  const cn = raw.replace(/[A-Za-z0-9\s]/g, '')
  for (let i = 0; i + 1 < cn.length; i++) {
    const g = cn.slice(i, i + 2)
    if (!seen[g]) {
      seen[g] = true
      tokens.push(g)
    }
  }
  return tokens
}

function scoreMemory(mem, tokens) {
  const text = (mem && mem.text) || ''
  if (!text) return 0
  let score = 0
  for (let i = 0; i < tokens.length; i++) {
    if (text.indexOf(tokens[i]) >= 0) score += tokens[i].length >= 3 ? 3 : 2
  }
  if (/纠正|记住|记一下|不是|而是/.test(text)) score += 2
  if (mem.tag && mem.tag !== 'profile' && mem.tag !== 'feed') score += 1
  return score
}

/**
 * 按当前问题选记忆：profile 全保留 + 其余相关度 TopN
 * query 为空时：profile + 按 createdAt 最新若干条
 */
export function selectMemoryDigest(memories, queryText) {
  const arr = memories || []
  const profile = []
  const rest = []
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i]
    if (!m || !m.text) continue
    if (m.tag === 'profile') profile.push(m)
    else rest.push(m)
  }

  const tokens = queryTokens(queryText)
  let pickedRest = []
  if (!tokens.length) {
    pickedRest = rest.slice(0, MEMORY_REST_TOP)
  } else {
    const scored = []
    for (let i = 0; i < rest.length; i++) {
      scored.push({ m: rest[i], score: scoreMemory(rest[i], tokens) })
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score
      return (b.m.createdAt || 0) - (a.m.createdAt || 0)
    })
    const withHit = []
    for (let i = 0; i < scored.length; i++) {
      if (scored[i].score > 0) withHit.push(scored[i].m)
      if (withHit.length >= MEMORY_REST_TOP) break
    }
    if (withHit.length) {
      pickedRest = withHit
    } else {
      pickedRest = rest.slice(0, MEMORY_REST_TOP)
    }
  }

  const room = Math.max(0, MEMORY_DIGEST_MAX - profile.length)
  if (pickedRest.length > room) pickedRest = pickedRest.slice(0, room)
  return formatMemoryDigest(profile.concat(pickedRest), MEMORY_DIGEST_MAX)
}

export function formatMemoryDigest(list, maxN) {
  const arr = list || []
  if (!arr.length) return ''
  // profile 资料记忆排前，避免被投喂摘要挤出注入窗口
  const profile = []
  const rest = []
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i]
    if (!m || !m.text) continue
    if (m.tag === 'profile') profile.push(m)
    else rest.push(m)
  }
  const ordered = profile.concat(rest)
  const cap = maxN != null ? maxN : 40
  const lines = []
  const n = Math.min(ordered.length, cap)
  for (let i = 0; i < n; i++) {
    lines.push('- ' + ordered[i].text)
  }
  return lines.join('\n')
}

export async function getPersona() {
  const row = await getSingleton('persona')
  if (!row) return emptyPersona()
  return Object.assign(emptyPersona(), {
    appearance: row.appearance || '',
    personality: row.personality || '',
    speechStyle: row.speechStyle || '',
    values: row.values || '',
    boundaries: row.boundaries || '',
    goals: row.goals || '',
    bio: row.bio || '',
    _id: row._id,
  })
}

export async function savePersona(fields) {
  return upsertSingleton('persona', {
    appearance: (fields && fields.appearance) || '',
    personality: (fields && fields.personality) || '',
    speechStyle: (fields && fields.speechStyle) || '',
    values: (fields && fields.values) || '',
    boundaries: (fields && fields.boundaries) || '',
    goals: (fields && fields.goals) || '',
    bio: (fields && fields.bio) || '',
  })
}

export async function getAvatar() {
  const row = await getSingleton('avatar')
  if (!row) return emptyAvatar()
  return {
    mainFileID: row.mainFileID || '',
    fileIDs: row.fileIDs || [],
    _id: row._id,
  }
}

export async function saveAvatar(fields) {
  const fileIDs = (fields && fields.fileIDs) || []
  let main = (fields && fields.mainFileID) || ''
  if (!main && fileIDs.length) main = fileIDs[0]
  return upsertSingleton('avatar', {
    mainFileID: main,
    fileIDs: fileIDs,
  })
}

/** 上传本地图片到云存储 twin/，返回 fileID */
export function uploadTwinImage(localPath) {
  return new Promise(function (resolve, reject) {
    if (!localPath) {
      reject(new Error('无图片'))
      return
    }
    const name =
      'twin/' +
      Date.now() +
      '_' +
      Math.floor(Math.random() * 10000) +
      '.jpg'
    wx.cloud.uploadFile({
      cloudPath: name,
      filePath: localPath,
      success: function (res) {
        if (res && res.fileID) {
          resolve(res.fileID)
          return
        }
        reject(new Error('上传失败'))
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '上传失败'))
      },
    })
  })
}

export async function getStatus() {
  const row = await getSingleton('status')
  if (!row) return emptyStatus()
  return Object.assign(emptyStatus(), {
    nowDoing: row.nowDoing || '',
    innerThought: row.innerThought || '',
    nextActions: row.nextActions || '',
    sleepHabit: row.sleepHabit || '',
    dietHabit: row.dietHabit || '',
    workHabit: row.workHabit || '',
    syncAt: row.syncAt || row.updatedAt || 0,
    _id: row._id,
  })
}

export async function saveStatus(fields) {
  return upsertSingleton('status', {
    nowDoing: (fields && fields.nowDoing) || '',
    innerThought: (fields && fields.innerThought) || '',
    nextActions: (fields && fields.nextActions) || '',
    sleepHabit: (fields && fields.sleepHabit) || '',
    dietHabit: (fields && fields.dietHabit) || '',
    workHabit: (fields && fields.workHabit) || '',
    syncAt: Date.now(),
  })
}

export async function listMemories() {
  return fetchAllWhere({ kind: 'memory' }, 'createdAt', 'desc')
}

export async function addMemory(text, tag, qid) {
  const t = (text || '').trim()
  if (!t) throw new Error('请输入记忆内容')
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: {
      kind: 'memory',
      text: t.slice(0, 2000),
      tag: tag || '',
      qid: qid || '',
      createdAt: now,
      updatedAt: now,
    },
  })
  return {
    _id: res._id,
    kind: 'memory',
    text: t.slice(0, 2000),
    tag: tag || '',
    qid: qid || '',
    createdAt: now,
  }
}

function isCorrectionText(text) {
  return /不是|而是|纠正|改成|其实|记一下|记住|别记错/.test(text || '')
}

/** 粗相关：共享足够多 2-gram 则视为同题旧记忆 */
function memoriesLikelySameTopic(a, b) {
  const ta = String(a || '')
  const tb = String(b || '')
  if (!ta || !tb) return false
  if (ta === tb) return true
  const grams = {}
  let n = 0
  for (let i = 0; i + 1 < ta.length; i++) {
    const g = ta.slice(i, i + 2)
    if (!grams[g]) {
      grams[g] = true
      n += 1
    }
  }
  if (n < 4) return ta.length >= 6 && tb.indexOf(ta.slice(0, Math.min(6, ta.length))) >= 0
  let hit = 0
  for (let i = 0; i + 1 < tb.length; i++) {
    if (grams[tb.slice(i, i + 2)]) hit += 1
  }
  return hit >= Math.min(6, Math.floor(n * 0.35))
}

/** 相同文案不重复写入；纠正类会删掉同题旧记忆后再写 */
export async function addMemoryUnique(text, existingList) {
  const t = (text || '').trim().slice(0, 2000)
  if (!t) return null
  const list = existingList || []
  for (let i = 0; i < list.length; i++) {
    if ((list[i].text || '').trim() === t) return null
  }
  if (isCorrectionText(t)) {
    for (let i = 0; i < list.length; i++) {
      const m = list[i]
      if (!m || !m._id || m.tag === 'profile') continue
      if (memoriesLikelySameTopic(t, m.text)) {
        try {
          await db.collection(COL).doc(m._id).remove()
        } catch (err) {
          console.warn('覆盖旧记忆失败', err)
        }
      }
    }
  }
  return addMemory(t)
}

/** 同 tag 记忆只保留最新一条（生活数据重复投喂时覆盖旧条），返回 { mem, removed } */
export async function replaceTaggedMemory(text, tag, existingList) {
  const t = (text || '').trim().slice(0, 2000)
  if (!t || !tag) return null
  const list = existingList || []
  const removed = []
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].tag === tag && list[i]._id) removed.push(list[i])
  }
  for (let i = 0; i < removed.length; i++) {
    try {
      await db.collection(COL).doc(removed[i]._id).remove()
    } catch (err) {
      console.warn('删除旧记忆失败', err)
    }
  }
  const mem = await addMemory(t, tag)
  return { mem: mem, removed: removed }
}

export async function removeMemory(id) {
  if (!id) return
  await db.collection(COL).doc(id).remove()
}

/** 落库软顶：防微信单文档体积打满；正常远碰不到。调模型窗口另见 twinChat */
const CHAT_SOFT_MAX = 2000

export async function loadChat() {
  const row = await getSingleton('chat')
  if (!row || !row.messages || !row.messages.length) return []
  const out = []
  for (let i = 0; i < row.messages.length; i++) {
    const m = row.messages[i]
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    const content = m.content != null ? String(m.content) : ''
    if (!content) continue
    const item = { role: m.role, content: content }
    if (m.at) item.at = m.at
    out.push(item)
  }
  return out
}

export async function saveChat(messages) {
  const list = messages || []
  const trimmed = []
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    const content = m.content != null ? String(m.content).trim() : ''
    if (!content) continue
    const item = { role: m.role, content: content.slice(0, 4000) }
    if (m.at) item.at = m.at
    trimmed.push(item)
  }
  // 仅软顶裁最旧，展示/落库默认保留完整历史
  const start = trimmed.length > CHAT_SOFT_MAX ? trimmed.length - CHAT_SOFT_MAX : 0
  const kept = start > 0 ? trimmed.slice(start) : trimmed
  // 清空对话时重置自动投喂游标
  if (!kept.length) {
    return upsertSingleton('chat', {
      messages: [],
      feedCursorAt: 0,
      feedCursorIndex: -1,
    })
  }
  return upsertSingleton('chat', { messages: kept })
}

/** 自动投喂：用户条数 / 字数阈值 */
const AUTO_FEED_USER_TURNS = 8
const AUTO_FEED_MIN_CHARS = 120
const CHAT_FEED_MAX_CHARS = 20000

export function emptyChatFeedCursor() {
  return { at: 0, index: -1 }
}

export async function getChatFeedCursor() {
  const row = await getSingleton('chat')
  if (!row) return emptyChatFeedCursor()
  return {
    at: Number(row.feedCursorAt) || 0,
    index: row.feedCursorIndex != null ? Number(row.feedCursorIndex) : -1,
  }
}

export async function setChatFeedCursor(cursor) {
  const c = cursor || emptyChatFeedCursor()
  return upsertSingleton('chat', {
    feedCursorAt: Number(c.at) || 0,
    feedCursorIndex: c.index != null ? Number(c.index) : -1,
  })
}

function isSkipChatFeedContent(content) {
  const t = (content || '').trim()
  return !t || t === '（附图）'
}

/** 游标之后的消息（优先 at，否则 index） */
function sliceMessagesAfterCursor(messages, cursor) {
  const list = messages || []
  const cur = cursor || emptyChatFeedCursor()
  const out = []
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    if (!m) continue
    const at = Number(m.at) || 0
    if (cur.at > 0 && at > 0) {
      if (at <= cur.at) continue
    } else if (cur.index >= 0) {
      if (i <= cur.index) continue
    }
    out.push({ msg: m, index: i })
  }
  return out
}

/** 把未投喂窗口拼成投喂文本 */
export function buildChatFeedText(messages, cursor) {
  const slice = sliceMessagesAfterCursor(messages, cursor)
  const lines = []
  let userCount = 0
  let userChars = 0
  let lastIndex = -1
  let lastAt = 0
  for (let i = 0; i < slice.length; i++) {
    const m = slice[i].msg
    const idx = slice[i].index
    const content = (m.content || '').trim()
    if (isSkipChatFeedContent(content)) continue
    if (m.role === 'user') {
      lines.push('【我】' + content)
      userCount += 1
      userChars += content.length
    } else if (m.role === 'assistant') {
      lines.push('【分身】' + content)
    } else {
      continue
    }
    lastIndex = idx
    if (m.at) lastAt = Number(m.at) || lastAt
  }
  let text = lines.join('\n')
  if (text.length > CHAT_FEED_MAX_CHARS) text = text.slice(0, CHAT_FEED_MAX_CHARS)
  return {
    text: text,
    userCount: userCount,
    userChars: userChars,
    nextCursor: {
      at: lastAt || (cursor && cursor.at) || 0,
      index: lastIndex,
    },
  }
}

export function shouldAutoFeedChat(messages, cursor) {
  const built = buildChatFeedText(messages, cursor)
  return (
    built.userCount >= AUTO_FEED_USER_TURNS &&
    built.userChars >= AUTO_FEED_MIN_CHARS &&
    !!built.text
  )
}

/** 像事实/纠正（非纯短问句）时返回 true，用于自动写入长期记忆 */
export function looksLikeFactOrCorrection(text) {
  const t = (text || '').trim()
  if (!t || t.length < 4) return false
  const isQuestion = /[？?]$/.test(t) || /^(谁|什么|哪|几|吗|么|怎么|如何|为啥|为什么)/.test(t)
  if (isQuestion && t.length < 12 && !/不是|纠正|记住|记一下/.test(t)) return false
  if (/不是|而是|纠正|记一下|记住|每周|每天|每周五|今晚|安排|出去|改成|其实/.test(t)) {
    return true
  }
  if (!isQuestion && t.length >= 8) return true
  return false
}

/** 含今晚/周五/安排等时，适合写入 status.nextActions */
export function shouldUpdateNextActions(text) {
  const t = (text || '').trim()
  if (!t) return false
  if (/[？?]$/.test(t) && t.length < 16) return false
  return /今晚|今天|今日|明天|周五|星期六|周日|安排|计划|要去|出去/.test(t)
}

/** 含「在忙/正在/我在…」等，适合写入 status.nowDoing */
export function shouldUpdateNowDoing(text) {
  const t = (text || '').trim()
  if (!t || t.length < 3) return false
  if (/[？?]$/.test(t)) return false
  return /在忙|正在|我在|此刻|这会儿|这会|手头|忙着/.test(t)
}

/** 结束当前状态类说法 → 清空 nowDoing */
export function shouldClearNowDoing(text) {
  const t = (text || '').trim()
  if (!t) return false
  return /没事了|结束了|到家了|搞定了|忙完了|弄完了|下班了|睡了|休息了/.test(t)
}

/** 云函数消化：text 直接送，文件/图片先传云存储再传 fileID */
export async function digestTwinMaterial(payload) {
  const data = {}
  if (payload && payload.text) data.text = String(payload.text).slice(0, 30000)
  if (payload && payload.fileID) data.fileID = payload.fileID
  const res = await wx.cloud.callFunction({ name: 'twinFeed', data: data })
  const body = (res && res.result) || {}
  if (!body.ok) {
    throw new Error(body.message || '消化失败')
  }
  return {
    chars: body.chars || 0,
    summary: String(body.summary || '').trim(),
    sourceType: body.sourceType || (data.text ? 'text' : 'file'),
  }
}

export async function listFeeds() {
  return fetchAllWhere({ kind: 'feed' }, 'fedAt', 'desc')
}

export async function addFeedRecord(info) {
  const now = Date.now()
  const fedAt = (info && info.fedAt) || now
  const data = {
    kind: 'feed',
    title: String((info && info.title) || '未命名食粮').slice(0, 60),
    sourceType: (info && info.sourceType) || 'text',
    fileName: String((info && info.fileName) || '').slice(0, 120),
    chars: (info && info.chars) || 0,
    exp: (info && info.exp) || 0,
    summary: String((info && info.summary) || '').slice(0, 1000),
    fedAt: fedAt,
    createdAt: now,
  }
  const res = await db.collection(COL).add({ data: data })
  return Object.assign({ _id: res._id }, data)
}

export async function removeFeed(id) {
  if (!id) return
  await db.collection(COL).doc(id).remove()
}

export async function getGrowth() {
  const row = await getSingleton('growth')
  if (!row) return emptyGrowth()
  return Object.assign(emptyGrowth(), {
    level: row.level || 1,
    exp: row.exp || 0,
    totalFeeds: row.totalFeeds || 0,
    totalChars: row.totalChars || 0,
    _id: row._id,
  })
}

/** 入账灵气并结算升级；返回是否升级/进阶 */
export async function addGrowthExp(gain, chars) {
  const g = await getGrowth()
  const prevStage = stageForLevel(g.level)
  let level = g.level
  let exp = g.exp + (Number(gain) || 0)
  while (exp >= expToNext(level)) {
    exp -= expToNext(level)
    level += 1
  }
  const nextStage = stageForLevel(level)
  const saved = await upsertSingleton('growth', {
    level: level,
    exp: exp,
    totalFeeds: (g.totalFeeds || 0) + 1,
    totalChars: (g.totalChars || 0) + (Number(chars) || 0),
  })
  return {
    level: level,
    exp: exp,
    totalFeeds: (g.totalFeeds || 0) + 1,
    totalChars: (g.totalChars || 0) + (Number(chars) || 0),
    _id: saved._id,
    levelUp: level > g.level,
    stageUp: nextStage.id !== prevStage.id,
    stage: nextStage,
  }
}

/** 选图 → 上传云存储 → 存为分身当前形象，返回可展示的 fileID */
export async function uploadTwinAvatar(localPath) {
  const fileID = await uploadTwinImage(localPath)
  const cur = await getAvatar()
  const fileIDs = (cur.fileIDs || []).slice()
  fileIDs.unshift(fileID)
  await saveAvatar({ mainFileID: fileID, fileIDs: fileIDs.slice(0, 12) })
  return fileID
}
