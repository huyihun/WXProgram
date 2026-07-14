/**
 * login 云函数
 * 获取当前微信用户的 OpenID，用于验证云开发环境是否正常
 */
const cloud = require('wx-server-sdk')

// 使用当前云环境，无需手动填写 env id
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 云函数入口
 * @returns {Promise<{openid: string, appid: string, unionid: string}>}
 */
exports.main = async () => {
  const wxContext = cloud.getWXContext()

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}
