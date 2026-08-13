<template>
  <PageRoot flush fill>
    <view class="plan-page">
      <image v-if="bgSrc" class="plan-bg" :src="bgSrc" mode="aspectFill" />
      <view class="plan-veil" />

      <view class="plan-body">
        <view class="hero">
          <text class="hero-kicker">今日计划</text>
          <text class="hero-date">{{ todayText }}</text>
          <text class="hero-meta">{{ filledCount }} 条安排</text>
        </view>

        <PageLoading v-if="loading" />

        <scroll-view v-else scroll-y class="edit-area" :show-scrollbar="false">
          <view
            v-for="(item, index) in items"
            :key="itemKeys[index]"
            class="item-card"
            :class="{ focused: focusedIndex === index }"
          >
            <view class="rail">
              <view class="rail-dot" />
              <view v-if="index < items.length - 1" class="rail-line" />
            </view>

            <view class="item-main">
              <view class="item-row">
                <picker
                  mode="selector"
                  :range="timeOptions"
                  :value="startPickerIndex(index, item)"
                  @change="onStartPick(index, $event)"
                >
                  <view class="time-chip" hover-class="time-chip--active">
                    <text class="time-text">{{ item.startTime || '开始' }}</text>
                  </view>
                </picker>
                <text class="time-sep">–</text>
                <picker
                  mode="selector"
                  :range="timeOptions"
                  :value="endPickerIndex(item)"
                  @change="onEndPick(index, $event)"
                >
                  <view class="time-chip" hover-class="time-chip--active">
                    <text class="time-text">{{ item.endTime || '结束' }}</text>
                  </view>
                </picker>

                <input
                  class="item-input"
                  :value="item.text"
                  :focus="focusIndex === index"
                  :placeholder="index === 0 ? '安排内容' : '内容'"
                  :maxlength="120"
                  confirm-type="done"
                  @input="onTextInput(index, $event)"
                  @confirm="onItemConfirm(index)"
                  @focus="onItemFocus(index)"
                  @blur="onItemBlur"
                />

                <view
                  v-if="focusedIndex === index || items.length > 1"
                  class="item-del"
                  @tap.stop="removeItem(index)"
                >
                  <text class="item-del-text">删</text>
                </view>
              </view>
            </view>
          </view>

          <view class="add-row" hover-class="add-row--active" @tap="addItem">
            <text class="add-text">+ 添加安排</text>
          </view>

          <!-- 底部安全区：避免被固定底栏挡住 -->
          <view class="edit-tail" />
        </scroll-view>
      </view>

      <view class="bottom-bar">
        <view class="bar-btn" hover-class="bar-btn--active" @tap="openHistory">
          <text class="bar-btn-text">历史 {{ historyList.length }}</text>
        </view>
        <view
          v-if="hasContent"
          class="bar-btn ghost"
          hover-class="bar-btn--active"
          @tap="handleClear"
        >
          <text class="bar-btn-text">清空</text>
        </view>
        <view class="bar-btn" hover-class="bar-btn--active" @tap="openTodo">
          <text class="bar-btn-text">待办</text>
        </view>
        <view
          class="bar-btn primary"
          :class="{ disabled: saving }"
          hover-class="bar-btn--active"
          @tap="handleSave"
        >
          <text class="bar-btn-text primary-text">{{ saving ? '保存中…' : '保存' }}</text>
        </view>
      </view>
    </view>

    <view
      class="sheet-mask"
      :class="{ show: panelOpen }"
      @tap="closeSheet"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: panelOpen }" @touchmove.stop>
      <view class="sheet-handle" />

      <!-- 今日待办 -->
      <template v-if="sheetKind === 'todo'">
        <view class="panel-header">
          <text class="panel-title">今日待办</text>
          <text class="panel-close" @tap="closeSheet">关闭</text>
        </view>
        <view v-if="todoList.length === 0" class="panel-empty">暂无安排，先在计划里加点内容</view>
        <scroll-view v-else scroll-y class="panel-scroll">
          <view v-for="item in todoList" :key="item.key" class="todo-row">
            <view class="todo-check" @tap="toggleTodoDone(item)">
              <view class="checkbox" :class="{ checked: item.done }">
                <text v-if="item.done" class="check-mark">✓</text>
              </view>
            </view>
            <view class="todo-main">
              <text class="todo-time">{{ item.timeLabel }}</text>
              <text class="todo-title" :class="{ done: item.done }">{{ item.text }}</text>
            </view>
          </view>
        </scroll-view>
      </template>

      <!-- 历史计划 -->
      <template v-else>
        <view class="panel-header">
          <text class="panel-title">{{ detailItem ? '计划详情' : '历史计划' }}</text>
          <text class="panel-close" @tap="onSheetClose">
            {{ detailItem ? '返回' : '关闭' }}
          </text>
        </view>

        <view v-if="detailItem" class="detail">
          <text class="detail-date">{{ formatHistDate(detailItem.date) }}</text>
          <scroll-view scroll-y class="detail-scroll">
            <view v-for="(line, i) in detailLines" :key="i" class="detail-line">
              <text class="detail-text">{{ line || '（空）' }}</text>
            </view>
          </scroll-view>
          <view class="detail-actions">
            <view class="bar-btn primary grow" hover-class="bar-btn--active" @tap="reuseToToday">
              <text class="bar-btn-text primary-text">填入今天</text>
            </view>
            <view
              class="bar-btn ghost"
              hover-class="bar-btn--active"
              @tap="handleDeleteHistory(detailItem)"
            >
              <text class="bar-btn-text">删除</text>
            </view>
          </view>
        </view>

        <view v-else-if="historyLoading" class="panel-empty">加载中...</view>
        <view v-else-if="historyList.length === 0" class="panel-empty">还没有历史计划</view>
        <scroll-view v-else scroll-y class="panel-scroll">
          <view
            v-for="item in historyList"
            :key="item.date"
            class="hist-item"
            hover-class="hist-item--active"
            @tap="openDetail(item)"
          >
            <view class="hist-top">
              <text class="hist-date">{{ formatHistDate(item.date) }}</text>
              <text class="hist-count">{{ countLines(item.content) }} 条</text>
            </view>
            <text class="hist-summary">{{ summarize(item.content) }}</text>
          </view>
        </scroll-view>
      </template>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  getTodayPlan,
  saveTodayPlan,
  savePlanTodoDone,
  getPlanHistory,
  removePlanByDate,
} from '@/api/notebook'

