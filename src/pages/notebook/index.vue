<template>
  <PageRoot hero>
    <view class="header">
      <text class="subtitle">记录计划与感受</text>
    </view>

    <view class="module-list">
      <view
        v-for="item in modules"
        :key="item.id"
        class="module-card"
        hover-class="module-card--active"
        @tap="handleModuleTap(item)"
      >
        <view class="module-icon-box">
          <view class="module-icon" :class="item.iconClass" />
        </view>
        <view class="module-info">
          <text class="module-name">{{ item.name }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
        <text class="module-arrow">›</text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
/** 记事本功能入口（全部公开） */
const modules = [
  {
    id: 'casual',
    name: '随心记',
    desc: '快速记下此刻感受',
    path: '/pages/notebook/casual/index',
    iconClass: 'icon-casual',
  },
  {
    id: 'plan',
    name: '今日计划',
    desc: '安排今天要做的事',
    path: '/pages/notebook/plan/index',
    iconClass: 'icon-plan',
  },
  {
    id: 'info',
    name: '信息记录',
    desc: '账号密码备忘',
    path: '/pages/info/index',
    iconClass: 'icon-info',
  },
]

function handleModuleTap(item) {
  uni.navigateTo({ url: item.path })
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 40rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 12rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: $color-subtitle;
}

.module-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.module-card {
  display: flex;
  align-items: center;
  padding: 32rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 28rpx;
  box-shadow: $shadow-card;
}

.module-card--active {
  transform: scale(0.98);
  opacity: 0.9;
}

.module-icon-box {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.module-icon {
  width: 40rpx;
  height: 40rpx;
  position: relative;
}

/* 随心记图标：笔迹线条 */
.icon-casual::before {
  content: '';
  position: absolute;
  left: 6rpx;
  top: 8rpx;
  width: 28rpx;
  height: 3rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2rpx;
  transform: rotate(-8deg);
}

.icon-casual::after {
  content: '';
  position: absolute;
  left: 4rpx;
  bottom: 8rpx;
  width: 32rpx;
  height: 3rpx;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 2rpx;
  transform: rotate(5deg);
}

/* 计划图标：日历线条 */
.icon-plan::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 6rpx;
}

.icon-plan::after {
  content: '';
  position: absolute;
  top: 12rpx;
  left: 6rpx;
  right: 6rpx;
  height: 3rpx;
  background: rgba(255, 255, 255, 0.7);
}

/* 信息记录：卡片线条 */
.icon-info::before {
  content: '';
  position: absolute;
  left: 4rpx;
  top: 4rpx;
  right: 4rpx;
  bottom: 4rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 6rpx;
}

.icon-info::after {
  content: '';
  position: absolute;
  left: 10rpx;
  top: 14rpx;
  width: 16rpx;
  height: 3rpx;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 2rpx;
  box-shadow: 0 8rpx 0 rgba(255, 255, 255, 0.7);
}

.module-info {
  flex: 1;
  min-width: 0;
}

.module-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 6rpx;
}

.module-desc {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
}

.module-arrow {
  font-size: 44rpx;
  color: $color-primary;
  font-weight: 300;
  margin-left: 12rpx;
}
</style>
