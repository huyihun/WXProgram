/**
 * 首页歌单（微信云存储 fileID）
 *
 * 真机：完整下载到本地后再播（onCanplay 更可靠）
 * 二次打开：读 USER_DATA_PATH 持久缓存，接近秒开
 * App 启动时 warmMusicCache 可提前下好
 *
 * 上传：控制台云存储 → music/ 目录
 * 本地待上传源文件：assets/music/shengxia_de_guoshi.mp3
 */
import { JX_PLAYLIST, MUSIC_MODE_JX } from './jxPlaylist'
import {
  getMusicPrefsState,
  ensureMusicPrefs,
  ensureLocalMusicPrefs,
  saveMusicPrefs,
  saveRemovedLocalOnly,
} from '@/api/musicPrefs'

export { MUSIC_MODE_JX, JX_PLAYLIST }

/** 默认歌单 */
export const PLAYLIST = [
  {
    id: 'shengxia-de-guoshi',
    title: '盛夏的果实',
    artist: '莫文蔚',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/shengxia_de_guoshi.mp3',
  },
  {
    id: 'cmzw',
    title: '成名在望',
    artist: '五月天',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/五月天-成名在望.mp3',
  },
  {
    id: 'xpzg',
    title: '小胖之歌',
    artist: '小胖',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/怪阿姨+-+放纵.mp3',
  },
  {
    id: 'sdnb',
    title: '米米米',
    artist: '米其林',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/黄霄雲+-+山河.mp3',
  },
  {
    id: 'nahan',
    title: '辣',
    artist: '辣条',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/张韶涵-呐喊.mp3',
  },
  {
    id: 'qifengle',
    title: '风萧萧',
    artist: '易水寒',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/买辣椒也用券 - 起风了.mp3',
  },
  {
    id: 'baige-wuya',
    title: '心痛2022',
    artist: '蝙蝠侠',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/艾辰+-+白鸽乌鸦相爱的戏码.mp3',
  },
  {
    id: 'east-of-eden',
    title: '伊甸园',
    artist: '佐罗',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/zella day-east of eden.mp3',
  },
  {
    id: 'zella-1965',
    title: '恩佐费尔南德斯',
    artist: '恩佐',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/Zella Day - 1965.mp3',
  },
  {
    id: 'that-girl',
    title: '猪之歌',
    artist: '猪猪女孩',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/Olly Murs-That Girl.mp3',
  },
  {
    id: 'bu-hui-xinglai',
    title: '恋曲1987',
    artist: '梅艳芳',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/My+Stage-不会醒来的梦+(Live)+-+尤长靖、Wiz_H张子豪.mp3',
  },
  {
    id: 'shunqiziran',
    title: '无所吊谓',
    artist: '顺其自然',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/exo - 顺其自然.mp3',
  },
  {
    id: 'weixinzhong',
    title: '不知名歌曲',
    artist: '不知名歌手',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/五月天-我心中尚未崩坏的地方.mp3',
  },
  {
    id: 'shanzhashu',
    title: '匡怡',
    artist: 'ky',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/山楂树之恋.mp3',
  },
  {
    id: 'xzss',
    title: '恋曲2020',
    artist: '深井冰',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/许嵩-星座书上.mp3',
  },
]

/** VIP 专属歌单（云存储 music/vip/） */
const VIP_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/vip/'

