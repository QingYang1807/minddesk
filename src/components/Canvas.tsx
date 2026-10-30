import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MiniMap,
  Background,
  useReactFlow,
  BaseEdge,
} from '@xyflow/react'
import type { NodeProps, Node, EdgeProps, Edge, NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Minus, Maximize, LocateFixed, Map, Scan, ArrowLeft } from 'lucide-react'
import { layout } from '../../packages/core/src/layout'
import type { PlacedNode } from '../../packages/core/src/layout'
import { themes } from '../../packages/core/src/themes'
import { children, descendants } from '../../packages/core/src/document'
import { useDesk, reparent } from '../store'
type MapNode = Node<{ placed: PlacedNode }, 'mind'>
type MapEdge = Edge<{ path: string; color: string; width: number }, 'mind'>
function MindNodeView({ id, data, selected }: NodeProps<MapNode>) {
  const editing = useDesk((s) => s.editing === id),
    patch = useDesk((s) => s.patch),
    edit = useDesk((s) => s.edit),
    p = data.placed,
    doc = useDesk((s) => s.doc)!,
    theme = themes[doc.theme]
  const [value, setValue] = useState(p.text)
  useEffect(() => setValue(p.text), [p.text, editing])
  const finish = () => {
    if (value.trim() && value !== p.text) patch(id, { text: value.trim() })
    edit(null)
  }
  const hasChildren = children(doc, id).length > 0
  return (
    <div
      className={`mind-node depth-${p.depth === 0 ? 'root' : p.depth === 1 ? 'branch' : 'leaf'} ${selected ? 'is-selected' : ''} type-${p.type}`}
      style={
        {
          width: p.width,
          height: p.height,
          background:
            p.depth === 0
              ? theme.root
              : p.depth === 1
                ? doc.theme === 'dark'
                  ? theme.surface
                  : p.color + '12'
                : theme.surface,
          color: p.depth === 0 ? '#fff' : theme.text,
          borderColor: p.depth === 0 ? theme.root : p.depth === 1 ? p.color + '55' : theme.border,
          borderRadius: theme.radius,
          '--branch': p.color,
        } as React.CSSProperties
      }
      onDoubleClick={() => edit(id)}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {editing ? (
        <textarea
          className="node-input nodrag nowheel"
          aria-label="编辑节点"
          autoFocus
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setValue(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.stopPropagation()
              finish()
            }
            if (e.key === 'Tab') {
              e.preventDefault()
              e.stopPropagation()
              finish()
              useDesk.getState().add()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              edit(null)
            }
          }}
        />
      ) : (
        <>
          <div className="node-text" style={{ fontSize: p.depth === 0 ? 20 : p.depth === 1 ? 15 : 14 }}>
            {p.icon && <span>{p.icon} </span>}
            {p.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          {(p.tags.length > 0 || p.task.status) && (
            <div className="node-tags">
              {p.task.status && <span className={`status-dot ${p.task.status}`} />}{' '}
              {p.tags.slice(0, 2).join(' · ') ||
                { todo: '待开始', doing: '进行中', done: '已完成', blocked: '受阻' }[p.task.status || 'todo']}
            </div>
          )}
        </>
      )}
      {hasChildren && (
        <button
          className="collapse nodrag"
          aria-label="折叠展开"
          onClick={(e) => {
            e.stopPropagation()
            patch(id, { collapsed: !p.collapsed })
          }}
        >
          {p.collapsed ? '+' : '−'}
        </button>
      )}
      {selected && !editing && (
        <button
          className="node-add nodrag"
          title="添加子节点 Tab"
          onClick={(e) => {
            e.stopPropagation()
            useDesk.getState().add()
          }}
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  )
}
function MindEdgeView({ data }: EdgeProps<MapEdge>) {
  return data ? <BaseEdge path={data.path} style={{ stroke: data.color, strokeWidth: data.width }} /> : null
}
const nodeTypes = { mind: MindNodeView },
  edgeTypes = { mind: MindEdgeView }
function MapCanvas({ report }: { report: boolean }) {
  const doc = useDesk((s) => s.doc)!,
    selected = useDesk((s) => s.selected),
    focus = useDesk((s) => s.focusId),
    flow = useReactFlow<MapNode, MapEdge>()
  const result = useMemo(() => layout(doc, focus), [doc, focus]),
    theme = themes[doc.theme]
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({}),
    [mini, setMini] = useState(false),
    [zoom, setZoom] = useState(1)
  useEffect(() => setPositions({}), [result])
  useEffect(() => {
    const timer = setTimeout(() => void flow.fitView({ padding: 0.16, duration: 300 }), 80)
    return () => clearTimeout(timer)
  }, [doc.documentId, doc.viewSettings.layout, focus, report])
  const live = useMemo(() => {
    if (!Object.keys(positions).length) return result
    const saved = doc.viewSettings.positions[doc.viewSettings.layout] || {}
    const offsets = Object.fromEntries(
      Object.entries(positions).map(([id, position]) => {
        const original = result.nodes.find((n) => n.id === id)!,
          old = saved[id] || { x: 0, y: 0 }
        return [id, { x: position.x - original.x + old.x, y: position.y - original.y + old.y }]
      }),
    )
    return layout(
      {
        ...doc,
        viewSettings: {
          ...doc.viewSettings,
          positions: { ...doc.viewSettings.positions, [doc.viewSettings.layout]: { ...saved, ...offsets } },
        },
      },
      focus,
    )
  }, [doc, result, positions, focus])
  const editing = useDesk((s) => s.editing)
  useEffect(() => {
    if (!editing) return
    const node = result.nodes.find((n) => n.id === editing)
    if (node)
      void flow.setCenter(node.x + node.width / 2, node.y + node.height / 2, {
        zoom: Math.max(0.65, flow.getZoom()),
        duration: 250,
      })
  }, [editing])
  const nodes: MapNode[] = useMemo(
    () =>
      result.nodes.map((p) => ({
        id: p.id,
        type: 'mind',
        position: positions[p.id] || { x: p.x, y: p.y },
        data: { placed: p },
        selected: selected.includes(p.id),
        draggable: !report,
      })),
    [result, positions, selected, report],
  )
  const edges: MapEdge[] = useMemo(
    () => live.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'mind', data: e })),
    [live],
  )
  const change = useCallback((changes: NodeChange<MapNode>[]) => {
    const current = useDesk.getState().selected
    const selection = new Set(current)
    changes.forEach((c) => {
      if (c.type === 'position' && c.position) setPositions((old) => ({ ...old, [c.id]: c.position! }))
      if (c.type === 'select') {
        if (c.selected) selection.add(c.id)
        else selection.delete(c.id)
      }
    })
    const next = [...selection]
    if (next.length !== current.length || next.some((id) => !current.includes(id)))
      useDesk.getState().select(next)
  }, [])
  return (
    <div className={`map-canvas ${report ? 'report-canvas' : ''}`} style={{ background: theme.background }}>
      {focus && (
        <button className="focus-banner" onClick={() => useDesk.getState().setFocus()}>
          <ArrowLeft size={14} />
          返回完整图纸
        </button>
      )}
      {report && (
        <div className="report-title">
          <span>MIND DESK / 思考简报</span>
          <h2 style={{ color: theme.text }}>{doc.title}</h2>
          <p>{doc.description}</p>
        </div>
      )}
      <ReactFlow<MapNode, MapEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={change}
        onNodeClick={(e, n) => {
          useDesk.getState().select(e.metaKey ? [...new Set([...selected, n.id])] : [n.id])
        }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault()
          useDesk.getState().select([n.id])
          document.dispatchEvent(
            new CustomEvent('node-menu', { detail: { x: e.clientX, y: e.clientY, id: n.id } }),
          )
        }}
        onNodeDragStop={(event, n) => {
          const excluded = new Set([n.id, ...descendants(doc, n.id)]),
            target = result.nodes.find(
              (p) =>
                !excluded.has(p.id) &&
                n.position.x + n.measured!.width! / 2 > p.x &&
                n.position.x + n.measured!.width! / 2 < p.x + p.width &&
                n.position.y > p.y - 30 &&
                n.position.y < p.y + p.height,
            )
          if (target && !event.altKey) {
            reparent(n.id, target.id)
            return
          }
          useDesk.getState().commit((d) => {
            const all = d.viewSettings.positions[d.viewSettings.layout] || {}
            Object.entries({ ...positions, [n.id]: n.position }).forEach(([id, position]) => {
              const original = result.nodes.find((p) => p.id === id),
                old = all[id] || { x: 0, y: 0 }
              if (original)
                all[id] = { x: position.x - original.x + old.x, y: position.y - original.y + old.y }
            })
            d.viewSettings.positions[d.viewSettings.layout] = all
          })
        }}
        onMove={(_, v) => setZoom(v.zoom)}
        fitView
        minZoom={0.03}
        maxZoom={2.5}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode="Meta"
        panOnDrag={[1]}
        selectionOnDrag
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Meta"
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        {!report && <Background color={doc.theme === 'dark' ? '#3b4253' : '#d8d8e2'} gap={24} size={1} />}
        {mini && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => result.nodes.find((p) => p.id === n.id)?.color || theme.root}
            maskColor={doc.theme === 'dark' ? '#171c28aa' : '#fafaf8aa'}
          />
        )}
      </ReactFlow>
      {!report && (
        <div className="canvas-caption">
          {doc.viewSettings.layout === 'fishbone'
            ? '因果分析 · 原因均为待验证假设'
            : '拖动画布平移 · 双击节点编辑 · Tab 延展想法'}
        </div>
      )}
      <div className="canvas-controls">
        <button title="缩小" onClick={() => void flow.zoomOut()}>
          <Minus size={15} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button title="放大" onClick={() => void flow.zoomIn()}>
          <Plus size={15} />
        </button>
        <i />
        <button
          title="适应画布"
          onClick={() => void flow.fitView({ padding: report ? 0.25 : 0.16, duration: 300 })}
        >
          <Maximize size={15} />
        </button>
        <button
          title="定位所选节点"
          onClick={() => {
            const n = result.nodes.find((n) => n.id === selected[0]) || result.nodes[0]
            void flow.setCenter(n.x + n.width / 2, n.y + n.height / 2, { zoom: 1, duration: 300 })
          }}
        >
          <LocateFixed size={16} />
        </button>
        <i />
        <button title="迷你地图" className={mini ? 'active' : ''} onClick={() => setMini(!mini)}>
          <Map size={16} />
        </button>
        <button
          title="专注所选分支"
          onClick={() => useDesk.getState().setFocus(focus ? undefined : selected[0])}
        >
          <Scan size={16} />
        </button>
      </div>
    </div>
  )
}
export function Canvas({ report = false }: { report?: boolean }) {
  return (
    <ReactFlowProvider>
      <MapCanvas report={report} />
    </ReactFlowProvider>
  )
}
