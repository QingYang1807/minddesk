import { useMemo, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  PanelLeftClose,
  PanelRightClose,
  Circle,
  CheckCircle2,
  Flag,
} from 'lucide-react'
import { children, moveNode } from '../../packages/core/src/document'
import type { MindNode } from '../../packages/core/src/document'
import { useDesk } from '../store'
export function Outline({ compact = false }: { compact?: boolean }) {
  const doc = useDesk((s) => s.doc)!,
    selected = useDesk((s) => s.selected),
    [search, setSearch] = useState('')
  const rows = useMemo(() => {
    const rows: { node: MindNode; depth: number; code: string }[] = []
    const walk = (id: string, depth: number, code: string) => {
      const n = doc.nodes.find((n) => n.id === id)!
      if (!search || n.text.includes(search)) rows.push({ node: n, depth, code })
      if (!n.collapsed || search)
        children(doc, id).forEach((c, i) =>
          walk(c.id, depth + 1, depth === 0 ? `${i + 1}` : `${code}.${i + 1}`),
        )
    }
    walk(doc.rootId, 0, '')
    return rows
  }, [doc, search])
  return (
    <div className={compact ? 'structure-list' : 'outline-view'}>
      <div className="view-heading">
        <div>
          <span className="eyebrow">{compact ? 'STRUCTURE' : 'OUTLINE'}</span>
          <h2>{compact ? '图纸大纲' : doc.title}</h2>
        </div>
        {!compact && (
          <button className="button" onClick={() => useDesk.getState().add()}>
            <Plus size={15} />
            添加想法
          </button>
        )}
      </div>
      <label className="search-input">
        <Search size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索节点…"
          aria-label="搜索节点"
        />
      </label>
      <div className="outline-rows">
        {rows.map(({ node: n, depth, code }) => (
          <div
            draggable
            key={n.id}
            onDragStart={(e) => e.dataTransfer.setData('text/node-id', n.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/node-id')
              if (id) useDesk.getState().commit((d) => moveNode(d, id, n.id))
            }}
            className={`outline-row ${selected.includes(n.id) ? 'selected' : ''}`}
            style={{ paddingLeft: 12 + depth * (compact ? 14 : 28) }}
            onClick={() => useDesk.getState().select([n.id])}
          >
            <button
              className="icon-button"
              onClick={(e) => {
                e.stopPropagation()
                useDesk.getState().patch(n.id, { collapsed: !n.collapsed })
              }}
            >
              {children(doc, n.id).length ? (
                n.collapsed ? (
                  <ChevronRight size={13} />
                ) : (
                  <ChevronDown size={13} />
                )
              ) : (
                <Circle size={5} />
              )}
            </button>
            {!compact && <span className="wbs-code">{code}</span>}
            {compact ? (
              <span className="outline-label" onDoubleClick={() => useDesk.getState().edit(n.id)}>
                {n.text}
              </span>
            ) : (
              <input
                autoFocus={useDesk.getState().editing === n.id}
                aria-label={`大纲 ${n.text}`}
                value={n.text}
                onChange={(e) => useDesk.getState().patch(n.id, { text: e.target.value || ' ' })}
                onFocus={() => useDesk.getState().select([n.id])}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    useDesk.getState().add(true)
                  }
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const sibling = children(doc, n.parentId || doc.rootId),
                      index = sibling.findIndex((s) => s.id === n.id)
                    if (e.shiftKey && n.parentId) {
                      const parent = doc.nodes.find((p) => p.id === n.parentId)
                      if (parent?.parentId)
                        useDesk.getState().commit((d) => moveNode(d, n.id, parent.parentId!))
                    }
                    if (!e.shiftKey && index > 0)
                      useDesk.getState().commit((d) => moveNode(d, n.id, sibling[index - 1].id))
                  }
                }}
              />
            )}
            {!compact && (
              <button
                className="icon-button row-add"
                onClick={() => {
                  useDesk.getState().select([n.id])
                  useDesk.getState().add()
                }}
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!compact && (
        <div className="view-hint">Enter 新建同级 · Tab / Shift Tab 调整层级 · 拖动到节点以改变父节点</div>
      )}
    </div>
  )
}
export function Tasks() {
  const doc = useDesk((s) => s.doc)!
  const rows: { n: MindNode; depth: number; code: string }[] = []
  const walk = (id: string, depth: number, code: string) =>
    children(doc, id).forEach((n, i) => {
      const c = code ? `${code}.${i + 1}` : `${i + 1}`
      rows.push({ n, depth, code: c })
      if (!n.collapsed) walk(n.id, depth + 1, c)
    })
  walk(doc.rootId, 0, '')
  return (
    <div className="task-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">WORK BREAKDOWN STRUCTURE</span>
          <h2>{doc.title}</h2>
          <p>把复杂目标，拆成清晰的下一步。</p>
        </div>
        <span className="badge">
          {rows.filter((r) => r.n.task.status === 'done').length} / {rows.length} 已完成
        </span>
      </div>
      <div className="task-table">
        <div className="task-head">
          <span>工作包 / 任务</span>
          <span>状态</span>
          <span>优先级</span>
          <span>负责人</span>
          <span>截止日期</span>
        </div>
        {rows.map(({ n, depth, code }) => (
          <div
            key={n.id}
            className={`task-row ${useDesk.getState().selected.includes(n.id) ? 'selected' : ''}`}
            onClick={() => useDesk.getState().select([n.id])}
          >
            <div style={{ paddingLeft: depth * 20 }}>
              <span className="wbs-code">{code}</span>
              <span>{n.text}</span>
            </div>
            <select
              aria-label={`状态 ${n.text}`}
              value={n.task.status || ''}
              onChange={(e) =>
                useDesk.getState().patch(n.id, {
                  task: { ...n.task, status: e.target.value ? (e.target.value as 'todo') : undefined },
                })
              }
            >
              <option value="">—</option>
              <option value="todo">待开始</option>
              <option value="doing">进行中</option>
              <option value="done">已完成</option>
              <option value="blocked">受阻</option>
            </select>
            <span>
              {{ low: '低', medium: '中', high: '高', urgent: '紧急' }[n.task.priority || 'low'] &&
                (n.task.priority
                  ? { low: '低', medium: '中', high: '高', urgent: '紧急' }[n.task.priority]
                  : '—')}
            </span>
            <span>{n.task.owner || '—'}</span>
            <span>{n.task.dueDate || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
export function Properties({ close }: { close: () => void }) {
  const doc = useDesk((s) => s.doc)!,
    selected = useDesk((s) => s.selected),
    n = doc.nodes.find((n) => n.id === selected[0]),
    patch = useDesk((s) => s.patch)
  if (!n) return null
  const field = (key: keyof MindNode, label: string) => (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={key === 'text' ? 2 : 3}
        value={String(n[key] || '')}
        onChange={(e) => patch(n.id, { [key]: e.target.value || (key === 'text' ? ' ' : '') })}
      />
    </label>
  )
  return (
    <aside className="properties">
      <div className="panel-heading">
        <span>
          节点属性 <small>{selected.length > 1 ? `· 已选 ${selected.length} 个` : ''}</small>
        </span>
        <button className="icon-button" onClick={close}>
          <PanelRightClose size={16} />
        </button>
      </div>
      <div className="property-scroll">
        <span className="eyebrow">CONTENT</span>
        {field('text', '主题')}
        {field('note', '备注与说明')}
        <label className="field">
          <span>节点类型</span>
          <select
            value={n.type}
            onChange={(e) => {
              const type = e.target.value as MindNode['type']
              useDesk
                .getState()
                .commit((d) => d.nodes.filter((v) => selected.includes(v.id)).forEach((v) => (v.type = type)))
            }}
          >
            {Object.entries({
              topic: '普通主题',
              important: '重点',
              warning: '警告',
              conclusion: '结论',
              note: '备注',
              task: '任务',
            }).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>标签 · 逗号分隔</span>
          <input
            value={n.tags.join(', ')}
            onChange={(e) =>
              patch(n.id, {
                tags: e.target.value
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="例如：待验证, 核心"
          />
        </label>
        <label className="field">
          <span>图标</span>
          <input
            value={n.icon}
            onChange={(e) => patch(n.id, { icon: e.target.value })}
            placeholder="输入符号或 emoji"
          />
        </label>
        <hr />
        <span className="eyebrow">TASK DETAILS</span>
        <div className="field-pair">
          <label className="field">
            <span>状态</span>
            <select
              value={n.task.status || ''}
              onChange={(e) =>
                patch(n.id, {
                  task: { ...n.task, status: e.target.value ? (e.target.value as 'todo') : undefined },
                })
              }
            >
              <option value="">未设置</option>
              <option value="todo">待开始</option>
              <option value="doing">进行中</option>
              <option value="done">已完成</option>
              <option value="blocked">受阻</option>
            </select>
          </label>
          <label className="field">
            <span>优先级</span>
            <select
              value={n.task.priority || ''}
              onChange={(e) =>
                patch(n.id, {
                  task: { ...n.task, priority: e.target.value ? (e.target.value as 'low') : undefined },
                })
              }
            >
              <option value="">未设置</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </label>
        </div>
        {(['owner', 'startDate', 'dueDate', 'estimate', 'acceptanceCriteria'] as const).map((k, i) => (
          <label className="field" key={k}>
            <span>{['负责人', '开始日期', '截止日期', '工作量', '验收标准 AC'][i]}</span>
            {k === 'acceptanceCriteria' ? (
              <textarea
                value={n.task[k] || ''}
                rows={3}
                onChange={(e) => patch(n.id, { task: { ...n.task, [k]: e.target.value } })}
              />
            ) : (
              <input
                type={k.endsWith('Date') ? 'date' : 'text'}
                value={n.task[k] || ''}
                onChange={(e) => patch(n.id, { task: { ...n.task, [k]: e.target.value } })}
              />
            )}
          </label>
        ))}
        <hr />
        <span className="eyebrow">EVIDENCE & REASONING</span>
        <label className="field">
          <span>内容性质</span>
          <select
            value={n.evidence.status}
            onChange={(e) => patch(n.id, { evidence: { ...n.evidence, status: e.target.value as 'fact' } })}
          >
            <option value="unverified">待核实</option>
            <option value="fact">事实 · 用户提供</option>
            <option value="hypothesis">待验证假设</option>
            <option value="suggestion">建议</option>
          </select>
        </label>
        {(['source', 'verification'] as const).map((k, i) => (
          <label className="field" key={k}>
            <span>{i ? '验证方法' : '证据 / 来源'}</span>
            <textarea
              rows={2}
              value={n.evidence[k]}
              onChange={(e) => patch(n.id, { evidence: { ...n.evidence, [k]: e.target.value } })}
            />
          </label>
        ))}
        <label className="field">
          <span>关联到节点</span>
          <select
            value=""
            onChange={(e) =>
              useDesk.getState().commit((d) =>
                d.relations.push({
                  id: crypto.randomUUID(),
                  sourceId: n.id,
                  targetId: e.target.value,
                  type: 'reference',
                  label: '关联',
                }),
              )
            }
          >
            <option value="">选择节点建立引用…</option>
            {doc.nodes
              .filter((v) => v.id !== n.id)
              .map((v) => (
                <option value={v.id} key={v.id}>
                  {v.text}
                </option>
              ))}
          </select>
        </label>
        {doc.relations
          .filter((r) => r.sourceId === n.id || r.targetId === n.id)
          .map((r) => (
            <div className="relation" key={r.id}>
              <span>
                {doc.nodes.find((v) => v.id === (r.sourceId === n.id ? r.targetId : r.sourceId))?.text}
              </span>
              <button
                onClick={() =>
                  useDesk.getState().commit((d) => {
                    d.relations = d.relations.filter((v) => v.id !== r.id)
                  })
                }
              >
                移除
              </button>
            </div>
          ))}
        <div className="node-id">ID · {n.id.slice(0, 8)}</div>
      </div>
    </aside>
  )
}
