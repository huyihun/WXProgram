<template>
  <PageRoot>
    <view class="diary-page" :style="{ height: pageHeight + 'px' }">
      <view class="diary-top">
        <view class="date-header">
          <text class="date-label">今日日记</text>
          <text class="date-value">{{ today }}</text>
        </view>

        <view class="toolbar">
          <text class="action-history" @tap="openHistory">历史 {{ historyList.length }}</text>
          <text v-if="hasContent" class="action-clear" @tap="handleClear">清空</text>
          <view class="toolbar-spacer" />
          <text class="action-save" :class="{ disabled: saving }" @tap="handleSave">
            {{ saving ? '保存中…' : '保存' }}
          </text>
        </view>

        <input
          v-model="title"
          class="title-input"
          placeholder="给今天起个题目（可选）"
          :maxlength="40"
        />
      </view>

      <view v-if="loading" class="status-tip">加载中...</view>
      <view v-else class="editor-wrap" :style="{ height: inputHeight + 'px' }">
        <textarea
          v-model="content"
          class="write-input"
          :placeholder="promptText"
          :maxlength="3000"
          :show-confirm-bar="false"
        />
        <text class="char-count">{{ contentLength }} 字</text>
      </view>
    </view>

    <!-- 历史日记抽屉 -->
    <view
      class="sheet-mask"
      :class="{ show: panelOpen }"
      @tap="closeHistory"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: panelOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-header">
        <text class="panel-title">历史日记</text>
        <text class="panel-close" @tap="closeHistory">关闭</text>
      </view>

      <view v-if="historyLoading" class="panel-empty">加载中...</view>
      <view v-else-if="historyList.length === 0" class="panel-empty">还没有历史日记</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view v-for="item in historyList" :key="item.date" class="hist-item">
          <text class="hist-date">{{ item.date }}</text>
          <text class="hist-title">{{ item.title || '日记' }}</text>
          <text class="hist-content">{{ item.content || '（空）' }}</text>
          <text class="hist-delete" @tap="handleDeleteHistory(item)">删除</text>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  getTodayDiary,
  saveTodayDiary,
  getDiaryHistory,
  removeDiaryByDate,
  getToday,
} from '@/api/notebook'

const PROMPTS = [
  '今天发生了什么，值得被记住…',
  '写给今天的自己一句话…',
  '有什么情绪想轻轻放下…',
  '今天最温暖的瞬间是…',
  '想对明天的自己说…',
]

const today = getToday()

const title = ref('')
const content = ref('')
const loading = ref(false)
const saving = ref(false)
const pageHeight = ref(500)
const inputHeight = ref(320)

const panelOpen = ref(false)
const historyList = ref([])
const historyLoading = ref(false)
const promptText = ref(PROMPTS[0])

const hasContent = computed(() => {
  return !!(title.value.trim() || content.value.trim())
})

const contentLength = computed(() => content.value.length)

