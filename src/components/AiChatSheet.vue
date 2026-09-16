<template>
  <view v-if="show" class="ai-sheet">
    <view class="mask" @tap="emit('close')" @touchmove.stop.prevent />
    <view class="panel" @tap.stop @touchmove.stop>
      <image v-if="themeBgUrl" class="ai-bg" :src="themeBgUrl" mode="aspectFill" />
      <view class="ai-bg-mask" />

      <view class="sheet-handle" />
      <view class="panel-header">
        <view class="head-left">
          <text class="panel-title">{{ twin ? '分身对谈' : '问道' }}</text>
          <view v-if="!twin" class="provider-row">
            <view
              v-for="p in AI_PROVIDERS"
              :key="p.id"
              class="provider-chip"
              :class="{ on: selectedProvider === p.id }"
              @tap.stop="selectProvider(p.id)"
            >
              <text class="provider-chip-text">{{ p.label }}</text>
            </view>
          </view>
        </view>
        <text class="panel-close" @tap="emit('close')">关闭</text>
      </view>

      <view class="chat-body">
        <scroll-view
          scroll-y
          class="msg-scroll"
          :scroll-into-view="scrollInto"
          :scroll-with-animation="true"
        >
          <view v-if="messages.length === 0 && !busy" class="empty">
            <text class="empty-text">{{ twin ? '向它提问，检验它记住了什么' : '有惑则问，亦可闲谈' }}</text>
          </view>
          <view
            v-for="(m, i) in messages"
            :id="'aim-' + i"
            :key="'aim-' + i"
            class="msg-row"
            :class="m.role"
          >
            <view class="bubble">
              <template v-if="m.role === 'assistant' && m.blocks && m.blocks.length">
                <template v-for="(block, bi) in m.blocks" :key="'b-' + bi">
                  <rich-text
                    v-if="block.type === 'html'"
                    class="bubble-rich"
                    :nodes="block.html"
                    user-select
                  />
                  <view v-else-if="block.type === 'table'" class="xh-table">
                    <view class="xh-tr xh-tr--head">
                      <view
                        v-for="(cell, ci) in block.header"
                        :key="'h-' + ci"
                        class="xh-td"
                      >{{ cell }}</view>
                    </view>
                    <view
                      v-for="(row, ri) in block.rows"
                      :key="'r-' + ri"
                      class="xh-tr"
                    >
                      <view
                        v-for="(col, ci) in block.header"
                        :key="'c-' + ci"
                        class="xh-td"
                      >{{ row[ci] || '' }}</view>
                    </view>
                  </view>
                </template>
              </template>
              <rich-text
                v-else-if="m.role === 'assistant' && m.html"
                class="bubble-rich"
                :nodes="m.html"
                user-select
              />
              <image
                v-if="m.imageUrl"
                class="bubble-image"
                :src="m.imageUrl"
                mode="widthFix"
              />
              <text
                v-if="m.content && !isRichAssistant(m) && !(m.role === 'user' && m.imageUrl && m.content === '（附图）')"
                class="bubble-text"
                :class="{ 'bubble-text--after-img': m.role === 'user' && m.imageUrl }"
                user-select
              >{{ m.content }}</text>
              <view class="bubble-actions">
                <text class="action-btn" @tap.stop="copyText(m.content)">复制</text>
                <text
                  v-if="m.role === 'assistant'"
                  class="action-btn"
                  :class="{ disabled: shotBusy }"
                  @tap.stop="shotReply(m.content)"
                >截图</text>
              </view>
            </view>
          </view>
          <view v-if="busy" id="aim-thinking" class="msg-row assistant">
            <view class="bubble thinking">
              <view class="thinking-main">
                <XiaoheiThinking />
                <text class="bubble-text thinking-text">悟中…稍候</text>
              </view>
              <view class="thinking-cancel" @tap="handleCancelThinking">
                <view class="cancel-x" />
                <text class="cancel-text">不想了</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="composer-tools">
          <view class="tools-left">
            <view
              class="tool-entry tool-entry--icon"
              :class="{ disabled: busy }"
              @tap="pickImage"
            >
              <XiaoheiImageIcon />
            </view>
            <view
              class="tool-entry tool-entry--icon"
              :class="{ disabled: busy, active: voiceMode }"
              @tap="toggleVoiceMode"
            >
              <XiaoheiMicIcon />
            </view>
          </view>
          <view class="tools-right">
            <text class="clear" @tap="clearChat">清空对话</text>
          </view>
        </view>

        <view v-if="pendingImage && pendingImage.localPath" class="pending-image">
          <image class="pending-thumb" :src="pendingImage.localPath" mode="aspectFill" />
          <view class="pending-remove" @tap.stop="clearPendingImage">
            <view class="clear-x" />
          </view>
        </view>

        <view class="composer" :style="composerStyle">
          <view class="input-wrap">
            <textarea
              v-if="!voiceMode"
              class="input flex"
              :class="{ 'input--clearable': !!draft }"
              v-model="draft"
              :disabled="busy"
              :auto-height="true"
              :maxlength="2000"
              :show-confirm-bar="false"
              confirm-type="send"
              placeholder="写下你的疑惑，或上传截图"
              placeholder-class="ph"
              :adjust-position="false"
              :cursor-spacing="12"
              @focus="scrollToEnd"
              @confirm="handleSend"
            />
            <view
              v-if="draft && !voiceMode"
              class="input-clear"
              @tap.stop="clearDraft"
            >
              <view class="clear-x" />
            </view>
            <view
              v-if="voiceMode"
              class="voice-hold-panel"
              :class="{ recording: voiceRecording, recognizing: voiceRecognizing }"
              @touchstart.stop="handleVoiceStart"
              @touchend.stop="handleVoiceStop"
              @touchcancel.stop="handleVoiceStop"
            >
              <text class="voice-hold-text">{{ voiceHoldLabel }}</text>
            </view>
          </view>
          <view
            v-if="!voiceMode"
            class="btn"
            :class="{ disabled: busy || !canSend }"
            @tap="handleSend"
          >
            <text class="btn-text">传问</text>
          </view>
        </view>
      </view>

      <canvas
        type="2d"
        id="ai-shot-canvas"
        class="shot-canvas"
        :style="{ width: canvasCssW + 'px', height: canvasCssH + 'px' }"
      />
    </view>
  </view>
