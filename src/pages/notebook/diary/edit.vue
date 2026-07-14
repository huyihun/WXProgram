<template>
  <view class="page">
    <CustomNav />
    <view class="form-card">
      <view class="form-item">
        <text class="label">标题</text>
        <input v-model="title" class="input" placeholder="给日记起个标题" />
      </view>

      <view class="form-item">
        <text class="label">日期</text>
        <picker mode="date" :value="date" @change="handleDateChange">
          <view class="picker-value">{{ date }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">正文</text>
        <textarea
          v-model="content"
          class="textarea"
          placeholder="写下今天的故事..."
          :maxlength="2000"
        />
      </view>
    </view>

    <button class="btn-save" :loading="saving" @tap="handleSave">保存</button>
    <button v-if="isEdit" class="btn-delete" @tap="handleDelete">删除日记</button>
  </view>
</template>

<script setup>
import { getDiary, addDiary, updateDiary, removeDiary, getToday } from '@/api/notebook'

const diaryId = ref('')
const isEdit = ref(false)
const title = ref('')
const content = ref('')
const date = ref(getToday())
const saving = ref(false)

onLoad(async (options) => {
  if (options.id) {
    diaryId.value = options.id
    isEdit.value = true
    await loadDiary()
  }
})

async function loadDiary() {
  try {
    const data = await getDiary(diaryId.value)
    title.value = data.title || ''
    content.value = data.content || ''
    date.value = data.date || getToday()
  } catch (err) {
    console.error('加载日记失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function handleDateChange(e) {
  date.value = e.detail.value
}

async function handleSave() {
  if (!title.value.trim()) {
    uni.showToast({ title: '请填写日记标题', icon: 'none' })
    return
  }

  saving.value = true
  const payload = {
    title: title.value.trim(),
    content: content.value.trim(),
    date: date.value,
  }

  try {
    if (isEdit.value) {
      await updateDiary(diaryId.value, payload)
    } else {
      await addDiary(payload)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 500)
  } catch (err) {
    console.error('保存日记失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这篇日记吗？',
  })
  if (!res.confirm) return

  try {
    await removeDiary(diaryId.value)
    uni.showToast({ title: '已删除', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 500)
  } catch (err) {
    console.error('删除日记失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 60rpx;
  background-color: $color-bg;
}

.form-card {
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 24rpx;
  padding: 8rpx 32rpx;
  margin-bottom: 40rpx;
  box-shadow: $shadow-card;
}

.form-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.form-item:last-child {
  border-bottom: none;
}

.label {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 12rpx;
}

.input {
  font-size: 30rpx;
  color: $color-title;
}

.picker-value {
  font-size: 30rpx;
  color: $color-title;
}

.textarea {
  width: 100%;
  min-height: 360rpx;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.8;
}

.btn-save {
  background: $color-primary;
  color: #fff;
  border-radius: 16rpx;
  font-size: 32rpx;
  margin-bottom: 20rpx;
}

.btn-delete {
  background: transparent;
  color: #e74c3c;
  border: 1rpx solid #e74c3c;
  border-radius: 16rpx;
  font-size: 30rpx;
}
</style>
