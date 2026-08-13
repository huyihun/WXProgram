/**
 * 记账结算周期：每月 10 号为默认定日；
 * 若当日非工作日则往前推至最近工作日。
 * 区间为 [本期结算日, 下一期结算日)
 */

/** 法定放假日（国务院通知连休日） */
const HOLIDAYS = {
  // 2025
  '2025-01-01': 1,
  '2025-01-28': 1,
  '2025-01-29': 1,
  '2025-01-30': 1,
  '2025-01-31': 1,
  '2025-02-01': 1,
  '2025-02-02': 1,
  '2025-02-03': 1,
  '2025-02-04': 1,
  '2025-04-04': 1,
  '2025-04-05': 1,
  '2025-04-06': 1,
  '2025-05-01': 1,
  '2025-05-02': 1,
  '2025-05-03': 1,
  '2025-05-04': 1,
  '2025-05-05': 1,
  '2025-05-31': 1,
  '2025-06-01': 1,
  '2025-06-02': 1,
  '2025-10-01': 1,
  '2025-10-02': 1,
  '2025-10-03': 1,
  '2025-10-04': 1,
  '2025-10-05': 1,
  '2025-10-06': 1,
  '2025-10-07': 1,
  '2025-10-08': 1,
  // 2026
  '2026-01-01': 1,
  '2026-01-02': 1,
  '2026-01-03': 1,
  '2026-02-15': 1,
  '2026-02-16': 1,
  '2026-02-17': 1,
  '2026-02-18': 1,
  '2026-02-19': 1,
  '2026-02-20': 1,
  '2026-02-21': 1,
  '2026-02-22': 1,
  '2026-02-23': 1,
  '2026-04-04': 1,
  '2026-04-05': 1,
  '2026-04-06': 1,
  '2026-05-01': 1,
  '2026-05-02': 1,
  '2026-05-03': 1,
  '2026-05-04': 1,
  '2026-05-05': 1,
  '2026-06-19': 1,
  '2026-06-20': 1,
  '2026-06-21': 1,
  '2026-09-25': 1,
  '2026-09-26': 1,
  '2026-09-27': 1,
  '2026-10-01': 1,
  '2026-10-02': 1,
  '2026-10-03': 1,
  '2026-10-04': 1,
  '2026-10-05': 1,
  '2026-10-06': 1,
  '2026-10-07': 1,
}

/** 调休上班日（周末也可能上班） */
const WORKDAYS_ON_WEEKEND = {
  '2025-01-26': 1,
  '2025-02-08': 1,
  '2025-04-27': 1,
  '2025-09-28': 1,
  '2025-10-11': 1,
  '2026-01-04': 1,
  '2026-02-14': 1,
  '2026-02-28': 1,
  '2026-05-09': 1,
  '2026-09-20': 1,
  '2026-10-10': 1,
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseYmd(dateStr) {
  const parts = String(dateStr).split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

export function addDays(dateStr, delta) {
  const d = parseYmd(dateStr)
  d.setDate(d.getDate() + delta)
  return formatDate(d)
}

export function isWorkday(dateStr) {
  if (WORKDAYS_ON_WEEKEND[dateStr]) return true
  if (HOLIDAYS[dateStr]) return false
  const day = parseYmd(dateStr).getDay()
  return day !== 0 && day !== 6
}

/** 某年某月结算日：默认 10 号，非工作日则往前推 */
export function resolveSettlementDate(year, month) {
  let dateStr = `${year}-${pad2(month)}-10`
  while (!isWorkday(dateStr)) {
    dateStr = addDays(dateStr, -1)
  }
  return dateStr
}

/**
 * 包含 refDate 的本期账期
 * @returns {{ start: string, end: string, endInclusive: string, label: string }}
 */
export function getBillingPeriod(refDate) {
  const ref = refDate || formatDate(new Date())
  const parts = String(ref).split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])

  const thisSettle = resolveSettlementDate(y, m)
  const prevY = m === 1 ? y - 1 : y
  const prevM = m === 1 ? 12 : m - 1
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const prevSettle = resolveSettlementDate(prevY, prevM)
  const nextSettle = resolveSettlementDate(nextY, nextM)

  let start = thisSettle
  let end = nextSettle
  if (ref < thisSettle) {
    start = prevSettle
    end = thisSettle
  }

  const endInclusive = addDays(end, -1)
  return {
    start,
    end,
    endInclusive,
    label: `${start} ~ ${endInclusive}`,
  }
}

/** 账期内每一天，倒序（新→旧） */
export function listPeriodDays(start, endExclusive) {
  const days = []
  let d = start
  while (d < endExclusive) {
    days.push(d)
    d = addDays(d, 1)
  }
  days.reverse()
  return days
}

/** 指定「几月」的账期：[该月结算日, 下月结算日) */
export function getMonthBillingPeriod(year, month) {
  const y = Number(year)
  const m = Number(month)
  const start = resolveSettlementDate(y, m)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const end = resolveSettlementDate(nextY, nextM)
  const endInclusive = addDays(end, -1)
  return {
    start,
    end,
    endInclusive,
    label: `${start} ~ ${endInclusive}`,
  }
}

/** 自然月区间：[月初, 次月初) */
export function getCalendarMonthRange(year, month) {
  const y = Number(year)
  const m = Number(month)
  const start = `${y}-${pad2(m)}-01`
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const end = `${nextY}-${pad2(nextM)}-01`
  const endInclusive = addDays(end, -1)
  return {
    start,
    end,
    endInclusive,
    label: `${start} ~ ${endInclusive}`,
  }
}
