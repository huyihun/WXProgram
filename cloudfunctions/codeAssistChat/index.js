/**
 * 小黑排查（唯一云函数）：检索选文件 + 单次 GLM
 * 环境变量：ZHIPU_API_KEY（Coding Plan）
 * 入参：{ projectId, messages, imageCdn?, imageMime?, imageBase64? }
 * 索引请用本机 npm run code-assist:publish（勿再部署 Summarize/Ingest）
 */
const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COL = 'code_assist'
const MODEL = 'glm-5.3-flash'
const API_HOST = 'open.bigmodel.cn'
const API_PATH = '/api/coding/paas/v4/chat/completions'

// 单次调用预算：下载+组包留余量，模型 ~42s（适配云函数 60s）
const GLM_TIMEOUT_MS = 42000
/** 客户端 base64 上限（约 3MB 原图；CDN 下载同样限制） */
const MAX_IMAGE_BASE64_LEN = 4000000
const MAX_IMAGE_BYTES = 3145728
const IMAGE_DOWNLOAD_TIMEOUT_MS = 8000
const MAX_FILES = 160
const MAX_PER_FILE = 40000
const MAX_SOURCE_TOTAL = 400000
const MAX_BRIEF = 14000
const MAX_TREE = 16000
const SIBLING_EXTRA = 48
/** 单个热模块最多补邻居数，避免 src/components 一类巨目录占满名额 */
const MAX_PER_MODULE = 100
/** import 跟随扩选轮数 */
const IMPORT_EXPAND_ROUNDS = 3

/** 过粗前缀：禁止整目录灌满 */
const NO_FLOOD_PREFIX = {
  src: 1,
  lib: 1,
  static: 1,
  doc: 1,
  build: 1,
  typings: 1,
  'src/components': 1,
  'src/mock': 1,
  'lib-router': 1,
}

// 过短/无检索价值的中文片（n-gram 过滤）
const ZH_STOP = {
  一下: 1,
  给我: 1,
  什么: 1,
  怎么: 1,
  如何: 1,
  是否: 1,
  可以: 1,
  进行: 1,
  这个: 1,
  那个: 1,
  一个: 1,
  没有: 1,
  不是: 1,
  我们: 1,
  你们: 1,
  他们: 1,
  整理: 1,
  一下: 1,
  相关: 1,
  问题: 1,
  帮忙: 1,
  看看: 1,
  说说: 1,
  一下: 1,
}

/**
 * 中文业务词 → 路径片段。由 publish 写入 kind=aliases，对话时加载。
 * 本地兜底仅保留极少量通用词，业务模块以库表为准。
 */
const FALLBACK_ALIAS_GROUPS = [
  {
    zh: ['登录', '鉴权', 'token'],
    en: ['login', 'auth', 'token', 'session'],
  },
  {
    zh: ['云函数', 'rpc'],
    en: ['cloudfunctions', 'rpc', 'rpchook', 'bridge'],
  },
]

let ALIAS_GROUPS = FALLBACK_ALIAS_GROUPS.slice()

const MAX_RULES = 8000

const OUTPUT_SKELETON =
  '根据下列项目简报与源码回答用户关于本仓库的问题；依据给出的材料作答，勿编造未出现的实现。'

const CANCEL_POLL_MS = 400

async function isCancelled(requestId, openid) {
  if (!requestId) return false
  const res = await db
    .collection(COL)
    .where({
      kind: 'cancel',
      requestId: requestId,
      _openid: openid,
    })
    .limit(1)
    .get()
  return !!(res.data && res.data.length)
}

async function setCancelFlag(requestId, openid) {
  if (!requestId) return
  if (await isCancelled(requestId, openid)) return
  await db.collection(COL).add({
    data: {
      kind: 'cancel',
      requestId: requestId,
      _openid: openid,
      createdAt: Date.now(),
    },
  })
}

async function clearCancelFlag(requestId, openid) {
  if (!requestId) return
  let skip = 0
  const BATCH = 20
  while (true) {
    const res = await db
      .collection(COL)
      .where({
        kind: 'cancel',
        requestId: requestId,
        _openid: openid,
      })
      .skip(skip)
      .limit(BATCH)
      .get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) {
      await db.collection(COL).doc(batch[i]._id).remove()
    }
    if (batch.length < BATCH) break
    skip += BATCH
  }
}

async function throwIfCancelled(requestId, openid) {
  if (await isCancelled(requestId, openid)) {
    const err = new Error('cancelled')
    err.cancelled = true
    throw err
  }
}

function postChat(body, apiKey, timeoutMs, checkCancelled) {
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    let pollTimer = null
    let settled = false

    function finish(fn, val) {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      fn(val)
    }

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
          let data = null
          try {
            data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch (e) {
            finish(reject, new Error('智谱返回解析失败'))
            return
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const msg =
              (data && data.error && data.error.message) ||
              (data && data.msg) ||
              '智谱请求失败(' + res.statusCode + ')'
            finish(reject, new Error(msg))
            return
          }
          finish(resolve, data)
        })
      }
    )
    req.on('error', (e) => finish(reject, e))
    req.setTimeout(timeoutMs || GLM_TIMEOUT_MS, () =>
      req.destroy(new Error('智谱接口超时'))
    )
    if (checkCancelled) {
      pollTimer = setInterval(function () {
        checkCancelled()
          .then(function (cancelled) {
            if (cancelled) req.destroy(new Error('cancelled'))
          })
          .catch(function () {})
      }, CANCEL_POLL_MS)
    }
    req.write(payload)
    req.end()
  })
}

function extractReply(data) {
  const choice = data && data.choices && data.choices[0]
  return choice && choice.message && choice.message.content
    ? String(choice.message.content).trim()
    : ''
}

async function fetchAllWhere(where) {
  const all = []
  let skip = 0
  const BATCH = 20
  while (true) {
    const res = await db.collection(COL).where(where).skip(skip).limit(BATCH).get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) all.push(batch[i])
    if (batch.length < BATCH) break
    skip += BATCH
  }
  return all
}

function normalizeMessages(raw, hasImage) {
  if (!raw || !raw.length) return []
  const out = []
  const max = Math.min(raw.length, 8)
  const start = raw.length > max ? raw.length - max : 0
  for (let i = start; i < raw.length; i++) {
    const m = raw[i]
    if (!m) continue
    const role = m.role === 'assistant' || m.role === 'user' ? m.role : ''
    const content = m.content != null ? String(m.content).trim() : ''
    const isLastUser = hasImage && i === raw.length - 1 && role === 'user'
    if (!role || (!content && !isLastUser)) continue
    out.push({
      role: role,
      content: content.length > 3000 ? content.slice(0, 3000) : content,
    })
  }
  return out
}

function glmChatBodyExtra() {
  return {
    thinking: { type: 'enabled' },
    reasoning_effort: 'low',
  }
}

function fetchUrlBuffer(url, timeoutMs) {
  const isHttps = url.indexOf('https://') === 0
  const isHttp = url.indexOf('http://') === 0
  if (!isHttps && !isHttp) {
    return Promise.reject(new Error('无效的图片地址'))
  }
  const client = isHttps ? https : http
  return new Promise(function (resolve, reject) {
    const req = client.get(url, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrlBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject)
        return
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error('下载截图失败(' + res.statusCode + ')'))
        return
      }
      const chunks = []
      let total = 0
      res.on('data', function (c) {
        total += c.length
        if (total > MAX_IMAGE_BYTES) {
          req.destroy()
          reject(new Error('图片过大，请换一张或裁剪后再试'))
          return
        }
        chunks.push(c)
      })
      res.on('end', function () {
        resolve(Buffer.concat(chunks))
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs || IMAGE_DOWNLOAD_TIMEOUT_MS, function () {
      req.destroy(new Error('下载截图超时'))
    })
  })
}

