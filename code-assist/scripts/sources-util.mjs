/**
 * 多源项目：读取 --sources-file JSON
 * [{ key, label, path }]
 */
import fs from 'fs'
import path from 'path'

export function parseSourcesArg(argv) {
  let sourcesFile = ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sources-file') {
      sourcesFile = String(argv[i + 1] || '').trim()
      i += 1
    }
  }
  return sourcesFile
}

export function loadSourcesFile(sourcesFile) {
  if (!sourcesFile) return []
  const abs = path.resolve(sourcesFile)
  if (!fs.existsSync(abs)) throw new Error('sources-file 不存在：' + abs)
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'))
  if (!Array.isArray(raw) || !raw.length) throw new Error('sources-file 需为非空数组')
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] || {}
    const key = String(item.key || '').trim()
    const label = String(item.label || key).trim()
    const srcPath = path.resolve(String(item.path || '').trim())
    if (!key || !srcPath) throw new Error('sources 项缺少 key/path')
    if (!fs.existsSync(srcPath)) throw new Error('source 不存在：' + srcPath)
    out.push({ key: key, label: label, path: srcPath })
  }
  return out
}

export function sourceKeySet(sources) {
  const set = {}
  for (let i = 0; i < sources.length; i++) {
    set[sources[i].key] = 1
  }
  return set
}
