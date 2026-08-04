<template>
  <PageRoot>
    <view class="month-page">
      <view class="summary-card">
        <view class="summary-top">
          <text class="summary-label">{{ pageTitle }}</text>
          <view v-if="showYearEntry" class="year-link" @tap="goYear">
            <text class="year-link-text">{{ yearLabel }}</text>
            <text class="year-link-arrow">›</text>
          </view>
        </view>
        <text class="summary-range">{{ periodLabel }}</text>
        <text class="summary-total">¥{{ formatAmount(monthTotal) }}</text>
      </view>

      <view v-if="loading" class="status-tip">加载中...</view>
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
  </PageRoot>
</template>

<script setup>
import { getToday, getExpensesInRange } from '@/api/ledger'
import {
  getBillingPeriod,
  getCalendarMonthRange,
  listPeriodDays,
} from '@/utils/billingPeriod'

const loading = ref(false)
const monthTotal = ref(0)
const periodLabel = ref('')
const pageTitle = ref('本月支出')
const dayRows = ref([])
const queryYear = ref(0)
const queryMonth = ref(0)
const showYearEntry = ref(true)
const yearLabel = `${new Date().getFullYear()}年支出`

onLoad((query) => {
  if (query && query.y && query.m) {
    queryYear.value = Number(query.y)
    queryMonth.value = Number(query.m)
    showYearEntry.value = false
    pageTitle.value = `${queryMonth.value}月支出`
  }
})

onShow(() => {
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
    return getCalendarMonthRange(queryYear.value, queryMonth.value)
  }
  return getBillingPeriod(today)
}

async function loadMonth() {
  loading.value = true
  const today = getToday()
  const period = resolvePeriod(today)
  periodLabel.value = period.label
  try {
    const rows = await getExpensesInRange(period.start, period.end)
    const map = {}
    let sum = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const date = row.date
      if (date > today) continue
      if (!map[date]) map[date] = { total: 0, count: 0 }
      map[date].total += Number(row.amount) || 0
      map[date].count += 1
      sum += Number(row.amount) || 0
    }
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
}

.year-link {
  display: flex;
  align-items: center;
  padding: 10rpx 16rpx;
  margin: -10rpx -8rpx 0 16rpx;
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
</style>