async function fetchCdnImage(url, timeoutMs) {
  if (url.indexOf('http://') === 0) {
    try {
      return await fetchUrlBuffer('https://' + url.slice(7), timeoutMs)
    } catch (e) {
      // 部分 CDN 仅 http，回退原地址
    }
  }
  return fetchUrlBuffer(url, timeoutMs)
}

function atRootFromFilePath(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/').toLowerCase()
  if (!p) return ''
  const mMulti = p.match(/^([a-z0-9_]+)\/src\/(?:modules\/)?([a-z0-9_]+)\//)
  if (mMulti) return mMulti[1] + '/' + mMulti[2]
  const mLegacy = p.match(/^src\/(?:modules\/)?([a-z0-9_]+)\//)
  if (mLegacy) return mLegacy[1]
  return ''
}

function suggestAtRootsFromUsedFiles(usedFiles) {
  const counts = {}
  const list = usedFiles || []
  for (let i = 0; i < list.length; i++) {
    const root = atRootFromFilePath(list[i])
    if (!root) continue
    counts[root] = (counts[root] || 0) + 1
  }
  const keys = Object.keys(counts)
  keys.sort(function (a, b) {
    return counts[b] - counts[a]
  })
  const out = []
  for (let i = 0; i < keys.length && out.length < 3; i++) {
    out.push(keys[i])
  }
  return out
}

async function resolveImageFromEvent(event) {
  const mime = event.imageMime || 'image/jpeg'
  const cdn = event.imageCdn != null ? String(event.imageCdn).trim() : ''
  if (cdn && (cdn.indexOf('http://') === 0 || cdn.indexOf('https://') === 0)) {
    try {
      const buf = await fetchCdnImage(cdn, IMAGE_DOWNLOAD_TIMEOUT_MS)
      return { base64: buf.toString('base64'), mime: mime }
    } catch (e) {
      return { error: '截图加载失败：' + ((e && e.message) || '未知错误') }
    }
  }
  const legacyBase64 =
    event.imageBase64 != null ? String(event.imageBase64).trim() : ''
  if (legacyBase64.length > MAX_IMAGE_BASE64_LEN) {
    return { error: '图片过大，请换一张或裁剪后再试' }
  }
  return { base64: legacyBase64, mime: mime }
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
        text: userText || '请结合截图和源码排查问题',
      },
    ],
  }
  return out
}

function tokenize(q) {
  const raw = String(q || '')
  const s = raw.toLowerCase()
  const parts = s.split(/[^a-z0-9_\u4e00-\u9fff./-]+/)
  const out = []
  const seen = {}
  function pushTok(t) {
    if (!t || t.length < 2) return
    if (ZH_STOP[t]) return
    if (seen[t]) return
    seen[t] = 1
    out.push(t)
  }
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i]
    if (!t) continue
    // 连续中文：2～4 字滑动窗口
    if (/^[\u4e00-\u9fff]+$/.test(t)) {
      for (let n = 4; n >= 2; n--) {
        if (t.length < n) continue
        for (let j = 0; j + n <= t.length; j++) {
          pushTok(t.slice(j, j + n))
        }
      }
      continue
    }
    // 中英混合：先抽中文子串再整段
    const zhBits = t.match(/[\u4e00-\u9fff]{2,}/g)
    if (zhBits) {
      for (let z = 0; z < zhBits.length; z++) {
        const zb = zhBits[z]
        for (let n = Math.min(4, zb.length); n >= 2; n--) {
          for (let j = 0; j + n <= zb.length; j++) {
            pushTok(zb.slice(j, j + n))
          }
        }
      }
    }
    pushTok(t)
  }
  // 别名表里的整词若出现在原文，强制加入（如「预约取号」）
  for (let g = 0; g < ALIAS_GROUPS.length; g++) {
    const zh = (ALIAS_GROUPS[g] && ALIAS_GROUPS[g].zh) || []
    for (let i = 0; i < zh.length; i++) {
      if (raw.indexOf(zh[i]) >= 0) pushTok(zh[i])
    }
  }
  return out
}

/** 中文业务词扩成英文路径 token */
function expandAliasTokens(query) {
  const q = String(query || '')
  const qLower = q.toLowerCase()
  const tokens = tokenize(q)
  const extra = []
  const seen = {}
  for (let g = 0; g < ALIAS_GROUPS.length; g++) {
    const group = ALIAS_GROUPS[g] || {}
    const zhList = group.zh || []
    const enList = group.en || []
    if (!zhList.length && !enList.length) continue
    let hit = false
    for (let i = 0; i < zhList.length; i++) {
      if (q.indexOf(zhList[i]) >= 0) {
        hit = true
        break
      }
    }
    if (!hit) {
      for (let i = 0; i < tokens.length; i++) {
        for (let j = 0; j < zhList.length; j++) {
          if (tokens[i] === zhList[j] || zhList[j].indexOf(tokens[i]) >= 0) {
            if (tokens[i].length >= 2) {
              hit = true
              break
            }
          }
        }
        if (hit) break
      }
    }
    if (!hit) {
      for (let i = 0; i < enList.length; i++) {
        if (qLower.indexOf(enList[i]) >= 0) {
          hit = true
          break
        }
      }
    }
    if (!hit) continue
    for (let i = 0; i < enList.length; i++) {
      const en = enList[i]
      if (seen[en]) continue
      seen[en] = 1
      extra.push(en)
    }
  }
  return extra
}

/** 从 @src/.../file.vue 提取文件级引用 */
function extractAtFiles(query) {
  const q = String(query || '')
  const out = []
  const seen = {}
  const re =
    /@((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:vue|js|ts|tsx|jsx|json|md)|[A-Za-z0-9_.-]+\.(?:vue|js|ts|tsx|jsx|json|md))/g
  let m
  while ((m = re.exec(q))) {
    const p = String(m[1] || '').replace(/^\/+/, '')
    if (!p || seen[p]) continue
    seen[p] = 1
    out.push(p)
  }
  return out
}

/** 把 @file 路径对齐到 fileMetas 里的真实 path */
function resolveAtFiles(atFiles, fileMetas) {
  const pathSet = {}
  for (let i = 0; i < fileMetas.length; i++) {
    const p = fileMetas[i].path || fileMetas[i]
    if (p) pathSet[p] = 1
  }
  const out = []
  const seen = {}
  for (let i = 0; i < atFiles.length; i++) {
    const c = atFiles[i]
    if (!c || seen[c]) continue
    if (pathSet[c]) {
      seen[c] = 1
      out.push(c)
      continue
    }
    const keys = Object.keys(pathSet)
    for (let k = 0; k < keys.length; k++) {
      const p = keys[k]
      if (p === c || p.slice(-c.length) === c || p.indexOf(c) >= 0) {
        if (!seen[p]) {
          seen[p] = 1
          out.push(p)
        }
        break
      }
    }
  }
  return out
}

/** 从 @root 提取模块限定（如 @ghb_account_book、@uniapp/ghb_deposit）；先剥掉 @file 避免 @src 误判 */
function extractAtRoots(query) {
  let q = String(query || '')
  const files = extractAtFiles(q)
  for (let i = 0; i < files.length; i++) {
    q = q.split('@' + files[i]).join(' ')
  }
  const out = []
  const seen = {}
  const reSlash = /@([a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)+)/g
  let m
  while ((m = reSlash.exec(q))) {
    const r = m[1].toLowerCase()
    if (!r || seen[r]) continue
    seen[r] = 1
    out.push(r)
  }
  const re = /@([a-zA-Z0-9_]+)/g
  while ((m = re.exec(q))) {
    const r = m[1].toLowerCase()
    if (!r || seen[r]) continue
    // 纯扩展名/常见目录名不算模块
    if (r === 'src' || r === 'lib' || r === 'pages' || r === 'api') continue
    let skip = false
    const keys = Object.keys(seen)
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(r + '/') === 0) {
        skip = true
        break
      }
    }
    if (skip) continue
    seen[r] = 1
    out.push(r)
  }
  return out
}

