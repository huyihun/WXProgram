import { createSSRApp } from 'vue'
import App from './App.vue'

/**
 * uni-app 应用入口
 * createSSRApp 用于支持服务端渲染场景，小程序端同样使用该 API
 */
export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
