<template>
  <view class="stage-page">
    <!-- 整页暗紫氛围底 -->
    <view class="stage-bg-art" aria-hidden="true">
      <view class="bg-base" />
      <view class="bg-glow" />
      <view class="bg-vignette" />
    </view>

    <!-- 顶栏短 3D / 头像展示区（Sheet 上滑时渐隐） -->
    <view class="stage-hero" :style="heroCombinedStyle">
      <!-- canvas 仅让出状态栏，头顶对齐胶囊 -->
      <view class="stage-canvas-wrap" :style="canvasWrapStyle">
        <canvas
          v-if="!fallback"
          id="stage-canvas"
          type="webgl"
          class="stage-canvas"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        />
        <view v-if="fallback" class="stage-fallback">
          <image class="fb-avatar" :src="avatarSrc" mode="aspectFill" />
        </view>
      </view>
      <view class="hero-fade" aria-hidden="true" />

      <!-- 成长微条：点击 → 投喂 / 百宝箱 -->
      <view class="hero-growth" @tap="onGrowthTap">
        <text class="growth-label">Lv.{{ growth.level }} · {{ stage.label }}</text>
        <view class="growth-bar">
          <view class="growth-fill" :style="{ width: expPct + '%' }" />
        </view>
      </view>

      <!-- 问候气泡 -->
      <view v-if="greetText" class="greet-bubble" @tap="onGreetTap">
        <text class="greet-bubble-text">{{ greetText }}</text>
        <text class="greet-bubble-cta">聊聊 ›</text>
      </view>

      <!-- 投喂飞行/飘字（精简） -->
      <view
        v-if="feedingPhase === 'flying'"
        class="food-fly"
        :class="[{ go: flyGo }, 'fly--' + flyTier]"
      >
        <view class="fly-orb" />
      </view>
      <view v-if="floatText" class="float-exp">
        <text class="float-exp-text">{{ floatText }}</text>
      </view>
      <view v-if="feedingPhase === 'digesting'" class="digest-tip">
        <text class="digest-text">细嚼慢咽中…</text>
      </view>
    </view>

    <!-- 进化提示 -->
    <view v-if="evolveInfo" class="evolve-mask" @tap="evolveInfo = null">
      <view class="evolve-banner">
        <text class="evolve-kicker">{{ evolveInfo.stageUp ? '进 化' : '升 级' }}</text>
        <text class="evolve-title">{{ evolveInfo.title }}</text>
        <text class="evolve-sub">Lv.{{ evolveInfo.level }}</text>
      </view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="stage-loading">
      <view class="load-ring">
        <view class="ring-spin" />
        <view class="ring-inner">
          <image class="load-logo" src="/static/twin/avatar.png" mode="aspectFill" />
        </view>
      </view>
      <text class="load-pct">{{ loadPct > 0 ? loadPct + '%' : '' }}</text>
      <text class="load-text">{{ loadText }}</text>
      <view class="load-track">
        <view
          class="load-fill"
          :class="{ run: !loadPct }"
          :style="{ width: (loadPct || 100) + '%' }"
        />
      </view>
    </view>

    <!-- 可拖拽聊天 Sheet：上滑盖住 3D，下滑还原 -->
    <view
      v-if="!loading"
      class="stage-chat"
      :class="{ expanded: chatExpanded, dragging: sheetDragging }"
      :style="chatSheetStyle"
    >
      <view
        class="chat-grabber-wrap"
        hover-class="chat-grabber-wrap--active"
        @touchstart.stop="onGrabberTouchStart"
        @touchmove.stop.prevent="onGrabberTouchMove"
        @touchend.stop="onGrabberTouchEnd"
        @touchcancel.stop="onGrabberTouchEnd"
      >
        <view class="chat-grabber-pill">
          <view class="chat-grabber-bar" />
        </view>
      </view>

      <!-- 自动投喂动效：挂在聊天 Sheet 上，全屏展开时也能看见 -->
      <view v-if="autoFeedFx" class="auto-feed-fx">
        <view class="auto-feed-glow" />
        <view class="auto-feed-orb a" />
        <view class="auto-feed-orb b" />
        <view class="auto-feed-orb c" />
        <text class="auto-feed-plus">+{{ autoFeedFx.exp }}</text>
        <text class="auto-feed-label">自动投喂</text>
      </view>
      <scroll-view
        class="stage-chat-scroll"
        :scroll-y="!sheetDragging"
        :scroll-into-view="scrollInto"
        :show-scrollbar="false"
        scroll-with-animation
        @scroll="onChatScroll"
        @touchstart="onScrollTouchStart"
        @touchmove="onScrollTouchMove"
        @touchend="onScrollTouchEnd"
        @touchcancel="onScrollTouchEnd"
      >
        <view v-if="!hasChatMsgs && !sceneThinking" class="stage-chat-empty">
          <text class="stage-chat-empty-text">可以说今天发生的事，或点下方投喂教它</text>
          <view class="stage-chips">
            <view
              v-for="(chip, ci) in displayChips"
              :key="'chip-' + ci"
              class="stage-chip"
              hover-class="stage-chip--active"
              @tap="sendQuickChip(chip)"
            >
              <text class="stage-chip-text">{{ chip }}</text>
            </view>
          </view>
        </view>
        <view
          v-for="(m, i) in displayMessages"
          :id="'msg-' + i"
          :key="'msg-' + i"
          class="msg-row"
          :class="m.role === 'user' ? 'is-user' : m.role === 'system' ? 'is-system' : 'is-twin'"
        >
          <template v-if="m.role === 'system'">
            <view class="msg-system">
              <text class="msg-system-text">{{ m.content }}</text>
            </view>
          </template>
          <template v-else>
            <image
              v-if="m.role !== 'user'"
              class="msg-avatar"
              :src="avatarSrc"
              mode="aspectFill"
            />
            <view class="msg-col" :class="m.role === 'user' ? 'is-user' : 'is-twin'">
              <text v-if="m.showTime && m.timeLabel" class="msg-time">{{ m.timeLabel }}</text>
              <view
                class="msg-bubble"
                :class="m.role === 'user' ? 'is-user' : 'is-twin'"
                @longpress="copyMsg(m)"
              >
                <image
                  v-if="m.image"
                  class="msg-bubble-img"
                  :src="m.image"
                  mode="widthFix"
                  @tap.stop="previewMsgImage(m.image)"
                />
                <text
                  v-if="m.content && !(m.image && m.content === '（附图）')"
                  class="msg-bubble-text"
                >{{ m.content }}</text>
              </view>
            </view>
            <image
              v-if="m.role === 'user'"
              class="msg-avatar is-me"
              :src="userAvatarSrc"
              mode="aspectFill"
            />
          </template>
        </view>
        <view v-if="sceneThinking" id="msg-thinking" class="msg-row is-twin">
          <image class="msg-avatar" :src="avatarSrc" mode="aspectFill" />
          <view class="msg-col is-twin">
            <view class="msg-bubble is-twin">
              <view class="typing-dots">
                <view class="typing-dot" />
                <view class="typing-dot" />
                <view class="typing-dot" />
              </view>
            </view>
          </view>
        </view>
        <view class="stage-chat-tail" />
      </scroll-view>

      <view v-if="scenePendingImage" class="stage-pending">
        <image class="stage-pending-thumb" :src="scenePendingImage" mode="aspectFill" />
        <view class="stage-pending-remove" @tap.stop="clearScenePendingImage">
          <view class="pending-x" />
        </view>
      </view>

      <view v-if="feeding" class="feed-status">
        <text class="feed-status-text">消化中…</text>
      </view>

      <!-- 微信式：输入条 + 加号面板；键盘只顶整块 composer -->
      <view class="stage-composer" :style="composerStyle">
        <view class="stage-input-bar">
          <textarea
            v-if="!sceneVoiceMode"
            v-model="sceneInput"
            class="scene-input"
            :focus="sceneInputFocus"
            :disabled="sceneBusy"
            :auto-height="true"
            :maxlength="2000"
            :show-confirm-bar="false"
            confirm-type="send"
            placeholder="说点什么…"
            placeholder-class="scene-input-ph"
            :adjust-position="false"
            :cursor-spacing="16"
            @focus="onSceneInputFocus"
            @confirm="sendSceneMsg"
          />
          <view
            v-else
            class="scene-voice-hold"
            :class="{ recording: sceneVoiceRecording, recognizing: sceneVoiceRecognizing }"
            @touchstart.stop="onSceneVoiceStart"
            @touchend.stop="onSceneVoiceEnd"
            @touchcancel.stop="onSceneVoiceEnd"
          >
            <text class="scene-voice-text">{{ sceneVoiceLabel }}</text>
          </view>
          <view
            class="scene-plus"
            :class="{ open: plusPanelOpen }"
            hover-class="scene-plus--active"
            @tap="togglePlusPanel"
          >
            <view class="scene-plus-cross">
              <view class="plus-bar a" />
              <view class="plus-bar b" />
            </view>
          </view>
        </view>

        <view v-if="plusPanelOpen" class="plus-panel">
          <view class="plus-grid">
            <view class="plus-cell" hover-class="plus-cell--active" @tap="onPlusAction('feed')">
              <view class="plus-ico-box">
                <view class="ico-feed">
                  <view class="ico-feed-bowl" />
                  <view class="ico-feed-steam s1" />
                  <view class="ico-feed-steam s2" />
                </view>
              </view>
              <text class="plus-label">投喂</text>
            </view>
            <view class="plus-cell" hover-class="plus-cell--active" @tap="onPlusAction('image')">
              <view class="plus-ico-box">
                <view class="ico-pic">
                  <view class="ico-pic-frame" />
                  <view class="ico-pic-mtn" />
                  <view class="ico-pic-sun" />
                </view>
              </view>
              <text class="plus-label">图片</text>
            </view>
            <view
              v-if="!sceneVoiceMode"
              class="plus-cell"
              hover-class="plus-cell--active"
              @tap="onPlusAction('voice')"
            >
              <view class="plus-ico-box">
                <view class="ico-mic">
                  <view class="ico-mic-head" />
                  <view class="ico-mic-stem" />
                  <view class="ico-mic-base" />
                </view>
              </view>
              <text class="plus-label">语音</text>
            </view>
            <view
              v-else
              class="plus-cell"
              hover-class="plus-cell--active"
              @tap="onPlusAction('keyboard')"
            >
              <view class="plus-ico-box">
                <view class="ico-kb">
                  <view class="ico-kb-row r1" />
                  <view class="ico-kb-row r2" />
                  <view class="ico-kb-space" />
                </view>
              </view>
              <text class="plus-label">键盘</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <TreasureSheet :show="treasureOpen" @close="treasureOpen = false" @action="onTreasureAction" />
    <TwinFeedSheet
      v-if="feedOpen"
      :show="feedOpen"
      @close="feedOpen = false"
      @confirm="startFeeding"
    />
    <TwinRecipeSheet v-if="recipeOpen" :show="recipeOpen" @close="recipeOpen = false" />
    <TwinProfileSheet v-if="profileOpen" :show="profileOpen" @close="profileOpen = false" />
    <TwinPersonaSheet v-if="personaOpen" :show="personaOpen" @close="personaOpen = false" />
    <TwinStatusSheet
      v-if="statusOpen"
      :show="statusOpen"
      @close="statusOpen = false"
      @saved="onStatusSaved"
    />
    <TwinMemorySheet v-if="memoryOpen" :show="memoryOpen" @close="memoryOpen = false" />
  </view>
