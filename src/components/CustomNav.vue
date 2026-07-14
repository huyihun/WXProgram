<template>
  <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-inner" :style="{ height: navBarHeight + 'px' }">
      <view
        v-if="showBack"
        class="nav-back"
        hover-class="nav-back--active"
        @tap="handleBack"
      >
        <view class="nav-back-arrow" />
        <text class="nav-back-text">返回</text>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  /** 是否显示返回按钮，默认根据页面栈自动判断 */
  back: {
    type: Boolean,
    default: undefined,
  },
})

const statusBarHeight = ref(0)
const navBarHeight = ref(44)

const showBack = computed(() => {
  if (props.back !== undefined) return props.back
  return getCurrentPages().length > 1
})

onMounted(() => {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 0

  const menuButton = wx.getMenuButtonBoundingClientRect()
  if (menuButton) {
    navBarHeight.value =
      (menuButton.top - info.statusBarHeight) * 2 + menuButton.height
  }
})

function handleBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.custom-nav {
  position: relative;
  z-index: 100;
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  margin-left: -4rpx;
}

.nav-back {
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 64rpx;
  padding: 0 22rpx 0 12rpx;
  border-radius: 16rpx;
  background: $color-nav;
  border: 1rpx solid rgba(74, 159, 232, 0.2);
  box-shadow: $shadow-card;
  transition: transform 0.2s ease, background 0.2s ease;
}

.nav-back--active {
  transform: scale(0.96);
  background: $color-bg;
}

/* 单线左箭头 */
.nav-back-arrow {
  width: 14rpx;
  height: 14rpx;
  border-left: 3rpx solid $color-primary;
  border-bottom: 3rpx solid $color-primary;
  transform: rotate(45deg);
  flex-shrink: 0;
  margin-right: 2rpx;
}

.nav-back-text {
  font-size: 28rpx;
  font-weight: 500;
  color: $color-primary-dark;
  line-height: 1;
}
</style>
