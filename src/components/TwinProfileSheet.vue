<template>
  <view v-if="show" class="profile-sheet">
    <view class="mask" @tap="close" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="panel-head">
        <text class="panel-title">完善资料</text>
        <text class="panel-close" @tap="close">收起</text>
      </view>

      <view v-if="loading" class="state-wrap">
        <text class="state-text">加载中…</text>
      </view>

      <template v-else>
        <!-- 全部填完 -->
        <view v-if="!current" class="state-wrap">
          <text class="done-glyph">✦</text>
          <text class="done-text">资料已全部填完</text>
          <text class="done-sub">以后想改，直接在对话里告诉分身"其实我…"</text>
          <view class="done-btn" hover-class="done-btn--active" @tap="close">
            <text class="done-btn-text">好的</text>
          </view>
        </view>

        <!-- 逐题填写 -->
        <scroll-view v-else scroll-y class="panel-body" :show-scrollbar="false">
          <view class="meta-row">
            <view class="cat-chip">
              <text class="cat-chip-text">{{ current.label }}</text>
            </view>
            <text class="progress-text">{{ answeredCount }}/{{ progressTotal }}</text>
          </view>
          <text class="question">{{ current.text }}</text>
          <text class="hint">{{ current.hint }}</text>
          <textarea
            v-model="draft"
            class="answer-input"
            :maxlength="500"
            placeholder="写下答案…"
            placeholder-class="ph"
            :auto-height="true"
            :show-confirm-bar="false"
            :disable-default-padding="true"
          />
          <view class="btn-row">
            <view class="btn-skip" hover-class="btn-skip--active" @tap.stop="skipQuestion">
              <text class="btn-skip-text">换一题</text>
            </view>
            <view
              class="btn-save"
              :class="{ disabled: !draft.trim() || saving }"
              hover-class="btn-save--active"
              @tap.stop="saveAnswer"
            >
              <text class="btn-save-text">保存，下一题</text>
            </view>
          </view>
          <view class="tail-pad" />
        </scroll-view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { listMemories } from '@/api/aiTwin'
import { PROFILE_QUESTIONS, getProfileProgress, saveProfileAnswer } from '@/api/twinProfile'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

const loading = ref(true)
const draft = ref('')
const answeredMap = ref({})
const answeredCount = ref(0)
const cursor = ref(0)
const saving = ref(false)

const progressTotal = PROFILE_QUESTIONS.length

/** 从 cursor 起循环找第一个未答题；全部答完返回 null 走完成态 */
const current = computed(function () {
  if (answeredCount.value >= progressTotal) return null
  for (let i = 0; i < progressTotal; i++) {
    const q = PROFILE_QUESTIONS[(cursor.value + i) % progressTotal]
    if (!answeredMap.value[q.id]) return q
  }
  return null
})

watch(
  () => props.show,
  (open) => {
    if (!open) return
    draft.value = ''
    loadProgress()
  }
)

function close() {
  emit('close')
}

async function loadProgress() {
  loading.value = true
  try {
    const mem = await listMemories()
    const p = getProfileProgress(mem)
    answeredMap.value = p.answeredMap
    answeredCount.value = p.answered
    cursor.value = 0
  } catch (err) {
    console.warn('资料进度加载失败', err)
  } finally {
    loading.value = false
  }
}

function skipQuestion() {
  if (!current.value) return
  cursor.value = (cursor.value + 1) % progressTotal
  draft.value = ''
}

async function saveAnswer() {
  if (saving.value) return
  const q = current.value
  if (!q || !draft.value.trim()) return
  saving.value = true
  try {
    await saveProfileAnswer(q, draft.value)
    answeredMap.value[q.id] = true
    answeredCount.value = answeredCount.value + 1
    cursor.value = (cursor.value + 1) % progressTotal
    draft.value = ''
    uni.showToast({ title: '记住了', icon: 'none' })
  } catch (err) {
    console.error('资料保存失败', err)
    const msg = (err && err.message) || '保存失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.profile-sheet {
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
  max-height: 76vh;
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

.state-wrap {
  padding: 80rpx 60rpx calc(80rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
}

.state-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.5);
}

.done-glyph {
  font-size: 72rpx;
  color: #e8c878;
  text-shadow: 0 0 24rpx rgba(232, 200, 120, 0.5);
}

.done-text {
  font-size: 34rpx;
  font-weight: 700;
  color: rgba(255, 248, 235, 0.95);
  letter-spacing: 2rpx;
}

.done-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

.done-btn {
  margin-top: 20rpx;
  padding: 20rpx 90rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
}

.done-btn--active {
  transform: translateY(2rpx);
  opacity: 0.92;
}

.done-btn-text {
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
  color: #4a3608;
}

.panel-body {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 0 36rpx;
  box-sizing: border-box;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cat-chip {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(122, 212, 255, 0.45);
  background: rgba(122, 212, 255, 0.1);
}

.cat-chip-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #7ad4ff;
  letter-spacing: 2rpx;
}

.progress-text {
  font-size: 26rpx;
  font-weight: 700;
  color: rgba(232, 200, 120, 0.85);
  letter-spacing: 2rpx;
}

.question {
  display: block;
  margin-top: 30rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: rgba(255, 248, 235, 0.95);
  line-height: 1.5;
}

.hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.38);
}

.answer-input {
  width: 100%;
  min-height: 200rpx;
  margin-top: 26rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 248, 235, 0.92);
  font-size: 28rpx;
  line-height: 1.6;
  box-sizing: border-box;
}

.ph {
  color: rgba(255, 255, 255, 0.28);
}

.btn-row {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.btn-skip {
  flex: 1;
  padding: 24rpx 0;
  border-radius: 20rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  border: 2rpx solid rgba(255, 255, 255, 0.12);
}

.btn-skip--active {
  background: rgba(255, 255, 255, 0.1);
}

.btn-skip-text {
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  color: rgba(255, 255, 255, 0.6);
}

.btn-save {
  flex: 2;
  padding: 24rpx 0;
  border-radius: 20rpx;
  text-align: center;
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
  box-shadow: 0 10rpx 28rpx rgba(201, 162, 39, 0.35);
}

.btn-save--active {
  transform: translateY(2rpx);
  opacity: 0.92;
}

.btn-save.disabled {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.btn-save.disabled .btn-save-text {
  color: rgba(255, 255, 255, 0.35);
}

.btn-save-text {
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
  color: #4a3608;
}

.tail-pad {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
