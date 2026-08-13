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

    <PageLoading v-if="booting" text="打开中" />
    <view v-else-if="loadError" class="state">
      <text class="state-text">{{ loadError }}</text>
    </view>
    <view
      v-else
      class="reader-shell"
      :class="'theme-' + themeId"
      :style="readerVars"
    >
      <view
        class="reader-back reader-back--float"
        :class="{ 'is-chrome': chromeOpen }"
        :style="readerBackStyle"
        hover-class="reader-back--active"
        @tap.stop="goBack"
      >
        <view class="reader-back-arrow" />
      </view>

      <!-- 固定视口分页：不可上下滚动 -->
      <view
        class="reader-stage"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @tap="onBodyTap"
      >
        <!-- 常态单页 -->
        <view v-if="!flipActive" class="page-sheet">
          <text v-if="currentPage.showTitle" class="in-chap-title">{{ chapterTitle }}</text>
          <text class="reader-body" user-select>{{ currentPage.text }}</text>
          <view v-if="currentPage.showEnd" class="chap-end">
            <view class="chap-end-line" />
            <text class="chap-end-text">{{ isLastChapter ? '全书完' : '本章完' }}</text>
          </view>
          <view class="page-foot">
            <text class="page-foot-text">{{ pageFootText }}</text>
          </view>
        </view>

        <!-- 横向翻页：当前页滑出 + 目标页滑入 -->
        <view v-else class="flip-stage" :class="'dir-' + turnDir + (flipRun ? ' is-run' : '')">
          <view class="page-sheet flip-back">
            <text v-if="backPage.showTitle" class="in-chap-title">{{ backPage.title }}</text>
            <text class="reader-body">{{ backPage.text }}</text>
            <view v-if="backPage.showEnd" class="chap-end">
              <view class="chap-end-line" />
              <text class="chap-end-text">{{ backPage.endLabel }}</text>
            </view>
            <view class="page-foot">
              <text class="page-foot-text">{{ backPage.foot }}</text>
            </view>
          </view>
          <view class="page-sheet flip-front">
            <text v-if="frontPage.showTitle" class="in-chap-title">{{ frontPage.title }}</text>
            <text class="reader-body">{{ frontPage.text }}</text>
            <view v-if="frontPage.showEnd" class="chap-end">
              <view class="chap-end-line" />
              <text class="chap-end-text">{{ frontPage.endLabel }}</text>
            </view>
            <view class="page-foot">
              <text class="page-foot-text">{{ frontPage.foot }}</text>
            </view>
          </view>
        </view>

        <!-- 左右热区提示（菜单打开时更明显） -->
        <view class="edge-hint edge-hint--left" :class="{ show: chromeOpen }" />
        <view class="edge-hint edge-hint--right" :class="{ show: chromeOpen }" />
      </view>

      <!-- 顶栏 -->
      <view class="chrome-top" :class="{ show: chromeOpen }" @tap.stop>
        <text class="chrome-book">{{ meta.title || '' }}</text>
        <text class="chrome-chap">{{ chapterTitle }}</text>
        <text class="chrome-meta">
          {{ chapterIndex }} / {{ chapterCount }} 章 · 本页 {{ pageIndex + 1 }}/{{ pageCount }} ·
          {{ bookPct }}%
        </text>
      </view>

      <!-- 底栏：上一页 / 目录 / 设置 / 下一页 -->
      <view class="chrome-bottom" :class="{ show: chromeOpen }" @tap.stop>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: bookPct + '%' }" />
        </view>
        <view class="chrome-actions">
          <view
            class="chrome-btn ghost"
            :class="{ disabled: !canGoPrev }"
            hover-class="chrome-btn--active"
            @tap="goPrevPage"
          >
            <text class="chrome-btn-text">上一页</text>
          </view>
          <view class="chrome-btn" hover-class="chrome-btn--active" @tap="openToc">
            <text class="chrome-btn-text">目录</text>
          </view>
          <view class="chrome-btn" hover-class="chrome-btn--active" @tap="openSettings">
            <text class="chrome-btn-text">设置</text>
          </view>
          <view
            class="chrome-btn ghost"
            :class="{ disabled: !canGoNext }"
            hover-class="chrome-btn--active"
            @tap="goNextPage"
          >
            <text class="chrome-btn-text">下一页</text>
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
const TIP_KEY = 'novelReaderTipShown_v3'
const FONT_MIN = 28
const FONT_MAX = 44
const FONT_STEP = 4
const CHROME_HIDE_MS = 4000
const EDGE_RATIO = 0.32
const FLIP_MS = 340
const SWIPE_MIN = 48
const PAD_X_RPX = 40
const PAD_TOP_RPX = 28
const PAD_BOTTOM_RPX = 72
const TITLE_BLOCK_RPX = 54
const END_BLOCK_RPX = 100

