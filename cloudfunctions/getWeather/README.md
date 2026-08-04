# 云函数 getWeather 部署说明

## 1. 申请和风天气 Key

1. 打开 [和风天气开发者控制台](https://console.qweather.com/)
2. 创建项目，开通 **城市搜索**、**实时天气**
3. 在「设置」里复制 **API KEY**，并记下 **API Host**（形如 `xxx.qweatherapi.com`；开发调试也可用 `devapi.qweather.com`）

## 2. 部署云函数

在微信开发者工具中：

1. 右键 `cloudfunctions/getWeather` → 上传并部署（云端安装依赖）
2. 打开该云函数「配置」→「环境变量」添加：
   - `QWEATHER_KEY` = 你的 API Key（必填）
   - `QWEATHER_HOST` = 你的 API Host（可选，不含 `https://`）

**不要**把 Key 写进小程序前端代码或提交到公开仓库。

## 3. 小程序权限（定位可选）

当前版本**只用城市名查天气**（点天气行可切换城市），不调用 `getFuzzyLocation`，避免未开通时报 `-80424`。

若以后要自动定位：

1. 后台「开发 → 开发管理 → 接口设置」开通 **模糊地理位置**
2. 在 `manifest.json` 的 `mp-weixin` 中加回：
   - `requiredPrivateInfos: ["getFuzzyLocation"]`
   - `permission.scope.userFuzzyLocation`
3. 再在 `src/api/weather.js` 中恢复定位调用

