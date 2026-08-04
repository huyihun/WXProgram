/**
 * 心情对应的全局主题色
 * 通过 CSS 变量挂到 PageRoot / page，覆盖 uni.scss 中的色值
 */
import { ref } from 'vue'

const STORAGE_KEY = 'moodThemeKey'

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

/** 各心情色板（咖啡默认 / 开心暖黄 / 平静蓝 / …） */
export const MOOD_THEMES = {
  coffee: elevate(
    {
      '--color-bg': '#F3EBE3',
      '--color-nav': '#EDE2D6',
      '--color-primary': '#8B5E3C',
      '--color-primary-dark': '#6B4423',
      '--color-title': '#3E2723',
      '--color-subtitle': '#8D6E63',
      '--gradient-hero': 'linear-gradient(180deg, #E8D5C4 0%, #F6F0EA 100%)',
    },
    [139, 94, 60],
    '#FAF6F2'
  ),
  happy: elevate(
    {
      '--color-bg': '#FFF6E8',
      '--color-nav': '#FFF0D9',
      '--color-primary': '#F0A03A',
      '--color-primary-dark': '#D4841E',
      '--color-title': '#4A320F',
      '--color-subtitle': '#A88456',
      '--gradient-hero': 'linear-gradient(180deg, #FFE8C4 0%, #FFF8ED 100%)',
    },
    [240, 160, 58],
    '#FFFCF7'
  ),
  calm: elevate(
    {
      '--color-bg': '#E8F4FC',
      '--color-nav': '#E8F2FA',
      '--color-primary': '#4A9FE8',
      '--color-primary-dark': '#2B7FD4',
      '--color-title': '#0F2D4A',
      '--color-subtitle': '#6B8FA8',
      '--gradient-hero': 'linear-gradient(180deg, #D6EBFA 0%, #EEF6FC 100%)',
    },
    [74, 159, 232],
    '#F7FBFE'
  ),
  sad: elevate(
    {
      '--color-bg': '#E8EEF4',
      '--color-nav': '#E2E9F0',
      '--color-primary': '#6B8FA8',
      '--color-primary-dark': '#4A6F8A',
      '--color-title': '#243447',
      '--color-subtitle': '#7A8FA0',
      '--gradient-hero': 'linear-gradient(180deg, #D5E0EA 0%, #EEF2F6 100%)',
    },
    [107, 143, 168],
    '#F6F8FA'
  ),
  anxious: elevate(
    {
      '--color-bg': '#F7F0E6',
      '--color-nav': '#F3E9DA',
      '--color-primary': '#D4A05A',
      '--color-primary-dark': '#B8843C',
      '--color-title': '#3D2F1A',
      '--color-subtitle': '#9A8568',
      '--gradient-hero': 'linear-gradient(180deg, #EBD9BC 0%, #F8F2E9 100%)',
    },
    [212, 160, 90],
    '#FCFAF6'
  ),
  tired: elevate(
    {
      '--color-bg': '#EBF0EC',
      '--color-nav': '#E4EBE6',
      '--color-primary': '#7A9E88',
      '--color-primary-dark': '#5A7E68',
      '--color-title': '#2A3A30',
      '--color-subtitle': '#7A9084',
      '--gradient-hero': 'linear-gradient(180deg, #D4E0D8 0%, #F0F4F1 100%)',
    },
    [122, 158, 136],
    '#F7FAF8'
  ),
  excited: elevate(
    {
      '--color-bg': '#FFF0EE',
      '--color-nav': '#FFE8E4',
      '--color-primary': '#E86B5A',
      '--color-primary-dark': '#C84E3E',
      '--color-title': '#4A1F18',
      '--color-subtitle': '#A87870',
      '--gradient-hero': 'linear-gradient(180deg, #FFD6D0 0%, #FFF4F2 100%)',
    },
    [232, 107, 90],
    '#FFF9F8'
  ),
  grateful: elevate(
    {
      '--color-bg': '#FFF8E9',
      '--color-nav': '#FFF1D6',
      '--color-primary': '#E8A84A',
      '--color-primary-dark': '#C98A2C',
      '--color-title': '#4A3410',
      '--color-subtitle': '#A88855',
      '--gradient-hero': 'linear-gradient(180deg, #FFE6BF 0%, #FFF9EF 100%)',
    },
    [232, 168, 74],
    '#FFFCF6'
  ),
  peaceful: elevate(
    {
      '--color-bg': '#EAF4F8',
      '--color-nav': '#E2F0F6',
      '--color-primary': '#5BA8C8',
      '--color-primary-dark': '#3E8AAB',
      '--color-title': '#163948',
      '--color-subtitle': '#6E94A6',
      '--gradient-hero': 'linear-gradient(180deg, #CFE6F0 0%, #F0F7FA 100%)',
    },
    [91, 168, 200],
    '#F6FBFC'
  ),
  lonely: elevate(
    {
      '--color-bg': '#E9EDF3',
      '--color-nav': '#E2E7EF',
      '--color-primary': '#7A8DA6',
      '--color-primary-dark': '#5A708C',
      '--color-title': '#273344',
      '--color-subtitle': '#7F90A3',
      '--gradient-hero': 'linear-gradient(180deg, #D2DBE6 0%, #F0F3F7 100%)',
    },
    [122, 141, 166],
    '#F6F8FA'
  ),
  bored: elevate(
    {
      '--color-bg': '#F0F0EC',
      '--color-nav': '#EAEAE4',
      '--color-primary': '#9A9A82',
      '--color-primary-dark': '#787862',
      '--color-title': '#333328',
      '--color-subtitle': '#8C8C78',
      '--gradient-hero': 'linear-gradient(180deg, #DDDDD2 0%, #F5F5F1 100%)',
    },
    [154, 154, 130],
    '#FAFAF8'
  ),
  angry: elevate(
    {
      '--color-bg': '#FFF0ED',
      '--color-nav': '#FFE6E1',
      '--color-primary': '#E05545',
      '--color-primary-dark': '#B83C2E',
      '--color-title': '#4A1A14',
      '--color-subtitle': '#A87068',
      '--gradient-hero': 'linear-gradient(180deg, #FFCFC7 0%, #FFF3F1 100%)',
    },
    [224, 85, 69],
    '#FFF8F7'
  ),
  focused: elevate(
    {
      '--color-bg': '#E8F2F1',
      '--color-nav': '#DFF0EE',
      '--color-primary': '#3F9E94',
      '--color-primary-dark': '#2A7F76',
      '--color-title': '#163833',
      '--color-subtitle': '#6A908A',
      '--gradient-hero': 'linear-gradient(180deg, #C8E4E0 0%, #EFF7F6 100%)',
    },
    [63, 158, 148],
    '#F5FBFA'
  ),
  surprised: elevate(
    {
      '--color-bg': '#FFF5EB',
      '--color-nav': '#FFEDD9',
      '--color-primary': '#F08A4A',
      '--color-primary-dark': '#D16A2C',
      '--color-title': '#4A2A12',
      '--color-subtitle': '#A87E58',
      '--gradient-hero': 'linear-gradient(180deg, #FFD9B5 0%, #FFF7EE 100%)',
    },
    [240, 138, 74],
    '#FFF9F4'
  ),
  relaxed: elevate(
    {
      '--color-bg': '#EEF5EC',
      '--color-nav': '#E6F0E3',
      '--color-primary': '#6FAE72',
      '--color-primary-dark': '#538C56',
      '--color-title': '#243D26',
      '--color-subtitle': '#75967A',
      '--gradient-hero': 'linear-gradient(180deg, #D4E8D4 0%, #F3F8F2 100%)',
    },
    [111, 174, 114],
    '#F7FBF6'
  ),
}

/** 当前主题 style 对象，供 PageRoot 绑定 */
export const themeStyle = ref(getMoodThemeStyle('coffee'))

export function getMoodThemeStyle(key) {
  const theme = MOOD_THEMES[key] || MOOD_THEMES.coffee
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

/** 应用心情主题：更新内存 + 本地缓存 */
export function applyMoodTheme(key) {
  const safeKey = MOOD_THEMES[key] ? key : 'coffee'
  themeStyle.value = getMoodThemeStyle(safeKey)
  try {
    uni.setStorageSync(STORAGE_KEY, safeKey)
  } catch (err) {
    console.error('保存主题缓存失败', err)
  }
  return safeKey
}

/** 从本地缓存恢复主题 */
export function restoreMoodTheme() {
  let key = 'coffee'
  try {
    key = uni.getStorageSync(STORAGE_KEY) || 'coffee'
  } catch (err) {
    console.error('读取主题缓存失败', err)
  }
  return applyMoodTheme(key)
}
