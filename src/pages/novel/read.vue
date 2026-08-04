<template>
  <PageRoot :back="false" flush fill :extra-style="shellExtraStyle">
    <!-- 加载/失败时也用箭头返回，避免再出现蓝底「返回」 -->
    <view
      v-if="booting || loadError"
      class="reader-back reader-back--float"
      :style="readerBackStyle"
      hover-class="reader-back--active"
      @tap.stop="goBack"
    >
      <view class="reader-back-arrow" />
    </view>

    <view v-if="booting" class="state">
      <text class="state-text">打开中…</text>
    </view>
    <view v-else-if="loadError" class="state">
      <text class="state-text">{{ loadError }}</text>
    </view>
    <view
      v-else
      class="reader-shell"
      :class="'theme-' + themeId"
      :style="readerVars"
    >
      <!-- 主题化返回：固定在导航占位左侧，沉浸/呼出菜单均可点 -->
      <view
        class="reader-back reader-back--float"
        :class="{ 'is-chrome': chromeOpen }"
        :style="readerBackStyle"
        hover-class="reader-back--active"
        @tap.stop="goBack"
      >
        <view class="reader-back-arrow" />
      </view>

      <!-- 常态滚动阅读 -->
      <scroll-view
        v-show="!flipActive"
        scroll-y
        class="reader-scroll"
        :scroll-top="scrollTop"
        :show-scrollbar="false"
        @scroll="onScroll"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
        @tap="onBodyTap"
      >
        <view class="reader-content">
          <text class="in-chap-title">{{ chapterTitle }}</text>
          <text class="reader-body" user-select>{{ chapterContent }}</text>

          <view class="chap-end">
            <view class="chap-end-line" />
            <text class="chap-end-text">{{ isLastChapter ? '全书完' : '本章完' }}</text>
            <view
              v-if="!isLastChapter"
              class="chap-end-next"
              hover-class="chap-end-next--active"
              @tap.stop="goNext"
            >
              <text class="chap-end-next-text">点右侧或点击 · 下一章</text>
            </view>
          </view>
          <view class="reader-tail" />
        </view>
      </scroll-view>

      <!-- 仿真折角翻书过渡 -->
      <view v-if="flipActive" class="flip-stage" @touchmove.stop.prevent>
        <view class="flip-page flip-back">
          <text class="in-chap-title">{{ backTitle }}</text>
          <text class="reader-body">{{ backPreview }}</text>
        </view>
        <view class="flip-page flip-front" :style="frontClipStyle">
          <text class="in-chap-title">{{ frontTitle }}</text>
          <text class="reader-body">{{ frontPreview }}</text>
        </view>
        <view class="flip-sheet-shadow" :style="sheetShadowStyle" />
        <view class="flip-fold" :style="foldStyle" />
      </view>

      <!-- 顶栏 -->
      <view class="chrome-top" :class="{ show: chromeOpen }" @tap.stop>
        <text class="chrome-book">{{ meta.title || '' }}</text>
        <text class="chrome-chap">{{ chapterTitle }}</text>
        <text class="chrome-meta">{{ chapterIndex }} / {{ chapterCount }} · 本章 {{ chapterPct }}%</text>
      </view>

      <!-- 底栏 -->
      <view class="chrome-bottom" :class="{ show: chromeOpen }" @tap.stop>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: bookPct + '%' }" />
        </view>
        <view class="chrome-actions">
          <view
            class="chrome-btn ghost"
            :class="{ disabled: chapterIndex <= 1 }"
            hover-class="chrome-btn--active"
            @tap="goPrev"
          >
            <text class="chrome-btn-text">上一章</text>
          </view>
          <view class="chrome-btn" hover-class="chrome-btn--active" @tap="openToc">
            <text class="chrome-btn-text">目录</text>
          </view>
          <view class="chrome-btn" hover-class="chrome-btn--active" @tap="openSettings">
            <text class="chrome-btn-text">设置</text>
          </view>
          <view
            class="chrome-btn ghost"
            :class="{ disabled: isLastChapter }"
            hover-class="chrome-btn--active"
            @tap="goNext"
          >
            <text class="chrome-btn-text">下一章</text>
          </view>
        </view>
      </view>

      <!-- 设置面板 -->
      <view v-if="settingsOpen" class="sheet-mask" @tap="closeSettings" />
      <view class="sheet settings-sheet" :class="{ show: settingsOpen }" @tap.stop>
        <text class="sheet-title">阅读设置</text>

        <view class="setting-row">
          <text class="setting-label">字号</text>
          <view class="setting-ctrl">
            <view class="step-btn" hover-class="step-btn--active" @tap="shrinkFont">
              <text class="step-btn-text">A-</text>
            </view>
            <text class="setting-value">{{ fontSize }}</text>
            <view class="step-btn" hover-class="step-btn--active" @tap="growFont">
              <text class="step-btn-text">A+</text>
            </view>
          </view>
        </view>

        <view class="setting-row">
          <text class="setting-label">行距</text>
          <view class="seg">
            <view
              v-for="lh in lineHeightOptions"
              :key="lh.id"
              class="seg-item"
              :class="{ on: lineHeightId === lh.id }"
              hover-class="seg-item--active"
              @tap="setLineHeight(lh.id)"
            >
              <text class="seg-text">{{ lh.label }}</text>
            </view>
          </view>
        </view>

        <view class="setting-row col">
          <text class="setting-label">背景</text>
          <view class="theme-row">
            <view
              v-for="t in themes"
              :key="t.id"
              class="theme-dot"
              :class="{ on: themeId === t.id }"
              :style="{ background: t.preview }"
              hover-class="theme-dot--active"
              @tap="setTheme(t.id)"
            />
          </view>
        </view>
      </view>

      <!-- 目录 -->
      <view v-if="tocOpen" class="sheet-mask" @tap="closeToc" />
      <view class="sheet toc-sheet" :class="{ show: tocOpen }" @tap.stop>
        <text class="sheet-title">目录 · {{ chapterCount }} 章</text>
        <scroll-view
          scroll-y
          class="toc-scroll"
          :scroll-into-view="tocScrollInto"
          :show-scrollbar="false"
        >
          <view
            v-for="ch in tocList"
            :id="'toc-' + ch.index"
            :key="ch.index"
            class="toc-item"
            :class="{ on: ch.index === chapterIndex }"
            hover-class="toc-item--active"
            @tap="jumpChapter(ch.index)"
          >
            <text class="toc-idx">{{ ch.index }}</text>
            <text class="toc-name">{{ ch.title }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  fetchNovelBook,
  getCachedChapter,
  getCachedBook,
  getNovelProgress,
  setNovelProgress,
} from '@/api/novel'

