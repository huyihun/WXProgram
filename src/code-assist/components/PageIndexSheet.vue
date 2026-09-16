<template>
  <view v-if="show" class="pis-wrap">
    <view class="pis-mask" @tap="emit('close')" @touchmove.stop.prevent />
    <view class="pis-panel" @touchmove.stop>
      <view class="pis-handle" />

      <!-- 源码视图 -->
      <template v-if="codeView">
        <view class="pis-header">
          <text class="pis-back" @tap="closeCodeView">返回</text>
          <text class="pis-title pis-title--path">{{ codePath }}</text>
        </view>
        <scroll-view scroll-y class="pis-scroll pis-scroll--code">
          <view v-if="codeLoading" class="pis-empty">
            <text class="pis-empty-text">加载中…</text>
          </view>
          <view v-else-if="codeError" class="pis-empty">
            <text class="pis-empty-text">{{ codeError }}</text>
          </view>
          <view v-else class="pis-code-box">
            <rich-text class="pis-code-rich" :nodes="codeHtml" />
          </view>
        </scroll-view>
      </template>

      <!-- 模块列表 -->
      <template v-else>
        <view class="pis-header">
          <text class="pis-title">文件索引</text>
          <text class="pis-close" @tap="emit('close')">关闭</text>
        </view>

        <view class="pis-search-wrap">
          <view class="pis-search">
            <input
              class="pis-search-input"
              type="text"
              confirm-type="search"
              :value="searchQuery"
              placeholder="搜模块 / 页面 / 路径"
              placeholder-class="pis-search-ph"
              @input="onSearchInput"
            />
            <view
              v-if="searchQuery"
              class="pis-search-clear"
              @tap="clearSearch"
            >
              <view class="clear-x" />
            </view>
          </view>
          <text class="pis-meta">{{ metaText }}</text>
        </view>

        <scroll-view scroll-y class="pis-scroll">
          <view v-if="!modules.length" class="pis-empty">
            <text class="pis-empty-text">暂无索引，请本机执行 npm run code-assist:publish</text>
          </view>
          <view v-else-if="hasQuery && !filteredModules.length" class="pis-empty">
            <text class="pis-empty-text">未找到相关文件</text>
          </view>
          <view
            v-for="(item, i) in filteredModules"
            :key="'pi-' + (item.root || i)"
            class="pis-mod"
          >
            <view class="pis-row" hover-class="pis-row--active" @tap="toggleExpand(item)">
              <text class="pis-arrow">{{ isExpanded(item.root) ? '▼' : '▶' }}</text>
              <text class="pis-root">{{ item.root }}</text>
              <text class="pis-sep">·</text>
              <text class="pis-name">{{ item.name || '—' }}</text>
              <text class="pis-sep">·</text>
              <text class="pis-id">{{ item.id || '—' }}</text>
              <text class="pis-at" @tap.stop="onPickAt(item)">引用@</text>
            </view>
            <view v-if="isExpanded(item.root)" class="pis-pages">
              <view
                v-if="!(item.displayPages && item.displayPages.length)"
                class="pis-page-empty"
              >
                <text class="pis-empty-text">暂无页面（请重新 publish）</text>
              </view>
              <view
                v-for="(pg, pi) in item.displayPages"
                :key="'pg-' + i + '-' + pi"
                class="pis-page"
              >
                <view
                  class="pis-page-main"
                  hover-class="pis-row--active"
                  @tap="openPageCode(pg)"
                >
                  <text class="pis-page-title">{{ pg.title || pg.path }}</text>
                  <text class="pis-page-path">{{ pg.path }}</text>
                </view>
                <text
                  class="pis-at pis-at--file"
                  @tap.stop="onPickFile(pg)"
                >引用@</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { getCodeAssistFile } from '@/code-assist/api'
import { highlightCode } from '@/code-assist/codeHighlight'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  modules: {
    type: Array,
    default: function () {
      return []
    },
  },
  projectId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'pick', 'pick-file'])

const expandedRoot = ref('')
/** 搜索态：默认全展开；值为 false 表示用户收起 */
const collapsedInSearch = ref({})
const searchQuery = ref('')
const codeView = ref(false)
const codeLoading = ref(false)
const codeError = ref('')
const codePath = ref('')
const codeHtml = ref('')

const hasQuery = computed(function () {
  return !!(searchQuery.value && String(searchQuery.value).trim())
})