function pathMatchesAtRoot(filePath, root) {
  const r = String(root || '').toLowerCase()
  if (!r) return false
  const p = String(filePath || '').toLowerCase().replace(/\\/g, '/')
  // uni 分包 root（如 pages/payroll）→ src/pages/payroll/...
  if (p === r || p === 'src/' + r) return true
  if (p.indexOf(r + '/') === 0 || p.indexOf('src/' + r + '/') === 0) return true
  if (p.indexOf('/' + r + '/') >= 0) return true

  if (r.indexOf('/') >= 0) {
    const slash = r.indexOf('/')
    const key = r.slice(0, slash)
    const mod = r.slice(slash + 1)
    // pages/views/modules 是路径段，不是多源 key
    const uniSeg = { pages: 1, views: 1, modules: 1 }
    if (uniSeg[key]) {
      const pref = modulePrefix(filePath).toLowerCase()
      if (pref === 'src/' + r) return true
      return false
    }
    if (p.indexOf(key + '/src/' + mod + '/') >= 0) return true
    if (p.indexOf(key + '/src/modules/' + mod + '/') >= 0) return true
    if (p.indexOf(key + '/src/views/' + mod + '/') >= 0) return true
    if (p.indexOf(key + '/src/pages/' + mod + '/') >= 0) return true
    const pref = modulePrefix(filePath).toLowerCase()
    if (pref === key + '/src/' + mod) return true
    if (pref === key + '/src/modules/' + mod) return true
    if (pref === key + '/src/views/' + mod) return true
    if (pref === key + '/src/pages/' + mod) return true
    if (pref === key + '/' + mod) return true
    return false
  }
  const pref = modulePrefix(filePath).toLowerCase()
  if (pref === 'src/' + r) return true
  return p.indexOf('/' + r + '/') >= 0 || p.indexOf('src/' + r + '/') === 0
}