const themes = [
  { id: 'night', preview: '#2a2e38', bg: '#0c0e12', text: '#d2d6de', muted: '#7a8290' },
  { id: 'paper', preview: '#f3ead8', bg: '#f6f1e8', text: '#2c2416', muted: '#8a7a64' },
  { id: 'mint', preview: '#dce8dc', bg: '#e8f0e8', text: '#1f2e1f', muted: '#6a806a' },
  { id: 'sky', preview: '#d6eaf8', bg: '#e8f4fc', text: '#0f2d4a', muted: '#6b8fa8' },
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
const pages = ref([])
const pageIndex = ref(0)

const booting = ref(true)
const loadError = ref('')
const turnDir = ref('next')

const flipActive = ref(false)
const flipRun = ref(false)
const frontPage = ref(emptyPageView())
const backPage = ref(emptyPageView())

const chromeOpen = ref(false)
const settingsOpen = ref(false)
const tocOpen = ref(false)
const tocScrollInto = ref('')

const fontSize = ref(32)
const lineHeightId = ref('normal')
const themeId = ref('night')

const animating = ref(false)
const statusBarHeight = ref(20)
const navBarHeight = ref(44)
const windowWidth = ref(375)
const windowHeight = ref(667)

let touchX = 0
let touchY = 0
let lastTapX = 0
let touchMoved = false
let swipeLocked = false
let chromeTimer = null
let flipTimer = null

const chapterCount = computed(() => Number(meta.value.chapterCount) || 0)
const isLastChapter = computed(() => chapterIndex.value >= chapterCount.value)
const pageCount = computed(() => {
  const n = pages.value.length
  return n > 0 ? n : 1
})

const currentPage = computed(() => {
  const list = pages.value
  if (!list.length) {
    return { text: '', showTitle: true, showEnd: false }
  }
  let i = pageIndex.value
  if (i < 0) i = 0
  if (i >= list.length) i = list.length - 1
  return list[i]
})

const pageFootText = computed(() => {
  return chapterIndex.value + ' · ' + (pageIndex.value + 1) + '/' + pageCount.value
})

const canGoPrev = computed(() => chapterIndex.value > 1 || pageIndex.value > 0)
const canGoNext = computed(() => {
  if (pageIndex.value < pageCount.value - 1) return true
  return chapterIndex.value < chapterCount.value
})

const readerBackStyle = computed(() => {
  const top = statusBarHeight.value + (navBarHeight.value - 32) / 2
  return { top: (top > 0 ? top : statusBarHeight.value + 6) + 'px' }
})

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
  return themes[0]
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
  if (booting.value || loadError.value) return { background: '#0c0e12' }
  return { background: activeTheme.value.bg }
})

const bookPct = computed(() => {
  const total = chapterCount.value
  if (!total) return 0
  const pc = pageCount.value
  const pageRatio = pc > 1 ? pageIndex.value / (pc - 1) : 1
  const v = ((chapterIndex.value - 1 + pageRatio) / total) * 100
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
  syncSystemInfo()
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
  syncSystemInfo()
  // 导航高度就绪后重排一页，避免首屏估算偏差
  if (!booting.value && !loadError.value && chapterContent.value) {
    rebuildPages(true)
  }
})

