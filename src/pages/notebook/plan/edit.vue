<template>
  <view class="page">
    <CustomNav />
    <view class="form-card">
      <view class="form-item">
        <text class="label">标题</text>
        <input v-model="title" class="input" placeholder="计划做什么？" />
      </view>

      <view class="form-item">
        <text class="label">开始时间</text>
        <picker mode="time" :value="startTime" @change="handleStartTimeChange">
          <view class="picker-value">{{ startTime || '选择开始时间（可选）' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">结束时间</text>
        <picker mode="time" :value="endTime" @change="handleEndTimeChange">
          <view class="picker-value">{{ endTime || '选择结束时间（可选）' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">详细内容</text>
        <textarea
          v-model="content"
          class="textarea"
          placeholder="补充说明（可选）"
          :maxlength="500"
        />
      </view>
    </view>

    <button class="btn-save" :loading="saving" @tap="handleSave">保存</button>
    <button v-if="isEdit" class="btn-delete" @tap="handleDelete">删除计划</button>
  </view>
</template>

<script setup>
import { getPlan, addPlan, updatePlan, removePlan } from '@/api/notebook'

const planId = ref('')
const isEdit = ref(false)
const title = ref('')
const content = ref('')
const startTime = ref('')
const endTime = ref('')
const saving = ref(false)

onLoad(async (options) => {
  if (options.id) {
    planId.value = options.id
    isEdit.value = true
    await loadPlan()
  }
})

async function loadPlan() {
  try {
    const data = await getPlan(planId.value)
    title.value = data.title || ''
    content.value = data.content || ''
    startTime.value = data.startTime || ''
    endTime.value = data.endTime || ''
  } catch (err) {
    console.error('加载计划失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function handleStartTimeChange(e) {
  startTime.value = e.detail.value
}

function handleEndTimeChange(e) {
  endTime.value = e.detail.value
}

async function handleSave() {
  if (!title.value.trim()) {
    uni.showToast({ title: '请填写计划标题', icon: 'none' })
    return
  }

  saving.value = true
  const payload = {
    title: title.value.trim(),
    content: content.value.trim(),
    startTime: startTime.value,
    endTime: endTime.value,
  }

  try {
    if (isEdit.value) {
      await updatePlan(planId.value, payload)
    } else {
      await addPlan(payload)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 500)
  } catch (err) {
    console.error('保存计划失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这条计划吗？',
  })
  if (!res.confirm) return

  try {
    await removePlan(planId.value)
    uni.showToast({ title: '已删除', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 500)
  } catch (err) {
    console.error('删除计划失败', err)
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
  min-height: 200rpx;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.6;
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
