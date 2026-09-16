/** 安徒生童话绘本试读（PDF 页图，仅含 1～2 个故事） */
export const PICTUREBOOK_CATALOG = [
  {
    id: 'ugly-duckling',
    title: '丑小鸭',
    desc: '安徒生 · 彩绘注音',
    cover: '/static/picturebook/ugly-duckling/01.jpg',
    pageCount: 7,
    pages: [
      '/static/picturebook/ugly-duckling/01.jpg',
      '/static/picturebook/ugly-duckling/02.jpg',
      '/static/picturebook/ugly-duckling/03.jpg',
      '/static/picturebook/ugly-duckling/04.jpg',
      '/static/picturebook/ugly-duckling/05.jpg',
      '/static/picturebook/ugly-duckling/06.jpg',
      '/static/picturebook/ugly-duckling/07.jpg',
    ],
  },
  {
    id: 'princess-pea',
    title: '豌豆上的公主',
    desc: '安徒生 · 彩绘注音',
    cover: '/static/picturebook/princess-pea/01.jpg',
    pageCount: 3,
    pages: [
      '/static/picturebook/princess-pea/01.jpg',
      '/static/picturebook/princess-pea/02.jpg',
      '/static/picturebook/princess-pea/03.jpg',
    ],
  },
]

export function getPicturebookById(id) {
  for (let i = 0; i < PICTUREBOOK_CATALOG.length; i++) {
    if (PICTUREBOOK_CATALOG[i].id === id) return PICTUREBOOK_CATALOG[i]
  }
  return null
}