/** 09:00-12:00 内容 或旧格式 09:00 内容 */
const RANGE_RE = /^(\d{1,2}:\d{2})\s*[-~～—]\s*(\d{1,2}:\d{2})\s+(.*)$/
const SINGLE_RE = /^(\d{1,2}:\d{2})\s+(.*)$/

const timeOptions = buildTimeOptions()

const items = ref([{ startTime: '', endTime: '', text: '' }])
const itemKeys = ref([0])
let nextKey = 1

const focusedIndex = ref(-1)
const focusIndex = ref(-1)

const loading = ref(false)
const saving = ref(false)
const bgSrc = ref('')

const panelOpen = ref(false)
/** '' | 'history' | 'todo' */
const sheetKind = ref('')
const historyList = ref([])
const historyLoading = ref(false)
const detailItem = ref(null)
/** 手动勾选覆盖：key -> boolean */
const todoDoneMap = ref({})
const todoToggling = ref(false)

const todayText = computed(() => {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return (
    d.getFullYear() +
    '年' +
    (d.getMonth() + 1) +
    '月' +
    d.getDate() +
    '日 · 星期' +
    week[d.getDay()]
  )
})

const hasContent = computed(() => {
  for (let i = 0; i < items.value.length; i++) {
    const it = items.value[i]
    if (
      (it.startTime && it.startTime.trim()) ||
      (it.endTime && it.endTime.trim()) ||
      (it.text && it.text.trim())
    ) {
      return true
    }
  }
  return false
})