</template>

<script setup>
import { getCurrentInstance } from 'vue'
import {
  AI_PROVIDERS,
  chatWithAi,
  formatAiChatError,
  getAiDefaultProvider,
  setAiDefaultProvider,
} from '@/api/aiChat'
import {
  addMemoryUnique,
  getAvatar,
  getPersona,
  getStatus,
  listMemories,
  loadChat,
  saveChat,
  saveStatus,
  formatPersonaText,
  formatStatusText,
  formatMemoryDigest,
  looksLikeFactOrCorrection,
  shouldUpdateNextActions,
} from '@/api/aiTwin'
import { buildStyleText } from '@/api/twinProfile'
import XiaoheiThinking from '@/code-assist/components/Thinking.vue'
import XiaoheiImageIcon from '@/code-assist/components/ImageIcon.vue'
import XiaoheiMicIcon from '@/code-assist/components/MicIcon.vue'
import { compressImageForChat } from '@/code-assist/api'
import { themeBgUrl } from '@/utils/moodTheme'
import { startVoiceInput, stopVoiceInput, cancelVoiceInput } from '@/code-assist/voiceInput'
import {
  mdToRichHtml,
  parseMdBlocks,
  measureReplyCanvas,
  drawReplyCanvasSlice,
  calcReplyPageSlices,
} from '@/code-assist/richText'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  /** 分身模式：锁定智谱、注入人设/状态/记忆、对话持久化 */
  twin: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const messages = ref([])
const draft = ref('')
const busy = ref(false)
const shotBusy = ref(false)
const scrollInto = ref('')
const selectedProvider = ref('zhipu')
const keyboardH = ref(0)
const pendingImage = ref(null)
const voiceRecording = ref(false)
const voiceRecognizing = ref(false)
const voiceMode = ref(false)
const canvasCssW = ref(360)
const canvasCssH = ref(200)

let chatSeq = 0
let voiceBaseDraft = ''
let kbBound = false

const instance = getCurrentInstance()

const canSend = computed(function () {
  const hasText = !!(draft.value || '').trim()
  const hasImg = !!(pendingImage.value && pendingImage.value.localPath)
  return hasText || hasImg
})

const composerStyle = computed(function () {
  if (!keyboardH.value) return {}
  return { marginBottom: keyboardH.value + 'px' }
})

const voiceBusy = computed(function () {
  return voiceRecording.value || voiceRecognizing.value
})

