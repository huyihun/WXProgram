<template>
  <PageRoot
    dark-nav
    flush
    :extra-style="{ backgroundColor: '#0c1014' }"
  >
    <view class="hs-page">
      <view class="hs-glow hs-glow--a" />
      <view class="hs-glow hs-glow--b" />
      <view class="hs-ring" :class="{ awaken: sealAwaken }" />

      <PageLoading v-if="bootLoading" />

      <template v-else>
        <!-- 墨金匾额头部 -->
        <view class="hs-plaque">
          <view class="hs-plaque-frame">
            <view class="hs-plaque-corner tl" />
            <view class="hs-plaque-corner tr" />
            <view class="hs-plaque-corner bl" />
            <view class="hs-plaque-corner br" />
            <text class="hs-plaque-title">胡神</text>
            <text class="hs-plaque-hist" @tap="openHistory">历史</text>
          </view>
        </view>

        <view class="hs-center">
          <!-- 横批 -->
          <view class="hs-hengpi" :class="{ on: running, flash: modeFlash }">
            <text class="hs-hengpi-text">{{ modeText }}</text>
          </view>

          <text class="hs-timer">{{ timerText }}</text>

          <!-- 左联 · 印信 · 右联 -->
          <view class="hs-couplet-row">
            <view class="couplet" :class="{ on: running }">
              <view class="couplet-cap" />
              <view class="couplet-body">
                <text
                  v-for="(ch, i) in leftCouplet"
                  :key="'l-' + i"
                  class="couplet-char"
                >{{ ch }}</text>
              </view>
              <view class="couplet-cap bottom" />
            </view>

            <view
              class="seal"
              :class="{
                on: running,
                pressed: btnPressed,
                busy: btnBusy,
                awaken: sealAwaken,
              }"
              @touchstart="btnPressed = true"
              @touchend="btnPressed = false"
              @touchcancel="btnPressed = false"
              @tap="handleToggle"
            >
              <view class="seal-rim" />
              <view class="seal-face">
                <view class="seal-inner">
                  <text class="seal-glyph">神</text>
                  <text class="seal-action">{{ sealActionText }}</text>
                </view>
              </view>
              <view class="seal-shine" />
              <view v-if="sealAwaken" class="seal-burst" />
            </view>

            <view class="couplet" :class="{ on: running }">
              <view class="couplet-cap" />
              <view class="couplet-body">
                <text
                  v-for="(ch, i) in rightCouplet"
                  :key="'r-' + i"
                  class="couplet-char"
                >{{ ch }}</text>
              </view>
              <view class="couplet-cap bottom" />
            </view>
          </view>

          <text class="hs-hint">{{ hintText }}</text>
          <text class="hs-ritual" :class="{ show: ritualTipShow }">印信已启</text>
        </view>
      </template>

      <!-- 开启倒计时仪式层 -->
      <view v-if="counting" class="cd-mask" @touchmove.stop.prevent>
        <view class="cd-ring" :key="'r-' + countdownNum" />
        <text class="cd-num" :key="'n-' + countdownNum">{{ countdownNum }}</text>
        <text class="cd-label">启封倒计时</text>
      </view>
    </view>

    <view
      class="sheet-mask"
      :class="{ show: historyOpen }"
      @tap="closeHistory"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: historyOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-header">
        <text class="panel-title">胡神记录</text>
        <text class="panel-close" @tap="closeHistory">关闭</text>
      </view>
      <view v-if="historyLoading" class="panel-empty">加载中...</view>
      <view v-else-if="historyList.length === 0" class="panel-empty">还没有历史记录</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view v-for="item in historyList" :key="item._id" class="hist-item">
          <text class="hist-time">{{ formatSessionTime(item.startedAt) }}</text>
          <text class="hist-dur">{{ formatDuration(item.durationMs) }}</text>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import {
  formatDuration,
  formatSessionTime,
  getRunningSession,
  startSession,
  endSession,
  getHistorySessions,
} from '@/api/hushen'

const bootLoading = ref(true)
const running = ref(false)
const sessionId = ref('')
const startedAt = ref(0)
const elapsedMs = ref(0)
const btnBusy = ref(false)
const btnPressed = ref(false)
let tickTimer = null

const counting = ref(false)
const countdownNum = ref(3)
let countdownTimer = null
let awakenTimer = null
let ritualTimer = null

const sealAwaken = ref(false)
const modeFlash = ref(false)
const ritualTipShow = ref(false)

