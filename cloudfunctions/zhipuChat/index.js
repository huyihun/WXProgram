/**
 * 智谱对话（密钥仅存云函数环境变量 ZHIPU_API_KEY）
 *
 * Coding Plan Key 须走 /api/coding/paas/v4（不是通用 /api/paas/v4）
 * 入参：{ messages: [{ role, content }], imageBase64?, imageMime? }
 * 出参：{ ok, reply } 或 { ok:false, message }
 * 模型固定 glm-5.3；时效问题按需走套餐 MCP 联网搜索
 */
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MODEL = 'glm-5.3'
/** Coding Plan 专用通道（与通用 /api/paas/v4 额度不共用） */
const API_HOST = 'open.bigmodel.cn'
const API_PATH = '/api/coding/paas/v4/chat/completions'
const MCP_PATH = '/api/mcp/web_search_prime/mcp'

const SYSTEM_BASE =
  '你是生活百科与闲聊助手。用简洁自然的中文回答，像懂生活的朋友。' +
  '常识、百科、日常问题尽量讲清楚；不确定时坦诚说明。不要编造具体数据或出处。' +
  '涉及时效、日期、热点时以给定的北京时间为准；无检索摘要时勿编造新闻。'

const SYSTEM_TWIN_BASE =
  '你就是「胡神」本人（数字分身）。对方在和「我」对话，你必须始终用第一人称「我」说话。' +
  '禁止用「你是…」「他是…」指称自己；问「我是谁/你是谁」时只答「我是…」。' +
  '叙述行程、计划一律用「我今晚…」「我每周五…」，禁止「你下班后…」「你去…」。' +
  '示例：问「我是谁」→「我是胡神，…」；问「今晚干嘛」→「我今晚出去打台球…」。' +
  '严格依据下方人设、当前状态与记忆；不知就说不确定，禁止编造与状态/记忆矛盾的行踪。' +
  '若记忆与旧说法冲突，以更新的记忆为准。' +
  '遵守价值观与底线；不代替真人做法律/医疗决策。' +
  '说话语气必须模仿主人的风格与口头禅（见【语气风格·必须模仿】）；' +
  '宁可口语化像真人发消息，也不要通用客服腔。' +
  '涉及时效、日期以给定的北京时间为准。'

const TIME_SENSITIVE_RE =
  /最新|今天|今日|热点|热搜|新闻|实时|天气|股价|汇率|比赛|刚刚|昨晚|本周|近日|多少钱|几号|开奖|现在|当前|近期|今年|本月/

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

function httpsRequest(options, body, timeoutMs) {
  const payload = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs || 15000, () => req.destroy(new Error('请求超时')))
    if (payload) req.write(payload)
    req.end()
  })
}

function postChat(body, apiKey) {
  const payload = JSON.stringify(body)
  return httpsRequest(
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
    payload,
    55000
  ).then((res) => {
    let data = null
    try {
      data = JSON.parse(res.text)
    } catch (e) {
      throw new Error('智谱返回解析失败')
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const msg =
        (data && data.error && data.error.message) ||
        (data && data.msg) ||
        '智谱请求失败(' + res.statusCode + ')'
      throw new Error(msg)
    }
    return data
  })
}

function parseMcpBody(text) {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.charAt(0) === '{') {
    try {
      return JSON.parse(trimmed)
    } catch (e) {
      // fall through SSE
    }
  }
  const lines = text.split('\n')
  let last = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.indexOf('data:') !== 0) continue
    const raw = line.slice(5).trim()
    if (!raw || raw === '[DONE]') continue
    try {
      last = JSON.parse(raw)
    } catch (e) {
      // ignore
    }
  }
  return last
}

function headerValue(headers, name) {
  if (!headers) return ''
  const lower = name.toLowerCase()
  const keys = Object.keys(headers)
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) {
      const v = headers[keys[i]]
      return Array.isArray(v) ? v[0] : v || ''
    }
  }
  return ''
}