const voiceHoldLabel = computed(function () {
  if (voiceRecognizing.value) return '识别中…'
  if (voiceRecording.value) return '松开 结束'
  return '按住 说话'
})

watch(
  () => props.show,
  function (open) {
    if (open) {
      if (props.twin) {
        selectedProvider.value = 'zhipu'
        loadTwinHistory()
      } else {
        loadDefaultProvider()
      }
      bindKeyboard()
      nextTick(function () {
        scrollToEnd()
      })
      return
    }
    exitVoiceMode()
    cancelVoiceInput()
  }
)

onBeforeUnmount(function () {
  unbindKeyboard()
  cancelVoiceInput()
})

function bindKeyboard() {
  if (kbBound) return
  kbBound = true
  uni.onKeyboardHeightChange(function (res) {
    keyboardH.value = (res && res.height) || 0
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
}

async function loadDefaultProvider() {
  try {
    selectedProvider.value = await getAiDefaultProvider()
  } catch (err) {
    selectedProvider.value = 'zhipu'
  }
}

/** 每次发送前实时拉取，刚投喂消化的记忆立即生效 */
let twinAvatarFileID = ''

const AVATAR_PROTOCOL =
  '你有一张当前形象照片。当用户想看你的照片、形象时，单独输出一行【展示形象】表示把照片发出去，其余文字照常。'

const AVATAR_MARKER_RE = /[\[【]展示形象[\]】]/

/** 回复含展示形象标记：剔除标记；有形象照时把 fileID 挂到消息上 */
function applyAvatarMarker(reply) {
  const text = String(reply || '')
  if (!AVATAR_MARKER_RE.test(text) || !twinAvatarFileID) return { text: text, imageUrl: '' }
  const cleaned = text.replace(AVATAR_MARKER_RE, '').replace(/\n{2,}/g, '\n').trim()
  return { text: cleaned || '这就是我现在的形象。', imageUrl: twinAvatarFileID }
}

async function buildTwinContext() {
  const opts = { mode: 'twin' }
  try {
    const parts = await Promise.all([getPersona(), getStatus(), listMemories(), getAvatar()])
    opts.personaText = formatPersonaText(parts[0])
    opts.statusText = formatStatusText(parts[1])
    opts.memoryDigest = formatMemoryDigest(parts[2])
    opts.styleText = buildStyleText(parts[2])
    twinAvatarFileID = parts[3] && parts[3].mainFileID ? parts[3].mainFileID : ''
    opts.avatarDesc = twinAvatarFileID ? AVATAR_PROTOCOL : ''
  } catch (err) {
    console.warn('分身上下文加载失败', err)
  }
  return opts
}

async function loadTwinHistory() {
  try {
    const list = await loadChat()
    messages.value = (list || []).map(function (m) {
      if (m.role === 'assistant') return buildAssistantMsg(m.content)
      return { role: m.role, content: m.content }
    })
    scrollToEnd()
  } catch (err) {
    console.warn('分身对话历史加载失败', err)
  }
}

function persistTwinChat() {
  saveChat(messagesForApi()).catch(function (err) {
    console.warn('分身对话保存失败', err)
  })
}

/** 对话是投喂之外的第二条吸收通道：事实/纠正写入长期记忆，行程写入状态；不阻塞回复 */
async function recordTwinFacts(text) {
  const t = (text || '').trim()
  if (!t) return
  try {
    if (looksLikeFactOrCorrection(t)) {
      const mem = await listMemories()
      await addMemoryUnique(t, mem)
    }
    if (shouldUpdateNextActions(t)) {
      const s = await getStatus()
      await saveStatus(Object.assign({}, s, { nextActions: t }))
    }
  } catch (err) {
    console.warn('分身记忆写入失败', err)
  }
}

async function selectProvider(id) {
  if (busy.value) return
  if (id !== 'zhipu' && id !== 'minimax') return
  if (selectedProvider.value === id) return
  selectedProvider.value = id
  try {
    await setAiDefaultProvider(id)
  } catch (err) {
    console.error('保存默认大模型失败', err)
    uni.showToast({ title: '默认模型保存失败', icon: 'none' })
  }
}

function buildAssistantMsg(content) {
  return {
    role: 'assistant',
    content: content,
    blocks: parseMdBlocks(content),
    html: mdToRichHtml(content),
  }
}

/** assistant 走富文本渲染时，纯文本节点不再重复输出同一内容 */
function isRichAssistant(m) {
  if (!m || m.role !== 'assistant') return false
  return !!((m.blocks && m.blocks.length) || m.html)
}

function scrollToEnd() {
  if (busy.value) {
    scrollInto.value = ''
    nextTick(function () {
      scrollInto.value = 'aim-thinking'
    })
    return
  }
  if (!messages.value.length) return
  const id = 'aim-' + (messages.value.length - 1)
  scrollInto.value = ''
  nextTick(function () {
    scrollInto.value = id
  })
}

function clearChat() {
  if (busy.value) return
  chatSeq++
  messages.value = []
  draft.value = ''
  pendingImage.value = null
  scrollInto.value = ''
  if (props.twin) persistTwinChat()
}

function clearDraft() {
  if (busy.value) return
  draft.value = ''
}

function clearPendingImage() {
  pendingImage.value = null
}

function pickImage() {
  if (busy.value) return
  uni.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: function (res) {
      const files = res.tempFiles || []
      if (!files.length || !files[0].tempFilePath) return
      pendingImage.value = { localPath: files[0].tempFilePath }
    },
    fail: function (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) return
      uni.showToast({ title: '选图失败', icon: 'none' })
    },
  })
}