const PREFS_KEY = 'novelReaderPrefs'
const TIP_KEY = 'novelReaderTipShown_v2'
const FONT_MIN = 28
const FONT_MAX = 44
const FONT_STEP = 4
const CHROME_HIDE_MS = 4000
const EDGE_RATIO = 0.28
const FLIP_MS = 480
const PREVIEW_LEN = 2600

const themes = [
  { id: 'paper', preview: '#f3ead8', bg: '#f6f1e8', text: '#2c2416', muted: '#8a7a64' },
  { id: 'mint', preview: '#dce8dc', bg: '#e8f0e8', text: '#1f2e1f', muted: '#6a806a' },
  { id: 'sky', preview: '#d6eaf8', bg: '#e8f4fc', text: '#0f2d4a', muted: '#6b8fa8' },
  { id: 'night', preview: '#2a2e38', bg: '#1a1d24', text: '#c8cdd6', muted: '#7a8290' },
]

const lineHeightOptions = [
  { id: 'tight', label: '紧凑', value: 1.65 },
  { id: 'normal', label: '标准', value: 1.9 },
  { id: 'loose', label: '宽松', value: 2.2 },
]

const bookId = ref('')
const meta = ref({ id: '', title: '', author: '', chapterCount: 0 })
const chapterIndex = ref(1)
const chapterTitle = ref('')
const chapterContent = ref('')
const booting = ref(true)
const loadError = ref('')
const scrollTop = ref(0)
const turnDir = ref('next') // 'next' | 'prev'

