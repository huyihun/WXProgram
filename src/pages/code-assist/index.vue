<template>
  <PageRoot
    dark-nav
    flush
    fill
    :extra-style="{
      background: 'transparent',
      backgroundColor: 'transparent',
    }"
  >
    <view class="ca-page">
      <view class="proj-switch" :style="projSwitchStyle">
        <view class="proj-pill" @tap.stop="toggleProjMenu">
          <text class="proj-pill-text">{{ currentProjectLabel }}</text>
          <text class="proj-pill-caret">{{ projMenuOpen ? '▴' : '▾' }}</text>
        </view>
        <view v-if="projMenuOpen" class="proj-menu">
          <view
            v-for="(p, pi) in projectList"
            :key="'proj-' + (p._id || pi)"
            class="proj-item"
            :class="{ active: current && current._id === p._id }"
            @tap.stop="switchProject(p)"
          >
            <text class="proj-item-text">{{ p.name || p.slug || p._id }}</text>
          </view>
          <view v-if="!projectList.length" class="proj-item disabled">
            <text class="proj-item-text">暂无已发布项目</text>
          </view>
        </view>
      </view>
      <view
        v-if="projMenuOpen"
        class="proj-menu-mask"
        @tap="projMenuOpen = false"
      />

      <view v-if="bootLoading" class="ca-boot"><PageLoading /></view>

      <view v-else-if="!currentReady" class="empty">
        <text class="empty-text">{{ emptyHint }}</text>
      </view>
      <view v-else class="chat-body">
          <scroll-view
            scroll-y
            class="msg-scroll"
            :scroll-into-view="scrollInto"
            :scroll-with-animation="true"
          >
            <view
              v-for="(m, i) in messages"
              :id="'cam-' + i"
              :key="'cam-' + i"
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
                  v-if="m.role === 'user' && m.imageUrl"
                  class="bubble-image"
                  :src="m.imageUrl"
                  mode="widthFix"
                />
                <text
                  v-if="m.content && !(m.role === 'user' && m.imageUrl && m.content === '（附图）')"
                  class="bubble-text"
                  :class="{ 'bubble-text--after-img': m.role === 'user' && m.imageUrl }"
                  user-select
                >{{ m.content }}</text>
                <text
                  v-if="
                    showUsedFiles &&
                    m.role === 'assistant' &&
                    m.usedFiles &&
                    m.usedFiles.length
                  "
                  class="used-files"
                  user-select
                  >已读（{{ m.usedFiles.length }}）：{{ m.usedFiles.join(' · ') }}</text
                >
                <view
                  v-if="
                    m.role === 'assistant' &&
                    m.suggestAtRoots &&
                    m.suggestAtRoots.length
                  "
                  class="at-suggest-row"
                >
                  <text class="at-suggest-label">建议</text>
                  <text
                    v-for="(root, si) in m.suggestAtRoots"
                    :key="'sg-' + si"
                    class="at-suggest-chip"
                    @tap.stop="onPickModule(root)"
                  >@{{ root }}</text>
                </view>
                <view class="bubble-actions">
                  <text class="action-btn" @tap.stop="copyText(m.content)">复制</text>
                  <text
                    v-if="m.role === 'assistant'"
                    class="action-btn"
                    :class="{ disabled: shotBusy }"
                    @tap.stop="shotReply(m.content)"
                    >截图</text
                  >
                </view>
              </view>
            </view>
            <view v-if="chatBusy" id="cam-thinking" class="msg-row assistant">
              <view class="bubble thinking">
                <view class="thinking-main">
                  <XiaoheiThinking />
                  <text class="bubble-text thinking-text">死脑快想...大概要想20s</text>
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
            <view class="tool-entry index-entry" @tap="openPageIndex">
              <XiaoheiDogIcon />
              <text class="index-entry-text">索引</text>
            </view>
            <view
              class="tool-entry tool-entry--icon"
              :class="{ disabled: chatBusy }"
              @tap="pickImage"
            >
              <XiaoheiImageIcon />
            </view>
            <view
              class="tool-entry tool-entry--icon"
              :class="{ disabled: chatBusy, active: voiceMode }"
              @tap="toggleVoiceMode"
            >
              <XiaoheiMicIcon />
            </view>
          </view>
          <view class="tools-right">
            <text class="clear" @tap="clearChat">清空对话</text>
            <text class="debug-toggle" @tap="toggleShowUsedFiles">
              {{ showUsedFiles ? '已读·开' : '已读·关' }}
            </text>
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
              :disabled="chatBusy"
              :auto-height="true"
              :maxlength="2000"
              :show-confirm-bar="false"
              confirm-type="send"
              placeholder="描述问题，或上传报错/页面截图"
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
            :class="{ disabled: chatBusy || !canSend }"
            @tap="handleSend"
          >
            <text class="btn-text">汪汪汪</text>
          </view>
        </view>
      </view>

      <XiaoheiPageIndexSheet
        :show="pageIndexOpen"
        :modules="pageModules"
        :project-id="current && current._id ? current._id : ''"
        @close="pageIndexOpen = false"
        @pick="onPickModule"
        @pick-file="onPickFile"
      />

      <!-- 离屏画布：生成 AI 回复截图 -->
      <canvas
        type="2d"
        id="ca-shot-canvas"
        class="shot-canvas"
        :style="{ width: canvasCssW + 'px', height: canvasCssH + 'px' }"
      />
    </view>
  </PageRoot>
