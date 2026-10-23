<template>
  <PageRoot dark-nav :extra-style="{ backgroundColor: '#10141f' }">
    <view class="shelf-page">
      <!-- 东野书架：夜读 Hero 卡 -->
      <view class="hero-card" hover-class="hero-card--active" @tap="openShelf">
        <view class="hero-stars" />
        <view class="hero-moon" />
        <view class="hero-shine" />
        <view class="hero-body">
          <text class="kicker-text">MYSTERY · 推理合集</text>
          <view class="hero-titles">
            <text class="hero-title">东野圭吾</text>
            <text class="hero-sub">作品集</text>
          </view>
          <view class="hero-foot">
            <text class="hero-meta">悬疑 · 推理 · 社会派</text>
            <view class="hero-go">
              <text class="hero-go-text">进入书架</text>
              <view class="hero-go-arrow" />
            </view>
          </view>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
function openShelf() {
  uni.navigateTo({
    url: '/pages/novel/shelf?shelf=dongye',
  })
}
</script>

<style lang="scss" scoped>
.shelf-page {
  padding: 8rpx 4rpx 48rpx;
}

.hero-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  background: linear-gradient(155deg, #141f38 0%, #24365c 55%, #3d5a80 100%);
  box-shadow: 0 16rpx 44rpx rgba(10, 20, 40, 0.45);
  transform: translateY(0);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.hero-card--active {
  transform: scale(0.98);
  box-shadow: 0 8rpx 24rpx rgba(10, 20, 40, 0.4);
}

.hero-stars {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.8) 1rpx, transparent 2rpx),
    radial-gradient(rgba(255, 255, 255, 0.4) 1rpx, transparent 2rpx);
  background-size: 30rpx 30rpx, 20rpx 24rpx;
  background-position: 6rpx 8rpx, 16rpx 18rpx;
  opacity: 0.5;
  pointer-events: none;
}

.hero-moon {
  position: absolute;
  right: 52rpx;
  top: 44rpx;
  width: 130rpx;
  height: 130rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff7e0 0%, #f0d78c 45%, rgba(240, 215, 140, 0) 72%);
  animation: moonBreath 4.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes moonBreath {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

.hero-shine {
  position: absolute;
  left: -30%;
  top: 0;
  bottom: 0;
  width: 45%;
  background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
  transform: skewX(-14deg);
  pointer-events: none;
}

.hero-body {
  position: relative;
  z-index: 2;
  padding: 44rpx 36rpx 36rpx;
  display: flex;
  flex-direction: column;
}

.kicker-text {
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  color: #e8c878;
}

.hero-titles {
  margin-top: 16rpx;
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.hero-title {
  font-size: 56rpx;
  font-weight: 900;
  color: #fff;
  letter-spacing: 4rpx;
  text-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.35);
}

.hero-sub {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 6rpx;
}

.hero-foot {
  margin-top: 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-meta {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 3rpx;
}

.hero-go {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 26rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
  box-shadow: 0 6rpx 18rpx rgba(201, 162, 39, 0.35);
}

.hero-go-text {
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  color: #4a3608;
}

.hero-go-arrow {
  width: 10rpx;
  height: 10rpx;
  border-top: 3rpx solid #4a3608;
  border-right: 3rpx solid #4a3608;
  transform: rotate(45deg);
}
</style>
