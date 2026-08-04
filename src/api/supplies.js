/**
 * 生活用品云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - life_supplies
 *
 * 字段：name / brand / price / quality / channel /
 * remainPercent / dailyConsume / remainSyncedAt / createdAt / updatedAt
 */

const db = wx.cloud.database()
const DAY_MS = 24 * 60 * 60 * 1000

function clampPercent(n, fallback) {
  let v = Number(n)
  if (!isFinite(v)) v = fallback
  if (v < 0) v = 0
  if (v > 100) v = 100
  return Math.round(v)
}

export async function listSupplies() {
  const col = db.collection('life_supplies')
  // 云库 .get() 默认最多 20 条，需分页拉全
  const PAGE = 20
  const list = []
  let skip = 0

  while (true) {
    const res = await col.skip(skip).limit(PAGE).get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) {
      list.push(batch[i])
    }
    if (batch.length < PAGE) break
    skip += PAGE
  }

  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return list
}

export async function addSupply({
  name,
  brand,
  price,
  quality,
  channel,
  remainPercent,
  dailyConsume,
}) {
  const now = Date.now()
  const remain = clampPercent(remainPercent, 100)
  const daily = clampPercent(dailyConsume, 0)

  const res = await db.collection('life_supplies').add({
    data: {
      name: name || '',
      brand: brand || '',
      price: Number(price) || 0,
      quality: quality || '',
      channel: channel || '',
      remainPercent: remain,
      dailyConsume: daily,
      remainSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function updateSupply(id, patch) {
  const data = { updatedAt: Date.now() }
  if (patch.name !== undefined) data.name = patch.name || ''
  if (patch.brand !== undefined) data.brand = patch.brand || ''
  if (patch.price !== undefined) data.price = Number(patch.price) || 0
  if (patch.quality !== undefined) data.quality = patch.quality || ''
  if (patch.channel !== undefined) data.channel = patch.channel || ''
  if (patch.dailyConsume !== undefined) data.dailyConsume = clampPercent(patch.dailyConsume, 0)
  if (patch.remainPercent !== undefined) {
    data.remainPercent = clampPercent(patch.remainPercent, 0)
    data.remainSyncedAt =
      patch.remainSyncedAt !== undefined ? patch.remainSyncedAt : Date.now()
  } else if (patch.remainSyncedAt !== undefined) {
    data.remainSyncedAt = patch.remainSyncedAt
  }
  await db.collection('life_supplies').doc(id).update({ data })
}

export async function removeSupply(id) {
  await db.collection('life_supplies').doc(id).remove()
}

/** 按每日消耗推算剩余，并把结果写回云库 */
export async function syncDailyConsume(items) {
  const now = Date.now()
  const result = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const daily = Number(item.dailyConsume) || 0

    // 旧数据首次接入：只记同步时间，不回溯扣减
    if (!item.remainSyncedAt) {
      try {
        await updateSupply(item._id, { remainSyncedAt: now })
        result.push({ ...item, remainSyncedAt: now })
      } catch (err) {
        console.error('初始化同步时间失败', err)
        result.push(item)
      }
      continue
    }

    if (daily <= 0) {
      result.push(item)
      continue
    }

    const synced = item.remainSyncedAt
    const days = Math.floor((now - synced) / DAY_MS)
    if (days <= 0) {
      result.push(item)
      continue
    }

    const next = clampPercent((Number(item.remainPercent) || 0) - daily * days, 0)
    const nextSynced = synced + days * DAY_MS
    try {
      await updateSupply(item._id, { remainPercent: next, remainSyncedAt: nextSynced })
      result.push({ ...item, remainPercent: next, remainSyncedAt: nextSynced })
    } catch (err) {
      console.error('同步每日消耗失败', err)
      result.push(item)
    }
  }

  return result
}
