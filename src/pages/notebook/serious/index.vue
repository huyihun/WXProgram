<template>
  <PageRoot bottom="48rpx">
    <view class="serious-page">
      <PageLoading v-if="bootLoading" />

      <template v-else>
        <view class="hero">
          <text class="hero-title">Serious</text>
          <text class="hero-sub">认真对待每一天</text>
        </view>

        <!-- 打卡 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">打卡</text>
            <view class="card-head-right">
              <text class="card-meta">连续 {{ streak }} 天</text>
              <text class="hist-link" @tap="openHistory">历史</text>
            </view>
          </view>
          <view
            class="primary-btn"
            :class="{ disabled: checkedToday || checkinBusy }"
            hover-class="primary-btn--active"
            @tap="handleCheckin"
          >
            <text class="primary-btn-text">
              {{ checkedToday ? '今日已打卡' : checkinBusy ? '打卡中...' : '今日打卡' }}
            </text>
          </view>
        </view>

        <!-- 记录此刻 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">记录</text>
            <text class="card-meta card-meta--strong">{{ stamps.length }} 次</text>
          </view>
          <view
            class="primary-btn ghost"
            :class="{ disabled: stampBusy }"
            hover-class="primary-btn--active"
            @tap="handleStamp"
          >
            <text class="primary-btn-text">
              {{ stampBusy ? '记录中...' : '记录此刻' }}
            </text>
          </view>
          <view v-if="stamps.length === 0" class="empty-line">还没有时间记录</view>
          <view v-else class="stamp-list">
            <view v-for="item in stamps" :key="item._id" class="stamp-row">
              <text class="stamp-label">{{ item.label }}</text>
              <text class="stamp-del" @tap="handleRemoveStamp(item)">删除</text>
            </view>
          </view>
        </view>

        <!-- 夜区 -->
        <view class="card" :class="{ nightActive: nightActive }">
          <view class="card-head">
            <text class="card-title">夜区 22:00 – 01:00</text>
            <text class="card-meta">{{ nightKey }}</text>
          </view>
          <text v-if="nightActive" class="night-badge">当前正处于夜区时段</text>
          <view v-for="(item, index) in nightItems" :key="'n-' + index" class="todo-row">
            <view
              class="todo-check"
              :class="{ on: item.done }"
              @tap="toggleNightDone(index)"
            />
            <input
              class="todo-input"
              :value="item.text"
              placeholder="待办事项"
              :maxlength="80"
              @input="onNightText(index, $event)"
            />
            <text class="todo-del" @tap="removeNightItem(index)">删</text>
          </view>
          <view class="add-row" hover-class="add-row--active" @tap="addNightItem">
            <text class="add-text">+ 添加待办</text>
          </view>
          <view
            class="primary-btn"
            :class="{ disabled: nightSaving }"
            hover-class="primary-btn--active"
            @tap="handleSaveNight"
          >
            <text class="primary-btn-text">{{ nightSaving ? '保存中...' : '保存夜区' }}</text>
          </view>
        </view>

        <!-- 危险点警示 -->
        <view class="card card--danger">
          <view class="card-head">
            <text class="card-title card-title--danger">危险点警示</text>
            <text class="card-meta card-meta--strong">{{ dangers.length }} 条</text>
          </view>
          <view class="danger-form">
            <input
              class="danger-input"
              v-model="dangerDraft"
              placeholder="写下需要警惕的危险点..."
              :maxlength="120"
              confirm-type="done"
              @confirm="handleAddDanger"
            />
            <view
              class="danger-add"
              :class="{ disabled: dangerBusy }"
              hover-class="danger-add--active"
              @tap="handleAddDanger"
            >
              <text class="danger-add-text">{{ dangerBusy ? '...' : '添加' }}</text>
            </view>
          </view>
          <view v-if="dangers.length === 0" class="empty-line">还没有警示记录</view>
          <view v-else class="danger-list">
            <view v-for="item in dangers" :key="item._id" class="danger-row">
              <text class="danger-text">{{ item.text }}</text>
              <text class="stamp-del" @tap="handleRemoveDanger(item)">删除</text>
            </view>
          </view>
        </view>

        <!-- 总结 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">总结分析</text>
            <text class="card-meta">{{ today }}</text>
          </view>
          <textarea
            v-model="reflectionText"
            class="reflect-input"
            placeholder="分析失败的原因，写下总结心得..."
            :maxlength="2000"
            :show-confirm-bar="false"
          />
          <view
            class="primary-btn"
            :class="{ disabled: reflectSaving }"
            hover-class="primary-btn--active"
            @tap="handleSaveReflection"
          >
            <text class="primary-btn-text">{{ reflectSaving ? '保存中...' : '保存总结' }}</text>
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
        <text class="panel-title">历史记录</text>
        <text class="panel-close" @tap="closeHistory">关闭</text>
      </view>
      <view v-if="historyLoading" class="panel-empty">加载中...</view>
      <view v-else-if="historyList.length === 0" class="panel-empty">还没有历史记录</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view
          v-for="item in historyList"
          :key="item.date"
          class="hist-item"
          @tap="toggleHistoryExpand(item.date)"
        >
          <view class="hist-top">
            <text class="hist-date">{{ item.date }}</text>
            <text class="hist-count">{{ expandedDate === item.date ? '收起' : '展开' }}</text>
          </view>
          <view v-if="expandedDate === item.date" class="hist-detail" @tap.stop>
            <view class="detail-block">
              <text class="detail-label">打卡时间</text>
              <text class="detail-value">{{ item.checkinTime || '-' }}</text>
            </view>
            <view class="detail-block">
              <text class="detail-label">记录时刻（{{ item.stampCount }} 次）</text>
              <text v-if="!item.stamps.length" class="detail-value">-</text>
              <text
                v-for="(s, si) in item.stamps"
                :key="'s-' + si"
                class="detail-line"
              >
                {{ s.hm || s.label || '-' }}
              </text>
            </view>
            <view class="detail-block">
              <text class="detail-label">夜区待办</text>
              <text v-if="!item.nightItems.length" class="detail-value">-</text>
              <text
                v-for="(n, ni) in item.nightItems"
                :key="'n-' + ni"
                class="detail-line"
              >
                {{ n.done ? '✓ ' : '○ ' }}{{ n.text || '-' }}
              </text>
            </view>
            <view class="detail-block">
              <text class="detail-label">危险点警示</text>
              <text v-if="!item.dangers.length" class="detail-value">-</text>
              <text
                v-for="(d, di) in item.dangers"
                :key="'d-' + di"
                class="detail-line"
              >
                {{ d || '-' }}
              </text>
            </view>
            <view class="detail-block">
              <text class="detail-label">总结分析</text>
              <text class="detail-value">{{ item.reflection || '-' }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import {
  getToday,
  getNightKey,
  isInNightWindow,
  getCheckinByDate,
  getAllCheckins,
  calcStreak,
  addCheckin,
  getStampsByDate,
  addStamp,
  removeStamp,
  getNightPlan,
  saveNightPlan,
  getDangersByDate,
  addDanger,
  removeDanger,
  getReflection,
  saveReflection,
  getHistoryDays,
} from '@/api/serious'

const bootLoading = ref(true)
const today = getToday()
const nightKey = ref(getNightKey())
const nightActive = ref(isInNightWindow())

const checkedToday = ref(false)
const streak = ref(0)
const checkinBusy = ref(false)

const stamps = ref([])
const stampBusy = ref(false)

const nightItems = ref([{ text: '', done: false }])
const nightSaving = ref(false)

const dangers = ref([])
const dangerDraft = ref('')
const dangerBusy = ref(false)

const reflectionText = ref('')
const reflectSaving = ref(false)

const historyOpen = ref(false)
const historyLoading = ref(false)
const historyList = ref([])
const expandedDate = ref('')

onMounted(async () => {
  await loadOwnerFlag()
  if (!isOwnerSync()) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/notebook/index' }) })
    }, 400)
    return
  }
  await loadAll()
})