</template>

<script setup>
/**
 * 分身舞台：全屏聊天 + 顶栏 3D；投喂/人设等并入本页，不再跳分身页/弹聊天框
 */
import * as THREE from '../../libs/build/three.module.js'
import { WechatPlatform } from '../../libs/src/WechatPlatform/index.js'
import { GLTFLoader } from '../../libs/examples/jsm/loaders/GLTFLoader.js'
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import TreasureSheet from '../../components/TreasureSheet.vue'
import TwinFeedSheet from '@/components/TwinFeedSheet.vue'
import TwinRecipeSheet from '@/components/TwinRecipeSheet.vue'
import TwinProfileSheet from '@/components/TwinProfileSheet.vue'
import TwinPersonaSheet from '@/components/TwinPersonaSheet.vue'
import TwinStatusSheet from '@/components/TwinStatusSheet.vue'
import TwinMemorySheet from '@/components/TwinMemorySheet.vue'
import { sendTwinText, setTwinManualFeedBusy } from '@/api/twinChat'
import {
  loadChat,
  saveChat,
  getGrowth,
  getStatus,
  getAvatar,
  getPersona,
  listMemories,
  emptyStatus,
  uploadTwinAvatar,
  digestTwinMaterial,
  addFeedRecord,
  addGrowthExp,
  addMemoryUnique,
  replaceTaggedMemory,
  stageForLevel,
  expToNext,
  calcFeedExp,
  isStatusPlanFresh,
} from '@/api/aiTwin'
import { compressImageForChat } from '@/code-assist/api'
import { startVoiceInput, stopVoiceInput, cancelVoiceInput } from '@/code-assist/voiceInput'
import { getPhotoTempUrls } from '@/api/album'

/** 云存储模型 fileID（控制台上传 twin/model/twin-model.glb） */
const TWIN_MODEL_FILE_ID =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/twin/model/twin-model.glb'

/** 聊天「我」侧头像 */
const USER_AVATAR_FILE_ID =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/album/3281793004017_.pic.jpg'

/** 运行时解析 fileID（支持存储覆盖）；不直接判常量，避免打包器把空值分支折叠掉 */
function resolveModelFileId() {
  try {
    const stored = uni.getStorageSync('twin_model_file_id')
    if (stored) return String(stored)
  } catch (e) {
    // ignore
  }
  return TWIN_MODEL_FILE_ID
}

/**
 * 篮球命中区域（twin-model.glb 顶点聚类实测，模型局部居中后坐标）：
 * 模型根节点带 +90° X 旋转，场景空间身高轴为 Y（0~1.098）、前后轴为 Z（正面 +Z）
 * 篮球托在身前偏左，包围盒 x[-0.26,-0.10] y[0.20,0.44] z[0.06,0.24]
 * 命中条件：胸前高度带（y 19%~45%）且在身体正面之前（z ≥ 0.06，身体正面在 z≤0.05 内）
 */
const BALL_REGION = {
  yMin: 0.19,
  yMax: 0.45,
  zFront: 0.06,
}

const QUICK_CHIPS_FALLBACK = ['今天过得怎么样', '随便聊聊', '你在干嘛']
const TIME_GAP_MS = 5 * 60 * 1000

const loading = ref(true)
const fallback = ref(false)
const loadText = ref('初始化…')
const loadPct = ref(0)
const treasureOpen = ref(false)
const feedOpen = ref(false)
const recipeOpen = ref(false)
const profileOpen = ref(false)
const personaOpen = ref(false)
const statusOpen = ref(false)
const memoryOpen = ref(false)
const sceneInput = ref('')
const sceneInputFocus = ref(false)
const sceneThinking = ref(false)
const sceneBusy = ref(false)
const sceneMessages = ref([])
const scrollInto = ref('')
const sceneKbHeight = ref(0)
const scenePendingImage = ref('')
const sceneVoiceMode = ref(false)
const sceneVoiceRecording = ref(false)
const sceneVoiceRecognizing = ref(false)
const plusPanelOpen = ref(false)
const statusBarHeight = ref(20)
const windowHeight = ref(667)
const sheetTop = ref(220)
const sheetDragging = ref(false)
const chatExpanded = ref(false)
const chatScrollTop = ref(0)

const avatarSrc = ref('/static/twin/avatar.png')
/** 分包里 cloud:// 会被当成相对路径，必须用 https 临时链（同相册预览 getPhotoTempUrls） */
const userAvatarSrc = ref('')
const avatarBusy = ref(false)
const growth = ref({ level: 1, exp: 0, totalFeeds: 0, totalChars: 0 })
const status = ref(emptyStatus())
const memories = ref([])
const greetText = ref('')
const feedingPhase = ref('idle')
const flyTier = ref('feast')
const flyGo = ref(false)
const floatText = ref('')
const autoFeedFx = ref(null)
const evolveInfo = ref(null)

let greetTimer = null
let evolveTimer = null
let extrasLoaded = false
let extrasPromise = null
const feeding = computed(function () {
  return feedingPhase.value !== 'idle'
})
const stage = computed(function () {
  return stageForLevel(growth.value.level)
})
const expNext = computed(function () {
  return expToNext(growth.value.level)
})
const expPct = computed(function () {
  const next = expNext.value || 1
  return Math.min(100, Math.floor(((growth.value.exp || 0) / next) * 100))
})

const hasChatMsgs = computed(function () {
  const list = sceneMessages.value
  for (let i = 0; i < list.length; i++) {
    const r = list[i].role
    if (r === 'user' || r === 'assistant') return true
  }
  return false
})

const displayChips = computed(function () {
  const chips = []
  const st = status.value || {}
  const doing = (st.nowDoing || '').trim()
  const next = (st.nextActions || '').trim()
  if (doing) chips.push('你还在' + doing.slice(0, 12) + '吗？')
  if (next) chips.push('提醒我：' + next.slice(0, 14))
  for (let i = 0; i < QUICK_CHIPS_FALLBACK.length && chips.length < 3; i++) {
    chips.push(QUICK_CHIPS_FALLBACK[i])
  }
  return chips.slice(0, 3)
})

