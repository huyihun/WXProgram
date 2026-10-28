/**
 * 心情对应的全局主题色
 * 通过 CSS 变量挂到 PageRoot / page，覆盖 uni.scss 中的色值
 * 全站背景改为纯 CSS 氛围渐变（不再加载实景主题壁纸）
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

/** 各心情色板 + 氛围渐变（咖啡默认 / 开心暖黄 / 平静蓝 / …） */
export const MOOD_THEMES = {
  coffee: elevate(
    {
      '--color-bg': '#F3EBE3',
      '--color-nav': '#EDE2D6',
      '--color-primary': '#8B5E3C',
      '--color-primary-dark': '#6B4423',
      '--color-title': '#3E2723',
      '--color-subtitle': '#8D6E63',
      '--gradient-hero': 'linear-gradient(165deg, #E6D4C2 0%, #F3EBE3 42%, #F8F3ED 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #E2CDB8 0%, #EDE0D2 28%, #F3EBE3 55%, #F7F2EC 78%, #FAF7F3 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #FFE0B0 0%, #FFF6E8 50%, #FFFCF7 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #FFD9A0 0%, #FFEAC4 30%, #FFF6E8 58%, #FFFBF5 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #CDE6F7 0%, #E8F4FC 50%, #F5FAFD 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #C2E0F5 0%, #D9ECF9 32%, #E8F4FC 60%, #F4FAFD 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #D0DCE6 0%, #E8EEF4 52%, #F3F6F9 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #C8D6E2 0%, #D8E2EA 34%, #E8EEF4 62%, #F2F5F8 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #E8D4B4 0%, #F7F0E6 52%, #FBF7F1 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #E2CBA8 0%, #EEDCC0 32%, #F7F0E6 60%, #FBF7F2 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #D2DED6 0%, #EBF0EC 52%, #F4F7F5 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #C9D8CE 0%, #DCE6E0 34%, #EBF0EC 62%, #F4F7F5 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #FFCFC6 0%, #FFF0EE 52%, #FFF8F7 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #FFC4B8 0%, #FFDCD5 32%, #FFF0EE 60%, #FFF8F7 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #FFE2B5 0%, #FFF8E9 52%, #FFFCF6 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #FFD9A0 0%, #FFEAC4 32%, #FFF8E9 60%, #FFFCF6 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #C8E2EE 0%, #EAF4F8 52%, #F5FAFC 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #BDDCEC 0%, #D4EAF3 34%, #EAF4F8 62%, #F5FAFC 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #CFD8E4 0%, #E9EDF3 52%, #F3F5F8 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #C5D0DE 0%, #D7DFE9 34%, #E9EDF3 62%, #F3F5F8 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #DDDDD0 0%, #F0F0EC 52%, #F7F7F4 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #D5D5C6 0%, #E5E5DB 34%, #F0F0EC 62%, #F7F7F4 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #FFC9BF 0%, #FFF0ED 52%, #FFF8F6 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #FFBDB0 0%, #FFD8D0 32%, #FFF0ED 60%, #FFF8F6 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #C5E2DD 0%, #E8F2F1 52%, #F3F9F8 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #B8DBD5 0%, #D0E8E4 34%, #E8F2F1 62%, #F3F9F8 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #FFD4A8 0%, #FFF5EB 52%, #FFFBF6 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #FFC890 0%, #FFE2C0 32%, #FFF5EB 60%, #FFFBF6 100%)',
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
      '--gradient-hero': 'linear-gradient(165deg, #D0E6D0 0%, #EEF5EC 52%, #F6FAF5 100%)',
      '--gradient-atmosphere':
        'linear-gradient(165deg, #C4DFC4 0%, #D9EBD9 34%, #EEF5EC 62%, #F6FAF5 100%)',
    },
    [111, 174, 114],
    '#F7FBF6'
  ),
}

/** 当前主题 style 对象，供 PageRoot 绑定 */
export const themeStyle = ref(getMoodThemeStyle('coffee'))

/** 当前心情 key */
export const currentMoodKey = ref('coffee')

/**
 * 主题实景壁纸 URL（已停用：恒为空，改用 CSS 氛围渐变）
 * 壁纸页珍藏图库仍走 wallpaperCatalog，与此无关
 */
export const themeBgUrl = ref('')

/**
 * 历史：心情 → 壁纸文件名（仅备用对照，主题背景不再加载）
 * 对照 src/主题背景图片.txt
 */