const filledCount = computed(() => {
  let n = 0
  for (let i = 0; i < items.value.length; i++) {
    const it = items.value[i]
    if (
      (it.text && it.text.trim()) ||
      (it.startTime && it.startTime.trim()) ||
      (it.endTime && it.endTime.trim())
    ) {
      n += 1
    }
  }
  return n
})

const detailLines = computed(() => {
  if (!detailItem.value || !detailItem.value.content) return ['（空）']
  return detailItem.value.content.split('\n')
})

const todoList = computed(() => {
  const nowMins = currentMinutes()
  const list = []
  for (let i = 0; i < items.value.length; i++) {
    const it = items.value[i]
    const text = (it.text || '').trim()
    if (!text) continue
    const start = (it.startTime || '').trim()
    const end = (it.endTime || '').trim()
    const key = todoKey(start, end, text)
    const autoDone = isPastPlanTime(start, end, nowMins)
    const override = todoDoneMap.value[key]
    const done = override === undefined ? autoDone : !!override
    list.push({
      key,
      text,
      start,
      end,
      timeLabel: formatTodoTime(start, end),
      sort: start ? timeToMinutes(start) : 9999,
      done,
    })
  }
  list.sort((a, b) => a.sort - b.sort)
  return list
})

function buildTimeOptions() {
  const list = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = (h < 10 ? '0' : '') + h
      const mm = m === 0 ? '00' : String(m)
      list.push(hh + ':' + mm)
    }
  }
  return list
}

function timeIndexOf(time, fallback) {
  const i = timeOptions.indexOf(time)
  if (i >= 0) return i
  return fallback >= 0 ? fallback : 18
}

/** 开始时间选择器：优先已选；否则定位到上一条结束时间 */
function startPickerIndex(index, item) {
  if (item.startTime) return timeIndexOf(item.startTime, 18)
  if (index > 0) {
    const prev = items.value[index - 1]
    if (prev && prev.endTime) return timeIndexOf(prev.endTime, 18)
  }
  return 18
}

function endPickerIndex(item) {
  if (item.endTime) return timeIndexOf(item.endTime, 20)
  if (item.startTime) {
    const i = timeIndexOf(item.startTime, 18)
    return Math.min(i + 2, timeOptions.length - 1)
  }
  return 20
}

function emptyItem(startTime) {
  return { startTime: startTime || '', endTime: '', text: '' }
}

function parseLine(line) {
  const raw = (line || '').trim()
  if (!raw) return emptyItem()
  const range = raw.match(RANGE_RE)
  if (range) {
    return { startTime: range[1], endTime: range[2], text: range[3] || '' }
  }
  const single = raw.match(SINGLE_RE)
  if (single) {
    return { startTime: single[1], endTime: '', text: single[2] || '' }
  }
  return { startTime: '', endTime: '', text: raw }
}

function itemToLine(item) {
  const start = (item.startTime || '').trim()
  const end = (item.endTime || '').trim()
  const text = (item.text || '').trim()
  if (start && end && text) return start + '-' + end + ' ' + text
  if (start && end) return start + '-' + end
  if (start && text) return start + ' ' + text
  if (start) return start
  return text
}

function itemsToContent() {
  const lines = []
  for (let i = 0; i < items.value.length; i++) {
    const line = itemToLine(items.value[i])
    if (line) lines.push(line)
  }
  return lines.join('\n')
}

function setItemsFromContent(content) {
  focusedIndex.value = -1
  focusIndex.value = -1
  const text = content || ''
  if (!text.trim()) {
    items.value = [emptyItem()]
    itemKeys.value = [nextKey++]
    return
  }
  const parts = text.split('\n')
  const next = []
  const keys = []
  for (let i = 0; i < parts.length; i++) {
    next.push(parseLine(parts[i]))
    keys.push(nextKey++)
  }
  if (!next.length) {
    next.push(emptyItem())
    keys.push(nextKey++)
  }
  items.value = next
  itemKeys.value = keys
}

function focusItem(index) {
  focusIndex.value = -1
  nextTick(() => {
    focusIndex.value = index
    focusedIndex.value = index
  })
}

function prevEndTime(index) {
  if (index <= 0) return ''
  const prev = items.value[index - 1]
  return (prev && prev.endTime) || ''
}

