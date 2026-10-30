import { textWidth } from './typography'
import type { MindDocument, MindNode } from './document'
import { themes } from './themes'
export type PlacedNode = MindNode & {
  x: number
  y: number
  width: number
  height: number
  depth: number
  color: string
  lines: string[]
  code: string
}
export type LayoutResult = {
  nodes: PlacedNode[]
  edges: { id: string; source: string; target: string; path: string; color: string; width: number }[]
  bounds: { x: number; y: number; width: number; height: number }
}
export function wrapText(text: string, font = 14, max = 230, weight = 400) {
  const lines: string[] = []
  let line = '',
    width = 0
  Array.from(text).forEach((c) => {
    const w = textWidth(c, font, weight)
    if (c === '\n' || width + w > max) {
      lines.push(line)
      line = c === '\n' ? '' : c
      width = c === '\n' ? 0 : w
      return
    }
    line += c
    width += w
  })
  if (line) lines.push(line)
  return lines.length ? lines : [' ']
}
function measure(node: MindNode, depth: number) {
  const font = depth === 0 ? 20 : depth === 1 ? 15 : 14,
    lines = wrapText(node.text, font, (depth === 0 ? 260 : 220) - (node.icon ? 24 : 0), depth < 2 ? 600 : 400)
  const width =
    Math.max(
      depth === 0 ? 160 : 90,
      ...lines.map((l) => textWidth(l, font, depth < 2 ? 600 : 400) + (node.icon ? 24 : 0)),
    ) + 36
  return {
    width,
    height: lines.length * (font + 7) + 24 + (node.tags.length || node.task.status ? 20 : 0),
    lines,
  }
}
export function layout(doc: MindDocument, focusId?: string): LayoutResult {
  const theme = themes[doc.theme],
    kind = doc.viewSettings.layout,
    rootId = focusId || doc.rootId
  const nodes: PlacedNode[] = [],
    edges: LayoutResult['edges'] = [],
    map = new Map<string, PlacedNode>(),
    childMap = new Map<string, MindNode[]>()
  doc.nodes.forEach((n) => {
    if (n.parentId) {
      const list = childMap.get(n.parentId) || []
      list.push(n)
      childMap.set(n.parentId, list)
    }
  })
  childMap.forEach((list) => list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)))
  const list = (id: string) => (doc.nodes.find((n) => n.id === id)?.collapsed ? [] : childMap.get(id) || [])
  const make = (n: MindNode, depth: number, color: string, code: string) => {
    const p = { ...n, ...measure(n, depth), depth, color, code, x: 0, y: 0 }
    nodes.push(p)
    map.set(n.id, p)
    return p
  }
  const root = make(
      doc.nodes.find((n) => n.id === rootId)!,
      0,
      theme.root,
      '1',
    ),
    branches = list(rootId),
    gap = kind === 'compact' ? 14 : theme.gap
  const build = (n: MindNode, depth: number, color: string, code: string) => {
    const p = make(n, depth, color, code)
    list(n.id).forEach((c, i) => build(c, depth + 1, color, `${code}.${i + 1}`))
    return p
  }
  branches.forEach((n, i) => build(n, 1, theme.colors[i % theme.colors.length], `${i + 1}`))
  const kids = (id: string) => list(id).map((n) => map.get(n.id)!)
  if (kind === 'fishbone') {
    root.x = 70
    root.y = -root.height / 2
    let station = -100
    branches
      .slice()
      .reverse()
      .forEach((n, reverse) => {
        const i = branches.length - reverse - 1,
          p = map.get(n.id)!,
          side = i % 2 === 0 ? -1 : 1
        const branchNodes = nodes.filter((v) => v.color === p.color && v.id !== root.id)
        const band = Math.max(300, ...branchNodes.map((v) => v.width + 80))
        station -= band + 70
        p.x = station
        p.y = side < 0 ? -210 - p.height : 210
        let y = side < 0 ? p.y - gap : p.y + p.height + gap
        const place = (id: string, depth: number) =>
          kids(id).forEach((c) => {
            c.x = station + Math.min(depth, 3) * 20
            c.y = side < 0 ? y - c.height : y
            y += side * (c.height + gap)
            place(c.id, depth + 1)
          })
        place(n.id, 1)
        edges.push({
          id: `bone-${p.id}`,
          source: root.id,
          target: p.id,
          path: `M ${station + band * 0.8} 0 L ${p.x + p.width / 2} ${side < 0 ? p.y + p.height : p.y}`,
          color: p.color,
          width: 2,
        })
      })
    edges.push({
      id: 'spine',
      source: root.id,
      target: root.id,
      path: `M ${station - 80} 0 L ${root.x} 0`,
      color: theme.muted,
      width: 3,
    })
  } else {
    const vertical = kind === 'down',
      span = new Map<string, number>(),
      level = new Map<number, number>()
    nodes.forEach((p) => level.set(p.depth, Math.max(level.get(p.depth) || 0, vertical ? p.height : p.width)))
    const extent = (p: PlacedNode): number => {
      const v = Math.max(
        vertical ? p.width : p.height,
        kids(p.id).reduce((s, c) => s + extent(c), 0) + Math.max(0, kids(p.id).length - 1) * gap,
      )
      span.set(p.id, v)
      return v
    }
    extent(root)
    const offset = (depth: number) =>
      Array.from(
        { length: depth },
        (_, i) => (level.get(i) || 0) + (kind === 'compact' ? 55 : vertical ? 85 : 90),
      ).reduce((a, b) => a + b, 0)
    const place = (p: PlacedNode, start: number, side: number) => {
      if (vertical) {
        p.x = start + (span.get(p.id)! - p.width) / 2
        p.y = offset(p.depth)
      } else {
        p.x = side > 0 ? offset(p.depth) : -offset(p.depth) + root.width - p.width
        p.y = start + (span.get(p.id)! - p.height) / 2
      }
      let cursor =
        start +
        (span.get(p.id)! -
          kids(p.id).reduce((s, c) => s + span.get(c.id)!, 0) -
          Math.max(0, kids(p.id).length - 1) * gap) /
          2
      kids(p.id).forEach((c) => {
        place(c, cursor, side)
        cursor += span.get(c.id)! + gap
      })
    }
    if (kind === 'mindmap') {
      const sides = [[] as PlacedNode[], [] as PlacedNode[]],
        heights = [0, 0]
      branches.forEach((n) => {
        const p = map.get(n.id)!,
          s = heights[0] <= heights[1] ? 0 : 1
        sides[s].push(p)
        heights[s] += span.get(p.id)! + gap
      })
      root.x = 0
      root.y = -root.height / 2
      sides.forEach((side, i) => {
        let cursor = -(heights[i] - gap) / 2
        side.forEach((p) => {
          place(p, cursor, i === 0 ? 1 : -1)
          cursor += span.get(p.id)! + gap
        })
      })
    } else {
      place(root, -span.get(rootId)! / 2, 1)
    }
  }
  const positions = doc.viewSettings.positions[kind] || {}
  nodes.forEach((n) => {
    if (positions[n.id]) {
      n.x += positions[n.id].x
      n.y += positions[n.id].y
    }
  })
  if (kind === 'fishbone') {
    const centerY = root.y + root.height / 2
    edges.forEach((e) => {
      if (e.id === 'spine')
        e.path = `M ${Math.min(...nodes.map((n) => n.x)) - 60} ${centerY} L ${root.x} ${centerY}`
      if (e.id.startsWith('bone-')) {
        const n = map.get(e.target)!
        e.path = `M ${n.x + n.width + 100} ${centerY} L ${n.x + n.width / 2} ${n.y < centerY ? n.y + n.height : n.y}`
      }
    })
  }
  nodes
    .filter((n) => n.parentId && n.id !== rootId)
    .forEach((n) => {
      const p = map.get(n.parentId!)
      if (!p || (kind === 'fishbone' && p.id === rootId)) return
      const down = kind === 'down',
        fish = kind === 'fishbone',
        left = n.x < p.x
      const x1 = down ? p.x + p.width / 2 : left ? p.x : p.x + p.width,
        y1 = down ? p.y + p.height : p.y + p.height / 2
      const x2 = down ? n.x + n.width / 2 : left ? n.x + n.width : n.x,
        y2 = down ? n.y : n.y + n.height / 2
      const dx = x2 - x1,
        dy = y2 - y1
      const path = fish
        ? `M ${p.x} ${p.y + p.height / 2} H ${Math.min(p.x, n.x) - 22} V ${y2} H ${n.x}`
        : doc.viewSettings.edge === 'orthogonal'
          ? down
            ? `M ${x1} ${y1} V ${y1 + dy / 2} H ${x2} V ${y2}`
            : `M ${x1} ${y1} H ${x1 + dx / 2} V ${y2} H ${x2}`
          : down
            ? `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1 + dx * 0.48} ${y1}, ${x2 - dx * 0.48} ${y2}, ${x2} ${y2}`
      edges.push({
        id: `edge-${n.id}`,
        source: p.id,
        target: n.id,
        path,
        color: n.color,
        width:
          doc.viewSettings.edge === 'thin'
            ? 1
            : n.depth === 1 && doc.viewSettings.edge === 'natural'
              ? 2.8
              : 1.5,
      })
    })
  const x = Math.min(...nodes.map((n) => n.x)) - 90,
    y = Math.min(...nodes.map((n) => n.y)) - 80
  return {
    nodes,
    edges,
    bounds: {
      x,
      y,
      width: Math.max(...nodes.map((n) => n.x + n.width)) - x + 80,
      height: Math.max(...nodes.map((n) => n.y + n.height)) - y + 80,
    },
  }
}
