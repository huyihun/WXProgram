<template>
  <view class="xh-image-icon">
    <view class="xh-frame">
      <view class="xh-mountain xh-mountain--l" />
      <view class="xh-mountain xh-mountain--r" />
      <view class="xh-sun" />
    </view>
  </view>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.xh-image-icon {
  position: relative;
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
}

.xh-frame {
  position: absolute;
  left: 4rpx;
  top: 6rpx;
  width: 40rpx;
  height: 34rpx;
  border-radius: 6rpx;
  border: 2rpx solid rgba(125, 211, 252, 0.45);
  background: linear-gradient(160deg, #1e293b 0%, #334155 100%);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.xh-mountain {
  position: absolute;
  bottom: 0;
  width: 0;
  height: 0;
  border-style: solid;
}

.xh-mountain--l {
  left: 2rpx;
  border-width: 0 12rpx 14rpx 12rpx;
  border-color: transparent transparent rgba(125, 211, 252, 0.55) transparent;
}

.xh-mountain--r {
  left: 14rpx;
  border-width: 0 16rpx 18rpx 16rpx;
  border-color: transparent transparent rgba(56, 189, 248, 0.35) transparent;
}

.xh-sun {
  position: absolute;
  top: 5rpx;
  right: 6rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #7dd3fc;
}
</style>
