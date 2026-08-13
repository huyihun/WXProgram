<template>
  <view class="music-root" :class="{ 'music-root--gold': isMaster }">
    <!-- 曲目列表面板 -->
    <view v-if="sheetOpen" class="sheet-mask" @tap="closeSheet" @touchmove.stop.prevent />
    <view
      v-if="sheetOpen"
      class="sheet"
      :class="{
        'sheet--vip': isVip,
        'sheet--gold': isMaster,
      }"
      @tap.stop
      @touchmove.stop
    >
      <view class="sheet-handle" />
      <view class="sheet-head">
        <text class="sheet-title">{{ sheetTitle }}</text>
        <text class="sheet-count">{{ playlist.length }} 首</text>
        <text class="sheet-close" @tap="closeSheet">收起</text>
      </view>
      <scroll-view
        scroll-y
        class="sheet-scroll"
        :scroll-into-view="sheetScrollInto"
        :show-scrollbar="false"
      >
        <view
          v-for="(item, i) in playlist"
          :id="'track-' + i"
          :key="item.id"
          class="sheet-item"
          :class="{ active: i === currentIndex, playing: i === currentIndex && playing }"
          @tap="onPickTrack(i)"
        >
          <view class="sheet-item-left">
            <text class="sheet-no">{{ i + 1 }}</text>
            <view class="sheet-meta">
              <text class="sheet-name">{{ item.title || '未命名' }}</text>
              <text class="sheet-artist">{{ item.artist || '未知歌手' }}</text>
            </view>
          </view>
          <view class="sheet-item-right">
            <view v-if="i === currentIndex && playing" class="sheet-eq">
              <view class="eq-bar b1" />
              <view class="eq-bar b2" />
              <view class="eq-bar b3" />
            </view>
            <text v-else-if="i === currentIndex" class="sheet-now">当前</text>
            <view
              class="sheet-pin"
              :class="{ on: isPinned(item.fileID) }"
              hover-class="sheet-pin--active"
              @tap.stop="onPinTrack(i)"
            >
              <view class="ico-pin">
                <view class="ico-pin-head" />
                <view class="ico-pin-needle" />
              </view>
            </view>
            <view class="sheet-del" hover-class="sheet-del--active" @tap.stop="onDeleteTrack(i)">
              <view class="ico-trash">
                <view class="ico-trash-cap" />
                <view class="ico-trash-lid" />
                <view class="ico-trash-body" />
              </view>
            </view>
          </view>
        </view>
        <view class="sheet-scroll-tail" />
      </scroll-view>
    </view>

    <!-- 切换歌单面板 -->
    <view
      v-if="playlistPickerOpen"
      class="sheet-mask"
      @tap="closePlaylistPicker"
      @touchmove.stop.prevent
    />
    <view v-if="playlistPickerOpen" class="picker-sheet" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="picker-head">
        <text class="picker-title">切换歌单</text>
        <text class="sheet-close" @tap="closePlaylistPicker">取消</text>
      </view>
      <view
        v-for="opt in playlistOptions"
        :key="opt.mode"
        class="picker-item"
        :class="{ active: mode === opt.mode }"
        @tap="onPickPlaylist(opt.mode)"
      >
        <view class="picker-item-main">
          <text class="picker-item-name">{{ opt.name }}</text>
          <text class="picker-item-desc">{{ opt.desc }}</text>
        </view>
        <view
          class="picker-default"
          :class="{ on: preferredMode === opt.mode }"
          hover-class="picker-default--active"
          @tap.stop="onSetDefaultPlaylist(opt.mode)"
        >
          <text class="picker-star">{{ preferredMode === opt.mode ? '★' : '☆' }}</text>
        </view>
        <text v-if="mode === opt.mode" class="picker-check">✓</text>
      </view>
      <view class="picker-tail" />
    </view>

    <!-- 底部播放条 -->
    <view
      class="music-bar"
      :class="{
        playing: playing,
        'music-bar--vip': isVip,
        'music-bar--gold': isMaster,
        'music-bar--dl': showDownloadBar,
      }"
    >
      <view v-if="showDownloadBar" class="music-dl">
        <view class="music-dl-top">
          <text class="music-dl-label">母带载入</text>
          <text class="music-dl-pct">{{ downloadProgress }}%</text>
        </view>
        <view class="music-dl-track">
          <view class="music-dl-fill" :style="{ width: downloadProgress + '%' }">
            <view class="music-dl-shine" />
          </view>
        </view>
      </view>
      <view v-else class="music-accent" :class="{ on: playing }" />

      <view class="music-body">
        <view class="music-info">
          <view
            class="music-disc"
            :class="{
              spinning: playing && !isDownloading,
              idle: !playing && !isDownloading,
              loading: isDownloading,
              'music-disc--vip': isVip,
              'music-disc--gold': isMaster,
            }"
          >
            <image class="disc-cover" :src="discCover" mode="aspectFill" />
            <view class="disc-hub" />
            <view class="disc-shine" />
            <view class="disc-glow" />
            <view v-if="isDownloading" class="disc-loading">
              <view class="disc-loading-ring" />
              <view class="disc-loading-arrow" />
            </view>
          </view>

          <view class="music-text">
            <view
              class="vip-badge"
              :class="{
                'vip-badge--vip': isVip,
                'vip-badge--gold': isMaster,
              }"
            >
              <text class="vip-badge-text">{{ badgeText }}</text>
            </view>
            <text class="music-title">{{ track.title || '暂无歌曲' }}</text>
            <text class="music-sub">{{ statusText }}</text>
          </view>
        </view>

        <view class="music-actions">
          <view class="ctrl-btn" hover-class="ctrl-btn--active" @tap="onPrev">
            <view class="ico-skip ico-prev">
              <view class="ico-skip-bar" />
              <view class="ico-skip-tri" />
            </view>
          </view>

          <view class="play-btn" hover-class="play-btn--active" @tap="onToggle">
            <view v-if="isDownloading" class="ico-loading">
              <view class="ico-loading-ring" />
            </view>
            <view v-else-if="playing" class="ico-pause">
              <view class="ico-pause-bar" />
              <view class="ico-pause-bar" />
            </view>
            <view v-else class="ico-play" />
          </view>

          <view class="ctrl-btn" hover-class="ctrl-btn--active" @tap="onNext">
            <view class="ico-skip ico-next">
              <view class="ico-skip-tri" />
              <view class="ico-skip-bar" />
            </view>
          </view>

          <view class="list-btn" hover-class="list-btn--active" @tap="toggleSheet">
            <view class="ico-list">
              <view class="ico-list-line" />
              <view class="ico-list-line short" />
              <view class="ico-list-line" />
            </view>
          </view>

          <view class="switch-btn" hover-class="switch-btn--active" @tap="togglePlaylistPicker">
            <view class="ico-switch">
              <view class="ico-switch-layer l1" />
              <view class="ico-switch-layer l2" />
              <view class="ico-switch-layer l3" />
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import {
  MUSIC_MODE_SUPER_PLAYER,
  MUSIC_MODE_VIP,
  subscribeInnerMusic,
  toggleInnerMusic,
  playPrevInnerMusic,
  playNextInnerMusic,
  playInnerTrackAt,
  pinInnerTrackAt,
  removeInnerTrackAt,
  isInnerTrackPinned,
  switchMusicMode,
  loadMusicPrefsAndRefresh,
  getPreferredMusicMode,
  setPreferredMusicMode,
  getPlaylistOptions,
  isMasterMusicMode,
  isWifiOnlyMusicMode,
  getModeMeta,
} from '@/utils/innerMusic'
import { isWifiNetwork } from '@/utils/playlist'

