<template>
  <PageRoot>
    <view class="header">
      <text class="title">资源库</text>
      <text class="sub">模板下载 · 干货阅读</text>
    </view>

    <view class="list">
      <view class="card" hover-class="card--active" @tap="goResume">
        <view class="card-icon">
          <view class="ico-doc" />
          <view class="ico-doc-fold" />
        </view>
        <view class="card-body">
          <text class="card-name">简历模板</text>
          <text class="card-desc">稻壳精选 · Word 可编辑</text>
        </view>
        <text class="card-arrow">›</text>
      </view>

      <view class="card" hover-class="card--active" @tap="goIdeas">
        <view class="card-icon card-icon--ideas">
          <view class="ico-bulb" />
          <view class="ico-bulb-base" />
        </view>
        <view class="card-body">
          <text class="card-name">赚钱合集</text>
          <text class="card-desc">思路 + 点子 · 站内阅读</text>
        </view>
        <text class="card-arrow">›</text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
function goResume() {
  uni.navigateTo({ url: '/pages/resources/resume/index' })
}

function goIdeas() {
  uni.navigateTo({ url: '/pages/resources/ideas/index' })
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 28rpx;
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 8rpx;
}

.sub {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 28rpx;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 22rpx;
  box-shadow: $shadow-card;
}

.card--active {
  opacity: 0.88;
  transform: scale(0.99);
}

.card-icon {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
  border-radius: 18rpx;
  background: $color-primary;
  box-shadow: $shadow-icon;
}

.card-icon--ideas {
  background: $color-primary-dark;
}

.ico-doc {
  position: absolute;
  left: 18rpx;
  top: 14rpx;
  width: 36rpx;
  height: 44rpx;
  border-radius: 6rpx;
  background: rgba(255, 255, 255, 0.95);
}

.ico-doc-fold {
  position: absolute;
  right: 18rpx;
  top: 14rpx;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 14rpx 14rpx 0;
  border-color: transparent rgba(255, 255, 255, 0.55) transparent transparent;
}

.ico-bulb {
  position: absolute;
  left: 20rpx;
  top: 12rpx;
  width: 32rpx;
  height: 36rpx;
  border-radius: 50% 50% 40% 40%;
  background: rgba(255, 255, 255, 0.95);
}

.ico-bulb-base {
  position: absolute;
  left: 26rpx;
  bottom: 12rpx;
  width: 20rpx;
  height: 10rpx;
  border-radius: 3rpx;
  background: rgba(255, 255, 255, 0.85);
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-name {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 6rpx;
}

.card-desc {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
}

.card-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: $color-subtitle;
  line-height: 1;
}
</style>