const flipActive = ref(false)
const flipCurl = ref(0)
const frontTitle = ref('')
const frontBody = ref('')
const backTitle = ref('')
const backBody = ref('')

const chromeOpen = ref(false)
const settingsOpen = ref(false)
const tocOpen = ref(false)
const tocScrollInto = ref('')

const fontSize = ref(32)
const lineHeightId = ref('normal')
const themeId = ref('sky')

const chapterScrollRatio = ref(0)
const animating = ref(false)
const statusBarHeight = ref(20)
const navBarHeight = ref(44)

let touchX = 0
let touchY = 0
let lastTapX = 0
let touchMoved = false
let chromeTimer = null
let flipTimer = null
let flipRaf = null

const chapterCount = computed(() => Number(meta.value.chapterCount) || 0)
const isLastChapter = computed(() => chapterIndex.value >= chapterCount.value)

/** 与 CustomNav 导航行垂直居中对齐 */
const readerBackStyle = computed(() => {
  const top = statusBarHeight.value + (navBarHeight.value - 32) / 2
  return { top: (top > 0 ? top : statusBarHeight.value + 6) + 'px' }
})

const frontPreview = computed(() => previewText(frontBody.value))
const backPreview = computed(() => previewText(backBody.value))

const curlGeom = computed(() => calcCurlGeometry(flipCurl.value, turnDir.value))

const frontClipStyle = computed(() => {
  const clip = curlGeom.value.clip
  return 'clip-path:' + clip + ';-webkit-clip-path:' + clip
})

const foldStyle = computed(() => {
  const f = curlGeom.value.fold
  if (!f) return { opacity: 0 }
  return {
    left: f.left,
    top: f.top,
    width: f.width,
    height: (f.height || 24) + 'rpx',
    opacity: String(f.opacity),
    transform: 'translate(-50%, -50%) rotate(' + f.angle + 'deg)',
  }
})

const sheetShadowStyle = computed(() => {
  const s = curlGeom.value.shadow
  if (!s) return { opacity: 0 }
  return {
    left: s.left,
    top: s.top,
    width: s.width,
    height: s.height,
    opacity: String(s.opacity),
    transform: 'translate(-50%, -50%) rotate(' + s.angle + 'deg)',
  }
})

function previewText(s) {
  const t = String(s || '')
  if (t.length <= PREVIEW_LEN) return t
  return t.slice(0, PREVIEW_LEN) + '…'
}

function easeInOut(t) {
  if (t < 0.5) return 2 * t * t
  return 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** 折角几何：下一章右下掀起，上一章左下掀起 */
function calcCurlGeometry(curl, dir) {
  let t = Number(curl) || 0
  if (t < 0) t = 0
  if (t > 1) t = 1
  const e = easeInOut(t)
  if (e <= 0.001) {
    return {
      clip: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      fold: null,
      shadow: null,
    }
  }

  if (dir === 'prev') {
    const leftY = 100 - e * 108
    const bottomX = e * 108
    const clip =
      'polygon(0% 0%, 100% 0%, 100% 100%, ' +
      bottomX +
      '% 100%, 0% ' +
      leftY +
      '%)'
    const x1 = 0
    const y1 = leftY
    const x2 = bottomX
    const y2 = 100
    return {
      clip: clip,
      fold: foldFromLine(x1, y1, x2, y2, e, true),
      shadow: shadowFromLine(x1, y1, x2, y2, e),
    }
  }

  const rightY = 100 - e * 108
  const bottomX = 100 - e * 108
  const clip =
    'polygon(0% 0%, 100% 0%, 100% ' + rightY + '%, ' + bottomX + '% 100%, 0% 100%)'
  const x1 = 100
  const y1 = rightY
  const x2 = bottomX
  const y2 = 100
  return {
    clip: clip,
    fold: foldFromLine(x1, y1, x2, y2, e, false),
    shadow: shadowFromLine(x1, y1, x2, y2, e),
  }
}

function foldFromLine(x1, y1, x2, y2, e, mirror) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + (mirror ? 180 : 0)
  const thick = 10 + e * 28
  return {
    left: mx + '%',
    top: my + '%',
    width: Math.max(8, len) + '%',
    angle: angle,
    opacity: Math.min(0.95, 0.25 + e * 0.85),
    height: thick,
  }
}

