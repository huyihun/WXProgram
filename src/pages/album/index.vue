<template>
  <PageRoot>
    <view class="album-page">
      <!-- 顶部：标题 + 数量 + 操作 -->
      <view class="album-head">
        <text class="album-title">云相册</text>
        <text class="album-count">{{ photos.length }} 张</text>
        <view class="head-actions">
          <view
            v-if="photos.length && !uploading"
            class="head-btn"
            :class="{ on: managing }"
            hover-class="head-btn--active"
            @tap="toggleManage"
          >
            <text class="head-btn-text">{{ managing ? '取消' : '管理' }}</text>
          </view>
          <view
            class="head-btn head-btn--gold"
            :class="{ disabled: uploading }"
            hover-class="head-btn--active"
            @tap="startUpload"
          >
            <text class="head-btn-text head-btn-text--dark">{{ uploading ? '上传中' : '上传' }}</text>
          </view>
        </view>
      </view>

      <!-- 空态 -->
      <view v-if="!photos.length && !loading" class="album-empty">
        <text class="empty-glyph">☁️</text>
        <text class="empty-text">{{ needSetup ? '相册集合未创建：请在云控制台数据库新建集合 album（权限选「仅创建者可读写」）' : '还没有照片，点右上「上传」保存第一张' }}</text>
      </view>

      <!-- 网格 -->
      <view class="album-grid">
        <view
          v-for="(item, i) in photos"
          :key="item._id || i"
          class="cell"
          :class="{ selected: managing && selectedMap[item._id] }"
          hover-class="cell--active"
          @tap="onTapPhoto(item, i)"
        >
          <image class="cell-img" :src="item.fileID" mode="aspectFill" lazy-load />
          <view v-if="managing && selectedMap[item._id]" class="cell-check">
            <text class="cell-check-text">✓</text>
          </view>
        </view>
      </view>

      <view v-if="loading" class="album-tip">
        <text class="tip-text">加载中…</text>
      </view>
      <view v-else-if="hasMore && photos.length" class="album-tip" @tap="loadMore">
        <text class="tip-text">加载更多</text>
      </view>

      <!-- 管理模式底部操作条 -->
      <view v-if="managing" class="manage-bar">
        <text class="manage-count">已选 {{ selectedCount }} 张</text>
        <view
          class="manage-del"
          :class="{ disabled: !selectedCount }"
          hover-class="manage-del--active"
          @tap="deleteSelected"
        >
          <text class="manage-del-text">删除</text>
        </view>
      </view>

      <!-- 上传进度遮罩 -->
      <view v-if="uploading" class="upload-mask">
        <view class="upload-card">
          <view class="upload-spinner">
            <view class="spin-ring" />
            <text class="spin-glyph">☁️</text>
          </view>
          <text class="upload-title">上传中 {{ uploadDone }}/{{ uploadTotal }}</text>
          <view class="upload-track">
            <view class="upload-fill" :style="{ width: uploadPct + '%' }" />
          </view>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  albumDeleteFile,
  countPhotos,
  getPhotoTempUrls,
  listPhotos,
  removePhotoDoc,
  uploadPhoto,
} from '@/api/album'

const photos = ref([])
const loading = ref(false)
const hasMore = ref(true)
const managing = ref(false)
const selectedMap = ref({})
const uploading = ref(false)
const uploadText = ref('')
const uploadDone = ref(0)
const uploadTotal = ref(0)
const needSetup = ref(false)
const total = ref(0)

const uploadPct = computed(function () {
  if (!uploadTotal.value) return 0
  return Math.floor((uploadDone.value / uploadTotal.value) * 100)
})

const selectedCount = computed(function () {
  return Object.keys(selectedMap.value).length
})

/** 集合未创建等资源缺失错误识别 */
function isNoCollectionErr(err) {
  const s = String((err && (err.errCode || err.errMsg || err.message)) || '')
  return s.indexOf('-502005') >= 0 || s.indexOf('collection not exists') >= 0
}

onShow(function () {
  loadFirst()
})