function syncSystemInfo() {
  const info = uni.getSystemInfoSync() || {}
  statusBarHeight.value = info.statusBarHeight || 20
  windowWidth.value = Number(info.windowWidth) || 375
  windowHeight.value = Number(info.windowHeight) || 667
  try {
    const menuButton = wx.getMenuButtonBoundingClientRect()
    if (menuButton && menuButton.height) {
      navBarHeight.value =
        (menuButton.top - (info.statusBarHeight || 0)) * 2 + menuButton.height
    }
  } catch (e) {
    // ignore
  }
}

onUnload(() => {
  clearChromeTimer()
  stopFlipAnim()
})

function emptyPageView() {
  return {
    text: '',
    title: '',
    showTitle: false,
    showEnd: false,
    endLabel: '',
    foot: '',
  }
}

function rpx2px(rpx) {
  return (Number(rpx) * windowWidth.value) / 750
}

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
    applyChapter(chapterIndex.value, 0, false)
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
    title: '点右侧/左滑下页 · 点左侧/右滑上页 · 点中间菜单',
    icon: 'none',
    duration: 3000,
  })
}

/** 估算单行文字宽度（中文≈字号，ASCII≈半宽） */
function measureLineWidth(text, fontPx) {
  let w = 0
  const s = String(text || '')
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code <= 0x7f) w += fontPx * 0.55
    else w += fontPx
  }
  return w
}

function countWrappedLines(text, contentW, fontPx) {
  const s = String(text || '')
  if (!s) return 1
  const w = measureLineWidth(s, fontPx)
  const lines = Math.ceil(w / Math.max(1, contentW))
  return lines > 0 ? lines : 1
}

/**
 * 按视口高度把本章正文切成多页，每页刚好一屏，不再上下滚动。
 */
function paginateChapter(content, title, opts) {
  const fontPx = rpx2px(opts.fontSizeRpx)
  const lineH = fontPx * opts.lineHeight
  // letter-spacing / 换行误差：内容区略收窄，行数预算留余量，避免底边被裁切
  const contentW = Math.max(40, opts.contentWidthPx - fontPx * 0.35)
  const fullH = Math.max(lineH * 3, opts.contentHeightPx)
  const titleH = opts.showTitleReserve ? rpx2px(TITLE_BLOCK_RPX) : 0
  const endH = rpx2px(END_BLOCK_RPX)

  const rawLines = String(content || '').split('\n')
  const units = []
  for (let i = 0; i < rawLines.length; i++) {
    units.push({
      text: rawLines[i],
      lines: countWrappedLines(rawLines[i], contentW, fontPx),
    })
  }
  if (!units.length) units.push({ text: '', lines: 1 })

  const out = []
  let idx = 0
  let pageNo = 0

  while (idx < units.length) {
    const isFirst = pageNo === 0
    let budget = Math.floor(((fullH - (isFirst ? titleH : 0)) / lineH) * 0.92)
    if (budget < 1) budget = 1

    const chunk = []
    let used = 0
    while (idx < units.length) {
      const u = units[idx]
      const need = u.lines
      if (chunk.length && used + need > budget) break
      if (!chunk.length && need > budget) {
        // 超长单行：硬切字符装进本页
        const maxChars = Math.max(1, Math.floor(contentW / fontPx) * budget)
        if (u.text.length > maxChars) {
          chunk.push(u.text.slice(0, maxChars))
          units[idx] = {
            text: u.text.slice(maxChars),
            lines: countWrappedLines(u.text.slice(maxChars), contentW, fontPx),
          }
          used = budget
          break
        }
      }
      chunk.push(u.text)
      used += need
      idx += 1
      if (used >= budget) break
    }

    out.push({
      text: chunk.join('\n'),
      showTitle: isFirst,
      showEnd: false,
    })
    pageNo += 1
  }

  if (!out.length) {
    out.push({ text: '', showTitle: true, showEnd: true })
  } else {
    // 末页尽量塞进「本章完」；空间不够则单独一页
    const last = out[out.length - 1]
    const lastLines = countWrappedLines(last.text, contentW, fontPx)
    const lastBudget = Math.floor(
      (fullH - (last.showTitle ? titleH : 0) - endH) / lineH
    )
    if (lastLines <= lastBudget) {
      last.showEnd = true
    } else {
      out.push({ text: '', showTitle: false, showEnd: true })
    }
  }

  return out
}

