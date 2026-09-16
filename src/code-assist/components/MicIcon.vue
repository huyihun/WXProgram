<template>
  <view class="xh-mic-icon">
    <view class="xh-mic-cap" />
    <view class="xh-mic-body" />
    <view class="xh-mic-stand" />
    <view class="xh-mic-base" />
  </view>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.xh-mic-icon {
  position: relative;
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
}

.xh-mic-body {
  position: absolute;
  left: 16rpx;
  top: 8rpx;
  width: 16rpx;
  height: 22rpx;
  border-radius: 10rpx;
  border: 2rpx solid rgba(125, 211, 252, 0.55);
  background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
}

.xh-mic-cap {
  position: absolute;
  left: 14rpx;
  top: 6rpx;
  width: 20rpx;
  height: 8rpx;
  border-radius: 10rpx 10rpx 0 0;
  border: 2rpx solid rgba(125, 211, 252, 0.45);
  border-bottom: none;
}

.xh-mic-stand {
  position: absolute;
  left: 23rpx;
  top: 30rpx;
  width: 2rpx;
  height: 8rpx;
  background: rgba(125, 211, 252, 0.55);
}

.xh-mic-base {
  position: absolute;
  left: 14rpx;
  top: 36rpx;
  width: 20rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: rgba(125, 211, 252, 0.45);
}
</style>
