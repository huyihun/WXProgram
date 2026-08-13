<template>
  <view class="pl">
    <view class="pl-seal">
      <view class="pl-ring r1" />
      <view class="pl-ring r2" />
      <view class="pl-rim" />
      <view class="pl-face">
        <text class="pl-glyph">神</text>
      </view>
      <view class="pl-shine" />
    </view>
    <text class="pl-text">{{ text }}</text>
  </view>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    default: '加载中',
  },
})
</script>

<style lang="scss" scoped>
.pl {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 24rpx;
}

.pl-seal {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  animation: plPulse 1.6s ease-in-out infinite;
}

.pl-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 160rpx;
  height: 160rpx;
  margin-left: -80rpx;
  margin-top: -80rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(201, 162, 79, 0.5);
  pointer-events: none;
  animation: plRing 1.8s ease-out infinite;
}

.pl-ring.r2 {
  animation-delay: 0.9s;
}

.pl-rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(145deg, #d4a84a 0%, #7a5420 40%, #f0d080 100%);
  box-shadow:
    0 10rpx 0 #3a2a10,
    0 16rpx 28rpx rgba(0, 0, 0, 0.35),
    0 0 28rpx rgba(220, 170, 70, 0.22),
    inset 0 2rpx 0 rgba(255, 245, 210, 0.4);
}

.pl-face {
  position: absolute;
  left: 14rpx;
  top: 14rpx;
  right: 14rpx;
  bottom: 14rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, #c9963a 0%, #7a4e18 50%, #3a280e 100%);
  border: 3rpx solid rgba(255, 220, 140, 0.5);
  box-shadow: inset 0 8rpx 18rpx rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pl-glyph {
  font-size: 56rpx;
  font-weight: 700;
  color: #fff4d0;
  line-height: 1;
  text-shadow:
    0 3rpx 0 rgba(80, 50, 10, 0.45),
    0 0 16rpx rgba(255, 220, 140, 0.35);
}

.pl-shine {
  position: absolute;
  left: 28rpx;
  top: 20rpx;
  width: 56rpx;
  height: 30rpx;
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(255, 245, 210, 0.28), transparent);
  pointer-events: none;
}

.pl-text {
  margin-top: 36rpx;
  font-size: 26rpx;
  letter-spacing: 10rpx;
  text-indent: 10rpx;
  color: rgba(180, 150, 90, 0.7);
}

@keyframes plPulse {
  0%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.04);
    filter: brightness(1.18);
  }
}

@keyframes plRing {
  0% {
    transform: scale(0.92);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}
</style>
