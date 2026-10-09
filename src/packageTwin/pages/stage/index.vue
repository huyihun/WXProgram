<template>
  <view class="stage-page">
    <!-- 背景图（云存储换链，透明度对齐项目标准：图 0.78 + 暗色蒙层） -->
    <image v-if="bgUrl" class="stage-bg" :src="bgUrl" mode="aspectFill" @error="bgUrl = ''" />
    <view v-if="bgUrl" class="stage-bg-veil" />

    <!-- 3D 画布 -->
    <canvas
      v-if="!fallback"
      id="stage-canvas"
      type="webgl"
      class="stage-canvas"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    />

    <!-- 兜底形象 -->
    <view v-if="fallback" class="stage-fallback">
      <image class="fb-avatar" src="/static/twin/avatar.png" mode="aspectFill" />
    </view>

    <!-- 加载态：金色旋转光环 + 真实下载百分比 -->
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

    <!-- 场景内对话：模型头顶气泡（打字机，回复常驻，可手动关闭） -->
    <view
      v-if="(sceneThinking || typedReply) && !bubbleDismissed"
      class="scene-bubble"
      @tap="openChat"
    >
      <view class="scene-bubble-close" @tap.stop="dismissBubble">
        <view class="bubble-close-x" />
      </view>
      <text class="scene-bubble-text">{{ sceneThinking ? '…' : typedReply }}</text>
      <text class="scene-bubble-history">完整对话 ›</text>
    </view>

    <!-- 场景内输入条（七色云彩）：文字 / 图片 / 语音 -->
    <view v-if="!loading" class="scene-input-bar" :style="inputBarStyle">
      <view class="cloud-shine" />
      <text class="cloud-glyph">☁️</text>
      <view class="scene-tool" @tap="pickSceneImage">
        <XiaoheiImageIcon />
      </view>
      <view
        class="scene-tool"
        :class="{ active: sceneVoiceMode }"
        @tap="toggleSceneVoice"
      >
        <XiaoheiMicIcon />
      </view>
      <input
        v-if="!sceneVoiceMode"
        v-model="sceneInput"
        class="scene-input"
        :focus="sceneInputFocus"
        :maxlength="500"
        confirm-type="send"
        :adjust-position="false"
        :cursor-spacing="16"
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
      <view class="scene-send" :class="{ disabled: !canSceneSend }" @tap="sendSceneMsg">
        <text class="scene-send-text">say</text>
      </view>
      <!-- 待发送图片缩略图 -->
      <view v-if="scenePendingImage" class="scene-pending">
        <image class="scene-pending-thumb" :src="scenePendingImage" mode="aspectFill" />
        <view class="scene-pending-remove" @tap.stop="clearScenePendingImage">
          <view class="pending-x" />
        </view>
      </view>
    </view>

    <!-- 悬浮按钮：仅兜底模式显示 -->
    <view v-if="fallback" class="float-btns">
      <view class="fbtn" hover-class="fbtn--active" @tap="openChat">
        <text class="fbtn-text">对话</text>
      </view>
      <view class="fbtn" hover-class="fbtn--active" @tap="openTreasure">
        <text class="fbtn-text">百宝箱</text>
      </view>
    </view>

    <TreasureSheet :show="treasureOpen" @close="treasureOpen = false" />
    <AiChatSheet :show="chatOpen" twin @close="chatOpen = false" @replied="onReplied" />
  </view>
</template>

<script setup>
/**
 * 3D 舞台：模型即入口
 * - 点法宝区域 → 百宝箱（按命中点高度区域判定）
 * - 点其他部位 → 分身对话
 * - 模型下载后缓存本地（USER_DATA_PATH），按 fileID 失效
 * - 失败兜底：图片形象 + 悬浮按钮，功能不瘫痪
 */
import * as THREE from '../../libs/build/three.module.js'
import { WechatPlatform } from '../../libs/src/WechatPlatform/index.js'
import { GLTFLoader } from '../../libs/examples/jsm/loaders/GLTFLoader.js'
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import TreasureSheet from '../../components/TreasureSheet.vue'
import AiChatSheet from '@/components/AiChatSheet.vue'
import { sendTwinText } from '@/api/twinChat'
import XiaoheiImageIcon from '@/code-assist/components/ImageIcon.vue'
import XiaoheiMicIcon from '@/code-assist/components/MicIcon.vue'
import { compressImageForChat } from '@/code-assist/api'
import { startVoiceInput, stopVoiceInput, cancelVoiceInput } from '@/code-assist/voiceInput'