function addItem() {
  const start = prevEndTime(items.value.length) || ''
  const next = items.value.slice()
  const keys = itemKeys.value.slice()
  next.push(emptyItem(start))
  keys.push(nextKey++)
  items.value = next
  itemKeys.value = keys
  focusItem(next.length - 1)
}

function onStartPick(index, e) {
  const i = Number(e.detail.value)
  const startTime = timeOptions[i] || ''
  const next = items.value.slice()
  next[index] = Object.assign({}, next[index], { startTime })
  items.value = next
}

function onEndPick(index, e) {
  const i = Number(e.detail.value)
  const endTime = timeOptions[i] || ''
  const next = items.value.slice()
  next[index] = Object.assign({}, next[index], { endTime })
  // 下一条若未填开始时间，自动接上本条结束时间
  if (index + 1 < next.length) {
    const after = next[index + 1]
    if (!after.startTime) {
      next[index + 1] = Object.assign({}, after, { startTime: endTime })
    }
  }
  items.value = next
}

function onTextInput(index, e) {
  const next = items.value.slice()
  next[index] = Object.assign({}, next[index], { text: e.detail.value })
  items.value = next
}

function onItemConfirm(index) {
  const start = (items.value[index] && items.value[index].endTime) || ''
  const next = items.value.slice()
  const keys = itemKeys.value.slice()
  next.splice(index + 1, 0, emptyItem(start))
  keys.splice(index + 1, 0, nextKey++)
  items.value = next
  itemKeys.value = keys
  focusItem(index + 1)
}

function onItemFocus(index) {
  focusedIndex.value = index
}

function onItemBlur() {
  setTimeout(() => {
    focusedIndex.value = -1
  }, 180)
}

function removeItem(index) {
  focusedIndex.value = -1
  focusIndex.value = -1
  if (items.value.length === 1) {
    items.value = [emptyItem()]
    itemKeys.value = [nextKey++]
    return
  }
  const next = items.value.slice()
  const keys = itemKeys.value.slice()
  next.splice(index, 1)
  keys.splice(index, 1)
  items.value = next
  itemKeys.value = keys
}

function summarize(content) {
  const text = (content || '').trim()
  if (!text) return '（空）'
  const first = text.split('\n')[0]
  return first.length > 36 ? first.slice(0, 36) + '…' : first
}

function countLines(content) {
  const text = (content || '').trim()
  if (!text) return 0
  return text.split('\n').filter((l) => l.trim()).length
}

function formatHistDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return Number(parts[1]) + '月' + Number(parts[2]) + '日 · 星期' + week[d.getDay()]
}

async function loadHistory() {
  historyLoading.value = true
  try {
    historyList.value = await getPlanHistory()
  } catch (err) {
    console.error('加载历史计划失败', err)
    historyList.value = []
  } finally {
    historyLoading.value = false
  }
}

function openHistory() {
  detailItem.value = null
  sheetKind.value = 'history'
  panelOpen.value = true
  loadHistory()
}

function openTodo() {
  detailItem.value = null
  sheetKind.value = 'todo'
  panelOpen.value = true
}

function closeSheet() {
  panelOpen.value = false
  sheetKind.value = ''
  detailItem.value = null
}

function closeHistory() {
  closeSheet()
}

function onSheetClose() {
  if (detailItem.value) {
    detailItem.value = null
    return
  }
  closeSheet()
}

function todoKey(start, end, text) {
  return (start || '') + '|' + (end || '') + '|' + (text || '')
}

function timeToMinutes(time) {
  if (!time) return -1
  const parts = time.split(':')
  if (parts.length < 2) return -1
  return Number(parts[0]) * 60 + Number(parts[1])
}

function currentMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** 已过计划时间：优先结束时间，否则开始时间 */
function isPastPlanTime(start, end, nowMins) {
  const mark = end || start
  if (!mark) return false
  const m = timeToMinutes(mark)
  if (m < 0) return false
  return nowMins >= m
}

function formatTodoTime(start, end) {
  if (start && end) return start + ' – ' + end
  if (start) return start
  if (end) return '– ' + end
  return '未定时间'
}