async function loadAll() {
  bootLoading.value = true
  nightKey.value = getNightKey()
  nightActive.value = isInNightWindow()
  try {
    const [todayRow, checkins, stampList, nightRow, dangerList, reflectRow] = await Promise.all([
      getCheckinByDate(today),
      getAllCheckins(),
      getStampsByDate(today),
      getNightPlan(nightKey.value),
      getDangersByDate(today),
      getReflection(today),
    ])
    checkedToday.value = !!todayRow
    const dates = []
    for (let i = 0; i < checkins.length; i++) {
      dates.push(checkins[i].date)
    }
    streak.value = calcStreak(dates, today)
    stamps.value = stampList
    if (nightRow && nightRow.items && nightRow.items.length) {
      nightItems.value = nightRow.items.map((it) => ({
        text: it.text || '',
        done: !!it.done,
      }))
    } else {
      nightItems.value = [{ text: '', done: false }]
    }
    dangers.value = dangerList
    reflectionText.value = (reflectRow && reflectRow.content) || ''
  } catch (err) {
    console.error('加载 Serious 失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    bootLoading.value = false
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

async function handleStamp() {
  if (stampBusy.value) return
  stampBusy.value = true
  try {
    await addStamp()
    stamps.value = await getStampsByDate(today)
    uni.showToast({ title: '已记录', icon: 'success' })
  } catch (err) {
    console.error('记录失败', err)
    uni.showToast({ title: '记录失败', icon: 'none' })
  } finally {
    stampBusy.value = false
  }
}

async function handleRemoveStamp(item) {
  if (!item || !item._id) return
  try {
    await removeStamp(item._id)
    stamps.value = stamps.value.filter((row) => row._id !== item._id)
  } catch (err) {
    console.error('删除记录失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

function addNightItem() {
  nightItems.value.push({ text: '', done: false })
}

function removeNightItem(index) {
  if (nightItems.value.length <= 1) {
    nightItems.value = [{ text: '', done: false }]
    return
  }
  nightItems.value.splice(index, 1)
}

function toggleNightDone(index) {
  const item = nightItems.value[index]
  if (!item) return
  item.done = !item.done
}

function onNightText(index, e) {
  const item = nightItems.value[index]
  if (!item) return
  item.text = (e && e.detail && e.detail.value) || ''
}

async function handleSaveNight() {
  if (nightSaving.value) return
  nightSaving.value = true
  try {
    await saveNightPlan(nightKey.value, nightItems.value)
    uni.showToast({ title: '夜区已保存', icon: 'success' })
  } catch (err) {
    console.error('保存夜区失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    nightSaving.value = false
  }
}

async function handleAddDanger() {
  if (dangerBusy.value) return
  const text = (dangerDraft.value || '').trim()
  if (!text) {
    uni.showToast({ title: '请填写警示内容', icon: 'none' })
    return
  }
  dangerBusy.value = true
  try {
    await addDanger(text, today)
    dangerDraft.value = ''
    dangers.value = await getDangersByDate(today)
    uni.showToast({ title: '已添加', icon: 'success' })
  } catch (err) {
    console.error('添加警示失败', err)
    uni.showToast({ title: '添加失败', icon: 'none' })
  } finally {
    dangerBusy.value = false
  }
}

async function handleRemoveDanger(item) {
  if (!item || !item._id) return
  try {
    await removeDanger(item._id)
    dangers.value = dangers.value.filter((row) => row._id !== item._id)
  } catch (err) {
    console.error('删除警示失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

async function handleSaveReflection() {
  if (reflectSaving.value) return
  reflectSaving.value = true
  try {
    await saveReflection(today, reflectionText.value)
    uni.showToast({ title: '总结已保存', icon: 'success' })
  } catch (err) {
    console.error('保存总结失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    reflectSaving.value = false
  }
}

async function openHistory() {
  historyOpen.value = true
  expandedDate.value = ''
  historyLoading.value = true
  try {
    historyList.value = await getHistoryDays()
  } catch (err) {
    console.error('加载历史失败', err)
    historyList.value = []
    uni.showToast({ title: '历史加载失败', icon: 'none' })
  } finally {
    historyLoading.value = false
  }
}

function closeHistory() {
  historyOpen.value = false
  expandedDate.value = ''
}

function toggleHistoryExpand(date) {
  if (expandedDate.value === date) {
    expandedDate.value = ''
    return
  }
  expandedDate.value = date
}
</script>

<style lang="scss" scoped>
.serious-page {
  padding-bottom: 24rpx;
}

.hero {
  margin-bottom: 28rpx;
}

.hero-title {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 8rpx;
}

.hero-sub {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
}

.card {
  background: $color-card;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
}

.card.nightActive {
  border: 2rpx solid rgba(74, 159, 232, 0.45);
  background: rgba(74, 159, 232, 0.06);
}

.card--danger {
  border: 2rpx solid rgba(196, 86, 72, 0.35);
  background: rgba(196, 86, 72, 0.05);
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.card-head-right {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
}

.card-title--danger {
  color: #a9443a;
}

.card-meta {
  font-size: 22rpx;
  color: $color-subtitle;
}

.card-meta--strong {
  font-size: 26rpx;
  font-weight: 700;
  color: $color-title;
}

.hist-link {
  font-size: 24rpx;
  font-weight: 600;
  color: $color-primary-dark;
  padding: 4rpx 0;
}

.night-badge {
  display: block;
  margin: -8rpx 0 16rpx;
  font-size: 22rpx;
  color: $color-primary-dark;
}

.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  margin-bottom: 16rpx;
}

.primary-btn.ghost {
  background: rgba(74, 159, 232, 0.14);
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

.primary-btn.ghost .primary-btn-text {
  color: $color-primary-dark;
}

.empty-line {
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx 0;
}

.stamp-list {
  margin-top: 4rpx;
}

.stamp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.stamp-row:last-child {
  border-bottom: none;
}

.stamp-label {
  font-size: 28rpx;
  color: $color-title;
  font-weight: 600;
}

.stamp-del {
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx;
}

.todo-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.todo-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 10rpx;
  border: 3rpx solid $color-primary;
  margin-right: 16rpx;
  flex-shrink: 0;
  box-sizing: border-box;
}

.todo-check.on {
  background: $color-primary;
}

.todo-input {
  flex: 1;
  min-width: 0;
  height: 64rpx;
  font-size: 28rpx;
  color: $color-title;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 12rpx;
  padding: 0 16rpx;
}

.todo-del {
  margin-left: 12rpx;
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx;
  flex-shrink: 0;
}

.add-row {
  padding: 12rpx 0 20rpx;
}

.add-row--active {
  opacity: 0.7;
}

.add-text {
  font-size: 26rpx;
  color: $color-primary-dark;
  font-weight: 600;
}

.danger-form {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  gap: 12rpx;
}

.danger-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  font-size: 28rpx;
  color: $color-title;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12rpx;
  padding: 0 16rpx;
  box-sizing: border-box;
}

.danger-add {
  flex-shrink: 0;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #c45648;
  display: flex;
  align-items: center;
  justify-content: center;
}

.danger-add.disabled {
  opacity: 0.55;
}

.danger-add--active {
  opacity: 0.88;
}

.danger-add-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

.danger-list {
  margin-top: 4rpx;
}

.danger-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(196, 86, 72, 0.12);
}

.danger-row:last-child {
  border-bottom: none;
}

.danger-text {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: #7a2e28;
  line-height: 1.5;
  margin-right: 16rpx;
}

.reflect-input {
  width: 100%;
  min-height: 240rpx;
  box-sizing: border-box;
  padding: 20rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: $color-title;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 16rpx;
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
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: $color-card-soft;
  border: 1rpx solid rgba(139, 94, 60, 0.08);
}

.hist-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.hist-date {
  font-size: 28rpx;
  color: $color-primary-dark;
  font-weight: 700;
}

.hist-count {
  font-size: 22rpx;
  color: $color-subtitle;
}

.hist-detail {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.detail-block {
  margin-bottom: 20rpx;
}

.detail-block:last-child {
  margin-bottom: 0;
}

.detail-label {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
  margin-bottom: 8rpx;
}

.detail-value {
  display: block;
  font-size: 26rpx;
  color: $color-title;
  line-height: 1.5;
  white-space: pre-wrap;
}

.detail-line {
  display: block;
  font-size: 26rpx;
  color: $color-title;
  line-height: 1.5;
  margin-bottom: 4rpx;
}
</style>
