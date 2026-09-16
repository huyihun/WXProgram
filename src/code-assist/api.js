/**
 * 小黑：取当前项目 + 排查对话
 *
 * 本机 npm run code-assist:publish 完成索引后，小程序只对话。
 * 集合 code_assist（kind: project | summary | rules | aliases | pageIndex | chat | prefs）
 * 云函数：仅 codeAssistChat（需 ZHIPU_API_KEY，超时 60s，模型 glm-5.3-flash）
 */
import {
  XIAOHEI_PROJECT_ID,
  XIAOHEI_DEFAULT_SLUG,
  XIAOHEI_PROJECTS,
} from '@/code-assist/project'

const COL = 'code_assist'
const BATCH = 20
const MAX_CHAT_MSGS = 40

function getDb() {
  return wx.cloud.database()
}

async function fetchAllWhere(where) {
  const db = getDb()
  const all = []
  let skip = 0
  while (true) {
    const res = await db.collection(COL).where(where).skip(skip).limit(BATCH).get()
    const batch = res.data || []
    for (let i = 0; i < batch.length; i++) all.push(batch[i])
    if (batch.length < BATCH) break
    skip += BATCH
  }
  return all
}

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
    return new Error('图片或对话过长，请换更小截图或减少历史后再试')
  }
  if (
    lower.indexOf('timeout') >= 0 ||
    lower.indexOf('timed out') >= 0 ||
    raw.indexOf('超时') >= 0 ||
    raw.indexOf('-504003') >= 0 ||
    raw.indexOf('504003') >= 0 ||
    raw.indexOf('TIME_LIMIT') >= 0 ||
    raw.indexOf('FUNCTIONS_TIME_LIMIT') >= 0
  ) {
    const e = new Error(
      fnName + ' 超时。请确认云函数超时为 60 秒，或把问题写得更具体（路径/报错原文）'
    )
    e.isTimeout = true
    return e
  }
  return new Error(raw || '调用 ' + fnName + ' 失败')
}

export async function getProject(projectId) {
  if (!projectId) return null
  const db = getDb()
  try {
    const res = await db.collection(COL).doc(projectId).get()
    return res.data || null
  } catch (e) {
    return null
  }
}

/** 云库偏好（kind: prefs）：当前选中的 projectId */
export async function loadPrefs() {
  const rows = await fetchAllWhere({ kind: 'prefs' })
  return rows[0] || null
}

/** 把选中项目写入云库 prefs（不用本地缓存） */
export async function saveSelectedProjectId(projectId) {
  if (!projectId) return
  const db = getDb()
  const now = Date.now()
  const rows = await fetchAllWhere({ kind: 'prefs' })
  if (rows.length && rows[0]._id) {
    await db.collection(COL).doc(rows[0]._id).update({
      data: {
        selectedProjectId: projectId,
        updatedAt: now,
      },
    })
    return
  }
  await db.collection(COL).add({
    data: {
      kind: 'prefs',
      selectedProjectId: projectId,
      createdAt: now,
      updatedAt: now,
    },
  })
}

/** 全部 ready 项目，以 project.js 配置表为准（避免云库重复文档） */
export async function listProjects() {
  const catalog = XIAOHEI_PROJECTS || []
  const out = []
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i]
    if (!item || !item.projectId) continue
    const p = await getProject(item.projectId)
    if (!p || p.kind !== 'project' || p.status !== 'ready') continue
    out.push({
      _id: p._id || item.projectId,
      slug: p.slug || item.slug || '',
      name: p.name || item.name || item.slug || '',
      status: p.status,
      updatedAt: p.updatedAt,
    })
  }
  return out
}

/**
 * 当前对话项目：
 * 1) 云库 prefs.selectedProjectId（仍 ready）
 * 2) 配置 defaultSlug 对应 projectId
 * 3) 配置表第一项 / 最新 ready
 */
export async function getActiveProject() {
  const prefs = await loadPrefs()
  if (prefs && prefs.selectedProjectId) {
    const selected = await getProject(prefs.selectedProjectId)
    if (selected && selected.kind === 'project' && selected.status === 'ready') {
      return selected
    }
  }

  const catalog = XIAOHEI_PROJECTS || []
  const defaultSlug = XIAOHEI_DEFAULT_SLUG || ''
  if (defaultSlug) {
    for (let i = 0; i < catalog.length; i++) {
      const item = catalog[i]
      if (!item || item.slug !== defaultSlug || !item.projectId) continue
      const p = await getProject(item.projectId)
      if (p && p.kind === 'project' && p.status === 'ready') return p
    }
  }

  const fixed = XIAOHEI_PROJECT_ID || ''
  if (fixed) {
    const p = await getProject(fixed)
    if (p && p.kind === 'project' && p.status === 'ready') return p
  }

  const rows = await listProjects()
  return rows[0] || null
}