const displayMessages = computed(function () {
  const list = sceneMessages.value
  const out = []
  let lastAt = 0
  let lastRole = ''
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    const item = {
      role: m.role,
      content: m.content || '',
      image: m.image || '',
      at: m.at || 0,
      showTime: false,
      timeLabel: '',
    }
    if (m.role !== 'system' && item.at) {
      const gap = item.at - lastAt
      if (!lastAt || gap > TIME_GAP_MS || m.role !== lastRole) {
        item.showTime = true
        item.timeLabel = formatMsgTime(item.at)
      }
      lastAt = item.at
      lastRole = m.role
    }
    out.push(item)
  }
  return out
})

let kbBound = false

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatMsgTime(at) {
  const d = new Date(at)
  const now = new Date()
  const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return hm
  return d.getMonth() + 1 + '/' + d.getDate() + ' ' + hm
}

function copyMsg(m) {
  const text = (m && m.content) || ''
  if (!text) return
  uni.setClipboardData({
    data: text,
    success: function () {
      uni.showToast({ title: '已复制', icon: 'none' })
    },
  })
}

function previewMsgImage(src) {
  if (!src) return
  uni.previewImage({ urls: [src], current: src })
}

/** 模型本地路径：onMounted 提前启动，与画布初始化并行 */
let modelPathPromise = null

/** Sheet 收起顶边 = 短 hero 高度；展开顶边 = 状态栏缝 */
const expandedTop = computed(function () {
  return statusBarHeight.value + 12
})
const collapsedTop = computed(function () {
  return Math.round(windowHeight.value * 0.32) + statusBarHeight.value
})
/** 0 收起 → 1 全屏 */
const sheetProgress = computed(function () {
  const c = collapsedTop.value
  const e = expandedTop.value
  const span = c - e
  if (span <= 0) return 0
  return Math.max(0, Math.min(1, (c - sheetTop.value) / span))
})

const heroCombinedStyle = computed(function () {
  const p = sheetProgress.value
  return {
    height: collapsedTop.value + 'px',
    opacity: 1 - p * 0.65,
    transform: 'scale(' + (1 - p * 0.04) + ')',
  }
})

/** 仅让出状态栏，模型上移对齐胶囊 */
const canvasWrapStyle = computed(function () {
  return { top: statusBarHeight.value + 'px' }
})

const chatSheetStyle = computed(function () {
  const p = sheetProgress.value
  const radius = Math.round(28 * (1 - p))
  const style = {
    top: sheetTop.value + 'px',
    borderRadius: radius + 'rpx ' + radius + 'rpx 0 0',
  }
  if (!sheetDragging.value) {
    style.transition = 'top 0.32s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.32s ease'
  }
  return style
})

/** 同小黑：只抬输入条；禁止 stage-chat translateY 顶整页 */
const composerStyle = computed(function () {
  if (!sceneKbHeight.value) return {}
  return { marginBottom: sceneKbHeight.value + 'px' }
})

/* ---------- 聊天 Sheet 手势 ---------- */
let sheetTouch = null

function clampSheetTop(v) {
  const lo = expandedTop.value
  const hi = collapsedTop.value
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

function syncRafWithSheet() {
  if (chatExpanded.value) {
    stopRaf()
    return
  }
  if (canvasNode && renderer && !loading.value && !fallback.value) startRaf()
}

function snapSheet(forceExpand) {
  sheetDragging.value = false
  let expand = !!forceExpand
  if (forceExpand === undefined || forceExpand === null) {
    const mid = (collapsedTop.value + expandedTop.value) / 2
    expand = sheetTop.value < mid
    if (sheetTouch && sheetTouch.velY !== undefined) {
      if (sheetTouch.velY < -0.45) expand = true
      else if (sheetTouch.velY > 0.45) expand = false
    }
  }
  chatExpanded.value = expand
  sheetTop.value = expand ? expandedTop.value : collapsedTop.value
  sheetTouch = null
  syncRafWithSheet()
}

function onGrabberTouchStart(e) {
  const t = e.touches && e.touches[0]
  if (!t) return
  sheetDragging.value = true
  const y = t.clientY != null ? t.clientY : t.y
  sheetTouch = {
    startY: y,
    startTop: sheetTop.value,
    lastY: y,
    lastT: Date.now(),
    velY: 0,
    claimed: true,
  }
}

function onGrabberTouchMove(e) {
  if (!sheetTouch) return
  const t = e.touches && e.touches[0]
  if (!t) return
  const y = t.clientY != null ? t.clientY : t.y
  const now = Date.now()
  const dt = Math.max(1, now - sheetTouch.lastT)
  sheetTouch.velY = (y - sheetTouch.lastY) / dt
  sheetTouch.lastY = y
  sheetTouch.lastT = now
  sheetTop.value = clampSheetTop(sheetTouch.startTop + (y - sheetTouch.startY))
}

function onGrabberTouchEnd() {
  if (!sheetTouch) {
    sheetDragging.value = false
    return
  }
  snapSheet()
}

function onChatScroll(e) {
  const d = e && e.detail
  chatScrollTop.value = (d && d.scrollTop) || 0
}

function onScrollTouchStart(e) {
  if (sheetDragging.value) return
  const t = e.touches && e.touches[0]
  if (!t) return
  const y = t.clientY != null ? t.clientY : t.y
  sheetTouch = {
    startY: y,
    startTop: sheetTop.value,
    lastY: y,
    lastT: Date.now(),
    velY: 0,
    claimed: false,
  }
}

function onScrollTouchMove(e) {
  if (!sheetTouch) return
  const t = e.touches && e.touches[0]
  if (!t) return
  const y = t.clientY != null ? t.clientY : t.y
  const dy = y - sheetTouch.startY
  if (!sheetTouch.claimed) {
    if (!chatExpanded.value && dy < -10) {
      sheetTouch.claimed = true
      sheetDragging.value = true
      sheetTouch.startTop = sheetTop.value
      sheetTouch.startY = y
    } else if (chatExpanded.value && chatScrollTop.value <= 2 && dy > 10) {
      sheetTouch.claimed = true
      sheetDragging.value = true
      sheetTouch.startTop = sheetTop.value
      sheetTouch.startY = y
    } else if (Math.abs(dy) > 12) {
      sheetTouch = null
      return
    } else {
      return
    }
  }
  const now = Date.now()
  const dt = Math.max(1, now - sheetTouch.lastT)
  sheetTouch.velY = (y - sheetTouch.lastY) / dt
  sheetTouch.lastY = y
  sheetTouch.lastT = now
  sheetTop.value = clampSheetTop(sheetTouch.startTop + (y - sheetTouch.startY))
}

function onScrollTouchEnd() {
  if (!sheetTouch) return
  if (sheetTouch.claimed) {
    snapSheet()
    return
  }
  sheetTouch = null
}

const sceneVoiceLabel = computed(function () {
  if (sceneVoiceRecognizing.value) return '识别中…'
  if (sceneVoiceRecording.value) return '松开 发送'
  return '按住 说话'
})

function bindKeyboard() {
  if (kbBound) return
  kbBound = true
  uni.onKeyboardHeightChange(function (res) {
    const h = (res && res.height) || 0
    const prev = sceneKbHeight.value
    sceneKbHeight.value = h
    if (h > 0 && prev <= 0) scrollChatToBottom()
  })
}

function unbindKeyboard() {
  if (!kbBound) return
  kbBound = false
  try {
    uni.offKeyboardHeightChange()
  } catch (e) {
    // ignore
  }
  sceneKbHeight.value = 0
}

function sendQuickChip(text) {
  if (!text || sceneBusy.value) return
  sceneInput.value = text
  sendSceneMsg()
}

let canvasNode = null
let platform = null
let renderer = null
let scene = null
let camera = null
let modelRoot = null
let pitchNode = null
let mixer = null
let raycaster = null
let rafId = null
let cssW = 0
let cssH = 0
let modelBox = null

/* ---------- 生命周期 ---------- */

onMounted(async function () {
  try {
    const sys = uni.getSystemInfoSync()
    statusBarHeight.value = sys.statusBarHeight || 20
    windowHeight.value = sys.windowHeight || 667
  } catch (e) {
    // ignore
  }
  sheetTop.value = collapsedTop.value
  chatExpanded.value = false
  // 身份判定不阻塞舞台：云函数 login 与模型下载并行跑
  loadOwnerFlag().catch(function () {})
  bindKeyboard()
  modelPathPromise = fetchModelPath()
  resolveUserAvatar()
  // 等 hero 布局完成后再量 canvas，避免高度为 0
  nextTick(function () {
    initStage()
  })
  refreshSceneChat().catch(function (err) {
    console.warn('舞台对话历史加载失败', err)
  })
  loadTwinCritical()
    .then(function () {
      showGreeting()
    })
    .catch(function (err) {
      console.warn('分身资料加载失败', err)
      showGreeting()
    })
  loadTwinExtras().catch(function (err) {
    console.warn('分身扩展加载失败', err)
  })
})

/** 分包内 cloud:// 会变成相对路径；先客户端换链，相册权限不够再走 getMusicUrl */
function cloudFileToHttps(fileID) {
  if (!fileID || String(fileID).indexOf('cloud://') !== 0) {
    return Promise.resolve(fileID || '')
  }
  return getPhotoTempUrls([fileID])
    .then(function (urls) {
      if (urls && urls[0]) return urls[0]
      return wx.cloud
        .callFunction({
          name: 'getMusicUrl',
          data: { fileID: fileID },
        })
        .then(function (res) {
          const body = (res && res.result) || {}
          if (body.ok && body.tempFileURL) return body.tempFileURL
          console.warn('getMusicUrl 换链失败', body.errMsg || body)
          return ''
        })
    })
}

function resolveUserAvatar() {
  cloudFileToHttps(USER_AVATAR_FILE_ID)
    .then(function (url) {
      if (url) {
        userAvatarSrc.value = url
        return
      }
      console.warn('用户头像换链为空')
    })
    .catch(function (err) {
      console.warn('用户头像换链失败', err)
    })
}

onShow(function () {
  // 回前台恢复渲染（Sheet 全屏展开时不跑 3D）
  syncRafWithSheet()
})

onHide(function () {
  stopRaf()
})

onUnmounted(function () {
  unbindKeyboard()
  if (greetTimer) {
    clearTimeout(greetTimer)
    greetTimer = null
  }
  if (evolveTimer) {
    clearTimeout(evolveTimer)
    evolveTimer = null
  }
  stopRaf()
  cancelVoiceInput()
  if (mixer) mixer.stopAllAction()
  if (modelRoot) {
    modelRoot.traverse(function (o) {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i]
          for (const key in m) {
            if (m[key] && m[key].isTexture) m[key].dispose()
          }
          m.dispose()
        }
      }
    })
  }
  if (renderer) renderer.dispose()
  if (platform) platform.dispose()
})

