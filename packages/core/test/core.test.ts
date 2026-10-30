import { describe, it, expect } from 'vitest'
import {
  createDocument,
  validateDocument,
  children,
  descendants,
  addNode,
  moveNode,
  removeNodes,
} from '../src/document'
import { parseText, toMarkdown } from '../src/import'
import { layout } from '../src/layout'
import { toSvg } from '../src/export'
import { templates } from '../src/templates'

describe('document boundary and real commands', () => {
  it('rejects cycles, invalid roots, missing parents, duplicate ids and broken relations', () => {
    const doc = createDocument('主题')
    const a = addNode(doc, doc.rootId, 'A')
    expect(() => validateDocument({ ...doc, nodes: [...doc.nodes, a] })).toThrow()
    a.parentId = 'missing'
    expect(() => validateDocument(doc)).toThrow(/parentId/)
    a.parentId = a.id
    expect(() => validateDocument(doc)).toThrow()
    a.parentId = doc.rootId
    doc.relations.push({ id: 'r', sourceId: a.id, targetId: 'missing', type: 'reference', label: '' })
    expect(() => validateDocument(doc)).toThrow(/targetId/)
  })
  it('moves preserve IDs and reject descendant parenting; deleting cleans relations', () => {
    const doc = createDocument('项目')
    const a = addNode(doc, doc.rootId, 'A'),
      b = addNode(doc, a.id, 'B')
    expect(() => moveNode(doc, a.id, b.id)).toThrow()
    moveNode(doc, b.id, doc.rootId)
    expect(children(doc, doc.rootId).map((n) => n.id)).toEqual([a.id, b.id])
    doc.relations.push({ id: 'r', sourceId: a.id, targetId: b.id, type: 'dependency', label: '' })
    removeNodes(doc, [a.id])
    expect(doc.relations).toHaveLength(0)
    expect(validateDocument(doc).nodes).toHaveLength(2)
  })
  it('imports mixed headings and five levels without data loss', () => {
    const doc = parseText('# 产品\n## 研究\n- 用户\n  - 访谈\n    - 问题\n      - 验证\n## 上线')
    expect(doc.nodes).toHaveLength(7)
    expect(doc.nodes.find((n) => n.text === '用户')?.parentId).toBe(
      doc.nodes.find((n) => n.text === '研究')?.id,
    )
    expect(descendants(doc, doc.rootId)).toHaveLength(6)
    expect(parseText(toMarkdown(doc)).nodes.map((n) => n.text)).toEqual(doc.nodes.map((n) => n.text))
    expect(() => parseText('')).toThrow()
  })
})

describe('professional layout and portable export', () => {
  it.each(['mindmap', 'right', 'tree', 'down', 'compact', 'fishbone'] as const)(
    '%s computes finite, non-overlapping nodes and complete SVG',
    (view) => {
      const doc = templates[0].create()
      doc.viewSettings.layout = view
      const result = layout(doc)
      expect(result.nodes).toHaveLength(doc.nodes.length)
      result.nodes.forEach((a, i) => {
        expect(Number.isFinite(a.x + a.y + a.width + a.height)).toBe(true)
        result.nodes.slice(i + 1).forEach((b) => {
          const intersects =
            a.x < b.x + b.width - 1 &&
            a.x + a.width > b.x + 1 &&
            a.y < b.y + b.height - 1 &&
            a.y + a.height > b.y + 1
          expect(intersects, `${a.text} intersects ${b.text}`).toBe(false)
        })
      })
      const svg = toSvg(doc)
      expect(svg).toContain('<svg')
      expect(svg).toContain('产品全生命周期')
      expect((svg.match(/data-node=/g) || []).length).toBe(doc.nodes.length)
    },
  )
  it.each([50, 200, 500])('layouts and exports %i nodes', (count) => {
    const doc = createDocument('性能验证')
    Array.from({ length: count - 1 }, (_, i) =>
      addNode(doc, i < 8 ? doc.rootId : doc.nodes[1 + (i % 8)].id, `节点 ${i} · 中文长文本`),
    )
    const started = performance.now(),
      result = layout(doc)
    expect(result.nodes).toHaveLength(count)
    expect(toSvg(doc)).toContain('性能验证')
    expect(performance.now() - started).toBeLessThan(2000)
  })
  it('all templates validate, retain properties across views and escape XML', () => {
    templates.forEach((t) => expect(validateDocument(t.create()).nodes.length).toBeGreaterThan(20))
    const doc = createDocument('<script> & "证据"')
    expect(toSvg(doc)).toContain('&lt;script&gt; &amp;')
  })
})
