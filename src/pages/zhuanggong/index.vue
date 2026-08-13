<template>
  <PageRoot :extra-style="{ backgroundColor: '#eef1ef' }">
    <view class="zg-page">
      <PageLoading v-if="bootLoading" />

      <template v-else>
        <view class="zg-top">
          <text class="zg-brand">专攻</text>
          <text class="zg-hist" @tap="openHistory">历史</text>
        </view>

        <text class="zg-sub">这段时间，只做一件事</text>

        <view class="zg-focus">
          <textarea
            class="zg-input"
            v-model="content"
            placeholder="写下你要专攻的事"
            :maxlength="500"
            :auto-height="true"
            :show-confirm-bar="false"
          />
        </view>

        <view class="zg-range-card">
          <view class="zg-range-row">
            <text class="zg-range-label">开始</text>
            <view class="zg-pickers">
              <picker mode="date" :value="startDate" @change="onStartDate">
                <view class="zg-chip">{{ startDate || '日期' }}</view>
              </picker>
              <picker mode="time" :value="startTime" @change="onStartTime">
                <view class="zg-chip">{{ startTime || '时间' }}</view>
              </picker>
            </view>
          </view>
          <view class="zg-range-row">
            <text class="zg-range-label">结束</text>
            <view class="zg-pickers">
              <picker mode="date" :value="endDate" @change="onEndDate">
                <view class="zg-chip">{{ endDate || '日期' }}</view>
              </picker>
              <picker mode="time" :value="endTime" @change="onEndTime">
                <view class="zg-chip">{{ endTime || '时间' }}</view>
              </picker>
            </view>
          </view>
          <text class="zg-range-sum">{{ rangeText }}</text>
        </view>

        <view class="zg-done-wrap">
          <view
            class="zg-done"
            :class="{ busy: btnBusy, muted: btnPhase === 'ongoing' }"
            hover-class="zg-done--active"
            @tap="handleBtn"
          >
            <text class="zg-done-text">{{ btnLabel }}</text>
          </view>
        </view>
      </template>
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
        <text class="panel-title">专攻记录</text>
        <text class="panel-close" @tap="closeHistory">关闭</text>
      </view>
      <view v-if="historyLoading" class="panel-empty">加载中...</view>
      <view v-else-if="historyList.length === 0" class="panel-empty">还没有历史记录</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view v-for="item in historyList" :key="item._id" class="hist-item">
          <text class="hist-content">{{ item.content || '-' }}</text>
          <text class="hist-range">{{ formatFocusRange(item.startAt, item.endAt) }}</text>
          <text class="hist-done">完成于 {{ formatCompletedAt(item.completedAt) }}</text>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import {
  combineDateTime,
  splitDateTime,
  formatFocusRange,
  formatCompletedAt,
  getActiveFocus,
  saveActiveFocus,
  completeActiveFocus,
  getHistoryFocus,
} from '@/api/zhuanggong'

const bootLoading = ref(true)
const focusId = ref('')
const content = ref('')
const startDate = ref('')
const startTime = ref('')
const endDate = ref('')
const endTime = ref('')
const btnBusy = ref(false)
const nowMs = ref(Date.now())
let nowTimer = null

const historyOpen = ref(false)
const historyLoading = ref(false)
const historyList = ref([])

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

function floorToMinute(ms) {
  const n = Number(ms)
  if (!isFinite(n) || n <= 0) return 0
  return Math.floor(n / 60000) * 60000
}

/**
 * start 开始 | ongoing 专攻中 | done 完成
 * - 现在 < 开始 → 开始
 * - 已保存且在起止之间 → 专攻中
 * - 现在 > 结束（且已有专攻）→ 完成
 * - 尚未点开始时，即使已到时段也仍显示开始（避免未开始却显示专攻中）
 */