const historyOpen = ref(false)
const historyLoading = ref(false)
const historyList = ref([])

const leftCouplet = ['专', '注', '无', '畏', '总', '要', '成', '功']
const rightCouplet = ['积', '极', '乐', '观', '游', '刃', '有', '余']

const modeText = computed(() => {
  return running.value ? '胡神模式已开启' : '胡神模式待开启'
})

const timerText = computed(() => {
  return formatDuration(elapsedMs.value)
})

const sealActionText = computed(() => {
  if (counting.value) return '启封中'
  return running.value ? '结束' : '开启'
})

const hintText = computed(() => {
  if (counting.value) return '印信启封中…'
  return running.value ? '点按印信结束本次胡神' : '点按印信开启胡神模式'
})

onMounted(async () => {
  await loadOwnerFlag()
  if (!isOwnerSync()) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
    }, 400)
    return
  }
  await restoreSession()
  bootLoading.value = false
})

onUnmounted(() => {
  stopTick()
  clearCountdown()
  clearAwaken()
})

function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

function startTick() {
  stopTick()
  tickTimer = setInterval(() => {
    if (!running.value || !startedAt.value) return
    elapsedMs.value = Date.now() - startedAt.value
  }, 33)
}

function clearCountdown() {
  if (countdownTimer) {
    clearTimeout(countdownTimer)
    countdownTimer = null
  }
  counting.value = false
}

function clearAwaken() {
  if (awakenTimer) {
    clearTimeout(awakenTimer)
    awakenTimer = null
  }
  if (ritualTimer) {
    clearTimeout(ritualTimer)
    ritualTimer = null
  }
  sealAwaken.value = false
  modeFlash.value = false
  ritualTipShow.value = false
}

function playAwakenEffect() {
  sealAwaken.value = true
  modeFlash.value = true
  ritualTipShow.value = true
  if (awakenTimer) clearTimeout(awakenTimer)
  if (ritualTimer) clearTimeout(ritualTimer)
  awakenTimer = setTimeout(() => {
    sealAwaken.value = false
    modeFlash.value = false
    awakenTimer = null
  }, 800)
  ritualTimer = setTimeout(() => {
    ritualTipShow.value = false
    ritualTimer = null
  }, 1600)
}

function runCountdown() {
  return new Promise((resolve) => {
    counting.value = true
    countdownNum.value = 3
    const step = () => {
      if (countdownNum.value <= 1) {
        counting.value = false
        countdownTimer = null
        resolve()
        return
      }
      countdownNum.value = countdownNum.value - 1
      countdownTimer = setTimeout(step, 1000)
    }
    countdownTimer = setTimeout(step, 1000)
  })
}

