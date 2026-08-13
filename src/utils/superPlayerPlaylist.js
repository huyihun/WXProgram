/**
 * 原生母带歌单（flac/wav，来自 music/md）
 */
const MD_PREFIX =
  'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/music/md/'

function track(id, fileName, title, artist) {
  return {
    id: id,
    title: title,
    artist: artist || '',
    fileID: MD_PREFIX + fileName,
  }
}

/** 清单来自 md.json 云存储目录（不含 cover.jpg） */
export const SUPER_PLAYER_PLAYLIST = [
  track('md-xixili', '01 - 西西里.flac', '西西里', ''),
  track('md-xiangjiandelu', '03 - 乡间的路.flac', '乡间的路', ''),
  track('md-taojinxiaozhen', '04 - 淘金小镇.flac', '淘金小镇', ''),
  track('md-tuihou-live', '04、周杰伦 - 退后（Live）.wav', '退后（Live）', '周杰伦'),
  track('md-zuichangdedianying-live', '06、周杰伦 - 最长的电影（Live）.wav', '最长的电影（Live）', '周杰伦'),
  track('md-ido', '07 - I Do.flac', 'I Do', ''),
  track('md-pugongying-live', '07、周杰伦 - 蒲公英的约定（Live）.wav', '蒲公英的约定（Live）', '周杰伦'),
  track('md-qiyuedejiguang', '09 - 七月的极光.flac', '七月的极光', ''),
  track('md-natianshuxiayu', '12 - 那天下雨了.flac', '那天下雨了', ''),
  track('md-taiyangzhizi', '13 - 太阳之子.flac', '太阳之子', ''),
  track('md-yequ-live', '15、周杰伦 - 夜曲（Live）.wav', '夜曲（Live）', '周杰伦'),
  track('md-midiexiang-live', '16、周杰伦 - 迷迭香（Live）.wav', '迷迭香（Live）', '周杰伦'),
  track('md-faruxue', '周杰伦 - 发如雪.flac', '发如雪', '周杰伦'),
  track('md-gaobaiqiqiu', '周杰伦 - 告白气球.flac', '告白气球', '周杰伦'),
  track('md-zhizhanzhishang', '周杰伦 - 止战之殇.flac', '止战之殇', '周杰伦'),
  track('md-yanhuayileng', '周杰伦 - 烟花易冷.flac', '烟花易冷', '周杰伦'),
  track('md-milandexiaojiang', '周杰伦 - 米兰的小铁匠.flac', '米兰的小铁匠', '周杰伦'),
  track('md-waipo', '外婆.wav', '外婆', ''),
  track('md-weiliangubao', '威廉古堡.wav', '威廉古堡', ''),
  track('md-anhao', '暗号.wav', '暗号', ''),
  track('md-feng', '枫.wav', '枫', ''),
  track('md-guiji', '轨迹.wav', '轨迹', ''),
]