</template>

<script setup>
import { getCurrentInstance } from 'vue'
import { getActiveProject, listProjects, saveSelectedProjectId, chatCodeAssist, cancelCodeAssist, getPageIndex, loadChat, saveChat, clearChatCloud, compressImageForChat } from '@/code-assist/api'
import XiaoheiThinking from '@/code-assist/components/Thinking.vue'
import XiaoheiDogIcon from '@/code-assist/components/DogIcon.vue'
import XiaoheiImageIcon from '@/code-assist/components/ImageIcon.vue'
import XiaoheiMicIcon from '@/code-assist/components/MicIcon.vue'
import XiaoheiPageIndexSheet from '@/code-assist/components/PageIndexSheet.vue'
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import { startVoiceInput, stopVoiceInput, cancelVoiceInput } from '@/code-assist/voiceInput'
import {
  mdToRichHtml,
  parseMdBlocks,
  measureReplyCanvas,
  drawReplyCanvasSlice,
  calcReplyPageSlices,
} from '@/code-assist/richText'

const SHOW_FILES_KEY = 'xiaohei_show_used_files'

const bootLoading = ref(true)
const chatBusy = ref(false)
const shotBusy = ref(false)
const current = ref(null)
const messages = ref([])
const draft = ref('')
const scrollInto = ref('')
const canvasCssW = ref(360)
const canvasCssH = ref(200)
const showUsedFiles = ref(false)
const keyboardH = ref(0)
const pendingRequestId = ref('')
const pageModules = ref([])
const pageIndexOpen = ref(false)
const projectList = ref([])
const projMenuOpen = ref(false)
const statusBarPx = ref(0)
const navBarPx = ref(44)
const switchingProject = ref(false)
const pendingImage = ref(null)
const voiceRecording = ref(false)
const voiceRecognizing = ref(false)
const voiceMode = ref(false)

let chatSeq = 0
let voiceBaseDraft = ''

const instance = getCurrentInstance()

const canSend = computed(function () {
  const hasText = !!(draft.value || '').trim()
  const hasImg = !!(pendingImage.value && pendingImage.value.localPath)
  return hasText || hasImg
})
const currentReady = computed(() => {
  return current.value && current.value.status === 'ready'
})
const currentProjectLabel = computed(function () {
  if (current.value && current.value.name) return current.value.name
  return '选择项目'
})

const projSwitchStyle = computed(function () {
  return {
    paddingTop: statusBarPx.value + 20 + 'px',
    height: navBarPx.value + 'px',
  }
})

