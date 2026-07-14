<template>
  <view class="page">
    <CustomNav />
    <view class="section">
      <text class="section-title">今日心情</text>
      <text class="section-date">{{ today }}</text>

      <view v-if="loading" class="status-tip">加载中...</view>
      <view v-else class="mood-grid">
        <view
          v-for="item in MOOD_OPTIONS"
          :key="item.key"
          class="mood-item"
          :class="{ active: selectedKey === item.key }"
          @tap="handleSelectMood(item)"
        >
          <text class="mood-emoji">{{ item.emoji }}</text>
          <text class="mood-label">{{ item.label }}</text>
        </view>
      </view>

      <view class="note-box">
        <textarea
          v-model="note"
          class="note-input"
          placeholder="写点什么吧（可选）"
          :maxlength="200"
        />
      </view>

      <button class="btn-save" :loading="saving" @tap="handleSave">保存今日心情</button>
    </view>

    <view class="section">
      <text class="section-title">历史记录</text>
      <view v-if="historyList.length === 0" class="empty">
        <text class="empty-text">暂无心情记录</text>
      </view>
      <view v-else class="history-list">
        <view v-for="item in historyList" :key="item._id" class="history-item">
          <view class="history-left">
            <text class="history-emoji">{{ getMoodEmoji(item.moodKey) }}</text>
            <view class="history-info">
              <text class="history-mood">{{ item.moodLabel }}</text>
              <text v-if="item.note" class="history-note">{{ item.note }}</text>
            </view>
          </view>
          <text class="history-date">{{ item.date }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import {
  MOOD_OPTIONS,
  getMoodByDate,
  getMoodHistory,
  upsertMood,
  getToday,
} from '@/api/notebook'

const today = getToday()
const selectedKey = ref('')
const note = ref('')
const todayMood = ref(null)
const historyList = ref([])
const saving = ref(false)
const loading = ref(false)

onShow(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [todayData, history] = await Promise.all([
      getMoodByDate(today),
      getMoodHistory(),
    ])
    todayMood.value = todayData
    if (todayData) {
      selectedKey.value = todayData.moodKey
      note.value = todayData.note || ''
    }
    historyList.value = history
  } catch (err) {
    console.error('加载心情失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleSelectMood(item) {
  selectedKey.value = item.key
}

async function handleSave() {
  if (!selectedKey.value) {
    uni.showToast({ title: '请选择心情', icon: 'none' })
    return
  }

  const mood = MOOD_OPTIONS.find((m) => m.key === selectedKey.value)
  if (!mood) return

  saving.value = true
  try {
    await upsertMood({
      date: today,
      moodKey: mood.key,
      moodLabel: mood.label,
      note: note.value.trim(),
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
    await loadData()
  } catch (err) {
    console.error('保存心情失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

function getMoodEmoji(key) {
  const mood = MOOD_OPTIONS.find((m) => m.key === key)
  return mood ? mood.emoji : ''
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 60rpx;
  background-color: $color-bg;
}

.section {
  margin-bottom: 48rpx;
}

.section-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 8rpx;
}

.section-date {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 28rpx;
}

.status-tip {
  text-align: center;
  padding: 40rpx 0;
  color: $color-subtitle;
}

.mood-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 28rpx;
}

.mood-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 16rpx;
  background: $color-card-glass;
  border: 2rpx solid transparent;
  border-radius: 20rpx;
  box-shadow: $shadow-card;
}

.mood-item.active {
  border-color: $color-primary;
  background: rgba(74, 159, 232, 0.1);
}

.mood-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.mood-label {
  font-size: 26rpx;
  color: $color-title;
}

.note-box {
  margin-bottom: 28rpx;
}

.note-input {
  width: 100%;
  min-height: 120rpx;
  padding: 20rpx 24rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $color-title;
  box-sizing: border-box;
}

.btn-save {
  background: $color-primary;
  color: #fff;
  border-radius: 16rpx;
  font-size: 32rpx;
}

.empty {
  text-align: center;
  padding: 40rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $color-subtitle;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 20rpx;
  box-shadow: $shadow-card;
}

.history-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.history-emoji {
  font-size: 40rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-mood {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: $color-title;
  margin-bottom: 4rpx;
}

.history-note {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-date {
  font-size: 24rpx;
  color: $color-subtitle;
  margin-left: 16rpx;
  flex-shrink: 0;
}
</style>
