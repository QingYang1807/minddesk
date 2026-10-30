import { addNode, children, createDocument, validateDocument } from './document'
import type { MindDocument } from './document'
export function parseText(text: string): MindDocument {
  if (!text.trim()) throw new Error('请输入 JSON、Markdown 或缩进大纲')
  if (text.trim().startsWith('{')) return validateDocument(JSON.parse(text))
  if (/^\s*(<\?xml|<map|<opml|PK)/.test(text))
    throw new Error('暂不支持此格式，请先转换为 Markdown 或 Mind Desk JSON')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  let headingLevel = -1
  const entries = lines.map((l) => {
    const heading = l.match(/^\s*(#{1,6})\s+(.+)$/)
    if (heading) {
      headingLevel = heading[1].length - 1
      return { level: headingLevel, text: heading[2] }
    }
    const list = l.match(/^(\s*)(?:[-*+] |\d+[.)] )?(.*)$/)!
    return { level: Math.max(0, headingLevel + 1) + list[1].replace(/\t/g, '  ').length / 2, text: list[2] }
  })
  const first = entries[0],
    doc = createDocument(first.text),
    stack = [{ level: first.level, id: doc.rootId }]
  entries.slice(1).forEach((e) => {
    while (stack.length > 1 && stack[stack.length - 1].level >= e.level) stack.pop()
    const n = addNode(doc, stack[stack.length - 1].id, e.text)
    stack.push({ level: e.level, id: n.id })
  })
  return validateDocument(doc)
}
export function toMarkdown(doc: MindDocument, rootId = doc.rootId) {
  const root = doc.nodes.find((n) => n.id === rootId)!
  const walk = (id: string, depth: number): string =>
    children(doc, id)
      .map(
        (n) =>
          `${'  '.repeat(depth)}- ${n.text.replace(/\n/g, ' / ')}${n.note ? ` <!-- ${n.note.replace(/-->/g, '')} -->` : ''}\n${walk(n.id, depth + 1)}`,
      )
      .join('')
  return `# ${root.text}\n${walk(rootId, 0)}`
}
