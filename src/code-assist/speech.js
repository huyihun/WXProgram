/**
 * 语音转文字（云函数 speechToText → 腾讯云一句话识别）
 */

function callFnError(err, fnName) {
  const raw = (err && (err.errMsg || err.message)) || String(err || '')
  const lower = raw.toLowerCase()
  if (
    raw.indexOf('FUNCTION_NOT_FOUND') >= 0 ||
    raw.indexOf('FunctionName') >= 0 ||
    raw.indexOf('找不到') >= 0 ||
    lower.indexOf('not found') >= 0
  ) {
    return new Error('云函数 ' + fnName + ' 未部署，请在云开发控制台部署')
  }
  if (
    lower.indexOf('exceed max size') >= 0 ||
    lower.indexOf('data exceed') >= 0
  ) {
    return new Error('录音过长，请缩短后重试')
  }
  return new Error(raw || '语音识别失败')
}

export async function transcribeAudio(audioBase64, format) {
  if (!audioBase64) {
    throw new Error('缺少音频数据')
  }
  let res
  try {
    res = await wx.cloud.callFunction({
      name: 'speechToText',
      data: {
        audioBase64: audioBase64,
        format: format || 'mp3',
      },
    })
  } catch (err) {
    throw callFnError(err, 'speechToText')
  }
  const body = (res && res.result) || {}
  if (!body.ok) {
    throw new Error(body.message || '语音识别失败')
  }
  return body.text || ''
}
