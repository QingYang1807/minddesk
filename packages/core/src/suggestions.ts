import { z } from 'zod'
import { addNode, moveNode, removeNodes, validateDocument } from './document'
import type { MindDocument } from './document'
export const SuggestionSchema = z.object({
  kind: z.enum(['add', 'update', 'remove', 'move']),
  nodeId: z.string().optional(),
  parentId: z.string().optional(),
  text: z.string().min(1).max(10000).optional(),
  note: z.string().optional(),
  reason: z.string(),
  classification: z.enum(['fact', 'hypothesis', 'suggestion']).default('suggestion'),
})
export type SuggestionType = z.infer<typeof SuggestionSchema>
export function applySuggestions(doc: MindDocument, suggestions: SuggestionType[]) {
  const next = structuredClone(doc)
  suggestions.forEach((s) => {
    if (s.kind === 'add') {
      if (!s.parentId || !s.text) throw new Error('新增建议必须包含 parentId 和 text')
      const n = addNode(next, s.parentId, s.text)
      n.note = s.note || s.reason
      n.evidence.status = s.classification
      return
    }
    const n = next.nodes.find((n) => n.id === s.nodeId)
    if (!n) throw new Error('建议引用不存在的节点')
    if (s.kind === 'update') {
      if (s.text) n.text = s.text
      if (s.note !== undefined) n.note = s.note
      n.evidence.status = s.classification
      if (n.id === next.rootId && s.text) next.title = s.text
      return
    }
    if (s.kind === 'remove') {
      if (n.id === next.rootId) throw new Error('不允许删除根节点')
      removeNodes(next, [n.id])
      return
    }
    if (!s.parentId) throw new Error('移动建议必须包含 parentId')
    moveNode(next, n.id, s.parentId)
  })
  return validateDocument(next)
}
