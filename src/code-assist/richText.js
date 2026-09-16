/**
 * 小黑回复：Markdown 轻量解析（表格 / 换行 / 粗体 / 行内代码）
 * - parseMdBlocks：气泡原生表格 + canvas 截图
 * - mdToRichHtml：rich-text 文本段（表格由 native view 渲染）
 */

const CANVAS_OPTS = {
  pad: 20,
  titleH: 36,
  lineH: 22,
  fontSize: 15,
  tablePadX: 8,
  tablePadY: 8,
  tableMargin: 8,
  tableLineH: 18,
  tableFontSize: 13,
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripInlineMd(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function inlineFormat(s) {
  let t = escapeHtml(s)
  t = t.replace(/`([^`]+)`/g, '<code style="color:#7dd3fc;background:rgba(15,23,42,0.85);padding:0 4px;border-radius:3px;font-size:12px;">$1</code>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f0f9ff;font-weight:700;">$1</strong>')
  return t
}

function isTableSepLine(line) {
  const t = String(line || '').trim()
  if (!t || t.indexOf('|') < 0 || t.indexOf('-') < 0) return false
  return /^\|?[\s|:.-]+\|?$/.test(t)
}

function splitTableRow(line) {
  let s = String(line || '').trim()
  if (s.charAt(0) === '|') s = s.slice(1)
  if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1)
  const parts = s.split('|')
  const cells = []
  for (let i = 0; i < parts.length; i++) {
    cells.push(stripInlineMd(parts[i].trim()))
  }
  return cells
}

function textBufToHtml(buf) {
  if (!buf.length) return ''
  const block = buf.join('\n')
  const paras = block.split(/\n{2,}/)
  const parts = []
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    if (!p) continue
    const withBr = p
      .split('\n')
      .map(function (line) {
        return inlineFormat(line)
      })
      .join('<br/>')
    parts.push(
      '<div style="margin:6px 0;line-height:1.65;color:#e2e8f0;font-size:14px;word-break:break-word;">' +
        withBr +
        '</div>'
    )
  }
  return parts.join('')
}

function flushTextBlocks(buf, blocks) {
  if (!buf.length) return
  const html = textBufToHtml(buf)
  buf.length = 0
  if (html) blocks.push({ type: 'html', html: html })
}

/** Markdown → 结构化 blocks */
export function parseMdBlocks(text) {
  const raw = String(text || '')
  if (!raw) return []
  const lines = raw.split('\n')
  const blocks = []
  const textBuf = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (
      line.indexOf('|') >= 0 &&
      i + 1 < lines.length &&
      isTableSepLine(lines[i + 1])
    ) {
      flushTextBlocks(textBuf, blocks)
      const header = splitTableRow(line)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].indexOf('|') >= 0 && !isTableSepLine(lines[i])) {
        rows.push(splitTableRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', header: header, rows: rows })
      continue
    }
    textBuf.push(line)
    i++
  }
  flushTextBlocks(textBuf, blocks)
  return blocks
}

/** Markdown 文本 → rich-text HTML（不含表格，表格用 parseMdBlocks） */
export function mdToRichHtml(text) {
  const blocks = parseMdBlocks(text)
  const parts = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'html') parts.push(b.html)
  }
  return parts.join('')
}

function wrapPlainLines(ctx, text, maxWidth) {
  const lines = []
  const paragraphs = String(text || '').split('\n')
  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p]
    if (!para) {
      lines.push('')
      continue
    }
    let line = ''
    for (let i = 0; i < para.length; i++) {
      const ch = para.charAt(i)
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function measureCellWidth(ctx, text, head, fontSize) {
  ctx.font = (head ? 'bold ' : '') + fontSize + 'px sans-serif'
  const raw = String(text || '')
  if (!raw) return 24
  return ctx.measureText(raw).width + CANVAS_OPTS.tablePadX * 2
}

function calcColWidths(block, ctx, maxWidth, opts) {
  const colCount = block.header.length || 1
  const minCol = 52
  const natural = []
  for (let ci = 0; ci < colCount; ci++) {
    let w = measureCellWidth(ctx, block.header[ci], true, opts.tableFontSize)
    for (let ri = 0; ri < block.rows.length; ri++) {
      const row = block.rows[ri]
      const cw = measureCellWidth(ctx, row[ci] != null ? row[ci] : '', false, opts.tableFontSize)
      if (cw > w) w = cw
    }
    if (w < minCol) w = minCol
    natural.push(w)
  }
  let total = 0
  for (let i = 0; i < natural.length; i++) total += natural[i]
  if (total <= maxWidth) return natural
  const out = []
  for (let i = 0; i < natural.length; i++) {
    out.push(Math.max(minCol, Math.floor((natural[i] / total) * maxWidth)))
  }
  let fixTotal = 0
  for (let i = 0; i < out.length; i++) fixTotal += out[i]
  if (fixTotal !== maxWidth && out.length) {
    out[out.length - 1] += maxWidth - fixTotal
  }
  return out
}

function layoutTableBlock(block, ctx, maxWidth, opts) {
  const colCount = block.header.length || 1
  let colWidths = calcColWidths(block, ctx, maxWidth, opts)
  let tableFontSize = opts.tableFontSize
  let tableLineH = opts.tableLineH

  function buildRows() {
    const rows = [{ cells: block.header, head: true }]
    for (let r = 0; r < block.rows.length; r++) {
      rows.push({ cells: block.rows[r], head: false })
    }
    let totalH = opts.tableMargin * 2
    const laidRows = []
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]
      let rowH = opts.tablePadY * 2 + tableLineH
      const laidCells = []
      for (let ci = 0; ci < colCount; ci++) {
        const innerW = colWidths[ci] - opts.tablePadX * 2
        const raw = row.cells[ci] != null ? row.cells[ci] : ''
        ctx.font = (row.head ? 'bold ' : '') + tableFontSize + 'px sans-serif'
        const lines = wrapPlainLines(ctx, raw, innerW)
        if (!lines.length) lines.push('')
        const cellH = opts.tablePadY * 2 + lines.length * tableLineH
        if (cellH > rowH) rowH = cellH
        laidCells.push({ text: raw, lines: lines })
      }
      laidRows.push({ head: row.head, cells: laidCells, h: rowH })
      totalH += rowH
    }
    return { rows: laidRows, h: totalH }
  }

  let built = buildRows()
  if (built.h > 800 && tableFontSize > 11) {
    tableFontSize = 11
    tableLineH = 16
    opts = Object.assign({}, opts, { tableFontSize: tableFontSize, tableLineH: tableLineH })
    built = buildRows()
  }

  return {
    colCount: colCount,
    colWidths: colWidths,
    tableW: maxWidth,
    rows: built.rows,
    h: built.h,
    tableFontSize: tableFontSize,
    tableLineH: tableLineH,
  }
}

function layoutBlocks(blocks, ctx, maxWidth, opts) {
  const items = []
  let totalH = 0
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'html') {
      const plain = stripHtmlToText(b.html)
      const lines = wrapPlainLines(ctx, plain, maxWidth)
      const h = lines.length * opts.lineH + 6
      items.push({ type: 'text', lines: lines, h: h, y: totalH })
      totalH += h
      continue
    }
    if (b.type === 'table') {
      const table = layoutTableBlock(b, ctx, maxWidth, opts)
      items.push({ type: 'table', layout: table, block: b, h: table.h, y: totalH })
      totalH += table.h
    }
  }
  return { items: items, h: totalH, opts: opts }
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 测量回复 canvas 内容高度（不含标题区） */
export function measureReplyCanvas(blocks, ctx, maxWidth, options) {
  const opts = Object.assign({}, CANVAS_OPTS, options || {})
  return layoutBlocks(blocks, ctx, maxWidth, opts)
}

function cellX(colWidths, index, tableX) {
  let x = tableX
  for (let i = 0; i < index; i++) x += colWidths[i]
  return x
}

function drawTextItem(ctx, item, opts, maxWidth, startY, contentOffsetY, sliceH) {
  const itemTop = item.y
  const itemBottom = item.y + item.h
  const sliceTop = contentOffsetY
  const sliceBottom = contentOffsetY + sliceH
  if (itemBottom <= sliceTop || itemTop >= sliceBottom) return

  ctx.fillStyle = '#e2e8f0'
  ctx.font = opts.fontSize + 'px sans-serif'
  let lineY = startY + itemTop - contentOffsetY
  for (let li = 0; li < item.lines.length; li++) {
    const ly = lineY + opts.lineH
    if (ly > startY && lineY < startY + sliceH) {
      ctx.fillText(item.lines[li], opts.pad, lineY + opts.lineH)
    }
    lineY += opts.lineH
  }
}

function drawTableItem(ctx, item, opts, maxWidth, startY, contentOffsetY, sliceH) {
  const table = item.layout
  const itemTop = item.y
  const itemBottom = item.y + item.h
  const sliceTop = contentOffsetY
  const sliceBottom = contentOffsetY + sliceH
  if (itemBottom <= sliceTop || itemTop >= sliceBottom) return

  const tableX = opts.pad
  const tableW = table.tableW
  const tf = table.tableFontSize || opts.tableFontSize
  const tlh = table.tableLineH || opts.tableLineH
  let rowY = startY + itemTop + opts.tableMargin - contentOffsetY

  for (let ri = 0; ri < table.rows.length; ri++) {
    const row = table.rows[ri]
    const rowTop = rowY
    const rowBottom = rowY + row.h
    if (rowBottom > startY && rowTop < startY + sliceH) {
      if (row.head) {
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(tableX, rowTop, tableW, row.h)
      }
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)'
      ctx.lineWidth = 1
      let edgeX = tableX
      for (let ci = 0; ci <= table.colCount; ci++) {
        ctx.beginPath()
        ctx.moveTo(edgeX + 0.5, rowTop)
        ctx.lineTo(edgeX + 0.5, rowBottom)
        ctx.stroke()
        if (ci < table.colCount) edgeX += table.colWidths[ci]
      }
      ctx.beginPath()
      ctx.moveTo(tableX, rowTop + 0.5)
      ctx.lineTo(tableX + tableW, rowTop + 0.5)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(tableX, rowBottom - 0.5)
      ctx.lineTo(tableX + tableW, rowBottom - 0.5)
      ctx.stroke()

      for (let ci = 0; ci < table.colCount; ci++) {
        const cx = cellX(table.colWidths, ci, tableX)
        const cell = row.cells[ci]
        ctx.fillStyle = row.head ? '#7dd3fc' : '#e2e8f0'
        ctx.font = (row.head ? 'bold ' : '') + tf + 'px sans-serif'
        let textY = rowTop + opts.tablePadY + tlh
        for (let tl = 0; tl < cell.lines.length; tl++) {
          if (textY <= startY + sliceH && textY >= startY - tlh) {
            ctx.fillText(cell.lines[tl], cx + opts.tablePadX, textY)
          }
          textY += tlh
        }
      }
    }
    rowY += row.h
  }
}

/** 按已测量 layout 绘制内容切片（contentOffsetY 起 sliceH 高） */
export function drawReplyCanvasSlice(layout, ctx, maxWidth, startY, contentOffsetY, sliceH, options) {
  const opts = Object.assign({}, layout.opts || CANVAS_OPTS, options || {})
  for (let i = 0; i < layout.items.length; i++) {
    const item = layout.items[i]
    if (item.type === 'text') {
      drawTextItem(ctx, item, opts, maxWidth, startY, contentOffsetY, sliceH)
      continue
    }
    if (item.type === 'table') {
      drawTableItem(ctx, item, opts, maxWidth, startY, contentOffsetY, sliceH)
    }
  }
}

/** 绘制回复内容（从 startY 起，返回结束 y） */
export function drawReplyCanvas(blocks, ctx, maxWidth, startY, options) {
  const layout = measureReplyCanvas(blocks, ctx, maxWidth, options)
  drawReplyCanvasSlice(layout, ctx, maxWidth, startY, 0, layout.h, options)
  return startY + layout.h
}

/** 长回复分页：每页内容区高度 pageContentH，返回 [{ offsetY, height }] */
export function calcReplyPageSlices(contentH, pageContentH) {
  if (!contentH || contentH <= 0) return [{ offsetY: 0, height: 0 }]
  if (contentH <= pageContentH) return [{ offsetY: 0, height: contentH }]
  const pages = []
  let off = 0
  while (off < contentH) {
    const h = Math.min(pageContentH, contentH - off)
    pages.push({ offsetY: off, height: h })
    off += h
  }
  return pages
}
