<template>
  <PageRoot>
    <view class="header">
      <text class="subtitle">{{ titleText }}</text>
      <text v-if="isOwner" class="hint">长按可删除</text>
    </view>

    <PageLoading v-if="loading" text="加载壁纸中" />
    <view v-else-if="!items.length" class="state">
      <text class="state-text">暂无壁纸，请上传 wallpaper/zhencang/</text>
    </view>
    <view v-else class="grid">
      <view
        v-for="item in items"
        :key="item.id"
        class="cell"
        hover-class="cell--active"
        @tap="onTap(item)"
        @longpress="onLongPress(item)"
      >
        <image
          v-if="urlMap[item.id]"
          class="thumb"
          :src="urlMap[item.id]"
          mode="aspectFill"
          lazy-load
        />
        <view v-else class="thumb thumb--wait">
          <text class="wait-text">…</text>
        </view>
        <view class="cell-actions" @tap.stop>
          <text class="act" @tap="previewOne(item)">查看</text>
          <text class="act" @tap="downloadOne(item)">下载</text>
          <text class="act" @tap="copyFileId(item)">fileId</text>
          <text v-if="isOwner" class="act act--danger" @tap="confirmDelete(item)">删除</text>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  fetchWallpaperCatalog,
  resolveWallpaperUrl,
  saveWallpaperToAlbum,
  deleteWallpaper,
  dropWallpaperItems,
} from '@/api/wallpaper'
import { getWallpaperFileID } from '@/utils/wallpaperCatalog'
import { isOwnerSync, loadOwnerFlag } from '@/utils/owner'

const loading = ref(true)
const items = ref([])
const titleText = ref('壁纸')
const urlMap = ref({})
const isOwner = ref(isOwnerSync())
const busyId = ref('')

onMounted(async () => {
  try {
    await loadOwnerFlag()
  } catch (e) {
    // ignore
  }
  isOwner.value = isOwnerSync()
  await loadList()
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchWallpaperCatalog(true)
    titleText.value = (data.title || '壁纸') + ' · ' + ((data.items && data.items.length) || 0)
    items.value = data.items || []
    await warmUrls(items.value)
  } catch (err) {
    console.error('加载壁纸失败', err)
    items.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function warmUrls(list) {
  const next = Object.assign({}, urlMap.value)
  const dead = []
  // 分批换链，避免一次打爆
  const BATCH = 8
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH)
    await Promise.all(
      slice.map(async function (item) {
        try {
          const url = await resolveWallpaperUrl(item)
          if (url) next[item.id] = url
          else dead.push(item.id)
        } catch (e) {
          dead.push(item.id)
        }
      })
    )
    urlMap.value = Object.assign({}, next)
  }
  if (!dead.length) return
  dropWallpaperItems(dead)
  const keep = []
  for (let i = 0; i < items.value.length; i++) {
    const row = items.value[i]
    if (!row || dead.indexOf(row.id) >= 0) continue
    keep.push(row)
  }
  items.value = keep
  titleText.value = '壁纸 · ' + keep.length
}

function collectPreviewUrls() {
  const urls = []
  const list = items.value
  for (let i = 0; i < list.length; i++) {
    const u = urlMap.value[list[i].id]
    if (u) urls.push(u)
  }
  return urls
}

async function ensureUrl(item) {
  if (urlMap.value[item.id]) return urlMap.value[item.id]
  const url = await resolveWallpaperUrl(item)
  if (url) {
    const next = Object.assign({}, urlMap.value)
    next[item.id] = url
    urlMap.value = next
  }
  return url || ''
}

async function previewOne(item) {
  try {
    const current = await ensureUrl(item)
    if (!current) {
      uni.showToast({ title: '无法预览', icon: 'none' })
      return
    }
    const urls = collectPreviewUrls()
    uni.previewImage({
      current: current,
      urls: urls.length ? urls : [current],
    })
  } catch (e) {
    uni.showToast({ title: '预览失败', icon: 'none' })
  }
}

function onTap(item) {
  previewOne(item)
}

function copyFileId(item) {
  const fid = getWallpaperFileID(item)
  if (!fid) {
    uni.showToast({ title: '无 fileId', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data: fid,
    success() {
      uni.showToast({ title: 'fileId 已复制', icon: 'none' })
    },
  })
}

function onLongPress(item) {
  if (!isOwner.value) return
  confirmDelete(item)
}

async function downloadOne(item) {
  if (busyId.value) return
  busyId.value = item.id
  uni.showLoading({ title: '保存中', mask: true })
  try {
    await saveWallpaperToAlbum(item)
    uni.showToast({ title: '已保存到相册', icon: 'success' })
  } catch (e) {
    const msg = (e && e.message) || '保存失败'
    uni.showToast({ title: msg.indexOf('权限') >= 0 ? '需要相册权限' : '保存失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    busyId.value = ''
  }
}

function confirmDelete(item) {
  if (!isOwner.value) return
  uni.showModal({
    title: '删除壁纸',
    content: '将从云存储删除「' + item.id + '」，不可恢复',
    confirmColor: '#c45c5c',
    success: function (r) {
      if (r.confirm) doDelete(item)
    },
  })
}

async function doDelete(item) {
  if (busyId.value) return
  busyId.value = item.id
  uni.showLoading({ title: '删除中', mask: true })
  try {
    await deleteWallpaper(item)
    const nextMap = Object.assign({}, urlMap.value)
    delete nextMap[item.id]
    urlMap.value = nextMap
    const nextItems = []
    for (let i = 0; i < items.value.length; i++) {
      if (items.value[i].id !== item.id) nextItems.push(items.value[i])
    }
    items.value = nextItems
    titleText.value = '壁纸 · ' + nextItems.length
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '删除失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    busyId.value = ''
  }
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 24rpx;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.subtitle {
  font-size: 28rpx;
  color: $color-subtitle;
  letter-spacing: 2rpx;
}

.hint {
  font-size: 22rpx;
  color: rgba(140, 120, 100, 0.75);
}

.state {
  padding: 80rpx 24rpx;
  text-align: center;
}

.state-text {
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.6;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding-bottom: 48rpx;
}

.cell {
  width: calc((100% - 32rpx) / 3);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.cell--active {
  opacity: 0.88;
}

.thumb {
  width: 100%;
  height: 280rpx;
  border-radius: 12rpx;
  background: rgba(40, 50, 70, 0.08);
}

.thumb--wait {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wait-text {
  font-size: 28rpx;
  color: $color-subtitle;
}

.cell-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  justify-content: center;
}

.act {
  font-size: 20rpx;
  color: $color-primary;
  padding: 4rpx 8rpx;
}

.act--danger {
  color: #c45c5c;
}
</style>
