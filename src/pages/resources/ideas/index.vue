<template>
  <PageRoot>
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ on: tab.key === activeTab }"
        @tap="activeTab = tab.key"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <PageLoading v-if="loading" text="加载中" />

    <view v-else-if="!filtered.length" class="empty">
      <text class="empty-text">暂无内容。请上传云存储 ideas/ 并部署 getMusicUrl</text>
    </view>

    <view v-else class="list">
      <view
        v-for="item in filtered"
        :key="item.id"
        class="row"
        hover-class="row--active"
        @tap="openItem(item)"
      >
        <view class="row-main">
          <text class="row-title">{{ item.title }}</text>
          <text v-if="item.mode === 'pdf'" class="row-tag">PDF</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import { fetchIdeasCatalog } from '@/api/ideas'

const loading = ref(true)
const allItems = ref([])
const tabs = ref([
  { key: 'sixiang', label: '思路' },
  { key: 'dianzi', label: '点子' },
])
const activeTab = ref('sixiang')

const filtered = computed(function () {
  const list = allItems.value || []
  const key = activeTab.value
  const out = []
  for (let i = 0; i < list.length; i++) {
    if (list[i].category === key) out.push(list[i])
  }
  return out
})

onMounted(function () {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchIdeasCatalog(true)
    allItems.value = data.items || []
    if (data.categories && data.categories.length) {
      tabs.value = data.categories
      if (!tabs.value.some(function (t) { return t.key === activeTab.value })) {
        activeTab.value = tabs.value[0].key
      }
    }
  } catch (err) {
    console.error(err)
    allItems.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openItem(item) {
  if (!item || !item.id) return
  uni.navigateTo({
    url: '/pages/resources/ideas/read?id=' + encodeURIComponent(item.id),
  })
}
</script>

<style lang="scss" scoped>
.tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.tab {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.55);
}

.tab.on {
  background: $color-primary;
}

.tab-text {
  font-size: 26rpx;
  color: $color-title;
  font-weight: 600;
}

.tab.on .tab-text {
  color: #fff;
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
  gap: 12rpx;
  padding-bottom: 48rpx;
}

.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 28rpx;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 18rpx;
  box-shadow: $shadow-card;
}

.row--active {
  opacity: 0.88;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.row-title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-title;
  line-height: 1.45;
}

.row-tag {
  flex-shrink: 0;
  font-size: 20rpx;
  color: #fff;
  background: $color-primary;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  margin-top: 4rpx;
}

.row-arrow {
  flex-shrink: 0;
  font-size: 36rpx;
  color: $color-subtitle;
}
</style>
