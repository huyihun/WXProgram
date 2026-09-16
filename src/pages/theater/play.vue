<template>
  <PageRoot
    dark-nav
    flush
    :extra-style="{ background: 'transparent', backgroundColor: 'transparent' }"
  >
    <view class="play-page">
      <view class="play-glow play-glow--a" />
      <view class="play-glow play-glow--b" />

      <view class="play-head">
        <text class="play-title">{{ show.title }}</text>
        <text class="play-ep-label">{{ episodeTitle }}</text>
      </view>

      <view class="video-wrap">
        <PageLoading v-if="loading" text="启幕中" />
        <video
          v-else-if="src"
          id="theaterVideo"
          class="video"
          :src="src"
          :initial-time="initialTime"
          :autoplay="true"
          :controls="true"
          :show-center-play-btn="true"
          :enable-play-gesture="true"
          :show-fullscreen-btn="true"
          :show-play-btn="true"
          :show-progress="true"
          object-fit="contain"
          :poster="coverUrl"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @error="onError"
          @pause="onPause"
          @play="onPlay"
        />
        <view v-else class="video-fail">
          <text class="video-fail-text">{{ failText || '暂无法播放' }}</text>
          <text class="video-fail-retry" @tap="loadEpisode(currentEp)">重试</text>
        </view>
      </view>

      <view class="play-nav">
        <view
          class="nav-btn"
          :class="{ disabled: currentEp <= 1 || switching }"
          @tap="goPrev"
        >
          <text class="nav-btn-text">上一集</text>
        </view>
        <view
          class="nav-btn nav-btn--gold"
          :class="{ disabled: currentEp >= show.episodeCount || switching }"
          @tap="goNext"
        >
          <text class="nav-btn-text">下一集</text>
        </view>
      </view>

      <view class="ep-strip-label">
        <text class="ep-strip-text">选集</text>
      </view>
      <scroll-view scroll-x class="ep-strip" :scroll-into-view="'ep-' + currentEp">
        <view class="ep-strip-inner">
          <view
            v-for="ep in show.episodes"
            :id="'ep-' + ep.ep"
            :key="ep.ep"
            class="ep-chip"
            :class="{ on: ep.ep === currentEp }"
            @tap="switchEpisode(ep.ep)"
          >
            <text class="ep-chip-text">{{ ep.ep }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { getTheaterShow, getEpisode } from '@/utils/theaterCatalog'
import {
  clearEpisodeProgress,
  getEpisodeProgress,
  prefetchNextEpisode,
  resolveCoverUrl,
  resolveEpisodeUrl,
  saveEpisodeProgress,
} from '@/utils/theaterPlayer'

const show = getTheaterShow()
const currentEp = ref(1)
const src = ref('')
const coverUrl = ref('')
const loading = ref(true)
const switching = ref(false)
const failText = ref('')
const initialTime = ref(0)
const lastSavedAt = ref(0)

let lastTime = 0
let loadToken = 0

const episodeTitle = computed(() => {
  const item = getEpisode(currentEp.value)
  return (item && item.title) || ''
})

onLoad((query) => {
  const ep = Number((query && query.ep) || 1)
  currentEp.value = ep >= 1 && ep <= show.episodeCount ? ep : 1
  resolveCoverUrl()
    .then(function (u) {
      coverUrl.value = u || ''
    })
    .catch(function () {
      coverUrl.value = ''
    })
  loadEpisode(currentEp.value)
})

onHide(() => {
  flushProgress()
})

onUnload(() => {
  flushProgress()
})

async function loadEpisode(ep) {
  const token = ++loadToken
  switching.value = true
  loading.value = true
  failText.value = ''
  src.value = ''
  currentEp.value = ep
  lastTime = 0
  lastSavedAt.value = 0

  const resume = getEpisodeProgress(ep)
  initialTime.value = resume > 5 ? resume : 0

  try {
    const url = await resolveEpisodeUrl(ep)
    if (token !== loadToken) return
    if (!url) {
      failText.value = '获取播放地址失败'
      loading.value = false
      switching.value = false
      return
    }
    src.value = url
    loading.value = false
    switching.value = false
    prefetchNextEpisode(ep)
  } catch (e) {
    if (token !== loadToken) return
    failText.value = (e && e.message) || '加载失败'
    loading.value = false
    switching.value = false
  }
}

function switchEpisode(ep) {
  if (switching.value) return
  if (ep === currentEp.value) return
  if (ep < 1 || ep > show.episodeCount) return
  flushProgress()
  loadEpisode(ep)
}

function goPrev() {
  if (currentEp.value <= 1 || switching.value) return
  switchEpisode(currentEp.value - 1)
}

function goNext() {
  if (currentEp.value >= show.episodeCount || switching.value) return
  switchEpisode(currentEp.value + 1)
}

function onTimeUpdate(e) {
  const t = e && e.detail && e.detail.currentTime
  const n = Number(t)
  if (!isFinite(n) || n < 0) return
  lastTime = n
  const now = Date.now()
  if (now - lastSavedAt.value < 4000) return
  lastSavedAt.value = now
  saveEpisodeProgress(currentEp.value, n)
}

function onPause() {
  flushProgress()
}

function onPlay() {
  // 开播后预取已在 load 完成时触发
}

function onEnded() {
  clearEpisodeProgress(currentEp.value)
  lastTime = 0
  if (currentEp.value < show.episodeCount) {
    switchEpisode(currentEp.value + 1)
  }
}

function onError() {
  failText.value = '播放失败，请重试'
  src.value = ''
  loading.value = false
}

function flushProgress() {
  if (lastTime > 3) {
    saveEpisodeProgress(currentEp.value, lastTime)
  }
}
</script>

<style lang="scss" scoped>
.play-page {
  position: relative;
  min-height: 100vh;
  padding: 16rpx 24rpx 64rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.play-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(60rpx);
  opacity: 0.3;
}

.play-glow--a {
  width: 380rpx;
  height: 380rpx;
  top: -60rpx;
  right: -80rpx;
  background: radial-gradient(circle, rgba(201, 162, 39, 0.32), transparent 70%);
}

.play-glow--b {
  width: 320rpx;
  height: 320rpx;
  bottom: 200rpx;
  left: -100rpx;
  background: radial-gradient(circle, rgba(120, 90, 40, 0.25), transparent 70%);
}

.play-head {
  position: relative;
  z-index: 1;
  margin-bottom: 20rpx;
  padding: 0 8rpx;
}

.play-title {
  display: block;
  font-size: 30rpx;
  color: #f0e6d2;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.play-ep-label {
  display: block;
  font-size: 24rpx;
  color: rgba(232, 200, 120, 0.75);
  letter-spacing: 4rpx;
}

.video-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 420rpx;
  background: #090b0e;
  border: 1rpx solid rgba(232, 200, 120, 0.28);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video {
  width: 100%;
  height: 100%;
}

.video-fail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 40rpx;
}

