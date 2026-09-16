<template>
  <view class="music-root" :class="{ 'music-root--gold': isMaster }" :style="musicThemeStyle">
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
    <view v-if="playlistPickerOpen" class="picker-sheet" @tap.stop>
      <view class="sheet-handle" />
      <view class="picker-head">
        <text class="picker-title">切换歌单</text>
        <text class="sheet-close" @tap="closePlaylistPicker">取消</text>
      </view>
      <scroll-view scroll-y class="picker-scroll" :show-scrollbar="false">
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
      </scroll-view>
    </view>

    <!-- 盲盒：当前曲 / 真实名 / 开盲盒 -->
    <view
      v-if="blindPeekOpen"
      class="sheet-mask"
      @tap="closeBlindPeek"
      @touchmove.stop.prevent
    />
    <view v-if="blindPeekOpen" class="blind-peek" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="blind-peek-head">
        <text class="blind-peek-kicker">盲盒开箱</text>
        <text class="sheet-close" @tap="closeBlindPeek">关闭</text>
      </view>
      <view
        class="blind-peek-card"
        :class="{ 'blind-peek-card--opening': blindOpening }"
      >
        <view v-if="blindOpening" class="blind-peek-sweep" />
        <text class="blind-peek-tag">{{ blindDrawLabel }}</text>
        <text
          class="blind-peek-fake"
          :class="{ 'blind-peek-fake--in': blindNameReveal }"
        >{{ (blindDrawTrack && blindDrawTrack.title) || '神秘曲目' }}</text>
      </view>
      <view class="blind-peek-divider" />
      <view class="blind-peek-real-block">
        <text class="blind-peek-tag blind-peek-tag--real">真实曲名</text>
        <view class="blind-peek-real-row">
          <view class="blind-peek-real-meta">
            <text v-if="blindRevealed && canShowBlindReal" class="blind-peek-real">{{
              (blindDrawTrack && blindDrawTrack.realTitle) || '未知曲目'
            }}</text>
            <text v-else class="blind-peek-mask">点击眼睛揭晓</text>
            <text v-if="blindRevealed && canShowBlindReal" class="blind-peek-real-artist">{{
              (blindDrawTrack && blindDrawTrack.realArtist) || ''
            }}</text>
          </view>
          <view
            class="blind-eye"
            :class="{ on: blindRevealed && canShowBlindReal }"
            hover-class="blind-eye--active"
            @tap.stop="onRevealBlind"
          >
            <view class="blind-eye-outer">
              <view class="blind-eye-iris" />
            </view>
            <view v-if="!(blindRevealed && canShowBlindReal)" class="blind-eye-slash" />
          </view>
        </view>
      </view>
      <view class="blind-peek-actions">
        <view
          class="blind-act blind-act--draw"
          :class="{ disabled: blindOpening }"
          hover-class="blind-act--active"
          @tap.stop="onDrawBlindBox"
        >
          <text class="blind-act-text">开盲盒</text>
        </view>
        <view
          class="blind-act blind-act--play"
          hover-class="blind-act--active"
          @tap.stop="onPlayBlindDraw"
        >
          <text class="blind-act-text">{{ blindPlayBtnText }}</text>
        </view>
      </view>
      <view v-if="canRateBlindDraw" class="blind-rate-row">
        <view
          class="blind-rate blind-rate--like"
          :class="{ on: blindDrawRate === 'like' }"
          hover-class="blind-rate--active"
          @tap.stop="onRateBlind('like')"
        >
          <text class="blind-rate-text">好听</text>
        </view>
        <view
          class="blind-rate blind-rate--dislike"
          :class="{ on: blindDrawRate === 'dislike' }"
          hover-class="blind-rate--active"
          @tap.stop="onRateBlind('dislike')"
        >
          <text class="blind-rate-text">不好听</text>
        </view>
        <view
          class="blind-rate blind-rate--list"
          hover-class="blind-rate--active"
          @tap.stop="openBlindTaste"
        >
          <text class="blind-rate-text">我的口味</text>
        </view>
      </view>
      <view class="blind-peek-tip">
        <text class="blind-peek-tip-text">开盲盒只预览假名；当前曲点播放不会重载</text>
      </view>
    </view>

    <!-- 盲盒好听/不好听 -->
    <view
      v-if="blindTasteOpen"
      class="sheet-mask"
      @tap="closeBlindTaste"
      @touchmove.stop.prevent
    />
    <view v-if="blindTasteOpen" class="blind-taste" @tap.stop @touchmove.stop>
      <view class="sheet-handle" />
      <view class="blind-taste-head">
        <text class="blind-peek-kicker">我的口味</text>
        <text class="sheet-close" @tap="closeBlindTaste">关闭</text>
      </view>
      <view class="blind-taste-tabs">
        <view
          class="blind-taste-tab"
          :class="{ on: blindTasteTab === 'like' }"
          @tap.stop="blindTasteTab = 'like'"
        >
          <text class="blind-taste-tab-text">好听 {{ blindLikedList.length }}</text>
        </view>
        <view
          class="blind-taste-tab"
          :class="{ on: blindTasteTab === 'dislike' }"
          @tap.stop="blindTasteTab = 'dislike'"
        >
          <text class="blind-taste-tab-text">不好听 {{ blindDislikedList.length }}</text>
        </view>
      </view>
      <scroll-view scroll-y class="blind-taste-scroll" :show-scrollbar="false">
        <view v-if="!blindTasteList.length" class="blind-taste-empty">
          <text class="blind-taste-empty-text">还没有曲目</text>
        </view>
        <view
          v-for="item in blindTasteList"
          :key="item.id"
          class="blind-taste-item"
          hover-class="blind-taste-item--active"
          @tap.stop="onPlayBlindTaste(item)"
        >
          <view class="blind-taste-meta">
            <text class="blind-taste-title">{{ item.title || '神秘曲目' }}</text>
            <text v-if="isBlindTrackRevealed(item.id)" class="blind-taste-real">{{
              item.realTitle || ''
            }}</text>
          </view>
          <text class="blind-taste-clear" @tap.stop="onClearBlindTaste(item)">取消</text>
        </view>
        <view class="blind-taste-tail" />
      </scroll-view>
    </view>

    <!-- 歌词展开面板 -->
    <view
      v-if="lyricsExpanded"
      class="sheet-mask"
      @tap="collapseLyrics"
      @touchmove.stop.prevent
    />
    <view
      v-if="lyricsExpanded"
      class="lyric-panel"
      @tap.stop
      @touchmove.stop
    >
      <view class="sheet-handle" />
      <view class="lyric-panel-head">
        <text class="lyric-panel-title">歌词</text>
        <text class="sheet-close" @tap="collapseLyrics">收起</text>
      </view>
      <scroll-view
        scroll-y
        class="lyric-panel-scroll"
        :scroll-into-view="lyricScrollInto"
        :show-scrollbar="false"
      >
        <view
          v-for="(row, i) in lyricLines"
          :id="'lrc-' + i"
          :key="'lrc-' + i"
          class="lyric-panel-row"
          :class="{ now: i === lyricIdx, near: i === lyricIdx - 1 || i === lyricIdx + 1 }"
        >
          <view v-if="i === lyricIdx" class="ktv-line ktv-line--panel">
            <text class="ktv-base">{{ row.text }}</text>
            <view class="ktv-mask" :style="{ width: lyricFillPct + '%' }">
              <text class="ktv-fill">{{ row.text }}</text>
            </view>
          </view>
          <text v-else class="lyric-panel-text">{{ row.text }}</text>
        </view>
        <view class="lyric-panel-tail" />
      </scroll-view>
    </view>

    <!-- 底部播放条 + 周杰伦三行跟唱 -->
    <view class="music-dock">
      <view v-if="showLyricChip" class="lyric-chip" hover-class="lyric-chip--active" @tap.stop="showLyricStrip">
        <text class="lyric-chip-text">词</text>
      </view>
      <view v-if="showLyrics" class="lyric-strip" @tap.stop="expandLyrics">
        <view class="lyric-close" hover-class="lyric-close--active" @tap.stop="hideLyrics">
          <view class="lyric-close-bar a" />
          <view class="lyric-close-bar b" />
        </view>
        <text class="lyric-line lyric-prev">{{ lyricPrev }}</text>
        <view class="ktv-line lyric-now-wrap">
          <text class="ktv-base lyric-now">{{ lyricNow }}</text>
          <view class="ktv-mask" :style="{ width: lyricFillPct + '%' }">
            <text class="ktv-fill lyric-now">{{ lyricNow }}</text>
          </view>
        </view>
        <text class="lyric-line lyric-next">{{ lyricNext }}</text>
      </view>
      <view
        class="music-bar"
        :class="{
          playing: playing,
          'music-bar--vip': isVip,
          'music-bar--gold': isMaster,
          'music-bar--dl': showDownloadBar,
        }"
        @tap="toggleSheet"
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
          <view
            v-if="!isBlind"
            class="mode-btn"
            hover-class="mode-btn--active"
            @tap.stop="onCyclePlayMode"
          >
            <text class="mode-btn-text">{{ playModeLabel }}</text>
          </view>

          <view class="ctrl-btn" hover-class="ctrl-btn--active" @tap.stop="onPrev">
            <view class="ico-skip ico-prev">
              <view class="ico-skip-bar" />
              <view class="ico-skip-tri" />
            </view>
          </view>

          <view class="play-btn" hover-class="play-btn--active" @tap.stop="onToggle">
            <view v-if="isDownloading" class="ico-loading">
              <view class="ico-loading-ring" />
            </view>
            <view v-else-if="playing" class="ico-pause">
              <view class="ico-pause-bar" />
              <view class="ico-pause-bar" />
            </view>
            <view v-else class="ico-play" />
          </view>

          <view class="ctrl-btn" hover-class="ctrl-btn--active" @tap.stop="onNext">
            <view class="ico-skip ico-next">
              <view class="ico-skip-tri" />
              <view class="ico-skip-bar" />
            </view>
          </view>

          <view
            v-if="isBlind"
            class="peek-btn"
            hover-class="peek-btn--active"
            @tap.stop="openBlindPeek"
          >
            <view class="ico-peek">
              <view class="ico-peek-lid" />
              <view class="ico-peek-box" />
              <view class="ico-peek-star" />
            </view>
          </view>
          <view
            v-else
            class="list-btn"
            hover-class="list-btn--active"
            @tap.stop="toggleSheet"
          >
            <view class="ico-list">
              <view class="ico-list-line" />
              <view class="ico-list-line short" />
              <view class="ico-list-line" />
            </view>
          </view>

          <view class="switch-btn" hover-class="switch-btn--active" @tap.stop="togglePlaylistPicker">
            <view class="ico-switch">
              <view class="ico-switch-layer l1" />
              <view class="ico-switch-layer l2" />
              <view class="ico-switch-layer l3" />
            </view>
          </view>

          <view
            class="cache-btn"
            :class="{ busy: clearingCache }"
            hover-class="cache-btn--active"
            @tap.stop="onClearCache"
          >
            <view class="ico-cache">
              <view class="ico-cache-bin" />
              <view class="ico-cache-lid" />
              <view class="ico-cache-knob" />
              <view class="ico-cache-slash" />
            </view>
          </view>
        </view>
      </view>
    </view>
    </view>
  </view>
