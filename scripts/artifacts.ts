import { writeFileSync, mkdirSync } from 'node:fs'
import { z } from 'zod'
import { DocumentSchema, createDocument, addNode } from '../packages/core/src/document'
import { templates } from '../packages/core/src/templates'
import { layout } from '../packages/core/src/layout'
import { toSvg } from '../packages/core/src/export'
mkdirSync('docs/examples', { recursive: true })
mkdirSync('artifacts/exports', { recursive: true })
writeFileSync('docs/mind-desk.schema.json', JSON.stringify(z.toJSONSchema(DocumentSchema), null, 2))
;[0, 3, 2].forEach((i) =>
  writeFileSync(`docs/examples/${templates[i].id}.json`, JSON.stringify(templates[i].create(), null, 2)),
)
templates.forEach((t) => writeFileSync(`artifacts/exports/${t.id}.svg`, toSvg(t.create())))
const metrics = [30, 50, 80, 150, 200, 500].map((count) => {
  const doc = createDocument(`真实结构性能样例 · ${count} 节点`)
  Array.from({ length: count - 1 }, (_, i) =>
    addNode(doc, i < 8 ? doc.rootId : doc.nodes[1 + (i % 8)].id, `工作包 ${i} · 中文长文本与验收条件`),
  )
  const start = performance.now(),
    result = layout(doc),
    layoutMs = performance.now() - start,
    exportStart = performance.now(),
    svg = toSvg(doc)
  writeFileSync(`artifacts/exports/stress-${count}.svg`, svg)
  return {
    count,
    layoutMs: Number(layoutMs.toFixed(2)),
    svgMs: Number((performance.now() - exportStart).toFixed(2)),
    svgBytes: Buffer.byteLength(svg),
    width: result.bounds.width,
    height: result.bounds.height,
  }
})
writeFileSync(
  'artifacts/performance.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      runtime: process.version,
      scope: 'Pure layout and SVG serialization, excludes browser interaction/render/PNG',
      metrics,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(metrics, null, 2))