async function toggleTodoDone(item) {
  if (!item || todoToggling.value) return
  const nextDone = !item.done
  const prevMap = Object.assign({}, todoDoneMap.value)
  const nextMap = Object.assign({}, prevMap)
  nextMap[item.key] = nextDone
  todoDoneMap.value = nextMap
  todoToggling.value = true
  try {
    try {
      await savePlanTodoDone(nextMap)
    } catch (err) {
      if (!(err && err.message === 'NO_PLAN')) throw err
      await saveTodayPlan(itemsToContent())
      await savePlanTodoDone(nextMap)
    }
  } catch (err) {
    console.error('更新待办失败', err)
    todoDoneMap.value = prevMap
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    todoToggling.value = false
  }
}

function openDetail(item) {
  detailItem.value = item
}

async function reuseToToday() {
  if (!detailItem.value) return
  const res = await uni.showModal({
    title: '填入今天',
    content: '将用这份历史计划覆盖今天的内容，是否继续？',
  })
  if (!res.confirm) return
  setItemsFromContent(detailItem.value.content || '')
  closeHistory()
  uni.showToast({ title: '已填入，记得保存', icon: 'none' })
}

async function handleDeleteHistory(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除 ' + item.date + ' 的计划吗？',
  })
  if (!res.confirm) return

  try {
    await removePlanByDate(item.date)
    detailItem.value = null
    await loadHistory()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除历史计划失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

async function loadPlan() {
  loading.value = true
  try {
    const plan = await getTodayPlan()
    setItemsFromContent(plan ? plan.content : '')
    todoDoneMap.value = (plan && plan.todoDone) || {}
  } catch (err) {
    console.error('加载计划失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    const content = itemsToContent()
    await saveTodayPlan(content)
    if (content.trim()) {
      await savePlanTodoDone(todoDoneMap.value)
    } else {
      todoDoneMap.value = {}
    }
    await loadHistory()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存计划失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function handleClear() {
  const res = await uni.showModal({
    title: '确认清空',
    content: '确定清空今天的安排吗？',
  })
  if (!res.confirm) return

  saving.value = true
  try {
    setItemsFromContent('')
    todoDoneMap.value = {}
    await saveTodayPlan('')
    await loadHistory()
    uni.showToast({ title: '已清空', icon: 'success' })
  } catch (err) {
    console.error('清空计划失败', err)
    uni.showToast({ title: '清空失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

/** 背景图：本地 static，上传云后可改回云 fileID */
onMounted(() => {
  bgSrc.value = '/static/plan-bg.png'
  loadPlan()
  loadHistory()
})
</script>

<style lang="scss" scoped>
.plan-page {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.plan-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.plan-veil {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.42) 0%,
    rgba(255, 255, 255, 0.62) 48%,
    rgba(243, 235, 227, 0.88) 100%
  );
  pointer-events: none;
}

.plan-body {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8rpx 28rpx 0;
  box-sizing: border-box;
}

.hero {
  flex-shrink: 0;
  padding: 8rpx 4rpx 16rpx;
}

.hero-kicker {
  display: block;
  font-size: 22rpx;
  letter-spacing: 6rpx;
  color: $color-subtitle;
  margin-bottom: 8rpx;
}

.hero-date {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: $color-title;
  letter-spacing: 1rpx;
}

.hero-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: $color-primary-dark;
}

.edit-area {
  flex: 1;
  height: 0;
  width: 100%;
  box-sizing: border-box;
}

.item-card {
  display: flex;
  gap: 14rpx;
  padding: 6rpx 0;
}

.item-card.focused .item-main {
  border-color: rgba(139, 94, 60, 0.4);
  box-shadow: 0 8rpx 22rpx rgba(107, 68, 35, 0.1);
}

.rail {
  width: 22rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 28rpx;
  flex-shrink: 0;
}

.rail-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: $color-primary;
  box-shadow: 0 0 0 6rpx rgba(139, 94, 60, 0.12);
}

.rail-line {
  flex: 1;
  width: 3rpx;
  margin-top: 8rpx;
  background: rgba(139, 94, 60, 0.16);
  min-height: 28rpx;
}

.item-main {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 18rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.8);
  padding: 14rpx 16rpx;
  box-shadow: 0 4rpx 14rpx rgba(62, 39, 35, 0.05);
  box-sizing: border-box;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
}

.time-chip {
  padding: 8rpx 12rpx;
  border-radius: 12rpx;
  background: rgba(139, 94, 60, 0.1);
  border: 1rpx solid rgba(139, 94, 60, 0.16);
  flex-shrink: 0;
}

.time-chip--active {
  opacity: 0.85;
}

.time-text {
  font-size: 22rpx;
  font-weight: 600;
  color: $color-primary-dark;
}

.time-sep {
  font-size: 22rpx;
  color: $color-subtitle;
  flex-shrink: 0;
}

.item-input {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $color-title;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 8rpx;
}

.item-del {
  padding: 8rpx 6rpx;
  flex-shrink: 0;
}

.item-del-text {
  font-size: 22rpx;
  color: #c45c4a;
}

.add-row {
  margin: 12rpx 0 0 36rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  border: 1rpx dashed rgba(139, 94, 60, 0.28);
  background: rgba(255, 255, 255, 0.45);
  text-align: center;
}

.add-row--active {
  opacity: 0.85;
}

.add-text {
  font-size: 26rpx;
  color: $color-primary-dark;
  font-weight: 600;
}

.edit-tail {
  height: calc(160rpx + env(safe-area-inset-bottom));
}

.bottom-bar {
  position: relative;
  z-index: 3;
  flex-shrink: 0;
  display: flex;
  gap: 16rpx;
  padding: 12rpx 28rpx calc(12rpx + env(safe-area-inset-bottom));
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.92) 30%,
    rgba(243, 235, 227, 0.98) 100%
  );
  box-sizing: border-box;
}

.bar-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(139, 94, 60, 0.12);
  box-sizing: border-box;
}

.bar-btn.ghost {
  flex: 0.7;
}

.bar-btn.primary {
  flex: 1.2;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  border-color: transparent;
  box-shadow: 0 8rpx 20rpx rgba(107, 68, 35, 0.22);
}

.bar-btn.disabled {
  opacity: 0.55;
}

.bar-btn.grow {
  flex: 1.4;
}

.bar-btn--active {
  opacity: 0.88;
  transform: scale(0.98);
}

.bar-btn-text {
  font-size: 28rpx;
  color: $color-title;
  font-weight: 600;
}

.primary-text {
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
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: $color-card-soft;
  border: 1rpx solid rgba(139, 94, 60, 0.08);
}

.hist-item--active {
  opacity: 0.9;
}

.hist-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10rpx;
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

.hist-summary {
  display: block;
  font-size: 26rpx;
  color: $color-title;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-row {
  display: flex;
  align-items: flex-start;
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: $color-card-soft;
  border: 1rpx solid rgba(139, 94, 60, 0.08);
  box-sizing: border-box;
}

.todo-check {
  margin-right: 20rpx;
  margin-top: 4rpx;
  flex-shrink: 0;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid $color-primary;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.checkbox.checked {
  background: $color-primary;
}

.check-mark {
  color: #fff;
  font-size: 24rpx;
  line-height: 1;
}

.todo-main {
  flex: 1;
  min-width: 0;
}

.todo-time {
  display: block;
  font-size: 22rpx;
  color: $color-primary-dark;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.todo-title {
  display: block;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.45;
}

.todo-title.done {
  color: $color-subtitle;
  text-decoration: line-through;
}

.detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8rpx 28rpx 20rpx;
  box-sizing: border-box;
}

.detail-date {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: $color-primary-dark;
  margin-bottom: 16rpx;
}

.detail-scroll {
  flex: 1;
  height: 0;
  background: $color-card-soft;
  border-radius: 18rpx;
  padding: 8rpx 20rpx;
  box-sizing: border-box;
}

.detail-line {
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.detail-text {
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.5;
  white-space: pre-wrap;
}

.detail-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
</style>