/** 从用户话里抠出像路径的片段，强制置顶 */
function extractMentionedPaths(query, fileMetas) {
  const q = String(query || '')
  const pathSet = {}
  for (let i = 0; i < fileMetas.length; i++) {
    const p = fileMetas[i].path || fileMetas[i]
    if (p) pathSet[p] = 1
  }
  const candidates = []
  const re =
    /(?:^|[\s`'"(，,：:])([a-zA-Z0-9_.@/-]+\.(?:ts|js|vue|tsx|jsx|json|md))/g
  let m
  while ((m = re.exec(q))) {
    if (m[1]) candidates.push(m[1].replace(/^[@\/]+/, ''))
  }
  const libRe =
    /(?:^|[\s`'"(，,：:])((?:lib|src|pages|cloudfunctions|api)\/[a-zA-Z0-9_./-]+)/g
  while ((m = libRe.exec(q))) {
    if (m[1]) candidates.push(m[1].replace(/^[@\/]+/, ''))
  }

  const out = []
  const seen = {}
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (seen[c]) continue
    if (pathSet[c]) {
      seen[c] = 1
      out.push(c)
      continue
    }
    const keys = Object.keys(pathSet)
    for (let k = 0; k < keys.length; k++) {
      const p = keys[k]
      if (p === c || p.slice(-c.length) === c || p.indexOf(c) >= 0) {
        if (!seen[p]) {
          seen[p] = 1
          out.push(p)
        }
        break
      }
    }
  }
  return out
}

function topDir(rel) {
  const i = String(rel || '').indexOf('/')
  if (i < 0) return '_root'
  return rel.slice(0, i)
}

/** 父目录（posix），如 src/ghb_foo/pages/a.vue → src/ghb_foo/pages */
function dirOf(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/')
  const i = p.lastIndexOf('/')
  if (i <= 0) return ''
  return p.slice(0, i)
}

function modulePrefixInner(parts) {
  if (!parts.length) return '_root'
  if (parts[0] === 'src' && parts[1] === 'components' && parts.length >= 3) {
    return 'src/components/' + parts[2]
  }
  if (parts[0] === 'src' && parts[1] && parts[1].indexOf('ghb_') === 0) {
    return 'src/' + parts[1]
  }
  // 旧架构 mobile-bank：src/modules/ghb_fund/... → 按离线包切 shard
  if (parts[0] === 'src' && parts[1] === 'modules' && parts[2]) {
    return 'src/modules/' + parts[2]
  }
  // wxbank 等：src/pages/payroll/... → src/pages/payroll
  if (parts[0] === 'src' && parts[1] === 'pages' && parts[2]) {
    return 'src/pages/' + parts[2]
  }
  if (parts[0] === 'src' && parts[1] === 'views' && parts[2]) {
    return 'src/views/' + parts[2]
  }
  if (
    (parts[0] === 'src' || parts[0] === 'lib' || parts[0] === 'cloudfunctions') &&
    parts.length >= 2
  ) {
    return parts[0] + '/' + parts[1]
  }
  return parts[0]
}

/**
 * 业务模块前缀：
 * - src/ghb_xxx/... → src/ghb_xxx
 * - uniapp/src/ghb_xxx/... → uniapp/src/ghb_xxx（多源合并）
 */
function modulePrefix(rel) {
  const parts = String(rel || '').split('/').filter(Boolean)
  if (!parts.length) return '_root'
  const knownRoots = { src: 1, lib: 1, cloudfunctions: 1, pages: 1 }
  let offset = 0
  let prefix = ''
  if (parts[0] && !knownRoots[parts[0]] && parts.length >= 2) {
    prefix = parts[0] + '/'
    offset = 1
  }
  const rest = parts.slice(offset)
  if (!rest.length) return prefix.slice(0, -1) || '_root'
  return prefix + modulePrefixInner(rest)
}

function canFloodModule(pref) {
  if (!pref || pref === '_root') return false
  if (NO_FLOOD_PREFIX[pref]) return false
  // 仅两段且第二段是巨型桶
  if (pref === 'src/components' || pref === 'src/mock') return false
  return true
}

/** 热模块内灌入排序：检索分 + api/hooks；别名只匹配模块前缀之后的路径 */
function floodRank(filePath, scoreByPath, aliasTokens, modulePref) {
  const p = String(filePath || '').toLowerCase()
  let rank = (scoreByPath && scoreByPath[filePath]) || 0
  if (/api\.js$/i.test(p)) rank += 50
  if (/\/hooks\//.test(p)) rank += 28
  if (/service/.test(p)) rank += 12

  let suffix = p
  const pref = String(modulePref || '').toLowerCase()
  if (pref && p.indexOf(pref + '/') === 0) {
    suffix = p.slice(pref.length)
  } else if (pref && p === pref) {
    suffix = ''
  }

  if (aliasTokens && aliasTokens.length && suffix) {
    let bestAlias = 0
    for (let i = 0; i < aliasTokens.length; i++) {
      const a = String(aliasTokens[i] || '').toLowerCase()
      if (!a || a.length < 3 || suffix.indexOf(a) < 0) continue
      const boost = 30 + Math.min(a.length, 24)
      if (boost > bestAlias) bestAlias = boost
    }
    rank += bestAlias
  }
  // 页面/接口略优先于纯展示组件
  if (/\.(vue|js|ts)$/.test(p) && p.indexOf('/components/') < 0 && p.indexOf('/component/') < 0) {
    rank += 8
  }
  return rank
}

function pathSegments(filePath) {
  const p = String(filePath || '').toLowerCase()
  const segs = []
  const slash = p.split('/')
  for (let i = 0; i < slash.length; i++) {
    const s = slash[i]
    if (!s) continue
    segs.push(s)
    const und = s.split(/[_-]/)
    for (let j = 0; j < und.length; j++) {
      if (und[j] && und[j].length >= 2) segs.push(und[j])
    }
  }
  return segs
}

function scorePath(filePath, tokens, query, aliasTokens, boostDirs) {
  const p = String(filePath || '').toLowerCase()
  const segs = pathSegments(filePath)
  let score = 0
  if (query && query.indexOf(filePath) >= 0) score += 120
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.length < 2) continue
    // 中文 token 很少出现在路径里，跳过以免噪声
    if (/^[\u4e00-\u9fff]+$/.test(t)) continue
    if (p.indexOf(t.toLowerCase()) >= 0) score += 8
    for (let s = 0; s < segs.length; s++) {
      if (segs[s] === t.toLowerCase() || segs[s].indexOf(t.toLowerCase()) >= 0) score += 10
    }
  }
  for (let i = 0; i < aliasTokens.length; i++) {
    const a = aliasTokens[i]
    if (p.indexOf(a) >= 0) score += 28
    for (let s = 0; s < segs.length; s++) {
      if (segs[s] === a || segs[s].indexOf(a) >= 0) score += 16
    }
  }
  if (boostDirs && boostDirs.length) {
    const pref = modulePrefix(filePath).toLowerCase()
    for (let i = 0; i < boostDirs.length; i++) {
      const b = String(boostDirs[i]).toLowerCase()
      if (pref === b || pref.indexOf(b) >= 0 || p.indexOf(b) >= 0) {
        score += 18
        break
      }
    }
  }
  if (/api\.js$/i.test(p)) score += 15
  if (/\/hooks\//.test(p)) score += 10
  if (/\.(vue|js|ts)$/.test(p)) score += 1
  if (/cloudfunctions|api\/|pages\/|lib\/state/.test(p)) score += 2
  return score
}

/** 正文命中：中文词 / 别名英文 / 交易码 */
function scoreContent(content, searchTerms) {
  const c = String(content || '')
  if (!c || !searchTerms || !searchTerms.length) return 0
  let score = 0
  const hit = {}
  for (let i = 0; i < searchTerms.length; i++) {
    const t = searchTerms[i]
    if (!t || t.length < 2 || hit[t]) continue
    if (c.indexOf(t) < 0) continue
    hit[t] = 1
    if (/^NMBMPSX\d+/i.test(t) || /^[A-Za-z]{2,}\d{3,}$/.test(t)) {
      score += 80
    } else if (/^[\u4e00-\u9fff]+$/.test(t)) {
      score += t.length >= 4 ? 50 : 35
    } else {
      score += 18
    }
  }
  return score
}

/** 抽出交易码 / 长字母数字串，增强正文命中 */
function extractCodeTokens(query) {
  const q = String(query || '')
  const out = []
  const seen = {}
  const re = /NMBMPSX\d{3,}|[A-Za-z]{2,}\d{3,}|\d{6,}/g
  let m
  while ((m = re.exec(q))) {
    const t = m[0]
    const key = t.toLowerCase()
    if (seen[key]) continue
    seen[key] = 1
    out.push(t)
  }
  return out
}

/** 从简报/groupKeys 推断应加权的目录 */
function boostDirsFromContext(query, groupKeys, brief) {
  const q = String(query || '').toLowerCase()
  const out = []
  const seen = {}
  const keys = Array.isArray(groupKeys) ? groupKeys : []
  for (let i = 0; i < keys.length; i++) {
    const k = String(keys[i] || '')
    if (!k || k === '_root') continue
    if (q.indexOf(k.toLowerCase()) >= 0) {
      if (!seen[k]) {
        seen[k] = 1
        out.push(k)
      }
    }
  }
  const briefText = String(brief || '')
  const modRe = /##\s*模块\s+([^\n]+)/g
  let m
  while ((m = modRe.exec(briefText))) {
    const name = String(m[1] || '').trim()
    if (!name) continue
    if (q.indexOf(name.toLowerCase()) >= 0 && !seen[name]) {
      seen[name] = 1
      out.push(name)
    }
  }
  return out
}

/**
 * 选文件：点名 → 全局高分 → import 跟随 → 已选模块按相关度补邻居
 * 返回 { paths, scoreByPath }
 */
function pickPaths(fileMetas, query, limit, groupKeys, brief, bundleMap) {
  const tokens = tokenize(query)
  const aliasTokens = expandAliasTokens(query)
  const codeTokens = extractCodeTokens(query)
  const atFilesRaw = extractAtFiles(query)
  const atFiles = resolveAtFiles(atFilesRaw, fileMetas)
  const atRoots = extractAtRoots(query)
  for (let i = 0; i < atRoots.length; i++) {
    aliasTokens.push(atRoots[i])
  }
  for (let i = 0; i < atFiles.length; i++) {
    aliasTokens.push(atFiles[i])
  }
  const allTokens = tokens.concat(aliasTokens).concat(codeTokens)
  const mentioned = extractMentionedPaths(query, fileMetas)
  const boostDirs = boostDirsFromContext(query, groupKeys, brief)
  const qLower = String(query || '').toLowerCase()

  const searchTerms = []
  const termSeen = {}
  function addTerm(t) {
    if (!t || t.length < 2 || termSeen[t] || ZH_STOP[t]) return
    termSeen[t] = 1
    searchTerms.push(t)
  }
  for (let i = 0; i < tokens.length; i++) addTerm(tokens[i])
  for (let i = 0; i < aliasTokens.length; i++) addTerm(aliasTokens[i])
  for (let i = 0; i < codeTokens.length; i++) addTerm(codeTokens[i])
  for (let g = 0; g < ALIAS_GROUPS.length; g++) {
    const zh = (ALIAS_GROUPS[g] && ALIAS_GROUPS[g].zh) || []
    for (let i = 0; i < zh.length; i++) {
      if (String(query || '').indexOf(zh[i]) >= 0) addTerm(zh[i])
    }
  }
  searchTerms.sort(function (a, b) {
    return b.length - a.length
  })

  const scored = []
  const scoreByPath = {}
  for (let i = 0; i < fileMetas.length; i++) {
    const path = fileMetas[i].path || fileMetas[i]
    if (atRoots.length > 0) {
      let rootHit = false
      for (let r = 0; r < atRoots.length; r++) {
        if (pathMatchesAtRoot(path, atRoots[r])) {
          rootHit = true
          break
        }
      }
      if (!rootHit) continue
    }
    let pathScore = scorePath(path, allTokens, query, aliasTokens, boostDirs)
    if (atRoots.length > 0) {
      for (let r = 0; r < atRoots.length; r++) {
        if (pathMatchesAtRoot(path, atRoots[r])) {
          pathScore += 120
          break
        }
      }
    }
    // 仅当 query/别名明确指向该 deposit 子包时抬分，避免全家无差别摊开
    const pref = modulePrefix(path)
    if (pref.indexOf('src/ghb_deposit') === 0) {
      const short = pref.slice(4).toLowerCase()
      let pointed = qLower.indexOf(short) >= 0
      if (!pointed) {
        for (let a = 0; a < aliasTokens.length; a++) {
          if (short.indexOf(aliasTokens[a]) >= 0 || aliasTokens[a].indexOf(short) >= 0) {
            pointed = true
            break
          }
        }
      }
      if (pointed) pathScore += 40
    }
    let bodyScore = 0
    if (bundleMap && bundleMap[path] != null) {
      bodyScore = scoreContent(bundleMap[path], searchTerms)
    }
    const s = pathScore + bodyScore
    if (s > 0) {
      scored.push({ path: path, score: s })
      scoreByPath[path] = s
    }
  }
  scored.sort(function (a, b) {
    return b.score - a.score
  })

  const out = []
  const seen = {}
  function pushPath(p) {
    if (!p || seen[p] || out.length >= limit) return false
    seen[p] = 1
    out.push(p)
    return true
  }

  // 文件级 @path 强制置顶
  for (let i = 0; i < atFiles.length; i++) {
    pushPath(atFiles[i])
    scoreByPath[atFiles[i]] = Math.max(scoreByPath[atFiles[i]] || 0, 1000)
  }

  for (let i = 0; i < mentioned.length; i++) {
    pushPath(mentioned[i])
    if (!scoreByPath[mentioned[i]]) scoreByPath[mentioned[i]] = 500
  }

  // 有明确 @file：import 跟随 → 同文件夹邻居；不再全局高分/整模块洪水/无关兜底
  if (atFiles.length > 0) {
    if (bundleMap) {
      expandPathsByImports(out, seen, bundleMap, limit, scoreByPath)
    }
    for (let f = 0; f < atFiles.length && out.length < limit; f++) {
      const folder = dirOf(atFiles[f])
      if (!folder) continue
      const candidates = []
      for (let i = 0; i < fileMetas.length; i++) {
        const p = fileMetas[i].path || fileMetas[i]
        if (!p || seen[p]) continue
        if (dirOf(p) !== folder) continue
        candidates.push(p)
      }
      candidates.sort(function (a, b) {
        return (
          floodRank(b, scoreByPath, aliasTokens, folder) -
          floodRank(a, scoreByPath, aliasTokens, folder)
        )
      })
      for (let i = 0; i < candidates.length && out.length < limit; i++) {
        if (pushPath(candidates[i])) {
          if (!scoreByPath[candidates[i]]) {
            scoreByPath[candidates[i]] = floodRank(
              candidates[i],
              scoreByPath,
              aliasTokens,
              folder
            )
          }
        }
      }
    }
    return { paths: out, scoreByPath: scoreByPath }
  }

  // 无 @file：全局高分优先（不再整模块洪水）
  for (let i = 0; i < scored.length && out.length < limit; i++) {
    pushPath(scored[i].path)
  }
  if (bundleMap) {
    expandPathsByImports(out, seen, bundleMap, limit, scoreByPath)
  }

  // 已选模块内按 floodRank 补邻居
  if (out.length && out.length < limit) {
    const dirs = {}
    const dirCount = {}
    for (let i = 0; i < out.length; i++) {
      const pref = modulePrefix(out[i])
      if (!canFloodModule(pref)) continue
      dirs[pref] = 1
      dirCount[pref] = (dirCount[pref] || 0) + 1
    }
    const dirList = Object.keys(dirs)
    for (let d = 0; d < dirList.length && out.length < limit; d++) {
      const pref = dirList[d]
      const candidates = []
      for (let i = 0; i < fileMetas.length; i++) {
        const p = fileMetas[i].path || fileMetas[i]
        if (seen[p]) continue
        if (String(p).indexOf(pref + '/') !== 0 && String(p) !== pref) continue
        candidates.push(p)
      }
      candidates.sort(function (a, b) {
        return (
          floodRank(b, scoreByPath, aliasTokens, pref) -
          floodRank(a, scoreByPath, aliasTokens, pref)
        )
      })
      let added = 0
      for (
        let i = 0;
        i < candidates.length &&
        out.length < limit &&
        (dirCount[pref] || 0) < MAX_PER_MODULE &&
        added < SIBLING_EXTRA;
        i++
      ) {
        if (pushPath(candidates[i])) {
          dirCount[pref] = (dirCount[pref] || 0) + 1
          added++
          if (!scoreByPath[candidates[i]]) {
            scoreByPath[candidates[i]] = floodRank(
              candidates[i],
              scoreByPath,
              aliasTokens,
              pref
            )
          }
        }
      }
    }
  }

  if (out.length < 4) {
    for (let i = 0; i < fileMetas.length && out.length < limit; i++) {
      const p = fileMetas[i].path || fileMetas[i]
      const base = String(p).split('/').pop() || ''
      if (
        base === 'package.json' ||
        base === 'pages.json' ||
        base === 'App.vue' ||
        base === 'main.js' ||
        base === 'rpchook.js'
      ) {
        pushPath(p)
      }
    }
  }

  return { paths: out, scoreByPath: scoreByPath }
}

function extractImportSpecs(content) {
  const text = String(content || '')
  const specs = []
  const reFrom = /from\s+['"]([^'"]+)['"]/g
  let m
  while ((m = reFrom.exec(text))) {
    if (m[1]) specs.push(m[1])
  }
  const reDyn = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = reDyn.exec(text))) {
    if (m[1]) specs.push(m[1])
  }
  return specs
}

