/**
 * 记事本云数据库访问层
 *
 * 使用前请在云开发控制台创建以下集合并设置「仅创建者可读写」：
 * - notebook_plans
 * - notebook_diaries
 * - notebook_moods
 * - notebook_todos
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

// ─── 日记（一天一篇）─────────────────────────────────────

/** 获取今日日记；同日多条时取最新一条并拼接正文 */
export async function getTodayDiary() {
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_diaries').where({ date: today }))
  if (!items.length) return null

  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  const first = items[0]
  let content = first.content || ''
  if (items.length > 1) {
    content = items
      .map((item) => {
        const parts = []
        if (item.title) parts.push(item.title)
        if (item.content) parts.push(item.content)
        return parts.join('\n')
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return {
    _id: first._id,
    date: today,
    title: first.title || '',
    content,
    mood: first.mood || '',
  }
}

/**
 * 保存今日日记：空内容且无标题则删当日记录；
 * 有则更新第一条并清理当日其余旧文档
 */
export async function saveTodayDiary(data) {
  const title = (data.title || '').trim()
  const content = (data.content || '').trim()
  const mood = data.mood || ''
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_diaries').where({ date: today }))
  const now = Date.now()

  if (!title && !content && !mood) {
    for (let i = 0; i < items.length; i++) {
      await db.collection('notebook_diaries').doc(items[i]._id).remove()
    }
    return
  }

  const payload = {
    date: today,
    title: title || '今日日记',
    content,
    mood,
    updatedAt: now,
  }

  if (!items.length) {
    await db.collection('notebook_diaries').add({
      data: { ...payload, createdAt: now },
    })
    return
  }

  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  await db.collection('notebook_diaries').doc(items[0]._id).update({ data: payload })
  for (let i = 1; i < items.length; i++) {
    await db.collection('notebook_diaries').doc(items[i]._id).remove()
  }
}

/** 历史日记：除今日外，按日期倒序 */
export async function getDiaryHistory() {
  const today = getToday()
  const items = await fetchAll(() => db.collection('notebook_diaries'))
  const groups = {}

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const date = item.date
    if (!date || date === today) continue
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
  }

  const dates = Object.keys(groups).sort().reverse()
  return dates.map((date) => {
    const list = groups[date]
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    const first = list[0]
    let content = first.content || ''
    if (list.length > 1) {
      content = list
        .map((item) => {
          const parts = []
          if (item.title) parts.push(item.title)
          if (item.content) parts.push(item.content)
          return parts.join('\n')
        })
        .filter(Boolean)
        .join('\n\n')
    }
    return {
      date,
      _id: first._id,
      title: first.title || '日记',
      content,
      mood: first.mood || '',
    }
  })
}

/** 删除某一天的全部日记 */
export async function removeDiaryByDate(date) {
  if (!date) return
  const items = await fetchAll(() => db.collection('notebook_diaries').where({ date: date }))
  for (let i = 0; i < items.length; i++) {
    await db.collection('notebook_diaries').doc(items[i]._id).remove()
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

// ─── 待办 ───────────────────────────────────────────────

/**
 * @param {'all'|'active'|'done'} filter
 */
export async function getTodos(filter = 'all') {
  return fetchAll(() => {
    let query = db.collection('notebook_todos')
    if (filter === 'active') {
      query = query.where({ done: false })
    } else if (filter === 'done') {
      query = query.where({ done: true })
    }
    return query.orderBy('createdAt', 'desc')
  })
}

export async function addTodo(title) {
  const now = Date.now()
  const res = await db.collection('notebook_todos').add({
    data: { title, done: false, dueDate: '', createdAt: now, updatedAt: now },
  })
  return res._id
}

export async function toggleTodo(id, done) {
  await db
    .collection('notebook_todos')
    .doc(id)
    .update({ data: { done, updatedAt: Date.now() } })
}

export async function removeTodo(id) {
  await db.collection('notebook_todos').doc(id).remove()
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
