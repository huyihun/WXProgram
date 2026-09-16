<template>
  <PageRoot
    dark-nav
    flush
    fill
  >
    <view class="stage">
      <!-- 顶部 HUD -->
      <view class="hud">
        <view class="hud-name-row">
          <text class="hud-name">胡神分身</text>
          <view class="stage-badge" :class="'badge--' + stage.id">
            <text class="stage-badge-text">{{ stage.label }}</text>
          </view>
        </view>
        <text class="hud-sub">Lv.{{ growth.level }} · 已投喂 {{ growth.totalFeeds }} 份灵食</text>
      </view>

      <PageLoading v-if="bootLoading" text="加载中" />

      <template v-else>
        <!-- 圣坛：光晕 + 进化环 + 形象 -->
        <view class="altar">
          <view class="aura" :class="'aura--' + stage.id" />
          <view class="particles">
            <view class="p-dot d1" />
            <view class="p-dot d2" />
            <view class="p-dot d3" />
            <view class="p-dot d4" />
            <view class="p-dot d5" />
          </view>

          <view class="ring" :style="ringStyle">
            <view class="ring-inner" :class="'ring-inner--' + stage.id">
              <view
                class="avatar-wrap"
                :class="{ chew: feedingPhase === 'chewing' }"
                @tap="onAvatarTap"
              >
                <image
                  v-if="avatarSrc && avatarOk"
                  class="avatar"
                  :src="avatarSrc"
                  mode="aspectFill"
                  @error="onAvatarError"
                />
                <view v-else class="avatar avatar--placeholder">
                  <text class="avatar-ph-glyph">分</text>
                  <text class="avatar-ph-text">点击设置形象</text>
                </view>
                <view v-if="feedingPhase === 'absorbing'" class="absorb-wave" />
              </view>
            </view>
          </view>

          <!-- 消化提示 -->
          <view v-if="feedingPhase === 'digesting'" class="digest-tip">
            <view class="digest-shimmer" />
            <text class="digest-text">细嚼慢咽中…</text>
          </view>

          <!-- 灵气飘字 -->
          <view v-if="floatText" class="float-exp">
            <text class="float-exp-text">{{ floatText }}</text>
          </view>
        </view>

        <!-- 经验条 -->
        <view class="exp-row">
          <view class="exp-bar">
            <view class="exp-fill" :style="{ width: expPct + '%' }" />
          </view>
          <text class="exp-text">{{ growth.exp }} / {{ expNext }} 灵气</text>
        </view>
      </template>

      <!-- 飞行中的食物 -->
      <view
        v-if="feedingPhase === 'flying'"
        class="food-fly"
        :class="[{ go: flyGo }, 'fly--' + flyTier]"
      >
        <view class="fly-orb" />
      </view>

      <!-- 主动问候气泡 -->
      <view v-if="greetText" class="greet-bubble" @tap="onGreetTap">
        <text class="greet-bubble-text">{{ greetText }}</text>
        <text class="greet-bubble-cta">聊聊天 ›</text>
      </view>

      <!-- 底部操作坞 -->
      <view v-if="!bootLoading" class="dock">
        <view class="dock-sub" hover-class="dock-sub--active" @tap="chatOpen = true">
          <view class="ico-chat">
            <view class="ico-chat-body" />
            <view class="ico-chat-tail" />
            <view class="ico-chat-dot d1" />
            <view class="ico-chat-dot d2" />
            <view class="ico-chat-dot d3" />
          </view>
          <text class="dock-sub-text">对话</text>
        </view>
        <view
          class="dock-main"
          :class="{ disabled: feeding }"
          hover-class="dock-main--active"
          @tap="openFeed"
        >
          <view class="ico-tray">
            <view class="ico-tray-dome" />
            <view class="ico-tray-base" />
          </view>
          <text class="dock-main-text">投喂</text>
        </view>
        <view class="dock-sub" hover-class="dock-sub--active" @tap="recipeOpen = true">
          <view class="ico-book">
            <view class="ico-book-spine" />
            <view class="ico-book-page" />
          </view>
          <text class="dock-sub-text">食谱</text>
        </view>
      </view>

      <!-- 进化 / 升级 overlays -->
      <view v-if="evolveInfo" class="evolve-mask" @tap="evolveInfo = null">
        <view class="evolve-burst" />
        <view class="evolve-banner">
          <text class="evolve-kicker">{{ evolveInfo.stageUp ? '进 化' : '升 级' }}</text>
          <text class="evolve-title">{{ evolveInfo.title }}</text>
          <text class="evolve-sub">Lv.{{ evolveInfo.level }}</text>
        </view>
      </view>
    </view>

    <TwinFeedSheet :show="feedOpen" @close="feedOpen = false" @confirm="startFeeding" />
    <TwinRecipeSheet :show="recipeOpen" @close="recipeOpen = false" />
    <TwinProfileSheet :show="profileOpen" @close="profileOpen = false" />
    <TwinPersonaSheet :show="personaOpen" @close="personaOpen = false" />
    <TwinMemorySheet :show="memoryOpen" @close="memoryOpen = false" />
    <AiChatSheet :show="chatOpen" twin @close="chatOpen = false" />
  </PageRoot>