function joinPosix(parts) {
  const stack = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (!p || p === '.') continue
    if (p === '..') {
      if (stack.length) stack.pop()
      continue
    }
    stack.push(p)
  }
  return stack.join('/')
}

function resolveImportToBundle(fromFile, spec, bundleMap) {
  let raw = String(spec || '').trim().split('?')[0]
  if (!raw) return ''
  const candidates = []
  if (raw.indexOf('@/') === 0) {
    const rest = raw.slice(2)
    candidates.push('src/' + rest)
    candidates.push(rest)
  } else if (raw.indexOf('./') === 0 || raw.indexOf('../') === 0) {
    const dirParts = String(fromFile || '').split('/')
    dirParts.pop()
    const relParts = raw.split('/')
    candidates.push(joinPosix(dirParts.concat(relParts)))
  } else {
    return ''
  }

  const exts = [
    '',
    '.js',
    '.ts',
    '.vue',
    '.json',
    '/index.js',
    '/index.ts',
    '/index.vue',
  ]
  for (let c = 0; c < candidates.length; c++) {
    const base = candidates[c]
    if (!base) continue
    for (let e = 0; e < exts.length; e++) {
      const p = base + exts[e]
      if (bundleMap[p] != null) return p
    }
  }
  const keys = Object.keys(bundleMap)
  for (let c = 0; c < candidates.length; c++) {
    const base = candidates[c]
    if (!base || base.length < 6) continue
    for (let k = 0; k < keys.length; k++) {
      const kp = keys[k]
      if (
        kp === base ||
        kp.indexOf(base + '.') === 0 ||
        kp.slice(-(base.length + 1)) === '/' + base ||
        kp.indexOf('/' + base + '.') >= 0
      ) {
        return kp
      }
    }
  }
  return ''
}

/** import 目标候选路径（不要求已在 bundleMap） */
function resolveImportCandidatePaths(fromFile, spec) {
  let raw = String(spec || '').trim().split('?')[0]
  if (!raw) return []
  const bases = []
  if (raw.indexOf('@/') === 0) {
    const rest = raw.slice(2)
    bases.push('src/' + rest)
    bases.push(rest)
  } else if (raw.indexOf('./') === 0 || raw.indexOf('../') === 0) {
    const dirParts = String(fromFile || '').split('/')
    dirParts.pop()
    const relParts = raw.split('/')
    bases.push(joinPosix(dirParts.concat(relParts)))
  } else {
    return []
  }
  const exts = [
    '',
    '.js',
    '.ts',
    '.vue',
    '.json',
    '/index.js',
    '/index.ts',
    '/index.vue',
  ]
  const out = []
  const seen = {}
  for (let c = 0; c < bases.length; c++) {
    const base = bases[c]
    if (!base) continue
    for (let e = 0; e < exts.length; e++) {
      const p = base + exts[e]
      if (!seen[p]) {
        seen[p] = 1
        out.push(p)
      }
    }
  }
  return out
}

/** 多轮跟随 import：插在父文件后，并继承较高打包优先级 */
function expandPathsByImports(out, seen, bundleMap, limit, scoreByPath) {
  for (let round = 0; round < IMPORT_EXPAND_ROUNDS; round++) {
    let added = 0
    for (let i = 0; i < out.length && out.length < limit; i++) {
      const file = out[i]
      const content = bundleMap[file]
      if (content == null) continue
      const specs = extractImportSpecs(content)
      const parentScore = (scoreByPath && scoreByPath[file]) || 100
      for (let s = 0; s < specs.length && out.length < limit; s++) {
        const resolved = resolveImportToBundle(file, specs[s], bundleMap)
        if (!resolved || seen[resolved]) continue
        seen[resolved] = 1
        out.splice(i + 1, 0, resolved)
        if (scoreByPath) {
          const cur = scoreByPath[resolved] || 0
          scoreByPath[resolved] = Math.max(cur, parentScore * 0.92)
        }
        added++
        i++
      }
    }
    if (!added) break
  }
}

