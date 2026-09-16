<template>
  <view
    class="page-root"
    :class="{
      'page-root--hero': hero,
      'page-root--flush': flush,
      'page-root--fill': fill,
    }"
    :style="rootStyle"
  >
    <image
      v-if="moodBgSrc"
      class="page-mood-bg"
      :src="moodBgSrc"
      mode="aspectFill"
      @error="onMoodBgError"
    />
    <view class="page-mood-veil" :class="{ dark: darkNav }" />

    <CustomNav :back="back" :dark="darkNav" />

    <view
      class="page-body"
      :class="{ 'page-body--flush': flush, 'page-body--fill': fill }"
      :style="bodyStyle"
    >
      <slot />
    </view>
  </view>
</template>

<script setup>
import {
  themeStyle,
  themeBgUrl,
  invalidateThemeBgCache,
  ensureMoodThemeBg,
} from '@/utils/moodTheme'

const props = defineProps({
  /** 是否显示返回，传给 CustomNav；默认按页面栈自动判断 */
  back: {
    type: Boolean,
    default: undefined,
  },
  /** 去掉内容区默认内边距（首页等自定义布局用） */
  flush: {
    type: Boolean,
    default: false,
  },
  /** 渐变英雄页背景（首页、记事本 Hub） */
  hero: {
    type: Boolean,
    default: false,
  },
  /** 锁死视口高度，内容区占满导航以下剩余空间（首页防滚动） */
  fill: {
    type: Boolean,
    default: false,
  },
  /** 额外底部内边距，有固定底栏时用，如 160rpx */
  bottom: {
    type: String,
    default: '',
  },
  /** 额外根节点样式（如 CSS 变量），与主题变量合并 */
  extraStyle: {
    type: Object,
    default: null,
  },
  /** 深色导航返回（暗色游戏页等） */
  darkNav: {
    type: Boolean,
    default: false,
  },
})

/** 显式取 .value，避免小程序端导入的 ref 未自动解包 */
const moodBgSrc = computed(() => themeBgUrl.value || '')

let bgErrorRetrying = false

function onMoodBgError() {
  const bad = themeBgUrl.value || ''
  if (!bad || bgErrorRetrying) return
  bgErrorRetrying = true
  invalidateThemeBgCache(bad)
  ensureMoodThemeBg(true)
  setTimeout(function () {
    bgErrorRetrying = false
  }, 2000)
}

const rootStyle = computed(() => {
  const base = Object.assign({}, themeStyle.value || {})
  const hasBg = !!moodBgSrc.value
  // 有壁纸时透明透出；无壁纸回退主题实色，避免空白
  if (hasBg) {
    base.background = 'transparent'
    base.backgroundColor = 'transparent'
  } else {
    const solid = base['--color-bg'] || '#F3EBE3'
    base.background = solid
    base.backgroundColor = solid
  }
  if (!props.extraStyle) return base
  const merged = Object.assign(base, props.extraStyle)
  if (hasBg) {
    merged.background = 'transparent'
    merged.backgroundColor = 'transparent'
  }
  return merged
})

const bodyStyle = computed(() => {
  if (!props.bottom) return {}
  return { paddingBottom: props.bottom }
})
</script>

<style lang="scss" scoped>
.page-root {
  position: relative;
  min-height: 100vh;
  background-color: transparent;
  box-sizing: border-box;
  padding: 0 32rpx 48rpx;
}

.page-mood-bg {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  opacity: 0.78;
  z-index: 0;
  pointer-events: none;
}

.page-mood-veil {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  background: var(--color-veil, rgba(243, 235, 227, 0.52));
}

.page-mood-veil.dark {
  background: linear-gradient(
    165deg,
    rgba(12, 16, 20, 0.42) 0%,
    rgba(12, 16, 20, 0.32) 48%,
    rgba(8, 11, 14, 0.38) 100%
  );
}

.page-root--flush {
  padding: 0;
}

.page-root--hero {
  overflow: hidden;
}

.page-root--fill {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-body {
  position: relative;
  padding-top: 32rpx;
  box-sizing: border-box;
}

.page-body--flush {
  padding: 0;
}

.page-body--fill {
  flex: 1;
  min-height: 0;
}
</style>