function toggleVoiceMode() {
  if (busy.value || voiceRecording.value) return
  if (voiceMode.value) {
    exitVoiceMode()
    return
  }
  voiceMode.value = true
}

function exitVoiceMode() {
  if (voiceRecording.value || voiceRecognizing.value) {
    cancelVoiceInput()
    voiceRecording.value = false
    voiceRecognizing.value = false
  }
  voiceMode.value = false
}

function handleVoiceStart() {
  if (!voiceMode.value || busy.value || voiceBusy.value) return
  voiceBaseDraft = draft.value || ''
  voiceRecording.value = true
  startVoiceInput({
    onRecognizing: function () {
      voiceRecognizing.value = true
    },
    onFinal: function (text) {
      voiceRecognizing.value = false
      if (!text) return
      const sep = voiceBaseDraft && text ? ' ' : ''
      draft.value = voiceBaseDraft + sep + text
      exitVoiceMode()
    },
    onError: function (msg) {
      voiceRecording.value = false
      voiceRecognizing.value = false
      uni.showToast({ title: msg || '语音识别失败', icon: 'none' })
    },
  })
}

function handleVoiceStop() {
  if (!voiceRecording.value) return
  voiceRecording.value = false
  stopVoiceInput()
}

function messagesForApi() {
  const list = messages.value || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    if (!m || !m.role) continue
    if (m.role === 'assistant') {
      if (!m.content) continue
      out.push({ role: m.role, content: m.content })
      continue
    }
    const contentRaw = m.content != null ? String(m.content) : ''
    const content = contentRaw === '（附图）' ? '' : contentRaw
    if (!content && !m.imageUrl) continue
    out.push({ role: 'user', content: content })
  }
  return out
}

async function handleSend() {
  if (busy.value || !canSend.value) return
  const text = (draft.value || '').trim()
  const localPath =
    pendingImage.value && pendingImage.value.localPath
      ? pendingImage.value.localPath
      : ''
  if (!text && !localPath) return

  if (localPath && selectedProvider.value === 'minimax') {
    uni.showToast({ title: '当前模型暂不支持图片，请切换到智谱', icon: 'none' })
    return
  }

  let imageOpts = null
  if (localPath) {
    const compressed = await compressImageForChat(localPath)
    imageOpts = { localPath: compressed, mime: 'image/jpeg' }
  }

  const seq = ++chatSeq
  draft.value = ''
  pendingImage.value = null

  const saveContent = text || (localPath ? '（附图）' : '')
  const userMsg = { role: 'user', content: saveContent }
  if (localPath) userMsg.imageUrl = localPath
  messages.value.push(userMsg)

  if (props.twin) recordTwinFacts(text)

  busy.value = true
  scrollToEnd()
  try {
    let provider = selectedProvider.value
    let opts = imageOpts
    if (props.twin) {
      provider = 'zhipu'
      const twinCtx = await buildTwinContext()
      opts = Object.assign({}, imageOpts, twinCtx)
    }
    const reply = await chatWithAi(messagesForApi(), provider, opts)
    if (seq !== chatSeq) return
    let out = reply
    let photoUrl = ''
    if (props.twin) {
      const r = applyAvatarMarker(reply)
      out = r.text
      photoUrl = r.imageUrl
    }
    const msg = buildAssistantMsg(out)
    if (photoUrl) msg.imageUrl = photoUrl
    messages.value.push(msg)
    if (props.twin) persistTwinChat()
  } catch (err) {
    if (seq !== chatSeq) return
    const formatted = formatAiChatError(err)
    const tip = (formatted && formatted.tip) || '传问失败，请稍后重试'
    const toast = (formatted && formatted.toast) || '传问失败'
    console.warn('AI 对话失败', tip)
    // 先短 toast（长文案在微信里常静默失败），再写入气泡保证可见
    try {
      uni.showToast({ title: toast, icon: 'none', duration: 2500 })
    } catch (e) {
      // ignore
    }
    try {
      messages.value.push(buildAssistantMsg('（未能回答）' + tip))
    } catch (e2) {
      messages.value.push({
        role: 'assistant',
        content: '（未能回答）' + tip,
        blocks: [],
        html: '',
      })
    }
  } finally {
    if (seq === chatSeq) {
      busy.value = false
      scrollToEnd()
    }
  }
}

