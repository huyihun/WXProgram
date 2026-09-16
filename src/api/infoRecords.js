/**
 * 信息记录云库
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - info_records（kind: work | life | private | pin）
 *
 * 单次 get 最多 20 条是平台硬限制；列表必须 skip 循环拉全，禁止只取一页。
 */

const db = wx.cloud.database()
/** 微信云库单次 get 上限，仅用于循环分页，不是业务「只查 20 条」 */
const BATCH = 20
const COL = 'info_records'

const RECORD_KINDS = {
  work: true,
  life: true,
  private: true,
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

export async function listByKind(kind) {
  if (!RECORD_KINDS[kind]) return []
  return fetchAllWhere({ kind }, 'updatedAt', 'desc')
}

export async function addRecord(kind, fields) {
  if (!RECORD_KINDS[kind]) throw new Error('invalid kind')
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: {
      kind,
      title: (fields.title || '').trim(),
      account: (fields.account || '').trim(),
      secret: (fields.secret || '').trim(),
      url: (fields.url || '').trim(),
      note: (fields.note || '').trim(),
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function updateRecord(id, fields) {
  if (!id) throw new Error('missing id')
  await db.collection(COL).doc(id).update({
    data: {
      title: (fields.title || '').trim(),
      account: (fields.account || '').trim(),
      secret: (fields.secret || '').trim(),
      url: (fields.url || '').trim(),
      note: (fields.note || '').trim(),
      updatedAt: Date.now(),
    },
  })
}

export async function removeRecord(id) {
  if (!id) throw new Error('missing id')
  await db.collection(COL).doc(id).remove()
}

export async function getPinDoc() {
  const res = await db.collection(COL).where({ kind: 'pin' }).limit(1).get()
  return (res.data && res.data[0]) || null
}

export async function setPin(pin) {
  const value = String(pin || '').trim()
  if (!value) throw new Error('empty pin')
  const now = Date.now()
  const existing = await getPinDoc()
  if (existing) {
    await db.collection(COL).doc(existing._id).update({
      data: { pin: value, updatedAt: now },
    })
    return existing._id
  }
  const res = await db.collection(COL).add({
    data: { kind: 'pin', pin: value, createdAt: now, updatedAt: now },
  })
  return res._id
}

export async function verifyPin(input) {
  const doc = await getPinDoc()
  if (!doc) return false
  return String(input || '').trim() === String(doc.pin || '')
}