.video-fail-text {
  font-size: 26rpx;
  color: rgba(220, 200, 160, 0.55);
}

.video-fail-retry {
  font-size: 26rpx;
  color: #e8c878;
  letter-spacing: 4rpx;
  padding: 12rpx 28rpx;
  border: 1rpx solid rgba(232, 200, 120, 0.4);
}

.play-nav {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.nav-btn {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(232, 200, 120, 0.3);
  background: rgba(26, 22, 16, 0.8);
}

.nav-btn--gold {
  border-color: rgba(232, 200, 120, 0.55);
  background: linear-gradient(180deg, rgba(42, 34, 22, 0.95), rgba(26, 22, 16, 0.9));
}

.nav-btn.disabled {
  opacity: 0.35;
  pointer-events: none;
}

.nav-btn-text {
  font-size: 26rpx;
  color: #e8c878;
  letter-spacing: 6rpx;
}

.ep-strip-label {
  position: relative;
  z-index: 1;
  margin-top: 40rpx;
  margin-bottom: 16rpx;
  padding: 0 8rpx;
}

.ep-strip-text {
  font-size: 24rpx;
  color: rgba(232, 200, 120, 0.7);
  letter-spacing: 8rpx;
}

.ep-strip {
  position: relative;
  z-index: 1;
  width: 100%;
  white-space: nowrap;
}

.ep-strip-inner {
  display: inline-flex;
  gap: 12rpx;
  padding: 4rpx 8rpx 16rpx;
}

.ep-chip {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(232, 200, 120, 0.28);
  background: rgba(26, 22, 16, 0.75);
}

.ep-chip.on {
  border-color: #e8c878;
  background: rgba(42, 34, 22, 0.95);
  box-shadow: 0 0 16rpx rgba(232, 200, 120, 0.2);
}

.ep-chip-text {
  font-size: 26rpx;
  color: #e8c878;
}
</style>