function getContentMetrics() {
  const navH = statusBarHeight.value + navBarHeight.value
  const stageH = Math.max(120, windowHeight.value - navH)
  const contentHeightPx = stageH - rpx2px(PAD_TOP_RPX) - rpx2px(PAD_BOTTOM_RPX)
  const contentWidthPx = windowWidth.value - rpx2px(PAD_X_RPX) * 2
  return { contentHeightPx, contentWidthPx }
}

function rebuildPages(keepRatio) {
  const m = getContentMetrics()
  const ratio =
    keepRatio && pages.value.length > 1
      ? pageIndex.value / Math.max(1, pages.value.length - 1)
      : 0
  const list = paginateChapter(chapterContent.value, chapterTitle.value, {
    fontSizeRpx: fontSize.value,
    lineHeight: lineHeight.value,
    contentWidthPx: m.contentWidthPx,
    contentHeightPx: m.contentHeightPx,
    showTitleReserve: true,
  })
  pages.value = list
  if (keepRatio && list.length > 1) {
    let i = Math.round(ratio * (list.length - 1))
    if (i < 0) i = 0
    if (i >= list.length) i = list.length - 1
    pageIndex.value = i
  } else if (pageIndex.value >= list.length) {
    pageIndex.value = Math.max(0, list.length - 1)
  }
}

function toPageView(page, chapTitle, chapIndex, pIndex, pCount, endIsBook) {
  return {
    text: (page && page.text) || '',
    title: chapTitle || '',
    showTitle: !!(page && page.showTitle),
    showEnd: !!(page && page.showEnd),
    endLabel: endIsBook ? '全书完' : '本章完',
    foot: chapIndex + ' · ' + (pIndex + 1) + '/' + pCount,
  }
}

function applyChapter(index, targetPage, withAnim, dir) {
  const data = getCachedChapter(bookId.value, index)
  if (!data) {
    uni.showToast({ title: '章节不存在', icon: 'none' })
    return false
  }

  const nextTitle = data.title || '第' + index + '章'
  const nextContent = data.content || ''
  const m = getContentMetrics()
  const nextPages = paginateChapter(nextContent, nextTitle, {
    fontSizeRpx: fontSize.value,
    lineHeight: lineHeight.value,
    contentWidthPx: m.contentWidthPx,
    contentHeightPx: m.contentHeightPx,
    showTitleReserve: true,
  })

  let p = targetPage
  if (p === 'last') p = nextPages.length - 1
  p = Number(p) || 0
  if (p < 0) p = 0
  if (p >= nextPages.length) p = nextPages.length - 1

  const endIsBook = index >= chapterCount.value
  const apply = () => {
    chapterIndex.value = Number(data.index) || index
    chapterTitle.value = nextTitle
    chapterContent.value = nextContent
    pages.value = nextPages
    pageIndex.value = p
    setNovelProgress(bookId.value, chapterIndex.value)
  }

  if (!withAnim) {
    stopFlipAnim()
    flipActive.value = false
    flipRun.value = false
    animating.value = false
    apply()
    return true
  }

  if (animating.value) return false

  const nextDir = dir === 'prev' ? 'prev' : 'next'
  turnDir.value = nextDir
  frontPage.value = toPageView(
    currentPage.value,
    chapterTitle.value,
    chapterIndex.value,
    pageIndex.value,
    pageCount.value,
    isLastChapter.value
  )
  backPage.value = toPageView(
    nextPages[p],
    nextTitle,
    Number(data.index) || index,
    p,
    nextPages.length,
    endIsBook
  )

  runFlip(apply)
  return true
}

function turnWithinChapter(nextIndex, dir) {
  if (animating.value) return
  const list = pages.value
  if (nextIndex < 0 || nextIndex >= list.length) return

  turnDir.value = dir
  frontPage.value = toPageView(
    list[pageIndex.value],
    chapterTitle.value,
    chapterIndex.value,
    pageIndex.value,
    list.length,
    isLastChapter.value
  )
  backPage.value = toPageView(
    list[nextIndex],
    chapterTitle.value,
    chapterIndex.value,
    nextIndex,
    list.length,
    isLastChapter.value
  )

  runFlip(() => {
    pageIndex.value = nextIndex
  })
}