</template>

<script setup>
import {
  MUSIC_MODE_FLAC,
  MUSIC_MODE_VIP,
  PLAY_MODE_SEQ,
  PLAY_MODE_SHUFFLE,
  PLAY_MODE_LOOP,
  subscribeInnerMusic,
  toggleInnerMusic,
  playPrevInnerMusic,
  playNextInnerMusic,
  playInnerTrackAt,
  playBlindCatalogTrack,
  refreshAfterBlindRate,
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
  isBlindMusicMode,
  getModeMeta,
  cyclePlayMode,
  clearInnerMusicLocalCache,
} from '@/utils/innerMusic'
import { isWifiNetwork, getPlayUrl, getBlindRatedPlaylist } from '@/utils/playlist'
import { themeStyle } from '@/utils/moodTheme'
import {
  isBlindTrackRevealed,
  revealBlindTrack,
  rateBlindTrack,
  clearBlindRate,
  getBlindTrackRate,
} from '@/api/musicPrefs'

const playlist = ref([])
const playing = ref(false)
const loading = ref(false)
const ready = ref(false)
const currentIndex = ref(0)
const mode = ref(MUSIC_MODE_FLAC)
const track = ref({ title: '', artist: '', fileID: '', id: '' })
const sheetOpen = ref(false)
const sheetScrollInto = ref('')
const playlistPickerOpen = ref(false)
const preferredMode = ref(MUSIC_MODE_FLAC)
const deleting = ref(false)
const clearingCache = ref(false)
const downloadProgress = ref(0)
const playMode = ref(PLAY_MODE_SEQ)
const blindPeekOpen = ref(false)
const blindRevealed = ref(false)
const blindDrawTrack = ref(null)
const blindOpening = ref(false)
const blindNameReveal = ref(false)
const blindDrawRate = ref('')
const blindTasteOpen = ref(false)
const blindTasteTab = ref('like')
const blindLikedList = ref([])
const blindDislikedList = ref([])
let blindOpenTimer = null

