<template>
  <PageRoot
    dark-nav
    flush
    fill
    :extra-style="{ background: 'transparent', backgroundColor: 'transparent' }"
  >
    <view class="diet-page">
      <PageLoading v-if="bootLoading" />

      <template v-else>
        <!-- 墨金匾额 -->
        <view class="diet-plaque">
          <view class="diet-plaque-frame">
            <view class="diet-plaque-corner tl" />
            <view class="diet-plaque-corner tr" />
            <view class="diet-plaque-corner bl" />
            <view class="diet-plaque-corner br" />
            <text class="diet-plaque-title">减肥</text>
            <text class="diet-plaque-hist" @tap="openWeightHistory">历史</text>
          </view>
        </view>

        <view class="diet-hengpi">
          <text class="diet-hengpi-text">连续 {{ streak }} 天</text>
        </view>

        <!-- 印信打卡 -->
        <view class="check-block">
          <view
            class="seal"
            :class="{ on: checkedToday, busy: checkinBusy }"
            hover-class="seal--active"
            @tap="handleCheckin"
          >
            <view class="seal-rim" />
            <view class="seal-face">
              <view class="seal-inner">
                <text class="seal-action">{{ checkedToday ? '已打卡' : '打卡' }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 体重 -->
        <view class="weight-block">
          <view class="metric-row">
            <view class="metric">
              <text class="metric-label">目标</text>
              <input
                class="metric-input"
                type="digit"
                v-model="targetWeight"
                placeholder="--"
                :maxlength="6"
                placeholder-class="ph"
                confirm-type="done"
                @confirm="handleSaveTarget"
                @blur="handleSaveTarget"
              />
              <text class="metric-unit">斤</text>
            </view>
            <view class="metric">
              <text class="metric-label">当前</text>
              <text class="metric-value">{{ currentWeight || '--' }}</text>
              <text class="metric-unit">斤</text>
            </view>
          </view>

          <view class="record-row">
            <picker mode="time" :value="weightTime" @change="onWeightTimeChange">
              <view class="time-chip">{{ weightTime || '时间' }}</view>
            </picker>
            <input
              class="record-input"
              type="digit"
              v-model="weightInput"
              placeholder="体重"
              :maxlength="6"
              placeholder-class="ph"
            />
            <text class="metric-unit">斤</text>
            <view
              class="diet-btn"
              :class="{ disabled: weightBusy }"
              hover-class="diet-btn--active"
              @tap="handleAddWeight"
            >
              <text class="diet-btn-text">{{ weightBusy ? '...' : '记录' }}</text>
            </view>
          </view>

          <view v-if="todayWeights.length === 0" class="empty-line">今天还没有体重记录</view>
          <view v-else class="weight-list">
            <view v-for="item in todayWeights" :key="item._id" class="weight-row">
              <text class="weight-label">{{ item.time }} · {{ item.weight }} 斤</text>
              <text class="weight-del" @tap="handleRemoveWeight(item)">删除</text>
            </view>
          </view>
        </view>

        <!-- 减肥心得 -->
        <view class="notes-block">
          <text class="section-title">减肥心得</text>

          <view v-if="notes.length === 0" class="empty-line">还没有心得，写一条吧</view>
          <view v-else class="note-list">
            <view v-for="item in notes" :key="item._id" class="note-item">
              <view class="note-body">
                <text class="note-content">{{ item.content }}</text>
                <text class="note-date">{{ formatNoteDate(item.createdAt) }}</text>
              </view>
              <text class="note-del" @tap="handleRemoveNote(item)">删除</text>
            </view>
          </view>

          <view class="note-compose">
            <input
              class="note-input"
              v-model="noteDraft"
              placeholder="写一条心得"
              :maxlength="200"
              placeholder-class="ph"
              confirm-type="done"
              @confirm="handleAddNote"
            />
            <view
              class="diet-btn primary"
              :class="{ disabled: noteBusy }"
              hover-class="diet-btn--active"
              @tap="handleAddNote"
            >
              <text class="diet-btn-text primary-text">{{ noteBusy ? '...' : '添加' }}</text>
            </view>
          </view>
        </view>
      </template>
    </view>

    <view
      class="sheet-mask"
      :class="{ show: historyOpen }"
      @tap="closeWeightHistory"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: historyOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-header">
        <text class="panel-title">体重历史</text>
        <text class="panel-close" @tap="closeWeightHistory">关闭</text>
      </view>
      <view v-if="historyLoading" class="panel-empty">加载中...</view>
      <view v-else-if="historyList.length === 0" class="panel-empty">还没有体重记录</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view v-for="item in historyList" :key="item._id" class="hist-item">
          <text class="hist-date">{{ item.date }}</text>
          <text class="hist-detail-line">{{ item.time }} · {{ item.weight }} 斤</text>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import {
  getToday,
  formatHm,
  getCheckinByDate,
  getAllCheckins,
  calcStreak,
  addCheckin,
  getWeightsByDate,
  getAllWeights,
  addWeight,
  removeWeight,
  getTargetWeight,
  saveTargetWeight,
  readTargetValue,
  getCurrentWeight,
  readCurrentValue,
  syncCurrentFromLatest,
  getAllNotes,
  addNote,
  removeNote,
} from '@/api/diet'

const bootLoading = ref(true)
const today = getToday()

const checkedToday = ref(false)
const streak = ref(0)
const checkinBusy = ref(false)

const weightTime = ref(formatHm())
const weightInput = ref('')
const weightBusy = ref(false)
const todayWeights = ref([])
const targetWeight = ref('')
const targetLoaded = ref('')
const targetSaving = ref(false)
const currentWeight = ref('')

const notes = ref([])
const noteDraft = ref('')
const noteBusy = ref(false)

const historyOpen = ref(false)
const historyLoading = ref(false)
const historyList = ref([])

onMounted(async () => {
  await loadOwnerFlag()
  if (!isOwnerSync()) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
    }, 400)
    return
  }
  await loadAll()
})