function stopFlipAnim() {
  if (flipTimer) {
    clearTimeout(flipTimer)
    flipTimer = null
  }
}

function runFlip(applyFn) {
  animating.value = true
  flipActive.value = true
  flipRun.value = false
  stopFlipAnim()

  nextTick(() => {
    // 先落位再开 transition，避免首帧闪跳
    flipRun.value = true
    flipTimer = setTimeout(() => {
      applyFn()
      flipActive.value = false
      flipRun.value = false
      animating.value = false
      flipTimer = null
    }, FLIP_MS)
  })
}

function goPrevPage() {
  bumpChromeTimer()
  if (animating.value) return
  if (pageIndex.value > 0) {
    turnWithinChapter(pageIndex.value - 1, 'prev')
    return
  }
  if (chapterIndex.value <= 1) {
    uni.showToast({ title: '已是第一页', icon: 'none' })
    return
  }
  applyChapter(chapterIndex.value - 1, 'last', true, 'prev')
}

function goNextPage() {
  bumpChromeTimer()
  if (animating.value) return
  if (pageIndex.value < pageCount.value - 1) {
    turnWithinChapter(pageIndex.value + 1, 'next')
    return
  }
  if (chapterIndex.value >= chapterCount.value) {
    uni.showToast({ title: '已是最后一页', icon: 'none' })
    return
  }
  applyChapter(chapterIndex.value + 1, 0, true, 'next')
}

function onTouchStart(e) {
  const list = e.touches || []
  const t = list[0]
  if (!t) return
  touchX = t.clientX
  touchY = t.clientY
  lastTapX = t.clientX
  touchMoved = false
  swipeLocked = false
}

function onTouchMove(e) {
  const list = e.touches || []
  const t = list[0]
  if (!t) return
  const dx = t.clientX - touchX
  const dy = t.clientY - touchY
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) touchMoved = true
  // 横向滑动占优时锁住，避免误触滚动（虽已无 scroll）
  if (!swipeLocked && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    swipeLocked = true
  }
}

function onTouchEnd(e) {
  const list = e.changedTouches || []
  const t = list[0]
  if (!t) return
  lastTapX = t.clientX
  const dx = t.clientX - touchX
  const dy = t.clientY - touchY

  if (settingsOpen.value || tocOpen.value || animating.value) return

  if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.1) {
    touchMoved = true
    if (dx < 0) goNextPage()
    else goPrevPage()
  }
}

function onBodyTap() {
  if (touchMoved) return
  if (settingsOpen.value || tocOpen.value) return
  if (animating.value) return

  const w = windowWidth.value || 375
  const x = lastTapX || w / 2

  if (x < w * EDGE_RATIO) {
    goPrevPage()
    return
  }
  if (x > w * (1 - EDGE_RATIO)) {
    goNextPage()
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
  if (index === chapterIndex.value) {
    pageIndex.value = 0
    return
  }
  const dir = index < chapterIndex.value ? 'prev' : 'next'
  applyChapter(index, 0, true, dir)
}

function shrinkFont() {
  if (fontSize.value <= FONT_MIN) return
  fontSize.value -= FONT_STEP
  savePrefs()
  rebuildPages(true)
}

function growFont() {
  if (fontSize.value >= FONT_MAX) return
  fontSize.value += FONT_STEP
  savePrefs()
  rebuildPages(true)
}

function setLineHeight(id) {
  lineHeightId.value = id
  savePrefs()
  rebuildPages(true)
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
  background: var(--reader-bg, #0c0e12);
  overflow: hidden;
}

.reader-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
  touch-action: none;
}

.page-sheet {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 28rpx 40rpx 72rpx;
  box-sizing: border-box;
  background: var(--reader-bg, #0c0e12);
  overflow: hidden;
}

.flip-stage {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  overflow: hidden;
}

.flip-back,
.flip-front {
  transition: none;
  will-change: transform;
}

.flip-back {
  z-index: 1;
}

.flip-front {
  z-index: 2;
  box-shadow: 0 0 0 transparent;
}

/* 下一页：当前页左滑出，新页从右侧跟入 */
.flip-stage.dir-next .flip-back {
  transform: translate3d(100%, 0, 0);
}

.flip-stage.dir-next.is-run .flip-back {
  transition: transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: translate3d(0, 0, 0);
}

.flip-stage.dir-next.is-run .flip-front {
  transition:
    transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.34s ease;
  transform: translate3d(-104%, 0, 0);
  box-shadow: 12rpx 0 40rpx rgba(0, 0, 0, 0.28);
}

/* 上一页：当前页右滑出，新页从左侧跟入 */
.flip-stage.dir-prev .flip-back {
  transform: translate3d(-100%, 0, 0);
}

.flip-stage.dir-prev.is-run .flip-back {
  transition: transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: translate3d(0, 0, 0);
}

.flip-stage.dir-prev.is-run .flip-front {
  transition:
    transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.34s ease;
  transform: translate3d(104%, 0, 0);
  box-shadow: -12rpx 0 40rpx rgba(0, 0, 0, 0.28);
}

.edge-hint {
  position: absolute;
  top: 18%;
  bottom: 18%;
  width: 8rpx;
  border-radius: 999rpx;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
  z-index: 5;
}

.edge-hint.show {
  opacity: 0.35;
}

.edge-hint--left {
  left: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.35), transparent);
}

