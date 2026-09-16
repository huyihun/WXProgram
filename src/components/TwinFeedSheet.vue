<template>
  <view v-if="show" class="feed-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <text class="panel-title">投喂灵食</text>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <view class="tabs">
        <view class="tab" :class="{ on: tab === 'text' }" @tap.stop="switchTab('text')">
          <text class="tab-text">文本粘贴</text>
        </view>
        <view class="tab" :class="{ on: tab === 'file' }" @tap.stop="switchTab('file')">
          <text class="tab-text">文件 / 图片</text>
        </view>
      </view>

      <scroll-view scroll-y class="panel-body" :show-scrollbar="false">
        <!-- 文本 -->
        <view v-if="tab === 'text'" class="text-wrap">
          <textarea
            v-model="text"
            class="feed-input"
            :maxlength="20000"
            placeholder="粘贴任何想让它学会的资料…"
            placeholder-class="feed-ph"
            :auto-height="false"
            :show-confirm-bar="false"
            :disable-default-padding="true"
          />
          <view class="text-meta">
            <text class="text-count">{{ text.length }} 字</text>
            <text class="text-clear" @tap="text = ''">清空</text>
          </view>
        </view>

        <!-- 文件 -->
        <view v-else class="file-wrap">
          <view v-if="!picked" class="pick-rows">
            <view class="pick-card" hover-class="pick-card--active" @tap.stop="pickFromChat">
              <view class="pick-ico">
                <view class="ico-doc">
                  <view class="ico-doc-fold" />
                  <view class="ico-doc-line l1" />
                  <view class="ico-doc-line l2" />
                </view>
              </view>
              <view class="pick-main">
                <text class="pick-name">从聊天选取</text>
                <text class="pick-desc">PDF / Word / Excel / TXT / 图片</text>
              </view>
            </view>
            <view class="pick-card" hover-class="pick-card--active" @tap.stop="pickFromAlbum">
              <view class="pick-ico">
                <view class="ico-pic">
                  <view class="ico-pic-frame" />
                  <view class="ico-pic-mountain" />
                  <view class="ico-pic-sun" />
                </view>
              </view>
              <view class="pick-main">
                <text class="pick-name">从相册选图</text>
                <text class="pick-desc">截图、照片资料</text>
              </view>
            </view>
            <view class="pick-card" hover-class="pick-card--active" @tap.stop="pickLifeData">
              <view class="pick-ico pick-ico--life">
                <view class="ico-list">
                  <view class="ico-list-line l1" />
                  <view class="ico-list-line l2" />
                  <view class="ico-list-line l3" />
                </view>
              </view>
              <view class="pick-main">
                <text class="pick-name">生活数据</text>
                <text class="pick-desc">记事本/记账/用品/减肥/评测/自律</text>
              </view>
            </view>
          </view>

          <view v-else class="picked">
            <image
              v-if="picked.sourceType === 'image' && picked.filePath"
              class="picked-thumb"
              :src="picked.filePath"
              mode="aspectFill"
            />
            <view v-else class="picked-doc" :class="'picked-doc--' + picked.extKind">
              <view class="doc-shape" />
              <text class="doc-ext">{{ picked.extLabel }}</text>
            </view>
            <view class="picked-main">
              <text class="picked-name">{{ picked.fileName }}</text>
              <text class="picked-sub">{{ picked.sizeText }}</text>
            </view>
            <view class="picked-remove" @tap.stop="clearPicked">
              <view class="rm-x a" />
              <view class="rm-x b" />
            </view>
          </view>
        </view>

        <!-- 食物形态预览 -->
        <view class="meal-preview">
          <view class="meal-art">
            <view v-if="tier === 'fruit'" class="art-fruit">
              <view class="fruit-leaf" />
              <view class="fruit-body" />
            </view>
            <view v-else-if="tier === 'meal'" class="art-meal">
              <view class="meal-lid" />
              <view class="meal-box">
                <view class="meal-cell a" />
                <view class="meal-cell b" />
                <view class="meal-cell c" />
              </view>
            </view>
            <view v-else class="art-feast">
              <view class="feast-steam s1" />
              <view class="feast-steam s2" />
              <view class="feast-bowl" />
              <view class="feast-base" />
            </view>
          </view>
          <view class="meal-info">
            <text class="meal-tier">{{ tierLabel }}</text>
            <text class="meal-exp">{{ expText }}</text>
          </view>
        </view>

        <view class="feed-btn" :class="{ disabled: !canFeed }" hover-class="feed-btn--active" @tap.stop="confirm">
          <text class="feed-btn-text">投 喂</text>
        </view>
        <view class="tail-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { calcFeedExp } from '@/api/aiTwin'
