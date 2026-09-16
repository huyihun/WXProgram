/**
 * 轻量源码高亮 → rich-text HTML（暗色柔和）
 * 顺序：转义 → 注释/字符串占位 → 关键字/数字 → 还原
 */

var KW =
  'await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|function|if|import|in|instanceof|let|new|null|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield|async|from|as|of|type|interface|enum|implements|package|private|protected|public|readonly|implements'

var KW_RE = new RegExp('\\b(' + KW + ')\\b', 'g')

var COLORS = {
  base: '#cbd5e1',
  kw: '#7dd3fc',
  str: '#fbbf24',
  cmt: '#6ee7b7',
  num: '#c4b5fd',
  tag: '#f9a8d4',
  attr: '#a5b4fc',
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function span(color, text) {
  return '<span style="color:' + color + '">' + text + '</span>'
}

/**
 * @param {string} source
 * @param {string} [filePath]
 * @returns {string} HTML
 */
export function highlightCode(source, filePath) {
  var raw = String(source || '')
  if (!raw) return ''
  var path = String(filePath || '').toLowerCase()
  var isVue = path.indexOf('.vue') >= 0 || raw.indexOf('<template') >= 0

  var slots = []
  function save(html) {
    var i = slots.length
    slots.push(html)
    return '\u0000' + i + '\u0000'
  }

  var text = escapeHtml(raw)

  // 注释
  text = text.replace(/\/\*[\s\S]*?\*\//g, function (m) {
    return save(span(COLORS.cmt, m))
  })
  text = text.replace(/(^|[^:])\/\/.*$/gm, function (m) {
    return save(span(COLORS.cmt, m))
  })
  text = text.replace(/(&lt;!--[\s\S]*?--&gt;)/g, function (m) {
    return save(span(COLORS.cmt, m))
  })

  // 字符串
  text = text.replace(/`(?:\\.|[^`\\])*`/g, function (m) {
    return save(span(COLORS.str, m))
  })
  text = text.replace(/'(?:\\.|[^'\\])*'/g, function (m) {
    return save(span(COLORS.str, m))
  })
  text = text.replace(/"(?:\\.|[^"\\])*"/g, function (m) {
    return save(span(COLORS.str, m))
  })

  // 数字
  text = text.replace(/\b(\d+\.?\d*)\b/g, function (m) {
    return span(COLORS.num, m)
  })

  // 关键字
  text = text.replace(KW_RE, function (m) {
    return span(COLORS.kw, m)
  })

  // vue 标签名（已转义的 &lt;tag）
  if (isVue) {
    text = text.replace(/&lt;(\/?[a-zA-Z][\w-]*)/g, function (_, name) {
      return '&lt;' + span(COLORS.tag, name)
    })
  }

  // 还原占位
  text = text.replace(/\u0000(\d+)\u0000/g, function (_, i) {
    return slots[Number(i)] || ''
  })

  return (
    '<div style="color:' +
    COLORS.base +
    ';font-family:Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-all;">' +
    text +
    '</div>'
  )
}
