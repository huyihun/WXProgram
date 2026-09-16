/**
 * 分身生活数据投喂：聚合 6 大模块云端数据 → 结构化文本
 *
 * 模块：记事本 / 记账 / 生活用品 / 减肥 / 物品评测 / 自律
 * 拉取层一律分页拉全量；统计（总额/连击/告急清单）基于全量计算；
 * 文本层明细条目按上限裁剪，超 30000 字（消化接口 MAX_LLM_CHARS）时
 * 反复对最长明细段「保旧 2/3 裁尾」直到放得下。
 */

import { getTodayPlan, getPlanHistory, getCasuals, getMoodHistory } from '@/api/notebook'
import { getExpensesInRange } from '@/api/ledger'
import { listSupplies } from '@/api/supplies'
import {
  getRules,
  getTip,
  getTargetWeight,
  getCurrentWeight,
  getAllWeights,
  getAllCheckins,
  calcStreak,
  getAllNotes,
  getAllDayLogs,
  getToday,
} from '@/api/diet'
import { listAllRatedItems } from '@/api/supplyRated'
import {
  getAllCheckins as getSeriousCheckins,
  calcStreak as calcSeriousStreak,
  getAllStamps,
  getAllNightPlans,
  getAllDangers,
  getAllReflections,
} from '@/api/serious'

const TEXT_CAP = 30000

function md(date) {
  const s = String(date || '')
  if (s.length >= 10) return s.slice(5, 10).replace('-', '/')
  return s
}

function shiftDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = function (n) {
    return String(n).padStart(2, '0')
  }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function oneLine(text, cap) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  const n = cap || 60
  if (s.length > n) return s.slice(0, n) + '…'
  return s
}

/** 时间戳 → 本地 MM/DD（toISOString 是 UTC，不能直接用） */
function tsToMd(ts) {
  const d = new Date(Number(ts) || 0)
  if (!d.getTime()) return ''
  const pad = function (n) {
    return String(n).padStart(2, '0')
  }
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate())
}

async function fetchNotebook() {
  // getPlanHistory 不含今日，单独取今日计划补在最前
  const todayPlan = await getTodayPlan()
  const history = await getPlanHistory()
  const plans = history || []
  if (todayPlan && todayPlan.content) {
    plans.unshift({ date: getToday(), content: todayPlan.content })
  }
  const casuals = await getCasuals()
  const moods = await getMoodHistory()
  return { plans: plans, casuals: casuals || [], moods: moods || [] }
}

async function fetchLedger() {
  const expenses = await getExpensesInRange('2000-01-01', '2999-12-31')
  return { expenses: expenses || [] }
}

async function fetchSupplies() {
  return { supplies: (await listSupplies()) || [] }
}

async function fetchDiet() {
  const rules = await getRules()
  const tip = await getTip()
  const target = await getTargetWeight()
  const current = await getCurrentWeight()
  const weights = await getAllWeights()
  const checkins = await getAllCheckins()
  const dayLogs = await getAllDayLogs()
  const notes = await getAllNotes()
  return {
    rules: rules,
    tip: tip,
    target: target,
    current: current,
    weights: weights || [],
    checkins: checkins || [],
    dayLogs: dayLogs || [],
    notes: notes || [],
  }
}

async function fetchRated() {
  return { rated: (await listAllRatedItems()) || [] }
}

async function fetchSerious() {
  const checkins = await getSeriousCheckins()
  const stamps = await getAllStamps()
  const nights = await getAllNightPlans()
  const dangers = await getAllDangers()
  const reflections = await getAllReflections()
  return {
    checkins: checkins || [],
    stamps: stamps || [],
    nights: nights || [],
    dangers: dangers || [],
    reflections: reflections || [],
  }
}

/* ---------- 各模块文本段（lines 新在前） ---------- */