import { collectLifeDigest } from '@/api/twinLifeFeed'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close', 'confirm'])

const tab = ref('text')
const text = ref('')
const picked = ref(null)
const lifeBusy = ref(false)
let lifeToken = 0

const TEXT_TIERS = [
  { max: 200, id: 'fruit', label: '灵果' },
  { max: 1500, id: 'meal', label: '御膳' },
  { max: Infinity, id: 'feast', label: '盛宴' },
]

const DOC_KINDS = {
  pdf: { kind: 'pdf', label: 'PDF' },
  doc: { kind: 'word', label: 'DOC' },
  docx: { kind: 'word', label: 'DOC' },
  xls: { kind: 'excel', label: 'XLS' },
  xlsx: { kind: 'excel', label: 'XLS' },
  csv: { kind: 'excel', label: 'CSV' },
  txt: { kind: 'txt', label: 'TXT' },
  md: { kind: 'txt', label: 'MD' },
}

const tier = computed(() => {
  if (tab.value === 'text') {
    const len = text.value.trim().length
    for (let i = 0; i < TEXT_TIERS.length; i++) {
      if (len < TEXT_TIERS[i].max) return TEXT_TIERS[i].id
    }
    return 'feast'
  }
  if (picked.value && picked.value.sourceType === 'image') return 'meal'
  return 'feast'
})

const tierLabel = computed(() => {
  if (tier.value === 'fruit') return '灵果 · 轻食'
  if (tier.value === 'meal') return '御膳 · 正餐'
  return '盛宴 · 大补'
})

const expText = computed(() => {
  if (tab.value === 'text') {
    return '预计灵气 +' + calcFeedExp(text.value.trim().length)
  }
  if (picked.value && picked.value.sourceType === 'life') return '预计灵气 +200'
  if (picked.value && picked.value.sourceType === 'image') return '预计灵气 +20~120'
  return '预计灵气 +20~200 视消化'
})

const canFeed = computed(() => {
  if (tab.value === 'text') return text.value.trim().length >= 10
  return !!picked.value
})

watch(
  () => props.show,
  (open) => {
    if (!open) {
      picked.value = null
      lifeToken += 1
      lifeBusy.value = false
    }
  }
)

function close() {
  emit('close')
}

function switchTab(next) {
  tab.value = next
}

function clearPicked() {
  picked.value = null
}

function extOf(name) {
  const s = String(name || '')
  const at = s.lastIndexOf('.')
  if (at < 0) return ''
  return s.slice(at + 1).toLowerCase()
}

function sizeTextOf(bytes) {
  const n = Number(bytes) || 0
  if (n <= 0) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

function pickFromChat() {
  wx.chooseMessageFile({
    count: 1,
    type: 'all',
    success(res) {
      const f = res.tempFiles && res.tempFiles[0]
      if (!f || !f.path) return
      if (f.size && f.size > 20 * 1024 * 1024) {
        uni.showToast({ title: '文件过大（需<20MB）', icon: 'none' })
        return
      }
      const ext = extOf(f.name)
      const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].indexOf(ext) >= 0
      const known = DOC_KINDS[ext]
      picked.value = {
        sourceType: isImg ? 'image' : 'file',
        filePath: f.path,
        fileName: f.name || ('资料.' + (ext || 'dat')),
        extKind: isImg ? 'img' : (known ? known.kind : 'txt'),
        extLabel: isImg ? 'IMG' : (known ? known.label : 'DOC'),
        sizeText: sizeTextOf(f.size),
      }
    },
  })
}

