<template>
  <PageRoot dark-nav :extra-style="{ backgroundColor: '#10141f' }">
    <PageLoading v-if="loading" text="加载书架中" />
    <template v-else>
      <!-- 案头在读：宣纸书签签条 -->
      <view v-if="readingList.length" class="sec">
        <view class="sec-head">
          <view class="sec-accent" />
          <text class="sec-title">案头在读</text>
        </view>
        <scroll-view scroll-x class="bm-scroll" :show-scrollbar="false">
          <view class="bm-row">
            <view
              v-for="ct in readingList"
              :key="ct.item.id"
              class="bm-card"
              hover-class="bm-card--active"
              @tap="openBook(ct.item)"
            >
              <view class="bm-hole" />
              <view class="bm-tassel" />
              <view class="bm-main">
                <text class="bm-title">《{{ ct.item.title }}》</text>
                <text class="bm-meta">第{{ ct.p }}章 · 第{{ ct.page }}页</text>
              </view>
              <view class="bm-go">
                <text class="bm-go-text">继续</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view v-if="!books.length" class="state">
        <text class="state-text">暂无书籍，请上传 book/{{ shelf }}/*.json</text>
      </view>
      <view v-else class="sec">
        <view class="sec-head">
          <view class="sec-accent" />
          <text class="sec-title">藏书</text>
        </view>
        <!-- 书脊陈列架：每层一排搁板 -->
        <view v-for="(row, ri) in shelfRows" :key="'row-' + ri" class="shelf-row">
          <view
            v-for="item in row"
            :key="item.id"
            class="spine"
            hover-class="spine--pull"
            :style="spineStyle(item)"
            @tap="openBook(item)"
          >
            <view class="spine-frame" />
            <text class="spine-title">{{ spineTitle(item) }}</text>
            <view v-if="isReading(item)" class="spine-bookmark" />
            <view v-if="isFinished(item)" class="spine-seal">
              <text class="spine-seal-text">毕</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </PageRoot>
</template>

<script setup>
import {
  fetchNovelCatalog,
  getCachedCatalog,
  getNovelProgress,
  getNovelProgressPage,
  syncNovelProgressFromCloud,
  normalizeShelf,
} from '@/api/novel'

/** 传统色系书脊：黛蓝/宣纸/竹青/绛紫/赭石/米绢/墨青/绛红 */
const SPINE_COLORS = [
  { from: '#39435c', to: '#232b3f', text: '#e8e2d2' },
  { from: '#efe7d2', to: '#d9cdaf', text: '#3a3226' },
  { from: '#2e4a44', to: '#1d332f', text: '#dfe8dd' },
  { from: '#5c4258', to: '#3d2c3c', text: '#eadfe8' },
  { from: '#5c4632', to: '#3d2f22', text: '#ecdfc8' },
  { from: '#e4d8c8', to: '#c8b494', text: '#42392c' },
  { from: '#3d4a5c', to: '#272f3d', text: '#e2e6ea' },
  { from: '#5a3a3a', to: '#3c2626', text: '#ecd8d4' },
]

const SPINE_W = [72, 84, 96]
const SPINE_H = [256, 284, 312]
const ROW_SIZE = 6

const shelf = ref('dongye')
const loading = ref(true)
const books = ref([])
const progressTick = ref(0)

onLoad((query) => {
  shelf.value = normalizeShelf(query && query.shelf)
})

onMounted(() => {
  const cached = getCachedCatalog(shelf.value)
  if (cached) {
    books.value = cached.books || []
    loading.value = false
  } else {
    loadCatalog()
  }
  // 云端进度合并（异步），回来后刷新书签与书脊标记
  syncNovelProgressFromCloud().then(function () {
    progressTick.value += 1
  })
})

// 从阅读页返回时刷新进度标记，不重新拉书架
onShow(() => {
  progressTick.value += 1
})

