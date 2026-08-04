<template>
  <view v-if="show" class="mood-picker">
    <view class="mask" @tap="emit('close')" @touchmove.stop.prevent />
    <view class="panel" @touchmove.stop>
      <text class="title">心情</text>
      <text class="date">{{ today }}</text>

      <view class="mood-grid">
        <view
          v-for="item in MOOD_OPTIONS"
          :key="item.key"
          class="mood-item"
          :class="{ active: selectedKey === item.key }"
          :style="moodItemStyle(item.key)"
          @tap="handleSelectMood(item)"
        >
          <text class="mood-emoji">{{ item.emoji }}</text>
          <text class="mood-label">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { MOOD_OPTIONS, getMoodByDate, upsertMood, getToday } from '@/api/notebook'
import { applyMoodTheme, MOOD_THEMES } from '@/utils/moodTheme'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'change'])

const today = getToday()
const selectedKey = ref('')
const saving = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) loadTodayMood()
  }
)

/** 静默加载今日选中态，不展示加载中 */
async function loadTodayMood() {
  try {
    const todayData = await getMoodByDate(today)
    selectedKey.value = todayData && todayData.moodKey ? todayData.moodKey : ''
  } catch (err) {
    console.error('加载心情失败', err)
  }
}

function moodItemStyle(key) {
  const theme = MOOD_THEMES[key]
  if (!theme) return {}
  return { '--mood-primary': theme['--color-primary'] }
}

async function handleSelectMood(item) {
  if (saving.value) return

  if (selectedKey.value === item.key) {
    emit('close')
    return
  }

  selectedKey.value = item.key
  applyMoodTheme(item.key)
  saving.value = true
  try {
    await upsertMood({
      date: today,
      moodKey: item.key,
      moodLabel: item.label,
      note: '',
    })
    emit('change', item)
    emit('close')
  } catch (err) {
    console.error('保存心情失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.mood-picker {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
}

.mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: $color-card;
  border-radius: 28rpx;
  padding: 36rpx 32rpx 32rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
}

.title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 8rpx;
}

.date {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 28rpx;
}

.mood-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.mood-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 22rpx 10rpx;
  background: rgba(0, 0, 0, 0.03);
  border: 2rpx solid transparent;
  border-radius: 20rpx;
}

.mood-item.active {
  border-color: var(--mood-primary, $color-primary);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.06);
}

.mood-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.mood-label {
  font-size: 24rpx;
  color: $color-title;
}
</style>