const playlist = ref([])
const playing = ref(false)
const loading = ref(false)
const ready = ref(false)
const currentIndex = ref(0)
const mode = ref(MUSIC_MODE_SUPER_PLAYER)
const track = ref({ title: '', artist: '', fileID: '', id: '' })
const sheetOpen = ref(false)
const sheetScrollInto = ref('')
const playlistPickerOpen = ref(false)
const preferredMode = ref(MUSIC_MODE_SUPER_PLAYER)
const deleting = ref(false)
const downloadProgress = ref(0)

const playlistOptions = getPlaylistOptions()

let unsubscribe = null

const isMaster = computed(() => isMasterMusicMode(mode.value))
const isWifiOnly = computed(() => isWifiOnlyMusicMode(mode.value))
const isVip = computed(() => mode.value === MUSIC_MODE_VIP)
const modeMeta = computed(() => getModeMeta(mode.value))

const sheetTitle = computed(() => (modeMeta.value && modeMeta.value.label) || '歌单')
const badgeText = computed(() => (modeMeta.value && modeMeta.value.badge) || '')
const discCover = computed(() => (modeMeta.value && modeMeta.value.cover) || '/static/rossi.jpg')

const isDownloading = computed(() => loading.value && !ready.value)
const showDownloadBar = computed(() => isMaster.value && isDownloading.value)

