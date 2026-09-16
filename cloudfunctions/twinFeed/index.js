/**
 * 分身投喂：资料解析 + AI 消化
 *
 * 入参：{ text?, fileID? } 二选一（文件/图片走 fileID 云存储）
 * 出参：{ ok, chars, summary } 或 { ok:false, message }
 * 密钥复用环境变量 ZHIPU_API_KEY；文本 glm-5.3，图片 glm-5.3-flash（视觉）
 */
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MODEL = 'glm-5.3'
/** glm-5.3 不收 image_url（content 仅允许 text），图片消化走同通道的 flash 视觉 */
const VISION_MODEL = 'glm-5.3-flash'
const API_HOST = 'open.bigmodel.cn'
const API_PATH = '/api/coding/paas/v4/chat/completions'

const MAX_LLM_CHARS = 30000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MIN_TEXT_CHARS = 20

const SYSTEM_DIGEST =
  '你是数字分身的消化系统。把投喂的资料提炼成它的长期记忆：' +
  '第一句概括资料讲什么，随后列 3-6 条关键要点（人物/数字/结论/偏好等硬信息优先）。' +
  '全文不超过 300 字，直接输出内容本身，不要客套话，不要 Markdown 符号。'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'log', 'srt']

function extOf(name) {
  const s = String(name || '')
  const at = s.lastIndexOf('.')
  if (at < 0) return ''
  return s.slice(at + 1).toLowerCase()
}

/** cloud://env.bucket/path/name.ext → name.ext */
function nameFromFileID(fileID) {
  const s = String(fileID || '')
  const at = s.lastIndexOf('/')
  const raw = at >= 0 ? s.slice(at + 1) : s
  try {
    return decodeURIComponent(raw)
  } catch (e) {
    return raw
  }
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
          text: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs || 55000, () => req.destroy(new Error('请求超时')))
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

function digestViaLlm(userContent, apiKey, model) {
  return postChat(
    {
      model: model || MODEL,
      messages: [
        { role: 'system', content: SYSTEM_DIGEST },
        { role: 'user', content: userContent },
      ],
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
    },
    apiKey
  ).then((data) => {
    const choice = data && data.choices && data.choices[0]
    const reply =
      choice && choice.message && choice.message.content
        ? String(choice.message.content).trim()
        : ''
    if (!reply) throw new Error('模型未返回内容')
    return reply
  })
}

async function extractText(buffer, ext) {
  if (TEXT_EXTS.indexOf(ext) >= 0) return buffer.toString('utf8')
  if (ext === 'pdf') {
    // 直连内部入口，绕开 pdf-parse 顶层的调试分支
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(buffer)
    return (data && data.text) || ''
  }
  if (ext === 'docx') {
    const mammoth = require('mammoth')
    const res = await mammoth.extractRawText({ buffer: buffer })
    return (res && res.value) || ''
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = require('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const parts = []
    for (let i = 0; i < wb.SheetNames.length; i++) {
      const name = wb.SheetNames[i]
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
      if (csv) parts.push('[' + name + ']\n' + csv)
    }
    return parts.join('\n\n')
  }
  return null
}

exports.main = async (event) => {
  const apiKey = process.env.ZHIPU_API_KEY || ''
  if (!apiKey) {
    return { ok: false, message: '未配置 ZHIPU_API_KEY' }
  }

  const text = event && event.text ? String(event.text).trim() : ''
  const fileID = event && event.fileID ? String(event.fileID) : ''
  if (!text && !fileID) {
    return { ok: false, message: '没有可投喂的内容' }
  }

  try {
    if (text) {
      if (text.length < 10) return { ok: false, message: '内容太短，喂不饱' }
      const raw = text.slice(0, MAX_LLM_CHARS)
      const summary = await digestViaLlm(raw, apiKey)
      return { ok: true, chars: raw.length, summary: summary, sourceType: 'text' }
    }

    const dl = await cloud.downloadFile({ fileID: fileID })
    const buffer = dl && dl.fileContent
    if (!buffer || !buffer.length) {
      return { ok: false, message: '文件下载失败' }
    }

    const ext = extOf(nameFromFileID(fileID))

    if (IMAGE_EXTS.indexOf(ext) >= 0) {
      if (buffer.length > MAX_IMAGE_BYTES) {
        return { ok: false, message: '图片过大（需<4MB）' }
      }
      const mime = ext === 'jpg' ? 'jpeg' : ext
      const dataUrl = 'data:image/' + mime + ';base64,' + buffer.toString('base64')
      const summary = await digestViaLlm(
        [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: '请消化这张图片里的资料。' },
        ],
        apiKey,
        VISION_MODEL
      )
      return { ok: true, chars: summary.length, summary: summary, sourceType: 'image' }
    }

    const rawAll = await extractText(buffer, ext)
    if (rawAll === null) {
      return {
        ok: false,
        message: '暂不支持 .' + (ext || '未知') + ' 类型（支持 txt/pdf/docx/xlsx/图片）',
      }
    }
    const raw = String(rawAll).replace(/\u0000/g, ' ').trim()
    if (raw.length < MIN_TEXT_CHARS) {
      return { ok: false, message: '没能提取出文字（可能是扫描件或空文件）' }
    }
    const summary = await digestViaLlm(raw.slice(0, MAX_LLM_CHARS), apiKey)
    return { ok: true, chars: raw.length, summary: summary, sourceType: 'file' }
  } catch (err) {
    const msg = (err && err.message) || '消化失败'
    return { ok: false, message: String(msg).slice(0, 60) }
  }
}
