import type { MindDocument } from './document'
import { layout } from './layout'
import { themes } from './themes'
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function toSvg(
  doc: MindDocument,
  options: { transparent?: boolean; rootId?: string; orientation?: string } = {},
) {
  const result = layout(doc, options.rootId),
    b = result.bounds,
    t = themes[doc.theme]
  const extra = options.orientation === 'landscape' ? Math.max(0, (b.height * 16) / 9 - b.width) : 0,
    extraY = options.orientation === 'portrait' ? Math.max(0, b.width * 1.414 - b.height) : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(b.width + extra)}" height="${Math.ceil(b.height + extraY)}" viewBox="${b.x - extra / 2} ${b.y - extraY / 2} ${b.width + extra} ${b.height + extraY}" role="img" aria-label="${escape(doc.title)}"><title>${escape(doc.title)}</title>${options.transparent ? '' : `<rect x="${b.x - extra / 2}" y="${b.y - extraY / 2}" width="${b.width + extra}" height="${b.height + extraY}" fill="${t.background}"/>`}<g fill="none">${result.edges.map((e) => `<path d="${e.path}" stroke="${e.color}" stroke-width="${e.width}" stroke-linecap="round"/>`).join('')}</g>${result.nodes
    .map((n) => {
      const color = n.type === 'warning' ? '#b7793c' : n.color,
        font = n.depth === 0 ? 20 : n.depth === 1 ? 15 : 14
      return `<g data-node="${escape(n.id)}" transform="translate(${n.x} ${n.y})"><rect width="${n.width}" height="${n.height}" rx="${t.radius}" fill="${n.depth === 0 ? t.root : n.depth === 1 ? (doc.theme === 'dark' ? t.surface : `${color}12`) : t.surface}" stroke="${n.depth === 0 ? t.root : n.depth === 1 ? `${color}55` : t.border}" stroke-width="${n.type === 'important' ? 2 : 1}"/><text x="18" y="${font + 13}" fill="${n.depth === 0 ? '#ffffff' : t.text}" font-family="-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif" font-size="${font}" font-weight="${n.depth < 2 ? 600 : 400}">${n.lines.map((l, i) => `<tspan x="18" dy="${i ? font + 7 : 0}">${escape((i === 0 && n.icon ? n.icon + ' ' : '') + l)}</tspan>`).join('')}</text>${n.tags.length || n.task.status ? `<text x="18" y="${n.height - 10}" fill="${n.depth === 0 ? '#eee' : color}" font-size="10" font-family="sans-serif">${escape(n.tags.slice(0, 2).join(' · ') || n.task.status || '')}</text>` : ''}</g>`
    })
    .join('')}</svg>`
}
