<template>
  <view class="xh-dog-icon">
    <view class="xh-ear xh-ear--l" />
    <view class="xh-ear xh-ear--r" />
    <view class="xh-face">
      <view class="xh-eye xh-eye--l" />
      <view class="xh-eye xh-eye--r" />
      <view class="xh-nose" />
    </view>
  </view>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.xh-dog-icon {
  position: relative;
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
}

.xh-ear {
  position: absolute;
  top: 2rpx;
  width: 14rpx;
  height: 18rpx;
  background: #0f172a;
  border-radius: 10rpx 10rpx 3rpx 3rpx;
  border: 2rpx solid rgba(125, 211, 252, 0.35);
}

.xh-ear--l {
  left: 4rpx;
  transform: rotate(-18deg);
}

.xh-ear--r {
  right: 4rpx;
  transform: rotate(18deg);
}

.xh-face {
  position: absolute;
  left: 6rpx;
  top: 10rpx;
  width: 36rpx;
  height: 34rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, #334155 0%, #1e293b 100%);
  border: 2rpx solid rgba(125, 211, 252, 0.4);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}

.xh-eye {
  position: absolute;
  top: 12rpx;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: #7dd3fc;
}

.xh-eye--l {
  left: 8rpx;
}

.xh-eye--r {
  right: 8rpx;
}

.xh-nose {
  position: absolute;
  left: 50%;
  bottom: 6rpx;
  width: 8rpx;
  height: 6rpx;
  margin-left: -4rpx;
  border-radius: 50%;
  background: #94a3b8;
}
</style>
