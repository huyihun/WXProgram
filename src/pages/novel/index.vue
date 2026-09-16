<template>
  <PageRoot>
    <view class="header">
      <text class="subtitle">选择书架</text>
    </view>

    <view class="book-grid">
      <view
        v-for="item in shelves"
        :key="item.id"
        class="book-cell"
        hover-class="book-cell--active"
        @tap="openShelf(item)"
      >
        <view class="book-spine-wrap">
          <view class="book-cover" :class="item.pattern" :style="{ background: item.gradient }">
            <view class="cover-spine" />
            <view class="cover-texture" />
            <text class="cover-glyph">{{ item.glyph }}</text>
          </view>
        </view>
        <text class="book-title">{{ item.name }}</text>
        <text class="book-meta">{{ item.desc }}</text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
const shelves = [
  {
    id: 'dongye',
    name: '东野',
    desc: '东野圭吾作品集',
    glyph: '东野',
    pattern: 'pat-night',
    gradient: 'linear-gradient(155deg, #1a2744 0%, #3d5a80 100%)',
  },
  {
    id: 'zhencang',
    name: '珍藏',
    desc: '人生加减法 等',
    glyph: '珍藏',
    pattern: 'pat-stripe',
    gradient: 'linear-gradient(155deg, #3d2a1a 0%, #a0673a 100%)',
  },
]

function openShelf(item) {
  if (!item || !item.id) return
  uni.navigateTo({
    url: '/pages/novel/shelf?shelf=' + encodeURIComponent(item.id),
  })
}
</script>

<style lang="scss" scoped>
.header {
  margin-bottom: 28rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: $color-subtitle;
  letter-spacing: 2rpx;
}

.book-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 28rpx 20rpx;
  padding-bottom: 48rpx;
}

.book-cell {
  width: calc((100% - 20rpx) / 2);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.book-cell--active {
  opacity: 0.9;
  transform: scale(0.97);
}

.book-spine-wrap {
  width: 100%;
  padding: 0 4rpx 12rpx;
  box-sizing: border-box;
}

.book-cover {
  position: relative;
  width: 100%;
  padding-bottom: 138%;
  border-radius: 6rpx 12rpx 12rpx 6rpx;
  overflow: hidden;
  box-shadow:
    4rpx 8rpx 20rpx rgba(20, 40, 70, 0.22),
    inset -6rpx 0 12rpx rgba(0, 0, 0, 0.18);
}

.cover-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 14rpx;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.35) 0%,
    rgba(255, 255, 255, 0.12) 45%,
    rgba(0, 0, 0, 0.2) 100%
  );
  z-index: 2;
}

.cover-texture {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  opacity: 0.28;
  z-index: 1;
  pointer-events: none;
}

.pat-stripe .cover-texture {
  background: repeating-linear-gradient(
    -18deg,
    transparent 0,
    transparent 10rpx,
    rgba(255, 255, 255, 0.18) 10rpx,
    rgba(255, 255, 255, 0.18) 14rpx
  );
}

.pat-night .cover-texture {
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.7) 1rpx, transparent 2rpx),
    radial-gradient(rgba(255, 255, 255, 0.4) 1rpx, transparent 2rpx);
  background-size: 28rpx 28rpx, 18rpx 22rpx;
  background-position: 4rpx 6rpx, 14rpx 16rpx;
}

.cover-glyph {
  position: absolute;
  left: 18rpx;
  right: 12rpx;
  top: 50%;
  transform: translateY(-54%);
  z-index: 3;
  text-align: center;
  font-size: 44rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 4rpx;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.35);
  line-height: 1.2;
}

.book-title {
  display: block;
  width: 100%;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-title;
  text-align: center;
  line-height: 1.35;
  margin-bottom: 4rpx;
}

.book-meta {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
  text-align: center;
}
</style>
