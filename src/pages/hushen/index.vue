<template>
  <PageRoot
    dark-nav
    flush
    fill
    :extra-style="{ background: 'transparent', backgroundColor: 'transparent' }"
  >
    <view class="hs-page">
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
                busy: sealBusy,
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

        <!-- 专攻（紧凑） -->
        <view class="hs-focus">
          <view class="hs-focus-head">
            <text class="hs-focus-title">专攻</text>
            <text class="hs-focus-hist" @tap="openFocusHistory">记录</text>
          </view>

          <view class="hs-focus-input-wrap">
            <textarea
              class="hs-focus-input"
              v-model="focusContent"
              placeholder="写下你要专攻的事"
              placeholder-class="hs-focus-ph"
              :maxlength="500"
              :auto-height="true"
              :show-confirm-bar="false"
              @input="onFocusContentInput"
            />
          </view>

          <view class="hs-focus-range">
            <view class="hs-focus-range-row">
              <text class="hs-focus-tag">开始</text>
              <picker mode="date" :value="startDate" @change="onStartDate">
                <view class="hs-focus-pick">{{ displayDate(startDate) }}</view>
              </picker>
              <picker mode="time" :value="startTime" @change="onStartTime">
                <view class="hs-focus-pick">{{ startTime || '时间' }}</view>
              </picker>
              <text class="hs-focus-sep">·</text>
              <text class="hs-focus-tag">结束</text>
              <picker mode="date" :value="endDate" @change="onEndDate">
                <view class="hs-focus-pick">{{ displayDate(endDate) }}</view>
              </picker>
              <picker mode="time" :value="endTime" @change="onEndTime">
                <view class="hs-focus-pick">{{ endTime || '时间' }}</view>
              </picker>
            </view>
            <text class="hs-focus-sum">{{ rangeText }} · {{ phaseText }}</text>
          </view>

          <view class="hs-focus-actions">
            <view
              class="hs-focus-btn"
              :class="{ busy: focusBusy }"
              hover-class="hs-focus-btn--active"
              @tap="handleFocusSave"
            >
              <text class="hs-focus-btn-text">{{ focusSaveLabel }}</text>
            </view>
            <view
              class="hs-focus-btn primary"
              :class="{ busy: focusBusy, disabled: !focusId }"
              hover-class="hs-focus-btn--active"
              @tap="handleFocusComplete"
            >
              <text class="hs-focus-btn-text primary">完成</text>
            </view>
          </view>
        </view>
      </template>

      <!-- 开启倒计时仪式层 -->
      <view v-if="counting" class="cd-mask" @touchmove.stop.prevent>
        <view class="cd-ring" :key="'r-' + countdownNum" />
        <text class="cd-num" :key="'n-' + countdownNum">{{ countdownNum }}</text>
        <text class="cd-label">启封倒计时</text>
      </view>
    </view>

    <!-- 胡神会话历史 -->
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

    <!-- 专攻完成记录 -->
    <view
      class="sheet-mask"
      :class="{ show: focusHistoryOpen }"
      @tap="closeFocusHistory"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: focusHistoryOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-header">
        <text class="panel-title">专攻记录</text>
        <text class="panel-close" @tap="closeFocusHistory">关闭</text>
      </view>
      <view v-if="focusHistoryLoading" class="panel-empty">加载中...</view>
      <view v-else-if="focusHistoryList.length === 0" class="panel-empty">还没有记录</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view v-for="item in focusHistoryList" :key="item._id" class="focus-hist-item">
          <text class="focus-hist-content">{{ item.content || '-' }}</text>
          <text class="focus-hist-range">{{ formatFocusRange(item.startAt, item.endAt) }}</text>
          <view class="focus-hist-foot">
            <text class="focus-hist-done">完成于 {{ formatCompletedAt(item.completedAt) }}</text>
            <text class="focus-hist-del" @tap.stop="handleFocusDelete(item)">删除</text>
          </view>
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
import {
  combineDateTime,
  splitDateTime,
  formatFocusRange,
  formatCompletedAt,
  getActiveFocus,
  saveActiveFocus,
  completeActiveFocus,
  getHistoryFocus,
  removeHistoryFocus,
} from '@/api/zhuanggong'

const bootLoading = ref(true)
const running = ref(false)
const sessionId = ref('')
const startedAt = ref(0)
const elapsedMs = ref(0)
const sealBusy = ref(false)
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

