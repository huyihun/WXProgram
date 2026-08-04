/**
 * 用户设置（云数据库）
 *
 * 使用前请在云开发控制台创建集合并设置「仅创建者可读写」：
 * - user_settings
 *
 * database 在函数内懒创建，避免 App 启动前白屏
 *
 * appVersion: 'default' | 'vip' | 'super'
 * 兼容旧字段 vipMode: boolean
 */

function getDb() {
  return wx.cloud.database()
}

function normalizeVersion(raw) {
  if (raw === 'vip' || raw === 'super' || raw === 'default') return raw
  if (raw === true) return 'vip'
  return 'default'
}

/** 读取当前用户版本，无记录则 default */
export async function fetchAppVersionSetting() {
  const res = await getDb().collection('user_settings').limit(1).get()
  const list = res.data || []
  if (!list.length) return 'default'
  const row = list[0]
  if (row.appVersion) return normalizeVersion(row.appVersion)
  return normalizeVersion(row.vipMode)
}

/** 写入版本（每用户一条） */
export async function saveAppVersionSetting(version) {
  const next = normalizeVersion(version)
  const now = Date.now()
  const col = getDb().collection('user_settings')
  const res = await col.limit(1).get()
  const list = res.data || []

  if (!list.length) {
    await col.add({
      data: {
        appVersion: next,
        vipMode: next !== 'default',
        updatedAt: now,
      },
    })
    return next
  }

  await col.doc(list[0]._id).update({
    data: {
      appVersion: next,
      vipMode: next !== 'default',
      updatedAt: now,
    },
  })
  return next
}

/** @deprecated 兼容旧调用 */
export async function fetchVipModeSetting() {
  const v = await fetchAppVersionSetting()
  return v !== 'default'
}

/** @deprecated 兼容旧调用 */
export async function saveVipModeSetting(vipMode) {
  return saveAppVersionSetting(vipMode ? 'vip' : 'default')
}