/** 云存储模型 fileID（控制台上传 twin/model/twin-model.glb） */
const TWIN_MODEL_FILE_ID =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/twin/model/twin-model.glb'

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

/** 舞台背景图（控制台上传，经 getMusicUrl 管理端换链读取） */
const BG_FILE_ID =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/twin/去人猫补全白墙背景.png'

const loading = ref(true)
const fallback = ref(false)
const loadText = ref('初始化…')
const loadPct = ref(0)
const bgUrl = ref('')
const treasureOpen = ref(false)
const chatOpen = ref(false)
const sceneInput = ref('')
const sceneInputFocus = ref(false)
const sceneThinking = ref(false)
const sceneBusy = ref(false)
const typedReply = ref('')
const bubbleDismissed = ref(false)
const sceneKbHeight = ref(0)
const scenePendingImage = ref('')
const sceneVoiceMode = ref(false)
const sceneVoiceRecording = ref(false)
const sceneVoiceRecognizing = ref(false)

let typedTimer = null
let kbBound = false

/** 模型本地路径：onMounted 提前启动，与画布初始化并行 */
let modelPathPromise = null

/** 键盘弹出时输入条上浮到键盘上方，页面本体不动 */
const inputBarStyle = computed(function () {
  if (sceneKbHeight.value > 0) {
    return { bottom: sceneKbHeight.value + 8 + 'px' }
  }
  return {}
})

const canSceneSend = computed(function () {
  if (sceneBusy.value) return false
  const hasText = !!(sceneInput.value || '').trim()
  return hasText || !!scenePendingImage.value
})

const sceneVoiceLabel = computed(function () {
  if (sceneVoiceRecognizing.value) return '识别中…'
  if (sceneVoiceRecording.value) return '松开 发送'
  return '按住 说话'
})

function bindKeyboard() {
  if (kbBound) return
  kbBound = true
  uni.onKeyboardHeightChange(function (res) {
    sceneKbHeight.value = (res && res.height) || 0
  })
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
  // 身份判定不阻塞舞台：云函数 login 与模型下载并行跑
  loadOwnerFlag().catch(function () {})
  bindKeyboard()
  modelPathPromise = fetchModelPath()
  loadStageBg()
  initStage()
})

/** 背景图换链：getMusicUrl 管理端权限（存储权限不影响），失败静默保留渐变底 */
function loadStageBg() {
  wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: { fileID: BG_FILE_ID },
    success: function (res) {
      const body = (res && res.result) || {}
      if (body.ok && body.tempFileURL) bgUrl.value = body.tempFileURL
    },
    fail: function (err) {
      console.warn('舞台背景图换链失败', err)
    },
  })
}

onShow(function () {
  // 回前台恢复渲染（未初始化完成/兜底模式时不启动）
  if (canvasNode && renderer && !loading.value && !fallback.value) startRaf()
})

onHide(function () {
  stopRaf()
})