function pickFromAlbum() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success(res) {
      const path = res.tempFilePaths && res.tempFilePaths[0]
      if (!path) return
      const ext = extOf(path) || 'png'
      picked.value = {
        sourceType: 'image',
        filePath: path,
        fileName: '相册图片.' + ext,
        extKind: 'img',
        extLabel: 'IMG',
        sizeText: '',
      }
    },
  })
}

/** 聚合 6 大生活模块云端数据，成功后进入已选状态 */
function pickLifeData() {
  if (lifeBusy.value) return
  const token = ++lifeToken
  lifeBusy.value = true
  uni.showLoading({ title: '收集中', mask: true })
  collectLifeDigest()
    .then(function (res) {
      if (token !== lifeToken) return
      picked.value = {
        sourceType: 'life',
        text: res.text,
        filePath: '',
        fileName: '生活数据',
        extKind: 'life',
        extLabel: 'DATA',
        sizeText: res.statsText,
      }
    })
    .catch(function (err) {
      console.error('生活数据收集失败', err)
      if (token !== lifeToken) return
      const msg = (err && err.message) || '收集失败'
      uni.showToast({ title: String(msg).slice(0, 30), icon: 'none' })
    })
    .then(function () {
      if (token !== lifeToken) return
      lifeBusy.value = false
      uni.hideLoading()
    })
}

function confirm() {
  if (!canFeed.value) {
    if (tab.value === 'text') uni.showToast({ title: '再写点什么吧', icon: 'none' })
    return
  }
  if (tab.value === 'text') {
    emit('confirm', {
      sourceType: 'text',
      text: text.value.trim(),
      tier: tier.value,
    })
    text.value = ''
    return
  }
  const p = picked.value
  const payload = {
    sourceType: p.sourceType,
    filePath: p.filePath,
    fileName: p.fileName,
    tier: tier.value,
  }
  if (p.sourceType === 'life') {
    payload.text = p.text
  }
  emit('confirm', payload)
  picked.value = null
}
</script>

<style lang="scss" scoped>
.feed-sheet {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 200;
}

.mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(8, 6, 14, 0.6);
}

.panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #201a2e 0%, #161221 100%);
  border-radius: 32rpx 32rpx 0 0;
  border-top: 2rpx solid rgba(232, 200, 120, 0.28);
  box-shadow: 0 -12rpx 48rpx rgba(0, 0, 0, 0.5);
  overflow: hidden;
  box-sizing: border-box;
}

.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  margin: 16rpx auto 8rpx;
  flex-shrink: 0;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8rpx 36rpx 16rpx;
  flex-shrink: 0;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 700;
  color: rgba(255, 248, 235, 0.95);
  letter-spacing: 2rpx;
}

.panel-close {
  font-size: 26rpx;
  color: rgba(232, 200, 120, 0.8);
  padding: 8rpx 4rpx;
}

.tabs {
  display: flex;
  gap: 12rpx;
  padding: 0 36rpx 16rpx;
  flex-shrink: 0;
}

.tab {
  flex: 1;
  padding: 14rpx 0;
  border-radius: 14rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.08);
}

.tab.on {
  background: rgba(232, 200, 120, 0.12);
  border-color: rgba(232, 200, 120, 0.5);
}

.tab-text {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
}

.tab.on .tab-text {
  color: #e8c878;
}

.panel-body {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.text-wrap {
  margin-top: 4rpx;
}

.feed-input {
  width: 100%;
  height: 280rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 248, 235, 0.92);
  font-size: 27rpx;
  line-height: 1.6;
  box-sizing: border-box;
}

.feed-ph {
  color: rgba(255, 255, 255, 0.28);
}

.text-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 10rpx;
}

.text-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.35);
}

