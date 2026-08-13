<template>
  <PageRoot bottom="48rpx">
    <view class="diet-page">
      <PageLoading v-if="bootLoading" />

      <template v-else>
        <!-- 当天体重（最先展示） -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">体重</text>
            <text class="hist-link" @tap="openWeightHistory">历史记录</text>
          </view>
          <view class="field-row target-row">
            <text class="target-label">目标</text>
            <input
              class="field-input grow"
              type="digit"
              v-model="targetWeight"
              placeholder="目标体重"
              :maxlength="6"
              confirm-type="done"
              @confirm="handleSaveTarget"
              @blur="handleSaveTarget"
            />
            <text class="unit-text">斤</text>
          </view>
          <view class="field-row current-row">
            <text class="target-label">当前</text>
            <text class="current-value">{{ currentWeight || '--' }}</text>
            <text class="unit-text">斤</text>
          </view>
          <view class="field-row">
            <picker mode="time" :value="weightTime" @change="onWeightTimeChange">
              <view class="field-input time-picker">{{ weightTime || '选择时间' }}</view>
            </picker>
            <input
              class="field-input grow"
              type="digit"
              v-model="weightInput"
              placeholder="体重"
              :maxlength="6"
            />
            <text class="unit-text">斤</text>
          </view>
          <view
            class="primary-btn"
            :class="{ disabled: weightBusy }"
            hover-class="primary-btn--active"
            @tap="handleAddWeight"
          >
            <text class="primary-btn-text">{{ weightBusy ? '保存中...' : '记录体重' }}</text>
          </view>
          <view v-if="todayWeights.length === 0" class="empty-line">今天还没有体重记录</view>
          <view v-else class="weight-list">
            <view v-for="item in todayWeights" :key="item._id" class="weight-row">
              <text class="weight-label">{{ item.time }} · {{ item.weight }} 斤</text>
              <text class="weight-del" @tap="handleRemoveWeight(item)">删除</text>
            </view>
          </view>
        </view>

        <!-- 打卡单独一行（右上）+ 秘诀 -->
        <view class="tip-block">
          <view class="check-bar">
            <text class="streak-hint">连续 {{ streak }} 天</text>
            <view
              class="check-btn"
              :class="{ on: checkedToday, busy: checkinBusy }"
              hover-class="check-btn--active"
              @tap="handleCheckin"
            >
              <view class="check-ico">
                <view class="check-ico-ring" />
                <view class="check-ico-tick" />
              </view>
              <text class="check-btn-text">{{ checkedToday ? '已打卡' : '打卡' }}</text>
            </view>
          </view>
          <textarea
            class="tip-input"
            v-model="tipText"
            placeholder="秘诀"
            :maxlength="200"
            :auto-height="true"
            :show-confirm-bar="false"
            @blur="handleSaveTip"
          />
        </view>

        <!-- 午餐 / 晚餐 / 喝 -->
        <view class="card">
          <view class="field-row">
            <input class="field-input grow" v-model="dayForm.lunch" placeholder="吃什么" :maxlength="60" />
            <input class="field-input amount" v-model="dayForm.lunchAmount" placeholder="量" :maxlength="20" />
          </view>
          <view class="field-row">
            <input class="field-input grow" v-model="dayForm.dinner" placeholder="吃什么" :maxlength="60" />
            <input class="field-input amount" v-model="dayForm.dinnerAmount" placeholder="量" :maxlength="20" />
          </view>
          <input class="field-input full" v-model="dayForm.drink" placeholder="喝什么" :maxlength="80" />
        </view>

        <!-- 只吃 / 不吃（用 input 避免 textarea 固定高度内滚动） -->
        <view class="card">
          <input
            v-model="onlyEat"
            class="area-input"
            placeholder="只吃什么"
            :maxlength="200"
          />
          <input
            v-model="dontEat"
            class="area-input"
            placeholder="不吃什么"
            :maxlength="200"
          />
        </view>

        <!-- 运动区：多项 -->
        <view class="card card--sport">
          <view v-for="(item, index) in sports" :key="'s-' + index" class="field-row">
            <input
              class="field-input grow"
              :value="item.name"
              placeholder="运动项目"
              :maxlength="40"
              @input="onSportName(index, $event)"
            />
            <input
              class="field-input amount"
              type="digit"
              :value="item.minutes"
              placeholder="时长"
              :maxlength="4"
              @input="onSportMinutes(index, $event)"
            />
            <text class="unit-text">分钟</text>
            <text class="sport-del" @tap="removeSport(index)">删</text>
          </view>
          <view class="add-row" hover-class="add-row--active" @tap="addSport">
            <text class="add-text">+ 添加运动</text>
          </view>
        </view>

        <view
          class="primary-btn"
          :class="{ disabled: saving }"
          hover-class="primary-btn--active"
          @tap="handleSaveAll"
        >
          <text class="primary-btn-text">{{ saving ? '保存中...' : '保存' }}</text>
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
  getTip,
  saveTip,
  getCheckinByDate,
  getAllCheckins,
  calcStreak,
  addCheckin,
  getDayLog,
  saveDayLog,
  getRules,
  saveRules,
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
} from '@/api/diet'

