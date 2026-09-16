<template>
  <PageRoot>
    <view class="header">
      <text class="title">{{ titleText }}</text>
      <text class="sub">预览将调起系统文档；下载后可另存或转发</text>
    </view>

    <PageLoading v-if="loading" text="加载模板中" />

    <view v-else-if="!items.length" class="empty">
      <text class="empty-text">暂无模板。请上传云存储 resume/ 并部署 getMusicUrl</text>
    </view>

    <view v-else class="list">
      <view v-for="item in items" :key="item.id" class="card">
        <view class="card-main">
          <view class="badge">{{ (item.ext || 'doc').toUpperCase() }}</view>
          <text class="name">{{ item.title || item.id }}</text>
        </view>
        <view class="actions">
          <text
            class="act"
            :class="{ disabled: busyId === item.id }"
            @tap="onPreview(item)"
          >预览</text>
          <text
            class="act act--primary"
            :class="{ disabled: busyId === item.id }"
            @tap="onDownload(item)"
          >下载</text>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { fetchResumeCatalog, openResumeDoc } from '@/api/resume'

const loading = ref(true)
const items = ref([])
const titleText = ref('简历模板')
const busyId = ref('')

onMounted(function () {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchResumeCatalog(true)
    const list = data.items || []
    items.value = list
    titleText.value = (data.title || '简历模板') + ' · ' + list.length
  } catch (err) {
    console.error(err)
    items.value = []
    uni.showToast({ title: '加载失败，请检查云上传与云函数', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function openItem(item, tip) {
  if (!item || busyId.value) return
  busyId.value = item.id
  uni.showLoading({ title: tip || '准备中', mask: true })
  try {
    await openResumeDoc(item)
  } catch (err) {
    console.error(err)
    uni.showToast({
      title: (err && err.message) || '打开失败',
      icon: 'none',
    })
  } finally {
    uni.hideLoading()
    busyId.value = ''
  }
}

function onPreview(item) {
  openItem(item, '下载预览')
}

function onDownload(item) {
  openItem(item, '下载中')
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 28rpx;
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 8rpx;
}

.sub {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  line-height: 1.5;
}

.empty {
  padding: 80rpx 24rpx;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.6;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding-bottom: 48rpx;
}

.card {
  background: rgba(255, 255, 255, 0.88);
  border-radius: 22rpx;
  padding: 24rpx 28rpx;
  box-shadow: $shadow-card;
}

.card-main {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.badge {
  flex-shrink: 0;
  margin-top: 4rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: #fff;
  background: $color-primary;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.name {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-title;
  line-height: 1.45;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 28rpx;
}

.act {
  font-size: 26rpx;
  color: $color-subtitle;
  padding: 8rpx 4rpx;
}

.act--primary {
  color: $color-primary-dark;
  font-weight: 600;
}

.act.disabled {
  opacity: 0.45;
}
</style>