async function restoreSession() {
  try {
    const row = await getRunningSession()
    if (row && row._id && row.startedAt) {
      running.value = true
      sessionId.value = row._id
      startedAt.value = row.startedAt
      elapsedMs.value = Date.now() - row.startedAt
      startTick()
    } else {
      running.value = false
      sessionId.value = ''
      startedAt.value = 0
      elapsedMs.value = 0
    }
  } catch (err) {
    console.error('恢复胡神会话失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  }
}

async function handleToggle() {
  if (btnBusy.value || counting.value) return
  btnBusy.value = true
  try {
    if (running.value) {
      await endSession(sessionId.value, startedAt.value)
      stopTick()
      running.value = false
      sessionId.value = ''
      startedAt.value = 0
      elapsedMs.value = 0
    } else {
      await runCountdown()
      playAwakenEffect()
      const row = await startSession()
      running.value = true
      sessionId.value = row._id
      startedAt.value = row.startedAt
      elapsedMs.value = 0
      startTick()
    }
  } catch (err) {
    console.error('胡神切换失败', err)
    clearCountdown()
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    btnBusy.value = false
  }
}

async function openHistory() {
  if (counting.value) return
  historyOpen.value = true
  historyLoading.value = true
  try {
    historyList.value = await getHistorySessions()
  } catch (err) {
    console.error('加载胡神历史失败', err)
    historyList.value = []
    uni.showToast({ title: '历史加载失败', icon: 'none' })
  } finally {
    historyLoading.value = false
  }
}

function closeHistory() {
  historyOpen.value = false
}
</script>

<style lang="scss" scoped>
.hs-page {
  position: relative;
  min-height: 100vh;
  padding: 16rpx 28rpx 80rpx;
  box-sizing: border-box;
  overflow: hidden;
  background:
    radial-gradient(ellipse 90% 55% at 50% 18%, rgba(180, 130, 60, 0.14), transparent 70%),
    radial-gradient(ellipse 70% 40% at 50% 85%, rgba(40, 70, 80, 0.35), transparent 65%),
    linear-gradient(180deg, #10161c 0%, #0c1014 45%, #080b0e 100%);
}

.hs-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.hs-glow--a {
  width: 420rpx;
  height: 420rpx;
  left: 50%;
  top: 28%;
  margin-left: -210rpx;
  background: radial-gradient(circle, rgba(201, 162, 79, 0.16), transparent 68%);
}

.hs-glow--b {
  width: 560rpx;
  height: 280rpx;
  left: 50%;
  bottom: 8%;
  margin-left: -280rpx;
  background: radial-gradient(ellipse, rgba(70, 100, 110, 0.2), transparent 70%);
}

.hs-ring {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 520rpx;
  height: 520rpx;
  margin-left: -260rpx;
  margin-top: -140rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(201, 162, 79, 0.12);
  pointer-events: none;
  transition:
    border-color 0.35s ease,
    box-shadow 0.35s ease,
    transform 0.8s ease;
}

.hs-ring.awaken {
  border-color: rgba(232, 200, 120, 0.45);
  box-shadow: 0 0 60rpx rgba(220, 170, 70, 0.25);
  transform: scale(1.06);
}

/* 墨金匾额头部 */
.hs-plaque {
  position: relative;
  z-index: 2;
  margin: 0 -8rpx 28rpx;
}

.hs-plaque-frame {
  position: relative;
  min-height: 96rpx;
  padding: 22rpx 28rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #1a1610 0%, #12100c 55%, #0e0c0a 100%);
  border: 2rpx solid rgba(180, 140, 70, 0.45);
  border-radius: 12rpx;
  box-shadow:
    inset 0 1rpx 0 rgba(255, 220, 150, 0.12),
    0 8rpx 24rpx rgba(0, 0, 0, 0.35);
}

.hs-plaque-corner {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  border-color: rgba(220, 180, 90, 0.65);
  border-style: solid;
  border-width: 0;
}

.hs-plaque-corner.tl {
  left: 8rpx;
  top: 8rpx;
  border-top-width: 3rpx;
  border-left-width: 3rpx;
}

.hs-plaque-corner.tr {
  right: 8rpx;
  top: 8rpx;
  border-top-width: 3rpx;
  border-right-width: 3rpx;
}

.hs-plaque-corner.bl {
  left: 8rpx;
  bottom: 8rpx;
  border-bottom-width: 3rpx;
  border-left-width: 3rpx;
}

.hs-plaque-corner.br {
  right: 8rpx;
  bottom: 8rpx;
  border-bottom-width: 3rpx;
  border-right-width: 3rpx;
}

.hs-plaque-title {
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 28rpx;
  color: #e8c878;
  text-indent: 28rpx;
  text-shadow: 0 3rpx 0 rgba(40, 28, 10, 0.65);
}

.hs-plaque-hist {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(220, 190, 130, 0.9);
  letter-spacing: 4rpx;
  padding: 8rpx 4rpx;
}

.hs-center {
  position: relative;
  z-index: 2;
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 横批 */
.hs-hengpi {
  min-width: 420rpx;
  padding: 16rpx 36rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
  text-align: center;
  background: linear-gradient(180deg, #2a2216 0%, #1a1410 100%);
  border: 2rpx solid rgba(180, 140, 70, 0.4);
  border-radius: 8rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 220, 150, 0.1);
}

.hs-hengpi.on {
  border-color: rgba(232, 200, 120, 0.55);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 220, 150, 0.18),
    0 0 24rpx rgba(220, 170, 70, 0.18);
}

.hs-hengpi.flash {
  animation: modeFlash 0.8s ease;
}

.hs-hengpi-text {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  color: rgba(210, 185, 140, 0.78);
}

.hs-hengpi.on .hs-hengpi-text {
  color: #e8c878;
}

@keyframes modeFlash {
  0% {
    opacity: 0.35;
    transform: scale(0.96);
  }
  40% {
    opacity: 1;
    transform: scale(1.03);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.hs-timer {
  font-size: 52rpx;
  font-weight: 300;
  letter-spacing: 2rpx;
  color: rgba(245, 230, 190, 0.92);
  font-variant-numeric: tabular-nums;
  margin-bottom: 40rpx;
}

/* 对联行 */
.hs-couplet-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 4rpx;
  box-sizing: border-box;
}

.couplet {
  width: 88rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, #2c2216 0%, #18140e 50%, #221a12 100%);
  border: 2rpx solid rgba(160, 120, 55, 0.5);
  border-radius: 8rpx;
  box-shadow:
    0 10rpx 20rpx rgba(0, 0, 0, 0.4),
    inset 0 1rpx 0 rgba(255, 220, 150, 0.1);
  padding: 16rpx 0 18rpx;
  box-sizing: border-box;
  transition:
    border-color 0.35s ease,
    box-shadow 0.35s ease;
}

.couplet.on {
  border-color: rgba(220, 180, 90, 0.65);
  box-shadow:
    0 10rpx 24rpx rgba(0, 0, 0, 0.4),
    0 0 20rpx rgba(200, 160, 60, 0.15),
    inset 0 1rpx 0 rgba(255, 220, 150, 0.16);
}

.couplet-cap {
  width: 36rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: rgba(200, 160, 70, 0.55);
  margin-bottom: 14rpx;
}

.couplet-cap.bottom {
  margin-bottom: 0;
  margin-top: 14rpx;
}

.couplet-body {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.couplet-char {
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.48;
  color: #e0c070;
  text-shadow:
    0 2rpx 0 rgba(30, 20, 8, 0.85),
    0 0 1rpx rgba(0, 0, 0, 0.5);
}

.couplet.on .couplet-char {
  color: #f0d080;
  text-shadow:
    0 2rpx 0 rgba(40, 28, 10, 0.75),
    0 0 8rpx rgba(220, 170, 70, 0.25);
}

.seal {
  position: relative;
  width: 260rpx;
  height: 260rpx;
  flex-shrink: 0;
  border-radius: 50%;
  transform: translateY(0);
  transition:
    transform 0.12s ease,
    filter 0.2s ease;
}

.seal.pressed {
  transform: translateY(10rpx) scale(0.97);
}

.seal.busy {
  opacity: 0.72;
}

.seal.awaken {
  animation: sealPulse 0.8s ease;
}

@keyframes sealPulse {
  0% {
    filter: brightness(1);
    transform: scale(1);
  }
  35% {
    filter: brightness(1.35);
    transform: scale(1.06);
  }
  100% {
    filter: brightness(1);
    transform: scale(1);
  }
}

.seal-rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(145deg, #6a5430 0%, #2a2114 42%, #8a6d38 100%);
  box-shadow:
    0 18rpx 0 #1a140c,
    0 28rpx 40rpx rgba(0, 0, 0, 0.55),
    inset 0 2rpx 0 rgba(255, 230, 170, 0.25);
  transition: background 0.35s ease, box-shadow 0.35s ease;
}

.seal.on .seal-rim {
  background: linear-gradient(145deg, #d4a84a 0%, #7a5420 40%, #f0d080 100%);
  box-shadow:
    0 18rpx 0 #3a2a10,
    0 28rpx 48rpx rgba(0, 0, 0, 0.55),
    0 0 48rpx rgba(220, 170, 70, 0.28),
    inset 0 2rpx 0 rgba(255, 245, 210, 0.4);
}

.seal.awaken .seal-rim {
  box-shadow:
    0 18rpx 0 #3a2a10,
    0 28rpx 48rpx rgba(0, 0, 0, 0.55),
    0 0 80rpx rgba(240, 200, 90, 0.55),
    inset 0 2rpx 0 rgba(255, 245, 210, 0.55);
}

.seal.pressed .seal-rim {
  box-shadow:
    0 8rpx 0 #1a140c,
    0 14rpx 24rpx rgba(0, 0, 0, 0.45),
    inset 0 2rpx 0 rgba(255, 230, 170, 0.2);
}

.seal-face {
  position: absolute;
  left: 18rpx;
  top: 18rpx;
  right: 18rpx;
  bottom: 18rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #5c4528 0%, #2c2114 55%, #1a140c 100%);
  border: 3rpx solid rgba(180, 140, 70, 0.45);
  box-shadow: inset 0 10rpx 24rpx rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.35s ease, border-color 0.35s ease;
}

.seal.on .seal-face {
  background: radial-gradient(circle at 35% 28%, #c9963a 0%, #7a4e18 50%, #3a280e 100%);
  border-color: rgba(255, 220, 140, 0.55);
}

.seal-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.seal-glyph {
  font-size: 72rpx;
  font-weight: 700;
  color: rgba(230, 200, 140, 0.88);
  line-height: 1;
  margin-bottom: 8rpx;
  text-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.35);
}

.seal.on .seal-glyph {
  color: #fff4d0;
  text-shadow:
    0 4rpx 0 rgba(80, 50, 10, 0.45),
    0 0 20rpx rgba(255, 220, 140, 0.35);
}

.seal-action {
  font-size: 24rpx;
  letter-spacing: 8rpx;
  color: rgba(210, 180, 120, 0.7);
  font-weight: 600;
}

.seal.on .seal-action {
  color: rgba(255, 240, 200, 0.9);
}

.seal-shine {
  position: absolute;
  left: 40rpx;
  top: 28rpx;
  width: 90rpx;
  height: 48rpx;
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(255, 245, 210, 0.22), transparent);
  pointer-events: none;
}

.seal-burst {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 260rpx;
  height: 260rpx;
  margin-left: -130rpx;
  margin-top: -130rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(240, 200, 100, 0.55);
  pointer-events: none;
  animation: burstOut 0.8s ease forwards;
}

@keyframes burstOut {
  0% {
    transform: scale(0.92);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}

.hs-hint {
  margin-top: 48rpx;
  font-size: 24rpx;
  color: rgba(180, 160, 120, 0.45);
  letter-spacing: 2rpx;
}

.hs-ritual {
  margin-top: 16rpx;
  font-size: 26rpx;
  letter-spacing: 10rpx;
  color: #e8c878;
  font-weight: 600;
  opacity: 0;
  transform: translateY(8rpx);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.hs-ritual.show {
  opacity: 1;
  transform: translateY(0);
}

/* 倒计时仪式层 */
.cd-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(6, 8, 10, 0.72);
}

.cd-ring {
  position: absolute;
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(201, 162, 79, 0.45);
  animation: cdRing 1s ease-out;
}

@keyframes cdRing {
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.45);
    opacity: 0;
  }
}

.cd-num {
  position: relative;
  z-index: 1;
  font-size: 160rpx;
  font-weight: 300;
  color: #f0d080;
  line-height: 1;
  text-shadow:
    0 8rpx 0 rgba(40, 28, 10, 0.55),
    0 0 40rpx rgba(220, 170, 70, 0.35);
  animation: cdNum 1s ease;
}

@keyframes cdNum {
  0% {
    opacity: 0;
    transform: scale(1.35);
  }
  25% {
    opacity: 1;
    transform: scale(1);
  }
  75% {
    opacity: 1;
    transform: scale(0.96);
  }
  100% {
    opacity: 0.35;
    transform: scale(0.88);
  }
}

.cd-label {
  position: relative;
  z-index: 1;
  margin-top: 28rpx;
  font-size: 26rpx;
  letter-spacing: 12rpx;
  color: rgba(220, 190, 130, 0.65);
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(8, 10, 12, 0.55);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.25s ease,
    visibility 0.25s ease;
  z-index: 200;
}

.sheet-mask.show {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 62vh;
  display: flex;
  flex-direction: column;
  background: #161c22;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.35);
  transform: translateY(100%);
  transition: transform 0.25s ease;
  z-index: 201;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  pointer-events: none;
}

.sheet.open {
  transform: translateY(0);
  pointer-events: auto;
}

.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: rgba(220, 190, 130, 0.22);
  margin: 16rpx auto 0;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx 24rpx;
  border-bottom: 1rpx solid rgba(220, 190, 130, 0.1);
  flex-shrink: 0;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 600;
  color: rgba(235, 210, 160, 0.92);
}

.panel-close {
  font-size: 26rpx;
  color: #c9a24f;
  padding: 8rpx;
}

.panel-empty {
  padding: 64rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: rgba(180, 160, 120, 0.5);
}

.panel-scroll {
  flex: 1;
  height: 0;
  padding: 12rpx 0;
  box-sizing: border-box;
}

.hist-item {
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(201, 162, 79, 0.12);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.hist-time {
  font-size: 24rpx;
  color: rgba(230, 210, 170, 0.85);
  flex-shrink: 0;
}

.hist-dur {
  font-size: 24rpx;
  font-weight: 700;
  color: #e8c878;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
