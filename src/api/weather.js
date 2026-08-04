/**
 * 首页天气：仅广州天河区 / 泰和县，默认天河区；点击可切换
 */

const CACHE_KEY = 'weatherCache'
const CITY_KEY = 'weatherCityPref'
const CACHE_MS = 30 * 60 * 1000
const DEFAULT_CITY = '天河区'

export const COMMON_CITIES = ['天河区', '泰和县']

function isAllowedCity(city) {
  return COMMON_CITIES.indexOf(city) >= 0
}

function readCache() {
  try {
    return uni.getStorageSync(CACHE_KEY) || null
  } catch (err) {
    return null
  }
}

function writeCache(data) {
  try {
    uni.setStorageSync(CACHE_KEY, {
      city: data.city,
      temp: data.temp,
      text: data.text,
      icon: data.icon || '',
      savedAt: Date.now(),
    })
  } catch (err) {
    console.error('写入天气缓存失败', err)
  }
}

export function getPreferredCity() {
  try {
    const city = uni.getStorageSync(CITY_KEY) || ''
    return isAllowedCity(city) ? city : ''
  } catch (err) {
    return ''
  }
}

export function setPreferredCity(city) {
  if (!isAllowedCity(city)) return
  try {
    uni.setStorageSync(CITY_KEY, city)
  } catch (err) {
    console.error('保存天气城市失败', err)
  }
}

export async function fetchWeather(params) {
  const payload = params || {}
  try {
    const res = await uni.cloud.callFunction({
      name: 'getWeather',
      data: payload,
    })
    const body = res && res.result ? res.result : null
    if (!body || !body.ok) {
      console.error('天气云函数失败', body && body.errMsg)
      return null
    }
    return {
      city: body.city || '',
      temp: body.temp || '',
      text: body.text || '',
      icon: body.icon || '',
    }
  } catch (err) {
    console.error('调用天气云函数异常', err)
    return null
  }
}

function fromCache(cache) {
  return {
    city: cache.city,
    temp: cache.temp,
    text: cache.text,
    icon: cache.icon || '',
  }
}

/**
 * 加载首页天气
 * @param {{ city?: string, force?: boolean }} options
 */
export async function loadHomeWeather(options) {
  const opts = options || {}
  let forcedCity = (opts.city || '').trim()
  if (forcedCity && !isAllowedCity(forcedCity)) forcedCity = ''

  if (forcedCity) {
    setPreferredCity(forcedCity)
    const result = await fetchWeather({ city: forcedCity })
    if (result) writeCache(result)
    return result
  }

  const preferCity = getPreferredCity() || DEFAULT_CITY
  const cache = readCache()
  const cacheFresh =
    cache &&
    cache.savedAt &&
    Date.now() - cache.savedAt <= CACHE_MS &&
    isAllowedCity(cache.city)

  if (!opts.force && cacheFresh && cache.city === preferCity) {
    return fromCache(cache)
  }

  const result = await fetchWeather({ city: preferCity })
  if (result) {
    writeCache(result)
    return result
  }

  if (cacheFresh) return fromCache(cache)
  return null
}
