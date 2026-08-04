/**
 * 心情对应的全局主题色
 * 通过 CSS 变量挂到 PageRoot / page，覆盖 uni.scss 中的色值
 * 主题来自云库 mood_emojis（registerMoodThemes / applyMoodThemeFromItem）
 */
import { ref } from 'vue'

const STORAGE_KEY = 'moodThemeKey'
const STORAGE_THEME = 'moodThemePayload'

/** 云目录注册的动态主题：key -> elevate 后的 style */
const dynamicThemes = {}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return [139, 94, 60]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** 根据主色 rgb 生成立体阴影与柔色卡片底 */
function elevate(base, rgb, cardSoft) {
  const r = rgb[0]
  const g = rgb[1]
  const b = rgb[2]
  return Object.assign({}, base, {
    '--color-card-soft': cardSoft,
    '--shadow-card-elevated':
      '0 2rpx 4rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.07), 0 10rpx 24rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.14), 0 24rpx 52rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.18), 0 40rpx 80rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.1)',
    '--shadow-card-pressed':
      '0 2rpx 6rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.1), 0 8rpx 20rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.12)',
    '--shadow-icon':
      '0 4rpx 10rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.3), 0 14rpx 36rpx rgba(' +
      r +
      ',' +
      g +
      ',' +
      b +
      ',0.4)',
  })
}

/** 把目录里的 theme 对象转成 CSS 变量表 */
export function buildThemeFromCatalog(theme) {
  const t = theme || {}
  const primary = t.primary || '#8B5E3C'
  const primaryDark = t.primaryDark || '#6B4423'
  const bg = t.bg || '#F3EBE3'
  const nav = t.nav || bg
  const title = t.title || '#3E2723'
  const subtitle = t.subtitle || primaryDark
  const cardSoft = t.cardSoft || '#FAF6F2'
  const gradientHero =
    t.gradientHero || 'linear-gradient(180deg, ' + bg + ' 0%, #FFFFFF 100%)'
  return elevate(
    {
      '--color-bg': bg,
      '--color-nav': nav,
      '--color-primary': primary,
      '--color-primary-dark': primaryDark,
      '--color-title': title,
      '--color-subtitle': subtitle,
      '--gradient-hero': gradientHero,
    },
    hexToRgb(primary),
    cardSoft
  )
}

/** 云目录未就绪时的默认色板 */
const DEFAULT_THEME = buildThemeFromCatalog({
  primary: '#8B5E3C',
  primaryDark: '#6B4423',
  bg: '#F3EBE3',
  nav: '#EDE2D6',
  title: '#3E2723',
  subtitle: '#8D6E63',
  cardSoft: '#FAF6F2',
  gradientHero: 'linear-gradient(180deg, #E8D5C4 0%, #F6F0EA 100%)',
})

/** 注册云/本地心情目录主题 */
export function registerMoodThemes(list) {
  if (!list || !list.length) return
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || !item.key) continue
    dynamicThemes[item.key] = buildThemeFromCatalog(item.theme)
  }
}

/** 当前主题 style 对象，供 PageRoot 绑定 */
export const themeStyle = ref(pickThemeStyle(DEFAULT_THEME))

function pickThemeStyle(theme) {
  return {
    '--color-bg': theme['--color-bg'],
    '--color-nav': theme['--color-nav'],
    '--color-primary': theme['--color-primary'],
    '--color-primary-dark': theme['--color-primary-dark'],
    '--color-title': theme['--color-title'],
    '--color-subtitle': theme['--color-subtitle'],
    '--gradient-hero': theme['--gradient-hero'],
    '--color-card-soft': theme['--color-card-soft'],
    '--shadow-card-elevated': theme['--shadow-card-elevated'],
    '--shadow-card-pressed': theme['--shadow-card-pressed'],
    '--shadow-icon': theme['--shadow-icon'],
  }
}

export function getMoodThemeStyle(key) {
  const theme = dynamicThemes[key] || DEFAULT_THEME
  return pickThemeStyle(theme)
}

/** 应用心情主题：更新内存 + 本地缓存 */
export function applyMoodTheme(key) {
  const safeKey = dynamicThemes[key] ? key : ''
  themeStyle.value = getMoodThemeStyle(safeKey)
  try {
    if (safeKey) uni.setStorageSync(STORAGE_KEY, safeKey)
  } catch (err) {
    console.error('保存主题缓存失败', err)
  }
  return safeKey
}

/** 用目录项直接应用（含完整 theme） */
export function applyMoodThemeFromItem(item) {
  if (!item || !item.key) {
    themeStyle.value = pickThemeStyle(DEFAULT_THEME)
    return ''
  }
  if (item.theme) {
    dynamicThemes[item.key] = buildThemeFromCatalog(item.theme)
    try {
      uni.setStorageSync(STORAGE_THEME, {
        key: item.key,
        theme: item.theme,
      })
    } catch (err) {
      // ignore
    }
  }
  return applyMoodTheme(item.key)
}

/** 从本地缓存恢复主题 */
export function restoreMoodTheme() {
  try {
    const payload = uni.getStorageSync(STORAGE_THEME)
    if (payload && payload.key && payload.theme) {
      dynamicThemes[payload.key] = buildThemeFromCatalog(payload.theme)
      return applyMoodTheme(payload.key)
    }
    const key = uni.getStorageSync(STORAGE_KEY)
    if (key) return applyMoodTheme(key)
  } catch (err) {
    console.error('读取主题缓存失败', err)
  }
  themeStyle.value = pickThemeStyle(DEFAULT_THEME)
  return ''
}