const statusText = computed(() => {
  const artist = track.value.artist || ''
  if (isMaster.value && isDownloading.value) {
    if (downloadProgress.value > 0) return '母带下载中 · ' + downloadProgress.value + '%'
    return '正在准备母带…'
  }
  if (isWifiOnly.value && playing.value) {
    return artist ? artist + ' · Wi‑Fi' : 'Wi‑Fi 播放中'
  }
  if (playing.value) {
    return artist ? artist + ' · 播放中' : '播放中'
  }
  return artist || ''
})

function applyMusicState(state) {
  playing.value = state.playing
  loading.value = state.loading
  ready.value = state.ready
  currentIndex.value = state.index
  track.value = state.track
  mode.value = state.mode
  downloadProgress.value = state.downloadProgress != null ? state.downloadProgress : 0
  playlist.value = state.playlist || []
}

function bindPlayer() {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  unsubscribe = subscribeInnerMusic(applyMusicState)
}

onMounted(() => {
  bindPlayer()
  loadMusicPrefsAndRefresh()
    .then(() => {
      preferredMode.value = getPreferredMusicMode()
      return switchMusicMode(preferredMode.value)
    })
    .catch((err) => {
      console.warn('音乐偏好加载失败', err)
      preferredMode.value = getPreferredMusicMode()
      switchMusicMode(preferredMode.value)
    })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
})

function onToggle() {
  toggleInnerMusic()
}

function onPrev() {
  playPrevInnerMusic()
}

function onNext() {
  playNextInnerMusic()
}

function toggleSheet() {
  playlistPickerOpen.value = false
  const next = !sheetOpen.value
  sheetOpen.value = next
  if (!next) return
  sheetScrollInto.value = ''
  nextTick(() => {
    sheetScrollInto.value = 'track-' + currentIndex.value
  })
}

function closeSheet() {
  sheetOpen.value = false
}

function togglePlaylistPicker() {
  sheetOpen.value = false
  preferredMode.value = getPreferredMusicMode()
  playlistPickerOpen.value = !playlistPickerOpen.value
}

function closePlaylistPicker() {
  playlistPickerOpen.value = false
}

async function onPickPlaylist(targetMode) {
  playlistPickerOpen.value = false
  if (targetMode === mode.value) return
  if (isWifiOnlyMusicMode(targetMode)) {
    const wifi = await isWifiNetwork()
    if (!wifi) {
      const res = await uni.showModal({
        content: '连WI-FI才能听，毕竟是母带音质，懂？',
        confirmText: '懂',
        cancelText: '不懂',
      })
      if (!res.confirm) return
    }
  }
  await switchMusicMode(targetMode)
}

