/**
 * 小黑：按项目 pack → summarize → 上传云存储 → 写库 ready
 *
 * 环境变量：ZHIPU_API_KEY、TCB_SECRET_ID、TCB_SECRET_KEY、TCB_ENV
 *
 * 用法：
 *   npm run code-assist:publish -- --project mobile-bank-uniapp
 *   npm run code-assist:publish -- --project mobile-bank --reuse-brief
 *   npm run code-assist:publish -- --project wxbank --skip-upload
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = path.resolve(__dirname, '..')
const ROOT = path.resolve(TOOL_ROOT, '..')
const CONFIG_PATH = path.join(TOOL_ROOT, 'config.json')
const PROJECT_JS = path.join(ROOT, 'src/code-assist/project.js')

function parseFlags(argv) {
  const flags = { reuseBrief: false, skipUpload: false, projectSlug: '' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--reuse-brief') flags.reuseBrief = true
    else if (a === '--skip-upload') flags.skipUpload = true
    else if (a === '--project' || a === '-p') {
      flags.projectSlug = String(argv[i + 1] || '').trim()
      i += 1
    }
  }
  return flags
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) throw new Error('缺少 code-assist/config.json')
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
}

function resolveProject(cfg, slug) {
  const list = Array.isArray(cfg.projects) ? cfg.projects : null
  if (!list || !list.length) {
    if (!cfg.source) throw new Error('code-assist/config.json 缺少 projects 或 source')
    return {
      slug: 'default',
      name: cfg.name || '未命名项目',
      source: cfg.source,
      projectId: cfg.projectId || '',
      rulesFile: cfg.rulesFile || '',
    }
  }
  const want = slug || cfg.defaultSlug || list[0].slug
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    if (p && p.slug === want) {
      return {
        slug: p.slug,
        name: p.name || p.slug,
        source: p.source || '',
        sources: Array.isArray(p.sources) ? p.sources : null,
        projectId: p.projectId || '',
        rulesFile: p.rulesFile || cfg.rulesFile || '',
      }
    }
  }
  throw new Error('未找到项目 slug：' + want)
}

function writeBackProjectId(cfg, slug, projectId) {
  if (Array.isArray(cfg.projects)) {
    for (let i = 0; i < cfg.projects.length; i++) {
      if (cfg.projects[i] && cfg.projects[i].slug === slug) {
        cfg.projects[i].projectId = projectId
        saveConfig(cfg)
        return
      }
    }
  }
  cfg.projectId = projectId
  saveConfig(cfg)
}

function runNode(scriptRel, args) {
  const script = path.join(ROOT, scriptRel)
  const r = spawnSync(process.execPath, [script].concat(args), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) throw new Error(scriptRel + ' 失败，exit ' + r.status)
}

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function writeProjectJs(cfg) {
  const list = Array.isArray(cfg.projects) ? cfg.projects : []
  const defaultSlug = cfg.defaultSlug || (list[0] && list[0].slug) || ''
  let defaultId = ''
  let defaultName = '小黑'
  const rows = []
  for (let i = 0; i < list.length; i++) {
    const p = list[i] || {}
    rows.push(
      "  { slug: '" + esc(p.slug) + "', name: '" + esc(p.name) + "', projectId: '" + esc(p.projectId) + "' }"
    )
    if (p.slug === defaultSlug) {
      defaultId = p.projectId || ''
      defaultName = p.name || defaultName
    }
  }
  if (!defaultId && list[0]) {
    defaultId = list[0].projectId || ''
    defaultName = list[0].name || defaultName
  }
  const body =
    '/** 由 npm run code-assist:publish 自动生成，勿手改 */\n' +
    "export const XIAOHEI_DEFAULT_SLUG = '" + esc(defaultSlug) + "'\n" +
    'export const XIAOHEI_PROJECTS = [\n' +
    rows.join(',\n') +
    '\n]\n' +
    "export const XIAOHEI_PROJECT_ID = '" + esc(defaultId) + "'\n" +
    "export const XIAOHEI_PROJECT_NAME = '" + esc(defaultName) + "'\n"
  fs.mkdirSync(path.dirname(PROJECT_JS), { recursive: true })
  fs.writeFileSync(PROJECT_JS, body, 'utf8')
  console.log('已更新 ' + path.relative(ROOT, PROJECT_JS))
}

