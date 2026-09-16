<template>
  <view class="custom-nav-wrap">
    <view
      class="custom-nav"
      :class="{
        'custom-nav--solid': showSolidBg,
        'custom-nav--dark-solid': showDarkBg,
      }"
      :style="navBarStyle"
    >
      <view class="nav-inner" :style="{ height: navBarHeight + 'px' }">
        <view
          v-if="showBack"
          class="nav-back"
          :class="{ 'nav-back--dark': dark }"
          hover-class="nav-back--active"
          @tap="handleBack"
        >
          <view class="nav-back-chevron" />
        </view>
      </view>
    </view>
    <!-- 等高占位，避免正文顶进固定导航 -->
    <view class="custom-nav-spacer" :style="{ height: totalNavHeight + 'px' }" />
  </view>
</template>

<script setup>
import { navPageScrolled } from '@/utils/navScroll'

/** 导航底边留白，避免返回箭头贴底 */
const NAV_PAD_BOTTOM = 10

const props = defineProps({
  /** 是否显示返回按钮，默认根据页面栈自动判断 */
  back: {
    type: Boolean,
    default: undefined,
  },
  /** 深色页：弱化成半透明条，不抢戏 */
  dark: {
    type: Boolean,
    default: false,
  },
})

const statusBarHeight = ref(0)
const navBarHeight = ref(44)

const totalNavHeight = computed(function () {
  return (statusBarHeight.value || 0) + (navBarHeight.value || 0) + NAV_PAD_BOTTOM
})

const navBarStyle = computed(function () {
  return {
    paddingTop: statusBarHeight.value + 'px',
    paddingBottom: NAV_PAD_BOTTOM + 'px',
  }
})

const showBack = computed(() => {
  if (props.back !== undefined) return props.back
  return getCurrentPages().length > 1
})

/** 滚动后才铺实色底；顶为 0 时保持透明 */
const showSolidBg = computed(function () {
  return navPageScrolled.value && showBack.value && !props.dark
})

const showDarkBg = computed(function () {
  return navPageScrolled.value && props.dark
})

onMounted(() => {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 0

  const menuButton = wx.getMenuButtonBoundingClientRect()
  if (menuButton) {
    navBarHeight.value = (menuButton.top - info.statusBarHeight) * 2 + menuButton.height
  }
})

function handleBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.custom-nav-wrap {
  position: relative;
  z-index: 100;
}

.custom-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  box-sizing: border-box;
  background: transparent;
  transition: background-color 0.2s ease;
}

/* 页面开始滚动后才显示主题底，挡住下方内容 */
.custom-nav--solid {
  background: var(--color-nav, #ede2d6);
}

.custom-nav--dark-solid {
  background: rgba(12, 16, 20, 0.92);
}

.custom-nav-spacer {
  width: 100%;
  flex-shrink: 0;
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 24rpx;
}

/* 圆形轻透返回：只保留箭头，干净不抢内容 */
.nav-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6rpx 18rpx rgba(43, 80, 120, 0.1);
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    opacity 0.18s ease;
  box-sizing: border-box;
}

.nav-back--active {
  transform: scale(0.94);
  background: rgba(255, 255, 255, 0.95);
}

.nav-back-chevron {
  width: 16rpx;
  height: 16rpx;
  margin-left: 6rpx;
  border-left: 4rpx solid $color-primary-dark;
  border-bottom: 4rpx solid $color-primary-dark;
  transform: rotate(45deg);
  box-sizing: border-box;
}

.nav-back--dark {
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  box-shadow: none;
}

.nav-back--dark.nav-back--active {
  background: rgba(255, 255, 255, 0.16);
}

.nav-back--dark .nav-back-chevron {
  border-left-color: rgba(240, 244, 248, 0.88);
  border-bottom-color: rgba(240, 244, 248, 0.88);
}
</style>
