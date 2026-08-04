<script setup>
import { restoreMoodTheme } from '@/utils/moodTheme'
import { loadOwnerFlag } from '@/utils/owner'

//云开发环境ID cloudbase-d7g0orq1z360a029f
/**
 * 应用启动时初始化微信云开发，并恢复心情主题
 * 注意：勿在 init 前静态 import notebook（会触发 database() 导致白屏）
 * owner 只调 login 云函数，可静态引入
 */
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
  restoreSuperVipMusic()
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

async function restoreSuperVipMusic() {
  try {
    const { loadAppVersionFromCloud } = await import('@/utils/vipMode')
    await loadAppVersionFromCloud()
  } catch (err) {
    console.error('同步超级VIP音乐失败', err)
  }
}

async function syncTodayMoodTheme() {
  try {
    const { listMoodEmojis, getMoodEmojiByKey, prefetchMoodCatalog } = await import(
      '@/api/moodCatalog'
    )
    const { getMoodByDate, getToday } = await import('@/api/notebook')
    const { applyMoodThemeFromItem, registerMoodThemes } = await import('@/utils/moodTheme')
    const list = await listMoodEmojis()
    registerMoodThemes(list)
    const data = await getMoodByDate(getToday())
    let item = null
    if (data && data.moodKey) {
      item = await getMoodEmojiByKey(data.moodKey)
    }
    if (!item && list.length) {
      item = list[0]
    }
    if (item) applyMoodThemeFromItem(item)
    // 后台预换链，打开心情选择器时尽量秒开
    prefetchMoodCatalog()
  } catch (err) {
    console.error('同步今日心情主题失败', err)
  }
}

async function warmMusic() {
  try {
    const { SUPER_VIP_PLAYLIST, warmMusicCache, syncMusicPrefs } = await import(
      '@/utils/playlist'
    )
    await syncMusicPrefs()
    if (SUPER_VIP_PLAYLIST && SUPER_VIP_PLAYLIST[0]) {
      await warmMusicCache(SUPER_VIP_PLAYLIST[0])
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
