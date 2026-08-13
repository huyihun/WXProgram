/**
 * Serious 主人专区云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - serious（用 kind 区分：checkin / stamp / night / danger / reflection）
 *
 * 单次 get 最多 20 条是平台硬限制；列表必须 skip 循环拉全，禁止只取一页。
 */

const db = wx.cloud.database()
/** 微信云库单次 get 上限，仅用于循环分页，不是业务「只查 20 条」 */
const BATCH = 20
const COL = 'serious'

function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatDate(date = new Date()) {
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  return `${y}-${m}-${d}`
}

export function getToday() {
  return formatDate(new Date())
}

/** 分钟精度时间戳（秒清零） */
export function minuteTs(date = new Date()) {
  const d = new Date(date)
  d.setSeconds(0, 0)
  return d.getTime()
}

/** 展示：HH:mm */
export function formatHm(at) {
  if (!at) return '-'
  const d = new Date(at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 展示：MM-DD HH:mm */
export function formatStampLabel(at) {
  const d = new Date(at)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 夜区 key：22:00 起算到次日 01:00
 * 00:00–00:59 → 昨天；其余 → 今天
 */
export function getNightKey(date = new Date()) {
  const d = new Date(date)
  if (d.getHours() < 1) {
    d.setDate(d.getDate() - 1)
  }
  return formatDate(d)
}

/** 当前是否落在 22:00–01:00（含 22:00–23:59 与 00:00–00:59） */
export function isInNightWindow(date = new Date()) {
  const h = date.getHours()
  return h >= 22 || h < 1
}

/** 按条件循环拉全量（必须拉完，禁止只取一页） */
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

function shiftDate(dateStr, deltaDays) {
  const parts = dateStr.split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  d.setDate(d.getDate() + deltaDays)
  return formatDate(d)
}

function stampDateOf(row) {
  if (row.date) return row.date
  if (row.at) return formatDate(new Date(row.at))
  return ''
}

// ─── 打卡 ───────────────────────────────────────────────

export async function getCheckinByDate(date) {
  const res = await db
    .collection(COL)
    .where({ kind: 'checkin', date })
    .limit(1)
    .get()
  return res.data[0] || null
}

/** 全部打卡记录（倒序） */
export async function getAllCheckins() {
  return fetchAllWhere({ kind: 'checkin' }, 'date', 'desc')
}

/** 连续天数：从今天起往前数；今天未打则从昨天起 */
export function calcStreak(dates, today = getToday()) {
  const set = {}
  for (let i = 0; i < dates.length; i++) {
    set[dates[i]] = true
  }
  let cursor = today
  if (!set[cursor]) {
    cursor = shiftDate(today, -1)
    if (!set[cursor]) return 0
  }
  let streak = 0
  while (set[cursor]) {
    streak += 1
    cursor = shiftDate(cursor, -1)
  }
  return streak
}

export async function addCheckin(date = getToday()) {
  const existing = await getCheckinByDate(date)
  if (existing) return existing._id
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: { kind: 'checkin', date, createdAt: now },
  })
  return res._id
}

// ─── 时间戳记录 ─────────────────────────────────────────

/** 全部时间戳记录（倒序） */
export async function getAllStamps() {
  return fetchAllWhere({ kind: 'stamp' }, 'at', 'desc')
}

/** 某日时间戳记录 */
export async function getStampsByDate(date) {
  return fetchAllWhere({ kind: 'stamp', date }, 'at', 'desc')
}

export async function addStamp(at = minuteTs()) {
  const now = Date.now()
  const label = formatStampLabel(at)
  const date = formatDate(new Date(at))
  const res = await db.collection(COL).add({
    data: { kind: 'stamp', date, at, label, createdAt: now },
  })
  return res._id
}

export async function removeStamp(id) {
  if (!id) return
  await db.collection(COL).doc(id).remove()
}

// ─── 夜区待办 ───────────────────────────────────────────

export async function getNightPlan(nightKey) {
  const res = await db
    .collection(COL)
    .where({ kind: 'night', nightKey })
    .limit(1)
    .get()
  return res.data[0] || null
}

export async function getAllNightPlans() {
  return fetchAllWhere({ kind: 'night' }, 'nightKey', 'desc')
}

export async function saveNightPlan(nightKey, items) {
  const cleaned = []
  for (let i = 0; i < items.length; i++) {
    const text = (items[i].text || '').trim()
    if (!text && !items[i].done) continue
    cleaned.push({ text, done: !!items[i].done })
  }
  const now = Date.now()
  const existing = await getNightPlan(nightKey)
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: { items: cleaned, updatedAt: now },
    })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: {
      kind: 'night',
      nightKey,
      items: cleaned,
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

// ─── 危险点警示 ─────────────────────────────────────────

/** 全部危险点（新在前） */
export async function getAllDangers() {
  return fetchAllWhere({ kind: 'danger' }, 'createdAt', 'desc')
}

/** 某日危险点 */
export async function getDangersByDate(date) {
  return fetchAllWhere({ kind: 'danger', date }, 'createdAt', 'desc')
}

export async function addDanger(text, date = getToday()) {
  const content = (text || '').trim()
  if (!content) throw new Error('请填写警示内容')
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: { kind: 'danger', date, text: content, createdAt: now },
  })
  return res._id
}

