<template>
  <PageRoot>
    <view class="casual-page" :style="{ height: bodyHeight + 'px' }">
      <view class="editor">
        <view class="toolbar">
          <text class="action-history" @tap="openPanel">过往云烟 {{ list.length }}</text>
          <text v-if="editingId" class="action-cancel" @tap="handleCancelEdit">取消</text>
          <view class="toolbar-spacer" />
          <text class="action-save" :class="{ disabled: saving }" @tap="handleSave">
            {{ saveLabel }}
          </text>
        </view>
        <textarea
          v-model="draft"
          class="write-input"
          :style="{ height: inputHeight + 'px' }"
          :placeholder="editingId ? '修改内容...' : '此刻的想法...'"
          :maxlength="500"
          :focus="inputFocus"
          confirm-type="done"
          :show-confirm-bar="true"
          @confirm="handleSave"
        />
      </view>
    </view>

    <view
      class="sheet-mask"
      :class="{ show: panelOpen }"
      @tap="closePanel"
      @touchmove.stop.prevent
    />
    <view class="sheet" :class="{ open: panelOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-header">
        <text class="panel-title">{{ detailItem ? '云烟详情' : '过往云烟' }}</text>
        <text class="panel-close" @tap="onSheetClose">
          {{ detailItem ? '返回' : '关闭' }}
        </text>
      </view>

      <!-- 详情 -->
      <view v-if="detailItem" class="detail">
        <text class="detail-time">{{ formatDateTime(detailItem.createdAt) }}</text>
        <scroll-view scroll-y class="detail-scroll">
          <text class="detail-content">{{ detailItem.content || '（空）' }}</text>
        </scroll-view>
        <view class="detail-actions">
          <view class="bar-btn primary grow" hover-class="bar-btn--active" @tap="handleEdit(detailItem)">
            <text class="bar-btn-text primary-text">写入编辑</text>
          </view>
          <view
            class="bar-btn ghost"
            hover-class="bar-btn--active"
            @tap="handleDelete(detailItem)"
          >
            <text class="bar-btn-text">删除</text>
          </view>
        </view>
      </view>

      <!-- 列表 -->
      <view v-else-if="loading" class="panel-empty">加载中...</view>
      <view v-else-if="list.length === 0" class="panel-empty">还没有过往云烟</view>
      <scroll-view v-else scroll-y class="panel-scroll">
        <view
          v-for="item in list"
          :key="item._id"
          class="note-card"
          :class="{ active: editingId === item._id }"
          hover-class="note-card--active"
          @tap="openDetail(item)"
        >
          <view class="note-top">
            <text class="note-time">{{ formatDateTime(item.createdAt) }}</text>
            <text class="note-arrow">›</text>
          </view>
          <text class="note-summary">{{ summarize(item.content) }}</text>
        </view>
      </scroll-view>
    </view>
  </PageRoot>
</template>

<script setup>
import { getCasuals, addCasual, updateCasual, removeCasual, formatDateTime } from '@/api/notebook'

const draft = ref('')
const editingId = ref('')
const list = ref([])
const loading = ref(false)
const saving = ref(false)
const inputFocus = ref(false)
const panelOpen = ref(false)
const detailItem = ref(null)
const bodyHeight = ref(500)
const inputHeight = ref(400)

const saveLabel = computed(() => {
  if (saving.value) return '保存中…'
  return editingId.value ? '保存' : '记下'
})

onMounted(() => {
  layoutHeights()
  loadList()
})

/** 按窗口高度计算编辑区，预留底部安全距离 */
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
  const toolbar = 44
  const safeBottom = (sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
  const bottomGap = 28 + safeBottom

  bodyHeight.value = Math.floor(sys.windowHeight - navTotal - bodyPadTop - rootPadBottom)
  inputHeight.value = Math.max(200, bodyHeight.value - toolbar - bottomGap)
}

function summarize(content) {
  const text = (content || '').trim().replace(/\s+/g, ' ')
  if (!text) return '（空）'
  return text.length > 48 ? text.slice(0, 48) + '…' : text
}

function openPanel() {
  detailItem.value = null
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
  detailItem.value = null
}

function onSheetClose() {
  if (detailItem.value) {
    detailItem.value = null
    return
  }
  closePanel()
}

function openDetail(item) {
  detailItem.value = item
}

async function loadList() {
  loading.value = true
  try {
    list.value = await getCasuals()
  } catch (err) {
    console.error('加载随心记失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (saving.value) return
  const content = draft.value.trim()
  if (!content) {
    uni.showToast({ title: '写点什么吧', icon: 'none' })
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateCasual(editingId.value, content)
      uni.showToast({ title: '已更新', icon: 'success' })
    } else {
      await addCasual(content)
      uni.showToast({ title: '已记下', icon: 'success' })
    }
    handleCancelEdit()
    await loadList()
  } catch (err) {
    console.error('保存随心记失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

/** 将记录载入编辑区 */
function handleEdit(item) {
  editingId.value = item._id
  draft.value = item.content
  closePanel()
  inputFocus.value = false
  nextTick(() => {
    inputFocus.value = true
  })
}

function handleCancelEdit() {
  editingId.value = ''
  draft.value = ''
  inputFocus.value = false
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这条记录吗？',
  })
  if (!res.confirm) return

  try {
    await removeCasual(item._id)
    if (editingId.value === item._id) handleCancelEdit()
    if (detailItem.value && detailItem.value._id === item._id) {
      detailItem.value = null
    }
    await loadList()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除随心记失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.casual-page {
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.toolbar {
  display: flex;
  align-items: center;
  height: 80rpx;
  flex-shrink: 0;
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

.action-cancel {
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

.write-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 34rpx;
  line-height: 1.8;
  color: $color-title;
  background: $color-card;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: $shadow-card;
}

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

.note-card {
  margin: 0 24rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: $color-card-soft;
  border: 1rpx solid rgba(74, 159, 232, 0.1);
  box-sizing: border-box;
}

.note-card--active {
  opacity: 0.9;
}

.note-card.active {
  border-color: rgba(74, 159, 232, 0.35);
  background: rgba(74, 159, 232, 0.08);
}

.note-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.note-time {
  font-size: 24rpx;
  color: $color-primary-dark;
  font-weight: 600;
}

.note-arrow {
  font-size: 32rpx;
  color: $color-subtitle;
  line-height: 1;
}

.note-summary {
  display: block;
  font-size: 28rpx;
  line-height: 1.55;
  color: $color-title;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8rpx 28rpx 20rpx;
  box-sizing: border-box;
}

.detail-time {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: $color-primary-dark;
  margin-bottom: 16rpx;
}

.detail-scroll {
  flex: 1;
  height: 0;
  background: $color-card-soft;
  border-radius: 18rpx;
  padding: 24rpx 28rpx;
  box-sizing: border-box;
  margin-bottom: 20rpx;
}

.detail-content {
  display: block;
  font-size: 30rpx;
  line-height: 1.75;
  color: $color-title;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-actions {
  display: flex;
  gap: 16rpx;
  flex-shrink: 0;
}

.bar-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(74, 159, 232, 0.16);
  box-sizing: border-box;
}

.bar-btn.ghost {
  flex: 0.7;
}

.bar-btn.primary {
  flex: 1.2;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  border-color: transparent;
  box-shadow: 0 8rpx 20rpx rgba(43, 127, 212, 0.22);
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
  font-weight: 600;
  color: $color-title;
}

.bar-btn-text.primary-text {
  color: #fff;
}
</style>
