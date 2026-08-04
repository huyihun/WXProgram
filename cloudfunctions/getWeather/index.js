/**
 * 和风天气转发（密钥仅存云函数环境变量）
 *
 * 环境变量：QWEATHER_KEY、QWEATHER_HOST（控制台 API Host，勿加 https://）
 * 入参：{ city } 仅支持「天河区」「泰和县」
 * 出参：{ ok, city, temp, text, icon } 或 { ok:false, errMsg }
 */
const cloud = require('wx-server-sdk')
const https = require('https')
const zlib = require('zlib')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CITY_IDS = {
  天河区: '101280109',
  泰和县: '101240611',
}

function httpGetJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          let buf = Buffer.concat(chunks)
          const enc = String(res.headers['content-encoding'] || '')
          if (enc.indexOf('gzip') >= 0) buf = zlib.gunzipSync(buf)
          else if (enc.indexOf('deflate') >= 0) buf = zlib.inflateSync(buf)

          let text = buf.toString('utf8')
          if (text.charAt(0) !== '{' && text.charAt(0) !== '[') {
            text = zlib.gunzipSync(Buffer.concat(chunks)).toString('utf8')
          }
          resolve(JSON.parse(text))
        } catch (e) {
          reject(new Error('天气接口返回解析失败'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(8000, () => req.destroy(new Error('天气接口超时')))
  })
}

exports.main = async (event) => {
  const key = process.env.QWEATHER_KEY || ''
  const host = (process.env.QWEATHER_HOST || '').replace(/^https?:\/\//, '').trim()
  if (!key) return { ok: false, errMsg: '未配置 QWEATHER_KEY' }
  if (!host) return { ok: false, errMsg: '未配置 QWEATHER_HOST' }

  const city = event && event.city ? String(event.city).trim() : ''
  const locationId = CITY_IDS[city]
  if (!locationId) {
    return { ok: false, errMsg: '仅支持天河区、泰和县' }
  }

  try {
    const data = await httpGetJson(
      'https://' + host + '/v7/weather/now?location=' + locationId + '&lang=zh',
      {
        'X-QW-Api-Key': key,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
      }
    )
    if (!data || data.code !== '200' || !data.now) {
      return {
        ok: false,
        errMsg: '实时天气获取失败(' + ((data && data.code) || '无code') + ')',
      }
    }
    return {
      ok: true,
      city: city,
      temp: data.now.temp || '',
      text: data.now.text || '',
      icon: data.now.icon || '',
    }
  } catch (err) {
    return { ok: false, errMsg: (err && err.message) || '天气服务异常' }
  }
}
