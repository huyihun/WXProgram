<template>
  <PageRoot>
    <view class="day-page">
      <view class="summary-card">
        <text class="summary-label">当日支出</text>
        <text class="summary-date">{{ date }}</text>
        <text class="summary-total">¥{{ formatAmount(dayTotal) }}</text>
      </view>

      <view class="list-header">
        <text class="list-title">明细</text>
        <text class="list-count">{{ list.length }} 笔</text>
      </view>

      <PageLoading v-if="loading" />
      <view v-else-if="list.length === 0" class="status-tip">这一天没有支出</view>
      <view v-else class="expense-list">
        <view v-for="item in list" :key="item._id" class="expense-item">
          <view class="expense-main">
            <text class="expense-amount">¥{{ formatAmount(item.amount) }}</text>
            <text class="expense-note">{{ item.note || '无备注' }}</text>
          </view>
          <view class="expense-side">
            <text class="expense-time">{{ formatTime(item.createdAt) }}</text>
          </view>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { getExpensesByDate, formatTime, getToday } from '@/api/ledger'

const date = ref(getToday())
const list = ref([])
const loading = ref(false)

const dayTotal = computed(() => {
  let sum = 0
  for (let i = 0; i < list.value.length; i++) {
    sum += Number(list.value[i].amount) || 0
  }
  return sum
})

onLoad((query) => {
  if (query && query.date) date.value = query.date
  loadDay()
})

function formatAmount(n) {
  const num = Number(n) || 0
  return num.toFixed(2)
}

async function loadDay() {
  loading.value = true
  try {
    list.value = await getExpensesByDate(date.value)
  } catch (err) {
    console.error('加载当日支出失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.day-page {
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
  margin-bottom: 8rpx;
}

.summary-date {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 16rpx;
}

.summary-total {
  display: block;
  font-size: 56rpx;
  font-weight: 700;
  color: $color-title;
}

.list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 0 8rpx;
}

.list-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
}

.list-count {
  font-size: 24rpx;
  color: $color-subtitle;
}

.status-tip {
  padding: 48rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.expense-list {
  background: $color-card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.expense-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.expense-item:last-child {
  border-bottom: none;
}

.expense-main {
  flex: 1;
  min-width: 0;
}

.expense-amount {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 6rpx;
}

.expense-note {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 24rpx;
  flex-shrink: 0;
}

.expense-time {
  font-size: 22rpx;
  color: $color-subtitle;
}
</style>