async function onSetDefaultPlaylist(targetMode) {
  try {
    preferredMode.value = await setPreferredMusicMode(targetMode)
    uni.showToast({ title: '已设为默认歌单', icon: 'none' })
  } catch (err) {
    console.error('设置默认歌单失败', err)
    const msg = (err && err.message) || '设置失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  }
}

function onPickTrack(i) {
  playInnerTrackAt(i)
  sheetOpen.value = false
}

function isPinned(fileID) {
  return isInnerTrackPinned(fileID)
}

async function onPinTrack(i) {
  const item = playlist.value[i]
  if (!item) return
  try {
    await pinInnerTrackAt(i)
    uni.showToast({ title: '已置顶', icon: 'none' })
  } catch (err) {
    console.error('置顶失败', err)
    const msg = (err && err.message) || '置顶失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  }
}

function onDeleteTrack(i) {
  const item = playlist.value[i]
  if (!item) return
  if (deleting.value) return

  uni.showModal({
    title: '删除歌曲',
    content: '确定删除「' + (item.title || '未命名') + '」？',
    confirmText: '删除',
    confirmColor: '#c45c4a',
    success: async (res) => {
      if (!res.confirm) return
      deleting.value = true
      try {
        await removeInnerTrackAt(i)
        uni.showToast({ title: '已删除', icon: 'success' })
      } catch (err) {
        console.error('删除歌曲失败', err)
        const msg = (err && err.message) || '删除失败'
        uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
      } finally {
        deleting.value = false
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.music-root {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 120;
  pointer-events: none;
}

.music-root > view {
  pointer-events: auto;
}

.music-root--gold .music-bar--gold {
  border: 4rpx solid #d4a017;
  box-shadow:
    0 0 0 2rpx rgba(255, 215, 100, 0.55),
    0 -8rpx 28rpx rgba(180, 130, 40, 0.28);
  background: linear-gradient(180deg, #fff9e8 0%, #fff 55%);
}

.music-root--gold .sheet--gold {
  border: 4rpx solid #d4a017;
  border-bottom: none;
  box-shadow:
    0 0 0 2rpx rgba(255, 215, 100, 0.4),
    0 -12rpx 40rpx rgba(180, 130, 40, 0.22);
}

.sheet--gold .sheet-title {
  color: #8a6418;
}

.vip-badge--gold {
  background: linear-gradient(135deg, #f0d78c 0%, #c9a227 100%);
}

.vip-badge--gold .vip-badge-text {
  color: #5c4308;
}

.music-disc--gold {
  box-shadow: 0 0 0 3rpx rgba(212, 160, 23, 0.55);
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(15, 45, 74, 0.28);
  z-index: 130;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 131;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: $color-card;
  border-radius: 32rpx 32rpx 0 0;
  box-shadow: 0 -12rpx 40rpx rgba(43, 127, 212, 0.14);
  padding-bottom: 0;
  box-sizing: border-box;
}

.sheet--vip {
  box-shadow: 0 -12rpx 40rpx rgba(180, 130, 40, 0.16);
}

.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.1);
  margin: 16rpx auto 8rpx;
}

.sheet-head {
  display: flex;
  align-items: baseline;
  padding: 8rpx 36rpx 20rpx;
  gap: 12rpx;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
}

.sheet--vip .sheet-title {
  color: #8a6418;
}

.sheet-count {
  flex: 1;
  font-size: 24rpx;
  color: $color-subtitle;
}

.sheet-close {
  font-size: 26rpx;
  color: $color-primary-dark;
  padding: 8rpx 4rpx;
}

.sheet-scroll {
  flex: 1;
  height: 64vh;
  max-height: 64vh;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.sheet-scroll-tail {
  height: calc(260rpx + env(safe-area-inset-bottom));
  width: 100%;
}

.picker-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 132;
  background: $color-card;
  border-radius: 32rpx 32rpx 0 0;
  box-shadow: 0 -12rpx 40rpx rgba(43, 127, 212, 0.14);
  padding: 0 20rpx;
  box-sizing: border-box;
}

.picker-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8rpx 16rpx 20rpx;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 20rpx;
  border-radius: 18rpx;
  margin-bottom: 6rpx;
  background: rgba(74, 159, 232, 0.04);
}

.picker-item.active {
  background: rgba(74, 159, 232, 0.14);
}

.picker-item-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
  flex: 1;
}

.picker-item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
}

.picker-item.active .picker-item-name {
  color: $color-primary-dark;
}

.picker-item-desc {
  font-size: 22rpx;
  color: $color-subtitle;
}

.picker-check {
  font-size: 32rpx;
  font-weight: 700;
  color: $color-primary-dark;
  margin-left: 8rpx;
}

.picker-default {
  width: 56rpx;
  height: 56rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  margin-left: 8rpx;
}

.picker-default--active {
  background: rgba(74, 159, 232, 0.12);
}

.picker-default.on {
  background: rgba(74, 159, 232, 0.14);
}

.picker-star {
  font-size: 34rpx;
  line-height: 1;
  color: rgba(120, 140, 160, 0.55);
}

.picker-default.on .picker-star {
  color: $color-primary-dark;
}

.picker-tail {
  height: calc(220rpx + env(safe-area-inset-bottom));
  width: 100%;
}

.sheet-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 16rpx;
  border-radius: 18rpx;
  margin-bottom: 4rpx;
}

.sheet-item.active {
  background: rgba(74, 159, 232, 0.1);
}

.sheet--vip .sheet-item.active {
  background: rgba(212, 168, 75, 0.16);
}

.sheet-item-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
  gap: 16rpx;
}

.sheet-no {
  width: 40rpx;
  text-align: center;
  font-size: 24rpx;
  color: $color-subtitle;
  flex-shrink: 0;
}

.sheet-item.active .sheet-no {
  color: $color-primary-dark;
  font-weight: 700;
}

.sheet--vip .sheet-item.active .sheet-no {
  color: #8a6418;
}

.sheet-meta {
  min-width: 0;
  flex: 1;
}

.sheet-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-title;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4rpx;
}

.sheet-artist {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-item-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 8rpx;
  gap: 4rpx;
}

.sheet-now {
  flex-shrink: 0;
  font-size: 22rpx;
  color: $color-primary-dark;
  padding: 0 8rpx;
}

.sheet--vip .sheet-now {
  color: #8a6418;
}

.sheet-eq {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  height: 28rpx;
  padding: 0 8rpx;
  flex-shrink: 0;
}

.sheet-pin {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
}

.sheet-pin--active {
  background: rgba(74, 159, 232, 0.12);
}

.sheet-pin.on {
  background: rgba(74, 159, 232, 0.14);
}

.ico-pin {
  width: 22rpx;
  height: 30rpx;
  position: relative;
}

.ico-pin-head {
  position: absolute;
  left: 2rpx;
  top: 0;
  width: 18rpx;
  height: 16rpx;
  border-radius: 8rpx 8rpx 4rpx 4rpx;
  background: rgba(120, 140, 160, 0.85);
}

.sheet-pin.on .ico-pin-head {
  background: $color-primary-dark;
}

.ico-pin-needle {
  position: absolute;
  left: 9rpx;
  top: 14rpx;
  width: 4rpx;
  height: 14rpx;
  border-radius: 2rpx;
  background: rgba(120, 140, 160, 0.85);
}

.sheet-pin.on .ico-pin-needle {
  background: $color-primary-dark;
}

.sheet-del {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
}

.sheet-del--active {
  background: rgba(196, 92, 74, 0.12);
}

.ico-trash {
  width: 28rpx;
  height: 30rpx;
  position: relative;
}

.ico-trash-cap {
  position: absolute;
  left: 9rpx;
  top: 0;
  width: 10rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: #c45c4a;
}

.ico-trash-lid {
  position: absolute;
  left: 2rpx;
  right: 2rpx;
  top: 4rpx;
  height: 5rpx;
  border-radius: 2rpx;
  background: #c45c4a;
}

.ico-trash-body {
  position: absolute;
  left: 4rpx;
  right: 4rpx;
  top: 11rpx;
  bottom: 0;
  border-radius: 0 0 4rpx 4rpx;
  border: 3rpx solid #c45c4a;
  box-sizing: border-box;
}

.eq-bar {
  width: 4rpx;
  border-radius: 2rpx;
  background: $color-primary;
  animation: eqPulse 0.9s ease-in-out infinite;
}

.sheet--vip .eq-bar {
  background: #c9982e;
}

.eq-bar.b1 {
  height: 12rpx;
  animation-delay: 0s;
}

.eq-bar.b2 {
  height: 22rpx;
  animation-delay: 0.15s;
}

.eq-bar.b3 {
  height: 16rpx;
  animation-delay: 0.3s;
}

.music-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 140;
  border-radius: 28rpx 28rpx 0 0;
  overflow: hidden;
  box-sizing: border-box;
  background: $color-card-glass;
  border: 1rpx solid rgba(255, 255, 255, 0.72);
  border-bottom: none;
  box-shadow:
    0 -8rpx 32rpx rgba(43, 127, 212, 0.1),
    0 -2rpx 8rpx rgba(15, 45, 74, 0.04);
  padding-bottom: env(safe-area-inset-bottom);
}