async function loadFirst() {
  loading.value = true
  try {
    photos.value = await listPhotos(0)
    hasMore.value = photos.value.length >= 20
    try {
      const c = await countPhotos()
      total.value = c.total || 0
    } catch (e) {
      // 计数失败不阻断
    }
  } catch (err) {
    console.error('相册加载失败', err)
    if (isNoCollectionErr(err)) needSetup.value = true
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const page = await listPhotos(photos.value.length)
    photos.value = photos.value.concat(page)
    hasMore.value = page.length >= 20
  } catch (err) {
    console.error('相册翻页失败', err)
  } finally {
    loading.value = false
  }
}

/* ---------- 上传（原图，批量逐张） ---------- */

function startUpload() {
  if (uploading.value) return
  uni.chooseMedia({
    count: 9,
    mediaType: ['image'],
    sourceType: ['album'],
    sizeType: ['original'],
    success: function (res) {
      const files = (res.tempFiles || []).filter(function (f) {
        return f && f.tempFilePath
      })
      if (!files.length) return
      uploadBatch(files)
    },
  })
}

async function uploadBatch(files) {
  uploading.value = true
  uploadDone.value = 0
  uploadTotal.value = files.length
  let okCount = 0
  let aborted = false
  for (let i = 0; i < files.length; i++) {
    try {
      const rec = await uploadPhoto(files[i].tempFilePath, files[i].size)
      photos.value.unshift(rec)
      okCount += 1
    } catch (err) {
      console.error('上传失败', err)
      // 集合未创建时整批必失败，直接中止
      if (isNoCollectionErr(err)) {
        needSetup.value = true
        uni.showToast({ title: '请先在控制台创建 album 集合', icon: 'none', duration: 2500 })
        aborted = true
        break
      }
    }
    uploadDone.value = i + 1
  }
  uploading.value = false
  uploadText.value = ''
  if (!aborted) {
    uni.showToast({
      title: okCount === files.length ? '已上传 ' + okCount + ' 张' : '成功 ' + okCount + ' 张，失败 ' + (files.length - okCount) + ' 张',
      icon: 'none',
    })
  }
}

/* ---------- 预览 ---------- */

async function previewAt(index) {
  uni.showLoading({ title: '加载中', mask: true })
  try {
    const ids = photos.value.map(function (p) {
      return p.fileID
    })
    const urls = await getPhotoTempUrls(ids)
    uni.hideLoading()
    const list = urls.filter(function (u) {
      return u
    })
    if (!list.length) {
      uni.showToast({ title: '预览失败', icon: 'none' })
      return
    }
    uni.previewImage({
      urls: list,
      current: list[Math.min(index, list.length - 1)],
    })
  } catch (err) {
    uni.hideLoading()
    console.error('预览失败', err)
    uni.showToast({ title: '预览失败', icon: 'none' })
  }
}

/* ---------- 管理与删除 ---------- */

function toggleManage() {
  managing.value = !managing.value
  selectedMap.value = {}
}

function onTapPhoto(item, index) {
  if (managing.value) {
    const m = selectedMap.value
    if (m[item._id]) delete m[item._id]
    else m[item._id] = true
    selectedMap.value = Object.assign({}, m)
    return
  }
  previewAt(index)
}

function deleteSelected() {
  if (!selectedCount.value) return
  const ids = Object.keys(selectedMap.value)
  uni.showModal({
    title: '删除照片？',
    content: '将删除选中的 ' + ids.length + ' 张照片，不可恢复',
    confirmText: '删除',
    confirmColor: '#e05545',
    success: function (res) {
      if (res.confirm) runDelete(ids)
    },
  })
}

async function runDelete(ids) {
  uni.showLoading({ title: '删除中', mask: true })
  const byId = {}
  photos.value.forEach(function (p) {
    if (ids.indexOf(p._id) >= 0) byId[p._id] = p
  })
  let okCount = 0
  for (let i = 0; i < ids.length; i++) {
    const item = byId[ids[i]]
    if (!item) continue
    try {
      await albumDeleteFile(item.fileID)
    } catch (err) {
      console.warn('云文件删除失败', err)
    }
    try {
      await removePhotoDoc(item._id)
      okCount += 1
    } catch (err) {
      console.warn('记录删除失败', err)
    }
  }
  const rm = {}
  ids.forEach(function (id) {
    rm[id] = true
  })
  photos.value = photos.value.filter(function (p) {
    return !rm[p._id]
  })
  selectedMap.value = {}
  uni.hideLoading()
  uni.showToast({ title: '已删除 ' + okCount + ' 张', icon: 'none' })
  if (!photos.value.length) managing.value = false
}
</script>

