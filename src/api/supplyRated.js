/**
 * 生活用品（评价类）云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - life_rated_items
 *
 * category: clothing | personal | household | fruit
 * subtype（仅 clothing）: tops | pants | underwear | socks | shoes
 * 字段：category / subtype / name / brand / price / quality / channel /
 * rating / review / createdAt / updatedAt
 */

const db = wx.cloud.database()

function clampRating(n) {
  let v = Number(n)
  if (!isFinite(v)) v = 5
  if (v < 1) v = 1
  if (v > 5) v = 5
  return Math.round(v)
}

export async function listRatedItems(category) {
  const col = db.collection('life_rated_items').where({ category: category || '' })
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

export async function addRatedItem({
  category,
  subtype,
  name,
  brand,
  price,
  quality,
  channel,
  rating,
  review,
}) {
  const now = Date.now()
  const res = await db.collection('life_rated_items').add({
    data: {
      category: category || '',
      subtype: subtype || '',
      name: name || '',
      brand: brand || '',
      price: Number(price) || 0,
      quality: quality || '',
      channel: channel || '',
      rating: clampRating(rating),
      review: review || '',
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function updateRatedItem(id, patch) {
  const data = { updatedAt: Date.now() }
  if (patch.name !== undefined) data.name = patch.name || ''
  if (patch.brand !== undefined) data.brand = patch.brand || ''
  if (patch.price !== undefined) data.price = Number(patch.price) || 0
  if (patch.quality !== undefined) data.quality = patch.quality || ''
  if (patch.channel !== undefined) data.channel = patch.channel || ''
  if (patch.subtype !== undefined) data.subtype = patch.subtype || ''
  if (patch.rating !== undefined) data.rating = clampRating(patch.rating)
  if (patch.review !== undefined) data.review = patch.review || ''
  await db.collection('life_rated_items').doc(id).update({ data })
}

export async function removeRatedItem(id) {
  await db.collection('life_rated_items').doc(id).remove()
}
