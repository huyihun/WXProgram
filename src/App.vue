<script setup>
import { restoreMoodTheme, applyMoodTheme } from '@/utils/moodTheme'
import { loadOwnerFlag } from '@/utils/owner'

//云开发环境ID cloudbase-d7g0orq1z360a029f
/**
 * 应用启动时初始化微信云开发，并恢复心情主题
 * 注意：勿在 init 前静态 import notebook（会触发 database() 导致白屏）
 * owner 只调 login 云函数，可静态引入
 *
 * 动态 import 在小程序打包后，命名导出可能挂在 module 或 module.default 上
 */
function pickExport(mod, name) {
  if (mod && typeof mod[name] === 'function') return mod[name]
  if (mod && mod.default && typeof mod.default[name] === 'function') return mod.default[name]
  return null
}

onLaunch(() => {
  restoreMoodTheme()

  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    return
  }

  wx.cloud.init({
    env: 'cloudbase-d7g0orq1z360a029f',
    traceUser: true,
  })

  // 稍晚再调 login，避免 init 后立刻 callFunction 不稳定
  setTimeout(() => {
    loadOwnerIdentity()
  }, 300)
  syncTodayMoodTheme()
  warmMusic()
})

async function loadOwnerIdentity() {
  try {
    await loadOwnerFlag()
  } catch (err) {
    const msg = (err && (err.errMsg || err.message)) || err
    console.warn('[owner] 主人身份加载失败', msg)
  }
}

async function syncTodayMoodTheme() {
  try {
    const mod = await import('@/api/notebook')
    const getMoodByDate = pickExport(mod, 'getMoodByDate')
    if (!getMoodByDate) return

    const now = new Date()
    const today =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0')

    const data = await getMoodByDate(today)
    if (data && data.moodKey) {
      applyMoodTheme(data.moodKey)
    }
  } catch (err) {
    console.error('同步今日心情主题失败', err)
  }
}

async function warmMusic() {
  try {
    const playlistMod = await import('@/utils/playlist')
    const prefsMod = await import('@/api/musicPrefs')
    const syncMusicPrefs = pickExport(playlistMod, 'syncMusicPrefs')
    const getPlaylistByMode = pickExport(playlistMod, 'getPlaylistByMode')
    const warmMusicCache = pickExport(playlistMod, 'warmMusicCache')
    const MUSIC_MODE_VIP = playlistMod && playlistMod.MUSIC_MODE_VIP
    const getDefaultMusicMode = pickExport(prefsMod, 'getDefaultMusicMode')
    if (!syncMusicPrefs || !getPlaylistByMode || !warmMusicCache || !getDefaultMusicMode) return

    await syncMusicPrefs()
    const defaultMode = getDefaultMusicMode()
    // 母带过大不预热；仅 VIP mp3 走本地缓存预热
    if (defaultMode !== MUSIC_MODE_VIP) return
    const list = getPlaylistByMode(defaultMode)
    if (list && list[0]) {
      await warmMusicCache(list[0])
    }
  } catch (err) {
    console.error('预热音乐缓存失败', err)
  }
}
</script>

<style lang="scss">
page {
  background-color: var(--color-bg, #e8f4fc);
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}
</style>