/* ---------- 初始化 ---------- */

function initStage(retry) {
  loadText.value = '获取模型…'
  const query = uni.createSelectorQuery()
  query
    .select('#stage-canvas')
    .fields({ node: true, size: true })
    .exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        enterFallback('画布不可用')
        return
      }
      // hero 首帧可能尚未算出高度，短暂重试
      if ((!res[0].width || !res[0].height) && (retry || 0) < 8) {
        setTimeout(function () {
          initStage((retry || 0) + 1)
        }, 50)
        return
      }
      if (!res[0].width || !res[0].height) {
        enterFallback('画布尺寸异常')
        return
      }
      try {
        setupCanvas(res[0])
      } catch (err) {
        console.error('3D 初始化失败', err)
        enterFallback('3D 初始化失败')
        return
      }
      loadModel()
    })
}

function setupCanvas(info) {
  canvasNode = info.node
  cssW = info.width
  cssH = info.height
  const sys = wx.getSystemInfoSync()
  const dpr = Math.min(2, sys.pixelRatio || 2)
  canvasNode.width = Math.floor(cssW * dpr)
  canvasNode.height = Math.floor(cssH * dpr)

  platform = new WechatPlatform(canvasNode, canvasNode.width, canvasNode.height)
  THREE.PLATFORM.set(platform)

  // 平台默认把所有 canvas 创建请求都指回主画布（webgl 专用），
  // 但 three 的贴图解码/取像素需要 2D 画布——这里改用离屏 2D 画布，
  // 否则触发 "Invalid context type [2d] for Canvas#getContext"
  const rawCreateNS = platform.document.createElementNS
  platform.document.createElementNS = function (ns, type) {
    if (type === 'canvas') {
      return wx.createOffscreenCanvas({ type: '2d', width: 300, height: 300 })
    }
    return rawCreateNS.call(platform.document, ns, type)
  }

  // 小程序 canvas 仅支持 webgl1：主动建好上下文传入，
  // 避免 three 优先尝试 webgl2 时被微信抛 "Invalid context type"
  const gl = canvasNode.getContext('webgl', { antialias: true, alpha: true })
  if (!gl) {
    enterFallback('WebGL 不可用')
    return
  }
  renderer = new THREE.WebGLRenderer({
    canvas: canvasNode,
    context: gl,
    antialias: true,
    alpha: true,
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputEncoding = THREE.sRGBEncoding

  scene = new THREE.Scene()
  // 矮窗全身：略远，避免脚被裁
  camera = new THREE.PerspectiveCamera(38, cssW / cssH, 0.1, 200)
  camera.position.set(0, 0.1, 2.8)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0))
  const dir = new THREE.DirectionalLight(0xffffff, 1.3)
  dir.position.set(3, 6, 5)
  scene.add(dir)

  raycaster = new THREE.Raycaster()
}

/* ---------- 模型获取（本地缓存 → 云存储） ---------- */

function fsManager() {
  return wx.getFileSystemManager()
}

function cachedPath(fileId) {
  // fileID 里含路径与时间戳特征，直接作缓存文件名（消毒非法字符）
  const safe = String(fileId)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-40)
  return wx.env.USER_DATA_PATH + '/twin-model-' + safe + '.glb'
}

function statOk(path) {
  return new Promise(function (resolve) {
    fsManager().access({
      path: path,
      success: function () {
        resolve(true)
      },
      fail: function () {
        resolve(false)
      },
    })
  })
}

function downloadFile(fileId) {
  // 模型走 getMusicUrl 云函数换链（管理端权限，不受存储权限限制，
  // 与音乐/壁纸同一套机制），再按 https 下载到临时目录
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: 'getMusicUrl',
      data: { fileID: fileId },
      success: function (res) {
        const body = (res && res.result) || {}
        if (body.ok && body.tempFileURL) {
          const task = uni.downloadFile({
            url: body.tempFileURL,
            success: function (r) {
              if (r.statusCode === 200 && r.tempFilePath) resolve(r.tempFilePath)
              else reject(new Error('下载失败 ' + r.statusCode))
            },
            fail: function (err) {
              reject(new Error((err && err.errMsg) || '下载失败'))
            },
          })
          // 真实下载进度喂给加载动画
          if (task && task.onProgressUpdate) {
            task.onProgressUpdate(function (p) {
              const pct = (p && p.progress) || 0
              if (pct > 0) loadPct.value = Math.min(99, pct)
            })
          }
          return
        }
        reject(new Error(body.errMsg || '换链失败'))
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '换链失败'))
      },
    })
  })
}

function copyFile(src, dest) {
  return new Promise(function (resolve, reject) {
    fsManager().copyFile({
      srcPath: src,
      destPath: dest,
      success: resolve,
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '缓存失败'))
      },
    })
  })
}

/**
 * 获取模型本地路径（页面一进来就调用，不依赖画布）：
 * 命中本地缓存直接返回；否则云端换链下载 → 落缓存（失败不阻断，用临时文件）
 */
function fetchModelPath() {
  const fileId = resolveModelFileId()
  if (!fileId) return Promise.reject(new Error('未配置模型 fileID'))
  loadText.value = '获取模型…'
  const cached = cachedPath(fileId)
  return statOk(cached).then(function (ok) {
    if (ok) return cached
    loadText.value = '下载模型…'
    return downloadFile(fileId).then(function (temp) {
      return copyFile(temp, cached).then(
        function () {
          return cached
        },
        function () {
          return temp
        }
      )
    })
  })
}

async function loadModel() {
  const fileId = resolveModelFileId()
  if (!fileId) {
    enterFallback('未配置模型 fileID')
    return
  }
  try {
    const path = await modelPathPromise
    loadText.value = '解析模型…'
    loadPct.value = 100
    parseLocal(path)
  } catch (err) {
    console.error('模型获取失败', err)
    // 缓存坏了（fileID 变更后残留等）：清掉重来一次
    try {
      fsManager().unlink({ filePath: cachedPath(fileId), fail: function () {} })
    } catch (e2) {}
    enterFallback('模型加载失败')
  }
}

/** 读本地文件为 ArrayBuffer 后走 GLTFLoader.parse：
 * 真机本地路径是 wxfile:// 协议，走 GLTFLoader.load 的网络分支会报 invalid url */