function shadowFromLine(x1, y1, x2, y2, e) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  return {
    left: mx + '%',
    top: my + '%',
    width: Math.max(12, len * 1.05) + '%',
    height: 18 + e * 36 + 'rpx',
    angle: angle,
    opacity: Math.min(0.55, 0.12 + e * 0.5),
  }
}

function stopFlipAnim() {
  if (flipTimer) {
    clearInterval(flipTimer)
    flipTimer = null
  }
  if (flipRaf) {
    clearTimeout(flipRaf)
    flipRaf = null
  }
}

const lineHeight = computed(() => {
  for (let i = 0; i < lineHeightOptions.length; i++) {
    if (lineHeightOptions[i].id === lineHeightId.value) return lineHeightOptions[i].value
  }
  return 1.9
})

const activeTheme = computed(() => {
  for (let i = 0; i < themes.length; i++) {
    if (themes[i].id === themeId.value) return themes[i]
  }
  return themes[2]
})

const readerVars = computed(() => {
  const t = activeTheme.value
  return {
    '--reader-bg': t.bg,
    '--reader-text': t.text,
    '--reader-muted': t.muted,
    '--reader-font': fontSize.value + 'rpx',
    '--reader-lh': String(lineHeight.value),
  }
})

const shellExtraStyle = computed(() => {
  if (booting.value || loadError.value) return null
  return { background: activeTheme.value.bg }
})

const chapterPct = computed(() => Math.round(chapterScrollRatio.value * 100))

const bookPct = computed(() => {
  const total = chapterCount.value
  if (!total) return 0
  const v = ((chapterIndex.value - 1 + chapterScrollRatio.value) / total) * 100
  if (v < 0) return 0
  if (v > 100) return 100
  return Math.round(v * 10) / 10
})

const tocList = computed(() => {
  const book = getCachedBook(bookId.value)
  const list = (book && book.chapters) || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    out.push({
      index: Number(list[i].index) || i + 1,
      title: list[i].title || '第' + (i + 1) + '章',
    })
  }
  return out
})

onLoad((query) => {
  loadPrefs()
  const q = query || {}
  bookId.value = decodeURIComponent(q.bookId || '')
  const ch = Number(q.chapter)
  if (isFinite(ch) && ch >= 1) {
    chapterIndex.value = ch
  } else if (bookId.value) {
    chapterIndex.value = getNovelProgress(bookId.value)
  }
  boot()
})

onMounted(() => {
  const info = uni.getSystemInfoSync() || {}
  statusBarHeight.value = info.statusBarHeight || 20
  try {
    const menuButton = wx.getMenuButtonBoundingClientRect()
    if (menuButton && menuButton.height) {
      navBarHeight.value =
        (menuButton.top - (info.statusBarHeight || 0)) * 2 + menuButton.height
    }
  } catch (e) {
    // ignore
  }
})

onUnload(() => {
  clearChromeTimer()
  stopFlipAnim()
})

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: '/pages/novel/index' })
    },
  })
}

async function boot() {
  if (!bookId.value) {
    loadError.value = '缺少书籍参数'
    booting.value = false
    return
  }
  booting.value = true
  loadError.value = ''
  try {
    const book = await fetchNovelBook(bookId.value)
    meta.value = {
      id: book.id,
      title: book.title,
      author: book.author,
      chapterCount: book.chapterCount,
    }
    const total = Number(book.chapterCount) || 0
    if (chapterIndex.value > total && total > 0) chapterIndex.value = total
    showChapter(chapterIndex.value, false)
    maybeShowTip()
  } catch (err) {
    console.error('打开书籍失败', err)
    loadError.value = '打开失败，请确认已上传 ' + bookId.value + '.json'
  } finally {
    booting.value = false
  }
}