const focusId = ref('')
const focusContent = ref('')
const startDate = ref('')
const startTime = ref('')
const endDate = ref('')
const endTime = ref('')
const focusBusy = ref(false)
const focusReady = ref(false)
const nowMs = ref(Date.now())
let nowTimer = null
let autoSaveTimer = null
let lastSavedContent = ''
let lastSavedStart = 0
let lastSavedEnd = 0
let persistLock = false

const focusHistoryOpen = ref(false)
const focusHistoryLoading = ref(false)
const focusHistoryList = ref([])

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

const startAtVal = computed(() => {
  return combineDateTime(startDate.value, startTime.value)
})

const endAtVal = computed(() => {
  return combineDateTime(endDate.value, endTime.value)
})

const rangeText = computed(() => {
  if (!startAtVal.value || !endAtVal.value) return '设定起止时间'
  return formatFocusRange(startAtVal.value, endAtVal.value)
})

const phaseText = computed(() => {
  const start = floorToMinute(startAtVal.value)
  const end = floorToMinute(endAtVal.value)
  const now = floorToMinute(nowMs.value)
  if (!start || !end) return '未设定'
  if (now < start) return '未到开始'
  if (now > end) return '已过结束'
  return '专攻中'
})

const focusSaveLabel = computed(() => {
  if (focusBusy.value) return '…'
  return focusId.value ? '保存' : '记下'
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
  await loadActiveFocusForm()
  nowMs.value = Date.now()
  nowTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
  bootLoading.value = false
  focusReady.value = true
})

onUnmounted(() => {
  stopTick()
  clearCountdown()
  clearAwaken()
  if (nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }
  clearAutoSave()
})

function floorToMinute(ms) {
  const n = Number(ms)
  if (!isFinite(n) || n <= 0) return 0
  return Math.floor(n / 60000) * 60000
}

function displayDate(dateStr) {
  if (!dateStr) return '日期'
  const p = String(dateStr).split('-')
  if (p.length < 3) return dateStr
  return Number(p[1]) + '月' + Number(p[2]) + '日'
}

function rememberSaved(text, startAt, endAt) {
  lastSavedContent = text
  lastSavedStart = startAt
  lastSavedEnd = endAt
}

function isDirty() {
  return (
    (focusContent.value || '').trim() !== lastSavedContent ||
    startAtVal.value !== lastSavedStart ||
    endAtVal.value !== lastSavedEnd
  )
}

function applyDefaults() {
  const start = splitDateTime(floorToMinute(Date.now()))
  const end = splitDateTime(floorToMinute(Date.now()) + 2 * 60 * 60 * 1000)
  startDate.value = start.date
  startTime.value = start.time
  endDate.value = end.date
  endTime.value = end.time
}

function clearFocusForm() {
  focusId.value = ''
  focusContent.value = ''
  applyDefaults()
  nowMs.value = Date.now()
  rememberSaved('', startAtVal.value, endAtVal.value)
}

function validateFocusForm() {
  const text = (focusContent.value || '').trim()
  if (!text) {
    uni.showToast({ title: '请填写专攻内容', icon: 'none' })
    return false
  }
  if (!startAtVal.value || !endAtVal.value) {
    uni.showToast({ title: '请设定起止时间', icon: 'none' })
    return false
  }
  if (endAtVal.value < startAtVal.value) {
    uni.showToast({ title: '结束需晚于开始', icon: 'none' })
    return false
  }
  return true
}

function clearAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

function scheduleAutoSave() {
  if (!focusReady.value || !focusId.value || focusBusy.value) return
  clearAutoSave()
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    persistFocus(false)
  }, 800)
}

async function loadActiveFocusForm() {
  applyDefaults()
  try {
    const row = await getActiveFocus()
    if (row) {
      focusId.value = row._id || ''
      focusContent.value = row.content || ''
      const startMs = Number(row.startAt) || 0
      const endMs = Number(row.endAt) || 0
      const s = splitDateTime(startMs)
      const e = splitDateTime(endMs)
      startDate.value = s.date
      startTime.value = s.time
      endDate.value = e.date
      endTime.value = e.time
      rememberSaved((row.content || '').trim(), startMs, endMs)
    } else {
      rememberSaved('', startAtVal.value, endAtVal.value)
    }
  } catch (err) {
    console.error('加载专攻失败', err)
    uni.showToast({ title: '专攻加载失败', icon: 'none' })
  }
}