</template>

<script setup>
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import {
  getPersona,
  getStatus,
  listMemories,
  loadChat,
  emptyPersona,
  emptyStatus,
  getAvatar,
  uploadTwinAvatar,
  digestTwinMaterial,
  addFeedRecord,
  addGrowthExp,
  addMemoryUnique,
  replaceTaggedMemory,
  getGrowth,
  stageForLevel,
  expToNext,
  calcFeedExp,
} from '@/api/aiTwin'
import TwinFeedSheet from '@/components/TwinFeedSheet.vue'
import TwinRecipeSheet from '@/components/TwinRecipeSheet.vue'
import TwinProfileSheet from '@/components/TwinProfileSheet.vue'
import TwinPersonaSheet from '@/components/TwinPersonaSheet.vue'
import TwinMemorySheet from '@/components/TwinMemorySheet.vue'
import AiChatSheet from '@/components/AiChatSheet.vue'

const bootLoading = ref(true)
const avatarSrc = ref('')
const avatarOk = ref(true)
const avatarBusy = ref(false)
const growth = ref({ level: 1, exp: 0, totalFeeds: 0 })
const feedOpen = ref(false)
const recipeOpen = ref(false)
const chatOpen = ref(false)
const profileOpen = ref(false)
const personaOpen = ref(false)
const memoryOpen = ref(false)
const feedingPhase = ref('idle') // idle | flying | chewing | digesting | absorbing
const flyTier = ref('feast')
const flyGo = ref(false)
const floatText = ref('')
const evolveInfo = ref(null)
let evolveTimer = null

/** 后台保留，便于以后接回人设/对话面板 */
const persona = ref(emptyPersona())
const status = ref(emptyStatus())
const memories = ref([])
const messages = ref([])

const stage = computed(() => stageForLevel(growth.value.level))
const expNext = computed(() => expToNext(growth.value.level))
const expPct = computed(() => {
  const n = expNext.value || 1
  const p = Math.floor(((growth.value.exp || 0) / n) * 100)
  if (p < 0) return 0
  if (p > 100) return 100
  return p
})

const STAGE_COLORS = {
  baby: '#7ad4ff',
  child: '#58b7ff',
  adult: '#9a7bff',
  perfect: '#e8c878',
  ultimate: '#f0d78c',
}

const ringStyle = computed(() => {
  const color = STAGE_COLORS[stage.value.id] || '#7ad4ff'
  const pct = expPct.value
  return {
    background:
      'conic-gradient(' + color + ' 0% ' + pct + '%, rgba(255,255,255,0.08) ' + pct + '% 100%)',
  }
})

const feeding = computed(() => feedingPhase.value !== 'idle')

/* ---------- 主动问候 ---------- */
const greetText = ref('')
let greetTimer = null

function greetingName() {
  for (let i = 0; i < memories.value.length; i++) {
    const m = memories.value[i]
    if (m && m.qid === 'pq_call' && m.text) {
      return m.text.replace(/^【[^】]*】/, '').trim() || '主人'
    }
  }
  return '主人'
}

function buildGreeting() {
  const h = new Date().getHours()
  let head = ''
  if (h >= 5 && h < 10) head = '早上好'
  else if (h < 14) head = '中午好'
  else if (h < 19) head = '下午好'
  else if (h < 23) head = '晚上好'
  else head = '这么晚还没睡？'
  let text = head + '，' + greetingName() + '。'
  const plan = (status.value && status.value.nextActions) || ''
  if (plan) text += '对了——' + plan.slice(0, 24) + '，别忘了。'
  return text
}