const playlistOptions = getPlaylistOptions()

const blindDrawLabel = computed(() => {
  const draw = blindDrawTrack.value
  const cur = track.value
  if (draw && cur && draw.id && cur.id && draw.id !== cur.id) return '开出曲目'
  return '当前歌曲'
})

const canShowBlindReal = computed(() => {
  if (!playing.value) return false
  const draw = blindDrawTrack.value
  const cur = track.value
  return !!(draw && cur && draw.id && cur.id && draw.id === cur.id)
})

const canRateBlindDraw = computed(() => {
  const draw = blindDrawTrack.value
  const cur = track.value
  return !!(draw && cur && draw.id && cur.id && draw.id === cur.id)
})

const blindPlayBtnText = computed(() => {
  const draw = blindDrawTrack.value
  const cur = track.value
  if (draw && cur && draw.id && cur.id && draw.id === cur.id) {
    return playing.value ? '正在播放' : '继续播放'
  }
  return '播放'
})

const blindTasteList = computed(() => {
  return blindTasteTab.value === 'dislike' ? blindDislikedList.value : blindLikedList.value
})

let unsubscribe = null

const isMaster = computed(() => isMasterMusicMode(mode.value))
const isWifiOnly = computed(() => isWifiOnlyMusicMode(mode.value))
const isVip = computed(() => mode.value === MUSIC_MODE_VIP)
const isBlind = computed(() => isBlindMusicMode(mode.value))
const modeMeta = computed(() => getModeMeta(mode.value))
const musicThemeStyle = computed(() => themeStyle.value || {})

const playModeLabel = computed(() => {
  if (isBlind.value) return '随'
  if (playMode.value === PLAY_MODE_SHUFFLE) return '随'
  if (playMode.value === PLAY_MODE_LOOP) return '单'
  return '序'
})

const sheetTitle = computed(() => (modeMeta.value && modeMeta.value.label) || '歌单')
const badgeText = computed(() => (modeMeta.value && modeMeta.value.badge) || '')
const discCoverUrl = ref('')
const coverUrlCache = {}
const COVER_CACHE_MAX = 24
const coverCacheOrder = []
let coverLoadId = 0
const discCover = computed(() => {
  return discCoverUrl.value || (modeMeta.value && modeMeta.value.cover) || '/static/rossi.jpg'
})

const isDownloading = computed(() => loading.value && !ready.value)
const showDownloadBar = computed(() => isMaster.value && isDownloading.value)

const lrcCache = {}
const LRC_CACHE_MAX = 24
const lrcCacheOrder = []
const lyricArmed = ref(false)
const lyricLines = ref([])
const lyricIdx = ref(-1)
const lyricPrev = ref('')
const lyricNow = ref('')
const lyricNext = ref('')
const lyricFillPct = ref(0)
const lyricsHidden = ref(false)
const lyricsExpanded = ref(false)
const lyricScrollInto = ref('')
let lyricTimer = null
let lyricLoadId = 0

const canShowLyrics = computed(() => {
  return !isDownloading.value && lyricArmed.value && lyricLines.value.length > 0
})

const showLyrics = computed(() => {
  return canShowLyrics.value && !lyricsHidden.value && !lyricsExpanded.value
})

const showLyricChip = computed(() => {
  return canShowLyrics.value && lyricsHidden.value && !lyricsExpanded.value
})

function parseLrc(raw) {
  let src = String(raw || '')
  // UTF-16 误读成带 \0 的串时先清掉
  if (src.indexOf('\0') >= 0) src = src.replace(/\0/g, '')
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)
  const out = []
  // 支持 [mm:ss.xx] / [mm:ss:xx]，以及单行多句交错
  const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]([^\[]*)/g
  let m
  while ((m = re.exec(src))) {
    const min = Number(m[1]) || 0
    const sec = Number(m[2]) || 0
    let frac = m[3] || '0'
    if (frac.length === 1) frac = frac + '00'
    else if (frac.length === 2) frac = frac + '0'
    const text = String(m[4] || '').trim()
    if (!text) continue
    out.push({ t: min * 60 + sec + Number(frac) / 1000, text: text })
  }
  out.sort(function (a, b) {
    return a.t - b.t
  })
  return out
}

function lyricIndexAt(lines, time) {
  if (!lines.length) return -1
  if (time < lines[0].t) return -1
  let i = 0
  while (i + 1 < lines.length && lines[i + 1].t <= time) i++
  return i
}

function lyricFillAt(lines, i, time) {
  if (i < 0 || !lines[i]) return 0
  const start = lines[i].t
  let end = start + 5
  if (lines[i + 1]) {
    end = lines[i + 1].t
  } else {
    try {
      const d = Number(uni.getBackgroundAudioManager().duration) || 0
      if (d > start) end = d
    } catch (e) {
      // ignore
    }
  }
  const dur = end - start
  if (dur <= 0) return 100
  let p = ((time - start) / dur) * 100
  if (p < 0) p = 0
  if (p > 100) p = 100
  return p
}

