/**
 * 减肥云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - diet（用 kind 区分：tip / checkin / day / rules / weight / target / current）
 *
 * 单次 get 最多 20 条是平台硬限制；列表必须 skip 循环拉全，禁止只取一页。
 */

const db = wx.cloud.database()
/** 微信云库单次 get 上限，仅用于循环分页，不是业务「只查 20 条」 */
const BATCH = 20
const COL = 'diet'

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

// ─── 秘诀（全局一份）────────────────────────────────────

export async function getTip() {
  const res = await db.collection(COL).where({ kind: 'tip' }).limit(1).get()
  return res.data[0] || null
}

export async function saveTip(content) {
  const text = (content || '').trim()
  const now = Date.now()
  const existing = await getTip()
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: { content: text, updatedAt: now },
    })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: { kind: 'tip', content: text, createdAt: now, updatedAt: now },
  })
  return res._id
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

export async function getAllCheckins() {
  return fetchAllWhere({ kind: 'checkin' }, 'date', 'desc')
}

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

// ─── 今日饮食 + 运动 ────────────────────────────────────

export async function getDayLog(date = getToday()) {
  const res = await db
    .collection(COL)
    .where({ kind: 'day', date })
    .limit(1)
    .get()
  return res.data[0] || null
}

export async function saveDayLog(date, data) {
  const now = Date.now()
  const sports = []
  const rawSports = data.sports || []
  for (let i = 0; i < rawSports.length; i++) {
    const name = (rawSports[i].name || '').trim()
    const minutes = (rawSports[i].minutes || '').trim()
    if (!name && !minutes) continue
    sports.push({ name, minutes })
  }
  const payload = {
    lunch: (data.lunch || '').trim(),
    lunchAmount: (data.lunchAmount || '').trim(),
    dinner: (data.dinner || '').trim(),
    dinnerAmount: (data.dinnerAmount || '').trim(),
    drink: (data.drink || '').trim(),
    sports,
    updatedAt: now,
  }
  const existing = await getDayLog(date)
  if (existing) {
    await db.collection(COL).doc(existing._id).update({ data: payload })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: { kind: 'day', date, ...payload, createdAt: now },
  })
  return res._id
}

// ─── 只吃 / 不吃（全局一份）─────────────────────────────

export async function getRules() {
  const res = await db.collection(COL).where({ kind: 'rules' }).limit(1).get()
  return res.data[0] || null
}

export async function saveRules(onlyEat, dontEat) {
  const now = Date.now()
  const payload = {
    onlyEat: (onlyEat || '').trim(),
    dontEat: (dontEat || '').trim(),
    updatedAt: now,
  }
  const existing = await getRules()
  if (existing) {
    await db.collection(COL).doc(existing._id).update({ data: payload })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: { kind: 'rules', ...payload, createdAt: now },
  })
  return res._id
}

// ─── 目标体重（全局一份，单位：斤）──────────────────────

export async function getTargetWeight() {
  const res = await db.collection(COL).where({ kind: 'target' }).limit(1).get()
  return res.data[0] || null
}

export async function saveTargetWeight(weight) {
  const w = Number(weight)
  if (!isFinite(w) || w <= 0) throw new Error('请输入目标体重')
  const now = Date.now()
  const existing = await getTargetWeight()
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: { targetWeight: w, weight: w, updatedAt: now },
    })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: { kind: 'target', targetWeight: w, weight: w, createdAt: now, updatedAt: now },
  })
  return res._id
}

/** 兼容旧字段 weight */
export function readTargetValue(row) {
  if (!row) return ''
  if (row.targetWeight != null && row.targetWeight !== '') return String(row.targetWeight)
  if (row.weight != null && row.weight !== '') return String(row.weight)
  return ''
}

// ─── 当前体重（最近一次记录，全局一份）──────────────────

export async function getCurrentWeight() {
  const res = await db.collection(COL).where({ kind: 'current' }).limit(1).get()
  return res.data[0] || null
}

export async function saveCurrentWeight(weight, at) {
  const w = Number(weight)
  if (!isFinite(w) || w <= 0) throw new Error('请输入体重')
  const now = Date.now()
  const stamp = Number(at) || now
  const existing = await getCurrentWeight()
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: { currentWeight: w, at: stamp, updatedAt: now },
    })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: {
      kind: 'current',
      currentWeight: w,
      at: stamp,
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export function readCurrentValue(row) {
  if (!row) return ''
  if (row.currentWeight != null && row.currentWeight !== '') return String(row.currentWeight)
  if (row.weight != null && row.weight !== '') return String(row.weight)
  return ''
}

/** 按最近一次体重记录刷新 current 文档 */
export async function syncCurrentFromLatest() {
  const rows = await getAllWeights()
  if (!rows.length) {
    const existing = await getCurrentWeight()
    if (existing) {
      await db.collection(COL).doc(existing._id).remove()
    }
    return null
  }
  const latest = rows[0]
  await saveCurrentWeight(latest.weight, latest.at)
  return latest
}

// ─── 体重（单位：斤）────────────────────────────────────

/** 当前 HH:mm */
export function formatHm(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function timeToAt(dateStr, timeStr) {
  const parts = dateStr.split('-')
  const tp = (timeStr || '00:00').split(':')
  const d = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    Number(tp[0]) || 0,
    Number(tp[1]) || 0,
    0,
    0
  )
  return d.getTime()
}

export async function getWeightsByDate(date) {
  return fetchAllWhere({ kind: 'weight', date }, 'at', 'desc')
}

export async function getAllWeights() {
  return fetchAllWhere({ kind: 'weight' }, 'at', 'desc')
}

export async function addWeight(date, time, weight) {
  const t = (time || '').trim()
  if (!t) throw new Error('请选择时间')
  const w = Number(weight)
  if (!isFinite(w) || w <= 0) throw new Error('请输入体重')
  const at = timeToAt(date, t)
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: {
      kind: 'weight',
      date,
      at,
      time: t,
      weight: w,
      createdAt: now,
    },
  })
  await syncCurrentFromLatest()
  return res._id
}

export async function removeWeight(id) {
  if (!id) return
  await db.collection(COL).doc(id).remove()
  await syncCurrentFromLatest()
}