function pathsFromTreeText(treeText) {
  const lines = String(treeText || '').split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line) out.push({ path: line })
  }
  return out
}

/**
 * 按分数降序灌入；触顶即停。返回实际写入的 usedFiles。
 */
function buildSourceBlock(bundleMap, paths, maxPerFile, maxTotal, scoreByPath) {
  const ordered = paths.slice()
  ordered.sort(function (a, b) {
    const sa = (scoreByPath && scoreByPath[a]) || 0
    const sb = (scoreByPath && scoreByPath[b]) || 0
    if (sb !== sa) return sb - sa
    return 0
  })

  let total = 0
  const parts = []
  const usedFiles = []
  for (let i = 0; i < ordered.length; i++) {
    let filePath = ordered[i]
    let content = bundleMap[filePath]
    if (content == null) {
      const keys = Object.keys(bundleMap)
      for (let k = 0; k < keys.length; k++) {
        if (
          keys[k] === filePath ||
          keys[k].slice(-filePath.length) === filePath ||
          keys[k].indexOf('/' + filePath) >= 0
        ) {
          content = bundleMap[keys[k]]
          filePath = keys[k]
          break
        }
      }
    }
    if (content == null) continue
    let body = String(content)
    if (body.length > maxPerFile) body = body.slice(0, maxPerFile) + '\n/* truncated */\n'
    const block = '\n===== FILE: ' + filePath + ' =====\n' + body + '\n'
    if (total + block.length > maxTotal) break
    parts.push(block)
    usedFiles.push(filePath)
    total += block.length
  }
  return { source: parts.join(''), usedFiles: usedFiles }
}

function loadBundleMap(fileContent) {
  const text = Buffer.isBuffer(fileContent)
    ? fileContent.toString('utf8')
    : String(fileContent || '')
  const data = JSON.parse(text)
  const files = (data && data.files) || []
  const map = {}
  for (let i = 0; i < files.length; i++) {
    if (files[i] && files[i].path) map[files[i].path] = files[i].content || ''
  }
  return map
}

/** 单次对话最多下载的 shard 数 */
const MAX_SHARDS_PER_QUERY = 12
/** import 触发补下 shard 的轮数 */
const SHARD_EXPAND_ROUNDS = 2

const shardCache = global.__xiaoheiShardCache || (global.__xiaoheiShardCache = {})

async function downloadJsonByFileID(fileID) {
  const dl = await cloud.downloadFile({ fileID: fileID })
  const text = Buffer.isBuffer(dl.fileContent)
    ? dl.fileContent.toString('utf8')
    : String(dl.fileContent || '')
  return JSON.parse(text)
}

function mergeShardData(data, bundleMap) {
  const files = (data && data.files) || []
  let n = 0
  for (let i = 0; i < files.length; i++) {
    if (!files[i] || !files[i].path) continue
    bundleMap[files[i].path] = files[i].content || ''
    n++
  }
  return n
}

async function ensureShardLoaded(manifest, shardId, bundleMap, loaded) {
  if (!shardId || loaded[shardId]) return 0
  const meta = manifest.shards && manifest.shards[shardId]
  const fileID = meta && meta.fileID
  if (!fileID) return 0
  let data = shardCache[fileID]
  if (!data) {
    data = await downloadJsonByFileID(fileID)
    shardCache[fileID] = data
  }
  loaded[shardId] = 1
  return mergeShardData(data, bundleMap)
}

/** 仅路径打分，选出要先下载的 shard */
function pickInitialShardIds(manifest, query, maxShards) {
  const tokens = tokenize(query)
  const aliasTokens = expandAliasTokens(query)
  const codeTokens = extractCodeTokens(query)
  const atFiles = extractAtFiles(query)
  const atRoots = extractAtRoots(query)
  for (let i = 0; i < atRoots.length; i++) {
    aliasTokens.push(atRoots[i])
  }
  for (let i = 0; i < atFiles.length; i++) {
    aliasTokens.push(atFiles[i])
  }
  const allTokens = tokens.concat(aliasTokens).concat(codeTokens)
  const boostDirs = []
  const shardScore = {}
  const paths = (manifest && manifest.paths) || []

  // @root：按 manifest 真实路径命中 shard（旧架构 shard 名不含 ghb_fund）
  if (atRoots.length > 0) {
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i].path
      const sid = paths[i].shard
      if (!p || !sid) continue
      for (let r = 0; r < atRoots.length; r++) {
        if (pathMatchesAtRoot(p, atRoots[r])) {
          shardScore[sid] = (shardScore[sid] || 0) + 200
          break
        }
      }
    }
  }

  for (let i = 0; i < paths.length; i++) {
    const p = paths[i].path
    const sid = paths[i].shard
    if (!p || !sid) continue
    let s = scorePath(p, allTokens, query, aliasTokens, boostDirs)
    for (let f = 0; f < atFiles.length; f++) {
      const af = atFiles[f]
      if (p === af || p.slice(-af.length) === af || p.indexOf(af) >= 0) {
        s += 1000
        break
      }
    }
    if (s <= 0) continue
    shardScore[sid] = (shardScore[sid] || 0) + s
  }
  // 别名 / @root 命中：shard id / key 含 token
  for (let a = 0; a < aliasTokens.length; a++) {
    const al = aliasTokens[a]
    const keys = Object.keys((manifest && manifest.shards) || {})
    for (let k = 0; k < keys.length; k++) {
      const sid = keys[k]
      if (String(sid).toLowerCase().indexOf(al) >= 0) {
        shardScore[sid] = (shardScore[sid] || 0) + (atRoots.indexOf(al) >= 0 ? 120 : 80)
      }
    }
  }
  return Object.keys(shardScore)
    .sort(function (a, b) {
      return shardScore[b] - shardScore[a]
    })
    .slice(0, maxShards)
}

function shardIdsForPaths(pathList, pathToShard) {
  const out = []
  const seen = {}
  for (let i = 0; i < pathList.length; i++) {
    const sid = pathToShard[pathList[i]]
    if (!sid || seen[sid]) continue
    seen[sid] = 1
    out.push(sid)
  }
  return out
}

async function loadBundleMapOnDemand(manifestFileID, query, fileMetasHint) {
  const manifest = await downloadJsonByFileID(manifestFileID)
  if (!manifest || !manifest.shards || !manifest.paths) {
    throw new Error('manifest 无效')
  }
  const pathToShard = {}
  const metas = []
  for (let i = 0; i < manifest.paths.length; i++) {
    const ent = manifest.paths[i]
    if (!ent || !ent.path) continue
    pathToShard[ent.path] = ent.shard
    metas.push({ path: ent.path })
  }
  const fileMetas = metas.length ? metas : fileMetasHint || []
  const bundleMap = {}
  const loaded = {}

  const initial = pickInitialShardIds(manifest, query, MAX_SHARDS_PER_QUERY)
  let fileHits = 0
  for (let i = 0; i < initial.length; i++) {
    fileHits += await ensureShardLoaded(manifest, initial[i], bundleMap, loaded)
  }
  // 若路径几乎打不中，至少拉分最高的若干 ghb shard（从 aliases 已反映在 score 里）；仍空则拉前几个小 shard
  if (!fileHits) {
    const keys = Object.keys(manifest.shards)
    for (let i = 0; i < keys.length && Object.keys(loaded).length < 4; i++) {
      fileHits += await ensureShardLoaded(manifest, keys[i], bundleMap, loaded)
    }
  }
  console.log(
    'xiaohei shards initial=' +
      Object.keys(loaded).length +
      ' files=' +
      fileHits
  )
  return {
    manifest: manifest,
    pathToShard: pathToShard,
    fileMetas: fileMetas,
    bundleMap: bundleMap,
    loaded: loaded,
  }
}