async function loadCatalog() {
  loading.value = true
  try {
    const data = await fetchNovelCatalog(shelf.value)
    books.value = data.books || []
  } catch (err) {
    console.error('加载书架失败', err)
    books.value = []
    const msg = (err && err.message) || ''
    const tip =
      msg.indexOf('not exists') >= 0
        ? '请上传 catalog.json 到 book/' + shelf.value
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

function readProgress(item) {
  // 读取 progressTick，从阅读页返回时触发标记刷新
  const _ = progressTick.value
  if (!item || !item.id) return { p: 0, total: 0 }
  const p = getNovelProgress(item.id, shelf.value)
  const total = Number(item.chapterCount) || 0
  return { p: p, total: total }
}

function isReading(item) {
  const r = readProgress(item)
  return !!(r.total && r.p > 1 && r.p < r.total)
}

function isFinished(item) {
  const r = readProgress(item)
  return !!(r.total && r.p >= r.total)
}

/** 书脊：宽窄高低错落 + 传统色 */
function spineStyle(item) {
  const h = hashId(item && item.id)
  const c = SPINE_COLORS[h % SPINE_COLORS.length]
  return {
    width: SPINE_W[h % 3] + 'rpx',
    height: SPINE_H[Math.floor(h / 3) % 3] + 'rpx',
    background: 'linear-gradient(180deg, ' + c.from + ' 0%, ' + c.to + ' 100%)',
    color: c.text,
  }
}

/** 竖排书名（书脊逐字换行，长名自然截断在脊内） */
function spineTitle(item) {
  const title = (item && item.title) || '书'
  return title.slice(0, 6)
}

/** 藏书分层：每层 ROW_SIZE 本立在一块搁板上 */
const shelfRows = computed(() => {
  const list = books.value || []
  const rows = []
  for (let i = 0; i < list.length; i += ROW_SIZE) {
    rows.push(list.slice(i, i + ROW_SIZE))
  }
  return rows
})

/** 案头在读：全部在读书 */
const readingList = computed(() => {
  const _ = progressTick.value
  const list = books.value || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || !item.id) continue
    const p = getNovelProgress(item.id, shelf.value)
    const total = Number(item.chapterCount) || 0
    if (!total || p <= 1) continue
    out.push({
      item: item,
      p: Math.min(p, total),
      total: total,
      page: getNovelProgressPage(item.id, shelf.value),
    })
  }
  return out
})

function openBook(item) {
  if (!item || !item.id) return
  const chapter = getNovelProgress(item.id, shelf.value)
  uni.navigateTo({
    url:
      '/pages/novel/read?bookId=' +
      encodeURIComponent(item.id) +
      '&chapter=' +
      chapter +
      '&shelf=' +
      encodeURIComponent(shelf.value),
  })
}
</script>

<style lang="scss" scoped>
/* ---------- 分区标题 ---------- */
.sec {
  margin-bottom: 40rpx;
}

.sec-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.sec-accent {
  width: 8rpx;
  height: 26rpx;
  border-radius: 4rpx;
  background: linear-gradient(180deg, #d4674f 0%, #a03e30 100%);
}

.sec-title {
  font-family: 'Songti SC', 'STSong', 'KaiTi', serif;
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
  color: rgba(255, 248, 235, 0.92);
}

/* ---------- 案头在读：宣纸书签 ---------- */
.bm-scroll {
  width: 100%;
  white-space: nowrap;
}

.bm-row {
  display: inline-flex;
  gap: 20rpx;
  padding: 6rpx 4rpx 10rpx;
}

.bm-card {
  position: relative;
  width: 372rpx;
  display: inline-flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 24rpx 24rpx 68rpx;
  border-radius: 12rpx;
  background: linear-gradient(160deg, #f4eddc 0%, #e9e0c8 100%);
  box-shadow:
    0 8rpx 22rpx rgba(4, 10, 22, 0.45),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.6);
  box-sizing: border-box;
  transform: translateY(0);
  transition: transform 0.16s ease;
}

.bm-card--active {
  transform: translateY(-4rpx);
}

/* 穿孔 + 朱砂垂绳 */
.bm-hole {
  position: absolute;
  left: 26rpx;
  top: 50%;
  margin-top: -8rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #10141f;
  box-shadow: inset 0 0 4rpx rgba(0, 0, 0, 0.7);
}

.bm-tassel {
  position: absolute;
  left: 31rpx;
  top: calc(50% + 12rpx);
  width: 6rpx;
  height: 30rpx;
  border-radius: 3rpx;
  background: linear-gradient(180deg, #d4674f 0%, #a03e30 100%);
}

.bm-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
  flex: 1;
}

.bm-title {
  font-family: 'Songti SC', 'STSong', 'KaiTi', serif;
  font-size: 27rpx;
  font-weight: 700;
  color: #2c2620;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bm-meta {
  font-family: 'Songti SC', 'STSong', 'KaiTi', serif;
  font-size: 21rpx;
  color: #6b6353;
  letter-spacing: 1rpx;
}

.bm-go {
  flex-shrink: 0;
  padding: 10rpx 22rpx;
  border-radius: 10rpx;
  background: linear-gradient(160deg, #d4674f 0%, #b04a38 100%);
  box-shadow: 0 4rpx 10rpx rgba(176, 74, 56, 0.35);
}

.bm-go-text {
  font-size: 23rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #fff;
}

/* ---------- 藏书：书脊陈列架 ---------- */
.state {
  padding: 80rpx 24rpx;
  text-align: center;
}

.state-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.6;
}

.shelf-row {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 14rpx;
  padding: 26rpx 8rpx 20rpx;
  margin-bottom: 30rpx;
}

/* 搁板：墨色板面 + 微金高光 */
.shelf-row::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 10rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #2a3040 0%, #3a4256 50%, #2a3040 100%);
  border-top: 1rpx solid rgba(232, 200, 120, 0.3);
  box-shadow: 0 8rpx 18rpx rgba(0, 0, 0, 0.5);
}

