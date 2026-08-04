/**
 * 应用固定为超级 VIP：天气、小说、周杰伦歌单
 * 已无版本切换入口
 */
import { MUSIC_MODE_SUPER, switchMusicMode } from '@/utils/bgMusic'

export const APP_VERSION_DEFAULT = 'default'
export const APP_VERSION_VIP = 'vip'
export const APP_VERSION_SUPER = 'super'

const listeners = []

export function getAppVersionSync() {
  return APP_VERSION_SUPER
}

/** 是否尊享（现恒为 true） */
export function getVipModeSync() {
  return true
}

export function subscribeAppVersion(fn) {
  listeners.push(fn)
  fn(APP_VERSION_SUPER)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export function subscribeVipMode(fn) {
  return subscribeAppVersion(() => {
    fn(true)
  })
}

/** 启动时切到超级 VIP 歌单 */
export async function loadAppVersionFromCloud() {
  try {
    await switchMusicMode(MUSIC_MODE_SUPER)
  } catch (err) {
    console.error('同步超级VIP音乐失败', err)
  }
  return APP_VERSION_SUPER
}

export async function loadVipModeFromCloud() {
  return loadAppVersionFromCloud()
}