const bootLoading = ref(true)
const today = getToday()

const tipText = ref('')
const tipSaving = ref(false)
const tipLoaded = ref('')

const checkedToday = ref(false)
const streak = ref(0)
const checkinBusy = ref(false)

const dayForm = ref({
  lunch: '',
  lunchAmount: '',
  dinner: '',
  dinnerAmount: '',
  drink: '',
})
const sports = ref([{ name: '', minutes: '' }])
const onlyEat = ref('')
const dontEat = ref('')
const saving = ref(false)

const weightTime = ref(formatHm())
const weightInput = ref('')
const weightBusy = ref(false)
const todayWeights = ref([])
const targetWeight = ref('')
const targetLoaded = ref('')
const targetSaving = ref(false)
const currentWeight = ref('')

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

function normalizeSports(dayRow) {
  if (dayRow && dayRow.sports && dayRow.sports.length) {
    return dayRow.sports.map((it) => ({
      name: it.name || '',
      minutes: it.minutes || '',
    }))
  }
  if (dayRow && (dayRow.sport || dayRow.sportMinutes)) {
    return [{ name: dayRow.sport || '', minutes: dayRow.sportMinutes || '' }]
  }
  return [{ name: '', minutes: '' }]
}

async function loadAll() {
  bootLoading.value = true
  try {
    const [tipRow, todayRow, checkins, dayRow, rulesRow, weightRows, targetRow] = await Promise.all([
      getTip(),
      getCheckinByDate(today),
      getAllCheckins(),
      getDayLog(today),
      getRules(),
      getWeightsByDate(today),
      getTargetWeight(),
    ])
    tipText.value = (tipRow && tipRow.content) || ''
    tipLoaded.value = tipText.value
    checkedToday.value = !!todayRow
    const dates = []
    for (let i = 0; i < checkins.length; i++) {
      dates.push(checkins[i].date)
    }
    streak.value = calcStreak(dates, today)
    if (dayRow) {
      dayForm.value = {
        lunch: dayRow.lunch || '',
        lunchAmount: dayRow.lunchAmount || '',
        dinner: dayRow.dinner || '',
        dinnerAmount: dayRow.dinnerAmount || '',
        drink: dayRow.drink || '',
      }
    }
    sports.value = normalizeSports(dayRow)
    onlyEat.value = (rulesRow && rulesRow.onlyEat) || ''
    dontEat.value = (rulesRow && rulesRow.dontEat) || ''
    todayWeights.value = weightRows
    const tw = readTargetValue(targetRow)
    targetWeight.value = tw
    targetLoaded.value = tw
    // 当前体重 = 最近一次记录，并写回 kind:current
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
    todayWeights.value = todayWeights.value.filter((row) => row._id !== item._id)
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

async function handleSaveTip() {
  if (tipSaving.value) return
  const next = (tipText.value || '').trim()
  if (next === tipLoaded.value) return
  tipSaving.value = true
  try {
    await saveTip(next)
    tipText.value = next
    tipLoaded.value = next
  } catch (err) {
    console.error('保存秘诀失败', err)
    uni.showToast({ title: '秘诀保存失败', icon: 'none' })
  } finally {
    tipSaving.value = false
  }
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

function addSport() {
  sports.value.push({ name: '', minutes: '' })
}

function removeSport(index) {
  if (sports.value.length <= 1) {
    sports.value = [{ name: '', minutes: '' }]
    return
  }
  sports.value.splice(index, 1)
}

function onSportName(index, e) {
  const item = sports.value[index]
  if (!item) return
  item.name = (e && e.detail && e.detail.value) || ''
}

function onSportMinutes(index, e) {
  const item = sports.value[index]
  if (!item) return
  item.minutes = (e && e.detail && e.detail.value) || ''
}

async function handleSaveAll() {
  if (saving.value) return
  saving.value = true
  try {
    const tasks = [
      saveDayLog(today, {
        lunch: dayForm.value.lunch,
        lunchAmount: dayForm.value.lunchAmount,
        dinner: dayForm.value.dinner,
        dinnerAmount: dayForm.value.dinnerAmount,
        drink: dayForm.value.drink,
        sports: sports.value,
      }),
      saveRules(onlyEat.value, dontEat.value),
    ]
    const tw = (targetWeight.value || '').trim()
    if (tw && tw !== targetLoaded.value) {
      tasks.push(
        saveTargetWeight(tw).then(() => {
          targetWeight.value = String(Number(tw))
          targetLoaded.value = targetWeight.value
        })
      )
    }
    await Promise.all(tasks)
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存失败', err)
    uni.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.diet-page {
  padding-bottom: 24rpx;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
}

.hist-link {
  font-size: 24rpx;
  font-weight: 600;
  color: $color-primary-dark;
  padding: 4rpx 0;
}

.unit-text {
  flex-shrink: 0;
  font-size: 28rpx;
  color: $color-subtitle;
  padding: 0 4rpx;
}

.target-row,
.current-row {
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.target-label {
  flex-shrink: 0;
  font-size: 28rpx;
  color: $color-subtitle;
  width: 72rpx;
}

.current-value {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
}

.field-row picker {
  flex-shrink: 0;
}

.time-picker {
  width: 160rpx;
  display: flex;
  align-items: center;
  color: $color-title;
}

.empty-line {
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx 0;
}

.weight-list {
  margin-top: 4rpx;
}

.weight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.weight-row:last-child {
  border-bottom: none;
}

.weight-label {
  font-size: 28rpx;
  color: $color-title;
  font-weight: 600;
}

.weight-del {
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx;
}

.tip-block {
  margin-bottom: 28rpx;
  padding: 0 4rpx;
}

.check-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.streak-hint {
  font-size: 22rpx;
  color: $color-subtitle;
}

.check-btn {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 20rpx 10rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(74, 159, 232, 0.12);
  border: 2rpx solid rgba(74, 159, 232, 0.45);
}

.check-btn.on {
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  border-color: $color-primary-dark;
}

.check-btn.busy {
  opacity: 0.55;
}

.check-btn--active {
  transform: scale(0.96);
  opacity: 0.9;
}

.check-ico {
  position: relative;
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.check-ico-ring {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 3rpx solid $color-primary-dark;
  box-sizing: border-box;
  background: #fff;
}

.check-btn.on .check-ico-ring {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.22);
}

.check-ico-tick {
  position: absolute;
  left: 10rpx;
  top: 8rpx;
  width: 14rpx;
  height: 8rpx;
  border-left: 3rpx solid transparent;
  border-bottom: 3rpx solid transparent;
  transform: rotate(-45deg);
  opacity: 0;
}

.check-btn.on .check-ico-tick {
  border-left-color: #fff;
  border-bottom-color: #fff;
  opacity: 1;
}

.check-btn-text {
  font-size: 26rpx;
  font-weight: 700;
  color: $color-primary-dark;
  letter-spacing: 1rpx;
}

.check-btn.on .check-btn-text {
  color: #fff;
}

.tip-input {
  width: 100%;
  min-height: 56rpx;
  max-height: 120rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: $color-title;
  line-height: 1.4;
  padding: 0;
  box-sizing: border-box;
}

.card {
  background: $color-card;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
}

.card--sport {
  margin-top: 56rpx;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.field-input {
  height: 72rpx;
  font-size: 28rpx;
  color: $color-title;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 12rpx;
  padding: 0 16rpx;
  box-sizing: border-box;
}

.field-input.grow {
  flex: 1;
  min-width: 0;
}

.field-input.amount {
  width: 140rpx;
  flex-shrink: 0;
}

.field-input.full {
  width: 100%;
  margin-bottom: 0;
}

.sport-del {
  flex-shrink: 0;
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx;
}

.add-row {
  padding: 4rpx 0;
}

.add-row--active {
  opacity: 0.7;
}

.add-text {
  font-size: 26rpx;
  color: $color-primary-dark;
  font-weight: 600;
}

.area-input {
  width: 100%;
  height: 72rpx;
  box-sizing: border-box;
  padding: 0 20rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  color: $color-title;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 16rpx;
}

.area-input:last-of-type {
  margin-bottom: 0;
}

.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  margin-bottom: 8rpx;
}

.primary-btn.disabled {
  opacity: 0.55;
}

.primary-btn--active {
  opacity: 0.88;
}

.primary-btn-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(30, 20, 12, 0.4);
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
  height: 68vh;
  display: flex;
  flex-direction: column;
  background: $color-card;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -8rpx 32rpx rgba(107, 68, 35, 0.12);
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
  background: rgba(0, 0, 0, 0.12);
  margin: 16rpx auto 0;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx 24rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
}

.panel-close {
  font-size: 26rpx;
  color: $color-primary-dark;
  padding: 8rpx;
}

.panel-empty {
  padding: 64rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.panel-scroll {
  flex: 1;
  height: 0;
  padding: 12rpx 0;
  box-sizing: border-box;
}

.hist-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: $color-card-soft;
  border: 1rpx solid rgba(139, 94, 60, 0.08);
}

.hist-date {
  flex-shrink: 0;
  font-size: 26rpx;
  color: $color-primary-dark;
  font-weight: 700;
}

.hist-detail-line {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  color: $color-title;
  line-height: 1.5;
}
</style>