function applyLyricIdx() {
  const lines = lyricLines.value
  const i = lyricIdx.value
  if (i < 0) {
    lyricPrev.value = ''
    lyricNow.value = ''
    lyricNext.value = (lines[0] && lines[0].text) || ''
    lyricFillPct.value = 0
    return
  }
  lyricPrev.value = i > 0 && lines[i - 1] ? lines[i - 1].text : ''
  lyricNow.value = lines[i] ? lines[i].text : ''
  lyricNext.value = lines[i + 1] ? lines[i + 1].text : ''
}

function syncLyricLine() {
  const lines = lyricLines.value
  if (!lines.length) {
    lyricIdx.value = -1
    lyricFillPct.value = 0
    applyLyricIdx()
    return
  }
  let t = 0
  try {
    t = Number(uni.getBackgroundAudioManager().currentTime) || 0
  } catch (e) {
    t = 0
  }
  lyricIdx.value = lyricIndexAt(lines, t)
  applyLyricIdx()
  const pct = Math.round(lyricFillAt(lines, lyricIdx.value, t))
  if (lyricFillPct.value !== pct) lyricFillPct.value = pct
}

function stopLyricTimer() {
  if (!lyricTimer) return
  clearInterval(lyricTimer)
  lyricTimer = null
}

function startLyricTimer() {
  if (lyricTimer) return
  syncLyricLine()
  lyricTimer = setInterval(syncLyricLine, 200)
}

function refreshLyricTimer() {
  const need = playing.value && lyricLines.value.length && !lyricsHidden.value
  if (need) startLyricTimer()
  else {
    stopLyricTimer()
    if (lyricLines.value.length) syncLyricLine()
  }
}

function downloadLrcText(url) {
  return new Promise(function (resolve, reject) {
    uni.downloadFile({
      url: url,
      success: function (res) {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载失败'))
          return
        }
        uni.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'utf8',
          success: function (r) {
            try {
              uni.getFileSystemManager().unlink({ filePath: res.tempFilePath })
            } catch (e) {
              // ignore
            }
            resolve(r.data)
          },
          fail: reject,
        })
      },
      fail: reject,
    })
  })
}

/** 云函数读歌词：自动 UTF-8 / GBK，避免许嵩等 GBK 歌词乱码 */
async function fetchLrcText(fileID) {
  if (!wx.cloud) throw new Error('云能力不可用')
  const res = await wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: { fileID: fileID, asLrc: true },
  })
  const body = res.result || {}
  if (!body.ok || typeof body.text !== 'string') {
    throw new Error(body.errMsg || '歌词读取失败')
  }
  return body.text
}

function touchLru(map, order, key, max) {
  const at = order.indexOf(key)
  if (at >= 0) order.splice(at, 1)
  order.push(key)
  while (order.length > max) {
    const drop = order.shift()
    if (drop != null) delete map[drop]
  }
}

function clearCoverLrcCaches() {
  const coverKeys = Object.keys(coverUrlCache)
  for (let i = 0; i < coverKeys.length; i++) delete coverUrlCache[coverKeys[i]]
  coverCacheOrder.length = 0
  const lrcKeys = Object.keys(lrcCache)
  for (let i = 0; i < lrcKeys.length; i++) delete lrcCache[lrcKeys[i]]
  lrcCacheOrder.length = 0
}

async function loadTrackLyrics(cur) {
  lyricLoadId += 1
  const req = lyricLoadId
  lyricLines.value = []
  lyricIdx.value = -1
  applyLyricIdx()
  stopLyricTimer()
  if (!cur || !cur.lrcFileID) return

  const id = cur.id
  if (lrcCache[id]) {
    if (req !== lyricLoadId) return
    touchLru(lrcCache, lrcCacheOrder, id, LRC_CACHE_MAX)
    lyricLines.value = lrcCache[id]
    refreshLyricTimer()
    return
  }

  try {
    let text = ''
    try {
      text = await fetchLrcText(cur.lrcFileID)
    } catch (e) {
      // 旧云函数未部署 asLrc 时回退临时链（仅 UTF-8 歌词可用）
      const url = await getPlayUrl(cur.lrcFileID)
      if (req !== lyricLoadId) return
      text = await downloadLrcText(url)
    }
    if (req !== lyricLoadId) return
    if (typeof text !== 'string') return
    const parsed = parseLrc(text)
    if (!parsed.length) return
    lrcCache[id] = parsed
    touchLru(lrcCache, lrcCacheOrder, id, LRC_CACHE_MAX)
    lyricLines.value = parsed
    refreshLyricTimer()
  } catch (e) {
    // 无词或失败则不显示，不影响播放
  }
}

async function loadTrackCover(cur) {
  coverLoadId += 1
  const req = coverLoadId
  discCoverUrl.value = ''
  if (!cur || !cur.coverFileID) return

  const fid = cur.coverFileID
  if (coverUrlCache[fid]) {
    if (req !== coverLoadId) return
    touchLru(coverUrlCache, coverCacheOrder, fid, COVER_CACHE_MAX)
    discCoverUrl.value = coverUrlCache[fid]
    return
  }

  try {
    const url = await getPlayUrl(fid)
    if (req !== coverLoadId) return
    if (!url) return
    coverUrlCache[fid] = url
    touchLru(coverUrlCache, coverCacheOrder, fid, COVER_CACHE_MAX)
    discCoverUrl.value = url
  } catch (e) {
    // 封面失败用 MODE 静态图
  }
}

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
  const nextId = (state.track && state.track.id) || ''
  const prevId = (track.value && track.value.id) || ''
  if (nextId !== prevId || state.mode !== mode.value) {
    lyricArmed.value = false
  }
  playing.value = state.playing
  loading.value = state.loading
  ready.value = state.ready
  currentIndex.value = state.index
  track.value = state.track
  mode.value = state.mode
  downloadProgress.value = state.downloadProgress != null ? state.downloadProgress : 0
  if (state.playlist) playlist.value = state.playlist
  playMode.value = state.playMode || PLAY_MODE_SEQ
  if (state.playing) lyricArmed.value = true
  if (nextId !== prevId || state.mode !== mode.value) {
    if (isBlindMusicMode(state.mode)) syncBlindRevealed()
    else {
      blindPeekOpen.value = false
      blindTasteOpen.value = false
      blindRevealed.value = false
      blindDrawTrack.value = null
      blindOpening.value = false
      blindNameReveal.value = false
    }
  }
}