async function uploadAndWriteDb(cfg, project, art, brief) {
  const envId = process.env.TCB_ENV || cfg.envId || ''
  const secretId = process.env.TCB_SECRET_ID || ''
  const secretKey = process.env.TCB_SECRET_KEY || ''
  if (!envId) throw new Error('缺少 TCB_ENV 或 config.envId')
  if (!secretId || !secretKey) {
    throw new Error('缺少 TCB_SECRET_ID / TCB_SECRET_KEY（云开发控制台 → 环境 → 环境设置 → API 密钥）')
  }

  let tcb
  try {
    tcb = await import('@cloudbase/node-sdk')
  } catch (e) {
    throw new Error('请先安装：npm i -D @cloudbase/node-sdk\n' + ((e && e.message) || e))
  }
  const cloud = tcb.default || tcb
  const app = cloud.init({
    env: envId,
    secretId: secretId,
    secretKey: secretKey,
  })

  let projectId = project.projectId || ''
  const db = app.database()
  const COL = 'code_assist'
  const now = Date.now()
  const name = project.name || '未命名项目'
  let openid = cfg.openid || ''

  if (projectId) {
    try {
      const got = await db.collection(COL).doc(projectId).get()
      const data = got.data && (Array.isArray(got.data) ? got.data[0] : got.data)
      if (data && data._openid && !openid) openid = data._openid
    } catch (e) {
      console.warn('读取已有项目失败，将新建：' + ((e && e.message) || e))
      projectId = ''
    }
  }

  if (!openid) {
    console.warn(
      '警告：未配置 openid。小程序「仅创建者可读写」可能读不到管理端写入的文档。请在 code-assist/config.json 填入你的 openid 后重跑。'
    )
  }

  const cloudPath =
    'code-assist/' + (projectId || 'pending') + '/xiaohei-pack-' + now + '.json'
  console.log('上传 pack → ' + cloudPath + ' …')
  const up = await app.uploadFile({
    cloudPath: cloudPath,
    fileContent: fs.createReadStream(art.pack),
  })
  const fileID = up.fileID || (up.fileList && up.fileList[0] && up.fileList[0].fileID) || ''
  if (!fileID) throw new Error('上传失败：未拿到 fileID')
  console.log('fileID: ' + fileID)

  const treeText = brief.fullTreeText || brief.treeText || ''
  const groupKeys = Array.isArray(brief.groupKeys) ? brief.groupKeys : []
  const parts = Array.isArray(brief.parts) ? brief.parts : []
  const content = brief.content != null ? String(brief.content) : ''
  const fileCount = brief.fileCount != null ? Number(brief.fileCount) : 0
  const pathCount = brief.pathCount != null ? Number(brief.pathCount) : 0
  const maxGroups = Math.min(groupKeys.length, 10)
  const totalSteps = maxGroups + 2

  const projectData = {
    kind: 'project',
    name: name,
    slug: project.slug || '',
    status: 'ready',
    phase: 'done',
    fileCount: fileCount,
    pathCount: pathCount,
    bundleFileID: fileID,
    packFileID: fileID,
    zipFileID: '',
    summaryCursor: totalSteps,
    summaryTotal: totalSteps,
    errorMsg: '',
    updatedAt: now,
  }
  if (brief.stats) projectData.packStats = brief.stats
  if (openid) projectData._openid = openid

  if (!projectId) {
    projectData.createdAt = now
    const addRes = await db.collection(COL).add(projectData)
    projectId = addRes.id || addRes._id
    if (!projectId) throw new Error('创建项目失败：无 _id')
    writeBackProjectId(cfg, project.slug, projectId)
    project.projectId = projectId
    console.log('已创建 projectId=' + projectId + '（已写回 code-assist/config.json）')
  } else {
    await db.collection(COL).doc(projectId).update(projectData)
    console.log('已更新 project ' + projectId)
  }

  const sumQuery = await db
    .collection(COL)
    .where({ kind: 'summary', projectId: projectId })
    .limit(20)
    .get()
  const sumRows = (sumQuery.data || []).slice()
  let summaryDocId = ''
  const summaryData = {
    kind: 'summary',
    projectId: projectId,
    treeText: treeText,
    bundleFileID: fileID,
    content: content,
    parts: parts,
    groupKeys: groupKeys,
    pathCount: pathCount,
    updatedAt: now,
  }
  if (openid) summaryData._openid = openid
  if (sumRows[0] && (sumRows[0]._id || sumRows[0].id)) {
    summaryDocId = sumRows[0]._id || sumRows[0].id
    await db.collection(COL).doc(summaryDocId).update(summaryData)
  } else {
    summaryData.createdAt = now
    const addSum = await db.collection(COL).add(summaryData)
    summaryDocId = addSum.id || addSum._id || ''
  }
  console.log('已写入 summary')

  let rulesText = ''
  const rulesFile = project.rulesFile
    ? path.isAbsolute(project.rulesFile)
      ? project.rulesFile
      : path.join(TOOL_ROOT, project.rulesFile)
    : ''
  if (rulesFile && fs.existsSync(rulesFile)) {
    rulesText = fs.readFileSync(rulesFile, 'utf8')
  }
  const rulesQuery = await db
    .collection(COL)
    .where({ kind: 'rules', projectId: projectId })
    .limit(20)
    .get()
  const rulesRows = (rulesQuery.data || []).slice()
  const rulesData = {
    kind: 'rules',
    projectId: projectId,
    content: rulesText,
    updatedAt: now,
  }
  if (openid) rulesData._openid = openid
  if (rulesRows[0] && (rulesRows[0]._id || rulesRows[0].id)) {
    const rid = rulesRows[0]._id || rulesRows[0].id
    await db.collection(COL).doc(rid).update(rulesData)
  } else {
    rulesData.createdAt = now
    await db.collection(COL).add(rulesData)
  }
  console.log('已写入 rules（' + (rulesText ? rulesText.length + ' 字' : '空') + '）')

  let aliasGroups = []
  if (fs.existsSync(art.aliases)) {
    try {
      const aliasPayload = JSON.parse(fs.readFileSync(art.aliases, 'utf8'))
      aliasGroups = Array.isArray(aliasPayload.groups) ? aliasPayload.groups : []
    } catch (e) {
      console.warn('读取 aliases 失败：' + ((e && e.message) || e))
    }
  }
  const aliasesQuery = await db
    .collection(COL)
    .where({ kind: 'aliases', projectId: projectId })
    .limit(20)
    .get()
  const aliasesRows = (aliasesQuery.data || []).slice()
  const aliasesData = {
    kind: 'aliases',
    projectId: projectId,
    groups: aliasGroups,
    count: aliasGroups.length,
    updatedAt: now,
  }
  if (openid) aliasesData._openid = openid
  if (aliasesRows[0] && (aliasesRows[0]._id || aliasesRows[0].id)) {
    const aid = aliasesRows[0]._id || aliasesRows[0].id
    await db.collection(COL).doc(aid).update(aliasesData)
  } else {
    aliasesData.createdAt = now
    await db.collection(COL).add(aliasesData)
  }
  console.log('已写入 aliases（' + aliasGroups.length + ' 组）')

  let pageModules = []
  if (fs.existsSync(art.pageIndex)) {
    try {
      const pagePayload = JSON.parse(fs.readFileSync(art.pageIndex, 'utf8'))
      pageModules = Array.isArray(pagePayload.modules) ? pagePayload.modules : []
    } catch (e) {
      console.warn('读取 pageIndex 失败：' + ((e && e.message) || e))
    }
  }
  const pageIndexQuery = await db
    .collection(COL)
    .where({ kind: 'pageIndex', projectId: projectId })
    .limit(20)
    .get()
  const pageIndexRows = (pageIndexQuery.data || []).slice()
  const pageIndexData = {
    kind: 'pageIndex',
    projectId: projectId,
    modules: pageModules,
    count: pageModules.length,
    updatedAt: now,
  }
  if (openid) pageIndexData._openid = openid
  if (pageIndexRows[0] && (pageIndexRows[0]._id || pageIndexRows[0].id)) {
    const pid = pageIndexRows[0]._id || pageIndexRows[0].id
    await db.collection(COL).doc(pid).update(pageIndexData)
  } else {
    pageIndexData.createdAt = now
    await db.collection(COL).add(pageIndexData)
  }
  console.log('已写入 pageIndex（' + pageModules.length + ' 项）')

  let manifestFileID = ''
  let shardCount = 0
  if (fs.existsSync(art.manifest) && fs.existsSync(art.shards)) {
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(art.manifest, 'utf8'))
    } catch (e) {
      console.warn('读取 manifest 失败：' + ((e && e.message) || e))
      manifest = null
    }
    if (manifest && manifest.shards) {
      const shardIds = Object.keys(manifest.shards)
      console.log('上传 shards（' + shardIds.length + '）…')
      for (let i = 0; i < shardIds.length; i++) {
        const sid = shardIds[i]
        const meta = manifest.shards[sid]
        const localName = (meta && meta.file) || ''
        const localPath = path.join(art.shards, localName)
        if (!localName || !fs.existsSync(localPath)) {
          console.warn('缺少 shard 文件：' + sid)
          continue
        }
        const shardCloud =
          'code-assist/' + projectId + '/shards/' + now + '/' + localName
        const shardUp = await app.uploadFile({
          cloudPath: shardCloud,
          fileContent: fs.createReadStream(localPath),
        })
        const shardFID =
          shardUp.fileID ||
          (shardUp.fileList && shardUp.fileList[0] && shardUp.fileList[0].fileID) ||
          ''
        if (!shardFID) {
          console.warn('shard 上传失败：' + sid)
          continue
        }
        manifest.shards[sid].fileID = shardFID
        shardCount++
        if ((i + 1) % 20 === 0 || i === shardIds.length - 1) {
          console.log('  shards ' + (i + 1) + '/' + shardIds.length)
        }
      }
      const manCloud =
        'code-assist/' + projectId + '/xiaohei-manifest-' + now + '.json'
      const manTmp = path.join(art.outDir, 'xiaohei-manifest.upload.json')
      fs.writeFileSync(manTmp, JSON.stringify(manifest), 'utf8')
      const manUp = await app.uploadFile({
        cloudPath: manCloud,
        fileContent: fs.createReadStream(manTmp),
      })
      try {
        fs.unlinkSync(manTmp)
      } catch (e) {}
      manifestFileID =
        manUp.fileID ||
        (manUp.fileList && manUp.fileList[0] && manUp.fileList[0].fileID) ||
        ''
      if (!manifestFileID) {
        console.warn('manifest 上传失败')
      } else {
        console.log('manifestFileID: ' + manifestFileID)
        await db.collection(COL).doc(projectId).update({
          manifestFileID: manifestFileID,
          packMode: 'shards',
          shardCount: shardCount,
          updatedAt: Date.now(),
        })
        if (summaryDocId) {
          await db.collection(COL).doc(summaryDocId).update({
            manifestFileID: manifestFileID,
            updatedAt: Date.now(),
          })
        }
        console.log('已写入 packMode=shards（' + shardCount + ' shards）')
      }
    }
  } else {
    console.warn('未找到 manifest / shards，跳过切片上传')
  }

  return {
    projectId: projectId,
    fileID: fileID,
    name: name,
    manifestFileID: manifestFileID,
    shardCount: shardCount,
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const cfg = loadConfig()
  const project = resolveProject(cfg, flags.projectSlug)
  const isMulti = project.sources && project.sources.length > 0

  const outDir = path.join(TOOL_ROOT, 'out', project.slug)
  fs.mkdirSync(outDir, { recursive: true })
  const art = {
    outDir: outDir,
    pack: path.join(outDir, 'xiaohei-pack.json'),
    brief: path.join(outDir, 'xiaohei-brief.json'),
    manifest: path.join(outDir, 'xiaohei-manifest.json'),
    shards: path.join(outDir, 'xiaohei-shards'),
    aliases: path.join(outDir, 'xiaohei-aliases.json'),
    pageIndex: path.join(outDir, 'xiaohei-page-index.json'),
  }

  let sourcesFile = ''
  if (isMulti) {
    sourcesFile = path.join(outDir, '.sources.json')
    const normalized = []
    for (let i = 0; i < project.sources.length; i++) {
      const s = project.sources[i] || {}
      const srcPath = path.resolve(String(s.path || '').trim())
      if (!fs.existsSync(srcPath)) {
        throw new Error('source 不存在：' + srcPath)
      }
      normalized.push({
        key: String(s.key || '').trim(),
        label: String(s.label || s.key || '').trim(),
        path: srcPath,
      })
    }
    fs.writeFileSync(sourcesFile, JSON.stringify(normalized, null, 2) + '\n', 'utf8')
  } else {
    const source = path.resolve(project.source)
    if (!fs.existsSync(source)) {
      throw new Error('source 不存在：' + source)
    }
    project.source = source
  }

  console.log('发布项目：' + project.slug + '（' + project.name + '）')
  if (isMulti) {
    for (let i = 0; i < project.sources.length; i++) {
      const s = project.sources[i]
      console.log('  源 ' + s.key + '：' + path.resolve(s.path))
    }
  } else {
    console.log('source：' + project.source)
  }
  console.log('产物目录：' + path.relative(ROOT, outDir))

  console.log('=== 1/6 aliases（pages.json）===')
  if (isMulti) {
    runNode('code-assist/scripts/gen-aliases.mjs', ['--sources-file', sourcesFile, '--out', art.aliases])
  } else {
    runNode('code-assist/scripts/gen-aliases.mjs', ['--source', project.source, '--out', art.aliases])
  }

  console.log('=== 2/6 pageIndex（pages.json root/name/id）===')
  if (isMulti) {
    runNode('code-assist/scripts/gen-page-index.mjs', ['--sources-file', sourcesFile, '--out', art.pageIndex])
  } else {
    runNode('code-assist/scripts/gen-page-index.mjs', ['--source', project.source, '--out', art.pageIndex])
  }

  console.log('=== 3/6 pack ===')
  if (isMulti) {
    runNode('code-assist/scripts/pack.mjs', ['--sources-file', sourcesFile, '-o', art.pack])
  } else {
    runNode('code-assist/scripts/pack.mjs', [project.source, '-o', art.pack])
  }

  console.log('=== 4/6 shards ===')
  runNode('code-assist/scripts/split-shards.mjs', [art.pack])

  if (!flags.reuseBrief || !fs.existsSync(art.brief)) {
    if (!process.env.ZHIPU_API_KEY) {
      throw new Error('缺少 ZHIPU_API_KEY（或加 --reuse-brief 且已有 brief）')
    }
    console.log('=== 5/6 summarize ===')
    runNode('code-assist/scripts/summarize.mjs', [art.pack, '-o', art.brief])
  } else {
    console.log('=== 5/6 summarize（跳过，复用 brief）===')
  }

  if (!fs.existsSync(art.brief)) {
    throw new Error('缺少 brief：' + art.brief)
  }
  const brief = JSON.parse(fs.readFileSync(art.brief, 'utf8'))
  if (!brief.content) throw new Error('brief 缺少 content')

  if (flags.skipUpload) {
    writeProjectJs(cfg)
    console.log('已跳过上传（--skip-upload）。本地产物已就绪。')
    return
  }

  console.log('=== 6/6 上传并写库 ===')
  const res = await uploadAndWriteDb(cfg, project, art, brief)
  writeProjectJs(loadConfig())
  console.log('')
  console.log('发布完成。打开小黑页即可对话。')
  console.log('slug=' + project.slug)
  console.log('projectId=' + res.projectId)
  console.log('bundle=' + res.fileID)
  if (res.manifestFileID) {
    console.log('manifest=' + res.manifestFileID)
    console.log('shards=' + res.shardCount)
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch(function (e) {
    console.error((e && e.message) || e)
    process.exit(1)
  })
}
