<template>
  <view v-if="show" class="treasure-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <text class="panel-title">百 宝 箱</text>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <scroll-view scroll-y class="panel-body" :show-scrollbar="false">
        <view v-for="section in visibleSections" :key="section.title" class="section">
          <text class="section-title">{{ section.title }}</text>
          <view class="grid">
            <view
              v-for="item in section.items"
              :key="item.action || item.path"
              class="tool"
              hover-class="tool--active"
              @tap.stop="go(item)"
            >
              <text class="tool-emoji">{{ item.emoji }}</text>
              <text class="tool-name">{{ item.name }}</text>
            </view>
          </view>
        </view>
        <view class="tail-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
/**
 * 百宝箱：生活/娱乐跳转 + 分身管理（emit action 由舞台承接）
 */
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close', 'action'])

const SECTIONS = [
  {
    title: '生活工具',
    items: [
      { name: '记事本', emoji: '📓', path: '/pages/notebook/index' },
      { name: '记账', emoji: '💰', path: '/pages/ledger/index' },
      { name: '生活用品', emoji: '🧺', path: '/pages/supplies/index' },
      { name: '减肥', emoji: '⚖️', path: '/pages/diet/index' },
      { name: '胡神自律', emoji: '🖨️', path: '/pages/hushen/index' },
      { name: 'Serious', emoji: '🌙', path: '/pages/notebook/serious/index' },
    ],
  },
  {
    title: '娱乐资源',
    items: [
      { name: '小说', emoji: '📚', path: '/pages/novel/index' },
      { name: '剧场', emoji: '🎭', path: '/pages/theater/index' },
      { name: '壁纸', emoji: '🖼️', path: '/pages/wallpaper/index' },
      { name: '相册', emoji: '📷', path: '/pages/album/index' },
      { name: '资源库', emoji: '📦', path: '/pages/resources/index' },
      { name: '小黑', emoji: '🤖', path: '/pages/code-assist/index' },
    ],
  },
  {
    title: '分身管理 · 仅主人',
    owner: true,
    items: [
      { name: '投喂', emoji: '🍽️', action: 'feed' },
      { name: '食谱', emoji: '📖', action: 'recipe' },
      { name: '人设', emoji: '🎭', action: 'persona' },
      { name: '状态', emoji: '📡', action: 'status' },
      { name: '记忆', emoji: '🧠', action: 'memory' },
      { name: '资料', emoji: '📋', action: 'profile' },
      { name: '形象', emoji: '🖼️', action: 'avatar' },
      { name: '清空对话', emoji: '🧹', action: 'clearChat' },
      { name: '经典首页', emoji: '🏠', path: '/pages/index/index' },
    ],
  },
]

const ownerReady = ref(false)

watch(
  () => props.show,
  async (open) => {
    if (open && !ownerReady.value) {
      await loadOwnerFlag()
      ownerReady.value = true
    }
  }
)

const visibleSections = computed(function () {
  const owner = isOwnerSync()
  return SECTIONS.filter(function (s) {
    return !s.owner || owner
  })
})

function close() {
  emit('close')
}

function go(item) {
  emit('close')
  if (item.action) {
    emit('action', item.action)
    return
  }
  uni.navigateTo({
    url: item.path,
    fail: function () {
      uni.showToast({ title: '页面打开失败', icon: 'none' })
    },
  })
}
</script>

<style lang="scss" scoped>
.treasure-sheet {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 240;
}

.mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(8, 6, 14, 0.6);
}

.panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 78vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #201a2e 0%, #161221 100%);
  border-radius: 32rpx 32rpx 0 0;
  border-top: 2rpx solid rgba(232, 200, 120, 0.28);
  box-shadow: 0 -12rpx 48rpx rgba(0, 0, 0, 0.5);
  overflow: hidden;
  box-sizing: border-box;
}

.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  margin: 16rpx auto 8rpx;
  flex-shrink: 0;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8rpx 36rpx 12rpx;
  flex-shrink: 0;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 800;
  letter-spacing: 8rpx;
  color: #f0d78c;
  text-shadow: 0 0 20rpx rgba(240, 215, 140, 0.35);
}

.panel-close {
  font-size: 26rpx;
  color: rgba(232, 200, 120, 0.8);
  padding: 8rpx 4rpx;
}

.panel-body {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.section {
  margin-top: 18rpx;
}

.section-title {
  display: block;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 2rpx;
  margin-bottom: 14rpx;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.tool {
  width: 200rpx;
  padding: 22rpx 0;
  border-radius: 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.07);
}

.tool--active {
  background: rgba(232, 200, 120, 0.12);
  border-color: rgba(232, 200, 120, 0.4);
}

.tool-emoji {
  font-size: 44rpx;
  line-height: 1;
}

.tool-name {
  font-size: 24rpx;
  color: rgba(255, 248, 235, 0.85);
  letter-spacing: 1rpx;
}

.tail-pad {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