async function expandShardsForPaths(ctx, pathList) {
  const need = shardIdsForPaths(pathList, ctx.pathToShard)
  let added = 0
  for (let i = 0; i < need.length; i++) {
    if (Object.keys(ctx.loaded).length >= MAX_SHARDS_PER_QUERY + 4) break
    const n = await ensureShardLoaded(
      ctx.manifest,
      need[i],
      ctx.bundleMap,
      ctx.loaded
    )
    if (n) added++
  }
  return added
}

/** 父文件已下、import 子文件 shard 未下时补拉 */
async function expandShardsForImports(ctx, pathList) {
  if (!ctx || !ctx.pathToShard) return 0
  const wantPaths = []
  const pathSeen = {}
  for (let i = 0; i < pathList.length; i++) {
    const file = pathList[i]
    const content = ctx.bundleMap[file]
    if (content == null) continue
    const specs = extractImportSpecs(content)
    for (let s = 0; s < specs.length; s++) {
      const resolved = resolveImportToBundle(file, specs[s], ctx.bundleMap)
      if (resolved) continue
      const cands = resolveImportCandidatePaths(file, specs[s])
      for (let c = 0; c < cands.length; c++) {
        const p = cands[c]
        if (!ctx.pathToShard[p] || ctx.bundleMap[p] != null) continue
        if (pathSeen[p]) continue
        pathSeen[p] = 1
        wantPaths.push(p)
      }
    }
  }
  if (!wantPaths.length) return 0
  return expandShardsForPaths(ctx, wantPaths)
}

/** 单文件回包上限，避免云函数响应过大 */
const MAX_GET_FILE = 80000

/**
 * 寒暄：短、无 @/路径、无排查词 → 不拉源码
 */
function isChitchat(query) {
  const q = String(query || '').trim()
  if (!q || q.length > 24) return false
  if (q.indexOf('@') >= 0) return false
  if (/[\/\\]/.test(q)) return false
  if (/\.(vue|js|ts|tsx|jsx|json|scss|css|md)\b/i.test(q)) return false
  if (
    /报错|错误码|undefined|接口|页面|组件|登录|跳转|pages|源码|文件|模块|路由|白屏|崩溃|fail|error|bug|hook|api\.|云函数/i.test(
      q
    )
  ) {
    return false
  }
  if (
    /你好|您好|嗨|哈喽|在吗|在不在|谢谢|早上好|中午好|晚上好|hello|hey|\bhi\b|汪/i.test(
      q
    )
  ) {
    return true
  }
  return false
}

async function loadProjectForOpenid(projectId, openid) {
  let project = null
  try {
    const got = await db.collection(COL).doc(projectId).get()
    project = got.data
  } catch (e) {
    return { ok: false, message: '项目不存在' }
  }
  if (!project || project.kind !== 'project') {
    return { ok: false, message: '项目不存在' }
  }
  if (project._openid && project._openid !== openid) {
    return { ok: false, message: '无权限' }
  }
  if (project.status !== 'ready') {
    return {
      ok: false,
      message: '项目尚未索引完成（' + (project.status || '?') + '）',
    }
  }
  return { ok: true, project: project }
}

function findContentInMap(bundleMap, filePath) {
  if (!filePath || !bundleMap) return null
  if (bundleMap[filePath] != null) {
    return { path: filePath, content: String(bundleMap[filePath]) }
  }
  const keys = Object.keys(bundleMap)
  for (let k = 0; k < keys.length; k++) {
    if (
      keys[k] === filePath ||
      keys[k].slice(-filePath.length) === filePath ||
      keys[k].indexOf('/' + filePath) >= 0
    ) {
      return { path: keys[k], content: String(bundleMap[keys[k]] || '') }
    }
  }
  return null
}

async function handleGetFile(event, openid) {
  const projectId = event.projectId
  const filePath = String(event.path || '').trim()
  if (!projectId) return { ok: false, message: '缺少 projectId' }
  if (!filePath) return { ok: false, message: '缺少 path' }

  const loaded = await loadProjectForOpenid(projectId, openid)
  if (!loaded.ok) return loaded
  const project = loaded.project

  const summaries = await fetchAllWhere({ kind: 'summary', projectId: projectId })
  const summary = summaries[0] || {}
  const bundleFileID = project.bundleFileID || summary.bundleFileID || ''
  const manifestFileID = project.manifestFileID || summary.manifestFileID || ''

  let hit = null
  if (manifestFileID) {
    try {
      const manifest = await downloadJsonByFileID(manifestFileID)
      let shardId = ''
      const paths = (manifest && manifest.paths) || []
      for (let i = 0; i < paths.length; i++) {
        if (paths[i] && paths[i].path === filePath) {
          shardId = paths[i].shard || ''
          break
        }
      }
      if (!shardId) {
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i] && paths[i].path
          if (
            p &&
            (p.slice(-filePath.length) === filePath ||
              p.indexOf('/' + filePath) >= 0)
          ) {
            shardId = paths[i].shard || ''
            break
          }
        }
      }
      if (shardId) {
        const bundleMap = {}
        const loadedShards = {}
        await ensureShardLoaded(manifest, shardId, bundleMap, loadedShards)
        hit = findContentInMap(bundleMap, filePath)
      }
    } catch (e) {
      console.warn('getFile manifest 失败，回退 pack', e)
    }
  }

  if (!hit) {
    if (!bundleFileID) return { ok: false, message: '缺少源码包，请重新索引' }
    try {
      const dl = await cloud.downloadFile({ fileID: bundleFileID })
      const bundleMap = loadBundleMap(dl.fileContent)
      hit = findContentInMap(bundleMap, filePath)
    } catch (e) {
      return { ok: false, message: '读取源码包失败' }
    }
  }

  if (!hit) return { ok: false, message: '未找到文件：' + filePath }
  let content = hit.content
  let truncated = false
  if (content.length > MAX_GET_FILE) {
    content = content.slice(0, MAX_GET_FILE) + '\n/* truncated */\n'
    truncated = true
  }
  return {
    ok: true,
    path: hit.path,
    content: content,
    truncated: truncated,
  }
}