.text-clear {
  font-size: 22rpx;
  color: rgba(232, 200, 120, 0.7);
}

.pick-rows {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 4rpx;
}

.pick-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 24rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.08);
}

.pick-card--active {
  background: rgba(232, 200, 120, 0.08);
}

.pick-ico {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: linear-gradient(145deg, rgba(122, 212, 255, 0.25), rgba(43, 127, 212, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pick-ico--life {
  background: linear-gradient(145deg, rgba(88, 183, 255, 0.28), rgba(154, 123, 255, 0.28));
}

.ico-list {
  position: relative;
  width: 36rpx;
  height: 34rpx;
}

.ico-list-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 5rpx;
  border-radius: 3rpx;
  background: rgba(255, 255, 255, 0.92);
}

.ico-list-line.l1 {
  top: 2rpx;
  right: 10rpx;
}

.ico-list-line.l2 {
  top: 15rpx;
}

.ico-list-line.l3 {
  top: 28rpx;
  right: 16rpx;
}

.ico-doc {
  position: relative;
  width: 36rpx;
  height: 44rpx;
}

.ico-doc-fold {
  position: absolute;
  inset: 0;
  border-radius: 6rpx;
  background: rgba(255, 255, 255, 0.92);
}

.ico-doc-line {
  position: absolute;
  left: 8rpx;
  right: 8rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: rgba(43, 127, 212, 0.5);
}

.ico-doc-line.l1 {
  top: 12rpx;
}

.ico-doc-line.l2 {
  top: 24rpx;
  right: 14rpx;
}

.ico-pic {
  position: relative;
  width: 44rpx;
  height: 40rpx;
}

.ico-pic-frame {
  position: absolute;
  inset: 0;
  border-radius: 6rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.92);
  box-sizing: border-box;
}

.ico-pic-mountain {
  position: absolute;
  left: 7rpx;
  bottom: 5rpx;
  width: 0;
  height: 0;
  border-left: 10rpx solid transparent;
  border-right: 10rpx solid transparent;
  border-bottom: 12rpx solid rgba(255, 255, 255, 0.85);
}

.ico-pic-sun {
  position: absolute;
  right: 8rpx;
  top: 7rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}

.pick-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.pick-name {
  font-size: 29rpx;
  font-weight: 600;
  color: rgba(255, 248, 235, 0.92);
}

.pick-desc {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
}

.picked {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 4rpx;
  padding: 22rpx 20rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(232, 200, 120, 0.25);
}

.picked-thumb {
  width: 88rpx;
  height: 88rpx;
  border-radius: 14rpx;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
}

.picked-doc {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.06);
}

.doc-shape {
  position: absolute;
  left: 22rpx;
  top: 14rpx;
  width: 44rpx;
  height: 54rpx;
  border-radius: 8rpx;
  opacity: 0.35;
}

.picked-doc--pdf .doc-shape {
  background: #d05548;
}

.picked-doc--word .doc-shape {
  background: #4a79c9;
}

.picked-doc--excel .doc-shape {
  background: #3f9e63;
}

.picked-doc--txt .doc-shape {
  background: #8a93a3;
}

.picked-doc--img .doc-shape {
  background: #b98ad0;
}

.picked-doc--life .doc-shape {
  background: #58b7ff;
}

.doc-ext {
  position: relative;
  z-index: 1;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.5);
}

.picked-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
  flex: 1;
}