function showGreeting() {
  greetText.value = buildGreeting()
  if (greetTimer) clearTimeout(greetTimer)
  greetTimer = setTimeout(function () {
    greetText.value = ''
    greetTimer = null
  }, 6000)
}

function onGreetTap() {
  greetText.value = ''
  chatOpen.value = true
}

onMounted(async function () {
  await loadOwnerFlag()
  if (!isOwnerSync()) {
    uni.showToast({ title: '仅主人可用', icon: 'none' })
    setTimeout(function () {
      uni.navigateBack({
        fail: function () {
          uni.reLaunch({ url: '/pages/index/index' })
        },
      })
    }, 400)
    return
  }
  try {
    await reloadAll()
  } catch (err) {
    console.warn('twin data load', err)
  } finally {
    bootLoading.value = false
    showGreeting()
  }
})

onUnmounted(function () {
  if (evolveTimer) {
    clearTimeout(evolveTimer)
    evolveTimer = null
  }
  if (greetTimer) {
    clearTimeout(greetTimer)
    greetTimer = null
  }
})

async function reloadAll() {
  const avatar = await getAvatar()
  if (avatar && avatar.mainFileID) {
    avatarSrc.value = avatar.mainFileID
  } else {
    avatarSrc.value = '/static/twin/avatar.png'
  }
  const g = await getGrowth()
  growth.value = g
  const p = await getPersona()
  const s = await getStatus()
  const mem = await listMemories()
  const chat = await loadChat()
  persona.value = p
  status.value = s
  memories.value = mem || []
  messages.value = chat || []
}

function onAvatarError() {
  avatarOk.value = false
}

function onAvatarTap() {
  if (avatarBusy.value || feeding.value) return
  uni.showActionSheet({
    itemList: ['更换形象', '编辑人设', '完善资料', '记忆管理'],
    success(res) {
      if (res.tapIndex === 0) pickAvatar()
      else if (res.tapIndex === 1) personaOpen.value = true
      else if (res.tapIndex === 2) profileOpen.value = true
      else if (res.tapIndex === 3) memoryOpen.value = true
    },
  })
}

function pickAvatar() {
  avatarBusy.value = true
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    async success(res) {
      const path = res.tempFilePaths && res.tempFilePaths[0]
      if (!path) {
        avatarBusy.value = false
        return
      }
      try {
        const fileID = await uploadTwinAvatar(path)
        avatarSrc.value = fileID
        avatarOk.value = true
        uni.showToast({ title: '形象已更新', icon: 'none' })
      } catch (err) {
        console.error('上传形象失败', err)
        uni.showToast({ title: '上传失败', icon: 'none' })
      }
      avatarBusy.value = false
    },
    fail() {
      avatarBusy.value = false
    },
  })
}

function openFeed() {
  if (feeding.value) {
    uni.showToast({ title: '正在进食中…', icon: 'none' })
    return
  }
  feedOpen.value = true
}

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

async function startFeeding(payload) {
  if (feeding.value) return
  feedOpen.value = false
  flyTier.value = payload.tier || 'feast'
  flyGo.value = false
  feedingPhase.value = 'flying'
  const digestPromise = runDigest(payload)

  await wait(60)
  flyGo.value = true
  await wait(940)
  feedingPhase.value = 'chewing'
  await wait(1300)
  feedingPhase.value = 'digesting'

  let result = null
  try {
    result = await digestPromise
  } catch (err) {
    console.error('投喂消化失败', err)
    feedingPhase.value = 'idle'
    const msg = (err && err.message) || '消化失败'
    uni.showToast({ title: String(msg).slice(0, 40), icon: 'none' })
    return
  }

  feedingPhase.value = 'absorbing'
  floatText.value = '+' + result.exp
  await wait(1500)
  floatText.value = ''
  feedingPhase.value = 'idle'

  if (result.levelUp) {
    showEvolve(result)
  }
}

function showEvolve(result) {
  const title = result.stageUp
    ? result.stage.label
    : 'Lv.' + result.level
  evolveInfo.value = {
    level: result.level,
    stageUp: result.stageUp,
    title: title,
  }
  if (evolveTimer) clearTimeout(evolveTimer)
  evolveTimer = setTimeout(function () {
    evolveInfo.value = null
    evolveTimer = null
  }, 2600)
}

