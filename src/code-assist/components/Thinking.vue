<template>
  <view class="xh-think">
    <view class="xh-dog">
      <view class="xh-ear xh-ear--l" />
      <view class="xh-ear xh-ear--r" />
      <view class="xh-face">
        <view class="xh-eye xh-eye--l" />
        <view class="xh-eye xh-eye--r" />
        <view class="xh-nose" />
      </view>
    </view>
    <view class="xh-dots">
      <view class="xh-dot xh-dot--1" />
      <view class="xh-dot xh-dot--2" />
      <view class="xh-dot xh-dot--3" />
    </view>
  </view>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.xh-think {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}

.xh-dog {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  animation: xhDogBob 1.4s ease-in-out infinite;
}

.xh-ear {
  position: absolute;
  top: 4rpx;
  width: 22rpx;
  height: 28rpx;
  background: #0f172a;
  border-radius: 14rpx 14rpx 4rpx 4rpx;
  border: 2rpx solid rgba(125, 211, 252, 0.35);
}

.xh-ear--l {
  left: 6rpx;
  transform: rotate(-18deg);
}

.xh-ear--r {
  right: 6rpx;
  transform: rotate(18deg);
}

.xh-face {
  position: absolute;
  left: 8rpx;
  top: 14rpx;
  width: 56rpx;
  height: 52rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, #334155 0%, #1e293b 100%);
  border: 2rpx solid rgba(125, 211, 252, 0.4);
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.25);
}

.xh-eye {
  position: absolute;
  top: 18rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #7dd3fc;
  animation: xhEyeLook 2s ease-in-out infinite;
}

.xh-eye--l {
  left: 12rpx;
}

.xh-eye--r {
  right: 12rpx;
}

.xh-nose {
  position: absolute;
  left: 50%;
  bottom: 10rpx;
  width: 12rpx;
  height: 10rpx;
  margin-left: -6rpx;
  border-radius: 50%;
  background: #94a3b8;
}

.xh-dots {
  display: flex;
  align-items: flex-end;
  gap: 6rpx;
  height: 32rpx;
  padding-bottom: 4rpx;
}

.xh-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #67e8f9;
  opacity: 0.85;
  animation: xhDotBounce 1.1s ease-in-out infinite;
}

.xh-dot--2 {
  animation-delay: 0.15s;
}

.xh-dot--3 {
  animation-delay: 0.3s;
}

@keyframes xhDogBob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6rpx);
  }
}

@keyframes xhEyeLook {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(2rpx);
  }
}

@keyframes xhDotBounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  50% {
    transform: translateY(-10rpx);
    opacity: 1;
  }
}
</style>
