<template>
  <view v-if="show" class="recipe-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <view class="head-main">
          <text class="panel-title">灵食图谱</text>
          <text v-if="feeds.length" class="panel-sub">累计 {{ feeds.length }} 份 · {{ totalChars }} 字</text>
        </view>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <scroll-view scroll-y class="panel-body" :show-scrollbar="false">
        <view v-if="!feeds.length && !loading" class="empty">
          <view class="empty-bowl">
            <view class="empty-bowl-body" />
            <view class="empty-bowl-base" />
          </view>
          <text class="empty-text">还没有喂过它，先去投一份灵食吧</text>
        </view>

        <view
          v-for="(item, i) in feeds"
          :key="item._id"
          class="feed-item"
          :class="{ open: openId === item._id }"
        >
          <view class="item-row" @tap="toggle(item)">
            <view class="tier-dot" :class="'tier--' + tierOf(item)">
              <view class="tier-core" />
            </view>
            <view class="item-main">
              <text class="item-title">{{ item.title || '未命名食粮' }}</text>
              <text class="item-meta">{{ timeText(item.fedAt) }} · {{ item.chars || 0 }} 字 · +{{ item.exp || 0 }} 灵气</text>
            </view>
            <view class="item-arrow" :class="{ open: openId === item._id }">
              <view class="arrow-chev" />
            </view>
          </view>
          <view v-if="openId === item._id" class="item-detail">
            <text class="detail-text" user-select>{{ item.summary || '（无摘要）' }}</text>
            <view class="detail-actions">
              <text class="detail-del" @tap.stop="remove(item, i)">移除记录</text>
            </view>
          </view>
        </view>
        <view class="tail-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { listFeeds, removeFeed } from '@/api/aiTwin'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

const feeds = ref([])
const loading = ref(false)
const openId = ref('')

const totalChars = computed(() => {
  let n = 0
  for (let i = 0; i < feeds.value.length; i++) n += feeds.value[i].chars || 0
  return n
})

watch(
  () => props.show,
  (open) => {
    if (open) {
      openId.value = ''
      reload()
    }
  }
)

function close() {
  emit('close')
}

async function reload() {
  loading.value = true
  try {
    const list = await listFeeds()
    feeds.value = list || []
  } catch (err) {
    console.error('加载食谱失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function tierOf(item) {
  const exp = (item && item.exp) || 0
  if (exp <= 40) return 'fruit'
  if (exp <= 120) return 'meal'
  return 'feast'
}

function toggle(item) {
  openId.value = openId.value === item._id ? '' : item._id
}

function timeText(at) {
  const d = new Date(Number(at) || 0)
  if (!d.getTime()) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return d.getMonth() + 1 + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

async function remove(item, i) {
  try {
    await removeFeed(item._id)
    feeds.value.splice(i, 1)
    if (openId.value === item._id) openId.value = ''
    uni.showToast({ title: '已移除', icon: 'none' })
  } catch (err) {
    console.error('移除记录失败', err)
    uni.showToast({ title: '移除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.recipe-sheet {
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
  height: 74vh;
  max-height: 74vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #201a2e 0%, #161221 100%);
  border-radius: 32rpx 32rpx 0 0;
  border-top: 2rpx solid rgba(232, 200, 120, 0.28);
  box-shadow: 0 -12rpx 48rpx rgba(0, 0, 0, 0.5);
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
  padding: 8rpx 36rpx 18rpx;
  flex-shrink: 0;
}

.head-main {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  min-width: 0;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 700;
  color: rgba(255, 248, 235, 0.95);
  letter-spacing: 2rpx;
}

.panel-sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.38);
}

.panel-close {
  font-size: 26rpx;
  color: rgba(232, 200, 120, 0.8);
  padding: 8rpx 4rpx;
}

.panel-body {
  flex: 1;
  min-height: 0;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
  gap: 24rpx;
}

.empty-bowl {
  position: relative;
  width: 100rpx;
  height: 84rpx;
}

.empty-bowl-body {
  position: absolute;
  left: 6rpx;
  right: 6rpx;
  top: 10rpx;
  height: 48rpx;
  border-radius: 0 0 44rpx 44rpx;
  background: rgba(255, 255, 255, 0.09);
  border: 2rpx solid rgba(232, 200, 120, 0.22);
  box-sizing: border-box;
}

.empty-bowl-base {
  position: absolute;
  left: 20rpx;
  right: 20rpx;
  bottom: 0;
  height: 10rpx;
  border-radius: 999rpx;
  background: rgba(232, 200, 120, 0.16);
}

.empty-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.35);
}

.feed-item {
  margin-bottom: 14rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.045);
  border: 2rpx solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.feed-item.open {
  border-color: rgba(232, 200, 120, 0.3);
  background: rgba(232, 200, 120, 0.05);
}

.item-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 20rpx;
}

.tier-dot {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tier-dot .tier-core {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50% 50% 46% 46%;
}

.tier-dot.tier--fruit {
  background: rgba(78, 207, 138, 0.12);
}

.tier-dot.tier--fruit .tier-core {
  background: radial-gradient(circle at 34% 30%, #a8f0c0 0%, #4ecf8a 60%, #1f9e63 100%);
}

.tier-dot.tier--meal {
  background: rgba(122, 212, 255, 0.12);
}

.tier-dot.tier--meal .tier-core {
  background: radial-gradient(circle at 34% 30%, #cdeaff 0%, #7ad4ff 60%, #2b8fd9 100%);
}

.tier-dot.tier--feast {
  background: rgba(232, 200, 120, 0.14);
}

.tier-dot.tier--feast .tier-core {
  background: radial-gradient(circle at 34% 30%, #f6e3b4 0%, #e8c878 60%, #c9a227 100%);
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
  flex: 1;
}

.item-title {
  font-size: 27rpx;
  font-weight: 600;
  color: rgba(255, 248, 235, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.36);
}

.item-arrow {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.item-arrow.open {
  transform: rotate(90deg);
}

.arrow-chev {
  width: 12rpx;
  height: 12rpx;
  border-top: 3rpx solid rgba(255, 255, 255, 0.4);
  border-right: 3rpx solid rgba(255, 255, 255, 0.4);
  transform: rotate(45deg);
}

.item-detail {
  padding: 4rpx 20rpx 22rpx 90rpx;
}

.detail-text {
  display: block;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.66);
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14rpx;
}

.detail-del {
  font-size: 22rpx;
  color: rgba(255, 140, 120, 0.75);
  padding: 6rpx 12rpx;
}

.tail-pad {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