function sectionNotebook(d) {
  const today = getToday()
  const lines = []
  const past = []
  const future = []
  for (let i = 0; i < d.plans.length; i++) {
    const p = d.plans[i]
    if (!p || !p.date) continue
    if (p.date >= today) future.push(p)
    else past.push(p)
  }
  future.sort(function (a, b) {
    return a.date < b.date ? -1 : 1
  })
  const planLines = []
  for (let i = 0; i < future.length && planLines.length < 30; i++) {
    planLines.push(md(future[i].date) + ' ' + oneLine(future[i].content, 80))
  }
  for (let i = 0; i < past.length && planLines.length < 70; i++) {
    planLines.push(md(past[i].date) + ' ' + oneLine(past[i].content, 80))
  }
  if (planLines.length) lines.push('计划（近' + planLines.length + '天，新在前）：')
  for (let i = 0; i < planLines.length; i++) lines.push('- ' + planLines[i])

  if (d.casuals.length) lines.push('随心记（最近' + Math.min(d.casuals.length, 100) + '条）：')
  for (let i = 0; i < d.casuals.length && i < 100; i++) {
    const c = d.casuals[i]
    lines.push('- ' + tsToMd(c.createdAt) + ' ' + oneLine(c.content, 60))
  }

  if (d.moods.length) lines.push('心情（最近' + Math.min(d.moods.length, 100) + '天）：')
  for (let i = 0; i < d.moods.length && i < 100; i++) {
    const m = d.moods[i]
    const extra = m.note ? '（' + oneLine(m.note, 30) + '）' : ''
    lines.push('- ' + md(m.date) + ' ' + (m.moodLabel || m.moodKey || '') + extra)
  }
  return { key: 'notebook', head: '【记事本】', lines: lines }
}

function sectionLedger(d) {
  const list = d.expenses
  const lines = []
  if (!list.length) return { key: 'ledger', head: '【记账】', lines: [] }

  let total = 0
  const byMonth = {}
  const weekStart = shiftDate(-6)
  const monthStart = shiftDate(new Date().getDate() - 1)
  let weekSum = 0
  let weekCount = 0
  let monthSum = 0
  let monthCount = 0
  for (let i = 0; i < list.length; i++) {
    const e = list[i]
    const amt = Number(e.amount) || 0
    total += amt
    const key = String(e.date || '').slice(0, 7)
    if (!byMonth[key]) byMonth[key] = { sum: 0, count: 0 }
    byMonth[key].sum += amt
    byMonth[key].count += 1
    if (e.date >= weekStart) {
      weekSum += amt
      weekCount += 1
    }
    if (e.date >= monthStart) {
      monthSum += amt
      monthCount += 1
    }
  }

  lines.push(
    '全量 ' + list.length + ' 笔，累计 ¥' + Math.round(total) +
    '；本周(近7天) ¥' + Math.round(weekSum) + '/' + weekCount + '笔' +
    '；本月 ¥' + Math.round(monthSum) + '/' + monthCount + '笔'
  )
  const months = Object.keys(byMonth).sort().reverse()
  const monthParts = []
  for (let i = 0; i < months.length && i < 12; i++) {
    monthParts.push(months[i] + ' ¥' + Math.round(byMonth[months[i]].sum) + '/' + byMonth[months[i]].count + '笔')
  }
  if (monthParts.length) lines.push('月度：' + monthParts.join('；'))

  const sorted = list.slice().sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date))
  })
  lines.push('明细（最近' + Math.min(sorted.length, 100) + '笔）：')
  for (let i = 0; i < sorted.length && i < 100; i++) {
    lines.push('- ' + md(sorted[i].date) + ' ' + oneLine(sorted[i].note || '支出', 20) + ' ' + (Number(sorted[i].amount) || 0) + '元')
  }
  return { key: 'ledger', head: '【记账】', lines: lines }
}

function sectionSupplies(d) {
  const lines = []
  const low = []
  for (let i = 0; i < d.supplies.length; i++) {
    const s = d.supplies[i]
    if (s && Number(s.remainPercent) <= 20) low.push(s)
  }
  if (d.supplies.length) {
    lines.push('共 ' + d.supplies.length + ' 件；库存≤20%告急 ' + low.length + ' 件：' + low.slice(0, 20).map(function (s) { return s.name }).join('、'))
  }
  for (let i = 0; i < d.supplies.length && i < 200; i++) {
    const s = d.supplies[i]
    const brand = s.brand ? '(' + s.brand + ')' : ''
    const price = s.price ? '¥' + s.price : ''
    const quality = s.quality ? ' ' + s.quality : ''
    lines.push('- ' + (s.name || '未命名') + brand + price + quality + ' 剩余' + (Number(s.remainPercent) || 0) + '% 日耗' + (Number(s.dailyConsume) || 0) + '%')
  }
  return { key: 'supplies', head: '【生活用品】', lines: lines }
}

