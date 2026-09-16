/**
 * 小黑：按住说话 → RecorderManager 录音 → 云函数腾讯云 ASR
 */
import { transcribeAudio } from '@/code-assist/speech'

let recorder = null
let recording = false
let recognizing = false
let handlers = null
let stopRequested = false
let cancelAfterStop = false

function getRecorder() {
  if (recorder) return recorder
  recorder = uni.getRecorderManager()
  recorder.onStop(function (res) {
    recording = false
    if (cancelAfterStop) {
      cancelAfterStop = false
      return
    }
    const path = (res && res.tempFilePath) || ''
    if (!path) {
      recognizing = false
      if (handlers && handlers.onError) handlers.onError('录音失败')
      return
    }
    uni.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: function (fileRes) {
        const base64 = (fileRes && fileRes.data) || ''
        if (!base64) {
          recognizing = false
          if (handlers && handlers.onError) handlers.onError('读取录音失败')
          return
        }
        transcribeAudio(base64, 'mp3')
          .then(function (text) {
            recognizing = false
            if (handlers && handlers.onFinal) handlers.onFinal(text)
          })
          .catch(function (e) {
            recognizing = false
            if (handlers && handlers.onError) {
              handlers.onError((e && e.message) || '语音识别失败')
            }
          })
      },
      fail: function () {
        recognizing = false
        if (handlers && handlers.onError) handlers.onError('读取录音失败')
      },
    })
  })
  recorder.onError(function (err) {
    recording = false
    recognizing = false
    if (handlers && handlers.onError) {
      handlers.onError((err && err.errMsg) || '录音失败')
    }
  })
  return recorder
}

function startRecord() {
  recording = true
  getRecorder().start({
    duration: 30000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 48000,
    format: 'mp3',
  })
}

function ensureRecordAuth(onOk, onFail) {
  uni.getSetting({
    success: function (res) {
      const auth = res.authSetting || {}
      if (auth['scope.record']) {
        onOk()
        return
      }
      uni.authorize({
        scope: 'scope.record',
        success: onOk,
        fail: function () {
          uni.showModal({
            title: '需要麦克风权限',
            content: '用于语音输入排查问题',
            confirmText: '去设置',
            success: function (modalRes) {
              if (modalRes.confirm) {
                uni.openSetting({
                  success: function (setRes) {
                    const setAuth = setRes.authSetting || {}
                    if (setAuth['scope.record']) onOk()
                    else if (onFail) onFail('需要麦克风权限')
                  },
                  fail: function () {
                    if (onFail) onFail('需要麦克风权限')
                  },
                })
              } else if (onFail) {
                onFail('需要麦克风权限')
              }
            },
          })
        },
      })
    },
    fail: function () {
      if (onFail) onFail('无法获取权限状态')
    },
  })
}

/**
 * @param {{ onPartial?: function, onFinal?: function, onError?: function, onRecognizing?: function }} h
 */
export function startVoiceInput(h) {
  if (recording || recognizing) return
  handlers = h || {}
  stopRequested = false
  cancelAfterStop = false
  ensureRecordAuth(
    function () {
      if (stopRequested) return
      startRecord()
    },
    function (msg) {
      if (handlers.onError) handlers.onError(msg)
    }
  )
}

export function stopVoiceInput() {
  stopRequested = true
  if (!recording) return
  recognizing = true
  if (handlers && handlers.onRecognizing) handlers.onRecognizing()
  getRecorder().stop()
}

/** 页面卸载：取消录音，不发起 ASR */
export function cancelVoiceInput() {
  stopRequested = true
  if (recording) {
    cancelAfterStop = true
    recognizing = false
    getRecorder().stop()
    return
  }
  recognizing = false
  handlers = null
}

export function isVoiceInputActive() {
  return recording
}

export function isVoiceRecognizing() {
  return recognizing
}