/** 识图前压缩，避免 callFunction 1MB 上限 */
export function compressImageForChat(filePath) {
  return new Promise(function (resolve) {
    if (!filePath) {
      resolve('')
      return
    }
    uni.compressImage({
      src: filePath,
      quality: 70,
      compressedWidth: 1280,
      success: function (res) {
        resolve(res.tempFilePath || filePath)
      },
      fail: function () {
        resolve(filePath)
      },
    })
  })
}

function wrapImageCdn(localPath) {
  if (!localPath || !wx.cloud || !wx.cloud.CDN) return ''
  return wx.cloud.CDN({
    type: 'filePath',
    filePath: localPath,
  })
}

export async function chatCodeAssist(projectId, messages, requestId, imageOpts) {
  const opts = imageOpts || {}
  const localPath = opts.localPath || ''
  const data = {
    projectId: projectId,
    messages: messages || [],
    requestId: requestId || '',
    imageMime: opts.mime || 'image/jpeg',
  }
  if (localPath) {
    data.imageCdn = wrapImageCdn(localPath)
    if (!data.imageCdn) {
      throw new Error('当前环境不支持云 CDN 传图')
    }
  }
  let res
  try {
    res = await wx.cloud.callFunction({
      name: 'codeAssistChat',
      data: data,
    })
  } catch (err) {
    const e = callFnError(err, 'codeAssistChat')
    if (e.isTimeout) {
      throw new Error(
        '排查超时。可把问题写得更具体（模块/文件名/报错原文）后再试'
      )
    }
    throw e
  }
  const body = (res && res.result) || {}
  if (body.cancelled) {
    return { cancelled: true, reply: '', usedFiles: [] }
  }
  if (!body.ok) {
    throw new Error(body.message || '排查失败')
  }
  return {
    reply: body.reply || '',
    usedFiles: body.usedFiles || [],
    suggestAtRoots: body.suggestAtRoots || [],
  }
}

export async function cancelCodeAssist(requestId) {
  if (!requestId) return
  try {
    await wx.cloud.callFunction({
      name: 'codeAssistChat',
      data: {
        action: 'cancel',
        requestId: requestId,
      },
    })
  } catch (err) {
    console.error('cancelCodeAssist failed', err)
  }
}

/** pages.json 模块索引（root / name / id / pages） */
export async function getPageIndex(projectId) {
  if (!projectId) return []
  const rows = await fetchAllWhere({ kind: 'pageIndex', projectId: projectId })
  if (!rows.length || !rows[0].modules) return []
  return rows[0].modules
}

/** 按路径读取已索引源码（索引弹层看代码） */
export async function getCodeAssistFile(projectId, filePath) {
  if (!projectId || !filePath) {
    throw new Error('缺少项目或路径')
  }
  let res
  try {
    res = await wx.cloud.callFunction({
      name: 'codeAssistChat',
      data: {
        action: 'getFile',
        projectId: projectId,
        path: filePath,
      },
    })
  } catch (err) {
    throw callFnError(err, 'codeAssistChat')
  }
  const body = (res && res.result) || {}
  if (!body.ok) {
    throw new Error(body.message || '读取文件失败')
  }
  return {
    path: body.path || filePath,
    content: body.content || '',
    truncated: !!body.truncated,
  }
}

function trimChatMessages(list) {
  const raw = list || []
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i]
    if (!m) continue
    const role = m.role === 'assistant' || m.role === 'user' ? m.role : ''
    const content = m.content != null ? String(m.content) : ''
    if (!role || !content) continue
    out.push({ role: role, content: content })
  }
  if (out.length > MAX_CHAT_MSGS) {
    return out.slice(out.length - MAX_CHAT_MSGS)
  }
  return out
}

/** 拉取项目对话历史（kind: chat） */
export async function loadChat(projectId) {
  if (!projectId) return []
  const rows = await fetchAllWhere({ kind: 'chat', projectId: projectId })
  if (!rows.length || !rows[0].messages) return []
  return trimChatMessages(rows[0].messages)
}

/** 保存对话；每个 project 一篇 chat 文档 */
export async function saveChat(projectId, messages) {
  if (!projectId) return
  const list = trimChatMessages(messages)
  const db = getDb()
  const now = Date.now()
  const rows = await fetchAllWhere({ kind: 'chat', projectId: projectId })
  if (rows.length && rows[0]._id) {
    await db.collection(COL).doc(rows[0]._id).update({
      data: {
        messages: list,
        updatedAt: now,
      },
    })
    return
  }
  await db.collection(COL).add({
    data: {
      kind: 'chat',
      projectId: projectId,
      messages: list,
      createdAt: now,
      updatedAt: now,
    },
  })
}

/** 清空云库对话 */
export async function clearChatCloud(projectId) {
  if (!projectId) return
  const db = getDb()
  const rows = await fetchAllWhere({ kind: 'chat', projectId: projectId })
  if (!rows.length || !rows[0]._id) return
  await db.collection(COL).doc(rows[0]._id).update({
    data: {
      messages: [],
      updatedAt: Date.now(),
    },
  })
}
