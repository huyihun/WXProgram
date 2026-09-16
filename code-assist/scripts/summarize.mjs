/**
 * 小黑：本机深读摘要（由 code-assist:publish 调用）
 *
 * 用法：
 *   export ZHIPU_API_KEY=...
 *   npm run code-assist:summarize -- ./xiaohei-pack.json
 */
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = path.resolve(__dirname, '..')

const MODEL = 'glm-5.3'
const API_HOST = 'open.bigmodel.cn'
const API_PATH = '/api/coding/paas/v4/chat/completions'
const BATCH_CHARS = 70000
const GLM_TIMEOUT_MS = 120000

function postChat(body, apiKey, timeoutMs) {
  const payload = JSON.stringify(body)
  return new Promise(function (resolve, reject) {
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
      function (res) {
        const chunks = []
        res.on('data', function (c) {
          chunks.push(c)
        })
        res.on('end', function () {
          let data = null
          try {
            data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch (e) {
            reject(new Error('智谱返回解析失败'))
            return
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const msg =
              (data && data.error && data.error.message) ||
              (data && data.msg) ||
              '智谱请求失败(' + res.statusCode + ')'
            reject(new Error(msg))
            return
          }
          resolve(data)
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs || GLM_TIMEOUT_MS, function () {
      req.destroy(new Error('智谱接口超时'))
    })
    req.write(payload)
    req.end()
  })
}

function chatText(apiKey, system, user) {
  return postChat(
    {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
    },
    apiKey,
    GLM_TIMEOUT_MS
  ).then(function (data) {
    const choice = data && data.choices && data.choices[0]
    const reply =
      choice && choice.message && choice.message.content
        ? String(choice.message.content).trim()
        : ''
    if (!reply) throw new Error('模型未返回内容')
    return reply
  })
}

function topDir(rel) {
  const i = String(rel || '').indexOf('/')
  if (i < 0) return '_root'
  return rel.slice(0, i)
}

function packBatch(files, maxChars) {
  let buf = ''
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    let body = f.content || ''
    if (body.length > 35000) body = body.slice(0, 35000) + '\n/* truncated */\n'
    const block = '\n===== FILE: ' + f.path + ' =====\n' + body + '\n'
    if (buf.length + block.length > maxChars) break
    buf += block
  }
  return buf
}

function parseArgs(argv) {
  let packPath = ''
  let outPath = ''
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-o' || a === '--out') {
      outPath = argv[i + 1] || ''
      i++
      continue
    }
    if (a.indexOf('-') === 0) continue
    if (!packPath) packPath = a
  }
  return { packPath: packPath, outPath: outPath }
}