function uploadFeedFile(filePath, fileName) {
  return new Promise(function (resolve, reject) {
    const s = String(fileName || '')
    const at = s.lastIndexOf('.')
    const ext = at >= 0 ? s.slice(at + 1).toLowerCase() : 'dat'
    // devtools 对带子目录的 cloudPath 有 EISDIR 坑，拍平成 twin/feed-xxx
    const cloudPath = 'twin/feed-' + Date.now() + '_' + Math.floor(Math.random() * 10000) + '.' + ext
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: function (res) {
        if (res && res.fileID) {
          resolve(res.fileID)
          return
        }
        reject(new Error('上传失败'))
      },
      fail: function (err) {
        console.error('投喂上传失败', err)
        reject(new Error((err && err.errMsg) || '上传失败'))
      },
    })
  })
}

async function runDigest(payload) {
  let digest = null
  if (payload.sourceType === 'life') {
    digest = await digestTwinMaterial({ text: payload.text })
  } else if (payload.sourceType === 'text') {
    digest = await digestTwinMaterial({ text: payload.text })
  } else {
    const fileID = await uploadFeedFile(payload.filePath, payload.fileName)
    digest = await digestTwinMaterial({ fileID: fileID })
  }

  const exp = calcFeedExp(digest.chars)
  const title =
    payload.sourceType === 'text'
      ? payload.text.slice(0, 16)
      : payload.fileName || '文件食粮'

  if (payload.sourceType === 'life') {
    const r = await replaceTaggedMemory(digest.summary, 'life', memories.value)
    if (r) {
      const removedMap = {}
      for (let i = 0; i < r.removed.length; i++) {
        removedMap[r.removed[i]._id] = true
      }
      memories.value = memories.value.filter(function (m) {
        return !removedMap[m._id]
      })
      memories.value.unshift(r.mem)
    }
  } else {
    const mem = await addMemoryUnique(digest.summary, memories.value)
    if (mem) memories.value.unshift(mem)
  }

  await addFeedRecord({
    title: title,
    sourceType: payload.sourceType,
    fileName: payload.fileName || '',
    chars: digest.chars,
    exp: exp,
    summary: digest.summary,
  })

  const g = await addGrowthExp(exp, digest.chars)
  growth.value = {
    level: g.level,
    exp: g.exp,
    totalFeeds: g.totalFeeds,
    totalChars: g.totalChars,
  }
  return { exp: exp, levelUp: g.levelUp, stageUp: g.stageUp, stage: g.stage, level: g.level }
}
</script>

<style lang="scss" scoped>
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ---------- HUD ---------- */
.hud {
  position: absolute;
  left: 32rpx;
  top: 16rpx;
  z-index: 2;
  pointer-events: none;
}

.hud-name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.hud-name {
  font-size: 32rpx;
  font-weight: 700;
  color: rgba(255, 248, 235, 0.95);
  letter-spacing: 2rpx;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.45);
}

.stage-badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(122, 212, 255, 0.5);
  background: rgba(122, 212, 255, 0.1);
}

.stage-badge-text {
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #7ad4ff;
}

.badge--child {
  border-color: rgba(88, 183, 255, 0.55);
  background: rgba(88, 183, 255, 0.1);
}

.badge--child .stage-badge-text {
  color: #58b7ff;
}

.badge--adult {
  border-color: rgba(154, 123, 255, 0.55);
  background: rgba(154, 123, 255, 0.12);
}

.badge--adult .stage-badge-text {
  color: #9a7bff;
}

.badge--perfect {
  border-color: rgba(232, 200, 120, 0.6);
  background: rgba(232, 200, 120, 0.12);
}

.badge--perfect .stage-badge-text {
  color: #e8c878;
}

.badge--ultimate {
  border-color: rgba(240, 215, 140, 0.8);
  background: linear-gradient(135deg, rgba(240, 215, 140, 0.18), rgba(201, 162, 39, 0.14));
  box-shadow: 0 0 16rpx rgba(232, 200, 120, 0.35);
}

.badge--ultimate .stage-badge-text {
  color: #f0d78c;
}

.hud-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.42);
}

