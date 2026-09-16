/**
 * 将壁纸素材扁平化为短 id，便于上传云存储
 *
 * 用法：npm run wallpapers:pack
 * 输出：assets/wallpaper/zhencang/w001.jpg… + catalog.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SOURCE_DIR = path.join(ROOT, 'assets', '精选美女手机壁纸素材（珍藏）')
const OUT_DIR = path.join(ROOT, 'assets', 'wallpaper', 'zhencang')

const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function walkImages(dir, list) {
  const names = fs.readdirSync(dir)
  names.sort(function (a, b) {
    return a.localeCompare(b, 'zh')
  })
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (name === '.DS_Store') continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      walkImages(full, list)
      continue
    }
    // 无扩展名也尝试当图片（部分素材文件名是纯数字）
    if (IMG_EXT.test(name) || !path.extname(name)) {
      list.push(full)
    }
  }
}

function albumFromPath(filePath) {
  const rel = path.relative(SOURCE_DIR, filePath)
  const parts = rel.split(path.sep)
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i]
    const m = p.match(/编号\s*(A-\d+)/i) || p.match(/(A-\d+)/i)
    if (m) return m[1].toUpperCase()
  }
  return parts[0] || 'misc'
}

function detectExt(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jpeg') return '.jpg'
  if (ext === '.jpg' || ext === '.png' || ext === '.webp' || ext === '.gif') return ext
  // 无扩展名：读文件头猜
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(16)
  fs.readSync(fd, buf, 0, 16, 0)
  fs.closeSync(fd)
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return '.png'
  if (buf[0] === 0x47 && buf[1] === 0x49) return '.gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return '.webp'
  }
  return '.jpg'
}

function padId(n) {
  const s = String(n)
  if (s.length >= 3) return 'w' + s
  return 'w' + ('000' + s).slice(-3)
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('源目录不存在:', SOURCE_DIR)
    process.exit(1)
  }

  const files = []
  walkImages(SOURCE_DIR, files)
  if (!files.length) {
    console.error('未找到图片')
    process.exit(1)
  }

  rmrf(OUT_DIR)
  ensureDir(OUT_DIR)

  const items = []
  for (let i = 0; i < files.length; i++) {
    const src = files[i]
    const id = padId(i + 1)
    const ext = detectExt(src)
    const file = id + ext
    const dest = path.join(OUT_DIR, file)
    fs.copyFileSync(src, dest)
    items.push({
      id: id,
      file: file,
      album: albumFromPath(src),
    })
    if ((i + 1) % 20 === 0 || i === files.length - 1) {
      console.log('已处理', i + 1, '/', files.length)
    }
  }

  const catalog = {
    title: '壁纸',
    items: items,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8')

  console.log('完成：', items.length, '张 →', OUT_DIR)
  console.log('请将 assets/wallpaper/zhencang/ 上传到云存储 wallpaper/zhencang/')
}

main()