const emptyHint = computed(() => {
  if (!current.value) {
    return '尚未就绪。请本机配置 code-assist/config.json 后执行 npm run code-assist:publish'
  }
  return '项目状态：' + (current.value.status || '?') + '。请重新 publish'
})
const composerStyle = computed(() => {
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

function buildAssistantMsg(content, usedFiles, extra) {
  const blocks = parseMdBlocks(content)
  const ex = extra || {}
  return {
    role: 'assistant',
    content: content,
    blocks: blocks,
    html: mdToRichHtml(content),
    usedFiles: usedFiles || [],
    suggestAtRoots: ex.suggestAtRoots || [],
  }
}

onLoad(async () => {
  await loadOwnerFlag()
  if (!isOwnerSync()) {
    uni.showToast({ title: '仅主人可用', icon: 'none' })
    setTimeout(function () {
      uni.navigateBack({ fail: function () {} })
    }, 400)
    return
  }
  try {
    showUsedFiles.value = !!uni.getStorageSync(SHOW_FILES_KEY)
  } catch (e) {
    showUsedFiles.value = false
  }
  try {
    const info = uni.getSystemInfoSync() || {}
    statusBarPx.value = info.statusBarHeight || 0
    try {
      const menu = wx.getMenuButtonBoundingClientRect()
      if (menu) {
        navBarPx.value =
          (menu.top - (info.statusBarHeight || 0)) * 2 + menu.height
      }
    } catch (e) {}

    projectList.value = await listProjects()
    current.value = await getActiveProject()
    await applyProjectData(current.value)
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    bootLoading.value = false
  }
  uni.onKeyboardHeightChange(function (res) {
    keyboardH.value = (res && res.height) || 0
  })
})

onUnload(() => {
  uni.offKeyboardHeightChange()
  cancelVoiceInput()
  voiceRecording.value = false
  voiceRecognizing.value = false
  voiceMode.value = false
})

function toggleShowUsedFiles() {
  showUsedFiles.value = !showUsedFiles.value
  try {
    uni.setStorageSync(SHOW_FILES_KEY, showUsedFiles.value)
  } catch (e) {}
  uni.showToast({
    title: showUsedFiles.value ? '已显示已读文件' : '已隐藏已读文件',
    icon: 'none',
  })
}

function scrollToEnd() {
  if (chatBusy.value) {
    scrollInto.value = ''
    nextTick(function () {
      scrollInto.value = 'cam-thinking'
    })
    return
  }
  if (!messages.value.length) return
  const id = 'cam-' + (messages.value.length - 1)
  scrollInto.value = ''
  nextTick(function () {
    scrollInto.value = id
  })
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

function pickImage() {
  if (chatBusy.value) return
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

function clearPendingImage() {
  pendingImage.value = null
}

function toggleVoiceMode() {
  if (chatBusy.value || voiceRecording.value) return
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
  if (!voiceMode.value || chatBusy.value || voiceBusy.value) return
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

async function handleSend() {
  if (chatBusy.value || !canSend.value || !current.value || !current.value._id) return
  const text = (draft.value || '').trim()
  const localPath =
    pendingImage.value && pendingImage.value.localPath
      ? pendingImage.value.localPath
      : ''
  if (!text && !localPath) return

  let imageOpts = null
  if (localPath) {
    const compressed = await compressImageForChat(localPath)
    imageOpts = { localPath: compressed, mime: 'image/jpeg' }
  }

  const seq = ++chatSeq
  const requestId =
    'xh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  pendingRequestId.value = requestId
  draft.value = ''
  pendingImage.value = null

  const saveContent = text || (localPath ? '（附图）' : '')
  const userMsg = { role: 'user', content: saveContent }
  if (localPath) userMsg.imageUrl = localPath
  messages.value.push(userMsg)

  chatBusy.value = true
  scrollToEnd()
  try {
    const res = await chatCodeAssist(
      current.value._id,
      messagesForApi(),
      requestId,
      imageOpts
    )
    if (seq !== chatSeq) return
    if (res.cancelled) return
    const reply = res.reply || ''
    const usedFiles = res.usedFiles && res.usedFiles.length ? res.usedFiles : []
    const suggestAtRoots =
      res.suggestAtRoots && res.suggestAtRoots.length ? res.suggestAtRoots : []
    messages.value.push(buildAssistantMsg(reply, usedFiles, { suggestAtRoots }))
    await saveChat(current.value._id, messages.value)
  } catch (e) {
    if (seq !== chatSeq) return
    const errText = '排查失败：' + ((e && e.message) || '未知错误')
    messages.value.push(buildAssistantMsg(errText, []))
    await saveChat(current.value._id, messages.value)
  } finally {
    if (seq === chatSeq) {
      chatBusy.value = false
      pendingRequestId.value = ''
      scrollToEnd()
    }
  }
}

async function handleCancelThinking() {
  if (!chatBusy.value || !pendingRequestId.value) return
  chatSeq++
  const requestId = pendingRequestId.value
  await cancelCodeAssist(requestId)
  const list = messages.value
  if (list.length && list[list.length - 1].role === 'user') {
    messages.value = list.slice(0, list.length - 1)
  }
  chatBusy.value = false
  pendingRequestId.value = ''
  if (current.value && current.value._id) {
    await saveChat(current.value._id, messages.value)
  }
}


async function applyProjectData(project) {
  messages.value = []
  pageModules.value = []
  pageIndexOpen.value = false
  draft.value = ''
  pendingImage.value = null
  if (!project || !project._id) return
  pageModules.value = await getPageIndex(project._id)
  const history = await loadChat(project._id)
  const restored = []
  for (let i = 0; i < history.length; i++) {
    const m = history[i]
    if (!m || !m.role || !m.content) continue
    if (m.role === 'assistant') {
      restored.push(buildAssistantMsg(m.content, []))
    } else {
      restored.push({ role: 'user', content: m.content })
    }
  }
  messages.value = restored
}

function toggleProjMenu() {
  if (chatBusy.value || switchingProject.value) return
  projMenuOpen.value = !projMenuOpen.value
}

async function switchProject(p) {
  if (!p || !p._id) return
  if (current.value && current.value._id === p._id) {
    projMenuOpen.value = false
    return
  }
  if (chatBusy.value || switchingProject.value) return
  switchingProject.value = true
  projMenuOpen.value = false
  try {
    await saveSelectedProjectId(p._id)
    current.value = p
    await applyProjectData(p)
    uni.showToast({ title: '已切换：' + (p.name || ''), icon: 'none' })
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '切换失败', icon: 'none' })
  } finally {
    switchingProject.value = false
  }
}

function openPageIndex() {
  pageIndexOpen.value = true
}

function onPickModule(root) {
  const tag = '@' + root
  const cur = draft.value || ''
  draft.value = cur ? cur + ' ' + tag + ' ' : tag + ' '
  pageIndexOpen.value = false
}

function onPickFile(filePath) {
  if (!filePath) return
  const tag = '@' + filePath
  const cur = draft.value || ''
  draft.value = cur ? cur + ' ' + tag + ' ' : tag + ' '
  pageIndexOpen.value = false
}

async function clearChat() {
  if (chatBusy.value) return
  messages.value = []
  if (current.value && current.value._id) {
    try {
      await clearChatCloud(current.value._id)
    } catch (e) {
      console.error(e)
      uni.showToast({ title: '云端清空失败', icon: 'none' })
    }
  }
}

function clearDraft() {
  if (chatBusy.value) return
  draft.value = ''
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
        pageCount > 1 ? '小黑 (' + (pi + 1) + '/' + pageCount + ')' : '小黑'
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
    q.select('#ca-shot-canvas')
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
      proxyScope()
    )
  })
}