function onFocusContentInput() {
  scheduleAutoSave()
}

function onStartDate(e) {
  startDate.value = (e && e.detail && e.detail.value) || startDate.value
  nowMs.value = Date.now()
  scheduleAutoSave()
}

function onStartTime(e) {
  startTime.value = (e && e.detail && e.detail.value) || startTime.value
  nowMs.value = Date.now()
  scheduleAutoSave()
}

function onEndDate(e) {
  endDate.value = (e && e.detail && e.detail.value) || endDate.value
  nowMs.value = Date.now()
  scheduleAutoSave()
}

function onEndTime(e) {
  endTime.value = (e && e.detail && e.detail.value) || endTime.value
  nowMs.value = Date.now()
  scheduleAutoSave()
}

async function persistFocus(showOk) {
  if (persistLock || focusBusy.value) return false
  const text = (focusContent.value || '').trim()
  const startAt = startAtVal.value
  const endAt = endAtVal.value
  if (!showOk) {
    if (!text || !startAt || !endAt || endAt < startAt) return false
  } else if (!validateFocusForm()) {
    return false
  }
  if (focusId.value && !isDirty()) {
    if (showOk) uni.showToast({ title: '已保存', icon: 'none' })
    return true
  }

  persistLock = true
  if (showOk) focusBusy.value = true
  try {
    const row = await saveActiveFocus({
      content: text,
      startAt,
      endAt,
    })
    focusId.value = row._id
    focusContent.value = row.content
    rememberSaved(row.content, row.startAt, row.endAt)
    if (showOk) uni.showToast({ title: '已保存', icon: 'none' })
    return true
  } catch (err) {
    console.error('保存专攻失败', err)
    uni.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
    return false
  } finally {
    persistLock = false
    if (showOk) focusBusy.value = false
  }
}

function handleFocusSave() {
  if (focusBusy.value) return
  clearAutoSave()
  persistFocus(true)
}

function handleFocusComplete() {
  if (focusBusy.value || persistLock) return
  if (!focusId.value) {
    uni.showToast({ title: '请先记下这次专攻', icon: 'none' })
    return
  }
  if (!validateFocusForm()) return

  uni.showModal({
    title: '完成专攻',
    content: '确认这件事已经完成？完成后将写入记录并清空当前专攻。',
    success: (res) => {
      if (res && res.confirm) doFocusComplete()
    },
  })
}

async function doFocusComplete() {
  if (focusBusy.value || persistLock) return
  if (!validateFocusForm()) return
  clearAutoSave()
  persistLock = true
  focusBusy.value = true
  try {
    const row = await saveActiveFocus({
      content: (focusContent.value || '').trim(),
      startAt: startAtVal.value,
      endAt: endAtVal.value,
    })
    focusId.value = row._id
    await completeActiveFocus(focusId.value)
    clearFocusForm()
    uni.showToast({ title: '已记下', icon: 'none' })
  } catch (err) {
    console.error('完成专攻失败', err)
    uni.showToast({ title: (err && err.message) || '完成失败', icon: 'none' })
  } finally {
    persistLock = false
    focusBusy.value = false
  }
}

async function openFocusHistory() {
  if (counting.value) return
  focusHistoryOpen.value = true
  focusHistoryLoading.value = true
  try {
    focusHistoryList.value = await getHistoryFocus()
  } catch (err) {
    console.error('加载专攻历史失败', err)
    focusHistoryList.value = []
    uni.showToast({ title: '历史加载失败', icon: 'none' })
  } finally {
    focusHistoryLoading.value = false
  }
}

function closeFocusHistory() {
  focusHistoryOpen.value = false
}

function handleFocusDelete(item) {
  if (!item || !item._id) return
  uni.showModal({
    title: '删除记录',
    content: '确定删除这一条专攻记录吗？',
    success: (res) => {
      if (res && res.confirm) doFocusDelete(item._id)
    },
  })
}