export async function removeDanger(id) {
  if (!id) return
  await db.collection(COL).doc(id).remove()
}

// ─── 总结分析 ───────────────────────────────────────────

export async function getReflection(date = getToday()) {
  const res = await db
    .collection(COL)
    .where({ kind: 'reflection', date })
    .limit(1)
    .get()
  return res.data[0] || null
}

export async function getAllReflections() {
  return fetchAllWhere({ kind: 'reflection' }, 'date', 'desc')
}

export async function saveReflection(date, content) {
  const text = (content || '').trim()
  const now = Date.now()
  const existing = await getReflection(date)
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: { content: text, updatedAt: now },
    })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: {
      kind: 'reflection',
      date,
      content: text,
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

// ─── 历史（按日聚合）────────────────────────────────────

function ensureDay(map, date) {
  if (!date) return null
  if (!map[date]) {
    map[date] = {
      date,
      checkinTime: '-',
      stamps: [],
      stampCount: 0,
      nightItems: [],
      dangers: [],
      reflection: '',
    }
  }
  return map[date]
}

/** 有任一记录的日期列表（倒序），含展开所需详情字段 */
export async function getHistoryDays() {
  const [checkins, stamps, nights, dangers, reflections] = await Promise.all([
    getAllCheckins(),
    getAllStamps(),
    getAllNightPlans(),
    getAllDangers(),
    getAllReflections(),
  ])

  const map = {}

  for (let i = 0; i < checkins.length; i++) {
    const row = checkins[i]
    const day = ensureDay(map, row.date)
    if (!day) continue
    day.checkinTime = formatHm(row.createdAt)
  }

  for (let i = 0; i < stamps.length; i++) {
    const row = stamps[i]
    const day = ensureDay(map, stampDateOf(row))
    if (!day) continue
    day.stamps.push({
      label: row.label || formatStampLabel(row.at),
      at: row.at,
      hm: formatHm(row.at),
    })
  }

  for (let i = 0; i < nights.length; i++) {
    const row = nights[i]
    const day = ensureDay(map, row.nightKey)
    if (!day) continue
    day.nightItems = row.items || []
  }

  for (let i = 0; i < dangers.length; i++) {
    const row = dangers[i]
    if (!row.date) continue
    const day = ensureDay(map, row.date)
    if (!day) continue
    day.dangers.push(row.text || '')
  }

  for (let i = 0; i < reflections.length; i++) {
    const row = reflections[i]
    const day = ensureDay(map, row.date)
    if (!day) continue
    day.reflection = (row.content || '').trim()
  }

  const list = []
  for (const key in map) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue
    const day = map[key]
    day.stampCount = day.stamps.length
    list.push(day)
  }
  list.sort((a, b) => {
    if (a.date < b.date) return 1
    if (a.date > b.date) return -1
    return 0
  })
  return list
}
