<template>
  <view class="page">
    <CustomNav />
    <view v-if="loading" class="status-tip">加载中...</view>
    <view v-else-if="diaryList.length === 0" class="empty">
      <text class="empty-text">还没有日记，点击右下角开始记录</text>
    </view>
    <view v-else class="diary-list">
      <view
        v-for="item in diaryList"
        :key="item._id"
        class="diary-card"
        @tap="handleEdit(item)"
      >
        <text class="diary-date">{{ item.date }}</text>
        <text class="diary-title">{{ item.title }}</text>
        <text v-if="item.content" class="diary-content">{{ truncate(item.content, 60) }}</text>
        <text class="diary-delete" @tap.stop="handleDelete(item)">删除</text>
      </view>
    </view>

    <view class="fab" @tap="handleAdd">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { getDiaries, removeDiary, truncate } from '@/api/notebook'

const diaryList = ref([])
const loading = ref(false)

onShow(() => {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    diaryList.value = await getDiaries()
  } catch (err) {
    console.error('加载日记失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  uni.navigateTo({ url: '/pages/notebook/diary/edit' })
}

function handleEdit(item) {
  uni.navigateTo({ url: `/pages/notebook/diary/edit?id=${item._id}` })
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这篇日记吗？',
  })
  if (!res.confirm) return

  try {
    await removeDiary(item._id)
    await loadList()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除日记失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 120rpx;
  background-color: $color-bg;
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

.diary-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.diary-card {
  position: relative;
  padding: 28rpx 32rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
}

.diary-date {
  display: block;
  font-size: 24rpx;
  color: $color-primary-dark;
  margin-bottom: 10rpx;
}

.diary-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 8rpx;
}

.diary-content {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  line-height: 1.5;
}

.diary-delete {
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
}
</style>
