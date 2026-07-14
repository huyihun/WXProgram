<template>
  <view class="page">
    <CustomNav />
    <view class="date-header">
      <text class="date-label">今日</text>
      <text class="date-value">{{ today }}</text>
    </view>

    <view v-if="loading" class="status-tip">加载中...</view>
    <view v-else-if="planList.length === 0" class="empty">
      <text class="empty-text">今天还没有计划，点击右下角添加</text>
    </view>
    <view v-else class="plan-list">
      <view
        v-for="item in planList"
        :key="item._id"
        class="plan-card"
        @tap="handleEdit(item)"
      >
        <view v-if="formatTimeRange(item)" class="plan-time">
          {{ formatTimeRange(item) }}
        </view>
        <text class="plan-title">{{ item.title }}</text>
        <text v-if="item.content" class="plan-content">{{ truncate(item.content) }}</text>
        <text class="plan-delete" @tap.stop="handleDelete(item)">删除</text>
      </view>
    </view>

    <view class="fab" @tap="handleAdd">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { getTodayPlans, removePlan, getToday, truncate } from '@/api/notebook'

const planList = ref([])
const loading = ref(false)
const today = getToday()

onShow(() => {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    planList.value = await getTodayPlans()
  } catch (err) {
    console.error('加载计划失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  uni.navigateTo({ url: '/pages/notebook/plan/edit' })
}

function handleEdit(item) {
  uni.navigateTo({ url: `/pages/notebook/plan/edit?id=${item._id}` })
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这条计划吗？',
  })
  if (!res.confirm) return

  try {
    await removePlan(item._id)
    await loadList()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除计划失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

function formatTimeRange(item) {
  if (item.startTime && item.endTime) return `${item.startTime} - ${item.endTime}`
  if (item.startTime) return item.startTime
  return ''
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 120rpx;
  background-color: $color-bg;
}

.date-header {
  margin-bottom: 32rpx;
}

.date-label {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 8rpx;
}

.date-value {
  font-size: 36rpx;
  font-weight: 600;
  color: $color-title;
}

.status-tip,
.empty {
  text-align: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $color-subtitle;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.plan-card {
  position: relative;
  padding: 28rpx 32rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
}

.plan-time {
  display: inline-block;
  font-size: 24rpx;
  color: $color-primary-dark;
  background: rgba(74, 159, 232, 0.12);
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
}

.plan-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 8rpx;
}

.plan-content {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  line-height: 1.5;
}

.plan-delete {
  position: absolute;
  top: 28rpx;
  right: 28rpx;
  font-size: 24rpx;
  color: #e74c3c;
}

.fab {
  position: fixed;
  right: 40rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(43, 127, 212, 0.35);
}

.fab-icon {
  font-size: 52rpx;
  color: #fff;
  font-weight: 300;
  line-height: 1;
}
</style>