function pad(n) {
  return String(n).length < 2 ? '0' + n : String(n)
}

function formatNoteDate(ts) {
  const n = Number(ts)
  if (!n) return ''
  const d = new Date(n)
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

async function loadAll() {
  bootLoading.value = true
  try {
    const [todayRow, checkins, weightRows, targetRow, noteRows] = await Promise.all([
      getCheckinByDate(today),
      getAllCheckins(),
      getWeightsByDate(today),
      getTargetWeight(),
      getAllNotes(),
    ])
    checkedToday.value = !!todayRow
    const dates = []
    for (let i = 0; i < checkins.length; i++) {
      dates.push(checkins[i].date)
    }
    streak.value = calcStreak(dates, today)
    todayWeights.value = weightRows
    const tw = readTargetValue(targetRow)
    targetWeight.value = tw
    targetLoaded.value = tw
    notes.value = noteRows || []
    try {
      const latest = await syncCurrentFromLatest()
      currentWeight.value = latest ? String(latest.weight) : ''
    } catch (e) {
      const row = await getCurrentWeight()
      currentWeight.value = readCurrentValue(row)
    }
  } catch (err) {
    console.error('加载减肥页失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    bootLoading.value = false
  }
}

function onWeightTimeChange(e) {
  weightTime.value = (e && e.detail && e.detail.value) || weightTime.value
}

async function handleSaveTarget() {
  if (targetSaving.value) return
  const next = (targetWeight.value || '').trim()
  if (next === targetLoaded.value) return
  if (!next) {
    targetWeight.value = targetLoaded.value
    return
  }
  targetSaving.value = true
  try {
    await saveTargetWeight(next)
    targetWeight.value = String(Number(next))
    targetLoaded.value = targetWeight.value
  } catch (err) {
    console.error('保存目标体重失败', err)
    uni.showToast({ title: (err && err.message) || '目标保存失败', icon: 'none' })
    targetWeight.value = targetLoaded.value
  } finally {
    targetSaving.value = false
  }
}

async function refreshCurrentWeight() {
  const row = await getCurrentWeight()
  currentWeight.value = readCurrentValue(row)
}

async function handleAddWeight() {
  if (weightBusy.value) return
  weightBusy.value = true
  try {
    await addWeight(today, weightTime.value, weightInput.value)
    weightInput.value = ''
    weightTime.value = formatHm()
    todayWeights.value = await getWeightsByDate(today)
    await refreshCurrentWeight()
    uni.showToast({ title: '已记录', icon: 'success' })
  } catch (err) {
    console.error('记录体重失败', err)
    uni.showToast({ title: (err && err.message) || '记录失败', icon: 'none' })
  } finally {
    weightBusy.value = false
  }
}

async function handleRemoveWeight(item) {
  if (!item || !item._id) return
  try {
    await removeWeight(item._id)
    todayWeights.value = todayWeights.value.filter(function (row) {
      return row._id !== item._id
    })
    await refreshCurrentWeight()
  } catch (err) {
    console.error('删除体重失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

async function openWeightHistory() {
  historyOpen.value = true
  historyLoading.value = true
  try {
    historyList.value = await getAllWeights()
  } catch (err) {
    console.error('加载体重历史失败', err)
    historyList.value = []
    uni.showToast({ title: '历史加载失败', icon: 'none' })
  } finally {
    historyLoading.value = false
  }
}

function closeWeightHistory() {
  historyOpen.value = false
}

async function handleCheckin() {
  if (checkedToday.value || checkinBusy.value) return
  checkinBusy.value = true
  try {
    await addCheckin(today)
    checkedToday.value = true
    const checkins = await getAllCheckins()
    const dates = []
    for (let i = 0; i < checkins.length; i++) {
      dates.push(checkins[i].date)
    }
    streak.value = calcStreak(dates, today)
    uni.showToast({ title: '打卡成功', icon: 'success' })
  } catch (err) {
    console.error('打卡失败', err)
    uni.showToast({ title: '打卡失败', icon: 'none' })
  } finally {
    checkinBusy.value = false
  }
}

async function handleAddNote() {
  if (noteBusy.value) return
  const text = (noteDraft.value || '').trim()
  if (!text) {
    uni.showToast({ title: '写点什么吧', icon: 'none' })
    return
  }
  noteBusy.value = true
  try {
    const id = await addNote(text)
    notes.value.unshift({
      _id: id,
      kind: 'note',
      content: text,
      createdAt: Date.now(),
    })
    noteDraft.value = ''
    uni.showToast({ title: '已添加', icon: 'success' })
  } catch (err) {
    console.error('添加心得失败', err)
    uni.showToast({ title: (err && err.message) || '添加失败', icon: 'none' })
  } finally {
    noteBusy.value = false
  }
}

async function handleRemoveNote(item) {
  if (!item || !item._id) return
  try {
    await removeNote(item._id)
    notes.value = notes.value.filter(function (row) {
      return row._id !== item._id
    })
  } catch (err) {
    console.error('删除心得失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.diet-page {
  position: relative;
  height: 100%;
  padding: 16rpx 28rpx 80rpx;
  box-sizing: border-box;
  overflow-y: auto;
}

.diet-plaque {
  position: relative;
  z-index: 2;
  margin: 0 -8rpx 20rpx;
}

.diet-plaque-frame {
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

.diet-plaque-corner {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  border-color: rgba(220, 180, 90, 0.65);
  border-style: solid;
  border-width: 0;
}

.diet-plaque-corner.tl {
  left: 8rpx;
  top: 8rpx;
  border-top-width: 3rpx;
  border-left-width: 3rpx;
}

.diet-plaque-corner.tr {
  right: 8rpx;
  top: 8rpx;
  border-top-width: 3rpx;
  border-right-width: 3rpx;
}

.diet-plaque-corner.bl {
  left: 8rpx;
  bottom: 8rpx;
  border-bottom-width: 3rpx;
  border-left-width: 3rpx;
}

.diet-plaque-corner.br {
  right: 8rpx;
  bottom: 8rpx;
  border-bottom-width: 3rpx;
  border-right-width: 3rpx;
}

.diet-plaque-title {
  font-size: 40rpx;
  font-weight: 600;
  letter-spacing: 28rpx;
  text-indent: 28rpx;
  color: #e8c878;
}

.diet-plaque-hist {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 26rpx;
  color: rgba(220, 190, 130, 0.9);
  letter-spacing: 4rpx;
  padding: 8rpx;
}

.diet-hengpi {
  position: relative;
  z-index: 2;
  margin: 0 auto 28rpx;
  padding: 14rpx 36rpx;
  max-width: 420rpx;
  box-sizing: border-box;
  text-align: center;
  background: linear-gradient(180deg, #2a2216 0%, #1a1410 100%);
  border: 1rpx solid rgba(180, 140, 70, 0.35);
  border-radius: 8rpx;
}

.diet-hengpi-text {
  font-size: 26rpx;
  letter-spacing: 6rpx;
  color: #e8c878;
}

.check-block {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  padding: 8rpx 0 40rpx;
}

.seal {
  position: relative;
  width: 200rpx;
  height: 200rpx;
}

.seal.busy {
  opacity: 0.45;
}

.seal--active {
  opacity: 0.88;
  transform: scale(0.97);
}

.seal-rim {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background: linear-gradient(145deg, #6a5430 0%, #2a2114 42%, #8a6d38 100%);
  box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.4);
}

.seal.on .seal-rim {
  background: linear-gradient(145deg, #d4a84a 0%, #7a5420 40%, #f0d080 100%);
  box-shadow: 0 0 28rpx rgba(220, 170, 70, 0.35);
}

.seal-face {
  position: absolute;
  left: 14rpx;
  top: 14rpx;
  right: 14rpx;
  bottom: 14rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #5c4528 0%, #2c2114 55%, #1a140c 100%);
  border: 2rpx solid rgba(220, 180, 90, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.seal.on .seal-face {
  background: radial-gradient(circle at 35% 28%, #c9963a 0%, #7a4e18 50%, #3a280e 100%);
  border-color: rgba(255, 220, 140, 0.55);
}

.seal-inner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.seal-action {
  font-size: 28rpx;
  letter-spacing: 8rpx;
  text-indent: 8rpx;
  color: rgba(230, 200, 140, 0.88);
}

.seal.on .seal-action {
  color: #fff4d0;
}

.weight-block,
.notes-block {
  position: relative;
  z-index: 2;
  padding: 8rpx 4rpx 0;
}

.weight-block {
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: 24rpx;
  letter-spacing: 8rpx;
  color: rgba(220, 190, 130, 0.65);
  margin-bottom: 12rpx;
}

.metric-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(220, 180, 90, 0.18);
}

.metric {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  min-width: 0;
}

.metric-label {
  flex-shrink: 0;
  font-size: 24rpx;
  letter-spacing: 4rpx;
  color: rgba(220, 190, 130, 0.65);
}

.metric-input {
  width: 96rpx;
  height: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #f0e6c8;
  text-align: left;
  background: transparent;
}

.metric-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #f0e6c8;
}

.metric-unit {
  flex-shrink: 0;
  font-size: 24rpx;
  color: rgba(220, 190, 130, 0.55);
}

.record-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(220, 180, 90, 0.18);
}

.time-chip {
  font-size: 28rpx;
  font-weight: 500;
  color: #f0e6c8;
  letter-spacing: 1rpx;
  padding: 4rpx 0;
  min-width: 100rpx;
}

.record-input {
  width: 100rpx;
  height: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #f0e6c8;
  text-align: left;
  background: transparent;
}

.ph {
  color: rgba(180, 160, 120, 0.4);
}

.diet-btn {
  margin-left: auto;
  height: 64rpx;
  padding: 0 28rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1rpx solid rgba(220, 180, 90, 0.45);
  flex-shrink: 0;
  box-sizing: border-box;
}

.diet-btn.primary {
  background: linear-gradient(180deg, #c9a24a 0%, #8a6418 100%);
  border-color: rgba(232, 200, 120, 0.7);
  margin-left: 0;
}

.diet-btn.disabled {
  opacity: 0.4;
}

.diet-btn--active {
  opacity: 0.85;
}

.diet-btn-text {
  font-size: 28rpx;
  letter-spacing: 8rpx;
  text-indent: 8rpx;
  color: #e8c878;
}

.primary-text {
  color: #fff4d6;
}

.empty-line {
  font-size: 24rpx;
  color: rgba(180, 160, 120, 0.5);
  letter-spacing: 2rpx;
  padding: 20rpx 0;
}

.weight-list {
  margin-top: 4rpx;
}

.weight-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(220, 180, 90, 0.12);
}

.weight-row:last-child {
  border-bottom: none;
}

.weight-label {
  font-size: 28rpx;
  font-weight: 500;
  color: rgba(245, 230, 190, 0.92);
}

.weight-del {
  font-size: 24rpx;
  color: rgba(200, 140, 120, 0.75);
  letter-spacing: 2rpx;
  padding: 8rpx 0;
}

.note-list {
  margin-bottom: 8rpx;
}

.note-item {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(220, 180, 90, 0.12);
}

.note-body {
  flex: 1;
  min-width: 0;
}

.note-content {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.65;
  color: rgba(245, 230, 190, 0.92);
  letter-spacing: 1rpx;
  word-break: break-all;
}

.note-date {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(180, 160, 120, 0.55);
  letter-spacing: 1rpx;
}

.note-del {
  flex-shrink: 0;
  font-size: 24rpx;
  color: rgba(200, 140, 120, 0.75);
  letter-spacing: 2rpx;
  padding: 4rpx 0;
}

.note-compose {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
  padding-top: 8rpx;
}

.note-input {
  flex: 1;
  height: 64rpx;
  padding: 0 4rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #f0e6c8;
  border-bottom: 1rpx solid rgba(220, 180, 90, 0.28);
  box-sizing: border-box;
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

.hist-date {
  font-size: 24rpx;
  color: rgba(230, 210, 170, 0.85);
  flex-shrink: 0;
}

.hist-detail-line {
  font-size: 24rpx;
  font-weight: 700;
  color: #e8c878;
  text-align: right;
}
</style>
