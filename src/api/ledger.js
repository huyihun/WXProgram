/**
 * 记账云数据库访问层
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - ledger_expenses
 *
 * 注意：小程序端单次 get 最多 20 条，需分页拉全。
 */

const db = wx.cloud.database()
const PAGE_SIZE = 20

function formatDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getToday() {
  return formatDate(new Date())
}

/** 格式化时间为 HH:mm */
export function formatTime(timestamp) {
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 按条件分页取全量 */
async function getAllByWhere(where) {
  const all = []
  let skip = 0
  while (true) {
    const res = await db
      .collection('ledger_expenses')
      .where(where)
      .skip(skip)
      .limit(PAGE_SIZE)
      .get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) {
      all.push(batch[i])
    }
    if (batch.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }
  return all
}

export async function getTodayExpenses() {
  return getExpensesByDate(getToday())
}

export async function getExpensesByDate(date) {
  const list = await getAllByWhere({ date: date })
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return list
}

/** 区间支出：[startDate, endDateExclusive) */
export async function getExpensesInRange(startDate, endDateExclusive) {
  const _ = db.command
  return getAllByWhere({
    date: _.gte(startDate).and(_.lt(endDateExclusive)),
  })
}

export async function addExpense({ amount, note }) {
  const now = Date.now()
  const res = await db.collection('ledger_expenses').add({
    data: {
      date: getToday(),
      amount: Number(amount),
      note: note || '',
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

export async function removeExpense(id) {
  await db.collection('ledger_expenses').doc(id).remove()
}
