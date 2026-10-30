import { create } from 'zustand'
import { z } from 'zod'
import { NodeSchema } from '../packages/core/src/document'
import {
  addNode,
  children,
  descendants,
  moveNode,
  removeNodes,
  validateDocument,
} from '../packages/core/src/document'
import type { MindDocument, MindNode } from '../packages/core/src/document'
export type LibraryItem = {
  document: MindDocument
  metadata: { favorite: boolean; folder: string; tags: string[]; deleted: boolean }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/api' + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await r.json()
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
  return body as T
}
export const useDesk = create<{
  doc: MindDocument | null
  items: LibraryItem[]
  selected: string[]
  editing: string | null
  past: MindDocument[]
  future: MindDocument[]
  saveStatus: string
  error: string
  focusId: string | undefined
  load: () => Promise<void>
  open: (doc: MindDocument) => Promise<void>
  close: () => Promise<void>
  commit: (fn: (doc: MindDocument) => void) => void
  select: (ids: string[]) => void
  edit: (id: string | null) => void
  undo: () => void
  redo: () => void
  save: () => Promise<void>
  add: (sibling?: boolean) => void
  remove: () => void
  copy: () => Promise<void>
  paste: () => Promise<void>
  patch: (id: string, values: Partial<MindNode>) => void
  setError: (e: unknown) => void
  setFocus: (id?: string) => void
}>((set, get) => ({
  doc: null,
  items: [],
  selected: [],
  editing: null,
  past: [],
  future: [],
  saveStatus: '已保存',
  error: '',
  focusId: undefined,
  setError: (e) => set({ error: e instanceof Error ? e.message : String(e) }),
  load: async () => {
    if (!recovered) {
      const draft = localStorage.getItem('mind-desk-recovery')
      if (draft) {
        await api('/documents', { method: 'POST', body: JSON.stringify(validateDocument(JSON.parse(draft))) })
        localStorage.removeItem('mind-desk-recovery')
      }
      recovered = true
    }
    set({ items: await api<LibraryItem[]>('/documents') })
  },
  open: async (doc) => {
    await get().save()
    set({
      doc: structuredClone(doc),
      past: [],
      future: [],
      selected: [doc.rootId],
      editing: null,
      focusId: undefined,
      saveStatus: '已保存',
    })
  },
  close: async () => {
    await get().save()
    set({ doc: null, editing: null, focusId: undefined })
    await get().load()
  },
  commit: (fn) => {
    const current = get().doc
    if (!current) return
    const next = structuredClone(current)
    try {
      fn(next)
      next.updatedAt = new Date().toISOString()
      validateDocument(next)
      set({ doc: next, past: [...get().past.slice(-79), current], future: [], saveStatus: '未保存' })
    } catch (e) {
      get().setError(e)
    }
  },
  select: (ids) => set({ selected: ids }),
  edit: (id) => set({ editing: id }),
  setFocus: (id) => set({ focusId: id }),
  undo: () => {
    const s = get(),
      previous = s.past.at(-1)
    if (previous && s.doc)
      set({
        doc: { ...previous, updatedAt: new Date().toISOString() },
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future],
        saveStatus: '未保存',
        editing: null,
      })
  },
  redo: () => {
    const s = get(),
      next = s.future[0]
    if (next && s.doc)
      set({
        doc: { ...next, updatedAt: new Date().toISOString() },
        past: [...s.past, s.doc],
        future: s.future.slice(1),
        saveStatus: '未保存',
        editing: null,
      })
  },
  save: async () => {
    const doc = get().doc
    if (!doc || get().saveStatus === '已保存') return
    set({ saveStatus: '保存中…' })
    try {
      await enqueueSave(doc)
      if (get().doc === doc) set({ saveStatus: '已保存' })
    } catch (e) {
      set({ saveStatus: '保存失败' })
      get().setError(e)
      throw e
    }
  },
  add: (sibling) => {
    const s = get(),
      doc = s.doc
    if (!doc) return
    const selected = doc.nodes.find((n) => n.id === s.selected[0]) || doc.nodes[0]
    let id = ''
    s.commit((d) => {
      const n = addNode(d, sibling ? selected.parentId || selected.id : selected.id)
      id = n.id
      if (sibling && selected.parentId) {
        const siblings = children(d, selected.parentId).filter((n) => n.id !== id),
          index = siblings.findIndex((n) => n.id === selected.id)
        siblings.splice(index + 1, 0, n)
        siblings.forEach((n, i) => (n.order = i))
      }
    })
    set({ selected: [id], editing: id })
  },
  remove: () => {
    get().commit((d) => removeNodes(d, get().selected))
    set({ selected: get().doc ? [get().doc!.rootId] : [], editing: null })
  },
  patch: (id, values) =>
    get().commit((d) => {
      const n = d.nodes.find((n) => n.id === id)
      if (n) {
        Object.assign(n, values)
        if (n.id === d.rootId && values.text) d.title = values.text
      }
    }),
  copy: async () => {
    const s = get()
    if (!s.doc || !s.selected[0]) return
    const ids = new Set([s.selected[0], ...descendants(s.doc, s.selected[0])])
    await navigator.clipboard.writeText(
      JSON.stringify({
        mindDeskSubtree: true,
        rootId: s.selected[0],
        nodes: s.doc.nodes.filter((n) => ids.has(n.id)),
      }),
    )
  },
  paste: async () => {
    const text = await navigator.clipboard.readText()
    let subtree: unknown
    try {
      subtree = JSON.parse(text)
    } catch {
      subtree = null
    }
    if (subtree && typeof subtree === 'object' && 'mindDeskSubtree' in subtree) {
      const value = z.object({ rootId: z.string(), nodes: z.array(NodeSchema) }).parse(subtree)
      const map = new Map(value.nodes.map((n) => [n.id, crypto.randomUUID()]))
      get().commit((d) => {
        const target = get().selected[0] || d.rootId
        value.nodes.forEach((n) =>
          d.nodes.push({
            ...n,
            id: map.get(n.id)!,
            parentId: n.id === value.rootId ? target : map.get(n.parentId!)!,
            order: n.id === value.rootId ? children(d, target).length : n.order,
          }),
        )
        validateDocument(d)
      })
      return
    }
    const { parseText } = await import('../packages/core/src/import')
    const imported = parseText(text),
      map = new Map(imported.nodes.map((n) => [n.id, crypto.randomUUID()]))
    get().commit((d) => {
      const target = get().selected[0] || d.rootId
      imported.nodes.forEach((n) =>
        d.nodes.push({
          ...n,
          id: map.get(n.id)!,
          parentId: n.id === imported.rootId ? target : map.get(n.parentId!)!,
          order: n.id === imported.rootId ? children(d, target).length : n.order,
        }),
      )
    })
  },
}))
let queue = Promise.resolve()
function enqueueSave(doc: MindDocument) {
  const run = queue
    .catch(() => {})
    .then(() => api('/documents', { method: 'POST', body: JSON.stringify(doc) }))
  queue = run.then(() => {})
  return run
}
export function reparent(id: string, parent: string, before?: string) {
  useDesk.getState().commit((d) => moveNode(d, id, parent, before))
}

// A synchronous recovery copy covers closing the tab inside the autosave debounce window.
// SQLite remains the canonical store; no model settings or keys enter this copy.
let recovered = false
useDesk.subscribe((state, previous) => {
  if (state.doc === previous.doc && state.saveStatus === previous.saveStatus) return
  try {
    if (state.doc && state.saveStatus !== '已保存') {
      localStorage.setItem('mind-desk-recovery', JSON.stringify(state.doc))
      return
    }
    if (state.saveStatus === '已保存') localStorage.removeItem('mind-desk-recovery')
  } catch {
    if (state.error !== '浏览器恢复副本写入失败，请等待本机保存完成后关闭。')
      state.setError('浏览器恢复副本写入失败，请等待本机保存完成后关闭。')
  }
})
