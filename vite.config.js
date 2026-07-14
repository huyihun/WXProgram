import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import AutoImport from 'unplugin-auto-import/vite'

// uni-app 构建配置，编译目标由 npm script 中的 -p 参数决定
export default defineConfig({
  plugins: [
    uni(),
    AutoImport({
      imports: [
        'vue',
        {
          '@dcloudio/uni-app': [
            'onLaunch',
            'onLoad',
            'onShow',
            'onReady',
            'onHide',
            'onUnload',
            'onPullDownRefresh',
            'onReachBottom',
            'onShareAppMessage',
            'onPageScroll',
          ],
        },
      ],
      dts: 'src/auto-imports.d.ts',
    }),
  ],
})