function parseLocal(path) {
  fsManager().readFile({
    filePath: path,
    success: function (res) {
      const loader = new GLTFLoader()
      try {
        loader.parse(
          res.data,
          '',
          function (gltf) {
            buildModel(gltf)
          },
          function (err) {
            console.error('模型解析失败', err)
            enterFallback('模型解析失败')
          }
        )
      } catch (err) {
        console.error('模型解析异常', err)
        enterFallback('模型解析失败')
      }
    },
    fail: function (err) {
      console.error('模型读取失败', err)
      enterFallback('模型解析失败')
    },
  })
}

/* ---------- 场景构建与渲染 ---------- */

function buildModel(gltf) {
  modelRoot = gltf.scene

  // 取景：包围盒居中，镜头对准上半身
  modelBox = new THREE.Box3().setFromObject(modelRoot)
  const size = modelBox.getSize(new THREE.Vector3())
  const center = modelBox.getCenter(new THREE.Vector3())
  modelRoot.position.x -= center.x
  modelRoot.position.y -= center.y
  modelRoot.position.z -= center.z
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  // 拉远缩小，全身进矮窗，脚不被聊天区裁掉
  camera.position.set(0, size.y * 0.02, maxDim * 2.05)
  camera.lookAt(0, 0, 0)

  // 转台结构：父组管俯仰（上下），子节点管偏航（左右）
  pitchNode = new THREE.Group()
  pitchNode.add(modelRoot)
  scene.add(pitchNode)

  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(modelRoot)
    mixer.clipAction(gltf.animations[0]).play()
  }

  loading.value = false
  startRaf()
}

function startRaf() {
  if (rafId) return
  const clock = new THREE.Clock()
  const loop = function () {
    rafId = canvasNode.requestAnimationFrame(loop)
    const dt = clock.getDelta()
    if (mixer) mixer.update(dt)
    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  loop()
}

function stopRaf() {
  if (rafId && canvasNode) {
    canvasNode.cancelAnimationFrame(rafId)
    rafId = null
  }
}

/* ---------- 触摸交互 ---------- */

let touchStart = null
let dragDistance = 0

function onTouchStart(e) {
  const t = e.touches && e.touches[0]
  if (!t) return
  touchStart = { x: t.x, y: t.y, time: Date.now() }
  dragDistance = 0
}

function onTouchMove(e) {
  const t = e.touches && e.touches[0]
  if (!t || !touchStart) return
  const dx = t.x - touchStart.x
  const dy = t.y - touchStart.y
  dragDistance = Math.max(dragDistance, Math.abs(dx), Math.abs(dy))
  // 双轴旋转：左右=偏航（无限制），上下=俯仰（±70° 防翻转）
  if (modelRoot) modelRoot.rotation.y += dx * 0.01
  if (pitchNode) {
    pitchNode.rotation.x = THREE.MathUtils.clamp(pitchNode.rotation.x + dy * 0.008, -1.2, 1.2)
  }
  touchStart.x = t.x
  touchStart.y = t.y
}

function onTouchEnd(e) {
  if (!touchStart) return
  const moved = dragDistance > 8
  const t = (e.changedTouches && e.changedTouches[0]) || null
  const dt = Date.now() - touchStart.time
  touchStart = null
  if (moved || dt > 600 || !t) return
  handleTap(t.x, t.y)
}

/** 点篮球区域 → 百宝箱；点其他部位 / 空白处 → 无操作 */
function handleTap(x, y) {
  // 模型未就绪时忽略点击，防误触
  if (!modelRoot || !raycaster || !camera || !modelBox) return
  const ndc = new THREE.Vector2((x / cssW) * 2 - 1, -(y / cssH) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  const hits = raycaster.intersectObject(modelRoot, true)
  if (!hits.length) return
  const hit = hits[0]
  // worldToLocal 用 modelRoot 的矩阵逆，会抵消掉 buildModel 里 position=-center
  // 的平移，返回未居中坐标；须再减 center 才是 BALL_REGION 实测所在的居中空间
  const center = modelBox.getCenter(new THREE.Vector3())
  const local = modelRoot.worldToLocal(hit.point.clone()).sub(center)
  if (local.y >= BALL_REGION.yMin && local.y <= BALL_REGION.yMax && local.z >= BALL_REGION.zFront) {
    openTreasure()
  }
}

/* ---------- 全屏对话 ---------- */

async function refreshSceneChat() {
  try {
    const prev = sceneMessages.value
    const list = (await loadChat()) || []
    const out = []
    for (let i = 0; i < list.length; i++) {
      const m = list[i]
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
      const content = m.content != null ? String(m.content) : ''
      if (!content) continue
      const item = { role: m.role, content: content }
      if (m.at) item.at = m.at
      out.push(item)
    }
    // 云端不存图：按顺序把本地用户消息的临时图拼回
    let prevUser = 0
    for (let i = 0; i < out.length; i++) {
      if (out[i].role !== 'user') continue
      while (prevUser < prev.length) {
        const p = prev[prevUser]
        prevUser += 1
        if (p.role !== 'user') continue
        if (p.image) out[i].image = p.image
        break
      }
    }
    const localExtras = []
    for (let j = 0; j < prev.length; j++) {
      if (prev[j].role === 'system') localExtras.push(prev[j])
    }
    sceneMessages.value = out.concat(localExtras)
  } catch (err) {
    console.warn('刷新舞台对话失败', err)
  }
  scrollChatToBottom()
}

function scrollChatToBottom() {
  nextTick(function () {
    scrollInto.value = ''
    nextTick(function () {
      if (sceneThinking.value) {
        scrollInto.value = 'msg-thinking'
        return
      }
      const n = sceneMessages.value.length
      if (n > 0) scrollInto.value = 'msg-' + (n - 1)
    })
  })
}

async function sendSceneMsg() {
  const t = (sceneInput.value || '').trim()
  const img = scenePendingImage.value
  if ((!t && !img) || sceneBusy.value) return
  closePlusPanel()
  // 一发送就收起键盘，等回复时不被挡住
  sceneInputFocus.value = false
  sceneBusy.value = true
  sceneInput.value = ''
  scenePendingImage.value = ''
  const now = Date.now()
  const userMsg = { role: 'user', content: t || '', at: now }
  if (img) {
    userMsg.image = img
    if (!userMsg.content) userMsg.content = '（附图）'
  }
  sceneMessages.value.push(userMsg)
  sceneThinking.value = true
  scrollChatToBottom()
  try {
    let sendRes = null
    if (img) {
      const compressed = await compressImageForChat(img)
      sendRes = await sendTwinText(t, compressed)
    } else {
      sendRes = await sendTwinText(t)
    }
    sceneThinking.value = false
    await refreshSceneChat()
    if (sendRes && sendRes.autoFeed) await applyAutoFeedResult(sendRes.autoFeed)
  } catch (err) {
    console.error('场景对话失败', err)
    sceneThinking.value = false
    refreshSceneChat().catch(function () {})
    uni.showToast({ title: String((err && err.message) || '回复失败').slice(0, 30), icon: 'none' })
  } finally {
    sceneBusy.value = false
    // 发送后收起键盘，避免挡住分身回复；继续聊时点输入框即可
    sceneInputFocus.value = false
  }
}

/* ---------- 场景条：图片 / 语音 ---------- */

function pickSceneImage() {
  if (sceneBusy.value) return
  uni.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: function (res) {
      const files = res.tempFiles || []
      if (!files.length || !files[0].tempFilePath) return
      scenePendingImage.value = files[0].tempFilePath
    },
    fail: function (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) return
      uni.showToast({ title: '选图失败', icon: 'none' })
    },
  })
}

function clearScenePendingImage() {
  scenePendingImage.value = ''
}

function enterSceneVoice() {
  if (sceneBusy.value || sceneVoiceRecording.value) return
  sceneVoiceMode.value = true
  sceneInputFocus.value = false
}

function exitSceneVoice() {
  if (sceneVoiceRecording.value || sceneVoiceRecognizing.value) {
    cancelVoiceInput()
    sceneVoiceRecording.value = false
    sceneVoiceRecognizing.value = false
  }
  sceneVoiceMode.value = false
}

function closePlusPanel() {
  plusPanelOpen.value = false
}

/** 微信式：点 + 收起键盘、展开图标面板；再点收起（+ 转 ×） */
function togglePlusPanel() {
  if (sceneBusy.value) return
  if (plusPanelOpen.value) {
    closePlusPanel()
    return
  }
  sceneInputFocus.value = false
  plusPanelOpen.value = true
}

function onSceneInputFocus() {
  closePlusPanel()
}