.edge-hint--right {
  right: 0;
  background: linear-gradient(270deg, rgba(255, 255, 255, 0.35), transparent);
}

.theme-paper .edge-hint--left,
.theme-mint .edge-hint--left,
.theme-sky .edge-hint--left {
  background: linear-gradient(90deg, rgba(15, 45, 74, 0.18), transparent);
}

.theme-paper .edge-hint--right,
.theme-mint .edge-hint--right,
.theme-sky .edge-hint--right {
  background: linear-gradient(270deg, rgba(15, 45, 74, 0.18), transparent);
}

.in-chap-title {
  display: block;
  font-size: 26rpx;
  color: var(--reader-muted, #7a8290);
  letter-spacing: 2rpx;
  margin-bottom: 28rpx;
  opacity: 0.9;
}

.reader-body {
  display: block;
  font-size: var(--reader-font, 32rpx);
  line-height: var(--reader-lh, 1.9);
  color: var(--reader-text, #d2d6de);
  letter-spacing: 1rpx;
  white-space: pre-wrap;
  word-break: break-word;
}

.chap-end {
  margin-top: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.chap-end-line {
  width: 80rpx;
  height: 2rpx;
  background: var(--reader-muted, #7a8290);
  opacity: 0.35;
}

.chap-end-text {
  font-size: 24rpx;
  color: var(--reader-muted, #7a8290);
  letter-spacing: 4rpx;
}

.page-foot {
  position: absolute;
  left: 40rpx;
  right: 40rpx;
  bottom: 20rpx;
  display: flex;
  justify-content: center;
}

.page-foot-text {
  font-size: 20rpx;
  color: var(--reader-muted, #7a8290);
  opacity: 0.7;
  letter-spacing: 1rpx;
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
  border-left: 3rpx solid var(--reader-text, #d2d6de);
  border-bottom: 3rpx solid var(--reader-text, #d2d6de);
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
  background: rgba(18, 20, 26, 0.94);
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
  color: var(--reader-muted, #7a8290);
  margin-bottom: 6rpx;
}

.chrome-chap {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--reader-text, #d2d6de);
  margin-bottom: 4rpx;
}

.chrome-meta {
  display: block;
  font-size: 20rpx;
  color: var(--reader-muted, #7a8290);
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
  color: var(--reader-text, #d2d6de);
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
  background: #1a1d24;
}

.sheet.show {
  transform: translateY(0);
  pointer-events: auto;
}

.sheet-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--reader-text, #d2d6de);
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
  color: var(--reader-muted, #7a8290);
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
  color: var(--reader-text, #d2d6de);
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
  color: var(--reader-text, #d2d6de);
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
  color: var(--reader-text, #d2d6de);
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
  color: var(--reader-muted, #7a8290);
  padding-top: 4rpx;
}

.toc-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--reader-text, #d2d6de);
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