export const VIP_PLAYLIST = [
  {
    id: 'vip-xiaoban',
    title: '小半',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒- 小半.mp3',
  },
  {
    id: 'vip-wumingderen',
    title: '无名的人',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-无名的人.mp3',
  },
  {
    id: 'vip-xiaochou',
    title: '消愁',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 消愁(1).mp3',
  },
  {
    id: 'vip-zouma',
    title: '走马',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-走马.mp3',
  },
  {
    id: 'vip-xiangwo',
    title: '像我这样的人',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易+-+像我这样的人.mp3',
  },
  {
    id: 'vip-muma-chengshi',
    title: '牧马城市',
    artist: '毛不易',
    fileID: VIP_PREFIX + '牧马城市.mp3',
  },

  {
    id: 'vip-jie',
    title: '借',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易+-+借.mp3',
  },
  {
    id: 'vip-deng',
    title: '等',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易+-+等.mp3',
  },
  {
    id: 'vip-shiguangzhe',
    title: '拾光者',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-拾光者.mp3',
  },
  {
    id: 'vip-shengxia',
    title: '盛夏',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-盛夏.mp3',
  },
  {
    id: 'vip-ruhai',
    title: '入海',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-入海.mp3',
  },
  {
    id: 'vip-qingchun',
    title: '青春',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-青春.mp3',
  },
  {
    id: 'vip-nifeng',
    title: '逆风',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-逆风.mp3',
  },
  {
    id: 'vip-buran',
    title: '不染',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-不染.mp3',
  },
  {
    id: 'vip-17',
    title: '17',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易-17.mp3',
  },
  {
    id: 'vip-yuan',
    title: '愿',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 愿.mp3',
  },
  {
    id: 'vip-yiyu',
    title: '呓语',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 呓语.mp3',
  },

  {
    id: 'vip-wuwen',
    title: '无问',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 无问.mp3',
  },
  {
    id: 'vip-muma-live',
    title: '牧马城市(Live)',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 牧马城市(Live).mp3',
  },
  {
    id: 'vip-huohua',
    title: '火花',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 火花.mp3',
  },
  {
    id: 'vip-hong',
    title: '红',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 红.mp3',
  },
  {
    id: 'vip-caomu',
    title: '草右',
    artist: '毛不易',
    fileID: VIP_PREFIX + '毛不易 - 草右.mp3',
  },
  {
    id: 'vip-zhuxing',
    title: '祝星',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒+-+祝星.mp3',
  },

  {
    id: 'vip-yiranyi',
    title: '易燃易爆炸',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-易燃易爆炸.mp3',
  },
  {
    id: 'vip-xuni',
    title: '虚拟',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-虚拟.mp3',
  },
  {
    id: 'vip-guang',
    title: '光',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒-光.mp3',
  },

  {
    id: 'vip-zidu',
    title: '自渡',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 自渡.mp3',
  },
  {
    id: 'vip-xingye',
    title: '星夜',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 星夜.mp3',
  },
  {
    id: 'vip-xitai',
    title: '戏台',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 戏台.mp3',
  },
  {
    id: 'vip-wangchuan',
    title: '望穿',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 望穿.mp3',
  },
  {
    id: 'vip-sihai',
    title: '四海',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 四海.mp3',
  },
  {
    id: 'vip-qingzhu',
    title: '庆祝',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 庆祝.mp3',
  },
  {
    id: 'vip-qilou',
    title: '七楼',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 七楼.mp3',
  },
  {
    id: 'vip-guoshi',
    title: '果实',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 果实.mp3',
  },
  {
    id: 'vip-congtou',
    title: '从头',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 从头.mp3',
  },
  {
    id: 'vip-buchao',
    title: '不妙',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 不妙.mp3',
  },
  {
    id: 'vip-airuo',
    title: '爱若',
    artist: '陈粒',
    fileID: VIP_PREFIX + '陈粒 - 爱若.mp3',
  },
  {
    id: 'vip-star',
    title: '★',
    artist: '陈粒',
    fileID: VIP_PREFIX + '/陈粒 - ★.mp3',
  },
]

export const MUSIC_MODE_DEFAULT = 'default'
export const MUSIC_MODE_VIP = 'vip'
export const MUSIC_MODE_SUPER = 'super'

/** 超级 VIP：周杰伦歌单（云存储 music/zjl/） */
export const SUPER_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/zjl/'

