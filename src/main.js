import { createSSRApp } from 'vue'
import App from './App.vue'
import { setNavPageScrolled } from '@/utils/navScroll'

/**
 * uni-app 应用入口
 * createSSRApp 用于支持服务端渲染场景，小程序端同样使用该 API
 */
export function createApp() {
  const app = createSSRApp(App)
  // onPageScroll 只在页面生效，用 mixin 统一喂给导航吸顶状态
  app.mixin({
    onShow() {
      setNavPageScrolled(0)
    },
    onPageScroll(e) {
      setNavPageScrolled(e && e.scrollTop)
    },
  })
  return { app }
}