function onPlusAction(kind) {
  closePlusPanel()
  if (kind === 'feed') openFeed()
  else if (kind === 'image') pickSceneImage()
  else if (kind === 'voice') enterSceneVoice()
  else if (kind === 'keyboard') exitSceneVoice()
}

function onSceneVoiceStart() {
  if (!sceneVoiceMode.value || sceneBusy.value || sceneVoiceRecognizing.value) return
  sceneVoiceRecording.value = true
  startVoiceInput({
    onRecognizing: function () {
      sceneVoiceRecognizing.value = true
    },
    onFinal: function (text) {
      sceneVoiceRecording.value = false
      sceneVoiceRecognizing.value = false
      if (!text) return
      // 识别完成自动发送
      sceneInput.value = text
      sendSceneMsg()
    },
    onError: function (msg) {
      sceneVoiceRecording.value = false
      sceneVoiceRecognizing.value = false
      uni.showToast({ title: msg || '语音识别失败', icon: 'none' })
    },
  })
}

function onSceneVoiceEnd() {
  if (!sceneVoiceRecording.value) return
  sceneVoiceRecording.value = false
  stopVoiceInput()
}

/* ---------- 功能入口 ---------- */

function openTreasure() {
  treasureOpen.value = true
}

function onGrowthTap() {
  uni.showActionSheet({
    itemList: ['投喂', '打开百宝箱'],
    success: function (res) {
      if (res.tapIndex === 0) openFeed()
      else if (res.tapIndex === 1) openTreasure()
    },
  })
}

function onTreasureAction(action) {
  if (action === 'feed') openFeed()
  else if (action === 'recipe') recipeOpen.value = true
  else if (action === 'persona') personaOpen.value = true
  else if (action === 'status') statusOpen.value = true
  else if (action === 'memory') memoryOpen.value = true
  else if (action === 'profile') profileOpen.value = true
  else if (action === 'clearChat') clearSceneChat()
  else if (action === 'avatar') pickAvatar()
}

function clearSceneChat() {
  uni.showModal({
    title: '清空对话',
    content: '确定清空与分身的聊天记录？',
    success: function (res) {
      if (!res.confirm) return
      saveChat([])
        .then(function () {
          sceneMessages.value = []
          uni.showToast({ title: '已清空', icon: 'none' })
        })
        .catch(function (err) {
          console.warn('清空对话失败', err)
          uni.showToast({ title: '清空失败', icon: 'none' })
        })
    },
  })
}

/* ---------- 分身成长 / 投喂 / 人设 ---------- */

async function loadTwinCritical() {
  const parts = await Promise.all([getAvatar(), getGrowth(), getStatus()])
  const avatar = parts[0]
  if (avatar && avatar.mainFileID) {
    const url = await cloudFileToHttps(avatar.mainFileID)
    avatarSrc.value = url || '/static/twin/avatar.png'
  } else {
    avatarSrc.value = '/static/twin/avatar.png'
  }
  growth.value = parts[1]
  status.value = parts[2]
}

async function loadTwinExtras() {
  if (extrasLoaded) return
  if (extrasPromise) {
    await extrasPromise
    return
  }
  extrasPromise = Promise.all([getPersona(), listMemories()])
    .then(function (parts) {
      memories.value = parts[1] || []
      extrasLoaded = true
      extrasPromise = null
      if (greetText.value) showGreeting()
    })
    .catch(function (err) {
      extrasPromise = null
      throw err
    })
  await extrasPromise
}

async function ensureExtras() {
  if (extrasLoaded) return
  await loadTwinExtras()
}

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
  if (isStatusPlanFresh(status.value)) {
    const plan = (status.value.nextActions || '').slice(0, 24)
    if (plan) text += '对了——' + plan + '，别忘了。'
  }
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
  if (!sceneVoiceMode.value) {
    sceneInputFocus.value = false
    nextTick(function () {
      sceneInputFocus.value = true
    })
  }
}

async function onStatusSaved() {
  try {
    status.value = await getStatus()
  } catch (err) {
    console.warn('状态刷新失败', err)
  }
}

function pickAvatar() {
  avatarBusy.value = true
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async function (res) {
      const path = res.tempFilePaths && res.tempFilePaths[0]
      if (!path) {
        avatarBusy.value = false
        return
      }
      try {
        const fileID = await uploadTwinAvatar(path)
        const url = await cloudFileToHttps(fileID)
        avatarSrc.value = url || fileID
        uni.showToast({ title: '形象已更新', icon: 'none' })
      } catch (err) {
        console.error('上传形象失败', err)
        uni.showToast({ title: '上传失败', icon: 'none' })
      }
      avatarBusy.value = false
    },
    fail: function () {
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
  setTwinManualFeedBusy(true)
  flyTier.value = payload.tier || 'feast'
  flyGo.value = false
  feedingPhase.value = 'flying'
  const digestPromise = runDigest(payload)

  await wait(60)
  flyGo.value = true
  await wait(940)
  feedingPhase.value = 'digesting'

  let result = null
  try {
    result = await digestPromise
  } catch (err) {
    console.error('投喂消化失败', err)
    feedingPhase.value = 'idle'
    setTwinManualFeedBusy(false)
    const msg = (err && err.message) || '消化失败'
    uni.showToast({ title: String(msg).slice(0, 40), icon: 'none' })
    return
  }

  floatText.value = '+' + result.exp
  await wait(1200)
  floatText.value = ''
  feedingPhase.value = 'idle'
  setTwinManualFeedBusy(false)

  sceneMessages.value.push({
    role: 'system',
    content: '已消化 · 灵气 +' + result.exp,
    at: Date.now(),
  })
  scrollChatToBottom()

  if (result.levelUp) showEvolve(result)
}

/** 聊天达量自动投喂：Sheet 内光点汇聚动效 → 系统提示 */
async function applyAutoFeedResult(af) {
  if (!af) return
  growth.value = {
    level: af.level,
    exp: af.growthExp,
    totalFeeds: af.totalFeeds,
    totalChars: af.totalChars,
  }
  autoFeedFx.value = { exp: af.exp }
  await wait(1100)
  autoFeedFx.value = null
  sceneMessages.value.push({
    role: 'system',
    content: '自动投喂 · 灵气 +' + af.exp,
    at: Date.now(),
  })
  scrollChatToBottom()
  if (af.levelUp) showEvolve(af)
}

function showEvolve(result) {
  const title = result.stageUp ? result.stage.label : 'Lv.' + result.level
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
    const cloudPath =
      'twin/feed-' + Date.now() + '_' + Math.floor(Math.random() * 10000) + '.' + ext
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
  if (payload.sourceType === 'life' || payload.sourceType === 'text') {
    digest = await digestTwinMaterial({ text: payload.text })
  } else {
    const fileID = await uploadFeedFile(payload.filePath, payload.fileName)
    digest = await digestTwinMaterial({ fileID: fileID })
  }

  const exp = calcFeedExp(digest.chars)
  const title =
    payload.sourceType === 'text' ? payload.text.slice(0, 16) : payload.fileName || '文件食粮'

  await ensureExtras()

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

/* ---------- 兜底 ---------- */

function enterFallback(reason) {
  console.warn('舞台进入兜底模式：', reason)
  loading.value = false
  fallback.value = true
}
</script>

<style lang="scss" scoped>
.stage-page {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  overflow: hidden;
  background: #14101c;
}

.stage-bg-art {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-base {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(165deg, #1e1830 0%, #15101f 48%, #100e18 100%);
}

.bg-glow {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 42%;
  background: radial-gradient(
    ellipse 70% 60% at 50% 40%,
    rgba(232, 200, 120, 0.12) 0%,
    rgba(154, 123, 255, 0.07) 40%,
    transparent 72%
  );
}

.bg-vignette {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: radial-gradient(
    ellipse 90% 70% at 50% 20%,
    transparent 45%,
    rgba(10, 8, 16, 0.4) 100%
  );
}

/* 顶栏短 3D：垫底，Sheet 盖上时渐隐 */
.stage-hero {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  width: 100%;
  min-height: 280rpx;
  z-index: 2;
  overflow: hidden;
  transform-origin: center top;
  will-change: opacity, transform;
}

.stage-canvas-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  overflow: hidden;
}

.stage-canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.stage-fallback {
  position: absolute;
  left: 50%;
  top: 48%;
  z-index: 1;
  transform: translate(-50%, -50%);
}

.fb-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(232, 200, 120, 0.5);
  box-shadow: 0 0 48rpx rgba(232, 200, 120, 0.28);
}

.hero-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 36%;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 0%, rgba(18, 14, 28, 0.92) 100%);
}

.stage-loading {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  width: 420rpx;
}