function loadPrefs() {
  try {
    const raw = uni.getStorageSync(PREFS_KEY)
    if (!raw) return
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data) return
    const fs = Number(data.fontSize)
    if (isFinite(fs) && fs >= FONT_MIN && fs <= FONT_MAX) fontSize.value = fs
    if (data.lineHeightId === 'tight' || data.lineHeightId === 'normal' || data.lineHeightId === 'loose') {
      lineHeightId.value = data.lineHeightId
    }
    if (
      data.themeId === 'paper' ||
      data.themeId === 'mint' ||
      data.themeId === 'sky' ||
      data.themeId === 'night'
    ) {
      themeId.value = data.themeId
    }
  } catch (e) {
    // ignore
  }
}

function savePrefs() {
  try {
    uni.setStorageSync(PREFS_KEY, {
      fontSize: fontSize.value,
      lineHeightId: lineHeightId.value,
      themeId: themeId.value,
    })
  } catch (e) {
    // ignore
  }
}

function maybeShowTip() {
  try {
    if (uni.getStorageSync(TIP_KEY)) return
    uni.setStorageSync(TIP_KEY, 1)
  } catch (e) {
    // ignore
  }
  uni.showToast({
    title: '点左侧上章 · 点右侧下章 · 点中间菜单',
    icon: 'none',
    duration: 2800,
  })
}

function showChapter(index, withAnim, dir) {
  const data = getCachedChapter(bookId.value, index)
  if (!data) {
    uni.showToast({ title: '章节不存在', icon: 'none' })
    return
  }

  const apply = () => {
    chapterIndex.value = Number(data.index) || index
    chapterTitle.value = data.title || '第' + index + '章'
    chapterContent.value = data.content || ''
    setNovelProgress(bookId.value, chapterIndex.value)
    chapterScrollRatio.value = 0
    scrollTop.value = scrollTop.value === 0 ? 0.01 : 0
  }

  if (!withAnim) {
    stopFlipAnim()
    flipActive.value = false
    animating.value = false
    apply()
    return
  }

  if (animating.value) return

  const nextDir = dir === 'prev' ? 'prev' : index < chapterIndex.value ? 'prev' : 'next'
  turnDir.value = nextDir
  frontTitle.value = chapterTitle.value
  frontBody.value = chapterContent.value
  backTitle.value = data.title || '第' + index + '章'
  backBody.value = data.content || ''

  animating.value = true
  flipActive.value = true
  flipCurl.value = 0
  stopFlipAnim()

  const started = Date.now()
  flipTimer = setInterval(() => {
    const p = (Date.now() - started) / FLIP_MS
    if (p >= 1) {
      flipCurl.value = 1
      stopFlipAnim()
      apply()
      flipActive.value = false
      animating.value = false
      flipCurl.value = 0
      return
    }
    flipCurl.value = p
  }, 16)
}

function goPrev() {
  bumpChromeTimer()
  if (animating.value) return
  if (chapterIndex.value <= 1) {
    uni.showToast({ title: '已是第一章', icon: 'none' })
    return
  }
  showChapter(chapterIndex.value - 1, true, 'prev')
}

function goNext() {
  bumpChromeTimer()
  if (animating.value) return
  if (chapterIndex.value >= chapterCount.value) {
    uni.showToast({ title: '已是最后一章', icon: 'none' })
    return
  }
  showChapter(chapterIndex.value + 1, true, 'next')
}

function onScroll(e) {
  const d = (e && e.detail) || {}
  const top = Number(d.scrollTop) || 0
  const h = Number(d.scrollHeight) || 0
  const sys = uni.getSystemInfoSync() || {}
  const winH = Number(sys.windowHeight) || 600
  const viewH = winH * 0.78
  const max = Math.max(1, h - viewH)
  let r = top / max
  if (r < 0) r = 0
  if (r > 1) r = 1
  chapterScrollRatio.value = r
}