function handleCancelThinking() {
  if (!busy.value) return
  chatSeq++
  const list = messages.value
  if (list.length && list[list.length - 1].role === 'user') {
    messages.value = list.slice(0, list.length - 1)
  }
  busy.value = false
  scrollInto.value = ''
}

function copyText(content) {
  const text = String(content || '')
  if (!text) {
    uni.showToast({ title: '无内容', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data: text,
    success: function () {
      uni.showToast({ title: '已复制', icon: 'none' })
    },
    fail: function () {
      uni.showToast({ title: '复制失败', icon: 'none' })
    },
  })
}

async function shotReply(content) {
  if (shotBusy.value) return
  const text = String(content || '')
  if (!text) {
    uni.showToast({ title: '无内容', icon: 'none' })
    return
  }
  shotBusy.value = true
  uni.showLoading({ title: '生成中', mask: true })
  try {
    const sys = uni.getSystemInfoSync() || {}
    const dpr = sys.pixelRatio || 2
    const cssW = Math.min(Math.floor((sys.windowWidth || 375) * 0.92), 420)
    const pad = 20
    const titleH = 36
    const maxCssH = Math.floor(4096 / dpr) - pad
    const pageContentH = maxCssH - titleH - pad * 2
    const blocks = parseMdBlocks(text)

    canvasCssW.value = cssW
    canvasCssH.value = 400
    await nextTick()
    await new Promise(function (r) {
      setTimeout(r, 40)
    })

    let nodeInfo = await getCanvasNode()
    let canvas = nodeInfo.node
    let ctx = canvas.getContext('2d')
    ctx.font = '15px sans-serif'
    const maxTextW = cssW - pad * 2
    const layout = measureReplyCanvas(blocks, ctx, maxTextW)
    const slices = calcReplyPageSlices(layout.h, pageContentH)
    const pageCount = slices.length
    const paths = []

    for (let pi = 0; pi < pageCount; pi++) {
      const slice = slices[pi]
      const cssH = titleH + pad + slice.height + pad
      canvasCssH.value = cssH
      await nextTick()
      await new Promise(function (r) {
        setTimeout(r, 40)
      })

      nodeInfo = await getCanvasNode()
      canvas = nodeInfo.node
      ctx = canvas.getContext('2d')
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1)

      ctx.fillStyle = '#7dd3fc'
      ctx.font = 'bold 16px sans-serif'
      const titleText =
        pageCount > 1 ? '问道 (' + (pi + 1) + '/' + pageCount + ')' : '问道'
      ctx.fillText(titleText, pad, pad + 16)

      drawReplyCanvasSlice(
        layout,
        ctx,
        maxTextW,
        pad + titleH,
        slice.offsetY,
        slice.height
      )

      paths.push(await canvasToTemp(canvas))
    }

    uni.hideLoading()
    if (pageCount > 5) {
      uni.showToast({ title: '共 ' + pageCount + ' 页', icon: 'none' })
    }
    uni.previewImage({
      urls: paths,
      current: paths[0],
    })
  } catch (e) {
    console.error(e)
    uni.hideLoading()
    uni.showToast({
      title: (e && e.message) || '截图失败',
      icon: 'none',
    })
  } finally {
    shotBusy.value = false
  }
}