watch(
  () => ((track.value && track.value.id) || '') + '|' + mode.value,
  () => {
    loadTrackLyrics(track.value)
    loadTrackCover(track.value)
  }
)

watch(playing, function () {
  refreshLyricTimer()
})

watch(lyricsHidden, function () {
  refreshLyricTimer()
})

watch(lyricIdx, function (i) {
  if (!lyricsExpanded.value) return
  if (i < 0) return
  lyricScrollInto.value = 'lrc-' + i
})

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
  stopLyricTimer()
  if (blindOpenTimer) {
    clearTimeout(blindOpenTimer)
    blindOpenTimer = null
  }
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

function onCyclePlayMode() {
  if (isBlind.value) {
    uni.showToast({ title: '盲盒固定随机播放', icon: 'none' })
    return
  }
  const next = cyclePlayMode()
  const titles = {}
  titles[PLAY_MODE_SEQ] = '顺序播放'
  titles[PLAY_MODE_SHUFFLE] = '随机播放'
  titles[PLAY_MODE_LOOP] = '单曲循环'
  uni.showToast({ title: titles[next] || '顺序播放', icon: 'none' })
}

function onClearCache() {
  if (clearingCache.value) return
  uni.showModal({
    title: '清除音乐缓存',
    content: '是否清除音乐缓存？将删除已下载的本地音频文件。',
    confirmText: '清除',
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm) return
      clearingCache.value = true
      try {
        clearInnerMusicLocalCache()
        clearCoverLrcCaches()
        discCoverUrl.value = ''
        uni.showToast({ title: '缓存已清除', icon: 'none' })
      } catch (err) {
        console.error('清除音乐缓存失败', err)
        uni.showToast({ title: '清除失败', icon: 'none' })
      }
      clearingCache.value = false
    },
  })
}

function hideLyrics() {
  lyricsHidden.value = true
  lyricsExpanded.value = false
}

function showLyricStrip() {
  lyricsHidden.value = false
}

function expandLyrics() {
  playlistPickerOpen.value = false
  sheetOpen.value = false
  blindPeekOpen.value = false
  blindTasteOpen.value = false
  lyricsExpanded.value = true
  lyricScrollInto.value = ''
  nextTick(() => {
    const i = lyricIdx.value
    lyricScrollInto.value = i >= 0 ? 'lrc-' + i : 'lrc-0'
  })
}

function collapseLyrics() {
  lyricsExpanded.value = false
}

function syncBlindRevealed() {
  const t = blindDrawTrack.value || track.value
  const id = t && t.id
  blindRevealed.value = !!(id && isBlindTrackRevealed(id))
  blindDrawRate.value = id ? getBlindTrackRate(id) : ''
}

function cloneBlindTrack(src) {
  if (!src) return { title: '', artist: '', id: '', realTitle: '', realArtist: '' }
  return {
    id: src.id || '',
    title: src.title || '',
    artist: src.artist || '',
    realTitle: src.realTitle || '',
    realArtist: src.realArtist || '',
    fileID: src.fileID || '',
  }
}

function refreshBlindTasteLists() {
  blindLikedList.value = getBlindRatedPlaylist('like')
  blindDislikedList.value = getBlindRatedPlaylist('dislike')
}

function openBlindPeek() {
  playlistPickerOpen.value = false
  sheetOpen.value = false
  lyricsExpanded.value = false
  blindTasteOpen.value = false
  if (blindOpenTimer) {
    clearTimeout(blindOpenTimer)
    blindOpenTimer = null
  }
  blindOpening.value = false
  blindNameReveal.value = false
  blindDrawTrack.value = cloneBlindTrack(track.value)
  syncBlindRevealed()
  blindPeekOpen.value = true
}

function closeBlindPeek() {
  if (blindOpenTimer) {
    clearTimeout(blindOpenTimer)
    blindOpenTimer = null
  }
  blindOpening.value = false
  blindNameReveal.value = false
  blindPeekOpen.value = false
}

function openBlindTaste() {
  refreshBlindTasteLists()
  blindTasteTab.value = 'like'
  blindPeekOpen.value = false
  blindTasteOpen.value = true
}

function closeBlindTaste() {
  blindTasteOpen.value = false
}

async function onRevealBlind() {
  if (!canShowBlindReal.value) {
    uni.showToast({ title: '播放中才能揭晓', icon: 'none' })
    return
  }
  if (blindRevealed.value) return
  const t = blindDrawTrack.value || track.value
  const id = t && t.id
  if (!id) return
  try {
    await revealBlindTrack(id)
    blindRevealed.value = true
  } catch (err) {
    console.error('揭示歌名失败', err)
    const msg = (err && err.message) || '保存失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  }
}

async function onRateBlind(kind) {
  if (!canRateBlindDraw.value) {
    uni.showToast({ title: '先听当前这首再评', icon: 'none' })
    return
  }
  const t = blindDrawTrack.value || track.value
  const id = t && t.id
  if (!id) return
  try {
    const rate = await rateBlindTrack(id, kind)
    blindDrawRate.value = rate
    closeBlindPeek()
    await refreshAfterBlindRate(id)
    uni.showToast({
      title: kind === 'like' ? '已加入好听' : '已加入不好听',
      icon: 'none',
    })
  } catch (err) {
    console.error('评分失败', err)
    const msg = (err && err.message) || '保存失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  }
}

async function onClearBlindTaste(item) {
  if (!item || !item.id) return
  try {
    await clearBlindRate(item.id)
    refreshBlindTasteLists()
    await refreshAfterBlindRate('')
    uni.showToast({ title: '已取消', icon: 'none' })
  } catch (err) {
    const msg = (err && err.message) || '失败'
    uni.showToast({ title: String(msg).slice(0, 20), icon: 'none' })
  }
}

function onPlayBlindTaste(item) {
  if (!item || !item.id) return
  closeBlindTaste()
  playBlindCatalogTrack(item.id)
}

function onDrawBlindBox() {
  if (blindOpening.value) return
  const list = playlist.value || []
  if (list.length < 2) {
    uni.showToast({ title: '歌单太少', icon: 'none' })
    return
  }
  const curId = track.value && track.value.id
  const candidates = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || !item.id) continue
    if (item.id === curId) continue
    candidates.push(item)
  }
  const pool = candidates.length ? candidates : list
  const pick = pool[Math.floor(Math.random() * pool.length)]
  if (!pick) return

  blindOpening.value = true
  blindNameReveal.value = false
  if (blindOpenTimer) clearTimeout(blindOpenTimer)
  blindOpenTimer = setTimeout(() => {
    blindDrawTrack.value = cloneBlindTrack(pick)
    syncBlindRevealed()
    blindNameReveal.value = true
    blindOpening.value = false
    blindOpenTimer = null
  }, 1200)
}