function onTouchStart(e) {
  const list = e.touches || []
  const t = list[0]
  if (!t) return
  touchX = t.clientX
  touchY = t.clientY
  lastTapX = t.clientX
  touchMoved = false
}

function onTouchEnd(e) {
  const list = e.changedTouches || []
  const t = list[0]
  if (!t) return
  lastTapX = t.clientX
  const dx = t.clientX - touchX
  const dy = t.clientY - touchY
  // 仅标记是否滚动，不再用横滑切章
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) touchMoved = true
}

function onBodyTap() {
  if (touchMoved) return
  if (settingsOpen.value || tocOpen.value) return
  if (animating.value) return

  const sys = uni.getSystemInfoSync() || {}
  const w = Number(sys.windowWidth) || 375
  const x = lastTapX || w / 2

  if (x < w * EDGE_RATIO) {
    goPrev()
    return
  }
  if (x > w * (1 - EDGE_RATIO)) {
    goNext()
    return
  }
  toggleChrome()
}

function toggleChrome() {
  chromeOpen.value = !chromeOpen.value
  if (chromeOpen.value) bumpChromeTimer()
  else clearChromeTimer()
}

function bumpChromeTimer() {
  clearChromeTimer()
  if (!chromeOpen.value) return
  chromeTimer = setTimeout(() => {
    if (settingsOpen.value || tocOpen.value) return
    chromeOpen.value = false
  }, CHROME_HIDE_MS)
}

function clearChromeTimer() {
  if (chromeTimer) {
    clearTimeout(chromeTimer)
    chromeTimer = null
  }
}

function openSettings() {
  settingsOpen.value = true
  tocOpen.value = false
  chromeOpen.value = true
  clearChromeTimer()
}

function closeSettings() {
  settingsOpen.value = false
  bumpChromeTimer()
}

function openToc() {
  tocOpen.value = true
  settingsOpen.value = false
  chromeOpen.value = true
  clearChromeTimer()
  tocScrollInto.value = ''
  nextTick(() => {
    tocScrollInto.value = 'toc-' + chapterIndex.value
  })
}

function closeToc() {
  tocOpen.value = false
  bumpChromeTimer()
}

function jumpChapter(index) {
  closeToc()
  if (animating.value) return
  const dir = index < chapterIndex.value ? 'prev' : 'next'
  showChapter(index, true, dir)
}

function shrinkFont() {
  if (fontSize.value <= FONT_MIN) return
  fontSize.value -= FONT_STEP
  savePrefs()
}

function growFont() {
  if (fontSize.value >= FONT_MAX) return
  fontSize.value += FONT_STEP
  savePrefs()
}

function setLineHeight(id) {
  lineHeightId.value = id
  savePrefs()
}

function setTheme(id) {
  themeId.value = id
  savePrefs()
}
</script>

<style lang="scss" scoped>
.state {
  padding: 160rpx 32rpx;
  text-align: center;
}

.state-text {
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.6;
}

.reader-shell {
  position: relative;
  height: 100%;
  background: var(--reader-bg, #e8f4fc);
  overflow: hidden;
}

.reader-scroll {
  height: 100%;
  box-sizing: border-box;
}

.reader-content {
  position: relative;
  padding: 28rpx 40rpx 120rpx;
  background: var(--reader-bg, #e8f4fc);
}

.flip-stage {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 15;
  overflow: hidden;
  background: var(--reader-bg, #e8f4fc);
}

.flip-page {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 28rpx 40rpx 80rpx;
  box-sizing: border-box;
  background: var(--reader-bg, #e8f4fc);
  overflow: hidden;
}

.flip-back {
  z-index: 1;
}

.flip-front {
  z-index: 3;
  box-shadow: -8rpx 0 28rpx rgba(0, 0, 0, 0.08);
}

.flip-sheet-shadow {
  position: absolute;
  z-index: 4;
  pointer-events: none;
  border-radius: 4rpx;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.22) 0%,
    rgba(0, 0, 0, 0.06) 45%,
    transparent 100%
  );
}

.flip-fold {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  border-radius: 2rpx;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.12) 35%,
    rgba(0, 0, 0, 0.12) 62%,
    rgba(0, 0, 0, 0.28) 100%
  );
  box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.18);
}