<style lang="scss" scoped>
.album-page {
  min-height: 100vh;
  padding: 24rpx 28rpx calc(60rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.album-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.album-title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--color-title);
  letter-spacing: 2rpx;
}

.album-count {
  font-size: 24rpx;
  color: var(--color-subtitle);
}

.head-actions {
  margin-left: auto;
  display: flex;
  gap: 14rpx;
}

.head-btn {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: var(--color-card-soft, #faf6f2);
  box-shadow: var(--shadow-card-pressed);
}

.head-btn.on {
  background: var(--color-primary);
}

.head-btn--active {
  transform: translateY(2rpx);
  opacity: 0.9;
}

.head-btn.disabled {
  opacity: 0.5;
}

.head-btn--gold {
  background: var(--color-primary);
}

.head-btn-text {
  font-size: 25rpx;
  font-weight: 600;
  color: var(--color-title);
}

.head-btn--gold .head-btn-text,
.head-btn.on .head-btn-text {
  color: #ffffff;
}

.album-empty {
  padding: 160rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.empty-glyph {
  font-size: 80rpx;
}

.empty-text {
  font-size: 25rpx;
  color: var(--color-subtitle);
}

.album-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.cell {
  position: relative;
  width: calc((100% - 20rpx) / 3);
  height: 220rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: var(--color-card-soft, #faf6f2);
}

.cell--active {
  opacity: 0.88;
}

.cell.selected {
  border: 4rpx solid var(--color-primary);
}

.cell.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
}

.cell-img {
  width: 100%;
  height: 100%;
}

.cell-check {
  position: absolute;
  right: 10rpx;
  top: 10rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.cell-check-text {
  font-size: 24rpx;
  color: #ffffff;
  font-weight: 700;
}

.album-tip {
  padding: 30rpx 0;
  display: flex;
  justify-content: center;
}

.tip-text {
  font-size: 24rpx;
  color: var(--color-subtitle);
}

.manage-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-nav, #ede2d6);
  box-shadow: 0 -6rpx 24rpx rgba(0, 0, 0, 0.08);
  z-index: 20;
}

.manage-count {
  font-size: 26rpx;
  color: var(--color-subtitle);
}

.manage-del {
  padding: 16rpx 60rpx;
  border-radius: 999rpx;
  background: #e05545;
}

.manage-del--active {
  opacity: 0.85;
}

.manage-del.disabled {
  opacity: 0.4;
}

.manage-del-text {
  font-size: 27rpx;
  font-weight: 700;
  color: #ffffff;
}

/* 上传进度遮罩 */
.upload-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.upload-card {
  width: 460rpx;
  padding: 46rpx 40rpx 40rpx;
  border-radius: 24rpx;
  background: var(--color-card-soft, #faf6f2);
  box-shadow: var(--shadow-card-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26rpx;
}

.upload-spinner {
  position: relative;
  width: 110rpx;
  height: 110rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spin-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 6rpx solid rgba(139, 94, 60, 0.18);
  border-top-color: var(--color-primary);
  animation: spinRotate 0.9s linear infinite;
}

@keyframes spinRotate {
  to {
    transform: rotate(360deg);
  }
}

.spin-glyph {
  font-size: 44rpx;
}

.upload-title {
  font-size: 27rpx;
  font-weight: 600;
  color: var(--color-title);
  letter-spacing: 1rpx;
}

.upload-track {
  width: 100%;
  height: 12rpx;
  border-radius: 999rpx;
  background: rgba(139, 94, 60, 0.15);
  overflow: hidden;
}

.upload-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  transition: width 0.25s ease;
}
</style>