onUnmounted(function () {
  stopRaf()
  clearBubbleTimers()
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

function initStage() {
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
  camera = new THREE.PerspectiveCamera(42, cssW / cssH, 0.1, 200)
  camera.position.set(0, 0.15, 3)

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
  camera.position.set(0, size.y * 0.18, maxDim * 1.75)
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
  if (
    local.y >= BALL_REGION.yMin &&
    local.y <= BALL_REGION.yMax &&
    local.z >= BALL_REGION.zFront
  ) {
    openTreasure()
  }
}

/* ---------- 场景内对话 ---------- */

async function sendSceneMsg() {
  const t = (sceneInput.value || '').trim()
  const img = scenePendingImage.value
  if ((!t && !img) || sceneBusy.value) return
  sceneBusy.value = true
  sceneInput.value = ''
  scenePendingImage.value = ''
  clearBubbleTimers()
  bubbleDismissed.value = false
  sceneThinking.value = true
  typedReply.value = ''
  try {
    let reply
    if (img) {
      const compressed = await compressImageForChat(img)
      reply = await sendTwinText(t, compressed)
    } else {
      reply = await sendTwinText(t)
    }
    sceneThinking.value = false
    typewrite(reply)
  } catch (err) {
    console.error('场景对话失败', err)
    sceneThinking.value = false
    uni.showToast({ title: String((err && err.message) || '回复失败').slice(0, 30), icon: 'none' })
  } finally {
    sceneBusy.value = false
    if (!sceneVoiceMode.value) {
      sceneInputFocus.value = false
      nextTick(function () {
        sceneInputFocus.value = true
      })
    }
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

function toggleSceneVoice() {
  if (sceneBusy.value || sceneVoiceRecording.value) return
  sceneVoiceMode.value = !sceneVoiceMode.value
  if (sceneVoiceMode.value) {
    // 收起键盘，聚焦让位给按住说话长条
    sceneInputFocus.value = false
  } else {
    cancelVoiceInput()
  }
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

function openChat() {
  chatOpen.value = true
}

function openTreasure() {
  treasureOpen.value = true
}

/** 面板回复同步到头顶气泡，打字机逐字输出，回复常驻显示 */
function onReplied(reply) {
  typewrite(String(reply || '').trim())
}

/** ✕ 关闭气泡：只隐藏当前这条，下一条回复到达时 typewrite 会自动重现 */
function dismissBubble() {
  bubbleDismissed.value = true
  typedReply.value = ''
  clearBubbleTimers()
}

function clearBubbleTimers() {
  if (typedTimer) clearInterval(typedTimer)
  typedTimer = null
}

function typewrite(reply) {
  if (!reply) return
  clearBubbleTimers()
  bubbleDismissed.value = false
  typedReply.value = ''
  let i = 0
  typedTimer = setInterval(function () {
    i += 1
    typedReply.value = reply.slice(0, i)
    if (i >= reply.length) {
      clearInterval(typedTimer)
      typedTimer = null
    }
  }, 40)
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
  background: radial-gradient(ellipse 90% 60% at 50% 30%, #241d33 0%, #121018 70%);
}

/* 背景图 + 暗色蒙层：透明度对齐 PageRoot 深色页标准（图 0.78 + 蒙层渐变） */
.stage-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: -14%;
  bottom: 0;
  width: 100%;
  height: 115%;
  opacity: 0.78;
}

.stage-bg-veil {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(
    165deg,
    rgba(12, 16, 20, 0.42) 0%,
    rgba(12, 16, 20, 0.32) 48%,
    rgba(8, 11, 14, 0.38) 100%
  );
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
  top: 50%;
  transform: translate(-50%, -58%);
}

.fb-avatar {
  width: 380rpx;
  height: 380rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(232, 200, 120, 0.5);
  box-shadow: 0 0 80rpx rgba(232, 200, 120, 0.3);
}

.stage-loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
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

.scene-bubble {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 13%;
  max-width: 640rpx;
  padding: 22rpx 30rpx 16rpx;
  border-radius: 26rpx;
  background: rgba(22, 18, 33, 0.92);
  border: 2rpx solid rgba(232, 200, 120, 0.45);
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.45);
  z-index: 6;
}

/* 右上角 ✕：点击隐藏当前回复 */
.scene-bubble-close {
  position: absolute;
  top: -16rpx;
  right: -16rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 18, 33, 0.95);
  border: 2rpx solid rgba(232, 200, 120, 0.55);
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.4);
}

.bubble-close-x {
  width: 18rpx;
  height: 18rpx;
  position: relative;
}

.bubble-close-x::before,
.bubble-close-x::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18rpx;
  height: 3rpx;
  margin-left: -9rpx;
  margin-top: -1.5rpx;
  border-radius: 2rpx;
  background: rgba(240, 215, 140, 0.9);
}

.bubble-close-x::before {
  transform: rotate(45deg);
}

.bubble-close-x::after {
  transform: rotate(-45deg);
}

/* 下尾巴：指向模型头顶 */
.scene-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -16rpx;
  margin-left: -12rpx;
  width: 0;
  height: 0;
  border-left: 14rpx solid transparent;
  border-right: 14rpx solid transparent;
  border-top: 16rpx solid rgba(22, 18, 33, 0.92);
}

.scene-bubble-text {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 248, 235, 0.95);
  line-height: 1.65;
  word-break: break-all;
}

.scene-bubble-history {
  display: block;
  margin-top: 10rpx;
  text-align: right;
  font-size: 21rpx;
  color: rgba(232, 200, 120, 0.75);
  letter-spacing: 1rpx;
}