export const MOOD_BG_FILES = {
  coffee: 'w055.jpg',
  happy: 'w017.jpg',
  calm: 'w048.jpg',
  sad: 'w069.jpg',
  anxious: 'w073.jpg',
  tired: 'w074.jpg',
  excited: 'w076.jpg',
  grateful: 'w103.png',
  peaceful: 'w108.jpg',
  lonely: 'w110.jpg',
  bored: 'w068.jpg',
  angry: 'w065.jpg',
  focused: 'w079.jpg',
  surprised: 'w096.jpg',
  relaxed: 'w078.jpg',
}

export function getMoodBgFileID() {
  return ''
}

/** #RRGGBB → rgba，用于氛围底上的轻蒙层 */
function hexToVeil(hex, alpha) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) {
    return 'rgba(243, 235, 227, ' + alpha + ')'
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}

/** 清掉过期缓存（兼容旧调用，现无壁纸链） */
export function invalidateThemeBgCache() {
  themeBgUrl.value = ''
}

/** 主题背景已改为 CSS，无需换链；保留 API 避免调用方报错 */
export function ensureMoodThemeBg() {
  themeBgUrl.value = ''
}

export function getMoodThemeStyle(key) {
  const safe = MOOD_THEMES[key] ? key : 'coffee'
  const theme = MOOD_THEMES[safe]
  const style = {
    '--color-bg': theme['--color-bg'],
    '--color-nav': theme['--color-nav'],
    '--color-primary': theme['--color-primary'],
    '--color-primary-dark': theme['--color-primary-dark'],
    '--color-title': theme['--color-title'],
    '--color-subtitle': theme['--color-subtitle'],
    '--gradient-hero': theme['--gradient-hero'],
    '--gradient-atmosphere': theme['--gradient-atmosphere'] || theme['--gradient-hero'],
    '--color-card-soft': theme['--color-card-soft'],
    '--shadow-card-elevated': theme['--shadow-card-elevated'],
    '--shadow-card-pressed': theme['--shadow-card-pressed'],
    '--shadow-icon': theme['--shadow-icon'],
    // 氛围渐变已够干净，蒙层极淡
    '--color-veil': hexToVeil(theme['--color-bg'], 0.12),
  }
  if (safe === 'coffee') {
    style['--lyric-bg'] = '#1a1410'
    style['--lyric-bg-top'] = '#2a2216'
    style['--lyric-now'] = '#e8c878'
    style['--lyric-prev'] = 'rgba(220, 190, 130, 0.48)'
    style['--lyric-next'] = 'rgba(220, 190, 130, 0.28)'
    style['--lyric-base'] = 'rgba(220, 190, 130, 0.42)'
    style['--lyric-border'] = 'rgba(180, 140, 70, 0.42)'
    style['--lyric-close'] = 'rgba(220, 190, 130, 0.7)'
  } else {
    style['--lyric-bg'] = theme['--color-title']
    style['--lyric-bg-top'] = theme['--color-title']
    style['--lyric-now'] = theme['--color-primary']
    style['--lyric-prev'] = theme['--color-subtitle']
    style['--lyric-next'] = theme['--color-subtitle']
    style['--lyric-base'] = theme['--color-subtitle']
    style['--lyric-border'] = theme['--color-primary']
    style['--lyric-close'] = theme['--color-subtitle']
  }
  return style
}

function applyMoodThemeCore(key) {
  const safeKey = MOOD_THEMES[key] ? key : 'coffee'
  currentMoodKey.value = safeKey
  themeStyle.value = getMoodThemeStyle(safeKey)
  themeBgUrl.value = ''
  try {
    uni.setStorageSync(STORAGE_KEY, safeKey)
  } catch (err) {
    console.error('保存主题缓存失败', err)
  }
  return safeKey
}

/** 应用心情主题：更新内存 + 本地缓存（氛围渐变，不拉实景壁纸） */
export function applyMoodTheme(key) {
  return applyMoodThemeCore(key)
}

/** 从本地缓存恢复色板 */
export function restoreMoodTheme() {
  let key = 'coffee'
  try {
    key = uni.getStorageSync(STORAGE_KEY) || 'coffee'
  } catch (err) {
    console.error('读取主题缓存失败', err)
  }
  return applyMoodThemeCore(key)
}