.music-bar--vip {
  border-color: rgba(255, 236, 196, 0.9);
  box-shadow:
    0 -8rpx 32rpx rgba(180, 130, 40, 0.14),
    0 -2rpx 8rpx rgba(90, 60, 10, 0.05);
}

.music-accent {
  height: 3rpx;
  width: 100%;
  background: transparent;
  transition: background 0.35s ease;
}

.music-accent.on {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(74, 159, 232, 0.35) 20%,
    $color-primary 50%,
    rgba(74, 159, 232, 0.35) 80%,
    transparent 100%
  );
}

.music-bar--vip .music-accent.on {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(212, 168, 75, 0.4) 20%,
    #c9982e 50%,
    rgba(212, 168, 75, 0.4) 80%,
    transparent 100%
  );
}

/* 超级播放器：母带下载进度 */
.music-dl {
  padding: 16rpx 28rpx 4rpx;
  box-sizing: border-box;
}

.music-dl-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.music-dl-label {
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  color: #9a7420;
}

.music-dl-pct {
  font-size: 22rpx;
  font-weight: 700;
  color: #8a6418;
  font-variant-numeric: tabular-nums;
}

.music-dl-track {
  height: 10rpx;
  border-radius: 999rpx;
  overflow: hidden;
  background: rgba(180, 140, 50, 0.14);
  box-shadow: inset 0 1rpx 2rpx rgba(90, 60, 10, 0.08);
}

