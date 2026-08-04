<template>
  <view v-if="show" class="mood-picker">
    <view class="mask" @tap="emit('close')" @touchmove.stop.prevent />
    <view class="panel" @touchmove.stop>
      <text class="title">心情</text>
      <text class="date">{{ today }}</text>

      <view class="mood-grid">
        <view
          v-for="item in moodList"
          :key="item.key"
          class="mood-item"
          :class="{ active: selectedKey === item.key }"
          :style="moodItemStyle(item)"
          @tap="handleSelectMood(item)"
        >
          <view class="mood-img-wrap" :style="placeholderStyle(item)">
            <image
              v-if="item.imageUrl"
              class="mood-img"
              :class="{ 'is-ready': readyKeys[item.key] }"
              :src="item.imageUrl"
              mode="aspectFit"
              @load="onImgReady(item.key)"
              @error="onImgReady(item.key)"
            />
          </view>
          <text class="mood-label">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { getMoodByDate, upsertMood, getToday } from '@/api/notebook'
import {
  listMoodEmojis,
  getMoodCatalogWithUrls,
  getCachedMoodImageUrl,
} from '@/api/moodCatalog'
import { applyMoodThemeFromItem, registerMoodThemes } from '@/utils/moodTheme'

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
const moodList = ref([])
const readyKeys = ref({})

watch(
  () => props.show,
  (open) => {
    if (open) {
      loadCatalog()
      loadTodayMood()
    }
  }
)

function buildFromCache(list) {
  const next = []
  let hit = 0
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const imageUrl = getCachedMoodImageUrl(item.fileID)
    if (imageUrl) hit += 1
    next.push(Object.assign({}, item, { imageUrl }))
  }
  return { next, hit }
}

function listFullyReady(list) {
  if (!list || !list.length) return false
  for (let i = 0; i < list.length; i++) {
    if (!list[i].imageUrl) return false
  }
  return true
}

function markLocalReady(list) {
  // 本地路径通常同步可用，直接标 ready，避免淡入闪一下
  const map = Object.assign({}, readyKeys.value)
  for (let i = 0; i < list.length; i++) {
    const url = list[i].imageUrl || ''
    if (url && url.indexOf('http') !== 0) {
      map[list[i].key] = true
    }
  }
  readyKeys.value = map
}

async function loadCatalog() {
  try {
    // 二次打开：已有完整图则立刻展示，后台静默刷新
    if (listFullyReady(moodList.value)) {
      markLocalReady(moodList.value)
      getMoodCatalogWithUrls().then((filled) => {
        moodList.value = filled
        markLocalReady(filled)
      })
      return
    }

    const list = await listMoodEmojis()
    registerMoodThemes(list)

    const cached = buildFromCache(list)
    moodList.value = cached.next
    markLocalReady(cached.next)

    if (cached.hit >= list.length && list.length) return

    const filled = await getMoodCatalogWithUrls()
    moodList.value = filled
    markLocalReady(filled)
  } catch (err) {
    console.error('加载心情目录失败', err)
  }
}

function onImgReady(key) {
  if (readyKeys.value[key]) return
  readyKeys.value = Object.assign({}, readyKeys.value, { [key]: true })
}

async function loadTodayMood() {
  try {
    const todayData = await getMoodByDate(today)
    selectedKey.value = todayData && todayData.moodKey ? todayData.moodKey : ''
  } catch (err) {
    console.error('加载心情失败', err)
  }
}

function moodItemStyle(item) {
  const primary = item.theme && item.theme.primary
  if (!primary) return {}
  return { '--mood-primary': primary }
}

function placeholderStyle(item) {
  const primary = (item.theme && item.theme.primary) || '#8B5E3C'
  return { backgroundColor: primary + '22' }
}

async function handleSelectMood(item) {
  if (saving.value) return

  if (selectedKey.value === item.key) {
    emit('close')
    return
  }

  selectedKey.value = item.key
  applyMoodThemeFromItem(item)
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
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.mood-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 6rpx;
  background: rgba(0, 0, 0, 0.03);
  border: 2rpx solid transparent;
  border-radius: 20rpx;
}

.mood-item.active {
  border-color: var(--mood-primary, $color-primary);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.06);
}

.mood-img-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  margin-bottom: 8rpx;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mood-img {
  width: 64rpx;
  height: 64rpx;
  opacity: 0;
  transition: opacity 0.28s ease;
}

.mood-img.is-ready {
  opacity: 1;
}

.mood-label {
  font-size: 20rpx;
  color: $color-title;
  text-align: center;
}
</style>
