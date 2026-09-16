<template>
  <view v-if="show" class="memory-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <text class="panel-title">记忆管理</text>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <view class="tool-row">
        <text class="tool-tip">共 {{ memories.length }} 条</text>
        <view
          class="tidy-btn"
          :class="{ disabled: tidying }"
          hover-class="tidy-btn--active"
          @tap.stop="tidyMemories"
        >
          <text class="tidy-btn-text">{{ tidying ? '整理中…' : '整理旧记忆' }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="panel-body" :show-scrollbar="false">
        <view v-if="!memories.length" class="empty">
          <text class="empty-text">还没有记忆，先去投喂或完善资料吧</text>
        </view>
        <view v-for="(m, i) in memories" :key="m._id || i" class="mem-row">
          <view class="mem-main">
            <text class="mem-text" user-select>{{ m.text }}</text>
            <text class="mem-date">{{ dateOf(m) }}{{ tagOf(m) }}</text>
          </view>
          <view class="mem-del" hover-class="mem-del--active" @tap.stop="removeOne(m)">
            <view class="del-x a" />
            <view class="del-x b" />
          </view>
        </view>
        <view class="tail-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { addMemory, digestTwinMaterial, listMemories, removeMemory } from '@/api/aiTwin'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

/** 整理时保留最近多少条普通记忆不参与合并 */
const KEEP_RECENT = 10
/** 参与合并的旧记忆至少多少条才值得整理 */
const MIN_TIDY = 6

const memories = ref([])
const tidying = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) reload()
  }
)

function close() {
  emit('close')
}

async function reload() {
  try {
    memories.value = (await listMemories()) || []
  } catch (err) {
    console.warn('记忆加载失败', err)
  }
}

function dateOf(m) {
  const ts = Number(m.createdAt) || 0
  if (!ts) return ''
  const d = new Date(ts)
  const pad = function (n) {
    return String(n).padStart(2, '0')
  }
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate())
}

function tagOf(m) {
  if (m.tag === 'profile') return ' · 资料'
  if (m.tag === 'life') return ' · 生活数据'
  return ''
}

function removeOne(m) {
  if (!m || !m._id) return
  uni.showModal({
    title: '删除这条记忆？',
    content: String(m.text || '').slice(0, 60),
    success(res) {
      if (!res.confirm) return
      removeMemory(m._id)
        .then(function () {
          memories.value = memories.value.filter(function (x) {
            return x._id !== m._id
          })
          uni.showToast({ title: '已删除', icon: 'none' })
        })
        .catch(function (err) {
          console.error('记忆删除失败', err)
          uni.showToast({ title: '删除失败', icon: 'none' })
        })
    },
  })
}

/** 非 profile 的旧记忆：最近 KEEP_RECENT 条保留，其余可合并 */
function tidyCandidates() {
  const normals = []
  for (let i = 0; i < memories.value.length; i++) {
    const m = memories.value[i]
    if (m && m.tag !== 'profile') normals.push(m)
  }
  return normals.slice(KEEP_RECENT)
}

function tidyMemories() {
  if (tidying.value) return
  const olds = tidyCandidates()
  if (olds.length < MIN_TIDY) {
    uni.showToast({ title: '旧记忆不多，暂不用整理', icon: 'none' })
    return
  }
  uni.showModal({
    title: '整理旧记忆？',
    content:
      '保留最近 ' + KEEP_RECENT + ' 条，其余 ' + olds.length + ' 条将由 AI 合并成一条精华记忆，' +
      '原条目删除且不可恢复。',
    success(res) {
      if (res.confirm) runTidy(olds)
    },
  })
}

async function runTidy(olds) {
  tidying.value = true
  try {
    const lines = []
    for (let i = 0; i < olds.length; i++) {
      lines.push(i + 1 + '. ' + olds[i].text)
    }
    const material =
      '以下是数字分身的旧记忆清单，把它们整理合并成一条不超过 250 字的精华记忆：' +
      '保留人物、数字、日期、约定等硬信息，删除过时与重复内容，直接输出合并后的记忆本身。\n' +
      lines.join('\n')
    const digest = await digestTwinMaterial({ text: material })
    const summary = String(digest.summary || '').trim()
    if (!summary) throw new Error('没能整理出结果')
    const mem = await addMemory(summary)
    const removedMap = {}
    for (let i = 0; i < olds.length; i++) {
      removedMap[olds[i]._id] = true
      try {
        await removeMemory(olds[i]._id)
      } catch (e) {
        console.warn('旧记忆删除失败', e)
      }
    }
    memories.value = memories.value.filter(function (x) {
      return !removedMap[x._id]
    })
    memories.value.unshift(mem)
    uni.showToast({ title: '已合并 ' + olds.length + ' 条', icon: 'none' })
  } catch (err) {
    console.error('记忆整理失败', err)
    const msg = (err && err.message) || '整理失败'
    uni.showToast({ title: String(msg).slice(0, 30), icon: 'none' })
  } finally {
    tidying.value = false
  }
}
</script>

<style lang="scss" scoped>
.memory-sheet {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 220;
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
  padding: 8rpx 36rpx 12rpx;
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

.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 36rpx 16rpx;
  flex-shrink: 0;
}

.tool-tip {
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.4);
}

.tidy-btn {
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(232, 200, 120, 0.5);
  background: rgba(232, 200, 120, 0.1);
}

.tidy-btn--active {
  background: rgba(232, 200, 120, 0.2);
}

.tidy-btn.disabled {
  opacity: 0.5;
}

.tidy-btn-text {
  font-size: 23rpx;
  font-weight: 600;
  color: rgba(232, 200, 120, 0.9);
}

.panel-body {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.empty {
  padding: 80rpx 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.4);
}

.mem-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 20rpx 20rpx;
  margin-bottom: 14rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 2rpx solid rgba(255, 255, 255, 0.06);
}

.mem-main {
  flex: 1;
  min-width: 0;
}

.mem-text {
  display: block;
  font-size: 25rpx;
  color: rgba(255, 248, 235, 0.88);
  line-height: 1.6;
  word-break: break-all;
}

.mem-date {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.32);
}

.mem-del {
  position: relative;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.mem-del--active {
  background: rgba(255, 255, 255, 0.15);
}

.del-x {
  position: absolute;
  left: 12rpx;
  top: 21rpx;
  width: 20rpx;
  height: 3rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.6);
}

.del-x.a {
  transform: rotate(45deg);
}

.del-x.b {
  transform: rotate(-45deg);
}

.tail-pad {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