async function main() {
  const apiKey = process.env.ZHIPU_API_KEY || ''
  if (!apiKey) {
    console.error('请设置环境变量 ZHIPU_API_KEY')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const packPath = path.resolve(args.packPath || path.join(TOOL_ROOT, 'xiaohei-pack.json'))
  if (!fs.existsSync(packPath)) {
    console.error('找不到 pack：' + packPath)
    process.exit(1)
  }

  console.log('读取 pack：' + packPath)
  const data = JSON.parse(fs.readFileSync(packPath, 'utf8'))
  const collected = (data && data.files) || []
  const skippedPaths = Array.isArray(data.skipped) ? data.skipped : []
  if (!collected.length) {
    console.error('pack 内无 files')
    process.exit(1)
  }

  const treeText = data.fullTreeText || data.treeText || collected.map(function (f) {
    return f.path
  }).sort().join('\n')

  let groupKeys = data.groupKeys
  if (!groupKeys || !groupKeys.length) {
    const topSet = {}
    for (let i = 0; i < collected.length; i++) {
      topSet[topDir(collected[i].path)] = 1
    }
    groupKeys = Object.keys(topSet).sort()
  }

  const maxGroups = Math.min(groupKeys.length, 10)
  const totalSteps = maxGroups + 2
  const parts = []

  console.log(
    '正文 ' +
      collected.length +
      ' · 顶层目录 ' +
      groupKeys.length +
      '（深读 ' +
      maxGroups +
      '）· 共约 ' +
      totalSteps +
      ' 步'
  )

  // 总览
  console.log('[1/' + totalSteps + '] 总览…')
  const keyNames = {
    'package.json': 1,
    'pages.json': 1,
    'manifest.json': 1,
    'project.config.json': 1,
    'README.md': 1,
    'readme.md': 1,
    'App.vue': 1,
    'main.js': 1,
    'main.ts': 1,
  }
  const keyFiles = collected.filter(function (f) {
    const base = f.path.split('/').pop()
    return keyNames[base] || keyNames[f.path]
  })
  let outline = '（无关键配置文件）'
  if (keyFiles.length) {
    const packed = packBatch(keyFiles, BATCH_CHARS)
    outline = await chatText(
      apiKey,
      '你是资深代码架构师。根据目录与关键配置，用中文写项目大纲：技术栈、目录职责、入口、云能力。准确优先，勿编造未给出的文件。',
      '目录树（可能截断）：\n' +
        treeText.slice(0, 10000) +
        '\n\n关键文件：\n' +
        packed
    )
  }
  parts.push('## 总览\n' + outline)

  // 各模块
  for (let g = 0; g < maxGroups; g++) {
    const key = groupKeys[g]
    console.log('[' + (g + 2) + '/' + totalSteps + '] 模块 ' + key + '…')
    const list = collected.filter(function (f) {
      return topDir(f.path) === key
    })
    const packed = packBatch(list, BATCH_CHARS)
    let part = '（该模块无文本）'
    if (packed) {
      part = await chatText(
        apiKey,
        '你是资深工程师。准确总结该模块源码：职责、关键文件、数据流、易错点。只依据给出的源码，未出现的实现不要臆造。',
        '模块：' + key + '\n' + packed
      )
    }
    parts.push('## 模块 ' + key + '\n' + part)
  }

  if (groupKeys.length > maxGroups) {
    parts.push('## 未深读顶层目录\n' + groupKeys.slice(maxGroups).join(', '))
  }
  if (skippedPaths.length) {
    parts.push('## 未入库全文路径（节选）\n' + skippedPaths.slice(0, 40).join('\n'))
  }

  // 合并
  console.log('[' + totalSteps + '/' + totalSteps + '] 合并 PROJECT_BRIEF…')
  let finalBrief = parts.join('\n\n')
  try {
    finalBrief = await chatText(
      apiKey,
      '你是资深架构师。把多段模块摘要合并为一份高保真 PROJECT_BRIEF（Markdown）：项目定位、技术栈、目录地图、核心模块、云函数/集合、排查入口建议、已知缺口。准确优先，保留具体路径。',
      finalBrief.slice(0, 90000)
    )
  } catch (e) {
    console.warn('合并失败，保留分段：' + ((e && e.message) || e))
  }

  const brief = {
    version: 2,
    kind: 'brief',
    source: data.source || '',
    createdAt: Date.now(),
    packCreatedAt: data.createdAt || 0,
    fileCount: data.fileCount != null ? data.fileCount : collected.length,
    pathCount: data.pathCount != null ? data.pathCount : 0,
    groupKeys: groupKeys,
    treeText: treeText,
    fullTreeText: treeText,
    parts: parts,
    content: finalBrief,
    stats: data.stats || null,
  }

  let outPath = args.outPath
  if (!outPath) {
    const dir = path.dirname(packPath)
    const base = path.basename(packPath, path.extname(packPath))
    outPath =
      base.toLowerCase() === 'xiaohei-pack'
        ? path.join(dir, 'xiaohei-brief.json')
        : path.join(dir, base + '-brief.json')
  } else {
    outPath = path.resolve(outPath)
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(brief), 'utf8')
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1)
  console.log('已写出 brief：' + outPath + '（约 ' + kb + ' KB）')
  console.log('下一步：npm run code-assist:publish -- --reuse-brief')
}

main().catch(function (e) {
  console.error((e && e.message) || e)
  process.exit(1)
})
