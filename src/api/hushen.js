/**
 * 胡神模式云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - hushen（kind: session）
 *
 * 单次 get 最多 20 条是平台硬限制；列表必须 skip 循环拉全，禁止只取一页。
 */

const db = wx.cloud.database()
/** 微信云库单次 get 上限，仅用于循环分页，不是业务「只查 20 条」 */
const BATCH = 20
const COL = 'hushen'

function pad(n, len) {
  return String(n).padStart(len || 2, '0')
}

/** 展示秒表 HH:MM:SS.mmm */
export function formatDuration(ms) {
  const raw = Math.max(0, Math.floor(Number(ms) || 0))
  const h = Math.floor(raw / 3600000)
  const m = Math.floor((raw % 3600000) / 60000)
  const s = Math.floor((raw % 60000) / 1000)
  const milli = raw % 1000
  return pad(h) + ':' + pad(m) + ':' + pad(s) + '.' + pad(milli, 3)
}

/** 展示开始时间 YYYY-MM-DD HH:mm */
export function formatSessionTime(at) {
  if (!at) return '-'
  const d = new Date(at)
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
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

/** 当前进行中的会话（未结束） */
export async function getRunningSession() {
  const res = await db
    .collection(COL)
    .where({ kind: 'session', endedAt: null })
    .limit(1)
    .get()
  return res.data[0] || null
}

/** 全部会话（倒序，含进行中） */
export async function getAllSessions() {
  return fetchAllWhere({ kind: 'session' }, 'startedAt', 'desc')
}

/** 已结束会话（历史） */
export async function getHistorySessions() {
  const all = await getAllSessions()
  const out = []
  for (let i = 0; i < all.length; i++) {
    if (all[i].endedAt) out.push(all[i])
  }
  return out
}

export async function startSession() {
  const running = await getRunningSession()
  if (running) return running
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: {
      kind: 'session',
      startedAt: now,
      endedAt: null,
      durationMs: 0,
      createdAt: now,
    },
  })
  return {
    _id: res._id,
    kind: 'session',
    startedAt: now,
    endedAt: null,
    durationMs: 0,
    createdAt: now,
  }
}

export async function endSession(id, startedAt) {
  if (!id) throw new Error('无进行中的会话')
  const endedAt = Date.now()
  const durationMs = Math.max(0, endedAt - (Number(startedAt) || endedAt))
  await db.collection(COL).doc(id).update({
    data: {
      endedAt,
      durationMs,
    },
  })
  return { endedAt, durationMs }
}