export const SUPER_VIP_PLAYLIST = [
  {
    id: 'super-hongchenkejian',
    title: '红尘客栈',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '红尘客栈.mp3',
  },
  { id: 'super-mojito', title: 'Mojito', artist: '周杰伦', fileID: SUPER_PREFIX + 'Mojito.mp3' },
  {
    id: 'super-yanhuayileng',
    title: '烟花易冷',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '周杰伦-烟花易冷.mp3',
  },
  {
    id: 'super-taojinxiaozhen',
    title: '淘金小镇',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '淘金小镇.mp3',
  },
  {
    id: 'super-longzhanqishi',
    title: '龙战骑士',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '周杰伦-龙战骑士.mp3',
  },
  {
    id: 'super-mingmingjiu',
    title: '明明就',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '周杰伦-明明就.mp3',
  },
  {
    id: 'super-taiyangzhizi',
    title: '太阳之子',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '太阳之子.mp3',
  },
  {
    id: 'super-xiangnvduoqing',
    title: '湘女多情',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '湘女多情.mp3',
  },
  {
    id: 'super-weiliangubao',
    title: '威廉古堡',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '威廉古堡.mp3',
  },
  { id: 'super-waipo', title: '外婆', artist: '周杰伦', fileID: SUPER_PREFIX + '外婆.mp3' },

  { id: 'super-qingtian', title: '晴天', artist: '周杰伦', fileID: SUPER_PREFIX + '晴天.mp3' },
  { id: 'super-qilixiang', title: '七里香', artist: '周杰伦', fileID: SUPER_PREFIX + '七里香.mp3' },
  { id: 'super-lantingxu', title: '兰亭序', artist: '周杰伦', fileID: SUPER_PREFIX + '兰亭序.mp3' },
  { id: 'super-jiekou', title: '借口', artist: '周杰伦', fileID: SUPER_PREFIX + '借口.mp3' },
  { id: 'super-huasha', title: '画沙', artist: '周杰伦', fileID: SUPER_PREFIX + '画沙.mp3' },
  { id: 'super-gejian', title: '搁浅', artist: '周杰伦', fileID: SUPER_PREFIX + '搁浅.mp3' },
  {
    id: 'super-gaobaiqiqiu',
    title: '告白气球',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '告白气球.mp3',
  },
  { id: 'super-feng', title: '枫', artist: '周杰伦', fileID: SUPER_PREFIX + '枫.mp3' },
  {
    id: 'super-fensehaiyang',
    title: '粉色海洋',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '粉色海洋.mp3',
  },
  { id: 'super-caihong', title: '彩虹', artist: '周杰伦', fileID: SUPER_PREFIX + '彩虹.mp3' },
  {
    id: 'super-bandaotiehe',
    title: '半岛铁盒',
    artist: '周杰伦',
    fileID: SUPER_PREFIX + '半岛铁盒.mp3',
  },
]

function loadPinnedFileIds(mode) {
  const prefs = getMusicPrefsState()
  const list = prefs.pinned && prefs.pinned[mode || 'default']
  return list && list.length ? list : []
}

function filterRemoved(list) {
  const prefs = getMusicPrefsState()
  const removedList = prefs.removed || []
  const removed = {}
  for (let i = 0; i < removedList.length; i++) {
    removed[removedList[i]] = true
  }
  const out = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (t && t.fileID && removed[t.fileID]) continue
    out.push(t)
  }
  return out
}

/** 置顶曲目排前，其余保持原顺序 */
function applyPinnedOrder(list, mode) {
  const pinned = loadPinnedFileIds(mode)
  if (!pinned.length) return list

  const byId = {}
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (t && t.fileID) byId[t.fileID] = t
  }

  const top = []
  const used = {}
  for (let i = 0; i < pinned.length; i++) {
    const fid = pinned[i]
    if (!byId[fid] || used[fid]) continue
    top.push(byId[fid])
    used[fid] = true
  }

  const rest = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (!t || !t.fileID || used[t.fileID]) continue
    rest.push(t)
  }
  return top.concat(rest)
}

export function getPlaylistByMode(mode) {
  let list = PLAYLIST
  if (mode === MUSIC_MODE_SUPER) list = SUPER_VIP_PLAYLIST
  else if (mode === MUSIC_MODE_VIP) list = VIP_PLAYLIST
  else if (mode === MUSIC_MODE_JX) list = JX_PLAYLIST
  return applyPinnedOrder(filterRemoved(list), mode)
}

/** 拉取云端偏好（启动时调用） */
export async function syncMusicPrefs() {
  await ensureMusicPrefs()
}

/** 是否已置顶 */
export function isMusicPinned(mode, fileID) {
  if (!fileID) return false
  return loadPinnedFileIds(mode).indexOf(fileID) >= 0
}

/** 置顶到第一位（再次点击仍移到第一位，不取消） */
export async function togglePinMusic(mode, fileID) {
  if (!fileID) return false
  await ensureMusicPrefs()
  const prefs = getMusicPrefsState()
  if (!prefs.pinned) prefs.pinned = {}
  const key = mode || 'default'
  const list = (prefs.pinned[key] || []).slice()
  const at = list.indexOf(fileID)
  if (at >= 0) list.splice(at, 1)
  list.unshift(fileID)
  prefs.pinned[key] = list
  await saveMusicPrefs()
  return true
}

