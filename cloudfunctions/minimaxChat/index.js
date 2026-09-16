/**
 * MiniMax 对话（密钥仅存云函数环境变量 MINIMAX_API_KEY）
 *
 * 国内站：api.minimaxi.com（不要用 minimax.io）
 * 入参：{ messages: [{ role, content }] }
 * 出参：{ ok, reply } 或 { ok:false, message }
 * 模型固定 MiniMax-M2.7
 */
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MODEL = 'MiniMax-M2.7'
const API_HOST = 'api.minimaxi.com'
const API_PATH = '/v1/chat/completions'

const SYSTEM_BASE =
  '你是生活百科与闲聊助手。用简洁自然的中文回答，像懂生活的朋友。' +
  '常识、百科、日常问题尽量讲清楚；不确定时坦诚说明。不要编造具体数据或出处。' +
  '涉及时效、日期时以给定的北京时间为准；不要编造新闻。'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function beijingNowText() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date())
  const map = {}
  for (let i = 0; i < parts.length; i++) {
    map[parts[i].type] = parts[i].value
  }
  const wdEn = map.weekday || ''
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const wd = WEEKDAYS[wdMap[wdEn] != null ? wdMap[wdEn] : 0]
  return (
    '当前北京时间：' +
    map.year +
    '年' +
    map.month +
    '月' +
    map.day +
    '日 星期' +
    wd +
    ' ' +
    map.hour +
    ':' +
    map.minute
  )
}

function buildSystemPrompt() {
  return SYSTEM_BASE + '\n' + beijingNowText() + '。'
}

function postJson(body, apiKey) {
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path: API_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let data = null
          try {
            data = JSON.parse(text)
          } catch (e) {
            reject(new Error('MiniMax 返回解析失败'))
            return
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const msg =
              (data && data.error && data.error.message) ||
              (data && data.base_resp && data.base_resp.status_msg) ||
              (data && data.msg) ||
              'MiniMax 请求失败(' + res.statusCode + ')'
            reject(new Error(msg))
            return
          }
          resolve(data)
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(55000, () => req.destroy(new Error('MiniMax 接口超时')))
    req.write(payload)
    req.end()
  })
}

function normalizeMessages(raw) {
  if (!raw || !raw.length) return []
  const out = []
  const max = Math.min(raw.length, 24)
  const start = raw.length > max ? raw.length - max : 0
  for (let i = start; i < raw.length; i++) {
    const m = raw[i]
    if (!m) continue
    const role = m.role === 'assistant' || m.role === 'user' ? m.role : ''
    const content = m.content != null ? String(m.content).trim() : ''
    if (!role || !content) continue
    if (content.length > 4000) {
      out.push({ role: role, content: content.slice(0, 4000) })
    } else {
      out.push({ role: role, content: content })
    }
  }
  return out
}

exports.main = async (event) => {
  const apiKey = process.env.MINIMAX_API_KEY || ''
  if (!apiKey) {
    return { ok: false, message: '未配置 MINIMAX_API_KEY' }
  }

  const messages = normalizeMessages(event && event.messages)
  if (!messages.length) {
    return { ok: false, message: '请输入内容' }
  }

  const last = messages[messages.length - 1]
  if (last.role !== 'user') {
    return { ok: false, message: '最后一条须为用户消息' }
  }

  try {
    const data = await postJson(
      {
        model: MODEL,
        messages: [{ role: 'system', content: buildSystemPrompt() }].concat(messages),
      },
      apiKey
    )
    const choice = data && data.choices && data.choices[0]
    const reply =
      choice && choice.message && choice.message.content
        ? String(choice.message.content).trim()
        : ''
    if (!reply) {
      return { ok: false, message: '模型未返回内容' }
    }
    return { ok: true, reply: reply }
  } catch (err) {
    return { ok: false, message: (err && err.message) || '对话服务异常' }
  }
}