exports.main = async (event) => {
  event = event || {}
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  if (event.action === 'cancel') {
    const requestId = event.requestId
    if (!requestId) return { ok: false, message: '缺少 requestId' }
    await setCancelFlag(requestId, openid)
    return { ok: true, cancelled: true }
  }

  if (event.action === 'getFile') {
    try {
      return await handleGetFile(event, openid)
    } catch (e) {
      return { ok: false, message: (e && e.message) || '读取失败' }
    }
  }

  const apiKey = process.env.ZHIPU_API_KEY || ''
  if (!apiKey) return { ok: false, message: '未配置 ZHIPU_API_KEY' }

  const projectId = event.projectId
  const requestId = event.requestId || ''
  if (!projectId) return { ok: false, message: '缺少 projectId' }

  const imagePayload = await resolveImageFromEvent(event)
  if (imagePayload.error) {
    return { ok: false, message: imagePayload.error }
  }
  const imageBase64 = imagePayload.base64 || ''
  const imageMime = imagePayload.mime || event.imageMime || 'image/jpeg'
  const hasImage = imageBase64.length > 0

  let messages = normalizeMessages(event.messages, hasImage)
  if (!messages.length && hasImage) {
    messages = [{ role: 'user', content: '' }]
  }
  if (!messages.length) return { ok: false, message: '请输入内容' }
  const last = messages[messages.length - 1]
  if (last.role !== 'user') return { ok: false, message: '最后一条须为用户消息' }

  const userText = (last.content || '').trim()
  const queryForPick =
    userText || (hasImage ? '根据用户截图排查界面或报错问题' : '')

  try {
  const loadedProj = await loadProjectForOpenid(projectId, openid)
  if (!loadedProj.ok) return loadedProj
  const project = loadedProj.project

  const summaries = await fetchAllWhere({ kind: 'summary', projectId: projectId })
  const summary = summaries[0]
  if (!summary || !summary.content) {
    return { ok: false, message: '缺少项目摘要，请重新索引' }
  }

  // 加载 pages.json 生成的业务别名（publish 写入）；失败则保留兜底
  ALIAS_GROUPS = FALLBACK_ALIAS_GROUPS.slice()
  try {
    const aliasDocs = await fetchAllWhere({ kind: 'aliases', projectId: projectId })
    const aliasDoc = aliasDocs[0]
    if (aliasDoc && Array.isArray(aliasDoc.groups) && aliasDoc.groups.length) {
      ALIAS_GROUPS = aliasDoc.groups.concat(FALLBACK_ALIAS_GROUPS)
    }
  } catch (e) {
    console.warn('加载 aliases 失败', e)
  }

  let rulesText = ''
  try {
    const rulesDocs = await fetchAllWhere({ kind: 'rules', projectId: projectId })
    if (rulesDocs[0] && rulesDocs[0].content) {
      rulesText = String(rulesDocs[0].content)
    }
  } catch (e) {
    console.warn('加载 rules 失败', e)
  }

  await throwIfCancelled(requestId, openid)

  // 寒暄：不下载 pack/shards、不选文件（带图时跳过）
  if (!hasImage && isChitchat(last.content)) {
    const systemParts = []
    systemParts.push(OUTPUT_SKELETON)
    systemParts.push(
      '【闲聊】用户在打招呼或寒暄。请简短友好回复即可，不要臆造业务代码或文件路径。'
    )
    if (rulesText) {
      systemParts.push('【排查规范】\n' + rulesText.slice(0, Math.min(MAX_RULES, 2000)))
    }
    const briefHead = String(summary.content || '').slice(0, 800)
    if (briefHead) {
      systemParts.push('【项目简介】\n' + briefHead)
    }
    await throwIfCancelled(requestId, openid)
    const chatMsgs = buildMessagesForModel(messages, imageBase64, imageMime)
    const data = await postChat(
      Object.assign(
        {
          model: MODEL,
          messages: [{ role: 'system', content: systemParts.join('\n\n') }].concat(
            chatMsgs
          ),
        },
        glmChatBodyExtra()
      ),
      apiKey,
      GLM_TIMEOUT_MS,
      function () {
        return isCancelled(requestId, openid)
      }
    )
    const reply = extractReply(data)
    if (!reply) return { ok: false, message: '模型未返回内容' }
    return { ok: true, reply: reply, usedFiles: [] }
  }

  let fileMetas = pathsFromTreeText(summary.treeText)
  if (!fileMetas.length) {
    const legacy = await fetchAllWhere({ kind: 'file', projectId: projectId })
    fileMetas = legacy
  }
  const bundleFileID = project.bundleFileID || summary.bundleFileID
  const manifestFileID = project.manifestFileID || summary.manifestFileID || ''

  let bundleMap = {}
  let shardCtx = null

  if (manifestFileID) {
    try {
      shardCtx = await loadBundleMapOnDemand(
        manifestFileID,
        queryForPick,
        fileMetas
      )
      bundleMap = shardCtx.bundleMap
      if (shardCtx.fileMetas && shardCtx.fileMetas.length) {
        fileMetas = shardCtx.fileMetas
      }
    } catch (e) {
      console.warn('按需 shards 失败，回退全量 pack', e)
      shardCtx = null
    }
  }

  if (!shardCtx) {
    if (!bundleFileID) return { ok: false, message: '缺少源码包，请重新索引' }
    try {
      const dl = await cloud.downloadFile({ fileID: bundleFileID })
      bundleMap = loadBundleMap(dl.fileContent)
    } catch (e) {
      return { ok: false, message: '读取源码包失败' }
    }
  }

  await throwIfCancelled(requestId, openid)

  if (!fileMetas.length) {
    const keys = Object.keys(bundleMap)
    fileMetas = keys.map(function (p) {
      return { path: p }
    })
  }

  // 本地选文件：高分优先 + import 跟随 + 预算内灌入
  let picked = pickPaths(
    fileMetas,
    queryForPick,
    MAX_FILES,
    summary.groupKeys,
    summary.content,
    bundleMap
  )

  if (shardCtx) {
    for (let round = 0; round < SHARD_EXPAND_ROUNDS; round++) {
      const added = await expandShardsForPaths(shardCtx, picked.paths || [])
      const importAdded = await expandShardsForImports(shardCtx, picked.paths || [])
      if (!added && !importAdded) break
      picked = pickPaths(
        fileMetas,
        queryForPick,
        MAX_FILES,
        summary.groupKeys,
        summary.content,
        bundleMap
      )
    }
    console.log(
      'xiaohei shards final=' +
        Object.keys(shardCtx.loaded).length +
        ' mapFiles=' +
        Object.keys(bundleMap).length
    )
  }

  await throwIfCancelled(requestId, openid)

  const paths = picked.paths || []
  const scoreByPath = picked.scoreByPath || {}
  const packed = buildSourceBlock(
    bundleMap,
    paths,
    MAX_PER_FILE,
    MAX_SOURCE_TOTAL,
    scoreByPath
  )
  const source = packed.source || ''
  const usedFiles = packed.usedFiles || []

  const missingInBundle = []
  for (let i = 0; i < usedFiles.length; i++) {
    if (bundleMap[usedFiles[i]] == null) {
      let found = false
      const keys = Object.keys(bundleMap)
      for (let k = 0; k < keys.length; k++) {
        if (
          keys[k] === usedFiles[i] ||
          keys[k].slice(-usedFiles[i].length) === usedFiles[i]
        ) {
          found = true
          break
        }
      }
      if (!found) missingInBundle.push(usedFiles[i])
    }
  }

  const systemParts = []
  systemParts.push(OUTPUT_SKELETON)
  if (rulesText) {
    systemParts.push(
      '【排查规范】\n' + rulesText.slice(0, MAX_RULES)
    )
  }
  systemParts.push(
    '【项目简报】\n' + String(summary.content).slice(0, MAX_BRIEF)
  )
  systemParts.push(
    '【目录（节选）】\n' + String(summary.treeText || '').slice(0, MAX_TREE)
  )
  systemParts.push(
    '【本次选中路径】\n' + (usedFiles.length ? usedFiles.join('\n') : '（无）')
  )
  if (missingInBundle.length) {
    systemParts.push(
      '【注意】以下路径在目录中命中，但源码包正文缺失（可能被 pack 过滤，或需重跑 npm run code-assist:publish）：\n' +
        missingInBundle.join('\n') +
        '\n可在问题中直接粘贴相关文件路径或代码片段补全上下文。'
    )
  }
  systemParts.push(
    '【相关源码】\n' + (source || '（未能加载源码片段，请根据简报作答并说明限制）')
  )

  await throwIfCancelled(requestId, openid)

  const chatMsgs = buildMessagesForModel(messages, imageBase64, imageMime)
  const data = await postChat(
      Object.assign(
        {
          model: MODEL,
          messages: [{ role: 'system', content: systemParts.join('\n\n') }].concat(
            chatMsgs
          ),
        },
        glmChatBodyExtra()
      ),
      apiKey,
      GLM_TIMEOUT_MS,
      function () {
        return isCancelled(requestId, openid)
      }
    )
    const reply = extractReply(data)
    if (!reply) return { ok: false, message: '模型未返回内容' }
    return {
      ok: true,
      reply: reply,
      usedFiles: usedFiles,
      suggestAtRoots: hasImage ? suggestAtRootsFromUsedFiles(usedFiles) : [],
    }
  } catch (err) {
    if ((err && err.cancelled) || (err && err.message === 'cancelled')) {
      return { ok: false, cancelled: true, message: '已中止' }
    }
    return { ok: false, message: (err && err.message) || '排查失败' }
  } finally {
    await clearCancelFlag(requestId, openid)
  }
}
