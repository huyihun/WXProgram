/**
 * 经典语录云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - classic_quotes
 *
 * database 在函数内懒创建，避免启动阶段白屏
 * 小程序端单次 get 最多 20 条，列表查询需分页拉全
 */

const PAGE_SIZE = 20

function getDb() {
  return wx.cloud.database()
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

export async function getQuotes() {
  return fetchAll(() => getDb().collection('classic_quotes').orderBy('createdAt', 'desc'))
}

export async function addQuote(content) {
  const now = Date.now()
  const res = await getDb().collection('classic_quotes').add({
    data: { content, createdAt: now, updatedAt: now },
  })
  return res._id
}

export async function updateQuote(id, content) {
  await getDb()
    .collection('classic_quotes')
    .doc(id)
    .update({ data: { content, updatedAt: Date.now() } })
}

export async function removeQuote(id) {
  await getDb().collection('classic_quotes').doc(id).remove()
}

export function formatQuoteTime(timestamp) {
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
