<template>
  <PageRoot>
    <view class="year-page">
      <view class="summary-card">
        <text class="summary-label">{{ year }}年支出</text>
        <text class="summary-total">¥{{ formatAmount(yearTotal) }}</text>
      </view>

      <PageLoading v-if="loading" />
      <view v-else-if="monthRows.length === 0" class="status-tip">还没有支出</view>
      <view v-else class="month-list">
        <view
          v-for="item in monthRows"
          :key="item.month"
          class="month-row"
          hover-class="month-row--active"
          @tap="goMonth(item.month)"
        >
          <view class="month-main">
            <text class="month-name">{{ item.month }}月</text>
            <text class="month-meta">{{ item.count }} 笔</text>
          </view>
          <view class="month-side">
            <text class="month-total">¥{{ formatAmount(item.total) }}</text>
            <text class="month-arrow">›</text>
          </view>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { getToday, getExpensesInRange } from '@/api/ledger'
import { resolveSettlementDate, getMonthBillingPeriod } from '@/utils/billingPeriod'

const year = new Date().getFullYear()
const loading = ref(false)
const yearTotal = ref(0)
const monthRows = ref([])

onMounted(() => {
  loadYear()
})

function formatAmount(n) {
  const num = Number(n) || 0
  return num.toFixed(2)
}

function goMonth(month) {
  uni.navigateTo({ url: `/pages/ledger/month?y=${year}&m=${month}` })
}

/** 已开始的最晚账期月份：未到本月结算日则仍算上月 */
function resolveMaxMonth(today) {
  const parts = today.split('-')
  const todayYear = Number(parts[0])
  const todayMonth = Number(parts[1])
  if (todayYear > year) return 12
  if (todayYear < year) return 0
  const thisSettle = resolveSettlementDate(year, todayMonth)
  if (today >= thisSettle) return todayMonth
  return todayMonth - 1
}

async function loadYear() {
  loading.value = true
  const today = getToday()
  const maxMonth = resolveMaxMonth(today)

  if (maxMonth < 1) {
    yearTotal.value = 0
    monthRows.value = []
    loading.value = false
    return
  }

  try {
    const periods = []
    for (let m = 1; m <= maxMonth; m++) {
      periods.push(getMonthBillingPeriod(year, m))
    }
    const rows = await getExpensesInRange(periods[0].start, periods[maxMonth - 1].end)
    const map = {}
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const date = row.date
      if (date > today) continue
      let m = 0
      for (let j = 0; j < periods.length; j++) {
        if (date >= periods[j].start && date < periods[j].end) {
          m = j + 1
          break
        }
      }
      if (!m) continue
      if (!map[m]) map[m] = { total: 0, count: 0 }
      map[m].total += Number(row.amount) || 0
      map[m].count += 1
    }

    let sum = 0
    const list = []
    for (let m = maxMonth; m >= 1; m--) {
      const info = map[m]
      if (!info || !info.count) continue
      sum += info.total
      list.push({
        month: m,
        total: info.total,
        count: info.count,
      })
    }
    yearTotal.value = sum
    monthRows.value = list
  } catch (err) {
    console.error('加载今年支出失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.year-page {
  padding-bottom: 48rpx;
}

.summary-card {
  background: $color-card;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
}

.summary-label {
  display: block;
  font-size: 28rpx;
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

.month-list {
  background: $color-card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.month-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.month-row:last-child {
  border-bottom: none;
}

.month-row--active {
  background: rgba(0, 0, 0, 0.02);
}

.month-main {
  flex: 1;
  min-width: 0;
}

.month-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 6rpx;
}

.month-meta {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
}

.month-side {
  display: flex;
  align-items: center;
  margin-left: 20rpx;
  flex-shrink: 0;
}

.month-total {
  font-size: 32rpx;
  font-weight: 600;
  color: #e74c3c;
}

.month-arrow {
  font-size: 36rpx;
  color: $color-primary;
  margin-left: 8rpx;
  line-height: 1;
}
</style>
