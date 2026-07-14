<template>
  <view class="page">
    <CustomNav :back="false" />
    <!-- 背景装饰光晕 -->
    <view class="bg-decor">
      <view class="orb orb-1" />
      <view class="orb orb-2" />
      <view class="orb orb-3" />
    </view>

    <view class="content">
      <!-- Hero 欢迎区 -->
      <view class="hero fade-in">
        <text class="greeting">{{ greeting }}</text>
        <text class="hero-desc">开启高效的一天</text>
        <text class="hero-date">{{ todayText }}</text>
      </view>

      <!-- 功能入口 -->
      <view class="section fade-in-delay">
        <view class="section-header">
          <text class="section-title">功能</text>
          <text class="section-sub">探索你的工具箱</text>
        </view>

        <view class="entry-list">
          <view
            v-for="item in entries"
            :key="item.id"
            class="entry-card"
            hover-class="entry-card--active"
            @tap="handleEntryTap(item)"
          >
            <view class="entry-icon-box">
              <!-- 记事本：CSS 线条图标 -->
              <view v-if="item.id === 'notebook'" class="icon-notebook">
                <view class="icon-notebook-body" />
                <view class="icon-notebook-line line-1" />
                <view class="icon-notebook-line line-2" />
                <view class="icon-notebook-line line-3" />
              </view>
            </view>
            <view class="entry-info">
              <text class="entry-name">{{ item.name }}</text>
              <text class="entry-desc">{{ item.desc }}</text>
            </view>
            <text class="entry-arrow">›</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 功能入口列表
 * desc 为卡片副标题，后续新增入口时一并填写
 */
const entries = ref([
  {
    id: 'notebook',
    name: '记事本',
    desc: '记录灵感与待办',
    path: '/pages/notebook/index',
  },
])

/** 根据当前时段返回问候语 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

/** 格式化今日日期，显示在 Hero 区 */
const todayText = computed(() => {
  const date = new Date()
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getMonth() + 1}月${date.getDate()}日 星期${weekDays[date.getDay()]}`
})

/** 点击功能入口，跳转对应页面 */
function handleEntryTap(item) {
  uni.navigateTo({ url: item.path })
}
</script>

<style lang="scss" scoped>
.page {
  position: relative;
  min-height: 100vh;
  background: $gradient-hero;
  overflow: hidden;
}

/* 背景渐变光晕装饰 */
.bg-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);
}

.orb-1 {
  width: 400rpx;
  height: 400rpx;
  top: -80rpx;
  right: -100rpx;
  background: rgba(74, 159, 232, 0.25);
}

.orb-2 {
  width: 300rpx;
  height: 300rpx;
  top: 320rpx;
  left: -120rpx;
  background: rgba(43, 127, 212, 0.15);
}

.orb-3 {
  width: 200rpx;
  height: 200rpx;
  bottom: 200rpx;
  right: 60rpx;
  background: rgba(74, 159, 232, 0.12);
}

.content {
  position: relative;
  z-index: 1;
  padding: 24rpx 40rpx 60rpx;
}

/* Hero 区 */
.hero {
  margin-bottom: 64rpx;
}

.greeting {
  display: block;
  font-size: 64rpx;
  font-weight: 700;
  color: $color-title;
  letter-spacing: 2rpx;
  margin-bottom: 16rpx;
}

.hero-desc {
  display: block;
  font-size: 30rpx;
  color: $color-subtitle;
  margin-bottom: 20rpx;
}

.hero-date {
  display: inline-block;
  font-size: 24rpx;
  color: $color-primary-dark;
  background: rgba(74, 159, 232, 0.12);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.section-header {
  margin-bottom: 28rpx;
}

.section-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 8rpx;
}

.section-sub {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* 玻璃质感大卡片 */
.entry-card {
  display: flex;
  align-items: center;
  padding: 36rpx 32rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 28rpx;
  box-shadow: $shadow-card;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.entry-card--active {
  transform: scale(0.98);
  box-shadow: 0 4rpx 16rpx rgba(43, 127, 212, 0.06);
}

.entry-icon-box {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 28rpx;
  flex-shrink: 0;
}

/* 记事本线条图标 */
.icon-notebook {
  position: relative;
  width: 44rpx;
  height: 52rpx;
}

.icon-notebook-body {
  position: absolute;
  inset: 0;
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 6rpx;
}

.icon-notebook-line {
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  height: 3rpx;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 2rpx;
}

.line-1 { top: 16rpx; }
.line-2 { top: 26rpx; width: 70%; }
.line-3 { top: 36rpx; width: 50%; }

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 8rpx;
}

.entry-desc {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
}

.entry-arrow {
  font-size: 48rpx;
  color: $color-primary;
  font-weight: 300;
  margin-left: 16rpx;
  line-height: 1;
}

/* 页面进入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(24rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.6s ease-out forwards;
}

.fade-in-delay {
  opacity: 0;
  animation: fadeIn 0.6s ease-out 0.15s forwards;
}
</style>