async function mcpPost(apiKey, body, sessionId, timeoutMs) {
  const payload = JSON.stringify(body)
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: 'Bearer ' + apiKey,
    'Content-Length': Buffer.byteLength(payload),
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId
  const res = await httpsRequest(
    {
      hostname: API_HOST,
      path: MCP_PATH,
      method: 'POST',
      headers: headers,
    },
    payload,
    timeoutMs || 12000
  )
  return {
    statusCode: res.statusCode,
    sessionId: headerValue(res.headers, 'mcp-session-id') || sessionId || '',
    data: parseMcpBody(res.text),
    text: res.text,
  }
}

function unwrapSearchText(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts = []
    for (let i = 0; i < content.length; i++) {
      const item = content[i]
      if (!item) continue
      if (typeof item === 'string') parts.push(item)
      else if (item.text) parts.push(String(item.text))
      else if (item.type === 'text' && item.text) parts.push(String(item.text))
    }
    return parts.join('\n')
  }
  if (content.text) return String(content.text)
  try {
    return JSON.stringify(content)
  } catch (e) {
    return ''
  }
}

function formatSearchDigest(rawText) {
  let text = (rawText || '').trim()
  if (!text) return ''
  let parsed = null
  try {
    parsed = JSON.parse(text)
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch (e2) {
        // keep string
      }
    }
  } catch (e) {
    return text.slice(0, 2500)
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.search_result)
      ? parsed.search_result
      : parsed && Array.isArray(parsed.results)
        ? parsed.results
        : null
  if (!list || !list.length) {
    return text.slice(0, 2500)
  }
  const lines = []
  const n = Math.min(list.length, 5)
  for (let i = 0; i < n; i++) {
    const row = list[i] || {}
    const title = row.title || row.name || ''
    const link = row.link || row.url || ''
    const snippet = row.content || row.snippet || row.summary || ''
    const site = row.media || row.siteName || row.site || ''
    let line = i + 1 + '. ' + title
    if (site) line += '（' + site + '）'
    if (snippet) line += '：' + String(snippet).slice(0, 180)
    if (link) line += ' ' + link
    lines.push(line)
  }
  return lines.join('\n')
}

async function fetchWebSearchDigest(apiKey, query) {
  const q = String(query || '').trim().slice(0, 120)
  if (!q) return ''

  const initRes = await mcpPost(
    apiKey,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'hqq-zhipuChat', version: '1.0.0' },
      },
    },
    '',
    10000
  )
  const sessionId = initRes.sessionId
  if (!sessionId) return ''

  try {
    await mcpPost(
      apiKey,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      sessionId,
      5000
    )
  } catch (e) {
    // 通知失败不阻断
  }

  const toolNames = ['webSearchPrime', 'web_search_prime']
  for (let t = 0; t < toolNames.length; t++) {
    const callRes = await mcpPost(
      apiKey,
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: toolNames[t],
          arguments: { search_query: q },
        },
      },
      sessionId,
      12000
    )
    const result = callRes.data && callRes.data.result
    if (!result || result.isError) continue
    const digest = formatSearchDigest(unwrapSearchText(result.content))
    if (digest) return digest
  }
  return ''
}

function normalizeMessages(raw, allowEmptyUser) {
  if (!raw || !raw.length) return []
  const out = []
  const max = Math.min(raw.length, 24)
  const start = raw.length > max ? raw.length - max : 0
  for (let i = start; i < raw.length; i++) {
    const m = raw[i]
    if (!m) continue
    const role = m.role === 'assistant' || m.role === 'user' ? m.role : ''
    const content = m.content != null ? String(m.content).trim() : ''
    if (!role) continue
    if (!content) {
      if (allowEmptyUser && role === 'user' && i === raw.length - 1) {
        out.push({ role: role, content: '' })
      }
      continue
    }
    if (content.length > 4000) {
      out.push({ role: role, content: content.slice(0, 4000) })
    } else {
      out.push({ role: role, content: content })
    }
  }
  return out
}

function buildMessagesForModel(messages, imageBase64, imageMime) {
  const list = messages || []
  if (!imageBase64) return list
  const out = []
  for (let i = 0; i < list.length; i++) out.push(list[i])
  if (!out.length) return out
  const lastIdx = out.length - 1
  const last = out[lastIdx]
  if (!last || last.role !== 'user') return list
  const userText = (last.content || '').trim()
  const mime = imageMime || 'image/jpeg'
  const dataUrl = 'data:' + mime + ';base64,' + imageBase64
  out[lastIdx] = {
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: dataUrl } },
      {
        type: 'text',
        text: userText || '请结合图片回答',
      },
    ],
  }
  return out
}

