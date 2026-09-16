<template>
  <PageRoot
    dark-nav
    flush
    :extra-style="{ background: 'transparent', backgroundColor: 'transparent' }"
  >
    <view class="th-page">
      <view class="th-glow th-glow--a" />
      <view class="th-glow th-glow--b" />

      <view class="th-plaque">
        <view class="th-plaque-frame">
          <view class="th-plaque-corner tl" />
          <view class="th-plaque-corner tr" />
          <view class="th-plaque-corner bl" />
          <view class="th-plaque-corner br" />
          <text class="th-plaque-title">剧场</text>
        </view>
      </view>

      <view class="th-hero">
        <image
          v-if="coverUrl"
          class="th-cover"
          :src="coverUrl"
          mode="aspectFill"
        />
        <view v-else class="th-cover th-cover--empty">
          <text class="th-cover-glyph">戏</text>
        </view>
        <view class="th-hero-meta">
          <text class="th-show-title">{{ show.title }}</text>
          <text class="th-show-desc">{{ show.desc }}</text>
        </view>
      </view>

      <view class="th-section">
        <text class="th-section-label">选集</text>
        <view class="th-ep-grid">
          <view
            v-for="ep in show.episodes"
            :key="ep.ep"
            class="th-ep"
            :class="{ resumed: hasProgress(ep.ep) }"
            hover-class="th-ep--active"
            @tap="openEpisode(ep.ep)"
          >
            <text class="th-ep-num">{{ ep.ep }}</text>
            <text v-if="hasProgress(ep.ep)" class="th-ep-dot" />
          </view>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { getTheaterShow } from '@/utils/theaterCatalog'
import {
  getEpisodeProgress,
  resolveCoverUrl,
} from '@/utils/theaterPlayer'

const show = getTheaterShow()
const coverUrl = ref('')
const progressTick = ref(0)

onMounted(async () => {
  try {
    coverUrl.value = await resolveCoverUrl()
  } catch (e) {
    coverUrl.value = ''
  }
})

onShow(() => {
  progressTick.value += 1
})

function hasProgress(ep) {
  const _ = progressTick.value
  return getEpisodeProgress(ep) > 0
}

function openEpisode(ep) {
  uni.navigateTo({
    url: '/pages/theater/play?ep=' + encodeURIComponent(ep),
  })
}
</script>

<style lang="scss" scoped>
.th-page {
  position: relative;
  min-height: 100vh;
  padding: 24rpx 32rpx 80rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.th-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(60rpx);
  opacity: 0.35;
}

.th-glow--a {
  width: 420rpx;
  height: 420rpx;
  top: -80rpx;
  right: -100rpx;
  background: radial-gradient(circle, rgba(201, 162, 39, 0.35), transparent 70%);
}

.th-glow--b {
  width: 360rpx;
  height: 360rpx;
  bottom: 120rpx;
  left: -120rpx;
  background: radial-gradient(circle, rgba(120, 90, 40, 0.28), transparent 70%);
}

.th-plaque {
  position: relative;
  z-index: 1;
  margin-bottom: 36rpx;
}

.th-plaque-frame {
  position: relative;
  padding: 28rpx 40rpx;
  border: 1rpx solid rgba(232, 200, 120, 0.35);
  background: linear-gradient(180deg, rgba(42, 34, 22, 0.85), rgba(18, 16, 14, 0.9));
}

.th-plaque-corner {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  border-color: #e8c878;
  border-style: solid;
}

.th-plaque-corner.tl {
  top: -1rpx;
  left: -1rpx;
  border-width: 2rpx 0 0 2rpx;
}

.th-plaque-corner.tr {
  top: -1rpx;
  right: -1rpx;
  border-width: 2rpx 2rpx 0 0;
}

.th-plaque-corner.bl {
  bottom: -1rpx;
  left: -1rpx;
  border-width: 0 0 2rpx 2rpx;
}

.th-plaque-corner.br {
  bottom: -1rpx;
  right: -1rpx;
  border-width: 0 2rpx 2rpx 0;
}

.th-plaque-title {
  display: block;
  text-align: center;
  font-size: 40rpx;
  letter-spacing: 24rpx;
  color: #e8c878;
  font-weight: 600;
  padding-right: 24rpx;
}

.th-hero {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 28rpx;
  margin-bottom: 48rpx;
  align-items: stretch;
}

.th-cover {
  width: 220rpx;
  height: 300rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  border: 1rpx solid rgba(232, 200, 120, 0.28);
  background: #16120e;
}

.th-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(155deg, #2a2216, #1a1410);
}

.th-cover-glyph {
  font-size: 64rpx;
  color: rgba(232, 200, 120, 0.55);
  letter-spacing: 4rpx;
}

.th-hero-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-bottom: 8rpx;
}

.th-show-title {
  font-size: 36rpx;
  color: #f0e6d2;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 12rpx;
}

.th-show-desc {
  font-size: 24rpx;
  color: rgba(220, 200, 160, 0.55);
  letter-spacing: 4rpx;
}

.th-section {
  position: relative;
  z-index: 1;
}

.th-section-label {
  display: block;
  font-size: 24rpx;
  color: rgba(232, 200, 120, 0.7);
  letter-spacing: 8rpx;
  margin-bottom: 24rpx;
}

.th-ep-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.th-ep {
  position: relative;
  width: calc((100% - 64rpx) / 5);
  height: 88rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(232, 200, 120, 0.28);
  background: rgba(26, 22, 16, 0.75);
}

.th-ep--active {
  border-color: rgba(232, 200, 120, 0.7);
  background: rgba(42, 34, 22, 0.95);
}

.th-ep.resumed {
  border-color: rgba(232, 200, 120, 0.5);
}

.th-ep-num {
  font-size: 28rpx;
  color: #e8c878;
  font-weight: 500;
}

.th-ep-dot {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #e8c878;
}
</style>