/* 金色旋转光环 + 呼吸头像 */
.load-ring {
  position: relative;
  width: 220rpx;
  height: 220rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-spin {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  border: 5rpx solid rgba(240, 215, 140, 0.16);
  border-top-color: #f0d78c;
  border-right-color: rgba(240, 215, 140, 0.55);
  box-shadow: 0 0 30rpx rgba(240, 215, 140, 0.22);
  animation: ringSpin 0.9s linear infinite;
}

@keyframes ringSpin {
  to {
    transform: rotate(360deg);
  }
}

.ring-inner {
  width: 172rpx;
  height: 172rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 3rpx solid rgba(232, 200, 120, 0.5);
  animation: logoBreath 2s ease-in-out infinite;
}

.load-logo {
  width: 100%;
  height: 100%;
  display: block;
}

@keyframes logoBreath {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

/* 下载百分比：占位固定高度，无进度时不抖动 */
.load-pct {
  min-height: 44rpx;
  line-height: 44rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #f0d78c;
  letter-spacing: 2rpx;
}

.load-text {
  font-size: 25rpx;
  color: rgba(255, 248, 235, 0.75);
  letter-spacing: 2rpx;
}

.load-track {
  width: 100%;
  height: 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.load-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #f0d78c 0%, #c9a227 100%);
  transition: width 0.3s ease;
}

.load-fill.run {
  animation: loadRun 1.4s ease-in-out infinite;
}

@keyframes loadRun {
  0% {
    width: 10%;
  }
  50% {
    width: 80%;
  }
  100% {
    width: 10%;
  }
}

/* 聊天 Sheet：绝对定位，top 由手势驱动 */
.stage-chat {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgba(18, 14, 28, 0.98);
  z-index: 7;
  box-sizing: border-box;
  overflow: hidden;
  border-top: 1rpx solid rgba(232, 200, 120, 0.28);
  box-shadow: 0 -12rpx 40rpx rgba(0, 0, 0, 0.35);
}

.stage-chat.expanded {
  border-top-color: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}

.stage-chat.dragging {
  box-shadow: 0 -16rpx 48rpx rgba(0, 0, 0, 0.45);
}

/* 拖动手：加大热区，金描边胶囊 */
.chat-grabber-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 20rpx 0 16rpx;
  box-sizing: border-box;
  background: linear-gradient(
    180deg,
    rgba(232, 200, 120, 0.08) 0%,
    transparent 100%
  );
}

.chat-grabber-wrap--active {
  background: linear-gradient(
    180deg,
    rgba(232, 200, 120, 0.16) 0%,
    transparent 100%
  );
}

.chat-grabber-pill {
  width: 120rpx;
  height: 36rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: 2rpx solid rgba(232, 200, 120, 0.45);
  box-sizing: border-box;
}

.chat-grabber-bar {
  width: 56rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: rgba(232, 200, 120, 0.85);
}

/* 自动投喂：聊天区内光点汇聚 + 灵气飘字 */
.auto-feed-fx {
  position: absolute;
  left: 0;
  right: 0;
  top: 100rpx;
  height: 200rpx;
  z-index: 12;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.auto-feed-glow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 160rpx;
  height: 160rpx;
  margin-left: -80rpx;
  margin-top: -80rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(240, 215, 140, 0.35) 0%, transparent 70%);
  animation: autoFeedGlow 1.1s ease-out forwards;
}

.auto-feed-orb {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18rpx;
  height: 18rpx;
  margin-left: -9rpx;
  margin-top: -9rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff6d0, #e8c878 50%, #c9a227);
  box-shadow: 0 0 16rpx rgba(240, 215, 140, 0.6);
}

.auto-feed-orb.a {
  animation: autoFeedOrbA 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.auto-feed-orb.b {
  animation: autoFeedOrbB 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) 0.06s forwards;
}

.auto-feed-orb.c {
  animation: autoFeedOrbC 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s forwards;
}

.auto-feed-plus {
  position: relative;
  z-index: 2;
  font-size: 44rpx;
  font-weight: 800;
  color: #f0d78c;
  text-shadow: 0 0 24rpx rgba(240, 215, 140, 0.55);
  animation: autoFeedPlus 1.1s ease-out forwards;
  opacity: 0;
}

.auto-feed-label {
  position: relative;
  z-index: 2;
  margin-top: 8rpx;
  font-size: 22rpx;
  letter-spacing: 2rpx;
  color: rgba(232, 200, 120, 0.75);
  animation: autoFeedPlus 1.1s ease-out 0.08s forwards;
  opacity: 0;
}

@keyframes autoFeedGlow {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  40% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@keyframes autoFeedOrbA {
  0% {
    opacity: 0;
    transform: translate(-90rpx, 40rpx) scale(0.6);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(0, 0) scale(0.2);
  }
}

@keyframes autoFeedOrbB {
  0% {
    opacity: 0;
    transform: translate(100rpx, 20rpx) scale(0.6);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(0, 0) scale(0.2);
  }
}

@keyframes autoFeedOrbC {
  0% {
    opacity: 0;
    transform: translate(10rpx, 70rpx) scale(0.6);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(0, 0) scale(0.2);
  }
}

@keyframes autoFeedPlus {
  0% {
    opacity: 0;
    transform: translateY(16rpx);
  }
  25% {
    opacity: 1;
    transform: translateY(0);
  }
  70% {
    opacity: 1;
    transform: translateY(-12rpx);
  }
  100% {
    opacity: 0;
    transform: translateY(-28rpx);
  }
}

.stage-chat-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 4rpx 20rpx 0;
  box-sizing: border-box;
}

.stage-chat-empty {
  padding: 56rpx 12rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28rpx;
}

.stage-chat-empty-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.38);
}

.stage-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
}

.stage-chip {
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(232, 200, 120, 0.28);
}

.stage-chip--active {
  background: rgba(232, 200, 120, 0.16);
}

.stage-chip-text {
  font-size: 24rpx;
  color: rgba(240, 215, 140, 0.88);
}

/* 微信式左右行：头像 + 气泡随内容收缩 */
.msg-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 22rpx;
  box-sizing: border-box;
}

.msg-row.is-twin {
  justify-content: flex-start;
}

.msg-row.is-user {
  justify-content: flex-end;
}

.msg-row.is-system {
  justify-content: center;
  margin-bottom: 16rpx;
}

.msg-system {
  max-width: 80%;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.06);
}

.msg-system-text {
  font-size: 22rpx;
  color: rgba(232, 200, 120, 0.75);
  text-align: center;
}

.msg-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  margin-right: 14rpx;
  border: 1rpx solid rgba(232, 200, 120, 0.35);
  box-sizing: border-box;
  display: block;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.msg-avatar.is-me {
  margin-right: 0;
  margin-left: 14rpx;
  border-color: rgba(232, 200, 120, 0.45);
}

.msg-col {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  min-width: 0;
}

.msg-col.is-user {
  align-items: flex-end;
}

.msg-col.is-twin {
  align-items: flex-start;
}

.msg-time {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.32);
  margin-bottom: 8rpx;
  line-height: 1.2;
}

.msg-bubble {
  max-width: 100%;
  padding: 16rpx 22rpx;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.msg-bubble.is-twin {
  background: rgba(40, 36, 52, 0.92);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-top-left-radius: 4rpx;
}

.msg-bubble.is-user {
  background: rgba(232, 200, 120, 0.34);
  border: 1rpx solid rgba(232, 200, 120, 0.5);
  border-top-right-radius: 4rpx;
}

.msg-bubble-img {
  width: 280rpx;
  max-width: 100%;
  border-radius: 10rpx;
  display: block;
  margin-bottom: 8rpx;
}

.msg-bubble-text {
  font-size: 28rpx;
  line-height: 1.55;
  color: rgba(255, 248, 235, 0.94);
  word-break: break-word;
}

.msg-bubble.is-user .msg-bubble-text {
  color: rgba(255, 248, 220, 0.96);
}

.typing-dots {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 36rpx;
  padding: 0 4rpx;
}

.typing-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(255, 248, 235, 0.55);
  animation: typingPulse 1.2s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingPulse {
  0%,
  80%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4rpx);
  }
}

.stage-chat-tail {
  height: 16rpx;
}

.stage-pending {
  position: relative;
  width: 100rpx;
  height: 100rpx;
  margin: 8rpx 28rpx 0;
  border-radius: 14rpx;
  overflow: hidden;
  border: 2rpx solid rgba(232, 200, 120, 0.45);
  flex-shrink: 0;
}

.stage-pending-thumb {
  width: 100%;
  height: 100%;
}

.stage-pending-remove {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 18, 33, 0.85);
}

