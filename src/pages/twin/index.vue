<template>
  <view class="redirect-page">
    <text class="redirect-text">进入分身舞台…</text>
  </view>
</template>

<script setup>
/**
 * 旧分身页入口保留：直接跳进舞台，避免收藏/分享链失效
 */
onMounted(function () {
  uni.redirectTo({
    url: '/packageTwin/pages/stage/index',
    fail: function () {
      uni.reLaunch({ url: '/packageTwin/pages/stage/index' })
    },
  })
})
</script>

<style lang="scss" scoped>
.redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #14101c;
}

.redirect-text {
  font-size: 28rpx;
  color: rgba(240, 215, 140, 0.75);
  letter-spacing: 2rpx;
}
</style>