function sectionDiet(d) {
  const lines = []
  const targetW = d.target && (d.target.targetWeight || d.target.weight)
  const currentW = d.current && (d.current.currentWeight || d.current.weight)
  if (targetW || currentW) {
    const cur = currentW
      ? '当前 ' + currentW + ' 斤' + (d.current && d.current.at ? '（' + tsToMd(d.current.at) + '）' : '')
      : ''
    lines.push('目标体重 ' + (targetW || '未设') + ' 斤；' + cur)
  }
  if (d.rules && (d.rules.onlyEat || d.rules.dontEat)) {
    lines.push('饮食规则：只吃 ' + (d.rules.onlyEat || '不限') + '；不吃 ' + (d.rules.dontEat || '不限'))
  }
  if (d.tip && d.tip.content) {
    lines.push('秘诀：' + oneLine(d.tip.content, 80))
  }
  if (d.checkins.length) {
    const dates = d.checkins.map(function (c) { return c.date })
    const streak = calcStreak(dates)
    lines.push('打卡：连续 ' + streak + ' 天，累计 ' + d.checkins.length + ' 天')
  }
  if (d.dayLogs.length) {
    lines.push('近' + Math.min(d.dayLogs.length, 30) + '天饮食运动（新在前）：')
    for (let i = 0; i < d.dayLogs.length && i < 30; i++) {
      const r = d.dayLogs[i]
      const sports = (r.sports || [])
        .map(function (s) { return (s.name || '') + (s.minutes ? s.minutes + '分钟' : '') })
        .filter(Boolean)
        .join('、')
      const parts = []
      if (r.lunch) parts.push('午:' + oneLine(r.lunch, 20) + (r.lunchAmount ? r.lunchAmount + '份' : ''))
      if (r.dinner) parts.push('晚:' + oneLine(r.dinner, 20) + (r.dinnerAmount ? r.dinnerAmount + '份' : ''))
      if (r.drink) parts.push('饮:' + oneLine(r.drink, 20))
      if (sports) parts.push('动:' + sports)
      if (parts.length) lines.push('- ' + md(r.date) + ' ' + parts.join(' '))
    }
  }
  if (d.weights.length) {
    lines.push('体重曲线（最近' + Math.min(d.weights.length, 30) + '次）：')
    for (let i = 0; i < d.weights.length && i < 30; i++) {
      const w = d.weights[i]
      lines.push('- ' + md(w.date) + ' ' + (Number(w.weight) || 0) + ' 斤' + (w.time ? ' ' + w.time : ''))
    }
  }
  if (d.notes.length) {
    lines.push('心得（最近' + Math.min(d.notes.length, 20) + '条）：')
    for (let i = 0; i < d.notes.length && i < 20; i++) {
      lines.push('- ' + tsToMd(d.notes[i].createdAt) + ' ' + oneLine(d.notes[i].content, 50))
    }
  }
  return { key: 'diet', head: '【减肥】', lines: lines }
}

function sectionRated(d) {
  const lines = []
  if (d.rated.length) {
    lines.push('共 ' + d.rated.length + ' 件')
  }
  for (let i = 0; i < d.rated.length && i < 200; i++) {
    const r = d.rated[i]
    const cat = r.category || r.subtype || ''
    const brand = r.brand ? '(' + r.brand + ')' : ''
    const price = r.price ? '¥' + r.price : ''
    const review = r.review ? ' ' + oneLine(r.review, 30) : ''
    lines.push('- ' + (cat ? '[' + cat + '] ' : '') + (r.name || '未命名') + brand + price + ' ' + (Number(r.rating) || 0) + '分' + review)
  }
  return { key: 'rated', head: '【物品评测】', lines: lines }
}