async function doFocusDelete(id) {
  try {
    await removeHistoryFocus(id)
    const next = []
    for (let i = 0; i < focusHistoryList.value.length; i++) {
      if (focusHistoryList.value[i]._id !== id) next.push(focusHistoryList.value[i])
    }
    focusHistoryList.value = next
    uni.showToast({ title: '已删除', icon: 'none' })
  } catch (err) {
    console.error('删除专攻记录失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

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
  if (sealBusy.value || counting.value) return
  sealBusy.value = true
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
    sealBusy.value = false
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
  height: 100%;
  padding: 16rpx 28rpx 80rpx;
  box-sizing: border-box;
  overflow-y: auto;
}

.hs-ring {
  position: absolute;
  left: 50%;
  top: 36%;
  width: 420rpx;
  height: 420rpx;
  margin-left: -210rpx;
  margin-top: -100rpx;
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
  margin: 0 -8rpx 16rpx;
}

.hs-plaque-frame {
  position: relative;
  min-height: 80rpx;
  padding: 16rpx 24rpx;
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
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 22rpx;
  color: #e8c878;
  text-indent: 22rpx;
  text-shadow: 0 3rpx 0 rgba(40, 28, 10, 0.65);
}

.hs-plaque-hist {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 24rpx;
  font-weight: 600;
  color: rgba(220, 190, 130, 0.9);
  letter-spacing: 4rpx;
  padding: 6rpx 4rpx;
}

.hs-center {
  position: relative;
  z-index: 2;
  margin-top: 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 横批 */
.hs-hengpi {
  min-width: 360rpx;
  padding: 12rpx 28rpx;
  margin-bottom: 16rpx;
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
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 5rpx;
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
  font-size: 42rpx;
  font-weight: 300;
  letter-spacing: 2rpx;
  color: rgba(245, 230, 190, 0.92);
  font-variant-numeric: tabular-nums;
  margin-bottom: 24rpx;
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
  width: 72rpx;
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
  padding: 12rpx 0 14rpx;
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
  width: 28rpx;
  height: 5rpx;
  border-radius: 3rpx;
  background: rgba(200, 160, 70, 0.55);
  margin-bottom: 10rpx;
}

.couplet-cap.bottom {
  margin-bottom: 0;
  margin-top: 10rpx;
}

.couplet-body {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.couplet-char {
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.38;
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
  width: 210rpx;
  height: 210rpx;
  flex-shrink: 0;
  border-radius: 50%;
  transform: translateY(0);
  transition:
    transform 0.12s ease,
    filter 0.2s ease;
}

.seal.pressed {
  transform: translateY(8rpx) scale(0.97);
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
    0 14rpx 0 #1a140c,
    0 22rpx 32rpx rgba(0, 0, 0, 0.55),
    inset 0 2rpx 0 rgba(255, 230, 170, 0.25);
  transition: background 0.35s ease, box-shadow 0.35s ease;
}

.seal.on .seal-rim {
  background: linear-gradient(145deg, #d4a84a 0%, #7a5420 40%, #f0d080 100%);
  box-shadow:
    0 14rpx 0 #3a2a10,
    0 22rpx 40rpx rgba(0, 0, 0, 0.55),
    0 0 40rpx rgba(220, 170, 70, 0.28),
    inset 0 2rpx 0 rgba(255, 245, 210, 0.4);
}

.seal.awaken .seal-rim {
  box-shadow:
    0 14rpx 0 #3a2a10,
    0 22rpx 40rpx rgba(0, 0, 0, 0.55),
    0 0 64rpx rgba(240, 200, 90, 0.55),
    inset 0 2rpx 0 rgba(255, 245, 210, 0.55);
}

.seal.pressed .seal-rim {
  box-shadow:
    0 6rpx 0 #1a140c,
    0 12rpx 20rpx rgba(0, 0, 0, 0.45),
    inset 0 2rpx 0 rgba(255, 230, 170, 0.2);
}

.seal-face {
  position: absolute;
  left: 14rpx;
  top: 14rpx;
  right: 14rpx;
  bottom: 14rpx;
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
  font-size: 58rpx;
  font-weight: 700;
  color: rgba(230, 200, 140, 0.88);
  line-height: 1;
  margin-bottom: 6rpx;
  text-shadow: 0 3rpx 0 rgba(0, 0, 0, 0.35);
}

.seal.on .seal-glyph {
  color: #fff4d0;
  text-shadow:
    0 4rpx 0 rgba(80, 50, 10, 0.45),
    0 0 20rpx rgba(255, 220, 140, 0.35);
}

.seal-action {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  color: rgba(210, 180, 120, 0.7);
  font-weight: 600;
}

.seal.on .seal-action {
  color: rgba(255, 240, 200, 0.9);
}

.seal-shine {
  position: absolute;
  left: 32rpx;
  top: 22rpx;
  width: 72rpx;
  height: 40rpx;
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(255, 245, 210, 0.22), transparent);
  pointer-events: none;
}

.seal-burst {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 210rpx;
  height: 210rpx;
  margin-left: -105rpx;
  margin-top: -105rpx;
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
  margin-top: 28rpx;
  font-size: 22rpx;
  color: rgba(180, 160, 120, 0.45);
  letter-spacing: 2rpx;
}

.hs-ritual {
  margin-top: 10rpx;
  font-size: 22rpx;
  letter-spacing: 8rpx;
  color: #e8c878;
  font-weight: 600;
  opacity: 0;
  transform: translateY(6rpx);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.hs-ritual.show {
  opacity: 1;
  transform: translateY(0);
}

/* 专攻区 */
.hs-focus {
  position: relative;
  z-index: 2;
  margin-top: 48rpx;
  padding: 28rpx 24rpx 8rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(26, 22, 16, 0.92) 0%, rgba(14, 12, 10, 0.88) 100%);
  border: 1rpx solid rgba(180, 140, 70, 0.28);
  border-radius: 16rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 220, 150, 0.08);
}

.hs-focus-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.hs-focus-title {
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 12rpx;
  color: rgba(232, 200, 120, 0.92);
  text-indent: 12rpx;
}

.hs-focus-hist {
  font-size: 26rpx;
  color: rgba(220, 190, 130, 0.85);
  letter-spacing: 4rpx;
  padding: 8rpx 4rpx;
}

.hs-focus-input-wrap {
  padding: 12rpx 8rpx 16rpx;
  margin-bottom: 20rpx;
  border-bottom: 1rpx solid rgba(220, 180, 90, 0.16);
}

.hs-focus-input {
  width: 100%;
  min-height: 96rpx;
  font-size: 30rpx;
  line-height: 1.55;
  color: rgba(245, 230, 190, 0.92);
  letter-spacing: 1rpx;
}

.hs-focus-ph {
  color: rgba(180, 160, 120, 0.4);
}

.hs-focus-range {
  margin-bottom: 24rpx;
}

.hs-focus-range-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx 10rpx;
}

.hs-focus-tag {
  font-size: 22rpx;
  color: rgba(180, 160, 120, 0.55);
  letter-spacing: 2rpx;
  flex-shrink: 0;
}

.hs-focus-pick {
  font-size: 24rpx;
  color: rgba(235, 210, 160, 0.9);
  letter-spacing: 1rpx;
  padding: 4rpx 0;
}

.hs-focus-sep {
  font-size: 22rpx;
  color: rgba(180, 160, 120, 0.35);
  margin: 0 4rpx;
}

.hs-focus-sum {
  display: block;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: rgba(180, 160, 120, 0.5);
  letter-spacing: 1rpx;
  line-height: 1.5;
}

.hs-focus-actions {
  display: flex;
  gap: 20rpx;
  padding: 4rpx 0 12rpx;
}

.hs-focus-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1rpx solid rgba(180, 140, 70, 0.4);
}

.hs-focus-btn.primary {
  background: linear-gradient(180deg, #2a2216 0%, #1a1410 100%);
  border-color: rgba(220, 180, 90, 0.55);
}

.hs-focus-btn.busy,
.hs-focus-btn.disabled {
  opacity: 0.4;
}

.hs-focus-btn--active {
  opacity: 0.82;
}

.hs-focus-btn-text {
  font-size: 28rpx;
  letter-spacing: 10rpx;
  text-indent: 10rpx;
  color: rgba(220, 190, 130, 0.85);
}

.hs-focus-btn-text.primary {
  color: #e8c878;
  font-weight: 600;
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

.focus-hist-item {
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(201, 162, 79, 0.12);
}

.focus-hist-content {
  display: block;
  font-size: 28rpx;
  color: rgba(245, 230, 190, 0.92);
  line-height: 1.55;
  letter-spacing: 1rpx;
  margin-bottom: 12rpx;
}

.focus-hist-range {
  display: block;
  font-size: 24rpx;
  color: rgba(200, 175, 120, 0.7);
  margin-bottom: 10rpx;
}

.focus-hist-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.focus-hist-done {
  flex: 1;
  font-size: 22rpx;
  color: rgba(180, 160, 120, 0.45);
}

.focus-hist-del {
  flex-shrink: 0;
  font-size: 24rpx;
  color: rgba(220, 190, 130, 0.75);
  letter-spacing: 2rpx;
  padding: 4rpx 0 4rpx 12rpx;
}
</style>