function layoutHeights() {
  const sys = uni.getSystemInfoSync()
  const statusBar = sys.statusBarHeight || 0
  let navBar = 44
  const menuButton = wx.getMenuButtonBoundingClientRect()
  if (menuButton) {
    navBar = (menuButton.top - statusBar) * 2 + menuButton.height
  }
  const navTotal = statusBar + navBar
  const rpx = sys.windowWidth / 750
  const bodyPadTop = 32 * rpx
  const rootPadBottom = 48 * rpx
  const safeBottom = (sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
  const bottomGap = 24 + safeBottom

  pageHeight.value = Math.floor(sys.windowHeight - navTotal - bodyPadTop - rootPadBottom)

  nextTick(() => {
    uni
      .createSelectorQuery()
      .select('.diary-top')
      .boundingClientRect()
      .exec((res) => {
        const topH = res && res[0] ? res[0].height : 200
        inputHeight.value = Math.max(220, Math.floor(pageHeight.value - topH - bottomGap))
      })
  })
}

async function loadHistory() {
  historyLoading.value = true
  try {
    historyList.value = await getDiaryHistory()
  } catch (err) {
    console.error('加载历史日记失败', err)
    historyList.value = []
  } finally {
    historyLoading.value = false
  }
}

function openHistory() {
  panelOpen.value = true
  loadHistory()
}

function closeHistory() {
  panelOpen.value = false
}

async function handleDeleteHistory(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: `确定删除 ${item.date} 的日记吗？`,
  })
  if (!res.confirm) return

  try {
    await removeDiaryByDate(item.date)
    await loadHistory()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除历史日记失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

onMounted(() => {
  const day = new Date().getDate()
  promptText.value = PROMPTS[day % PROMPTS.length]
  layoutHeights()
})

onShow(() => {
  layoutHeights()
  loadDiary()
  loadHistory()
})

async function loadDiary() {
  loading.value = true
  try {
    const diary = await getTodayDiary()
    if (diary) {
      title.value = diary.title === '今日日记' ? '' : diary.title || ''
      content.value = diary.content || ''
    } else {
      title.value = ''
      content.value = ''
    }
  } catch (err) {
    console.error('加载日记失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
    layoutHeights()
  }
}

async function handleSave() {
  if (saving.value) return
  if (!hasContent.value) {
    uni.showToast({ title: '写点什么吧', icon: 'none' })
    return
  }

  saving.value = true
  try {
    await saveTodayDiary({
      title: title.value,
      content: content.value,
    })
    await loadHistory()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存日记失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function handleClear() {
  const res = await uni.showModal({
    title: '确认清空',
    content: '确定清空今天的日记吗？',
  })
  if (!res.confirm) return

  saving.value = true
  try {
    title.value = ''
    content.value = ''
    await saveTodayDiary({ title: '', content: '' })
    await loadHistory()
    uni.showToast({ title: '已清空', icon: 'success' })
  } catch (err) {
    console.error('清空日记失败', err)
    uni.showToast({ title: '清空失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.diary-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.diary-top {
  flex-shrink: 0;
}

.date-header {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.date-label {
  font-size: 28rpx;
  color: $color-subtitle;
}

.date-value {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
}

.toolbar {
  display: flex;
  align-items: center;
  height: 80rpx;
  margin-bottom: 8rpx;
  gap: 8rpx;
}

.toolbar-spacer {
  flex: 1;
}

.action-history {
  font-size: 28rpx;
  color: $color-primary-dark;
  padding: 12rpx 8rpx;
}

.action-clear {
  font-size: 28rpx;
  color: $color-subtitle;
  padding: 12rpx 8rpx;
}

.action-save {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-primary-dark;
  padding: 12rpx 8rpx;
}

.action-save.disabled {
  opacity: 0.5;
}

.title-input {
  width: 100%;
  height: 88rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  box-sizing: border-box;
  font-size: 34rpx;
  font-weight: 600;
  color: $color-title;
  padding: 0 8rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.08);
}

.status-tip {
  text-align: center;
  padding: 80rpx 0;
  font-size: 28rpx;
  color: $color-subtitle;
}

.editor-wrap {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  background: $color-card;
  border-radius: 20rpx;
  box-shadow: $shadow-card;
  padding: 28rpx 28rpx 56rpx;
  overflow: hidden;
}

.write-input {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-size: 32rpx;
  line-height: 1.9;
  color: $color-title;
}

.char-count {
  position: absolute;
  right: 24rpx;
  bottom: 16rpx;
  font-size: 22rpx;
  color: $color-subtitle;
}

/* 历史抽屉 */
.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
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
  height: 65vh;
  display: flex;
  flex-direction: column;
  background: $color-card;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -8rpx 32rpx rgba(43, 127, 212, 0.12);
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
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.hist-date {
  display: block;
  font-size: 26rpx;
  color: $color-primary-dark;
  font-weight: 600;
  margin-bottom: 10rpx;
}

.hist-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 10rpx;
}

.hist-content {
  display: block;
  font-size: 28rpx;
  line-height: 1.7;
  color: $color-title;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 12rpx;
}

.hist-delete {
  font-size: 26rpx;
  color: #e74c3c;
}
</style>