function sectionSerious(d) {
  const lines = []
  if (d.checkins.length) {
    const dates = d.checkins.map(function (c) { return c.date })
    const streak = calcSeriousStreak(dates)
    lines.push('打卡连续 ' + streak + ' 天，累计 ' + d.checkins.length + ' 天')
  }
  if (d.stamps.length) {
    lines.push('印章（最近' + Math.min(d.stamps.length, 60) + '次）：')
    for (let i = 0; i < d.stamps.length && i < 60; i++) {
      const s = d.stamps[i]
      lines.push('- ' + tsToMd(s.at) + ' ' + (s.label || ''))
    }
  }
  if (d.nights.length) {
    lines.push('夜计划（最近' + Math.min(d.nights.length, 30) + '晚）：')
    for (let i = 0; i < d.nights.length && i < 30; i++) {
      const n = d.nights[i]
      const items = (n.items || [])
        .map(function (it) { return (it.done ? '[x]' : '[ ]') + (it.text || '') })
        .filter(function (s) { return s.length > 3 })
        .slice(0, 8)
        .join(' ')
      if (items) lines.push('- ' + md(n.nightKey || n.date) + ' ' + oneLine(items, 80))
    }
  }
  if (d.dangers.length) {
    lines.push('危险点警示（最近' + Math.min(d.dangers.length, 50) + '条）：')
    for (let i = 0; i < d.dangers.length && i < 50; i++) {
      lines.push('- ' + md(d.dangers[i].date) + ' ' + oneLine(d.dangers[i].text, 50))
    }
  }
  if (d.reflections.length) {
    lines.push('总结反思（最近' + Math.min(d.reflections.length, 60) + '天）：')
    for (let i = 0; i < d.reflections.length && i < 60; i++) {
      lines.push('- ' + md(d.reflections[i].date) + ' ' + oneLine(d.reflections[i].content, 60))
    }
  }
  return { key: 'serious', head: '【自律】', lines: lines }
}

/* ---------- 组装 ---------- */

function assemble(sections) {
  let out = ''
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    if (!s.lines.length) continue
    if (out) out += '\n\n'
    out += s.head + '\n' + s.lines.join('\n')
  }
  return out
}

/** 超上限时反复把最长明细段裁到 2/3（保留最新），统计段不动 */
function trimToFit(sections, cap) {
  let text = assemble(sections)
  let guard = 0
  while (text.length > cap && guard < 60) {
    guard += 1
    let longest = null
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].lines.length > 6) {
        if (!longest || sections[i].lines.length > longest.lines.length) longest = sections[i]
      }
    }
    if (!longest) break
    longest.lines = longest.lines.slice(0, Math.max(6, Math.ceil(longest.lines.length * 2 / 3)))
    text = assemble(sections)
  }
  return text
}

function buildStats(counts, ledgerTotal, ledgerCount) {
  const parts = []
  if (ledgerCount) parts.push('账单 ' + ledgerCount + ' 笔/¥' + Math.round(ledgerTotal))
  if (counts.supplies) parts.push('用品 ' + counts.supplies + ' 件')
  if (counts.rated) parts.push('评测 ' + counts.rated + ' 件')
  if (counts.notebook) parts.push('记事 ' + counts.notebook + ' 条')
  if (counts.diet) parts.push('减肥记录 ' + counts.diet + ' 条')
  if (counts.serious) parts.push('自律记录 ' + counts.serious + ' 条')
  return parts.join(' · ')
}

/** 收集全部生活数据，返回 { text, statsText }；全模块空时抛错 */
export async function collectLifeDigest() {
  const [notebook, ledger, supplies, diet, rated, serious] = await Promise.all([
    fetchNotebook(),
    fetchLedger(),
    fetchSupplies(),
    fetchDiet(),
    fetchRated(),
    fetchSerious(),
  ])

  const ledgerTotal = ledger.expenses.reduce(function (s, e) { return s + (Number(e.amount) || 0) }, 0)
  const counts = {
    notebook: notebook.plans.length + notebook.casuals.length + notebook.moods.length,
    supplies: supplies.supplies.length,
    rated: rated.rated.length,
    diet: diet.weights.length + diet.dayLogs.length + diet.notes.length + diet.checkins.length,
    serious: serious.checkins.length + serious.stamps.length + serious.nights.length + serious.dangers.length + serious.reflections.length,
  }

  const sections = [
    sectionNotebook(notebook),
    sectionLedger(ledger),
    sectionSupplies(supplies),
    sectionDiet(diet),
    sectionRated(rated),
    sectionSerious(serious),
  ]

  const text = trimToFit(sections, TEXT_CAP)
  if (!text) {
    throw new Error('六个模块都还没有数据')
  }
  const header =
    '以下是主人各生活模块的全量记录（统计基于全量，明细可能截尾、新数据优先），' +
    '请消化为长期记忆：'
  return {
    text: (header + '\n\n' + text).slice(0, TEXT_CAP),
    statsText: buildStats(counts, ledgerTotal, ledger.expenses.length),
  }
}
