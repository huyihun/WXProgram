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
  }
}

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

export function formatStatusText(status) {
  const s = status || emptyStatus()
  const lines = []
  if (s.nowDoing) lines.push('此刻在做：' + s.nowDoing)
  if (s.innerThought) lines.push('心理活动：' + s.innerThought)
  if (s.nextActions) lines.push('接下来要做：' + s.nextActions)
  if (s.sleepHabit) lines.push('作息：' + s.sleepHabit)
  if (s.dietHabit) lines.push('饮食：' + s.dietHabit)
  if (s.workHabit) lines.push('工作：' + s.workHabit)
  return lines.join('\n')
}

export function formatMemoryDigest(list) {
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
  const lines = []
  const n = Math.min(ordered.length, 40)
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

/** 相同文案不重复写入；已存在则返回 null */
export async function addMemoryUnique(text, existingList) {
  const t = (text || '').trim().slice(0, 2000)
  if (!t) return null
  const list = existingList || []
  for (let i = 0; i < list.length; i++) {
    if ((list[i].text || '').trim() === t) return null
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

const CHAT_MAX = 40

export async function loadChat() {
  const row = await getSingleton('chat')
  if (!row || !row.messages || !row.messages.length) return []
  const out = []
  for (let i = 0; i < row.messages.length; i++) {
    const m = row.messages[i]
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    const content = m.content != null ? String(m.content) : ''
    if (!content) continue
    out.push({ role: m.role, content: content })
  }
  return out
}

export async function saveChat(messages) {
  const list = messages || []
  const trimmed = []
  const start = list.length > CHAT_MAX ? list.length - CHAT_MAX : 0
  for (let i = start; i < list.length; i++) {
    const m = list[i]
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    const content = m.content != null ? String(m.content).trim() : ''
    if (!content) continue
    trimmed.push({ role: m.role, content: content.slice(0, 4000) })
  }
  return upsertSingleton('chat', { messages: trimmed })
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
  return /今晚|今天|周五|星期六|周日|安排|计划|要去|出去/.test(t)
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
