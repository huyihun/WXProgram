<template>
  <PageRoot>
    <PageLoading v-if="loading" text="打开中" />

    <view v-else class="wrap">
      <view class="paper">
        <text class="title">{{ doc.title || '阅读' }}</text>

        <view v-if="doc.body" class="body">
          <text class="body-text" user-select>{{ doc.body }}</text>
        </view>

        <view v-else-if="doc.mode === 'pdf' || catalogItem.pdfFile" class="pdf-box">
          <text class="pdf-hint">本文暂无法站内提取正文，可使用系统阅读器打开 PDF。</text>
          <view class="pdf-btn" hover-class="pdf-btn--active" @tap="onOpenPdf">
            <text class="pdf-btn-text">用系统打开 PDF</text>
          </view>
        </view>

        <view v-else class="empty">
          <text class="empty-text">暂无正文</text>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { fetchIdeasCatalog, fetchIdeaDoc, openIdeaPdf } from '@/api/ideas'

const loading = ref(true)
const doc = ref({ title: '', body: '', mode: 'text' })
const catalogItem = ref({})

onLoad(async function (query) {
  const id = (query && query.id) || ''
  if (!id) {
    loading.value = false
    uni.showToast({ title: '参数错误', icon: 'none' })
    return
  }
  try {
    const cat = await fetchIdeasCatalog(false)
    const list = (cat && cat.items) || []
    let hit = null
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        hit = list[i]
        break
      }
    }
    if (!hit) throw new Error('未找到条目')
    catalogItem.value = hit
    const data = await fetchIdeaDoc(hit)
    doc.value = {
      title: (data && data.title) || hit.title || '',
      body: (data && data.body) || '',
      mode: (data && data.mode) || hit.mode || 'text',
      pdfFile: (data && data.pdfFile) || hit.pdfFile || '',
    }
  } catch (err) {
    console.error(err)
    uni.showToast({ title: (err && err.message) || '打开失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

async function onOpenPdf() {
  const item = Object.assign({}, catalogItem.value, doc.value)
  uni.showLoading({ title: '打开中', mask: true })
  try {
    await openIdeaPdf(item)
  } catch (err) {
    uni.showToast({ title: (err && err.message) || '打开失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}
</script>

<style lang="scss" scoped>
.wrap {
  padding-bottom: 64rpx;
}

.paper {
  padding: 32rpx 28rpx 40rpx;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 22rpx;
  box-shadow: $shadow-card;
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $color-title;
  line-height: 1.4;
  margin-bottom: 28rpx;
}

.body-text {
  display: block;
  font-size: 30rpx;
  color: $color-title;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.pdf-box {
  padding: 48rpx 16rpx;
  text-align: center;
}

.pdf-hint {
  display: block;
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.6;
  margin-bottom: 32rpx;
}

.pdf-btn {
  display: inline-flex;
  padding: 20rpx 40rpx;
  border-radius: 999rpx;
  background: $color-primary;
}

.pdf-btn--active {
  opacity: 0.88;
}

.pdf-btn-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.empty {
  padding: 80rpx 24rpx;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $color-subtitle;
}
</style>