function onPlayBlindDraw() {
  if (blindOpening.value) return
  const draw = blindDrawTrack.value
  if (!draw || !draw.id) {
    uni.showToast({ title: '先开盲盒', icon: 'none' })
    return
  }
  const cur = track.value
  if (cur && cur.id && draw.id === cur.id) {
    closeBlindPeek()
    if (!playing.value) toggleInnerMusic()
    return
  }
  const list = playlist.value || []
  let i = -1
  for (let n = 0; n < list.length; n++) {
    if (list[n] && list[n].id === draw.id) {
      i = n
      break
    }
  }
  if (i < 0) {
    uni.showToast({ title: '未找到曲目', icon: 'none' })
    return
  }
  closeBlindPeek()
  playInnerTrackAt(i)
}

function toggleSheet() {
  if (isBlind.value) {
    openBlindPeek()
    return
  }
  playlistPickerOpen.value = false
  blindPeekOpen.value = false
  blindTasteOpen.value = false
  const wasLyrics = lyricsExpanded.value
  lyricsExpanded.value = false
  if (wasLyrics) {
    nextTick(() => {
      sheetOpen.value = true
      sheetScrollInto.value = ''
      nextTick(() => {
        sheetScrollInto.value = 'track-' + currentIndex.value
      })
    })
    return
  }
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
  blindPeekOpen.value = false
  blindTasteOpen.value = false
  const wasLyrics = lyricsExpanded.value
  lyricsExpanded.value = false
  preferredMode.value = getPreferredMusicMode()
  if (wasLyrics) {
    nextTick(() => {
      playlistPickerOpen.value = true
    })
    return
  }
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
  height: 70vh;
  max-height: 70vh;
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
  flex-shrink: 0;
}

.sheet-head {
  display: flex;
  align-items: baseline;
  padding: 8rpx 36rpx 20rpx;
  gap: 12rpx;
  flex-shrink: 0;
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
  min-height: 0;
  height: auto;
  max-height: none;
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
  height: 70vh;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
}

.picker-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
  box-sizing: border-box;
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
  height: calc(240rpx + env(safe-area-inset-bottom));
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