.picked-name {
  font-size: 27rpx;
  font-weight: 600;
  color: rgba(255, 248, 235, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picked-sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
}

.picked-remove {
  position: relative;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.rm-x {
  position: absolute;
  left: 14rpx;
  top: 23rpx;
  width: 20rpx;
  height: 3rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.7);
}

.rm-x.a {
  transform: rotate(45deg);
}

.rm-x.b {
  transform: rotate(-45deg);
}

/* 食物形态预览 */
.meal-preview {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 2rpx solid rgba(255, 255, 255, 0.07);
}

.meal-art {
  width: 110rpx;
  height: 110rpx;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;
}

/* 灵果：发光圆果 */
.art-fruit {
  position: relative;
  width: 80rpx;
  height: 88rpx;
}

.fruit-body {
  position: absolute;
  left: 8rpx;
  bottom: 0;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50% 50% 46% 46%;
  background: radial-gradient(circle at 34% 30%, #a8f0c0 0%, #4ecf8a 55%, #1f9e63 100%);
  box-shadow: 0 0 24rpx rgba(78, 207, 138, 0.5);
}

.fruit-leaf {
  position: absolute;
  right: 10rpx;
  top: 0;
  width: 26rpx;
  height: 16rpx;
  border-radius: 0 16rpx 2rpx 14rpx;
  background: #79d493;
  transform: rotate(24deg);
}

/* 御膳：双层便当 */
.art-meal {
  position: relative;
  width: 96rpx;
  height: 84rpx;
}

.meal-lid {
  position: absolute;
  left: 4rpx;
  top: 0;
  right: 4rpx;
  height: 20rpx;
  border-radius: 10rpx 10rpx 4rpx 4rpx;
  background: linear-gradient(180deg, #f3d9a4 0%, #cfa15c 100%);
}

.meal-box {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 54rpx;
  border-radius: 8rpx;
  background: #241d33;
  border: 3rpx solid rgba(232, 200, 120, 0.7);
  box-sizing: border-box;
  display: flex;
  padding: 6rpx;
  gap: 6rpx;
}

.meal-cell {
  flex: 1;
  border-radius: 6rpx;
}

.meal-cell.a {
  background: #e88f6a;
}

.meal-cell.b {
  background: #7ad4ff;
}

.meal-cell.c {
  background: #e8c878;
}

/* 盛宴：蒸腾宝碗 */
.art-feast {
  position: relative;
  width: 100rpx;
  height: 100rpx;
}

.feast-bowl {
  position: absolute;
  left: 8rpx;
  right: 8rpx;
  bottom: 16rpx;
  height: 44rpx;
  border-radius: 0 0 40rpx 40rpx;
  background: linear-gradient(180deg, #f6e3b4 0%, #d4a017 100%);
  box-shadow: 0 0 26rpx rgba(232, 200, 120, 0.55);
}

.feast-base {
  position: absolute;
  left: 20rpx;
  right: 20rpx;
  bottom: 6rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: rgba(232, 200, 120, 0.4);
}

.feast-steam {
  position: absolute;
  width: 8rpx;
  height: 26rpx;
  border-radius: 999rpx;
  background: rgba(255, 244, 214, 0.65);
  animation: feastSteam 1.8s ease-in-out infinite;
}

.feast-steam.s1 {
  left: 34rpx;
  bottom: 58rpx;
}

.feast-steam.s2 {
  right: 34rpx;
  bottom: 58rpx;
  animation-delay: 0.9s;
}

@keyframes feastSteam {
  0%,
  100% {
    transform: translateY(0) scaleY(1);
    opacity: 0.3;
  }
  50% {
    transform: translateY(-10rpx) scaleY(1.25);
    opacity: 0.85;
  }
}

.meal-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.meal-tier {
  font-size: 29rpx;
  font-weight: 700;
  color: rgba(255, 248, 235, 0.95);
  letter-spacing: 2rpx;
}

.meal-exp {
  font-size: 23rpx;
  color: rgba(232, 200, 120, 0.85);
}

.feed-btn {
  margin-top: 26rpx;
  padding: 24rpx 0;
  border-radius: 20rpx;
  text-align: center;
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
  box-shadow: 0 10rpx 28rpx rgba(201, 162, 39, 0.35);
}

.feed-btn--active {
  transform: translateY(2rpx);
  opacity: 0.92;
}

.feed-btn.disabled {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.feed-btn.disabled .feed-btn-text {
  color: rgba(255, 255, 255, 0.35);
}

.feed-btn-text {
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 8rpx;
  color: #4a3608;
}

.tail-pad {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