.pending-x {
  width: 14rpx;
  height: 14rpx;
  position: relative;
}

.pending-x::before,
.pending-x::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14rpx;
  height: 2rpx;
  margin-left: -7rpx;
  margin-top: -1rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.92);
}

.pending-x::before {
  transform: rotate(45deg);
}

.pending-x::after {
  transform: rotate(-45deg);
}

.feed-status {
  padding: 4rpx 28rpx 0;
  flex-shrink: 0;
}

.feed-status-text {
  font-size: 22rpx;
  color: rgba(232, 200, 120, 0.72);
}

.stage-composer {
  flex-shrink: 0;
  background: rgba(18, 14, 28, 0.98);
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
}

.stage-input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx 18rpx;
  box-sizing: border-box;
}

.scene-voice-hold {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.scene-voice-hold.recording {
  background: rgba(232, 200, 120, 0.2);
  border-color: rgba(232, 200, 120, 0.45);
}

.scene-voice-hold.recognizing {
  opacity: 0.75;
  pointer-events: none;
}

.scene-voice-text {
  font-size: 26rpx;
  font-weight: 500;
  color: rgba(255, 248, 235, 0.88);
}

.scene-input {
  flex: 1;
  min-width: 0;
  min-height: 72rpx;
  max-height: 200rpx;
  padding: 18rpx 22rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  line-height: 1.45;
  color: rgba(255, 248, 235, 0.94);
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  box-sizing: border-box;
}

.scene-input-ph {
  color: rgba(255, 255, 255, 0.28);
}

/* 微信式圆形加号：与输入框垂直居中；展开时旋转成 × */
.scene-plus {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgba(232, 200, 120, 0.55);
  background: transparent;
  flex-shrink: 0;
  box-sizing: border-box;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.scene-plus.open {
  transform: rotate(45deg);
  border-color: rgba(232, 200, 120, 0.9);
}

.scene-plus--active {
  background: rgba(232, 200, 120, 0.12);
}

.scene-plus-cross {
  width: 28rpx;
  height: 28rpx;
  position: relative;
}

.plus-bar {
  position: absolute;
  left: 50%;
  top: 50%;
  background: rgba(232, 200, 120, 0.95);
  border-radius: 2rpx;
}

.plus-bar.a {
  width: 28rpx;
  height: 3rpx;
  margin-left: -14rpx;
  margin-top: -1.5rpx;
}

.plus-bar.b {
  width: 3rpx;
  height: 28rpx;
  margin-left: -1.5rpx;
  margin-top: -14rpx;
}

/* 微信式附件面板：图标方块 + 文字 */
.plus-panel {
  padding: 8rpx 28rpx 28rpx;
  box-sizing: border-box;
  background: rgba(22, 18, 32, 0.98);
  border-top: 1rpx solid rgba(255, 255, 255, 0.04);
}

.plus-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding-top: 12rpx;
}

.plus-cell {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0 20rpx;
  box-sizing: border-box;
}

.plus-cell--active .plus-ico-box {
  background: rgba(255, 255, 255, 0.14);
}

.plus-ico-box {
  width: 112rpx;
  height: 112rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14rpx;
  box-sizing: border-box;
}

.plus-label {
  font-size: 22rpx;
  color: rgba(255, 248, 235, 0.62);
  line-height: 1.2;
}

/* 投喂 icon */
.ico-feed {
  width: 52rpx;
  height: 44rpx;
  position: relative;
}

.ico-feed-bowl {
  position: absolute;
  left: 4rpx;
  right: 4rpx;
  bottom: 0;
  height: 28rpx;
  border-radius: 0 0 26rpx 26rpx;
  background: linear-gradient(180deg, #e8c878 0%, #c9a227 100%);
}

.ico-feed-steam {
  position: absolute;
  top: 0;
  width: 4rpx;
  height: 16rpx;
  border-radius: 4rpx;
  background: rgba(232, 200, 120, 0.55);
}

.ico-feed-steam.s1 {
  left: 18rpx;
}

.ico-feed-steam.s2 {
  right: 18rpx;
  top: 4rpx;
  height: 12rpx;
}

/* 图片 icon */
.ico-pic {
  width: 48rpx;
  height: 40rpx;
  position: relative;
}

.ico-pic-frame {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 6rpx;
  border: 3rpx solid rgba(232, 200, 120, 0.85);
  box-sizing: border-box;
}

.ico-pic-mtn {
  position: absolute;
  left: 6rpx;
  bottom: 6rpx;
  width: 0;
  height: 0;
  border-left: 14rpx solid transparent;
  border-right: 14rpx solid transparent;
  border-bottom: 16rpx solid rgba(232, 200, 120, 0.55);
}

.ico-pic-sun {
  position: absolute;
  right: 10rpx;
  top: 8rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(232, 200, 120, 0.9);
}

/* 语音 icon */
.ico-mic {
  width: 28rpx;
  height: 48rpx;
  position: relative;
}

.ico-mic-head {
  position: absolute;
  left: 4rpx;
  top: 0;
  width: 20rpx;
  height: 28rpx;
  border-radius: 10rpx;
  background: rgba(232, 200, 120, 0.92);
}

.ico-mic-stem {
  position: absolute;
  left: 12rpx;
  top: 28rpx;
  width: 4rpx;
  height: 12rpx;
  background: rgba(232, 200, 120, 0.75);
}

.ico-mic-base {
  position: absolute;
  left: 4rpx;
  bottom: 0;
  width: 20rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: rgba(232, 200, 120, 0.75);
}

/* 键盘 icon */
.ico-kb {
  width: 48rpx;
  height: 36rpx;
  border-radius: 6rpx;
  border: 3rpx solid rgba(232, 200, 120, 0.8);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 4rpx;
}

.ico-kb-row {
  height: 4rpx;
  border-radius: 2rpx;
  background: rgba(232, 200, 120, 0.7);
}

.ico-kb-row.r1 {
  width: 32rpx;
}

.ico-kb-row.r2 {
  width: 28rpx;
}

.ico-kb-space {
  width: 20rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: rgba(232, 200, 120, 0.55);
}

/* 成长微条 */
.hero-growth {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 16rpx;
  z-index: 3;
}

.growth-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  color: rgba(240, 215, 140, 0.88);
  margin-bottom: 8rpx;
}

.growth-bar {
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.growth-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #f0d78c 0%, #c9a227 100%);
}

/* 问候 */
.greet-bubble {
  position: absolute;
  left: 28rpx;
  right: 28rpx;
  bottom: 72rpx;
  z-index: 4;
  padding: 18rpx 24rpx;
  border-radius: 18rpx;
  background: rgba(18, 14, 28, 0.88);
  border: 1rpx solid rgba(232, 200, 120, 0.35);
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.greet-bubble-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.45;
  color: rgba(255, 248, 235, 0.9);
}

.greet-bubble-cta {
  flex-shrink: 0;
  font-size: 22rpx;
  color: rgba(240, 215, 140, 0.85);
}

/* 投喂动画 */
.food-fly {
  position: absolute;
  left: 50%;
  bottom: 20%;
  z-index: 5;
  transform: translateX(-50%);
  transition:
    transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.9s ease;
  opacity: 0.95;
}

.food-fly.go {
  transform: translate(-50%, -180rpx) scale(0.4);
  opacity: 0;
}

.fly-orb {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff6d0, #f0d78c 45%, #c9a227);
  box-shadow: 0 0 24rpx rgba(240, 215, 140, 0.55);
}

.float-exp {
  position: absolute;
  left: 50%;
  top: 42%;
  z-index: 6;
  transform: translateX(-50%);
}

.float-exp-text {
  font-size: 40rpx;
  font-weight: 800;
  color: #f0d78c;
  text-shadow: 0 0 20rpx rgba(240, 215, 140, 0.5);
}

.digest-tip {
  position: absolute;
  left: 50%;
  bottom: 88rpx;
  z-index: 5;
  transform: translateX(-50%);
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(18, 14, 28, 0.75);
}

.digest-text {
  font-size: 22rpx;
  color: rgba(255, 248, 235, 0.7);
}

.evolve-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 14, 0.55);
}

.evolve-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 40rpx 56rpx;
  border-radius: 24rpx;
  background: rgba(22, 18, 33, 0.95);
  border: 2rpx solid rgba(232, 200, 120, 0.45);
}

.evolve-kicker {
  font-size: 22rpx;
  letter-spacing: 8rpx;
  color: rgba(240, 215, 140, 0.7);
}

.evolve-title {
  font-size: 44rpx;
  font-weight: 800;
  color: #f0d78c;
}

.evolve-sub {
  font-size: 26rpx;
  color: rgba(255, 248, 235, 0.7);
}
</style>
