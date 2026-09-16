/**
 * 语音转文字：腾讯云一句话识别（密钥 TCB_SECRET_ID / TCB_SECRET_KEY）
 * 入参：{ audioBase64, format?: 'mp3' }
 * 出参：{ ok, text } 或 { ok: false, message }
 *
 * 前置：腾讯云控制台开通「一句话识别」；云函数环境变量配置 API 密钥
 */
const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AsrClient = tencentcloud.asr.v20190614.Client
const MAX_BYTES = 3 * 1024 * 1024

function formatAsrError(err) {
  const raw =
    (err && err.message) ||
    (err && err.code) ||
    String(err || '')
  if (
    raw.indexOf('ResourcePackage') >= 0 ||
    raw.indexOf('资源包') >= 0 ||
    raw.indexOf('余额') >= 0
  ) {
    return '请在腾讯云控制台开通语音识别并领取免费额度'
  }
  if (raw.indexOf('AuthFailure') >= 0 || raw.indexOf('SecretId') >= 0) {
    return 'API 密钥无效，请检查 TCB_SECRET_ID/KEY'
  }
  return raw || '语音识别失败'
}

function createAsrClient(secretId, secretKey) {
  return new AsrClient({
    credential: {
      secretId: secretId,
      secretKey: secretKey,
    },
    region: '',
    profile: {
      httpProfile: {
        endpoint: 'asr.tencentcloudapi.com',
      },
    },
  })
}

exports.main = async function (event) {
  const audioBase64 = (event && event.audioBase64) || ''
  const format = (event && event.format) || 'mp3'
  if (!audioBase64) {
    return { ok: false, message: '缺少音频数据' }
  }

  let bytes = 0
  try {
    bytes = Buffer.from(audioBase64, 'base64').length
  } catch (e) {
    return { ok: false, message: '音频数据无效' }
  }
  if (!bytes) {
    return { ok: false, message: '录音为空' }
  }
  if (bytes > MAX_BYTES) {
    return { ok: false, message: '音频过大，请缩短录音' }
  }

  const secretId = process.env.TCB_SECRET_ID || ''
  const secretKey = process.env.TCB_SECRET_KEY || ''
  if (!secretId || !secretKey) {
    return { ok: false, message: '未配置 TCB_SECRET_ID / TCB_SECRET_KEY' }
  }

  try {
    const client = createAsrClient(secretId, secretKey)
    const data = await client.SentenceRecognition({
      EngSerViceType: '16k_zh',
      SourceType: 1,
      VoiceFormat: format,
      Data: audioBase64,
      DataLen: bytes,
    })
    const text = (data && data.Result) || ''
    if (!text) {
      return { ok: false, message: '未识别到内容' }
    }
    return { ok: true, text: text }
  } catch (e) {
    return { ok: false, message: formatAsrError(e) }
  }
}