/* 筋斗云输入条：云白渐变 + 淡金描边 */
.scene-input-bar {
  position: absolute;
  left: 30rpx;
  right: 30rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 22rpx 16rpx 22rpx 88rpx;
  border-radius: 999rpx;
  background: linear-gradient(
    90deg,
    #ffd6e7 0%,
    #ffe8d6 15%,
    #fff4c4 30%,
    #d6f3e0 46%,
    #cfeaff 62%,
    #e0d6ff 80%,
    #ffd6f0 100%
  );
  box-shadow:
    0 10rpx 34rpx rgba(0, 0, 0, 0.32),
    0 0 30rpx rgba(255, 214, 231, 0.5),
    inset 0 -6rpx 14rpx rgba(255, 255, 255, 0.6),
    inset 0 3rpx 10rpx rgba(255, 255, 255, 0.75);
  z-index: 7;
  transition: bottom 0.25s ease;
}

/* 循环流光：一道彩虹高光缓缓扫过云面 */
.cloud-shine {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 999rpx;
  overflow: hidden;
  pointer-events: none;
}

.cloud-shine::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -45%;
  width: 45%;
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.65) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: cloudShine 3.6s ease-in-out infinite;
}

@keyframes cloudShine {
  0% {
    left: -45%;
  }
  55%,
  100% {
    left: 105%;
  }
}

.cloud-glyph {
  position: absolute;
  left: 30rpx;
  font-size: 36rpx;
  line-height: 1;
  pointer-events: none;
}

/* 图片 / 语音入口：白色半透明圆底，压住浅彩虹底保证图标可读 */
.scene-tool {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.62);
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.scene-tool.active {
  background: rgba(90, 58, 33, 0.24);
  border-color: rgba(90, 58, 33, 0.4);
}

/* 语音模式：输入位变成按住说话长条 */
.scene-voice-hold {
  flex: 1;
  min-width: 0;
  height: 64rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.62);
  border: 2rpx solid rgba(255, 255, 255, 0.9);
}

.scene-voice-hold.recording {
  background: rgba(90, 58, 33, 0.28);
}

.scene-voice-hold.recognizing {
  opacity: 0.75;
  pointer-events: none;
}

.scene-voice-text {
  font-size: 25rpx;
  font-weight: 500;
  color: #5a3a21;
}

/* 待发送图片缩略图：悬在输入条上方 */
.scene-pending {
  position: absolute;
  right: 16rpx;
  bottom: calc(100% + 16rpx);
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.35);
}

.scene-pending-thumb {
  width: 100%;
  height: 100%;
}

.scene-pending-remove {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 18, 33, 0.78);
}

.pending-x {
  width: 16rpx;
  height: 16rpx;
  position: relative;
}

.pending-x::before,
.pending-x::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16rpx;
  height: 3rpx;
  margin-left: -8rpx;
  margin-top: -1.5rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.92);
}

.pending-x::before {
  transform: rotate(45deg);
}

.pending-x::after {
  transform: rotate(-45deg);
}

.scene-input {
  flex: 1;
  height: 64rpx;
  font-size: 27rpx;
  font-weight: 500;
  color: #5a3a21;
}

/* 发送钮：七色小云珠 */
.scene-send {
  width: 96rpx;
  height: 68rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(90deg, #ffd6e7 0%, #fff4c4 32%, #cfeaff 66%, #e0d6ff 100%);
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4rpx 16rpx rgba(255, 214, 231, 0.6);
  flex-shrink: 0;
}

.scene-send.disabled {
  opacity: 0.5;
}

.scene-send-text {
  font-size: 26rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
  color: #4a3608;
}

.scene-send.disabled .scene-send-text {
  color: rgba(90, 80, 100, 0.6);
}

.float-btns {
  position: absolute;
  right: 32rpx;
  bottom: calc(60rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  z-index: 5;
}

.fbtn {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 18, 33, 0.85);
  border: 2rpx solid rgba(232, 200, 120, 0.5);
  box-shadow: 0 8rpx 26rpx rgba(0, 0, 0, 0.4);
}

.fbtn--active {
  transform: translateY(3rpx);
  background: rgba(40, 32, 56, 0.9);
}

.fbtn-text {
  font-size: 26rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: rgba(240, 215, 140, 0.95);
}
</style>
