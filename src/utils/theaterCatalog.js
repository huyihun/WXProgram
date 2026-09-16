/**
 * 剧场：从小和太子过命之交（20 集）
 * fileID 来自云存储导出 assets/video/taizi/taizi.json
 */
const EPISODES = [
  {
    ep: 1,
    title: '第 1 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/1.mp4',
  },
  {
    ep: 2,
    title: '第 2 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/2.mp4',
  },
  {
    ep: 3,
    title: '第 3 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/3.mp4',
  },
  {
    ep: 4,
    title: '第 4 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/4.mp4',
  },
  {
    ep: 5,
    title: '第 5 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/5.mp4',
  },
  {
    ep: 6,
    title: '第 6 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/6.mp4',
  },
  {
    ep: 7,
    title: '第 7 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/7.mp4',
  },
  {
    ep: 8,
    title: '第 8 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/8.mp4',
  },
  {
    ep: 9,
    title: '第 9 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/9.mp4',
  },
  {
    ep: 10,
    title: '第 10 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/10.mp4',
  },
  {
    ep: 11,
    title: '第 11 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/11.mp4',
  },
  {
    ep: 12,
    title: '第 12 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/12.mp4',
  },
  {
    ep: 13,
    title: '第 13 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/13.mp4',
  },
  {
    ep: 14,
    title: '第 14 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/14.mp4',
  },
  {
    ep: 15,
    title: '第 15 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/15.mp4',
  },
  {
    ep: 16,
    title: '第 16 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/16.mp4',
  },
  {
    ep: 17,
    title: '第 17 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/17.mp4',
  },
  {
    ep: 18,
    title: '第 18 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/18.mp4',
  },
  {
    ep: 19,
    title: '第 19 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/19.mp4',
  },
  {
    ep: 20,
    title: '第 20 集',
    fileID:
      'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/20.mp4',
  },
]

export const THEATER_SHOW = {
  id: 'taizi',
  title: '从小和太子过命之交',
  desc: '全 20 集',
  coverFileID:
    'cloud://cloudbase-d7g0orq1z360a029f.636c-cloudbase-d7g0orq1z360a029f-1304836152/video/taizi/cover.jpeg',
  episodeCount: EPISODES.length,
  episodes: EPISODES,
}

export function getTheaterShow() {
  return THEATER_SHOW
}

export function getEpisode(ep) {
  const n = Number(ep) || 1
  const list = THEATER_SHOW.episodes
  for (let i = 0; i < list.length; i++) {
    if (list[i].ep === n) return list[i]
  }
  return list[0] || null
}
