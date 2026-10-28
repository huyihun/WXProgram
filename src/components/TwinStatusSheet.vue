<template>
  <view v-if="show" class="status-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <text class="panel-title">更新状态</text>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <scroll-view scroll-y class="panel-body" :show-scrollbar="false">
        <text class="panel-tip">保鲜「此刻 / 接下来」，分身才不会瞎编今晚安排。保存后立即同步时间。</text>
        <view v-for="f in FIELDS" :key="f.key" class="field-block">
          <text class="field-label">{{ f.label }}</text>
          <text class="field-hint">{{ f.hint }}</text>
          <textarea
            v-model="form[f.key]"
            class="field-input"
            :maxlength="300"
            :placeholder="f.ph"
            placeholder-class="ph"
            :auto-height="true"
            :show-confirm-bar="false"
            :disable-default-padding="true"
          />
        </view>
        <view class="save-btn" :class="{ disabled: saving }" hover-class="save-btn--active" @tap.stop="save">
          <text class="save-btn-text">{{ saving ? '保存中…' : '保存状态' }}</text>
        </view>
        <view class="tail-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { getStatus, saveStatus } from '@/api/aiTwin'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close', 'saved'])

const FIELDS = [
  { key: 'nowDoing', label: '此刻在做', hint: '正在忙什么', ph: '如：在开会 / 在路上' },
  { key: 'nextActions', label: '接下来要做', hint: '今晚或近期安排', ph: '如：今晚打台球' },
  { key: 'innerThought', label: '心理活动', hint: '可选', ph: '此刻心情或想法' },
]

const form = ref({
  nowDoing: '',
  nextActions: '',
  innerThought: '',
})
const saving = ref(false)
const base = ref(null)

watch(
  () => props.show,
  (open) => {
    if (open) loadStatus()
  },
  { immediate: true }
)

function close() {
  emit('close')
}

async function loadStatus() {
  try {
    const s = await getStatus()
    base.value = s
    form.value.nowDoing = s.nowDoing || ''
    form.value.nextActions = s.nextActions || ''
    form.value.innerThought = s.innerThought || ''
  } catch (err) {
    console.warn('状态加载失败', err)
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const prev = base.value || {}
    await saveStatus({
      nowDoing: form.value.nowDoing || '',
      nextActions: form.value.nextActions || '',
      innerThought: form.value.innerThought || '',
      sleepHabit: prev.sleepHabit || '',
      dietHabit: prev.dietHabit || '',
      workHabit: prev.workHabit || '',
    })
    uni.showToast({ title: '状态已更新', icon: 'none' })
    emit('saved')
    emit('close')
  } catch (err) {
    console.error('状态保存失败', err)
    const msg = (err && err.message) || '保存失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.status-sheet {
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
  height: 72vh;
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

.panel-tip {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.5;
}

.panel-body {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.field-block {
  margin-top: 22rpx;
}

.field-label {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: rgba(232, 200, 120, 0.9);
  letter-spacing: 2rpx;
}

.field-hint {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.35);
}

.field-input {
  width: 100%;
  min-height: 110rpx;
  margin-top: 12rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 248, 235, 0.92);
  font-size: 26rpx;
  line-height: 1.6;
  box-sizing: border-box;
}

.ph {
  color: rgba(255, 255, 255, 0.28);
}

.save-btn {
  margin-top: 30rpx;
  padding: 24rpx 0;
  border-radius: 20rpx;
  text-align: center;
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
  box-shadow: 0 10rpx 28rpx rgba(201, 162, 39, 0.35);
}

.save-btn--active {
  transform: translateY(2rpx);
  opacity: 0.92;
}

.save-btn.disabled {
  opacity: 0.6;
}

.save-btn-text {
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
  color: #4a3608;
}

.tail-pad {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