/* ---------- 圣坛 ---------- */
.altar {
  position: absolute;
  left: 0;
  right: 0;
  top: 16vh;
  height: 460rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 光晕：随进化阶升级 */
.aura {
  position: absolute;
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  animation: auraBreath 3.2s ease-in-out infinite;
  pointer-events: none;
}

.aura--baby {
  background: radial-gradient(circle, rgba(122, 212, 255, 0.22) 0%, transparent 66%);
}

.aura--child {
  width: 470rpx;
  height: 470rpx;
  background: radial-gradient(circle, rgba(88, 183, 255, 0.26) 0%, transparent 64%);
  box-shadow: 0 0 90rpx rgba(88, 183, 255, 0.16);
}

.aura--adult {
  width: 500rpx;
  height: 500rpx;
  background:
    radial-gradient(circle, rgba(154, 123, 255, 0.28) 0%, transparent 60%),
    radial-gradient(circle, rgba(88, 183, 255, 0.14) 30%, transparent 70%);
  box-shadow: 0 0 110rpx rgba(154, 123, 255, 0.2);
}

.aura--perfect {
  width: 540rpx;
  height: 540rpx;
  background:
    radial-gradient(circle, rgba(232, 200, 120, 0.3) 0%, transparent 58%),
    radial-gradient(circle, rgba(122, 212, 255, 0.16) 34%, transparent 72%);
  box-shadow:
    0 0 120rpx rgba(232, 200, 120, 0.24),
    0 0 60rpx rgba(122, 212, 255, 0.14);
}

.aura--ultimate {
  width: 580rpx;
  height: 580rpx;
  background:
    radial-gradient(circle, rgba(240, 215, 140, 0.34) 0%, transparent 56%),
    radial-gradient(circle, rgba(154, 123, 255, 0.18) 32%, transparent 68%),
    radial-gradient(circle, rgba(122, 212, 255, 0.14) 40%, transparent 76%);
  box-shadow:
    0 0 140rpx rgba(240, 215, 140, 0.3),
    0 0 70rpx rgba(154, 123, 255, 0.18);
  animation: auraBreath 3.2s ease-in-out infinite, auraHue 6s linear infinite;
}

@keyframes auraBreath {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.07);
    opacity: 1;
  }
}

@keyframes auraHue {
  0%,
  100% {
    filter: hue-rotate(0deg);
  }
  50% {
    filter: hue-rotate(24deg);
  }
}

/* 上升灵气粒子 */
.particles {
  position: absolute;
  width: 420rpx;
  height: 420rpx;
  pointer-events: none;
}

.p-dot {
  position: absolute;
  bottom: 40rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: rgba(255, 244, 214, 0.75);
  animation: pRise 4.2s ease-in infinite;
  opacity: 0;
}

.p-dot.d1 {
  left: 22%;
  animation-delay: 0s;
}

.p-dot.d2 {
  left: 38%;
  animation-delay: 1.1s;
}

.p-dot.d3 {
  left: 52%;
  animation-delay: 2.3s;
}

.p-dot.d4 {
  left: 66%;
  animation-delay: 0.6s;
}

.p-dot.d5 {
  left: 78%;
  animation-delay: 3s;
}

@keyframes pRise {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  18% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-260rpx) scale(1.05);
    opacity: 0;
  }
}

/* 进化环（EXP 进度） */
.ring {
  position: relative;
  width: 372rpx;
  height: 372rpx;
  border-radius: 50%;
  padding: 10rpx;
  box-sizing: border-box;
  box-shadow: 0 0 40rpx rgba(0, 0, 0, 0.4);
  transition: background 0.6s ease;
}

.ring-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #161221;
  border: 6rpx solid #121018;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.ring-inner--ultimate {
  box-shadow: inset 0 0 40rpx rgba(240, 215, 140, 0.12);
}

/* 形象 */
.avatar-wrap {
  position: relative;
  width: 280rpx;
  height: 280rpx;
}

.avatar {
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: #1c1926;
}

.avatar--placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  border: 2rpx dashed rgba(255, 255, 255, 0.18);
  box-sizing: border-box;
}

.avatar-ph-glyph {
  font-size: 64rpx;
  font-weight: 800;
  color: rgba(255, 248, 235, 0.3);
}

.avatar-ph-text {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.35);
}

/* 咀嚼动效 */
.avatar-wrap.chew {
  animation: chew 0.42s ease-in-out 3;
}

@keyframes chew {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }
  30% {
    transform: rotate(-3deg) scale(1.03);
  }
  70% {
    transform: rotate(3deg) scale(0.98);
  }
}

