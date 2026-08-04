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
import { themeStyle } from '@/utils/moodTheme'

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
const rootStyle = computed(() => {
  if (!props.extraStyle) return themeStyle.value
  return Object.assign({}, themeStyle.value, props.extraStyle)
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
  background-color: $color-bg;
  box-sizing: border-box;
  padding: 0 32rpx 48rpx;
}

.page-root--flush {
  padding: 0;
}

.page-root--hero {
  background: $gradient-hero;
  overflow: hidden;
}

.page-root--fill {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-body {
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