function getCanvasNode() {
  return new Promise(function (resolve, reject) {
    const proxy = instance && instance.proxy
    const q = uni.createSelectorQuery()
    if (proxy) q.in(proxy)
    q.select('#ai-shot-canvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('canvas 不可用'))
          return
        }
        resolve(res[0])
      })
  })
}

function canvasToTemp(canvas) {
  return new Promise(function (resolve, reject) {
    uni.canvasToTempFilePath(
      {
        canvas: canvas,
        fileType: 'png',
        quality: 1,
        success: function (r) {
          if (r && r.tempFilePath) resolve(r.tempFilePath)
          else reject(new Error('导出失败'))
        },
        fail: function (e) {
          reject(e || new Error('导出失败'))
        },
      },
      (instance && instance.proxy) || undefined
    )
  })
}
</script>

<style lang="scss" scoped>
.ai-sheet {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 320;
}

.mask {
  position: absolute;
  inset: 0;
  background: rgba(2, 8, 23, 0.55);
}

.panel {
  position: absolute;
  left: 0;
  right: 0;
  top: auto;
  bottom: 0;
  height: 70vh;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 28rpx 28rpx 0 0;
  padding: 0 32rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  color: #e5eef7;
  background: #0f172a;
}

.ai-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  opacity: 0.55;
  z-index: 0;
  pointer-events: none;
}

.ai-bg-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    165deg,
    rgba(15, 23, 42, 0.72) 0%,
    rgba(30, 41, 59, 0.68) 48%,
    rgba(51, 65, 85, 0.62) 100%
  );
}

.sheet-handle {
  position: relative;
  z-index: 1;
  width: 64rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: rgba(148, 163, 184, 0.45);
  margin: 16rpx auto 0;
  flex-shrink: 0;
}

.panel-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20rpx 0 16rpx;
  flex-shrink: 0;
  gap: 16rpx;
}

.head-left {
  flex: 1;
  min-width: 0;
}

.panel-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 8rpx;
  text-indent: 8rpx;
  color: #e0f2fe;
  margin-bottom: 14rpx;
}

.provider-row {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
}

.provider-chip {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.28);
  background: rgba(30, 41, 59, 0.72);
}

.provider-chip.on {
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(14, 116, 144, 0.35);
}

.provider-chip-text {
  font-size: 24rpx;
  color: #94a3b8;
}

.provider-chip.on .provider-chip-text {
  color: #7dd3fc;
  font-weight: 600;
}

.panel-close {
  font-size: 26rpx;
  color: #7dd3fc;
  padding: 8rpx;
  flex-shrink: 0;
}

.chat-body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.msg-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}

.empty {
  padding: 80rpx 24rpx;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: #94a3b8;
  letter-spacing: 4rpx;
}

.msg-row {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16rpx;
}

.msg-row.user {
  justify-content: flex-end;
}

.msg-row.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 88%;
  min-width: 0;
  box-sizing: border-box;
  padding: 20rpx 24rpx;
  border-radius: 18rpx;
  background: rgba(51, 65, 85, 0.88);
  border: 1rpx solid rgba(56, 189, 248, 0.22);
  overflow: hidden;
}

.msg-row.user .bubble {
  background: rgba(14, 116, 144, 0.45);
  border-color: rgba(34, 211, 238, 0.35);
}

.bubble.thinking {
  opacity: 0.92;
}

.thinking-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.thinking-text {
  flex: 1;
  min-width: 0;
}

.thinking-cancel {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  margin-top: 12rpx;
  padding: 8rpx 0 4rpx;
}

.cancel-x {
  width: 20rpx;
  height: 20rpx;
  position: relative;
  flex-shrink: 0;
}

.cancel-x::before,
.cancel-x::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18rpx;
  height: 2rpx;
  margin-left: -9rpx;
  margin-top: -1rpx;
  background: #67e8f9;
  border-radius: 1rpx;
}

.cancel-x::before {
  transform: rotate(45deg);
}

.cancel-x::after {
  transform: rotate(-45deg);
}

.cancel-text {
  font-size: 24rpx;
  color: #67e8f9;
  line-height: 1.2;
}

.bubble-text {
  font-size: 28rpx;
  line-height: 1.55;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-rich {
  font-size: 28rpx;
  line-height: 1.55;
  color: #e2e8f0;
  word-break: break-word;
}

.xh-table {
  width: 100%;
  margin: 8rpx 0 12rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.28);
  border-radius: 10rpx;
  overflow: hidden;
}

