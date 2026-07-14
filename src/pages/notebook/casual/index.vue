<template>
  <view class="page">
    <view class="page-content">
      <CustomNav />
    <!-- 顶部快捷输入区 -->
    <view class="write-card">
      <textarea
        v-model="draft"
        class="write-input"
        :placeholder="editingId ? '修改内容...' : '此刻的想法...'"
        :maxlength="500"
        :focus="inputFocus"
      />
      <view class="write-actions">
        <text v-if="editingId" class="btn-cancel" @tap="handleCancelEdit">取消</text>
        <button class="btn-save" :loading="saving" @tap="handleSave">
          {{ editingId ? '保存' : '记下' }}
        </button>
      </view>
    </view>

    <!-- 记录列表 -->
    <view v-if="loading" class="status-tip">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">
      <text class="empty-text">还没有记录，在上方写下第一条吧</text>
    </view>
    <view v-else class="note-list">
      <view
        v-for="item in list"
        :key="item._id"
        class="note-item"
        :class="{ active: editingId === item._id }"
        @tap="handleEdit(item)"
      >
        <text class="note-time">{{ formatDateTime(item.createdAt) }}</text>
        <text class="note-content">{{ item.content }}</text>
        <text class="note-delete" @tap.stop="handleDelete(item)">删除</text>
      </view>
    </view>
    </view>
  </view>
</template>

<script setup>
import {
  getCasuals,
  addCasual,
  updateCasual,
  removeCasual,
  formatDateTime,
} from '@/api/notebook'

const draft = ref('')
const editingId = ref('')
const list = ref([])
const loading = ref(false)
const saving = ref(false)
const inputFocus = ref(false)

onShow(() => {
  loadList()
})

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

/** 点击记录，载入到顶部编辑区 */
function handleEdit(item) {
  editingId.value = item._id
  draft.value = item.content
  inputFocus.value = true
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
    await loadList()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除随心记失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $color-bg;
}

.page-content {
  padding: 32rpx 32rpx 48rpx;
}

.write-card {
  background: $color-card;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 40rpx;
  box-shadow: $shadow-card;
}

.write-input {
  width: 100%;
  height: 360rpx;
  min-height: 360rpx;
  font-size: 34rpx;
  line-height: 1.8;
  color: $color-title;
  box-sizing: border-box;
}

.write-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20rpx;
  margin-top: 16rpx;
}

.btn-cancel {
  font-size: 28rpx;
  color: $color-subtitle;
  padding: 12rpx 16rpx;
}

.btn-save {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 40rpx;
  background: $color-primary;
  color: #fff;
  border-radius: 32rpx;
  font-size: 28rpx;
  border: none;
}

.status-tip,
.empty {
  text-align: center;
  padding: 60rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $color-subtitle;
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.note-item {
  position: relative;
  padding: 28rpx 32rpx;
  background: $color-card;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  box-shadow: $shadow-card;
}

.note-item.active {
  border-color: $color-primary;
}

.note-time {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  margin-bottom: 12rpx;
}

.note-content {
  display: block;
  font-size: 32rpx;
  line-height: 1.7;
  color: $color-title;
  padding-right: 60rpx;
  word-break: break-all;
}

.note-delete {
  position: absolute;
  top: 28rpx;
  right: 28rpx;
  font-size: 24rpx;
  color: #e74c3c;
}
</style>