/* 书脊：竖立、宽窄高低错落、传统色 */
.spine {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  border-radius: 6rpx 6rpx 10rpx 10rpx;
  box-shadow:
    3rpx 5rpx 14rpx rgba(4, 10, 22, 0.5),
    inset 2rpx 0 6rpx rgba(255, 255, 255, 0.08),
    inset -2rpx 0 8rpx rgba(0, 0, 0, 0.28);
  overflow: hidden;
  box-sizing: border-box;
  transform: translateY(0);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

/* 抽书：hover 上移 */
.spine--pull {
  transform: translateY(-12rpx);
  box-shadow:
    6rpx 14rpx 28rpx rgba(4, 10, 22, 0.6),
    inset 2rpx 0 6rpx rgba(255, 255, 255, 0.08),
    inset -2rpx 0 8rpx rgba(0, 0, 0, 0.28);
}

/* 传统书脊上下框线 */
.spine-frame {
  position: absolute;
  left: 8rpx;
  right: 8rpx;
  top: 16rpx;
  bottom: 16rpx;
  border-top: 2rpx solid currentColor;
  border-bottom: 2rpx solid currentColor;
  opacity: 0.35;
  pointer-events: none;
}

/* 竖排书名：逐字换行 */
.spine-title {
  position: relative;
  z-index: 2;
  width: 48rpx;
  padding-top: 34rpx;
  padding-bottom: 64rpx;
  height: 100%;
  box-sizing: border-box;
  font-family: 'Songti SC', 'STSong', 'KaiTi', serif;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 44rpx;
  text-align: center;
  word-break: break-all;
  overflow: hidden;
}

/* 在读：脊顶朱砂书签垂下 */
.spine-bookmark {
  position: absolute;
  right: 10rpx;
  top: 0;
  width: 18rpx;
  height: 88rpx;
  border-radius: 0 0 5rpx 5rpx;
  background: linear-gradient(180deg, #d4674f 0%, #c45c4a 100%);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.4);
  z-index: 3;
}

.spine-bookmark::after {
  content: '';
  position: absolute;
  left: 3rpx;
  top: 12rpx;
  width: 4rpx;
  height: 56rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.3);
}

/* 读完：脊底朱印「毕」 */
.spine-seal {
  position: absolute;
  left: 50%;
  margin-left: -17rpx;
  bottom: 24rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 7rpx;
  background: linear-gradient(160deg, #d4674f 0%, #a03e30 100%);
  box-shadow:
    0 2rpx 8rpx rgba(0, 0, 0, 0.45),
    inset 0 0 0 2rpx rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.spine-seal-text {
  font-family: 'Songti SC', 'STSong', 'KaiTi', serif;
  font-size: 21rpx;
  font-weight: 700;
  color: #fff;
}
</style>