.xh-tr {
  display: flex;
  flex-direction: row;
  border-bottom: 1rpx solid rgba(56, 189, 248, 0.18);
}

.xh-tr:last-child {
  border-bottom: none;
}

.xh-tr--head {
  background: rgba(14, 116, 144, 0.28);
}

.xh-td {
  flex: 1;
  min-width: 0;
  padding: 10rpx 12rpx;
  font-size: 24rpx;
  color: #e2e8f0;
  word-break: break-word;
  border-right: 1rpx solid rgba(56, 189, 248, 0.15);
  box-sizing: border-box;
}

.xh-td:last-child {
  border-right: none;
}

.bubble-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  margin-top: 12rpx;
  padding-top: 8rpx;
}

.action-btn {
  font-size: 22rpx;
  color: #67e8f9;
  padding: 4rpx 8rpx;
}

.action-btn.disabled {
  opacity: 0.4;
}

.bubble-image {
  width: 100%;
  max-width: 420rpx;
  border-radius: 12rpx;
  display: block;
}

.bubble-text--after-img {
  margin-top: 12rpx;
}

.composer-tools {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.tools-left {
  display: flex;
  align-items: center;
}

.tool-entry {
  display: flex;
  align-items: center;
  border-radius: 999rpx;
  background: rgba(30, 41, 59, 0.72);
  border: 1rpx solid rgba(56, 189, 248, 0.28);
}

.tool-entry--icon {
  margin-right: 10px;
  padding: 8rpx;
}

.tool-entry--icon.disabled {
  opacity: 0.4;
}

.tool-entry--icon.active {
  background: rgba(56, 189, 248, 0.22);
  border-color: rgba(56, 189, 248, 0.55);
}

.tools-right {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.clear {
  font-size: 24rpx;
  color: #cbd5e1;
}

.pending-image {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 120rpx;
  height: 120rpx;
  margin-bottom: 12rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid rgba(56, 189, 248, 0.35);
}

.pending-thumb {
  width: 100%;
  height: 100%;
}

.pending-remove {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.75);
  border: 1rpx solid rgba(56, 189, 248, 0.35);
}

.composer {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: flex;
  gap: 12rpx;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.voice-hold-panel {
  flex: 1;
  min-width: 0;
  width: 100%;
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: rgba(30, 41, 59, 0.75);
  border: 1rpx solid rgba(56, 189, 248, 0.28);
  box-sizing: border-box;
}

.voice-hold-panel.recording {
  background: rgba(14, 116, 144, 0.35);
  border-color: rgba(56, 189, 248, 0.55);
}

.voice-hold-panel.recognizing {
  opacity: 0.75;
  pointer-events: none;
}

.voice-hold-text {
  font-size: 30rpx;
  color: #e2e8f0;
  font-weight: 500;
}

.voice-hold-panel.recording .voice-hold-text {
  color: #7dd3fc;
}

.input {
  flex: 1;
  min-width: 0;
  min-height: 72rpx;
  max-height: 200rpx;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  background: rgba(30, 41, 59, 0.75);
  border: 1rpx solid rgba(56, 189, 248, 0.28);
  font-size: 28rpx;
  color: #e2e8f0;
  line-height: 1.5;
  box-sizing: border-box;
  width: 100%;
}

.input.flex {
  flex: 1;
}

.input--clearable {
  padding-right: 64rpx;
}

.input-clear {
  position: absolute;
  right: 12rpx;
  top: 50%;
  margin-top: -20rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(14, 116, 144, 0.28);
  border: 1rpx solid rgba(56, 189, 248, 0.35);
  box-sizing: border-box;
  z-index: 2;
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

.ph {
  color: #64748b;
}

.btn {
  min-width: 120rpx;
  min-height: 72rpx;
  height: auto;
  align-self: stretch;
  padding: 0 28rpx;
  border-radius: 16rpx;
  background: linear-gradient(145deg, #22d3ee 0%, #0ea5e9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.btn.disabled {
  opacity: 0.45;
}

.btn-text {
  color: #0b1220;
  font-size: 28rpx;
  font-weight: 700;
}

.shot-canvas {
  position: fixed;
  left: -9999px;
  top: 0;
  pointer-events: none;
  opacity: 0;
}
</style>