.music-dl-fill {
  position: relative;
  height: 100%;
  width: 0;
  border-radius: 999rpx;
  overflow: hidden;
  background: linear-gradient(90deg, #e8c56a 0%, #d4a017 45%, #f0d78c 100%);
  box-shadow: 0 0 12rpx rgba(212, 160, 23, 0.45);
  transition: width 0.18s linear;
}

.music-dl-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 40%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 100%
  );
  animation: music-dl-shine 1.4s ease-in-out infinite;
}

@keyframes music-dl-shine {
  0% {
    left: -40%;
  }
  100% {
    left: 120%;
  }
}

.music-bar--dl .music-body {
  padding-top: 18rpx;
}

.music-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 30rpx;
  gap: 8rpx;
  min-height: 120rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.22) 100%);
}

.music-bar--vip .music-body {
  background: linear-gradient(180deg, rgba(255, 248, 232, 0.7) 0%, rgba(255, 255, 255, 0.28) 100%);
}

.music-info {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.music-disc {
  position: relative;
  width: 104rpx;
  height: 104rpx;
  margin-right: 14rpx;
  flex-shrink: 0;
  border-radius: 50%;
}

.music-disc.idle {
  animation: idleSway 4.5s ease-in-out infinite;
}

.music-disc.spinning {
  animation: spin 5.5s linear infinite;
}

.music-disc.spinning .disc-glow {
  opacity: 1;
  animation: glowPulse 2.2s ease-in-out infinite;
}

.music-disc.spinning .disc-shine {
  opacity: 1;
  animation: shineSweep 3.2s linear infinite;
}

.disc-cover {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}


.music-disc--vip {
  box-shadow: 0 0 0 2rpx rgba(201, 152, 46, 0.45);
}

.music-disc--vip .disc-glow {
  background: radial-gradient(circle, rgba(212, 168, 75, 0.4) 0%, transparent 70%);
}








.disc-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18rpx;
  height: 18rpx;
  margin-left: -9rpx;
  margin-top: -9rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #dceaf6 0%, #a8c6de 100%);
  box-shadow: 0 0 0 3rpx rgba(26, 51, 72, 0.85);
  z-index: 2;
}

.music-disc--vip .disc-hub {
  background: linear-gradient(135deg, #fff4d6 0%, #e0c06a 100%);
  box-shadow: 0 0 0 3rpx rgba(60, 40, 10, 0.75);
}

.disc-loading {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 50%;
  background: rgba(15, 45, 74, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.disc-loading-ring {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.28);
  border-top-color: #fff;
  box-sizing: border-box;
  animation: spin 0.75s linear infinite;
}

.disc-loading-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 8rpx solid transparent;
  border-right: 8rpx solid transparent;
  border-top: 12rpx solid #fff;
  margin-top: 2rpx;
  animation: loadBounce 0.9s ease-in-out infinite;
}

.music-disc.loading {
  animation: none;
}

.disc-shine {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 50%;
  background: linear-gradient(
    120deg,
    transparent 35%,
    rgba(255, 255, 255, 0.18) 48%,
    transparent 62%
  );
  opacity: 0;
  pointer-events: none;
  z-index: 3;
}

.disc-glow {
  position: absolute;
  left: -8rpx;
  right: -8rpx;
  top: -8rpx;
  bottom: -8rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 159, 232, 0.32) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.music-text {
  min-width: 0;
  flex: 1;
}

.vip-badge {
  display: inline-flex;
  align-items: center;
  margin-bottom: 4rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #9ec8ef 0%, #4a9fe8 100%);
}

.vip-badge--vip {
  background: linear-gradient(90deg, #e8c56a 0%, #c9982e 100%);
}


.vip-badge-text {
  font-size: 18rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2rpx;
  line-height: 1.4;
}

.vip-badge--vip .vip-badge-text {
  color: #5c4010;
}


.music-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 0.5rpx;
  color: $color-title;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6rpx;
}

.music-sub {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
  letter-spacing: 0.4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.92;
}

.music-actions {
  display: flex;
  align-items: center;
  gap: 2rpx;
  flex-shrink: 0;
}

.list-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 4rpx;
}