const btnPhase = computed(() => {
  const start = floorToMinute(startAtVal.value)
  const end = floorToMinute(endAtVal.value)
  const now = floorToMinute(nowMs.value)
  const started = !!focusId.value

  if (!start || !end) return 'start'
  if (now < start) return 'start'
  if (now > end) return started ? 'done' : 'start'
  // start <= now <= end
  if (started) return 'ongoing'
  return 'start'
})

const btnLabel = computed(() => {
  if (btnBusy.value) return '…'
  if (btnPhase.value === 'done') return '完成'
  if (btnPhase.value === 'ongoing') return '专攻中'
  return '开始'
})

function applyDefaults() {
  // 默认开始略晚于现在，按钮默认为「开始」
  const start = splitDateTime(Date.now() + 60 * 60 * 1000)
  const end = splitDateTime(Date.now() + 25 * 60 * 60 * 1000)
  startDate.value = start.date
  startTime.value = start.time
  endDate.value = end.date
  endTime.value = end.time
}

function clearForm() {
  focusId.value = ''
  content.value = ''
  applyDefaults()
  nowMs.value = Date.now()
}

function validateForm() {
  const text = (content.value || '').trim()
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

onMounted(async () => {
  await loadOwnerFlag()
  if (!isOwnerSync()) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
    }, 400)
    return
  }
  await loadActive()
  nowMs.value = Date.now()
  nowTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
  bootLoading.value = false
})

onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }
})