.theme-night .flip-front {
  box-shadow: -8rpx 0 28rpx rgba(0, 0, 0, 0.35);
}

.theme-night .flip-fold {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.05) 40%,
    rgba(0, 0, 0, 0.35) 70%,
    rgba(0, 0, 0, 0.55) 100%
  );
}

.in-chap-title {
  display: block;
  font-size: 26rpx;
  color: var(--reader-muted, #6b8fa8);
  letter-spacing: 2rpx;
  margin-bottom: 28rpx;
  opacity: 0.9;
}

.reader-body {
  display: block;
  font-size: var(--reader-font, 32rpx);
  line-height: var(--reader-lh, 1.9);
  color: var(--reader-text, #0f2d4a);
  letter-spacing: 1rpx;
  white-space: pre-wrap;
  word-break: break-word;
}

.chap-end {
  margin-top: 64rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.chap-end-line {
  width: 80rpx;
  height: 2rpx;
  background: var(--reader-muted, #6b8fa8);
  opacity: 0.35;
}

.chap-end-text {
  font-size: 24rpx;
  color: var(--reader-muted, #6b8fa8);
  letter-spacing: 4rpx;
}

.chap-end-next {
  margin-top: 8rpx;
  padding: 16rpx 36rpx;
  border-radius: 999rpx;
  background: rgba(74, 159, 232, 0.14);
}

.theme-night .chap-end-next {
  background: rgba(255, 255, 255, 0.1);
}

.chap-end-next--active {
  opacity: 0.85;
}

.chap-end-next-text {
  font-size: 24rpx;
  color: var(--reader-text, #0f2d4a);
}

.reader-tail {
  height: 48rpx;
}

.reader-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
}

.reader-back--float {
  position: fixed;
  left: 20rpx;
  z-index: 110;
  background: rgba(255, 255, 255, 0.38);
  border: 1rpx solid rgba(15, 45, 74, 0.07);
}

.reader-back--float.is-chrome {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(15, 45, 74, 0.1);
}

.theme-night .reader-back--float {
  background: rgba(0, 0, 0, 0.28);
  border-color: rgba(255, 255, 255, 0.1);
}

.theme-night .reader-back--float.is-chrome {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.14);
}

.reader-back--active {
  opacity: 0.72;
  transform: scale(0.94);
}

.reader-back-arrow {
  width: 16rpx;
  height: 16rpx;
  border-left: 3rpx solid var(--reader-text, #0f2d4a);
  border-bottom: 3rpx solid var(--reader-text, #0f2d4a);
  transform: rotate(45deg);
  margin-left: 4rpx;
  opacity: 0.72;
}

.chrome-top,
.chrome-bottom {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.theme-night .chrome-top,
.theme-night .chrome-bottom {
  background: rgba(28, 32, 40, 0.94);
}

.chrome-top {
  top: 0;
  padding: 16rpx 32rpx 20rpx;
  transform: translateY(-12rpx);
  box-shadow: 0 8rpx 24rpx rgba(15, 45, 74, 0.08);
}

.chrome-bottom {
  bottom: 0;
  padding: 12rpx 20rpx calc(16rpx + env(safe-area-inset-bottom));
  transform: translateY(12rpx);
  box-shadow: 0 -8rpx 24rpx rgba(15, 45, 74, 0.08);
}

.chrome-top.show,
.chrome-bottom.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.chrome-book {
  display: block;
  font-size: 22rpx;
  color: var(--reader-muted, #6b8fa8);
  margin-bottom: 6rpx;
}

.chrome-chap {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--reader-text, #0f2d4a);
  margin-bottom: 4rpx;
}

.chrome-meta {
  display: block;
  font-size: 20rpx;
  color: var(--reader-muted, #6b8fa8);
}

.progress-track {
  height: 6rpx;
  border-radius: 999rpx;
  background: rgba(74, 159, 232, 0.15);
  overflow: hidden;
  margin-bottom: 14rpx;
}

.theme-night .progress-track {
  background: rgba(255, 255, 255, 0.12);
}

.progress-fill {
  height: 100%;
  border-radius: 999rpx;
  background: $color-primary;
  transition: width 0.15s linear;
}

.chrome-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.chrome-btn {
  flex: 1;
  height: 68rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 159, 232, 0.14);
}

.chrome-btn.ghost {
  background: rgba(74, 159, 232, 0.08);
}

.theme-night .chrome-btn {
  background: rgba(255, 255, 255, 0.1);
}

.theme-night .chrome-btn.ghost {
  background: rgba(255, 255, 255, 0.06);
}

.chrome-btn.disabled {
  opacity: 0.35;
}

.chrome-btn--active {
  opacity: 0.85;
}

.chrome-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--reader-text, #0f2d4a);
}

.sheet-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 30;
  background: rgba(10, 20, 35, 0.35);
}

.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 31;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  transform: translateY(110%);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  box-sizing: border-box;
  pointer-events: none;
}

.theme-night .sheet {
  background: #232833;
}

.sheet.show {
  transform: translateY(0);
  pointer-events: auto;
}

.sheet-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--reader-text, #0f2d4a);
  margin-bottom: 28rpx;
}

.settings-sheet {
  min-height: 420rpx;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.setting-row.col {
  flex-direction: column;
  align-items: flex-start;
  gap: 16rpx;
}

.setting-label {
  font-size: 26rpx;
  color: var(--reader-muted, #6b8fa8);
}

.setting-ctrl {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.setting-value {
  min-width: 56rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--reader-text, #0f2d4a);
}

.step-btn {
  width: 72rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: rgba(74, 159, 232, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-night .step-btn {
  background: rgba(255, 255, 255, 0.1);
}

.step-btn--active {
  opacity: 0.85;
}

.step-btn-text {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--reader-text, #0f2d4a);
}

.seg {
  display: flex;
  gap: 10rpx;
}

.seg-item {
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(74, 159, 232, 0.1);
}

.seg-item.on {
  background: rgba(74, 159, 232, 0.28);
}

.theme-night .seg-item {
  background: rgba(255, 255, 255, 0.08);
}

.theme-night .seg-item.on {
  background: rgba(255, 255, 255, 0.18);
}

.seg-item--active {
  opacity: 0.9;
}

.seg-text {
  font-size: 24rpx;
  color: var(--reader-text, #0f2d4a);
}

.theme-row {
  display: flex;
  gap: 20rpx;
}

.theme-dot {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;
  box-shadow: inset 0 0 0 1rpx rgba(0, 0, 0, 0.08);
}

.theme-dot.on {
  border-color: $color-primary;
}

.theme-dot--active {
  transform: scale(0.94);
}

.toc-sheet {
  height: 68vh;
  display: flex;
  flex-direction: column;
}

.toc-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.toc-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 22rpx 8rpx;
  border-bottom: 1rpx solid rgba(107, 143, 168, 0.15);
}

.toc-item.on {
  background: rgba(74, 159, 232, 0.1);
  border-radius: 12rpx;
  padding-left: 12rpx;
  padding-right: 12rpx;
}

.theme-night .toc-item {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.theme-night .toc-item.on {
  background: rgba(255, 255, 255, 0.08);
}

.toc-item--active {
  opacity: 0.88;
}

.toc-idx {
  width: 56rpx;
  flex-shrink: 0;
  font-size: 22rpx;
  color: var(--reader-muted, #6b8fa8);
  padding-top: 4rpx;
}

.toc-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--reader-text, #0f2d4a);
  line-height: 1.4;
}

.toc-item.on .toc-name {
  font-weight: 600;
  color: $color-primary-dark;
}

.theme-night .toc-item.on .toc-name {
  color: #9ec9f5;
}
</style>
