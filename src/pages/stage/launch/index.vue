<template>
  <view class="launch-page">
    <image class="launch-logo" src="/static/twin/avatar.png" mode="aspectFill" />
    <text class="launch-title">胡神分身</text>
    <view class="launch-dots">
      <view class="dot d1" />
      <view class="dot d2" />
      <view class="dot d3" />
    </view>
    <text class="launch-status">{{ status }}</text>
    <view v-if="failed" class="retry-btn" hover-class="retry-btn--active" @tap="goStage">
      <text class="retry-text">重试</text>
    </view>
  </view>
</template>

<script setup>
/**
 * 启动跳板页：three.js 在分包里（主包放不下），开机后跳进分包 3D 舞台
 */
const status = ref('加载中…')
const failed = ref(false)

onMounted(function () {
  goStage()
})

function goStage() {
  failed.value = false
  status.value = '加载中…'
  uni.reLaunch({
    url: '/packageTwin/pages/stage/index',
    fail: function () {
      failed.value = true
      status.value = '资源加载失败，请检查网络'
    },
  })
}
</script>

<style lang="scss" scoped>
.launch-page {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26rpx;
  background: #121018;
}

.launch-logo {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(232, 200, 120, 0.5);
  box-shadow: 0 0 60rpx rgba(232, 200, 120, 0.25);
}

.launch-title {
  font-size: 40rpx;
  font-weight: 800;
  letter-spacing: 8rpx;
  color: #f0d78c;
  text-shadow: 0 0 30rpx rgba(240, 215, 140, 0.4);
}

.launch-dots {
  display: flex;
  gap: 14rpx;
  margin-top: 10rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(232, 200, 120, 0.8);
  animation: dotJump 1.2s ease-in-out infinite;
}

.dot.d2 {
  animation-delay: 0.2s;
}

.dot.d3 {
  animation-delay: 0.4s;
}

@keyframes dotJump {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-10rpx);
    opacity: 1;
  }
}

.launch-status {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.45);
}

.retry-btn {
  margin-top: 10rpx;
  padding: 16rpx 70rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
}

.retry-btn--active {
  opacity: 0.85;
}

.retry-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #4a3608;
}
</style>