async function loadActive() {
  applyDefaults()
  try {
    const row = await getActiveFocus()
    if (row) {
      focusId.value = row._id || ''
      content.value = row.content || ''
      const startMs = Number(row.startAt) || 0
      const endMs = Number(row.endAt) || 0
      const s = splitDateTime(startMs)
      const e = splitDateTime(endMs)
      startDate.value = s.date
      startTime.value = s.time
      endDate.value = e.date
      endTime.value = e.time
    }
  } catch (err) {
    console.error('加载专攻失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  }
}

function onStartDate(e) {
  startDate.value = (e && e.detail && e.detail.value) || startDate.value
  nowMs.value = Date.now()
}

function onStartTime(e) {
  startTime.value = (e && e.detail && e.detail.value) || startTime.value
  nowMs.value = Date.now()
}

function onEndDate(e) {
  endDate.value = (e && e.detail && e.detail.value) || endDate.value
  nowMs.value = Date.now()
}

function onEndTime(e) {
  endTime.value = (e && e.detail && e.detail.value) || endTime.value
  nowMs.value = Date.now()
}

async function handleStart() {
  if (!validateForm()) return
  btnBusy.value = true
  try {
    const row = await saveActiveFocus({
      content: (content.value || '').trim(),
      startAt: startAtVal.value,
      endAt: endAtVal.value,
    })
    focusId.value = row._id
    content.value = row.content
    nowMs.value = Date.now()
  } catch (err) {
    console.error('开始专攻失败', err)
    uni.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
  } finally {
    btnBusy.value = false
  }
}

async function handleComplete() {
  if (!validateForm()) return

  const doComplete = async () => {
    btnBusy.value = true
    try {
      if (!focusId.value) {
        const row = await saveActiveFocus({
          content: (content.value || '').trim(),
          startAt: startAtVal.value,
          endAt: endAtVal.value,
        })
        focusId.value = row._id
      } else {
        await saveActiveFocus({
          content: (content.value || '').trim(),
          startAt: startAtVal.value,
          endAt: endAtVal.value,
        })
      }
      await completeActiveFocus(focusId.value)
      clearForm()
    } catch (err) {
      console.error('完成专攻失败', err)
      uni.showToast({ title: (err && err.message) || '完成失败', icon: 'none' })
    } finally {
      btnBusy.value = false
    }
  }

  uni.showModal({
    title: '完成专攻',
    content: '确认这件事已经完成？完成后将清空当前专攻。',
    success: (res) => {
      if (res && res.confirm) doComplete()
    },
  })
}

function handleBtn() {
  if (btnBusy.value) return
  if (btnPhase.value === 'ongoing') return
  if (btnPhase.value === 'done') {
    handleComplete()
    return
  }
  handleStart()
}

async function openHistory() {
  historyOpen.value = true
  historyLoading.value = true
  try {
    historyList.value = await getHistoryFocus()
  } catch (err) {
    console.error('加载专攻历史失败', err)
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
.zg-page {
  min-height: 70vh;
  padding: 8rpx 8rpx 80rpx;
  box-sizing: border-box;
}

.zg-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.zg-brand {
  font-size: 36rpx;
  font-weight: 500;
  letter-spacing: 16rpx;
  color: #3d4a42;
}

.zg-hist {
  font-size: 26rpx;
  color: #6b7a70;
  padding: 8rpx 4rpx;
}

.zg-sub {
  display: block;
  font-size: 24rpx;
  color: #8a938c;
  letter-spacing: 4rpx;
  margin-bottom: 56rpx;
}

.zg-focus {
  min-height: 280rpx;
  padding: 8rpx 4rpx 40rpx;
  margin-bottom: 32rpx;
  border-bottom: 1rpx solid rgba(90, 110, 100, 0.12);
}

.zg-input {
  width: 100%;
  min-height: 220rpx;
  font-size: 40rpx;
  font-weight: 400;
  line-height: 1.65;
  color: #2f3b34;
  letter-spacing: 2rpx;
}

.zg-range-card {
  padding: 28rpx 8rpx 8rpx;
  margin-bottom: 40rpx;
}

.zg-range-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.zg-range-label {
  font-size: 26rpx;
  color: #6b7a70;
  width: 80rpx;
  flex-shrink: 0;
}

.zg-pickers {
  display: flex;
  gap: 16rpx;
  flex: 1;
  justify-content: flex-end;
}

.zg-chip {
  min-width: 180rpx;
  height: 64rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.7);
  border: 1rpx solid rgba(90, 110, 100, 0.12);
  font-size: 26rpx;
  color: #3d4a42;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.zg-range-sum {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #7a8a80;
  letter-spacing: 1rpx;
  text-align: right;
}

.zg-done-wrap {
  display: flex;
  justify-content: center;
  margin-top: 48rpx;
  padding-bottom: 24rpx;
}

.zg-done {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #5f7568;
  box-shadow: 0 12rpx 28rpx rgba(60, 80, 70, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.zg-done.busy {
  opacity: 0.55;
}

.zg-done.muted {
  background: #9aa89e;
  box-shadow: none;
}

.zg-done--active {
  opacity: 0.9;
  transform: scale(0.96);
}

.zg-done-text {
  font-size: 30rpx;
  font-weight: 500;
  color: #f4f7f5;
  letter-spacing: 6rpx;
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(40, 48, 44, 0.35);
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
  background: #f5f7f5;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -8rpx 32rpx rgba(40, 48, 44, 0.1);
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
  background: rgba(90, 110, 100, 0.2);
  margin: 16rpx auto 0;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx 24rpx;
  border-bottom: 1rpx solid rgba(90, 110, 100, 0.08);
  flex-shrink: 0;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #3d4a42;
}

.panel-close {
  font-size: 26rpx;
  color: #5f7568;
  padding: 8rpx;
}

.panel-empty {
  padding: 64rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: #8a938c;
}

.panel-scroll {
  flex: 1;
  height: 0;
  padding: 12rpx 0;
  box-sizing: border-box;
}

.hist-item {
  margin: 0 24rpx 16rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.75);
  border: 1rpx solid rgba(90, 110, 100, 0.08);
}

.hist-content {
  display: block;
  font-size: 30rpx;
  color: #2f3b34;
  line-height: 1.5;
  margin-bottom: 12rpx;
}

.hist-range {
  display: block;
  font-size: 24rpx;
  color: #6b7a70;
  margin-bottom: 8rpx;
}

.hist-done {
  display: block;
  font-size: 22rpx;
  color: #8a938c;
}
</style>
