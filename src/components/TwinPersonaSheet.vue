<template>
  <view v-if="show" class="persona-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <text class="panel-title">编辑人设</text>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <scroll-view scroll-y class="panel-body" :show-scrollbar="false">
        <text class="panel-tip">人设决定分身"是谁"，配合资料问卷的语气样本决定"怎么说话"。全部选填。</text>
        <view v-for="f in FIELDS" :key="f.key" class="field-block">
          <text class="field-label">{{ f.label }}</text>
          <text class="field-hint">{{ f.hint }}</text>
          <textarea
            v-model="form[f.key]"
            class="field-input"
            :maxlength="500"
            placeholder="选填"
            placeholder-class="ph"
            :auto-height="true"
            :show-confirm-bar="false"
            :disable-default-padding="true"
          />
        </view>
        <view class="save-btn" :class="{ disabled: saving }" hover-class="save-btn--active" @tap.stop="save">
          <text class="save-btn-text">{{ saving ? '保存中…' : '保存人设' }}</text>
        </view>
        <view class="tail-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { getPersona, savePersona } from '@/api/aiTwin'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

const FIELDS = [
  { key: 'bio', label: '简介', hint: '一句话介绍他是谁' },
  { key: 'appearance', label: '外貌', hint: '长相、体型、穿着风格' },
  { key: 'personality', label: '性格', hint: '性格关键词与处事方式' },
  { key: 'speechStyle', label: '说话语气', hint: '怎么说话：快慢、直接委婉、爱用什么句式' },
  { key: 'values', label: '价值观', hint: '在意什么、推崇什么' },
  { key: 'boundaries', label: '底线', hint: '绝不接受、绝不去做的事' },
  { key: 'goals', label: '目标', hint: '短期与长期目标' },
]

const form = ref({
  bio: '',
  appearance: '',
  personality: '',
  speechStyle: '',
  values: '',
  boundaries: '',
  goals: '',
})
const saving = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) loadPersona()
  }
)

function close() {
  emit('close')
}

async function loadPersona() {
  try {
    const p = await getPersona()
    for (let i = 0; i < FIELDS.length; i++) {
      form.value[FIELDS[i].key] = p[FIELDS[i].key] || ''
    }
  } catch (err) {
    console.warn('人设加载失败', err)
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await savePersona(form.value)
    uni.showToast({ title: '人设已更新', icon: 'none' })
    emit('close')
  } catch (err) {
    console.error('人设保存失败', err)
    const msg = (err && err.message) || '保存失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.persona-sheet {
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