function proxyScope() {
  return (instance && instance.proxy) || undefined
}
</script>

<style lang="scss" scoped>

.proj-switch {
  position: fixed;
  left: 50%;
  top: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70%;
  max-width: 520rpx;
  transform: translateX(-50%);
  pointer-events: none;
  box-sizing: border-box;
}

.proj-pill {
  pointer-events: auto;
  max-width: 100%;
  min-height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 18rpx 36rpx;
  border-radius: 999rpx;
  background: rgba(30, 41, 59, 0.72);
  border: 1rpx solid rgba(56, 189, 248, 0.35);
  box-sizing: border-box;
}

.proj-pill-text {
  font-size: 28rpx;
  color: #e0f2fe;
  max-width: 420rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proj-pill-caret {
  font-size: 22rpx;
  color: #7dd3fc;
  flex-shrink: 0;
}

.proj-menu-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 110;
}

.proj-menu {
  pointer-events: auto;
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  margin-top: 8rpx;
  min-width: 280rpx;
  max-width: 480rpx;
  max-height: 60vh;
  overflow-y: auto;
  padding: 8rpx;
  border-radius: 16rpx;
  background: rgba(30, 41, 59, 0.96);
  border: 1rpx solid rgba(56, 189, 248, 0.28);
  box-shadow: 0 12rpx 40rpx rgba(2, 8, 23, 0.45);
  box-sizing: border-box;
  z-index: 121;
}