const filteredModules = computed(function () {
  const list = props.modules || []
  const q = String(searchQuery.value || '').trim()
  if (!q) {
    const out = []
    for (let i = 0; i < list.length; i++) {
      const m = list[i]
      out.push({
        root: m.root,
        name: m.name,
        id: m.id,
        pages: m.pages,
        displayPages: m.pages || [],
        _score: 0,
      })
    }
    return out
  }
  const terms = splitTerms(q)
  const hit = []
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    const modScore = scoreFields(terms, [m.root, m.name, m.id])
    const pages = m.pages || []
    const matchedPages = []
    let pageBest = 0
    for (let j = 0; j < pages.length; j++) {
      const pg = pages[j]
      const ps = scoreFields(terms, [pg.title, pg.path, pg.file])
      if (ps > 0) {
        matchedPages.push(pg)
        if (ps > pageBest) pageBest = ps
      }
    }
    const score = modScore > pageBest ? modScore : pageBest
    if (score <= 0) continue
    hit.push({
      root: m.root,
      name: m.name,
      id: m.id,
      pages: m.pages,
      displayPages: modScore > 0 ? pages : matchedPages,
      _score: score,
    })
  }
  hit.sort(function (a, b) {
    return b._score - a._score
  })
  return hit
})

const metaText = computed(function () {
  const mods = filteredModules.value
  if (!hasQuery.value) {
    return (props.modules || []).length + ' 个模块'
  }
  let pageCount = 0
  for (let i = 0; i < mods.length; i++) {
    const pages = mods[i].displayPages || []
    pageCount += pages.length
  }
  return mods.length + ' 个模块 · ' + pageCount + ' 个页面'
})

watch(
  function () {
    return props.show
  },
  function (v) {
    if (!v) {
      expandedRoot.value = ''
      collapsedInSearch.value = {}
      searchQuery.value = ''
      closeCodeView()
    }
  }
)

watch(searchQuery, function () {
  collapsedInSearch.value = {}
})

function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
}

function splitTerms(q) {
  const parts = String(q).trim().toLowerCase().split(/\s+/)
  const out = []
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) out.push(parts[i])
  }
  return out.length ? out : [String(q).trim().toLowerCase()]
}

/** 子序列：term 字符按序出现在 hay 中 */
function isSubseq(hay, term) {
  if (!term) return true
  if (!hay) return false
  let ti = 0
  for (let i = 0; i < hay.length && ti < term.length; i++) {
    if (hay.charAt(i) === term.charAt(ti)) ti++
  }
  return ti === term.length
}

/**
 * 单字段打分：完整子串 > 路径段/词首 > 纯子序列；未命中 0
 */
function scoreOne(hayRaw, term) {
  const hay = norm(hayRaw)
  if (!term || !hay) return 0
  const idx = hay.indexOf(term)
  if (idx >= 0) {
    if (idx === 0) return 100
    const prev = hay.charAt(idx - 1)
    if (prev === '/' || prev === '_' || prev === '-' || prev === '.') return 90
    return 80
  }
  if (isSubseq(hay, term)) return 40
  return 0
}

/** 多词：每个词在任一字段上有分，取各词最高分之和 */
function scoreFields(terms, fields) {
  let total = 0
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t]
    let best = 0
    for (let f = 0; f < fields.length; f++) {
      const s = scoreOne(fields[f], term)
      if (s > best) best = s
    }
    if (best <= 0) return 0
    total += best
  }
  return total
}

function onSearchInput(e) {
  searchQuery.value = (e && e.detail && e.detail.value) || ''
}

function clearSearch() {
  searchQuery.value = ''
}

function isExpanded(root) {
  if (!root) return false
  if (hasQuery.value) {
    return collapsedInSearch.value[root] !== false
  }
  return expandedRoot.value === root
}

function toggleExpand(item) {
  if (!item || !item.root) return
  if (hasQuery.value) {
    const next = Object.assign({}, collapsedInSearch.value)
    if (next[item.root] === false) {
      delete next[item.root]
    } else {
      next[item.root] = false
    }
    collapsedInSearch.value = next
    return
  }
  if (expandedRoot.value === item.root) {
    expandedRoot.value = ''
    return
  }
  expandedRoot.value = item.root
}

function onPickAt(item) {
  if (!item || !item.root) return
  emit('pick', item.root)
}

function onPickFile(pg) {
  if (!pg || !pg.file) {
    uni.showToast({ title: '无文件路径', icon: 'none' })
    return
  }
  emit('pick-file', pg.file)
}

function closeCodeView() {
  codeView.value = false
  codeLoading.value = false
  codeError.value = ''
  codePath.value = ''
  codeHtml.value = ''
  searchQuery.value = ''
}

async function openPageCode(pg) {
  if (!pg || !pg.file) {
    uni.showToast({ title: '无文件路径', icon: 'none' })
    return
  }
  if (!props.projectId) {
    uni.showToast({ title: '项目未就绪', icon: 'none' })
    return
  }
  searchQuery.value = ''
  codeView.value = true
  codeLoading.value = true
  codeError.value = ''
  codePath.value = pg.file
  codeHtml.value = ''
  try {
    const res = await getCodeAssistFile(props.projectId, pg.file)
    codePath.value = res.path || pg.file
    var content = res.content || ''
    if (res.truncated) {
      content += '\n\n/* 已截断显示 */'
    }
    codeHtml.value = highlightCode(content, codePath.value)
  } catch (e) {
    codeError.value = (e && e.message) || '读取失败'
  } finally {
    codeLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.pis-wrap {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 500;
}

.pis-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.55);
}