function buildSystemPrompt(searchDigest, twinOpts) {
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
        twin.styleText + '\n'
    }
  }
  if (searchDigest) {
    s +=
      '\n以下为联网检索摘要，回答时优先依据并标明来源；摘要不足时说明不确定：\n' +
      searchDigest
  }
  return s
}

exports.main = async (event) => {
  const apiKey = process.env.ZHIPU_API_KEY || ''
  if (!apiKey) {
    return { ok: false, message: '未配置 ZHIPU_API_KEY' }
  }

  const mode = (event && event.mode) || ''
  const twinOpts = {
    mode: mode,
    personaText: event && event.personaText ? String(event.personaText).slice(0, 6000) : '',
    statusText: event && event.statusText ? String(event.statusText).slice(0, 3000) : '',
    memoryDigest:
      event && event.memoryDigest ? String(event.memoryDigest).slice(0, 6000) : '',
    avatarDesc: event && event.avatarDesc ? String(event.avatarDesc).slice(0, 1000) : '',
    styleText: event && event.styleText ? String(event.styleText).slice(0, 2000) : '',
  }

  const imageBase64 =
    event && event.imageBase64 != null ? String(event.imageBase64).trim() : ''
  const imageMime =
    (event && event.imageMime) || 'image/jpeg'
  const hasImage = imageBase64.length > 0
  if (imageBase64.length > 4000000) {
    return { ok: false, message: '图片过大，请换一张或裁剪后再试' }
  }

  let messages = normalizeMessages(event && event.messages, hasImage)
  if (!messages.length && hasImage) {
    messages = [{ role: 'user', content: '' }]
  }
  if (!messages.length) {
    return { ok: false, message: '请输入内容' }
  }

  const last = messages[messages.length - 1]
  if (last.role !== 'user') {
    return { ok: false, message: '最后一条须为用户消息' }
  }

  const textForSearch = (last.content || '').trim()
  let searchDigest = ''
  // 分身模式默认不联网，避免口吻被新闻带跑；问时效时仍可检索
  if (textForSearch && TIME_SENSITIVE_RE.test(textForSearch)) {
    try {
      searchDigest = await fetchWebSearchDigest(apiKey, textForSearch)
    } catch (e) {
      searchDigest = ''
    }
  }

  try {
    const chatMsgs = buildMessagesForModel(messages, imageBase64, imageMime)
    const data = await postChat(
      {
        model: MODEL,
        messages: [{ role: 'system', content: buildSystemPrompt(searchDigest, twinOpts) }].concat(
          chatMsgs
        ),
        thinking: { type: 'enabled' },
        reasoning_effort: 'low',
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
    const msg = (err && err.message) || '对话服务异常'
    // 联网摘要偶发触发安全审核：去掉摘要再试一次
    if (searchDigest && /敏感|不安全|安全|审核|content/i.test(msg)) {
      try {
        const chatMsgs = buildMessagesForModel(messages, imageBase64, imageMime)
        const data = await postChat(
          {
            model: MODEL,
            messages: [{ role: 'system', content: buildSystemPrompt('', twinOpts) }].concat(
              chatMsgs
            ),
            thinking: { type: 'enabled' },
            reasoning_effort: 'low',
          },
          apiKey
        )
        const choice = data && data.choices && data.choices[0]
        const reply =
          choice && choice.message && choice.message.content
            ? String(choice.message.content).trim()
            : ''
        if (reply) return { ok: true, reply: reply }
      } catch (err2) {
        return {
          ok: false,
          message: friendlySafetyMessage((err2 && err2.message) || msg),
          code: 'CONTENT_FILTER',
        }
      }
    }
    return {
      ok: false,
      message: friendlySafetyMessage(msg),
      code: /敏感|不安全|安全|审核|content/i.test(msg) ? 'CONTENT_FILTER' : '',
    }
  }
}

function friendlySafetyMessage(msg) {
  const s = String(msg || '')
  if (/敏感|不安全|安全|审核|content/i.test(s)) {
    return '内容未通过安全审核，请换个说法，或切换到 MiniMax 再试'
  }
  return s || '对话服务异常'
}
