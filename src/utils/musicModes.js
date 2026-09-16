/**
 * 歌单 mode 元数据（展示 / 是否母带下载）
 * 曲目列表仍在各自 *Playlist.js / playlist.js
 */
export const MUSIC_MODE_VIP = 'vip'
export const MUSIC_MODE_FLAC = 'flac'
export const MUSIC_MODE_QS = 'qs'
export const MUSIC_MODE_BY = 'by'
export const MUSIC_MODE_ZJL = 'zjl'
export const MUSIC_MODE_ZM = 'zm'
export const MUSIC_MODE_XS = 'xs'
export const MUSIC_MODE_DY = 'dy'
export const MUSIC_MODE_ALIN = 'alin'
export const MUSIC_MODE_GT = 'gt'
export const MUSIC_MODE_BLIND = 'blind'

export const VALID_MUSIC_MODES = [
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  MUSIC_MODE_ZJL,
  MUSIC_MODE_XS,
  MUSIC_MODE_ZM,
  MUSIC_MODE_DY,
  MUSIC_MODE_ALIN,
  MUSIC_MODE_GT,
  MUSIC_MODE_BLIND,
  MUSIC_MODE_VIP,
]

/** @type {Record<string, { label: string, badge: string, desc: string, master: boolean, wifiOnly: boolean, cover: string }>} */
export const MODE_META = {
  flac: {
    label: '无损FLAC',
    badge: 'FLAC',
    desc: '精选无损',
    master: true,
    wifiOnly: false,
    cover: '/static/rossi.jpg',
  },
  qs: {
    label: '七叔无损',
    badge: '七叔',
    desc: '七叔精选',
    master: true,
    wifiOnly: false,
    cover: '/static/rossi.jpg',
  },
  by: {
    label: 'Beyond无损',
    badge: 'BY',
    desc: 'Beyond',
    master: true,
    wifiOnly: false,
    cover: '/static/rossi.jpg',
  },
  zjl: {
    label: '周杰伦',
    badge: '杰',
    desc: '周杰伦无损',
    master: true,
    wifiOnly: false,
    cover: '/static/rossi.jpg',
  },
  xs: {
    label: '许嵩',
    badge: '嵩',
    desc: '许嵩精选',
    master: false,
    wifiOnly: false,
    cover: '/static/juluo.jpg',
  },
  zm: {
    label: '助眠',
    badge: '眠',
    desc: '助眠轻音乐',
    master: true,
    wifiOnly: false,
    cover: '/static/rossi.jpg',
  },
  dy: {
    label: 'DY',
    badge: 'DY',
    desc: '精选曲目',
    master: false,
    wifiOnly: false,
    cover: '/static/juluo.jpg',
  },
  alin: {
    label: 'A-LIN',
    badge: 'LIN',
    desc: 'A-Lin 精选',
    master: false,
    wifiOnly: false,
    cover: '/static/juluo.jpg',
  },
  gt: {
    label: 'GT',
    badge: 'GT',
    desc: '精选曲目',
    master: false,
    wifiOnly: false,
    cover: '/static/juluo.jpg',
  },
  blind: {
    label: '盲盒歌单',
    badge: '盲',
    desc: '来开盲盒吧',
    master: false,
    wifiOnly: false,
    cover: '/static/juluo.jpg',
  },
  vip: {
    label: 'VIP专属',
    badge: 'VIP',
    desc: '毛不易 / 陈粒',
    master: false,
    wifiOnly: false,
    cover: '/static/juluo.jpg',
  },
}

export function normalizeMusicMode(mode) {
  if (VALID_MUSIC_MODES.indexOf(mode) >= 0) return mode
  return MUSIC_MODE_FLAC
}

export function isMasterMusicMode(mode) {
  const meta = MODE_META[normalizeMusicMode(mode)]
  return !!(meta && meta.master)
}

export function isWifiOnlyMusicMode(mode) {
  const meta = MODE_META[normalizeMusicMode(mode)]
  return !!(meta && meta.wifiOnly)
}

export function getModeMeta(mode) {
  return MODE_META[normalizeMusicMode(mode)]
}

/** 盲盒歌单：固定随机，不展示曲目列表 */
export function isBlindMusicMode(mode) {
  return normalizeMusicMode(mode) === MUSIC_MODE_BLIND
}

/** 歌单选择器选项 */
export function getPlaylistOptions() {
  const out = []
  for (let i = 0; i < VALID_MUSIC_MODES.length; i++) {
    const mode = VALID_MUSIC_MODES[i]
    const meta = MODE_META[mode]
    out.push({
      mode: mode,
      name: meta.label,
      desc: meta.desc,
    })
  }
  return out
}