.proj-item {
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
}

.proj-item.active {
  background: rgba(14, 116, 144, 0.35);
}

.proj-item.disabled {
  opacity: 0.6;
}

.proj-item-text {
  font-size: 26rpx;
  color: #e2e8f0;
}

.ca-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  color: #e5eef7;
  position: relative;
}

.ca-boot {
  position: relative;
  z-index: 1;
  flex: 1;
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

.debug-toggle {
  font-size: 22rpx;
  color: #67e8f9;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.35);
  background: rgba(30, 41, 59, 0.72);
}

.empty {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 48rpx 16rpx;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  font-size: 28rpx;
  color: #94a3b8;
  line-height: 1.55;
}

.msg-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  margin-bottom: 16rpx;
  box-sizing: border-box;
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
  display: block;
  width: 100%;
  box-sizing: border-box;
  font-size: 28rpx;
  font-weight: 400;
  color: #e2e8f0;
  line-height: 1.65;
  letter-spacing: 0.5rpx;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble-rich {
  display: block;
  width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
}

.xh-table {
  width: 100%;
  margin: 12rpx 0;
  border: 1rpx solid rgba(148, 163, 184, 0.45);
  border-radius: 8rpx;
  overflow: hidden;
}

.xh-tr {
  display: flex;
  width: 100%;
}

.xh-tr--head {
  background: rgba(30, 41, 59, 0.9);
}

.xh-td {
  flex: 1;
  min-width: 0;
  padding: 12rpx 10rpx;
  font-size: 24rpx;
  color: #e2e8f0;
  border: 1rpx solid rgba(148, 163, 184, 0.35);
  word-break: break-word;
}

.xh-tr--head .xh-td {
  color: #7dd3fc;
  font-weight: 600;
}

.used-files {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.25);
  font-size: 20rpx;
  color: #67e8f9;
  line-height: 1.45;
  word-break: break-all;
  overflow-wrap: anywhere;
  opacity: 0.9;
}

.bubble-actions {
  display: flex;
  justify-content: flex-end;
  gap: 28rpx;
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.2);
}

.at-suggest-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.2);
}

.at-suggest-label {
  font-size: 22rpx;
  color: #94a3b8;
}

.at-suggest-chip {
  font-size: 22rpx;
  color: #7dd3fc;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(30, 41, 59, 0.72);
  border: 1rpx solid rgba(56, 189, 248, 0.35);
}

.action-btn {
  font-size: 22rpx;
  color: #7dd3fc;
  line-height: 1.2;
  padding: 4rpx 0;
}

.action-btn.disabled {
  opacity: 0.4;
}

.shot-canvas {
  position: fixed;
  left: -9999px;
  top: 0;
  pointer-events: none;
  opacity: 0;
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

.index-entry {
  gap: 10rpx;
  padding: 8rpx 16rpx 8rpx 8rpx;
}

.tool-entry--icon {
  margin-left: 10px;
  padding: 8rpx;
}

.tool-entry--icon.disabled {
  opacity: 0.4;
}

.tool-entry--icon.active {
  background: rgba(56, 189, 248, 0.22);
  border-color: rgba(56, 189, 248, 0.55);
}

.index-entry-text {
  font-size: 24rpx;
  color: #7dd3fc;
}

.tools-right {
  display: flex;
  align-items: center;
  gap: 24rpx;
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

.bubble-image {
  width: 100%;
  max-width: 420rpx;
  border-radius: 12rpx;
  display: block;
}

.bubble-text--after-img {
  margin-top: 12rpx;
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

.clear {
  font-size: 24rpx;
  color: #cbd5e1;
}
</style>
