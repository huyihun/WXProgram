/**
 * 专攻云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - zhuanggong（kind: focus，status: active | done）
 *
 * 单次 get 最多 20 条是平台硬限制；列表必须 skip 循环拉全，禁止只取一页。
 */

const db = wx.cloud.database()
/** 微信云库单次 get 上限，仅用于循环分页，不是业务「只查 20 条」 */
const BATCH = 20
const COL = 'zhuanggong'

function pad(n) {
  return String(n).padStart(2, '0')
}

/** dateStr YYYY-MM-DD + timeStr HH:mm → ms */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return 0
  const dp = String(dateStr).split(/[-/]/)
  const tp = String(timeStr).split(':')
  if (dp.length < 3 || tp.length < 2) return 0
  const y = Number(dp[0])
  const mo = Number(dp[1])
  const day = Number(dp[2])
  const h = Number(tp[0])
  const mi = Number(tp[1])
  if (!isFinite(y) || !isFinite(mo) || !isFinite(day) || !isFinite(h) || !isFinite(mi)) return 0
  const d = new Date(y, mo - 1, day, h, mi, 0, 0)
  const t = d.getTime()
  return isFinite(t) ? t : 0
}

export function splitDateTime(at) {
  if (!at) {
    const now = new Date()
    return {
      date: formatDateStr(now),
      time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
    }
  }
  const d = new Date(at)
  return {
    date: formatDateStr(d),
    time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
  }
}

function formatDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 展示：8月8日 15:00 */
export function formatFocusMoment(at) {
  if (!at) return '-'
  const d = new Date(at)
  return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/** 展示时段 */
export function formatFocusRange(startAt, endAt) {
  if (!startAt && !endAt) return '-'
  return formatFocusMoment(startAt) + ' – ' + formatFocusMoment(endAt)
}

export function formatCompletedAt(at) {
  if (!at) return '-'
  const d = new Date(at)
  return (
    formatDateStr(d) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
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

/** 当前进行中的专攻 */
export async function getActiveFocus() {
  const res = await db
    .collection(COL)
    .where({ kind: 'focus', status: 'active' })
    .limit(1)
    .get()
  return res.data[0] || null
}

/**
 * 保存进行中专攻（有则更新，无则新增）
 * @returns {Promise<object>} 保存后的文档（含 _id）
 */
export async function saveActiveFocus(payload) {
  const content = ((payload && payload.content) || '').trim()
  const startAt = Number((payload && payload.startAt) || 0)
  const endAt = Number((payload && payload.endAt) || 0)
  if (!content) throw new Error('请填写专攻内容')
  if (!startAt || !endAt) throw new Error('请设定起止时间')
  if (endAt < startAt) throw new Error('结束时间需晚于开始时间')

  const now = Date.now()
  const existing = await getActiveFocus()
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: {
        content,
        startAt,
        endAt,
        updatedAt: now,
      },
    })
    return {
      _id: existing._id,
      kind: 'focus',
      content,
      startAt,
      endAt,
      status: 'active',
      completedAt: null,
      createdAt: existing.createdAt,
      updatedAt: now,
    }
  }

  const res = await db.collection(COL).add({
    data: {
      kind: 'focus',
      content,
      startAt,
      endAt,
      status: 'active',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  })
  return {
    _id: res._id,
    kind: 'focus',
    content,
    startAt,
    endAt,
    status: 'active',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function completeActiveFocus(id) {
  if (!id) throw new Error('无进行中的专攻')
  const now = Date.now()
  await db.collection(COL).doc(id).update({
    data: {
      status: 'done',
      completedAt: now,
      updatedAt: now,
    },
  })
  return now
}

/** 已完成专攻历史（全量，倒序） */
export async function getHistoryFocus() {
  return fetchAllWhere({ kind: 'focus', status: 'done' }, 'completedAt', 'desc')
}
