<template>
  <PageRoot flush fill>
    <view class="plan-page">
      <PageLoading v-if="loading" />

      <view v-else class="editor-wrap">
        <textarea
          class="editor"
          :value="draftText"
          placeholder="写下今天的计划，可换行"
          placeholder-class="editor-ph"
          :maxlength="4000"
          :show-confirm-bar="false"
          :adjust-position="true"
          @input="onDraftInput"
        />
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
              <text class="todo-title" :class="{ done: item.done }">{{ item.text }}</text>
            </view>
          </view>
        </scroll-view>
      </template>

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
              <text class="hist-count">{{ countLines(item.content) }} 行</text>
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
  getToday,
  getTodayPlan,
  saveTodayPlan,
  savePlanTodoDone,
  getPlanHistory,
  removePlanByDate,
} from '@/api/notebook'

const DRAFT_KEY = 'notebook_plan_draft_v1'

const draftText = ref('')
const loading = ref(true)
const saving = ref(false)

const panelOpen = ref(false)
/** '' | 'history' | 'todo' */
const sheetKind = ref('')
const historyList = ref([])
const historyLoading = ref(false)
const detailItem = ref(null)
const todoDoneMap = ref({})
const todoToggling = ref(false)

let draftTimer = null

const hasContent = computed(() => !!(draftText.value && draftText.value.trim()))

const detailLines = computed(() => {
  if (!detailItem.value || !detailItem.value.content) return ['（空）']
  return detailItem.value.content.split('\n')
})

const todoList = computed(() => {
  const list = []
  const parts = (draftText.value || '').split('\n')
  for (let i = 0; i < parts.length; i++) {
    const text = (parts[i] || '').trim()
    if (!text) continue
    const key = i + '|' + text
    list.push({
      key,
      text,
      done: !!todoDoneMap.value[key],
    })
  }
  return list
})

function readLocalDraft() {
  try {
    const raw = uni.getStorageSync(DRAFT_KEY)
    if (!raw) return null
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return parsed
    }
    return raw
  } catch (e) {
    return null
  }
}

function writeLocalDraft(content) {
  const payload = {
    date: getToday(),
    content: content == null ? '' : String(content),
  }
  try {
    uni.setStorageSync(DRAFT_KEY, payload)
  } catch (e) {
    console.warn('计划草稿写入失败', e)
  }
}

function flushDraftNow() {
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  writeLocalDraft(draftText.value)
}

function scheduleDraftWrite() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    draftTimer = null
    writeLocalDraft(draftText.value)
  }, 250)
}

function onDraftInput(e) {
  draftText.value = (e.detail && e.detail.value) || ''
  scheduleDraftWrite()
}

function setDraft(content, persist) {
  draftText.value = content || ''
  if (persist !== false) writeLocalDraft(draftText.value)
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

function onSheetClose() {
  if (detailItem.value) {
    detailItem.value = null
    return
  }
  closeSheet()
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
      await saveTodayPlan(draftText.value)
      writeLocalDraft(draftText.value)
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
    content: '将用这份历史计划覆盖今天的编辑内容，是否继续？',
  })
  if (!res.confirm) return
  setDraft(detailItem.value.content || '')
  closeSheet()
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
    const today = getToday()
    const local = readLocalDraft()
    const plan = await getTodayPlan()
    if (local && local.date === today) {
      draftText.value = local.content == null ? '' : String(local.content)
    } else {
      setDraft(plan ? plan.content : '')
    }
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
    const content = draftText.value || ''
    await saveTodayPlan(content)
    writeLocalDraft(content)
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
    setDraft('')
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

onMounted(() => {
  loadPlan()
  loadHistory()
})

onHide(() => {
  flushDraftNow()
})

onUnload(() => {
  flushDraftNow()
})
</script>

<style lang="scss" scoped>
.plan-page {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8rpx 32rpx 0;
  box-sizing: border-box;
}

.editor-wrap {
  flex: 1;
  min-height: 0;
  margin-bottom: 16rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: $shadow-card;
  padding: 28rpx 28rpx 20rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.editor {
  width: 100%;
  height: 100%;
  font-size: 30rpx;
  line-height: 1.75;
  color: $color-title;
  box-sizing: border-box;
}

.editor-ph {
  color: rgba(141, 110, 99, 0.5);
  font-size: 30rpx;
  line-height: 1.75;
}

.bottom-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 0 calc(20rpx + env(safe-area-inset-bottom));
}

.bar-btn {
  flex-shrink: 0;
  height: 80rpx;
  padding: 0 22rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.bar-btn.ghost {
  background: rgba(255, 255, 255, 0.55);
}

.bar-btn.primary {
  flex: 1;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  box-shadow: 0 10rpx 24rpx rgba(107, 68, 35, 0.2);
}

.bar-btn.grow {
  flex: 1;
}

.bar-btn.disabled {
  opacity: 0.55;
}

.bar-btn--active {
  opacity: 0.9;
}

.bar-btn-text {
  font-size: 26rpx;
  color: $color-title;
  font-weight: 500;
}

.bar-btn-text.primary-text {
  color: #fff;
  font-weight: 700;
  font-size: 28rpx;
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(40, 28, 20, 0.35);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.25s ease, visibility 0.25s ease;
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
  padding: 18rpx 32rpx 14rpx;
  flex-shrink: 0;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
}

.panel-close {
  font-size: 26rpx;
  color: $color-primary;
  padding: 8rpx;
}

.panel-empty {
  padding: 64rpx 32rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.panel-scroll {
  flex: 1;
  height: 0;
  padding: 0 32rpx 24rpx;
  box-sizing: border-box;
}

.todo-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.todo-check {
  padding-top: 4rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 10rpx;
  border: 2rpx solid $color-primary;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox.checked {
  background: $color-primary;
}

.check-mark {
  font-size: 22rpx;
  color: #fff;
  line-height: 1;
}

.todo-main {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.55;
}

.todo-title.done {
  color: $color-subtitle;
  text-decoration: line-through;
}

.detail {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 32rpx 24rpx;
  box-sizing: border-box;
}

.detail-date {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 16rpx;
}

.detail-scroll {
  flex: 1;
  height: 0;
}

.detail-line {
  padding: 10rpx 0;
}

.detail-text {
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.65;
}

.detail-actions {
  display: flex;
  gap: 12rpx;
  padding-top: 16rpx;
  flex-shrink: 0;
}

.hist-item {
  padding: 22rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.hist-item--active {
  opacity: 0.85;
}

.hist-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.hist-date {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-title;
}

.hist-count {
  font-size: 22rpx;
  color: $color-subtitle;
}

.hist-summary {
  font-size: 26rpx;
  color: $color-subtitle;
  line-height: 1.5;
}
</style>
