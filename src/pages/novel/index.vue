<template>
  <PageRoot>
    <view class="header">
      <text class="subtitle">东野圭吾作品集</text>
    </view>

    <PageLoading v-if="loading" text="加载书架中" />
    <view v-else-if="!books.length" class="state">
      <text class="state-text">暂无书籍，请上传 book/dongye/*.json</text>
    </view>
    <view v-else class="book-grid">
      <view
        v-for="item in books"
        :key="item.id"
        class="book-cell"
        hover-class="book-cell--active"
        @tap="openBook(item)"
      >
        <view class="book-spine-wrap">
          <view class="book-cover" :class="coverClass(item)" :style="coverStyle(item)">
            <view class="cover-spine" />
            <view class="cover-texture" />
            <text class="cover-glyph">{{ coverGlyph(item) }}</text>
            <text v-if="progressBadge(item)" class="cover-badge">{{ progressBadge(item) }}</text>
          </view>
        </view>
        <text class="book-title">{{ item.title }}</text>
        <text class="book-meta">{{ item.chapterCount || 0 }} 章</text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { fetchNovelCatalog, getCachedCatalog, getNovelProgress } from '@/api/novel'

const COVER_PALETTES = [
  ['#1a2744', '#3d5a80'],
  ['#3d1f1f', '#8b3a3a'],
  ['#1f3d2f', '#3d7a5c'],
  ['#3d2a1a', '#a0673a'],
  ['#2a1a3d', '#6b4a8a'],
  ['#1a333d', '#3a7a8a'],
  ['#3d1a2a', '#8a3a5a'],
  ['#2a2a1a', '#7a6a3a'],
  ['#1a2a3d', '#4a6a9a'],
  ['#3d2a2a', '#9a5a4a'],
  ['#1f2f1a', '#4a6a3a'],
  ['#2a1f3d', '#5a4a8a'],
]

const COVER_PATTERNS = ['pat-stripe', 'pat-dots', 'pat-slash', 'pat-night', 'pat-grid', 'pat-wave']

const loading = ref(true)
const books = ref([])
const progressTick = ref(0)

onMounted(() => {
  const cached = getCachedCatalog()
  if (cached) {
    books.value = cached.books || []
    loading.value = false
    return
  }
  loadCatalog()
})

// 从阅读页返回时刷新进度角标，不重新拉书架
onShow(() => {
  progressTick.value += 1
})

async function loadCatalog() {
  loading.value = true
  try {
    const data = await fetchNovelCatalog()
    books.value = data.books || []
  } catch (err) {
    console.error('加载书架失败', err)
    books.value = []
    const msg = (err && err.message) || ''
    const tip =
      msg.indexOf('not exists') >= 0
        ? '请上传 catalog.json 到 book/dongye'
        : '书架加载失败'
    uni.showToast({ title: tip, icon: 'none', duration: 2500 })
  } finally {
    loading.value = false
  }
}

function hashId(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function coverStyle(item) {
  const h = hashId(item && item.id)
  const pal = COVER_PALETTES[h % COVER_PALETTES.length]
  return {
    background: 'linear-gradient(155deg, ' + pal[0] + ' 0%, ' + pal[1] + ' 100%)',
  }
}

function coverClass(item) {
  const h = hashId(item && item.id)
  return COVER_PATTERNS[h % COVER_PATTERNS.length]
}

function coverGlyph(item) {
  const title = (item && item.title) || '书'
  return title.slice(0, 2)
}

function progressBadge(item) {
  // 读取 progressTick，从阅读页返回时触发角标刷新
  const _ = progressTick.value
  if (!item || !item.id) return ''
  const p = getNovelProgress(item.id)
  const total = Number(item.chapterCount) || 0
  if (!total || p <= 1) return ''
  return p + '/' + total
}

function openBook(item) {
  if (!item || !item.id) return
  const chapter = getNovelProgress(item.id)
  uni.navigateTo({
    url: '/pages/novel/read?bookId=' + encodeURIComponent(item.id) + '&chapter=' + chapter,
  })
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 28rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: $color-subtitle;
  letter-spacing: 2rpx;
}

.state {
  padding: 80rpx 24rpx;
  text-align: center;
}

.state-text {
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.6;
}

.book-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 28rpx 20rpx;
  padding-bottom: 48rpx;
}

.book-cell {
  width: calc((100% - 40rpx) / 3);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.book-cell--active {
  opacity: 0.9;
  transform: scale(0.97);
}

.book-spine-wrap {
  width: 100%;
  padding: 0 4rpx 12rpx;
  box-sizing: border-box;
}

.book-cover {
  position: relative;
  width: 100%;
  padding-bottom: 138%;
  border-radius: 6rpx 12rpx 12rpx 6rpx;
  overflow: hidden;
  box-shadow:
    4rpx 8rpx 20rpx rgba(20, 40, 70, 0.22),
    inset -6rpx 0 12rpx rgba(0, 0, 0, 0.18);
}

.cover-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 14rpx;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.35) 0%,
    rgba(255, 255, 255, 0.12) 45%,
    rgba(0, 0, 0, 0.2) 100%
  );
  z-index: 2;
}

.cover-texture {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  opacity: 0.28;
  z-index: 1;
  pointer-events: none;
}

.pat-stripe .cover-texture {
  background: repeating-linear-gradient(
    -18deg,
    transparent 0,
    transparent 10rpx,
    rgba(255, 255, 255, 0.18) 10rpx,
    rgba(255, 255, 255, 0.18) 14rpx
  );
}

.pat-dots .cover-texture {
  background-image: radial-gradient(rgba(255, 255, 255, 0.35) 1.5rpx, transparent 2rpx);
  background-size: 16rpx 16rpx;
}

.pat-slash .cover-texture {
  background: repeating-linear-gradient(
    45deg,
    transparent 0,
    transparent 12rpx,
    rgba(255, 255, 255, 0.14) 12rpx,
    rgba(255, 255, 255, 0.14) 16rpx
  );
}

.pat-night .cover-texture {
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.7) 1rpx, transparent 2rpx),
    radial-gradient(rgba(255, 255, 255, 0.4) 1rpx, transparent 2rpx);
  background-size: 28rpx 28rpx, 18rpx 22rpx;
  background-position: 4rpx 6rpx, 14rpx 16rpx;
}

.pat-grid .cover-texture {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.12) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1rpx, transparent 1rpx);
  background-size: 18rpx 18rpx;
}

.pat-wave .cover-texture {
  background: repeating-linear-gradient(
    0deg,
    transparent 0,
    transparent 8rpx,
    rgba(255, 255, 255, 0.12) 8rpx,
    rgba(255, 255, 255, 0.12) 10rpx
  );
}

.cover-glyph {
  position: absolute;
  left: 18rpx;
  right: 12rpx;
  top: 50%;
  transform: translateY(-54%);
  z-index: 3;
  text-align: center;
  font-size: 44rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 4rpx;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.35);
  line-height: 1.2;
}

.cover-badge {
  position: absolute;
  right: 8rpx;
  bottom: 10rpx;
  z-index: 4;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  line-height: 1.2;
}

.book-title {
  display: block;
  width: 100%;
  font-size: 24rpx;
  font-weight: 600;
  color: $color-title;
  text-align: center;
  line-height: 1.35;
  max-height: 66rpx;
  overflow: hidden;
  margin-bottom: 4rpx;
}

.book-meta {
  display: block;
  font-size: 20rpx;
  color: $color-subtitle;
  text-align: center;
}
</style>
