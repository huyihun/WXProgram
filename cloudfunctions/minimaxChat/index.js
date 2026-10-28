/**
 * MiniMax 对话（密钥仅存云函数环境变量 MINIMAX_API_KEY）
 *
 * 国内站：api.minimaxi.com（不要用 minimax.io）
 * 入参：{ messages: [{ role, content }], mode?, personaText?, statusText?, memoryDigest?, styleText?, avatarDesc? }
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

const SYSTEM_TWIN_BASE =
  '你就是「胡神」本人（数字分身）。对方在和「我」对话，你必须始终用第一人称「我」说话。' +
  '禁止用「你是…」「他是…」指称自己；问「我是谁/你是谁」时只答「我是…」。' +
  '叙述行程、计划一律用「我今晚…」「我每周五…」，禁止「你下班后…」「你去…」。' +
  '示例：问「我是谁」→「我是胡神，…」；问「今晚干嘛」→「我今晚出去打台球…」。' +
  '严格依据下方人设、当前状态与记忆；不知就说不确定，禁止编造与状态/记忆矛盾的行踪。' +
  '若记忆与旧说法冲突，以更新的记忆为准。' +
  '状态标注过时、或未写行程时：行程类问题直接说不确定，禁止瞎编今晚安排。' +
  '遵守价值观与底线；不代替真人做法律/医疗决策。' +
  '说话语气必须模仿主人的风格与口头禅（见【语气风格·必须模仿】）；' +
  '像微信私聊：多数回复 1～3 句，少用编号列表，禁止「作为 AI」套话。' +
  '宁可口语化像真人发消息，也不要通用客服腔。' +
  '涉及时效、日期以给定的北京时间为准。'

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

function buildSystemPrompt(twinOpts) {
  const twin = twinOpts || {}
  const isTwin = twin.mode === 'twin'
  let s = (isTwin ? SYSTEM_TWIN_BASE : SYSTEM_BASE) + '\n' + beijingNowText() + '。'
  if (isTwin) {
    if (twin.avatarDesc) s += '\n【形象】\n' + twin.avatarDesc + '\n'
    if (twin.personaText) s += '\n【人设】\n' + twin.personaText + '\n'
    if (twin.statusText) s += '\n【当前状态·须与之一致】\n' + twin.statusText + '\n'
    if (twin.memoryDigest) s += '\n【长期记忆】\n' + twin.memoryDigest + '\n'
    if (twin.styleText) {
      s +=
        '\n【语气风格·必须模仿】\n以下是主人的语气描述与原话样本，' +
        '你的用词、句长、标点、口头禅都必须向主人靠拢，让主人一眼觉得"这就像我说的"：\n' +
        twin.styleText +
        '\n'
    }
  }
  return s
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

  const twinOpts = {
    mode: event && event.mode,
    personaText: event && event.personaText,
    statusText: event && event.statusText,
    memoryDigest: event && event.memoryDigest,
    styleText: event && event.styleText,
    avatarDesc: event && event.avatarDesc,
  }

  try {
    const data = await postJson(
      {
        model: MODEL,
        messages: [{ role: 'system', content: buildSystemPrompt(twinOpts) }].concat(messages),
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
