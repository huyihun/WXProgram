<script setup>
//云开发环境ID cloudbase-d7g0orq1z360a029f
/**
 * 应用启动时初始化微信云开发
 */
onLaunch(() => {
  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    return
  }

  wx.cloud.init({
    traceUser: true, // 记录用户访问，便于云端排查问题
  })
})
</script>

<style lang="scss">
/* 全局基础样式，统一使用行楷字体 */
page,
view,
text,
button,
input,
textarea {
  font-family: $font-family;
}

page {
  background-color: #e8f4fc;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}
</style>
