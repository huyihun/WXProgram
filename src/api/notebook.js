/**
 * 记事本云数据库访问层
 *
 * 使用前请在云开发控制台创建以下集合并设置「仅创建者可读写」：
 * - notebook_plans
 * - notebook_moods
 * - notebook_casuals
 *
 * 注意：小程序端单次 get 最多 20 条，列表查询需分页拉全。
 */

const db = wx.cloud.database()
const PAGE_SIZE = 20

/** 预设心情选项（咖啡为默认主题） */
export const MOOD_OPTIONS = [
  { key: 'coffee', label: '咖啡', emoji: '☕' },
  { key: 'happy', label: '开心', emoji: '😊' },
  { key: 'calm', label: '平静', emoji: '😌' },
  { key: 'sad', label: '难过', emoji: '😢' },
  { key: 'anxious', label: '焦虑', emoji: '😰' },
  { key: 'tired', label: '疲惫', emoji: '😩' },
  { key: 'excited', label: '兴奋', emoji: '🤩' },
  { key: 'grateful', label: '感恩', emoji: '🙏' },
  { key: 'peaceful', label: '安宁', emoji: '🕊️' },
  { key: 'lonely', label: '孤独', emoji: '🌙' },
  { key: 'bored', label: '无聊', emoji: '😑' },
  { key: 'angry', label: '愤怒', emoji: '😡' },
  { key: 'focused', label: '专注', emoji: '🎯' },
  { key: 'surprised', label: '惊喜', emoji: '✨' },
  { key: 'relaxed', label: '放松', emoji: '🌱' },
]

/** 格式化 Date 为 YYYY-MM-DD */
export function formatDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 获取今天日期字符串 */
export function getToday() {
  return formatDate(new Date())
}

/** 截取内容摘要 */
export function truncate(text, len = 40) {
  if (!text) return ''
  return text.length > len ? `${text.slice(0, len)}...` : text
}

/** buildQuery() 返回可 skip/limit/get 的查询；分页拉全 */
async function fetchAll(buildQuery) {
  const all = []
  let skip = 0
  while (true) {
    const res = await buildQuery().skip(skip).limit(PAGE_SIZE).get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) {
      all.push(batch[i])
    }
    if (batch.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }
  return all
}

// ─── 今日计划（一天一份正文）─────────────────────────────

/** 把当日多条旧时段计划拼成一段可读文本 */
function buildDayPlanContent(items) {
  if (!items.length) return ''
  if (items.length === 1) {
    const item = items[0]
    if (!item.title && !item.startTime && !item.endTime) {
      return item.content || ''
    }
  }
  return items
    .map((item) => {
      const chunks = []
      if (item.startTime && item.endTime) chunks.push(`${item.startTime} - ${item.endTime}`)
      else if (item.startTime) chunks.push(item.startTime)
      if (item.title) chunks.push(item.title)
      if (item.content) chunks.push(item.content)
      return chunks.join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

/** 获取今日计划；多条旧数据时合并成 content 返回 */
export async function getTodayPlan() {
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_plans').where({ date: today }))
  if (!items.length) return null
  return {
    _id: items[0]._id,
    content: buildDayPlanContent(items),
    todoDone: items[0].todoDone || {},
  }
}

/**
 * 保存今日计划：空内容则删除当日全部记录；
 * 有内容则更新第一条并删掉当日其余旧文档
 */
export async function saveTodayPlan(content) {
  const text = (content || '').trim()
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_plans').where({ date: today }))
  const now = Date.now()

  if (!text) {
    for (let i = 0; i < items.length; i++) {
      await db.collection('notebook_plans').doc(items[i]._id).remove()
    }
    return
  }

  if (!items.length) {
    await db.collection('notebook_plans').add({
      data: {
        date: today,
        content: text,
        todoDone: {},
        createdAt: now,
        updatedAt: now,
      },
    })
    return
  }

  await db.collection('notebook_plans').doc(items[0]._id).update({
    data: {
      content: text,
      updatedAt: now,
    },
  })
  for (let i = 1; i < items.length; i++) {
    await db.collection('notebook_plans').doc(items[i]._id).remove()
  }
}

/** 只更新当日计划的待办勾选覆盖态（需已有当日计划文档） */
export async function savePlanTodoDone(todoDone) {
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_plans').where({ date: today }))
  if (!items.length) {
    throw new Error('NO_PLAN')
  }
  await db.collection('notebook_plans').doc(items[0]._id).update({
    data: {
      todoDone: todoDone || {},
      updatedAt: Date.now(),
    },
  })
}

/** 历史计划：除今日外，按日期倒序；同日多条合并正文 */
export async function getPlanHistory() {
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_plans'))
  const groups = {}

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const date = item.date
    if (!date || date === today) continue
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
  }

  const dates = Object.keys(groups).sort().reverse()
  return dates.map((date) => ({
    date,
    _id: groups[date][0]._id,
    content: buildDayPlanContent(groups[date]),
  }))
}

/** 删除某一天的全部计划记录 */
export async function removePlanByDate(date) {
  if (!date) return
  const items = await fetchAll(() => db.collection('notebook_plans').where({ date: date }))
  for (let i = 0; i < items.length; i++) {
    await db.collection('notebook_plans').doc(items[i]._id).remove()
  }
}

export function getMoodLabel(moodKey) {
  for (let i = 0; i < MOOD_OPTIONS.length; i++) {
    if (MOOD_OPTIONS[i].key === moodKey) return MOOD_OPTIONS[i].label
  }
  return ''
}

// ─── 心情 ───────────────────────────────────────────────

export async function getMoodByDate(date) {
  const res = await db
    .collection('notebook_moods')
    .where({ date })
    .limit(1)
    .get()
  return res.data[0] || null
}

export async function getMoodHistory() {
  return fetchAll(() => db.collection('notebook_moods').orderBy('date', 'desc'))
}

/** 今日心情，没有则取最近一条（主题反显用） */
export async function getLatestMood() {
  const todayMood = await getMoodByDate(getToday())
  if (todayMood && todayMood.moodKey) return todayMood
  const history = await getMoodHistory()
  if (history && history.length && history[0].moodKey) return history[0]
  return null
}

/** 同日心情存在则更新，否则新增 */
export async function upsertMood(data) {
  const existing = await getMoodByDate(data.date)
  const now = Date.now()

  if (existing) {
    await db
      .collection('notebook_moods')
      .doc(existing._id)
      .update({
        data: {
          moodKey: data.moodKey,
          moodLabel: data.moodLabel,
          note: data.note || '',
          updatedAt: now,
        },
      })
    return existing._id
  }

  const res = await db.collection('notebook_moods').add({
    data: { ...data, note: data.note || '', createdAt: now, updatedAt: now },
  })
  return res._id
}

// ─── 随心记 ─────────────────────────────────────────────

/** 格式化时间为 MM/DD HH:mm */
export function formatDateTime(timestamp) {
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function getCasuals() {
  return fetchAll(() => db.collection('notebook_casuals').orderBy('createdAt', 'desc'))
}

export async function addCasual(content) {
  const now = Date.now()
  const res = await db.collection('notebook_casuals').add({
    data: { content, createdAt: now, updatedAt: now },
  })
  return res._id
}

export async function updateCasual(id, content) {
  await db
    .collection('notebook_casuals')
    .doc(id)
    .update({ data: { content, updatedAt: Date.now() } })
}

export async function removeCasual(id) {
  await db.collection('notebook_casuals').doc(id).remove()
}
