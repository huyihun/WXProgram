/**
 * 歌单 mode 元数据（展示 / 是否母带下载）
 * 曲目列表仍在各自 *Playlist.js / playlist.js
 */
export const MUSIC_MODE_SUPER_PLAYER = 'super_player'
export const MUSIC_MODE_VIP = 'vip'
export const MUSIC_MODE_FLAC = 'flac'
export const MUSIC_MODE_QS = 'qs'
export const MUSIC_MODE_BY = 'by'

export const VALID_MUSIC_MODES = [
  MUSIC_MODE_SUPER_PLAYER,
  MUSIC_MODE_FLAC,
  MUSIC_MODE_QS,
  MUSIC_MODE_BY,
  MUSIC_MODE_VIP,
]

/** @type {Record<string, { label: string, badge: string, desc: string, master: boolean, wifiOnly: boolean, cover: string }>} */
export const MODE_META = {
  super_player: {
    label: '原生母带',
    badge: '母带',
    desc: '母带音质',
    master: true,
    wifiOnly: true,
    cover: '/static/rossi.jpg',
  },
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
  return MUSIC_MODE_SUPER_PLAYER
}

export function isMasterMusicMode(mode) {
  const meta = MODE_META[normalizeMusicMode(mode)]
  return !!(meta && meta.master)
}

/** 仅原生母带强制 Wi‑Fi */
export function isWifiOnlyMusicMode(mode) {
  const meta = MODE_META[normalizeMusicMode(mode)]
  return !!(meta && meta.wifiOnly)
}

export function getModeMeta(mode) {
  return MODE_META[normalizeMusicMode(mode)]
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
