/**
 * 记事本云数据库访问层
 *
 * 使用前请在云开发控制台创建以下集合并设置「仅创建者可读写」：
 * - notebook_plans
 * - notebook_diaries
 * - notebook_moods
 * - notebook_todos
 * - notebook_casuals
 */

const db = wx.cloud.database()

/** 预设心情选项 */
export const MOOD_OPTIONS = [
  { key: 'happy', label: '开心', emoji: '😊' },
  { key: 'calm', label: '平静', emoji: '😌' },
  { key: 'sad', label: '难过', emoji: '😢' },
  { key: 'anxious', label: '焦虑', emoji: '😰' },
  { key: 'tired', label: '疲惫', emoji: '😩' },
  { key: 'excited', label: '兴奋', emoji: '🤩' },
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

// ─── 今日计划 ───────────────────────────────────────────

export async function getTodayPlans() {
  const today = getToday()
  const res = await db
    .collection('notebook_plans')
    .where({ date: today })
    .orderBy('startTime', 'asc')
    .get()
  return res.data
}

export async function getPlan(id) {
  const res = await db.collection('notebook_plans').doc(id).get()
  return res.data
}

export async function addPlan(data) {
  const now = Date.now()
  const res = await db.collection('notebook_plans').add({
    data: {
      ...data,
      date: getToday(),
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function updatePlan(id, data) {
  await db
    .collection('notebook_plans')
    .doc(id)
    .update({
      data: { ...data, updatedAt: Date.now() },
    })
}

export async function removePlan(id) {
  await db.collection('notebook_plans').doc(id).remove()
}

// ─── 日记 ───────────────────────────────────────────────

export async function getDiaries() {
  const res = await db
    .collection('notebook_diaries')
    .orderBy('date', 'desc')
    .get()
  return res.data
}

export async function getDiary(id) {
  const res = await db.collection('notebook_diaries').doc(id).get()
  return res.data
}

export async function addDiary(data) {
  const now = Date.now()
  const res = await db.collection('notebook_diaries').add({
    data: { ...data, createdAt: now, updatedAt: now },
  })
  return res._id
}

export async function updateDiary(id, data) {
  await db
    .collection('notebook_diaries')
    .doc(id)
    .update({
      data: { ...data, updatedAt: Date.now() },
    })
}

export async function removeDiary(id) {
  await db.collection('notebook_diaries').doc(id).remove()
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
  const res = await db
    .collection('notebook_moods')
    .orderBy('date', 'desc')
    .get()
  return res.data
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
  let query = db.collection('notebook_todos')

  if (filter === 'active') {
    query = query.where({ done: false })
  } else if (filter === 'done') {
    query = query.where({ done: true })
  }

  const res = await query.orderBy('createdAt', 'desc').get()
  return res.data
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
  const res = await db
    .collection('notebook_casuals')
    .orderBy('createdAt', 'desc')
    .get()
  return res.data
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
