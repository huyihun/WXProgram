/**
 * 一次性写入 mood_emojis 集合（含 fileID）
 * 在开发者工具：右键上传并部署 → 云函数测试调用
 * 可重复执行：会先清空集合再写入
 */
const cloud = require('wx-server-sdk')
const docs = require('./data.json')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COL = 'mood_emojis'
const PAGE = 100

async function removeAll() {
  while (true) {
    const res = await db.collection(COL).limit(PAGE).get()
    const list = res.data || []
    if (!list.length) break
    await Promise.all(list.map((row) => db.collection(COL).doc(row._id).remove()))
    if (list.length < PAGE) break
  }
}

exports.main = async () => {
  if (!docs || !docs.length) {
    return { ok: false, errMsg: 'data.json 为空' }
  }

  await removeAll()

  // 云函数 add 建议分批，避免超时
  let added = 0
  for (let i = 0; i < docs.length; i++) {
    await db.collection(COL).add({ data: docs[i] })
    added += 1
  }

  return { ok: true, added, sampleFileID: docs[0].fileID }
}
