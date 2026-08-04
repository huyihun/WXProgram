<template>
  <PageRoot hero>
    <view class="header">
      <text class="subtitle">分类管理家里的东西</text>
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
          <view class="module-icon" :class="'icon-' + item.id" />
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
/** 生活用品分类入口 */
const modules = ref([
  {
    id: 'daily',
    name: '日常消耗品',
    desc: '洗衣液等，跟踪剩余与日耗',
    path: '/pages/supplies/daily/index',
  },
  {
    id: 'clothing',
    name: '个人服装',
    desc: '衣服鞋包，星级评价',
    path: '/pages/supplies/clothing/index',
  },
  {
    id: 'personal',
    name: '个人生活用品',
    desc: '个人日用，星级评价',
    path: '/pages/supplies/personal/index',
  },
  {
    id: 'household',
    name: '家庭生活用品',
    desc: '家居杂物，星级评价',
    path: '/pages/supplies/household/index',
  },
  {
    id: 'fruit',
    name: '水果',
    desc: '水果清单，星级评价',
    path: '/pages/supplies/fruit/index',
  },
])

function handleModuleTap(item) {
  uni.navigateTo({ url: item.path })
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 40rpx;
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

.icon-daily {
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 8rpx;
  box-sizing: border-box;
}

.icon-clothing {
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 50% 50% 40% 40%;
  box-sizing: border-box;
}

.icon-personal {
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-sizing: border-box;
}

.icon-household {
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 6rpx;
  box-sizing: border-box;
  border-bottom-width: 8rpx;
}

.icon-fruit {
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 50% 50% 48% 48%;
  box-sizing: border-box;
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
