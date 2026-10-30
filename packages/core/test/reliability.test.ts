import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../../../server/database'
import { addNode, createDocument, validateDocument } from '../src/document'
import { applySuggestions } from '../src/suggestions'
import { parseText } from '../src/import'

describe('SQLite persistence and atomic restore', () => {
  it('reopens real database with all node attributes and restores snapshots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mind-desk-test-')),
      store = new Store(dir),
      doc = createDocument('可靠性测试'),
      node = addNode(doc, doc.rootId, '任务')
    node.note = '备注'
    node.task = { owner: '测试人员', status: 'doing', acceptanceCriteria: '数据完整' }
    doc.theme = 'dark'
    store.save(doc)
    store.snapshot(doc.documentId)
    node.text = '修改后'
    store.save(doc)
    const backup = store.backup()
    store.close()
    const reopened = new Store(dir)
    expect(reopened.get(doc.documentId)?.document).toEqual(doc)
    expect(reopened.snapshots(doc.documentId)[0].document.nodes[1].text).toBe('任务')
    expect(() =>
      reopened.restore({
        ...backup,
        documents: [{ ...backup.documents[0], document: { ...doc, rootId: 'missing' } }],
      }),
    ).toThrow()
    expect(reopened.get(doc.documentId)?.document).toEqual(doc)
    reopened.restore(backup)
    expect(reopened.list()).toHaveLength(1)
    reopened.close()
    rmSync(dir, { recursive: true })
  })
})
describe('AI proposals are isolated and validated before preview/application', () => {
  it('keeps original content on valid and invalid suggestions', () => {
    const doc = createDocument('原始内容'),
      before = JSON.stringify(doc)
    const next = applySuggestions(doc, [
      {
        kind: 'add',
        parentId: doc.rootId,
        text: '待验证假设',
        reason: '补充验证',
        classification: 'hypothesis',
      },
    ])
    expect(next.nodes).toHaveLength(2)
    expect(next.nodes[1].evidence.status).toBe('hypothesis')
    expect(JSON.stringify(doc)).toBe(before)
    expect(() =>
      applySuggestions(doc, [
        { kind: 'add', parentId: 'missing', text: '无效', reason: '', classification: 'suggestion' },
      ]),
    ).toThrow()
    expect(() =>
      applySuggestions(doc, [
        { kind: 'remove', nodeId: doc.rootId, reason: '错误删除', classification: 'suggestion' },
      ]),
    ).toThrow()
    expect(JSON.stringify(doc)).toBe(before)
  })
  it('does not silently accept unsupported or malformed outlines', () => {
    expect(() => parseText('<opml>bad</opml>')).toThrow()
  })
})