/* 吸收光环 */
.absorb-wave {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 200rpx;
  height: 200rpx;
  margin: -100rpx 0 0 -100rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(232, 200, 120, 0.75);
  animation: absorbWave 0.75s ease-out infinite;
  pointer-events: none;
}

@keyframes absorbWave {
  0% {
    transform: scale(0.8);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.65);
    opacity: 0;
  }
}

/* 消化提示 */
.digest-tip {
  position: absolute;
  left: 50%;
  bottom: -74rpx;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  background: rgba(22, 18, 33, 0.9);
  border: 2rpx solid rgba(232, 200, 120, 0.3);
  overflow: hidden;
}

.digest-shimmer {
  position: absolute;
  left: -60%;
  top: 0;
  bottom: 0;
  width: 50%;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgba(255, 244, 214, 0.18) 50%,
    transparent 100%
  );
  animation: shimmerSweep 1.4s ease-in-out infinite;
}

@keyframes shimmerSweep {
  0% {
    left: -60%;
  }
  100% {
    left: 120%;
  }
}

.digest-text {
  position: relative;
  font-size: 23rpx;
  color: rgba(232, 200, 120, 0.9);
  letter-spacing: 2rpx;
}

/* 灵气飘字 */
.float-exp {
  position: absolute;
  left: 50%;
  top: 8rpx;
  transform: translateX(-50%);
  pointer-events: none;
  animation: floatUp 1.5s ease-out forwards;
}

.float-exp-text {
  font-size: 44rpx;
  font-weight: 800;
  color: #f0d78c;
  text-shadow: 0 0 20rpx rgba(232, 200, 120, 0.6);
  letter-spacing: 2rpx;
}

@keyframes floatUp {
  0% {
    transform: translate(-50%, 0) scale(0.7);
    opacity: 0;
  }
  22% {
    transform: translate(-50%, -22rpx) scale(1.12);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -130rpx) scale(1);
    opacity: 0;
  }
}

/* ---------- 经验条 ---------- */
.exp-row {
  position: absolute;
  left: 76rpx;
  right: 76rpx;
  top: calc(16vh + 500rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.exp-bar {
  width: 100%;
  height: 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.exp-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #7ad4ff 0%, #9a7bff 60%, #e8c878 100%);
  box-shadow: 0 0 14rpx rgba(154, 123, 255, 0.5);
  transition: width 0.7s cubic-bezier(0.3, 0.7, 0.3, 1);
}

.exp-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 1rpx;
}

/* ---------- 飞行食物 ---------- */
.food-fly {
  position: fixed;
  left: 50%;
  bottom: 220rpx;
  z-index: 60;
  transform: translate(-50%, 0) scale(1) rotate(0deg);
  transition:
    transform 0.95s cubic-bezier(0.32, 0.72, 0.35, 1),
    opacity 0.95s ease;
  pointer-events: none;
}

.food-fly.go {
  transform: translate(-50%, -44vh) scale(0.3) rotate(22deg);
}

.fly-orb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50% 50% 46% 46%;
}

.fly--fruit .fly-orb {
  background: radial-gradient(circle at 34% 30%, #a8f0c0 0%, #4ecf8a 55%, #1f9e63 100%);
  box-shadow: 0 0 36rpx rgba(78, 207, 138, 0.65);
}

.fly--meal .fly-orb {
  background: radial-gradient(circle at 34% 30%, #cdeaff 0%, #7ad4ff 55%, #2b8fd9 100%);
  box-shadow: 0 0 36rpx rgba(122, 212, 255, 0.65);
}

.fly--feast .fly-orb {
  background: radial-gradient(circle at 34% 30%, #f6e3b4 0%, #e8c878 50%, #c9a227 100%);
  box-shadow: 0 0 44rpx rgba(232, 200, 120, 0.75);
}

/* ---------- 底部操作坞 ---------- */
.greet-bubble {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(340rpx + env(safe-area-inset-bottom));
  z-index: 6;
  max-width: 600rpx;
  padding: 20rpx 30rpx;
  border-radius: 24rpx 24rpx 24rpx 6rpx;
  background: rgba(22, 18, 33, 0.92);
  border: 2rpx solid rgba(232, 200, 120, 0.4);
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.45);
  animation: greetIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}

@keyframes greetIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(16rpx);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.greet-bubble-text {
  display: block;
  font-size: 25rpx;
  color: rgba(255, 248, 235, 0.92);
  line-height: 1.6;
}

.greet-bubble-cta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(232, 200, 120, 0.85);
  letter-spacing: 2rpx;
}

.dock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(56rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 36rpx;
  z-index: 5;
}

.dock-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, #f0d78c 0%, #c9a227 100%);
  box-shadow:
    0 14rpx 40rpx rgba(201, 162, 39, 0.4),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.4);
}