.list-btn--active {
  transform: scale(0.92);
  background: rgba(74, 159, 232, 0.1);
}

.switch-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 2rpx;
}

.switch-btn--active {
  transform: scale(0.92);
  background: rgba(74, 159, 232, 0.1);
}

.ico-switch {
  position: relative;
  width: 30rpx;
  height: 28rpx;
}

.ico-switch-layer {
  position: absolute;
  left: 0;
  width: 26rpx;
  height: 8rpx;
  border-radius: 3rpx;
  background: $color-primary-dark;
  opacity: 0.9;
  box-sizing: border-box;
}

.ico-switch-layer.l1 {
  top: 0;
  opacity: 0.45;
  transform: translateX(4rpx);
}

.ico-switch-layer.l2 {
  top: 10rpx;
  opacity: 0.7;
  transform: translateX(2rpx);
}

.ico-switch-layer.l3 {
  top: 20rpx;
  opacity: 0.95;
}

.music-bar--vip .ico-switch-layer {
  background: #8a6418;
}

.ico-list {
  width: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.ico-list-line {
  height: 3rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
  opacity: 0.9;
}

.music-bar--vip .ico-list-line {
  background: #8a6418;
}

.ico-list-line.short {
  width: 70%;
}

.ctrl-btn {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.ctrl-btn--active {
  transform: scale(0.92);
  background: rgba(74, 159, 232, 0.1);
}

.ico-skip {
  display: flex;
  align-items: center;
  height: 36rpx;
}

.ico-skip-bar {
  width: 5rpx;
  height: 32rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
  opacity: 0.9;
}

.ico-skip-tri {
  width: 0;
  height: 0;
  border-style: solid;
}

.ico-prev .ico-skip-tri {
  margin-left: 4rpx;
  border-width: 16rpx 20rpx 16rpx 0;
  border-color: transparent $color-primary-dark transparent transparent;
}

.ico-next .ico-skip-tri {
  margin-right: 4rpx;
  border-width: 16rpx 0 16rpx 20rpx;
  border-color: transparent transparent transparent $color-primary-dark;
}

.music-bar--vip .ico-skip-bar {
  background: #8a6418;
}

.music-bar--vip .ico-prev .ico-skip-tri {
  border-color: transparent #8a6418 transparent transparent;
}

.music-bar--vip .ico-next .ico-skip-tri {
  border-color: transparent transparent transparent #8a6418;
}

.play-btn {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  margin: 0 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, $color-primary 0%, $color-primary-dark 100%);
  box-shadow: 0 6rpx 18rpx rgba(43, 127, 212, 0.28);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.music-bar--vip .play-btn {
  background: linear-gradient(145deg, #e8c56a 0%, #b8861e 100%);
  box-shadow: 0 6rpx 18rpx rgba(180, 130, 40, 0.3);
}

.play-btn--active {
  transform: scale(0.94);
  box-shadow: 0 3rpx 10rpx rgba(43, 127, 212, 0.22);
}

.ico-play {
  width: 0;
  height: 0;
  margin-left: 6rpx;
  border-style: solid;
  border-width: 16rpx 0 16rpx 26rpx;
  border-color: transparent transparent transparent #fff;
}

.ico-pause {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.ico-pause-bar {
  width: 7rpx;
  height: 30rpx;
  border-radius: 2rpx;
  background: #fff;
}

.ico-loading {
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ico-loading-ring {
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  box-sizing: border-box;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes loadBounce {
  0%,
  100% {
    transform: translateY(-2rpx);
    opacity: 0.85;
  }
  50% {
    transform: translateY(4rpx);
    opacity: 1;
  }
}

@keyframes idleSway {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(4deg);
  }
}

@keyframes glowPulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes shineSweep {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes eqPulse {
  0%,
  100% {
    transform: scaleY(0.45);
  }
  50% {
    transform: scaleY(1);
  }
}
</style>