function clearPinnedFileId(fileID) {
  if (!fileID) return false
  const prefs = getMusicPrefsState()
  if (!prefs.pinned) return false
  let changed = false
  const modes = Object.keys(prefs.pinned)
  for (let i = 0; i < modes.length; i++) {
    const list = prefs.pinned[modes[i]]
    if (!list || !list.length) continue
    const at = list.indexOf(fileID)
    if (at < 0) continue
    list.splice(at, 1)
    changed = true
  }
  return changed
}

/** 从列表隐藏（先写本地，再由 deleteMusicFile 同步云库 removed） */
export function markMusicRemoved(fileID) {
  if (!fileID) return
  const prefs = ensureLocalMusicPrefs()
  if (!prefs.removed) prefs.removed = []
  if (prefs.removed.indexOf(fileID) < 0) {
    prefs.removed.push(fileID)
  }
  clearPinnedFileId(fileID)
  saveRemovedLocalOnly()
}

/** 同步 removed/pinned 到云库，并删除云存储 mp3 */
export async function deleteMusicFile(fileID) {
  if (!fileID) return

  try {
    await ensureMusicPrefs()
    await saveMusicPrefs()
  } catch (e) {
    console.warn('[playlist] 删除记录同步云库失败', e)
  }

  if (!wx.cloud) return

  try {
    const res = await wx.cloud.callFunction({
      name: 'getMusicUrl',
      data: { fileID, action: 'delete' },
    })
    const body = res.result || {}
    if (!body.ok) {
      console.warn('[playlist] 删除文件失败', body.errMsg)
    }
  } catch (e) {
    console.warn('[playlist] 删除文件异常', e)
  }
}

const memCache = {}
const inflight = {}

function getPersistPath(trackId) {
  const root = (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) || ''
  if (!root) return ''
  return root + '/music_' + trackId + '.mp3'
}

function hasLocalFile(path) {
  if (!path) return false
  try {
    uni.getFileSystemManager().accessSync(path)
    return true
  } catch (e) {
    return false
  }
}

/** 云函数换临时 HTTPS */
export async function getPlayUrl(fileID) {
  if (!fileID) return ''
  if (!wx.cloud) throw new Error('云能力不可用')

  const res = await wx.cloud.callFunction({
    name: 'getMusicUrl',
    data: { fileID },
  })
  const body = res.result || {}
  if (!body.ok || !body.tempFileURL) {
    throw new Error(body.errMsg || '获取播放地址失败')
  }
  return body.tempFileURL
}

function downloadToPath(url, filePath) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          reject(new Error('下载音频失败 ' + (res.statusCode || '')))
          return
        }
        if (!filePath) {
          resolve(res.tempFilePath)
          return
        }
        try {
          uni.getFileSystemManager().saveFile({
            tempFilePath: res.tempFilePath,
            filePath,
            success: () => resolve(filePath),
            fail: () => resolve(res.tempFilePath),
          })
        } catch (e) {
          resolve(res.tempFilePath)
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '下载音频失败'
        if (String(msg).indexOf('url not in domain list') >= 0) {
          reject(new Error('需配置downloadFile域名'))
          return
        }
        reject(new Error(msg))
      },
    })
  })
}

/**
 * 解析可播路径：本地 src 直接返回；云曲目缓存命中或下载落盘
 */
export async function resolvePlaySource(track) {
  if (!track) return ''
  if (track.src) {
    memCache[track.id] = track.src
    return track.src
  }
  if (!track.fileID) return ''
  if (memCache[track.id]) return memCache[track.id]

  const persistPath = getPersistPath(track.id)
  if (hasLocalFile(persistPath)) {
    memCache[track.id] = persistPath
    return persistPath
  }

  if (inflight[track.id]) return inflight[track.id]

  inflight[track.id] = (async () => {
    const url = await getPlayUrl(track.fileID)
    const path = await downloadToPath(url, persistPath)
    memCache[track.id] = path
    return path
  })()

  try {
    return await inflight[track.id]
  } finally {
    inflight[track.id] = null
  }
}

/** 启动预热：本地曲直接命中，云曲提前下载 */
export async function warmMusicCache(track) {
  if (!track) return ''
  return resolvePlaySource(track)
}

/** 兼容旧调用 */
export async function getLocalPlayPath(fileID) {
  const all = PLAYLIST.concat(VIP_PLAYLIST).concat(SUPER_VIP_PLAYLIST)
  for (let i = 0; i < all.length; i++) {
    if (all[i].fileID === fileID) {
      return resolvePlaySource(all[i])
    }
  }
  const url = await getPlayUrl(fileID)
  return downloadToPath(url, '')
}
