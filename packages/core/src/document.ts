import { z } from 'zod'
export const TaskSchema = z.object({
  status: z.enum(['todo', 'doing', 'done', 'blocked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  owner: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimate: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
})
export const NodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable(),
  order: z.number(),
  text: z.string().min(1).max(10000),
  note: z.string().default(''),
  type: z.enum(['topic', 'important', 'warning', 'conclusion', 'note', 'task']).default('topic'),
  tags: z.array(z.string()).default([]),
  icon: z.string().default(''),
  style: z.object({ emphasis: z.boolean().optional() }).default({}),
  collapsed: z.boolean().default(false),
  task: TaskSchema.default({}),
  evidence: z
    .object({
      status: z.enum(['fact', 'hypothesis', 'suggestion', 'unverified']).default('unverified'),
      source: z.string().default(''),
      verification: z.string().default(''),
    })
    .default({ status: 'unverified', source: '', verification: '' }),
  metadata: z.record(z.string(), z.unknown()).default({}),
})
export const DocumentSchema = z.object({
  schemaVersion: z.literal('1.0'),
  documentId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
  rootId: z.string(),
  nodes: z.array(NodeSchema).min(1).max(5000),
  relations: z
    .array(
      z.object({
        id: z.string(),
        sourceId: z.string(),
        targetId: z.string(),
        type: z.string(),
        label: z.string().default(''),
      }),
    )
    .default([]),
  viewSettings: z
    .object({
      view: z.enum(['map', 'outline', 'wbs']).default('map'),
      layout: z.enum(['mindmap', 'right', 'tree', 'down', 'compact', 'fishbone']).default('mindmap'),
      edge: z.enum(['natural', 'minimal', 'orthogonal', 'thin']).default('natural'),
      positions: z
        .record(z.string(), z.record(z.string(), z.object({ x: z.number(), y: z.number() })))
        .default({}),
    })
    .default({ view: 'map', layout: 'mindmap', edge: 'natural', positions: {} }),
  theme: z.enum(['executive', 'consulting', 'creative', 'dark']).default('creative'),
})
export type MindDocument = z.infer<typeof DocumentSchema>
export type MindNode = z.infer<typeof NodeSchema>
export type LayoutKind = MindDocument['viewSettings']['layout']
export function validateDocument(input: unknown): MindDocument {
  const result = DocumentSchema.safeParse(input)
  if (!result.success)
    throw new Error(result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n'))
  const doc = result.data,
    ids = new Set(doc.nodes.map((n) => n.id)),
    map = new Map(doc.nodes.map((n) => [n.id, n]))
  if (ids.size !== doc.nodes.length) throw new Error('nodes.id: 节点 ID 重复')
  if (doc.nodes.filter((n) => n.parentId === null).length !== 1 || map.get(doc.rootId)?.parentId !== null)
    throw new Error('rootId: 必须有且只有一个根节点')
  doc.nodes.forEach((n, i) => {
    if (n.parentId !== null && !ids.has(n.parentId)) throw new Error(`nodes.${i}.parentId: 父节点不存在`)
    const visited = new Set<string>()
    let current: MindNode | undefined = n
    while (current) {
      if (visited.has(current.id)) throw new Error(`nodes.${i}.parentId: 存在循环`)
      visited.add(current.id)
      current = current.parentId ? map.get(current.parentId) : undefined
    }
  })
  doc.relations.forEach((r, i) => {
    if (!ids.has(r.sourceId) || !ids.has(r.targetId))
      throw new Error(`relations.${i}.sourceId/targetId: 引用不存在的节点`)
  })
  return doc
}
export function createDocument(title = '中心主题'): MindDocument {
  const id = crypto.randomUUID(),
    now = new Date().toISOString()
  return DocumentSchema.parse({
    schemaVersion: '1.0',
    documentId: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    rootId: id,
    nodes: [{ id, parentId: null, order: 0, text: title }],
  })
}
export function children(doc: MindDocument, id: string) {
  return doc.nodes
    .filter((n) => n.parentId === id)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
export function descendants(doc: MindDocument, id: string): string[] {
  return children(doc, id).flatMap((n) => [n.id, ...descendants(doc, n.id)])
}
export function addNode(doc: MindDocument, parentId: string, text = '新想法') {
  if (!doc.nodes.some((n) => n.id === parentId)) throw new Error('父节点不存在')
  const node = NodeSchema.parse({
    id: crypto.randomUUID(),
    parentId,
    order: Math.max(-1, ...children(doc, parentId).map((n) => n.order)) + 1,
    text,
  })
  doc.nodes.push(node)
  const parent = doc.nodes.find((n) => n.id === parentId)
  if (parent) parent.collapsed = false
  return node
}
export function moveNode(doc: MindDocument, id: string, parentId: string, beforeId?: string) {
  if (id === doc.rootId || id === parentId || descendants(doc, id).includes(parentId))
    throw new Error('不能移动到自身或后代')
  const node = doc.nodes.find((n) => n.id === id)
  if (!node || !doc.nodes.some((n) => n.id === parentId)) throw new Error('节点不存在')
  node.parentId = parentId
  const siblings = children(doc, parentId).filter((n) => n.id !== id),
    index = siblings.findIndex((n) => n.id === beforeId)
  siblings.splice(index < 0 ? siblings.length : index, 0, node)
  siblings.forEach((n, i) => (n.order = i))
}
export function removeNodes(doc: MindDocument, ids: string[]) {
  const removed = new Set(
    ids.filter((id) => id !== doc.rootId).flatMap((id) => [id, ...descendants(doc, id)]),
  )
  doc.nodes = doc.nodes.filter((n) => !removed.has(n.id))
  doc.relations = doc.relations.filter((r) => !removed.has(r.sourceId) && !removed.has(r.targetId))
}