.dock-main--active {
  transform: translateY(3rpx);
  opacity: 0.92;
}

.dock-main.disabled {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.ico-tray {
  position: relative;
  width: 56rpx;
  height: 46rpx;
}

.ico-tray-dome {
  position: absolute;
  left: 6rpx;
  top: 0;
  right: 6rpx;
  height: 26rpx;
  border-radius: 26rpx 26rpx 4rpx 4rpx;
  border: 4rpx solid rgba(74, 54, 8, 0.85);
  border-bottom: none;
  box-sizing: border-box;
}

.ico-tray-base {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 10rpx;
  border-radius: 999rpx;
  background: rgba(74, 54, 8, 0.85);
}

.dock-main-text {
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 6rpx;
  color: #4a3608;
}

.dock-main.disabled .dock-main-text {
  color: rgba(255, 255, 255, 0.35);
}

.dock-sub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 2rpx solid rgba(232, 200, 120, 0.3);
  box-sizing: border-box;
}

.dock-sub--active {
  background: rgba(232, 200, 120, 0.1);
}

.ico-book {
  position: relative;
  width: 36rpx;
  height: 40rpx;
}

.ico-chat {
  position: relative;
  width: 40rpx;
  height: 38rpx;
}

.ico-chat-body {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 30rpx;
  border-radius: 12rpx;
  border: 3rpx solid rgba(232, 200, 120, 0.85);
  box-sizing: border-box;
}

.ico-chat-tail {
  position: absolute;
  left: 6rpx;
  bottom: 2rpx;
  width: 0;
  height: 0;
  border-left: 7rpx solid rgba(232, 200, 120, 0.85);
  border-bottom: 7rpx solid transparent;
}

.ico-chat-dot {
  position: absolute;
  top: 12rpx;
  width: 5rpx;
  height: 5rpx;
  border-radius: 50%;
  background: rgba(232, 200, 120, 0.85);
}

.ico-chat-dot.d1 {
  left: 10rpx;
}

.ico-chat-dot.d2 {
  left: 18rpx;
}

.ico-chat-dot.d3 {
  left: 26rpx;
}

.ico-book-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8rpx;
  border-radius: 4rpx 0 0 4rpx;
  background: rgba(232, 200, 120, 0.85);
}

.ico-book-page {
  position: absolute;
  left: 8rpx;
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 0 8rpx 8rpx 0;
  background: rgba(232, 200, 120, 0.28);
  border: 2rpx solid rgba(232, 200, 120, 0.5);
  box-sizing: border-box;
}

.dock-sub-text {
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  color: rgba(232, 200, 120, 0.85);
}

/* ---------- 进化 / 升级 ---------- */
.evolve-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 8, 16, 0.72);
}

.evolve-burst {
  position: absolute;
  width: 640rpx;
  height: 640rpx;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(240, 215, 140, 0.32) 0%,
    rgba(154, 123, 255, 0.14) 42%,
    transparent 68%
  );
  animation: burstPop 1.1s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}

@keyframes burstPop {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  35% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(1.32);
    opacity: 0.35;
  }
}

.evolve-banner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 44rpx 72rpx;
  border-radius: 28rpx;
  background: linear-gradient(180deg, rgba(32, 26, 46, 0.96) 0%, rgba(18, 14, 27, 0.96) 100%);
  border: 3rpx solid rgba(240, 215, 140, 0.55);
  box-shadow: 0 0 60rpx rgba(240, 215, 140, 0.25);
  animation: bannerIn 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
}

@keyframes bannerIn {
  0% {
    transform: translateY(50rpx) scale(0.85);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.evolve-kicker {
  font-size: 26rpx;
  font-weight: 600;
  letter-spacing: 14rpx;
  color: rgba(240, 215, 140, 0.75);
}

.evolve-title {
  font-size: 56rpx;
  font-weight: 800;
  letter-spacing: 8rpx;
  color: #f0d78c;
  text-shadow: 0 0 24rpx rgba(240, 215, 140, 0.5);
}

.evolve-sub {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 3rpx;
}
</style>
