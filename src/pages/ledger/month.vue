<template>
  <PageRoot>
    <view class="month-page">
      <view class="summary-card">
        <view class="summary-top">
          <text class="summary-label">{{ pageTitle }}</text>
          <view class="summary-links">
            <view class="analyze-link" @tap="openAnalyze">
              <view class="icon-analyze">
                <view class="icon-analyze-ring" />
                <view class="icon-analyze-slice" />
              </view>
              <text class="analyze-link-text">本月支出分析</text>
            </view>
            <view v-if="showYearEntry" class="year-link" @tap="goYear">
              <text class="year-link-text">{{ yearLabel }}</text>
              <text class="year-link-arrow">›</text>
            </view>
          </view>
        </view>
        <text class="summary-range">{{ periodLabel }}</text>
        <text class="summary-total">¥{{ formatAmount(monthTotal) }}</text>
      </view>

      <PageLoading v-if="loading" />
      <view v-else-if="dayRows.length === 0" class="status-tip">这段时间还没有支出</view>
      <view v-else class="day-list">
        <view
          v-for="item in dayRows"
          :key="item.date"
          class="day-row"
          hover-class="day-row--active"
          @tap="goDay(item.date)"
        >
          <view class="day-main">
            <text class="day-date">{{ item.date }}</text>
            <text class="day-meta">{{ item.count }} 笔</text>
          </view>
          <view class="day-side">
            <text class="day-total">¥{{ formatAmount(item.total) }}</text>
            <text class="day-arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <view
      class="sheet-mask"
      :class="{ show: panelOpen }"
      @tap="closeAnalyze"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: panelOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-header">
        <text class="panel-title">本月支出分析</text>
        <text class="panel-close" @tap="closeAnalyze">关闭</text>
      </view>

      <view v-if="monthRows.length === 0" class="panel-empty">这段时间还没有支出</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view class="section">
          <text class="section-title">分类汇总</text>
          <text class="section-sub">按备注智能归类 · 合计 ¥{{ formatAmount(monthTotal) }}</text>
          <view v-for="cat in categoryRows" :key="cat.name" class="cat-block">
            <view class="cat-row" hover-class="cat-row--active" @tap="toggleCat(cat.name)">
              <view class="cat-main">
                <text class="cat-arrow">{{ expandedCat === cat.name ? '▾' : '›' }}</text>
                <text class="cat-name">{{ cat.name }}</text>
                <text class="cat-count">{{ cat.count }} 笔</text>
              </view>
              <view class="cat-side">
                <text class="cat-amount">¥{{ formatAmount(cat.total) }}</text>
                <text class="cat-pct">{{ cat.percent }}%</text>
              </view>
            </view>
            <view v-if="expandedCat === cat.name" class="cat-detail">
              <view v-for="item in cat.items" :key="item._id" class="item-row">
                <view class="item-main">
                  <text class="item-note">{{ item.note || '无备注' }}</text>
                  <text class="item-date">{{ item.date }}</text>
                </view>
                <text class="item-amount">¥{{ formatAmount(item.amount) }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">花钱最多的三天</text>
          <view v-for="day in topDays" :key="'top-' + day.date" class="day-block">
            <view class="day-block-head">
              <text class="day-block-date">{{ day.date }}</text>
              <text class="day-block-total">¥{{ formatAmount(day.total) }}</text>
            </view>
            <view v-for="item in day.items" :key="item._id" class="item-row">
              <text class="item-note">{{ item.note || '无备注' }}</text>
              <text class="item-amount">¥{{ formatAmount(item.amount) }}</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">花钱最少的三天</text>
          <view v-for="day in bottomDays" :key="'bot-' + day.date" class="day-block">
            <view class="day-block-head">
              <text class="day-block-date">{{ day.date }}</text>
              <text class="day-block-total">¥{{ formatAmount(day.total) }}</text>
            </view>
            <view v-for="item in day.items" :key="item._id" class="item-row">
              <text class="item-note">{{ item.note || '无备注' }}</text>
              <text class="item-amount">¥{{ formatAmount(item.amount) }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { getToday, getExpensesInRange } from '@/api/ledger'
import {
  getBillingPeriod,
  getMonthBillingPeriod,
  listPeriodDays,
} from '@/utils/billingPeriod'

const loading = ref(false)
const monthTotal = ref(0)
const periodLabel = ref('')
const pageTitle = ref('本月支出')
const dayRows = ref([])
const monthRows = ref([])
const queryYear = ref(0)
const queryMonth = ref(0)
const showYearEntry = ref(true)
const yearLabel = `${new Date().getFullYear()}年支出`
const panelOpen = ref(false)
const categoryRows = ref([])
const topDays = ref([])
const bottomDays = ref([])
const expandedCat = ref('')

onLoad((query) => {
  if (query && query.y && query.m) {
    queryYear.value = Number(query.y)
    queryMonth.value = Number(query.m)
    showYearEntry.value = false
    pageTitle.value = `${queryMonth.value}月支出`
  }
  loadMonth()
})

function formatAmount(n) {
  const num = Number(n) || 0
  return num.toFixed(2)
}

function goDay(date) {
  uni.navigateTo({ url: `/pages/ledger/day?date=${date}` })
}

function goYear() {
  uni.navigateTo({ url: '/pages/ledger/year' })
}

function resolvePeriod(today) {
  if (queryYear.value && queryMonth.value) {
    return getMonthBillingPeriod(queryYear.value, queryMonth.value)
  }
  return getBillingPeriod(today)
}

/** 关键词智能归类：先匹配靠前规则，未命中则保留原备注 */
const CATEGORY_RULES = [
  {
    name: '饮料喝水',
    words: [
      '水', '饮料', '咖啡', '奶茶', '可乐', '果汁', '豆浆', '牛奶', '酸奶',
      '茶', '啤酒', '红酒', '白酒', '酒', '气泡水', '矿泉水', '苏打', '红牛',
    ],
  },
  {
    name: '打球娱乐',
    words: [
      '打球', '篮球', '足球', '羽毛球', '网球', '乒乓球', '高尔夫', '台球', '桌球', '打桌球',
      '健身', '游泳', '跑步', '瑜伽', '电影', '游戏', '娱乐', '麻将', 'KTV',
      'ktv', '旅游', '门票', '演唱会', '剧本杀', '桌游',
    ],
  },
  {
    name: '生活用品',
    words: [
      '生活用品', '日用', '纸巾', '湿巾', '洗衣液', '洗洁精', '牙膏', '牙刷',
      '洗发水', '沐浴露', '香皂', '肥皂', '卫生纸', '垃圾袋', '拖把', '扫把',
      '超市', '日百', '洗护', '清洁', '袜子', '小米膜', '贴膜', '手机膜',
    ],
  },
  {
    name: '餐饮饮食',
    words: [
      '午餐', '晚餐', '早饭', '早餐', '夜宵', '外卖', '吃饭', '食堂', '盒饭',
      '面', '饭', '火锅', '烧烤', '小吃', '零食', '水果', '菜', '肉', '面包',
      '蛋糕', '点心', '汉堡', '披萨', '寿司', '饺子', '包子',
    ],
  },
  {
    name: '交通出行',
    words: [
      '地铁', '公交', '打车', '出租', '滴滴', '加油', '停车', '高铁', '火车',
      '机票', '飞机', '过路费', '共享单车', '电车', '油费',
    ],
  },
  {
    name: '住房物业',
    words: ['房租', '租金', '水电', '电费', '水费', '燃气', '物业', '宽带', '网费'],
  },
  {
    name: '通讯数码',
    words: ['话费', '流量', '手机', '充电', '耳机', '数码', '会员'],
  },
  {
    name: '医疗健康',
    words: ['药', '医院', '诊所', '挂号', '体检', '口罩', '维生素'],
  },
]

function classifyNote(note) {
  const text = (note || '').trim()
  if (!text) return '无备注'
  let bestName = ''
  let bestLen = 0
  for (let i = 0; i < CATEGORY_RULES.length; i++) {
    const rule = CATEGORY_RULES[i]
    for (let j = 0; j < rule.words.length; j++) {
      const word = rule.words[j]
      if (word.length <= bestLen) continue
      if (text.indexOf(word) < 0) continue
      bestLen = word.length
      bestName = rule.name
    }
  }
  if (bestName) return bestName
  return text
}

function buildAnalyze() {
  const rows = monthRows.value
  const total = monthTotal.value
  const catMap = {}

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = classifyNote(row.note)
    if (!catMap[name]) catMap[name] = { name, total: 0, count: 0, items: [] }
    catMap[name].total += Number(row.amount) || 0
    catMap[name].count += 1
    catMap[name].items.push(row)
  }

  const cats = Object.keys(catMap).map((key) => catMap[key])
  cats.sort((a, b) => b.total - a.total)
  for (let i = 0; i < cats.length; i++) {
    const pct = total > 0 ? (cats[i].total / total) * 100 : 0
    cats[i].percent = pct.toFixed(1)
    cats[i].items.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
  }
  categoryRows.value = cats
  expandedCat.value = ''

  const byDate = {}
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const date = row.date
    if (!byDate[date]) byDate[date] = { date, total: 0, items: [] }
    byDate[date].total += Number(row.amount) || 0
    byDate[date].items.push(row)
  }

  const days = Object.keys(byDate).map((key) => byDate[key])
  for (let i = 0; i < days.length; i++) {
    days[i].items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  const byDesc = days.slice().sort((a, b) => b.total - a.total)
  const byAsc = days.slice().sort((a, b) => a.total - b.total)
  topDays.value = byDesc.slice(0, 3)
  bottomDays.value = byAsc.slice(0, 3)
}

function toggleCat(name) {
  if (expandedCat.value === name) {
    expandedCat.value = ''
    return
  }
  expandedCat.value = name
}

function openAnalyze() {
  buildAnalyze()
  panelOpen.value = true
}

function closeAnalyze() {
  panelOpen.value = false
  expandedCat.value = ''
}

async function loadMonth() {
  loading.value = true
  const today = getToday()
  const period = resolvePeriod(today)
  periodLabel.value = period.label
  try {
    const rows = await getExpensesInRange(period.start, period.end)
    const map = {}
    const valid = []
    let sum = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const date = row.date
      if (date > today) continue
      valid.push(row)
      if (!map[date]) map[date] = { total: 0, count: 0 }
      map[date].total += Number(row.amount) || 0
      map[date].count += 1
      sum += Number(row.amount) || 0
    }
    monthRows.value = valid
    monthTotal.value = sum

    const days = listPeriodDays(period.start, period.end)
    const list = []
    for (let i = 0; i < days.length; i++) {
      const date = days[i]
      if (date > today) continue
      const info = map[date]
      if (!info || !info.count) continue
      list.push({
        date,
        total: info.total,
        count: info.count,
      })
    }
    dayRows.value = list
  } catch (err) {
    console.error('加载本月支出失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.month-page {
  padding-bottom: 48rpx;
}

.summary-card {
  background: $color-card;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
}

.summary-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.summary-label {
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.4;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.summary-links {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}

.analyze-link {
  display: flex;
  align-items: center;
  padding: 10rpx 16rpx;
  margin: -10rpx -8rpx 0 0;
  background: rgba(74, 159, 232, 0.12);
  border-radius: 16rpx;
}

.icon-analyze {
  position: relative;
  width: 22rpx;
  height: 22rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.icon-analyze-ring {
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  border: 3rpx solid $color-primary-dark;
  box-sizing: border-box;
  opacity: 0.45;
}

.icon-analyze-slice {
  position: absolute;
  left: 11rpx;
  top: 0;
  width: 11rpx;
  height: 11rpx;
  border-radius: 0 22rpx 0 0;
  background: $color-primary-dark;
}

.analyze-link-text {
  font-size: 26rpx;
  font-weight: 700;
  color: $color-primary-dark;
  letter-spacing: 1rpx;
}

.year-link {
  display: flex;
  align-items: center;
  padding: 10rpx 16rpx;
  margin: 0 -8rpx 0 0;
  background: rgba(74, 159, 232, 0.12);
  border-radius: 16rpx;
}

.year-link-text {
  font-size: 28rpx;
  font-weight: 700;
  color: $color-primary-dark;
  letter-spacing: 1rpx;
}

.year-link-arrow {
  margin-left: 4rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-primary-dark;
  line-height: 1;
}

.summary-range {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  margin-bottom: 16rpx;
}

.summary-total {
  display: block;
  font-size: 56rpx;
  font-weight: 700;
  color: $color-primary-dark;
}

.status-tip {
  padding: 64rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.day-list {
  background: $color-card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.day-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.day-row:last-child {
  border-bottom: none;
}

.day-row--active {
  background: rgba(0, 0, 0, 0.02);
}

.day-main {
  flex: 1;
  min-width: 0;
}

.day-date {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 6rpx;
}

.day-meta {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
}

.day-side {
  display: flex;
  align-items: center;
  margin-left: 20rpx;
  flex-shrink: 0;
}

.day-total {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-primary-dark;
}

.day-arrow {
  font-size: 36rpx;
  color: $color-primary;
  margin-left: 8rpx;
  line-height: 1;
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.25s ease,
    visibility 0.25s ease;
  z-index: 200;
}

.sheet-mask.show {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 72vh;
  display: flex;
  flex-direction: column;
  background: $color-card;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -8rpx 32rpx rgba(43, 127, 212, 0.12);
  transform: translateY(100%);
  transition: transform 0.25s ease;
  z-index: 201;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  pointer-events: none;
}

.sheet.open {
  transform: translateY(0);
  pointer-events: auto;
}

.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 16rpx auto 0;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx 24rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
}

.panel-close {
  font-size: 26rpx;
  color: $color-primary-dark;
  padding: 8rpx;
}

.panel-empty {
  padding: 64rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.panel-scroll {
  flex: 1;
  height: 0;
  padding: 8rpx 0 24rpx;
  box-sizing: border-box;
}

.section {
  padding: 20rpx 32rpx 8rpx;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 8rpx;
}

.section-sub {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
  margin-bottom: 16rpx;
}

.cat-block {
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.cat-block:last-child {
  border-bottom: none;
}

.cat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
}

.cat-row--active {
  opacity: 0.75;
}

.cat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  margin-right: 16rpx;
}

.cat-arrow {
  width: 28rpx;
  font-size: 26rpx;
  color: $color-primary;
  flex-shrink: 0;
}

.cat-name {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $color-title;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-count {
  margin-left: 12rpx;
  font-size: 22rpx;
  color: $color-subtitle;
  flex-shrink: 0;
}

.cat-side {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.cat-amount {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-primary-dark;
}

.cat-pct {
  margin-left: 16rpx;
  min-width: 72rpx;
  text-align: right;
  font-size: 24rpx;
  color: $color-subtitle;
}

.cat-detail {
  margin: 0 0 12rpx;
  padding: 8rpx 16rpx 12rpx;
  background: rgba(74, 159, 232, 0.06);
  border-radius: 12rpx;
}

.day-block {
  margin-bottom: 20rpx;
  padding: 20rpx;
  background: rgba(74, 159, 232, 0.06);
  border-radius: 16rpx;
}

.day-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.day-block-date {
  font-size: 26rpx;
  font-weight: 600;
  color: $color-title;
}

.day-block-total {
  font-size: 26rpx;
  font-weight: 700;
  color: $color-primary-dark;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
}

.item-main {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
}

.item-note {
  display: block;
  font-size: 24rpx;
  color: $color-title;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: $color-subtitle;
}

.item-amount {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 600;
  color: $color-title;
}
</style>
