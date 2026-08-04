/**
 * 减肥云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - diet_records
 *
 * 用 type 区分：todo | meal | forbidden | book | checkin | reflection
 * database 在函数内懒创建，避免启动阶段白屏
 * 小程序端单次 get 最多 20 条，列表查询需分页拉全
 */

const COL = 'diet_records'
const PAGE_SIZE = 20

const DEFAULT_BOOKS = [
  {
    title: '《瘦身革命》',
    note: '间歇性禁食与胰岛素：通过进食窗口控制热量与饥饿激素',
  },
  {
    title: '《为什么我们会发胖》',
    note: '从代谢与激素角度解释肥胖，强调热量质量而不只是意志力',
  },
  {
    title: '《救命饮食》',
    note: '植物性饮食与慢性病研究，减少加工食品与过量动物蛋白',
  },
  {
    title: '《肥胖密码》',
    note: '蛋白质与饱腹感、抗阻力训练维持基础代谢的科学路径',
  },
]

function getDb() {
  return wx.cloud.database()
}

function col() {
  return getDb().collection(COL)
}

export function formatDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getToday() {
  return formatDate(new Date())
}

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

async function listByType(type) {
  return fetchAll(() => col().where({ type }))
}

async function listByTypeDate(type, date) {
  return fetchAll(() => col().where({ type, date }))
}

async function removeDocs(items) {
  for (let i = 0; i < items.length; i++) {
    await col().doc(items[i]._id).remove()
  }
}

// ─── 今日待办 ─────────────────────────────────────────────

export async function getTodayTodos() {
  const items = await listByTypeDate('todo', getToday())
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return items
}

export async function addTodo(title) {
  const now = Date.now()
  const res = await col().add({
    data: {
      type: 'todo',
      date: getToday(),
      title,
      done: false,
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function toggleTodo(id, done) {
  await col().doc(id).update({ data: { done, updatedAt: Date.now() } })
}

export async function removeTodo(id) {
  await col().doc(id).remove()
}

// ─── 今日饮食 ─────────────────────────────────────────────

export async function getTodayMeal() {
  const items = await listByTypeDate('meal', getToday())
  if (!items.length) return { lunch: '', dinner: '' }
  const row = items[0]
  return {
    _id: row._id,
    lunch: row.lunch || '',
    dinner: row.dinner || '',
  }
}

export async function saveTodayMeal(lunch, dinner) {
  const today = getToday()
  const textLunch = (lunch || '').trim()
  const textDinner = (dinner || '').trim()
  const items = await listByTypeDate('meal', today)
  const now = Date.now()

  if (!textLunch && !textDinner) {
    await removeDocs(items)
    return
  }

  const payload = {
    lunch: textLunch,
    dinner: textDinner,
    updatedAt: now,
  }

  if (!items.length) {
    await col().add({
      data: {
        type: 'meal',
        date: today,
        ...payload,
        createdAt: now,
      },
    })
    return
  }

  await col().doc(items[0]._id).update({ data: payload })
  if (items.length > 1) await removeDocs(items.slice(1))
}

// ─── 禁忌清单 ─────────────────────────────────────────────

export async function listForbidden() {
  const items = await listByType('forbidden')
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return items
}

export async function addForbidden(name, kind) {
  const now = Date.now()
  const res = await col().add({
    data: {
      type: 'forbidden',
      name,
      kind: kind === 'drink' ? 'drink' : 'food',
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function removeForbidden(id) {
  await col().doc(id).remove()
}

// ─── 科学书籍 ─────────────────────────────────────────────

export async function listBooks() {
  const items = await listByType('book')
  items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  return items
}

export async function addBook(title, note) {
  const now = Date.now()
  const res = await col().add({
    data: {
      type: 'book',
      title,
      note: note || '',
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function removeBook(id) {
  await col().doc(id).remove()
}

/** 列表为空时写入预置科学向书籍 */
export async function ensureDefaultBooks() {
  const list = await listBooks()
  if (list.length) return list
  const now = Date.now()
  for (let i = 0; i < DEFAULT_BOOKS.length; i++) {
    const item = DEFAULT_BOOKS[i]
    await col().add({
      data: {
        type: 'book',
        title: item.title,
        note: item.note,
        createdAt: now + i,
        updatedAt: now + i,
      },
    })
  }
  return listBooks()
}

// ─── 打卡 ─────────────────────────────────────────────────

export async function getCheckinStats() {
  const today = getToday()
  const all = await listByType('checkin')
  let checkedToday = false
  for (let i = 0; i < all.length; i++) {
    if (all[i].date === today) {
      checkedToday = true
      break
    }
  }
  return {
    total: all.length,
    checkedToday,
  }
}

export async function checkinToday() {
  const today = getToday()
  const exists = await listByTypeDate('checkin', today)
  if (exists.length) return exists[0]._id
  const res = await col().add({
    data: {
      type: 'checkin',
      date: today,
      createdAt: Date.now(),
    },
  })
  return res._id
}

// ─── 失败复盘 ─────────────────────────────────────────────

export async function getTodayReflection() {
  const items = await listByTypeDate('reflection', getToday())
  if (!items.length) return { content: '' }
  return {
    _id: items[0]._id,
    content: items[0].content || '',
  }
}

export async function saveTodayReflection(content) {
  const today = getToday()
  const text = (content || '').trim()
  const items = await listByTypeDate('reflection', today)
  const now = Date.now()

  if (!text) {
    await removeDocs(items)
    return
  }

  if (!items.length) {
    await col().add({
      data: {
        type: 'reflection',
        date: today,
        content: text,
        createdAt: now,
        updatedAt: now,
      },
    })
    return
  }

  await col().doc(items[0]._id).update({ data: { content: text, updatedAt: now } })
  if (items.length > 1) await removeDocs(items.slice(1))
}

export async function listReflections() {
  const items = await listByType('reflection')
  items.sort((a, b) => {
    const da = a.date || ''
    const db = b.date || ''
    if (da === db) return (b.updatedAt || 0) - (a.updatedAt || 0)
    return da < db ? 1 : -1
  })
  return items
}

export async function removeReflection(id) {
  await col().doc(id).remove()
}