.music-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 140;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.lyric-chip {
  align-self: flex-end;
  margin: 0 24rpx 8rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    180deg,
    var(--lyric-bg-top, #2a2216) 0%,
    var(--lyric-bg, #1a1410) 100%
  );
  border: 2rpx solid var(--lyric-border, rgba(180, 140, 70, 0.5));
}

.lyric-chip--active {
  transform: scale(0.92);
}

.lyric-chip-text {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--lyric-now, #e8c878);
  letter-spacing: 2rpx;
}

.lyric-strip {
  position: relative;
  margin: 0 16rpx 10rpx;
  padding: 12rpx 48rpx 16rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(
    180deg,
    var(--lyric-bg-top, #2a2216) 0%,
    var(--lyric-bg, #1a1410) 100%
  );
  border: 2rpx solid var(--lyric-border, rgba(180, 140, 70, 0.42));
  border-radius: 12rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 220, 150, 0.12);
}

.lyric-close {
  position: absolute;
  right: 4rpx;
  top: 4rpx;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.lyric-close--active {
  opacity: 0.6;
}

.lyric-close-bar {
  position: absolute;
  left: 11rpx;
  top: 20rpx;
  width: 22rpx;
  height: 3rpx;
  background: var(--lyric-close, rgba(220, 190, 130, 0.7));
  border-radius: 2rpx;
}

.lyric-close-bar.a {
  transform: rotate(45deg);
}

.lyric-close-bar.b {
  transform: rotate(-45deg);
}

.lyric-line {
  width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.45;
}

.lyric-prev {
  font-size: 22rpx;
  color: var(--lyric-prev, rgba(220, 190, 130, 0.48));
}

.lyric-now-wrap {
  margin: 4rpx 0;
  max-width: 100%;
}

.lyric-now {
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
  text-shadow: 0 2rpx 0 rgba(40, 28, 10, 0.65);
}

.ktv-line {
  position: relative;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
}

.ktv-base {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lyric-base, rgba(220, 190, 130, 0.42));
}

.ktv-mask {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  overflow: hidden;
  white-space: nowrap;
}

.ktv-fill {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
  color: var(--lyric-now, #e8c878);
}

.lyric-next {
  font-size: 22rpx;
  color: var(--lyric-next, rgba(220, 190, 130, 0.28));
}

.lyric-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 132;
  height: 70vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    var(--lyric-bg-top, #2a2216) 0%,
    var(--lyric-bg, #1a1410) 100%
  );
  border-radius: 32rpx 32rpx 0 0;
  border: 2rpx solid var(--lyric-border, rgba(180, 140, 70, 0.42));
  border-bottom: none;
  box-sizing: border-box;
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.lyric-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 32rpx 16rpx;
}

.lyric-panel-title {
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
  color: var(--lyric-now, #e8c878);
}

.lyric-panel .sheet-close {
  color: var(--lyric-close, rgba(220, 190, 130, 0.9));
}

.lyric-panel-scroll {
  flex: 1;
  height: 0;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.lyric-panel-row {
  padding: 16rpx 8rpx;
  text-align: center;
}

.lyric-panel-text {
  font-size: 28rpx;
  line-height: 1.5;
  color: var(--lyric-next, rgba(220, 190, 130, 0.38));
}

.lyric-panel-row.near .lyric-panel-text {
  color: var(--lyric-prev, rgba(220, 190, 130, 0.62));
}

.lyric-panel-row.now {
  padding: 20rpx 8rpx;
}

.ktv-line--panel {
  max-width: 100%;
}

.ktv-line--panel .ktv-base,
.ktv-line--panel .ktv-fill {
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}

.lyric-panel-tail {
  height: 48rpx;
}

.music-bar {
  position: relative;
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

.peek-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 4rpx;
  background: rgba(107, 68, 35, 0.1);
  border: 2rpx solid rgba(107, 68, 35, 0.28);
  box-sizing: border-box;
}

.peek-btn--active {
  transform: scale(0.92);
  background: rgba(107, 68, 35, 0.18);
}

.ico-peek {
  position: relative;
  width: 28rpx;
  height: 26rpx;
}

.ico-peek-box {
  position: absolute;
  left: 2rpx;
  bottom: 0;
  width: 24rpx;
  height: 14rpx;
  border: 3rpx solid $color-primary-dark;
  border-radius: 4rpx;
  box-sizing: border-box;
}

.ico-peek-lid {
  position: absolute;
  left: 0;
  top: 2rpx;
  width: 28rpx;
  height: 8rpx;
  border: 3rpx solid $color-primary-dark;
  border-bottom: none;
  border-radius: 4rpx 4rpx 0 0;
  box-sizing: border-box;
  transform: rotate(-12deg);
  transform-origin: left center;
}

.ico-peek-star {
  position: absolute;
  right: 0;
  top: 0;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: $color-primary-dark;
}

.blind-peek {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 133;
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #2a2216 0%, #14100c 100%);
  border-radius: 32rpx 32rpx 0 0;
  border: 2rpx solid rgba(180, 140, 70, 0.45);
  border-bottom: none;
  box-sizing: border-box;
  padding: 0 32rpx calc(220rpx + env(safe-area-inset-bottom));
}

.blind-peek-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4rpx 0 20rpx;
}

.blind-peek-kicker {
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
  color: #e8c878;
}

.blind-peek .sheet-close {
  color: rgba(220, 190, 130, 0.9);
}

.blind-peek-card {
  position: relative;
  overflow: hidden;
  padding: 28rpx 24rpx;
  border-radius: 20rpx;
  background: rgba(255, 220, 150, 0.08);
  border: 2rpx solid rgba(180, 140, 70, 0.28);
  box-sizing: border-box;
  transition: box-shadow 0.35s ease;
}

.blind-peek-card--opening {
  animation: blind-open-charge 1.2s ease-in-out;
}

.blind-peek-sweep {
  position: absolute;
  top: -20%;
  left: -40%;
  width: 40%;
  height: 140%;
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255, 236, 180, 0.08) 40%,
    rgba(255, 236, 180, 0.45) 50%,
    rgba(255, 236, 180, 0.08) 60%,
    transparent 100%
  );
  transform: skewX(-18deg);
  animation: blind-sweep 0.8s ease-in-out 0.4s both;
  pointer-events: none;
}

.blind-peek-tag {
  display: block;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: rgba(220, 190, 130, 0.55);
  margin-bottom: 12rpx;
}

.blind-peek-tag--real {
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  color: rgba(232, 200, 120, 0.92);
  margin-bottom: 16rpx;
}

.blind-peek-fake {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.4;
  color: #e8c878;
  letter-spacing: 2rpx;
}

.blind-peek-fake--in {
  animation: blind-name-in 0.8s ease-out both;
}

.blind-peek-divider {
  height: 2rpx;
  margin: 28rpx 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(180, 140, 70, 0.45) 50%,
    transparent 100%
  );
}

.blind-peek-real-block {
  padding: 8rpx 0 0;
}

.blind-peek-real-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.blind-peek-real-meta {
  flex: 1;
  min-width: 0;
}

.blind-peek-real {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #fff4d6;
  line-height: 1.4;
}

.blind-peek-mask {
  display: block;
  font-size: 28rpx;
  color: rgba(220, 190, 130, 0.42);
  letter-spacing: 4rpx;
}

.blind-peek-real-artist {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(220, 190, 130, 0.7);
}

.blind-eye {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(232, 200, 120, 0.12);
  border: 2rpx solid rgba(180, 140, 70, 0.45);
  box-sizing: border-box;
}

.blind-eye.on {
  background: rgba(232, 200, 120, 0.22);
  border-color: rgba(232, 200, 120, 0.7);
}

.blind-eye--active {
  transform: scale(0.94);
}

.blind-eye-outer {
  width: 36rpx;
  height: 22rpx;
  border: 3rpx solid #e8c878;
  border-radius: 50%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.blind-eye-iris {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #e8c878;
}

.blind-eye-slash {
  position: absolute;
  width: 44rpx;
  height: 3rpx;
  background: rgba(220, 190, 130, 0.85);
  transform: rotate(-35deg);
  border-radius: 2rpx;
}

.blind-peek-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.blind-act {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.blind-act--draw {
  background: linear-gradient(135deg, rgba(232, 200, 120, 0.22), rgba(180, 140, 70, 0.18));
  border: 2rpx solid rgba(232, 200, 120, 0.55);
}

.blind-act--play {
  background: linear-gradient(135deg, #c9a24a, #8a6418);
  border: 2rpx solid rgba(232, 200, 120, 0.7);
}

.blind-act.disabled {
  opacity: 0.45;
}

.blind-act--active {
  transform: scale(0.97);
  opacity: 0.92;
}

.blind-act-text {
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  color: #fff4d6;
}

.blind-rate-row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.blind-rate {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(232, 200, 120, 0.35);
  background: rgba(40, 32, 18, 0.55);
  box-sizing: border-box;
}

.blind-rate--like.on {
  border-color: rgba(120, 200, 140, 0.7);
  background: rgba(60, 100, 70, 0.35);
}

.blind-rate--dislike.on {
  border-color: rgba(220, 120, 100, 0.7);
  background: rgba(100, 50, 40, 0.35);
}

.blind-rate--list {
  border-style: dashed;
}

.blind-rate--active {
  transform: scale(0.97);
  opacity: 0.9;
}

.blind-rate-text {
  font-size: 24rpx;
  font-weight: 600;
  color: rgba(255, 244, 214, 0.88);
  letter-spacing: 2rpx;
}

.blind-taste {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1002;
  max-height: 72vh;
  padding: 12rpx 36rpx calc(220rpx + env(safe-area-inset-bottom));
  border-radius: 36rpx 36rpx 0 0;
  background: linear-gradient(180deg, #1a1610 0%, #0f0d0a 100%);
  box-sizing: border-box;
}

.blind-taste-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.blind-taste-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.blind-taste-tab {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 2rpx solid rgba(232, 200, 120, 0.2);
}

.blind-taste-tab.on {
  background: rgba(232, 200, 120, 0.16);
  border-color: rgba(232, 200, 120, 0.55);
}

.blind-taste-tab-text {
  font-size: 26rpx;
  color: rgba(255, 244, 214, 0.75);
  font-weight: 600;
}

.blind-taste-tab.on .blind-taste-tab-text {
  color: #fff4d6;
}

.blind-taste-scroll {
  max-height: 48vh;
}

.blind-taste-empty {
  padding: 80rpx 0;
  text-align: center;
}

.blind-taste-empty-text {
  font-size: 26rpx;
  color: rgba(220, 190, 130, 0.4);
}

.blind-taste-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 8rpx;
  border-bottom: 1rpx solid rgba(232, 200, 120, 0.12);
}

.blind-taste-item--active {
  opacity: 0.85;
}

.blind-taste-meta {
  flex: 1;
  min-width: 0;
}

.blind-taste-title {
  display: block;
  font-size: 28rpx;
  color: #fff4d6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blind-taste-real {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(220, 190, 130, 0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blind-taste-clear {
  flex-shrink: 0;
  font-size: 22rpx;
  color: rgba(220, 190, 130, 0.55);
  padding: 12rpx 8rpx;
}

.blind-taste-tail {
  height: 24rpx;
}

.blind-peek-tip {
  margin-top: 24rpx;
  text-align: center;
}

.blind-peek-tip-text {
  font-size: 22rpx;
  color: rgba(220, 190, 130, 0.45);
  letter-spacing: 2rpx;
}

@keyframes blind-open-charge {
  0% {
    transform: rotate(0deg);
    box-shadow: 0 0 12rpx rgba(232, 200, 120, 0.12), inset 0 0 8rpx rgba(232, 200, 120, 0.04);
  }
  8% {
    transform: rotate(-1.6deg) translateX(-4rpx);
    box-shadow: 0 0 28rpx rgba(232, 200, 120, 0.28), inset 0 0 16rpx rgba(232, 200, 120, 0.1);
  }
  16% {
    transform: rotate(1.6deg) translateX(4rpx);
  }
  24% {
    transform: rotate(-1deg) translateX(-2rpx);
    box-shadow: 0 0 40rpx rgba(232, 200, 120, 0.42), inset 0 0 24rpx rgba(232, 200, 120, 0.16);
  }
  33% {
    transform: rotate(0deg);
  }
  50% {
    box-shadow: 0 0 24rpx rgba(232, 200, 120, 0.22), inset 0 0 14rpx rgba(232, 200, 120, 0.08);
  }
  70%,
  100% {
    transform: rotate(0deg);
    box-shadow: 0 0 36rpx rgba(232, 200, 120, 0.35), inset 0 0 20rpx rgba(232, 200, 120, 0.12);
  }
}

@keyframes blind-sweep {
  from {
    left: -40%;
    opacity: 0.3;
  }
  to {
    left: 110%;
    opacity: 1;
  }
}

@keyframes blind-name-in {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mode-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-right: 4rpx;
  flex-shrink: 0;
  background: rgba(107, 68, 35, 0.1);
  border: 2rpx solid rgba(107, 68, 35, 0.35);
  box-sizing: border-box;
}

.mode-btn--active {
  transform: scale(0.92);
  background: rgba(107, 68, 35, 0.18);
}

.mode-btn-text {
  font-size: 24rpx;
  font-weight: 700;
  color: $color-primary-dark;
  line-height: 1;
}

.music-bar--gold .mode-btn,
.music-bar--vip .mode-btn {
  background: rgba(138, 100, 24, 0.1);
  border-color: rgba(138, 100, 24, 0.35);
}

.music-bar--gold .mode-btn-text,
.music-bar--vip .mode-btn-text {
  color: #8a6418;
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

.cache-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 2rpx;
  flex-shrink: 0;
}

.cache-btn.busy {
  opacity: 0.45;
}

.cache-btn--active {
  transform: scale(0.92);
  background: rgba(74, 159, 232, 0.1);
}

.ico-cache {
  position: relative;
  width: 28rpx;
  height: 30rpx;
}

.ico-cache-bin {
  position: absolute;
  left: 4rpx;
  top: 8rpx;
  width: 20rpx;
  height: 18rpx;
  border: 3rpx solid $color-primary-dark;
  border-top: none;
  border-radius: 0 0 4rpx 4rpx;
  box-sizing: border-box;
  opacity: 0.9;
}

.ico-cache-lid {
  position: absolute;
  left: 2rpx;
  top: 4rpx;
  width: 24rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
  opacity: 0.9;
}

.ico-cache-knob {
  position: absolute;
  left: 10rpx;
  top: 0;
  width: 8rpx;
  height: 4rpx;
  border-radius: 2rpx 2rpx 0 0;
  background: $color-primary-dark;
  opacity: 0.9;
}

.ico-cache-slash {
  position: absolute;
  left: 12rpx;
  top: 0;
  width: 3rpx;
  height: 30rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
  transform: rotate(28deg);
  opacity: 0.75;
}

.music-bar--vip .ico-cache-bin {
  border-color: #8a6418;
}

.music-bar--vip .ico-cache-lid,
.music-bar--vip .ico-cache-knob,
.music-bar--vip .ico-cache-slash {
  background: #8a6418;
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
  width: 64rpx;
  height: 64rpx;
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