.pis-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 85vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
  border-radius: 24rpx 24rpx 0 0;
  border: 1rpx solid rgba(56, 189, 248, 0.25);
  border-bottom: none;
  box-sizing: border-box;
  overflow: hidden;
}

.pis-handle {
  width: 64rpx;
  height: 8rpx;
  margin: 16rpx auto 0;
  border-radius: 4rpx;
  background: rgba(148, 163, 184, 0.45);
  flex-shrink: 0;
}

.pis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 32rpx 16rpx;
  flex-shrink: 0;
}

.pis-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #f0f9ff;
  flex: 1;
  min-width: 0;
}

.pis-title--path {
  font-size: 22rpx;
  font-weight: 500;
  color: #94a3b8;
  word-break: break-all;
}

.pis-close,
.pis-back {
  font-size: 26rpx;
  color: #7dd3fc;
  flex-shrink: 0;
}

.pis-search-wrap {
  flex-shrink: 0;
  padding: 0 24rpx 12rpx;
  box-sizing: border-box;
}

.pis-search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  background: rgba(51, 65, 85, 0.65);
  border: 1rpx solid rgba(56, 189, 248, 0.18);
  box-sizing: border-box;
}

.pis-search-input {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #e2e8f0;
  height: 44rpx;
  line-height: 44rpx;
}

.pis-search-ph {
  color: #64748b;
  font-size: 26rpx;
}

.pis-search-clear {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(14, 116, 144, 0.28);
  border: 1rpx solid rgba(56, 189, 248, 0.35);
  box-sizing: border-box;
}

.clear-x {
  width: 18rpx;
  height: 18rpx;
  position: relative;
  flex-shrink: 0;
}

.clear-x::before,
.clear-x::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16rpx;
  height: 2rpx;
  margin-left: -8rpx;
  margin-top: -1rpx;
  background: #7dd3fc;
  border-radius: 1rpx;
}

.clear-x::before {
  transform: rotate(45deg);
}

.clear-x::after {
  transform: rotate(-45deg);
}

.pis-meta {
  display: block;
  margin-top: 10rpx;
  padding-left: 4rpx;
  font-size: 22rpx;
  color: #94a3b8;
}

.pis-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.pis-scroll--code {
  padding: 0 16rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.pis-empty {
  padding: 48rpx 16rpx;
  text-align: center;
}

.pis-empty-text {
  font-size: 26rpx;
  color: #94a3b8;
  line-height: 1.55;
}

.pis-mod {
  margin-bottom: 8rpx;
}

.pis-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 20rpx 16rpx;
  border-radius: 12rpx;
  background: rgba(51, 65, 85, 0.65);
  border: 1rpx solid rgba(56, 189, 248, 0.18);
  box-sizing: border-box;
}

.pis-row--active {
  opacity: 0.85;
}

.pis-arrow {
  font-size: 18rpx;
  color: #64748b;
  width: 24rpx;
  flex-shrink: 0;
}

.pis-root {
  font-size: 24rpx;
  color: #7dd3fc;
  font-weight: 600;
  word-break: break-all;
}

.pis-name {
  font-size: 24rpx;
  color: #e2e8f0;
}

.pis-id {
  font-size: 22rpx;
  color: #94a3b8;
}

.pis-sep {
  font-size: 22rpx;
  color: #64748b;
}

.pis-at {
  margin-left: auto;
  font-size: 22rpx;
  color: #38bdf8;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.35);
  background: rgba(14, 116, 144, 0.25);
  flex-shrink: 0;
}

.pis-at--file {
  margin-left: 12rpx;
  align-self: center;
}

.pis-pages {
  padding: 8rpx 0 8rpx 32rpx;
}

.pis-page-empty {
  padding: 16rpx 8rpx;
}

.pis-page {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 12rpx 12rpx 16rpx;
  margin-bottom: 6rpx;
  border-radius: 10rpx;
  background: rgba(30, 41, 59, 0.72);
  border: 1rpx solid rgba(56, 189, 248, 0.12);
  box-sizing: border-box;
}

.pis-page-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.pis-page-title {
  font-size: 26rpx;
  color: #e2e8f0;
}

.pis-page-path {
  font-size: 22rpx;
  color: #64748b;
  word-break: break-all;
}

.pis-code-box {
  margin: 8rpx 0 24rpx;
  padding: 20rpx 16rpx;
  border-radius: 12rpx;
  background: rgba(15, 23, 42, 0.92);
  border: 1rpx solid rgba(56, 189, 248, 0.15);
  box-sizing: border-box;
}

.pis-code-rich {
  width: 100%;
}
</style>
