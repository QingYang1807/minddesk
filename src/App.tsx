import { useEffect, useState } from 'react'
import {
  BrainCircuit,
  Clock3,
  Files,
  Star,
  Folder,
  LayoutTemplate,
  Trash2,
  Settings,
  Plus,
  Sparkles,
  ArrowUpRight,
  Search,
  Grid2X2,
  List,
  MoreHorizontal,
  ChevronDown,
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Upload,
  PanelLeft,
  PanelRight,
  WandSparkles,
  Network,
  ListTree,
  Fish,
  Workflow,
  Command,
  Keyboard,
  Check,
  Circle,
  Presentation,
  X,
  Copy,
  FolderPlus,
  Heart,
  ChevronRight,
  HelpCircle,
  Layers,
  Menu,
  CheckCircle2,
} from 'lucide-react'
import { useDesk, api } from './store'
import type { LibraryItem } from './store'
import { createDocument, children, descendants, moveNode } from '../packages/core/src/document'
import type { MindDocument, LayoutKind } from '../packages/core/src/document'
import { templates, methodDocument } from '../packages/core/src/templates'
import { themes } from '../packages/core/src/themes'
import { Canvas } from './components/Canvas'
import { Outline, Tasks, Properties } from './components/Views'
import {
  Modal,
  ImportDialog,
  ExportDialog,
  SettingsDialog,
  AIDialog,
  Preview,
  download,
} from './components/Dialogs'
type Dialog =
  | 'import'
  | 'export'
  | 'settings'
  | 'ai'
  | 'expand'
  | 'analyze'
  | 'commands'
  | 'help'
  | 'history'
  | 'methods'
  | null
const layouts: { id: LayoutKind; name: string }[] = [
  { id: 'mindmap', name: '经典双侧思维导图' },
  { id: 'right', name: '单侧思维导图' },
  { id: 'tree', name: '逻辑树 · 从左到右' },
  { id: 'down', name: '逻辑树 · 从上到下' },
  { id: 'compact', name: '紧凑逻辑树' },
  { id: 'fishbone', name: '鱼骨图 · 因果分析' },
]
export default function App() {
  const doc = useDesk((s) => s.doc),
    items = useDesk((s) => s.items),
    error = useDesk((s) => s.error),
    saveStatus = useDesk((s) => s.saveStatus),
    past = useDesk((s) => s.past),
    future = useDesk((s) => s.future)
  const [dialog, setDialog] = useState<Dialog>(null),
    [section, setSection] = useState('recent'),
    [search, setSearch] = useState(''),
    [list, setList] = useState(false),
    [folders, setFolders] = useState<string[]>([]),
    [left, setLeft] = useState(false),
    [right, setRight] = useState(true),
    [report, setReport] = useState(false),
    [category, setCategory] = useState('全部图纸'),
    [context, setContext] = useState<{ x: number; y: number; id: string } | null>(null),
    [versions, setVersions] = useState<{ id: number; document: MindDocument; createdAt: string }[]>([])
  useEffect(() => {
    void useDesk.getState().load().catch(useDesk.getState().setError)
    void api<string[]>('/folders').then(setFolders)
  }, [])
  useEffect(() => {
    if (!doc || saveStatus !== '未保存') return
    const timer = setTimeout(
      () =>
        void useDesk
          .getState()
          .save()
          .catch(() => {}),
      600,
    )
    return () => clearTimeout(timer)
  }, [doc, saveStatus])
  useEffect(() => {
    const flush = () => {
      const s = useDesk.getState()
      if (s.doc && s.saveStatus !== '已保存')
        void fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s.doc),
          keepalive: true,
        })
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])
  const create = async (d: MindDocument) => {
    await api('/documents', { method: 'POST', body: JSON.stringify(d) })
    await useDesk.getState().load()
    await useDesk.getState().open(d)
  }
  const metadata = async (item: LibraryItem, patch: Partial<LibraryItem['metadata']>) => {
    await api(`/documents/${item.document.documentId}/metadata`, {
      method: 'PUT',
      body: JSON.stringify({ ...item.metadata, ...patch }),
    })
    await useDesk.getState().load()
  }
  useEffect(() => {
    const handler = (event: Event) => setContext((event as CustomEvent).detail)
    document.addEventListener('node-menu', handler)
    return () => document.removeEventListener('node-menu', handler)
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const target = e.target as HTMLElement,
        isInput = target.matches('input,textarea,select,[contenteditable="true"]'),
        cmd = e.metaKey || e.ctrlKey,
        s = useDesk.getState()
      if (cmd && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void create(createDocument()).catch(s.setError)
        return
      }
      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setDialog((d) => (d === 'commands' ? null : 'commands'))
        return
      }
      if (e.key === 'Escape') {
        setContext(null)
        setDialog(null)
        setReport(false)
        return
      }
      if (cmd && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isInput) target.blur()
        void s.save().catch(() => {})
        return
      }
      if (isInput || !s.doc || dialog || report) return
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
        return
      }
      if (cmd && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        s.select(s.doc.nodes.map((n) => n.id))
        return
      }
      if (cmd && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setLeft(true)
        setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="搜索节点"]')?.focus(), 80)
        return
      }
      if (cmd && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        void s.copy().catch(s.setError)
        return
      }
      if (cmd && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        void s.paste().catch(s.setError)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        s.add()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          s.edit(s.selected[0])
          return
        }
        s.add(true)
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        s.edit(s.selected[0])
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        s.remove()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [dialog, report])
  const visible = items
    .filter((item) => (section === 'trash' ? item.metadata.deleted : !item.metadata.deleted))
    .filter((item) =>
      section === 'favorites'
        ? item.metadata.favorite
        : section.startsWith('folder:')
          ? item.metadata.folder === section.slice(7)
          : true,
    )
    .filter((item) =>
      `${item.document.title} ${item.document.nodes.map((n) => n.text).join(' ')} ${item.metadata.tags.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (item) =>
        category === '全部图纸' ||
        (category === '思维导图'
          ? item.document.viewSettings.layout === 'mindmap'
          : category === '逻辑分析'
            ? ['tree', 'compact', 'fishbone', 'right'].includes(item.document.viewSettings.layout)
            : item.document.viewSettings.view === 'wbs' || item.document.viewSettings.layout === 'down'),
    )
  const isTemplates = section === 'templates'
  const title =
    (
      {
        recent: '最近编辑',
        all: '我的图纸',
        favorites: '收藏图纸',
        trash: '回收站',
        templates: '模板中心',
      } as Record<string, string>
    )[section] || section.slice(7)
  return (
    <div className={`app ${doc ? 'editor-app' : ''} ${report ? 'report-mode' : ''}`}>
      {!doc ? (
        <>
          <aside className="sidebar">
            <a className="brand" href="/" onClick={(e) => e.preventDefault()}>
              <span className="brand-mark">
                <BrainCircuit size={22} />
              </span>
              <strong>
                Mind Desk<span>思维的自由空间</span>
              </strong>
            </a>
            <button
              className="sidebar-new"
              onClick={() => void create(createDocument()).catch(useDesk.getState().setError)}
            >
              <Plus size={17} />
              新建图纸 <kbd>⌘ N</kbd>
            </button>
            <div className="nav-section-label">工作空间</div>
            <nav>
              {[
                { id: 'recent', icon: Clock3, label: '最近编辑' },
                { id: 'all', icon: Files, label: '我的图纸' },
                { id: 'favorites', icon: Star, label: '收藏' },
                { id: 'templates', icon: LayoutTemplate, label: '模板中心' },
              ].map((n) => (
                <button
                  key={n.id}
                  className={section === n.id ? 'active' : ''}
                  onClick={() => {
                    setSection(n.id)
                    setSearch('')
                  }}
                >
                  <n.icon size={17} />
                  <span>{n.label}</span>
                  {n.id === 'all' && <small>{items.filter((i) => !i.metadata.deleted).length}</small>}
                  {n.id === 'templates' && <span className="tiny-badge">6</span>}
                </button>
              ))}
            </nav>
            <div className="nav-section-label folder-heading">
              <span>文件夹</span>
              <button
                title="新建文件夹"
                onClick={async () => {
                  const name = window.prompt('文件夹名称')
                  if (name) {
                    setFolders(
                      await api<string[]>('/folders', { method: 'POST', body: JSON.stringify({ name }) }),
                    )
                  }
                }}
              >
                <Plus size={14} />
              </button>
            </div>
            <nav>
              {folders.length ? (
                folders.map((f) => (
                  <button
                    key={f}
                    className={section === 'folder:' + f ? 'active' : ''}
                    onClick={() => setSection('folder:' + f)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const item = items.find(
                        (i) => i.document.documentId === e.dataTransfer.getData('text/document-id'),
                      )
                      if (item) void metadata(item, { folder: f })
                    }}
                  >
                    <Folder size={16} />
                    {f}
                  </button>
                ))
              ) : (
                <span className="folder-empty">将相关思考，收在一起</span>
              )}
            </nav>
            <button className="method-link" onClick={() => setDialog('methods')}>
              <div>
                <Sparkles size={17} />
                <span>思考方法</span>
                <ArrowUpRight size={14} />
              </div>
              <p>为复杂问题，找到清晰起点</p>
            </button>
            <div className="sidebar-bottom">
              <nav>
                <button className={section === 'trash' ? 'active' : ''} onClick={() => setSection('trash')}>
                  <Trash2 size={16} />
                  回收站
                </button>
                <button onClick={() => setDialog('settings')}>
                  <Settings size={16} />
                  设置与数据
                </button>
              </nav>
              <div className="local-indicator">
                <span />
                本地工作空间 <small>隐私，由你掌握</small>
              </div>
            </div>
          </aside>
          <main className="library">
            <header className="library-topbar">
              <div>
                <span>我的工作空间</span>
                <ChevronRight size={13} />
                <strong>{title}</strong>
              </div>
              <button className="shortcut-button" onClick={() => setDialog('commands')}>
                <Command size={13} /> K <span>命令搜索</span>
              </button>
              <button className="avatar" onClick={() => setDialog('settings')}>
                Q
              </button>
            </header>
            <div className="library-content">
              <div className="welcome-heading">
                <div>
                  <div className="eyebrow">A LITTLE CLARITY, EVERY DAY</div>
                  <h1>{isTemplates ? '好思考，从好结构开始。' : '让思考，自然生长。'}</h1>
                  <p>
                    {isTemplates
                      ? '六套专业模板，把经验变成你的思考起点。'
                      : '把灵感连成结构，把复杂化为清晰。这里是你的思维工作台。'}
                  </p>
                </div>
                <div className="private-label">
                  <span />
                  所有图纸仅保存在本机
                </div>
              </div>
              {!isTemplates && section !== 'trash' && (
                <>
                  <div className="creation-grid">
                    <button
                      className="creation-card blank"
                      onClick={() => void create(createDocument()).catch(useDesk.getState().setError)}
                    >
                      <span className="creation-icon">
                        <Plus size={22} />
                      </span>
                      <div>
                        <strong>空白图纸</strong>
                        <p>从一个想法开始</p>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                    <button className="creation-card ai" onClick={() => setDialog('ai')}>
                      <span className="creation-icon">
                        <Sparkles size={22} />
                      </span>
                      <div>
                        <strong>
                          AI 帮我创建 <span>AI</span>
                        </strong>
                        <p>给思考，多一个视角</p>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                    <button className="creation-card" onClick={() => setDialog('import')}>
                      <span className="creation-icon">
                        <ListTree size={22} />
                      </span>
                      <div>
                        <strong>从文本创建</strong>
                        <p>大纲、Markdown 一步成图</p>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                    <button className="creation-card" onClick={() => setDialog('import')}>
                      <span className="creation-icon">
                        <Upload size={21} />
                      </span>
                      <div>
                        <strong>导入图纸</strong>
                        <p>让已有思考继续生长</p>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="section-title">
                    <div>
                      <h2>为下一次思考，找个好起点</h2>
                      <span>专业模板</span>
                    </div>
                    <button className="text-button" onClick={() => setSection('templates')}>
                      探索模板 <ArrowRightIcon />
                    </button>
                  </div>
                  <div className="template-strip">
                    {templates.slice(0, 4).map((t, i) => (
                      <button
                        key={t.id}
                        className="template-small"
                        onClick={() => void create(t.create()).catch(useDesk.getState().setError)}
                      >
                        <div className={`template-illustration ill-${i}`}>
                          <Preview doc={t.create()} />
                        </div>
                        <div>
                          <strong>{t.name}</strong>
                          <span>{t.category}</span>
                        </div>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="section-title documents-title">
                <div>
                  <h2>{title}</h2>
                  <span>{isTemplates ? '精选 6 套' : `${visible.length} 张图纸`}</span>
                </div>
                <div className="library-tools">
                  <label className="search-input">
                    <Search size={15} />
                    <input
                      aria-label="搜索图纸"
                      placeholder="搜索图纸…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <kbd>⌘ F</kbd>
                  </label>
                  <div className="segmented icon-segment">
                    <button title="网格视图" className={!list ? 'active' : ''} onClick={() => setList(false)}>
                      <Grid2X2 size={16} />
                    </button>
                    <button title="列表视图" className={list ? 'active' : ''} onClick={() => setList(true)}>
                      <List size={17} />
                    </button>
                  </div>
                </div>
              </div>
              {!isTemplates && (
                <div className="filter-row">
                  {['全部图纸', '思维导图', '逻辑分析', '项目计划'].map((c) => (
                    <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
                      {c}
                    </button>
                  ))}
                  <span>
                    最近修改 <ChevronDown size={12} />
                  </span>
                </div>
              )}
              {isTemplates ? (
                <div className="document-grid templates-gallery">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      className="document-card template-card"
                      onClick={() => void create(t.create()).catch(useDesk.getState().setError)}
                    >
                      <div className="thumbnail">
                        <Preview doc={t.create()} />
                      </div>
                      <div className="card-details">
                        <span className="eyebrow">{t.category}</span>
                        <h3>{t.name}</h3>
                        <p>{t.description}</p>
                        <span className="text-button">
                          使用模板 <ArrowUpRight size={13} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={list ? 'document-list' : 'document-grid'}>
                  {visible.map((item) => (
                    <article
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('text/document-id', item.document.documentId)
                      }
                      className="document-card"
                      key={item.document.documentId}
                    >
                      <button
                        className="thumbnail"
                        onClick={() => void useDesk.getState().open(item.document)}
                      >
                        <Preview doc={item.document} />
                        <span className="thumbnail-label">
                          {item.document.viewSettings.layout === 'fishbone'
                            ? '因果分析'
                            : item.document.viewSettings.view === 'wbs'
                              ? '任务分解'
                              : '思维导图'}
                        </span>
                      </button>
                      <div className="card-details">
                        <div>
                          <button
                            className="card-title"
                            onClick={() => void useDesk.getState().open(item.document)}
                          >
                            {item.document.title}
                          </button>
                          <button
                            className={`star-button ${item.metadata.favorite ? 'favorited' : ''}`}
                            title="收藏图纸"
                            onClick={() => void metadata(item, { favorite: !item.metadata.favorite })}
                          >
                            <Star size={15} />
                          </button>
                        </div>
                        <p>
                          <span>{item.document.nodes.length} 个节点</span>
                          <span>·</span>
                          <span>
                            {new Date(item.document.updatedAt).toLocaleDateString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </p>
                        <div className="card-bottom">
                          <span className="card-tag">
                            {item.metadata.folder || themes[item.document.theme].name}
                          </span>
                          <details>
                            <summary title="图纸操作">
                              <MoreHorizontal size={17} />
                            </summary>
                            <div className="card-menu">
                              <button
                                onClick={async () => {
                                  const name = window.prompt('图纸名称', item.document.title)
                                  if (name) {
                                    const d = structuredClone(item.document)
                                    d.title = name
                                    d.nodes.find((n) => n.id === d.rootId)!.text = name
                                    d.updatedAt = new Date().toISOString()
                                    await api('/documents', { method: 'POST', body: JSON.stringify(d) })
                                    await useDesk.getState().load()
                                  }
                                }}
                              >
                                重命名
                              </button>
                              <button
                                onClick={() => {
                                  const d = structuredClone(item.document)
                                  d.documentId = crypto.randomUUID()
                                  d.title += ' · 副本'
                                  d.nodes.find((n) => n.id === d.rootId)!.text = d.title
                                  void create(d)
                                }}
                              >
                                复制图纸
                              </button>
                              <button
                                onClick={() => {
                                  const name = window.prompt('移动到文件夹（留空移出）', item.metadata.folder)
                                  if (name !== null) void metadata(item, { folder: name })
                                }}
                              >
                                移动到文件夹
                              </button>
                              <button
                                onClick={() => void metadata(item, { deleted: !item.metadata.deleted })}
                              >
                                {item.metadata.deleted ? '恢复图纸' : '移到回收站'}
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!visible.length && (
                    <div className="empty-library">
                      <div className="empty-orbit">
                        <BrainCircuit size={32} />
                      </div>
                      <h3>{section === 'trash' ? '这里没有已删除的图纸' : '为你的下一个想法，留一张画布'}</h3>
                      <p>新建图纸、粘贴一段大纲，或从专业模板开始。</p>
                      {section !== 'trash' && (
                        <button className="button primary" onClick={() => void create(createDocument())}>
                          <Plus size={15} />
                          创建第一张图纸
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="library-footer">
                <span>
                  <BrainCircuit size={14} /> MIND DESK
                </span>
                <p>留一点空间，给更好的想法。</p>
                <button onClick={() => setDialog('help')}>
                  <HelpCircle size={14} />
                  快捷键与帮助
                </button>
              </div>
            </div>
          </main>
        </>
      ) : (
        <>
          {!report && (
            <>
              <header className="editor-header">
                <button
                  className="editor-back"
                  title="返回图纸库"
                  onClick={() => void useDesk.getState().close().catch(useDesk.getState().setError)}
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="brand-mark small">
                  <BrainCircuit size={20} />
                </span>
                <div className="document-name">
                  <input
                    aria-label="图纸名称"
                    value={doc.title}
                    onChange={(e) => useDesk.getState().patch(doc.rootId, { text: e.target.value || ' ' })}
                  />
                  <span className={saveStatus === '保存失败' ? 'save-error' : ''}>
                    {saveStatus === '已保存' ? <CheckCircle2 size={11} /> : <Circle size={9} />} {saveStatus}{' '}
                    · 本地
                  </span>
                </div>
                <div className="undo-actions">
                  <button title="撤销 ⌘Z" disabled={!past.length} onClick={() => useDesk.getState().undo()}>
                    <Undo2 size={16} />
                  </button>
                  <button
                    title="重做 ⌘⇧Z"
                    disabled={!future.length}
                    onClick={() => useDesk.getState().redo()}
                  >
                    <Redo2 size={16} />
                  </button>
                </div>
                <div className="editor-top-actions">
                  <button className="button ghost" onClick={() => setDialog('history')}>
                    <Clock3 size={15} />
                    版本
                  </button>
                  <button className="button ghost" onClick={() => setReport(true)}>
                    <Presentation size={15} />
                    汇报
                  </button>
                  <button className="button" onClick={() => setDialog('export')}>
                    <Download size={15} />
                    导出
                  </button>
                  <button className="button primary ai-button" onClick={() => setDialog('expand')}>
                    <Sparkles size={15} />
                    AI 助手
                  </button>
                </div>
              </header>
              <div className="editor-toolbar">
                <div className="view-switch">
                  <button
                    className={doc.viewSettings.view === 'map' ? 'active' : ''}
                    onClick={() => useDesk.getState().commit((d) => (d.viewSettings.view = 'map'))}
                  >
                    <Network size={15} />
                    画布
                  </button>
                  <button
                    className={doc.viewSettings.view === 'outline' ? 'active' : ''}
                    onClick={() => useDesk.getState().commit((d) => (d.viewSettings.view = 'outline'))}
                  >
                    <ListTree size={15} />
                    大纲
                  </button>
                  <button
                    className={doc.viewSettings.view === 'wbs' ? 'active' : ''}
                    onClick={() => useDesk.getState().commit((d) => (d.viewSettings.view = 'wbs'))}
                  >
                    <Workflow size={15} />
                    WBS 任务
                  </button>
                </div>
                <i />
                <select
                  aria-label="布局"
                  value={doc.viewSettings.layout}
                  onChange={(e) =>
                    useDesk.getState().commit((d) => {
                      d.viewSettings.layout = e.target.value as LayoutKind
                      d.viewSettings.view = 'map'
                    })
                  }
                >
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="主题"
                  value={doc.theme}
                  onChange={(e) =>
                    useDesk.getState().commit((d) => (d.theme = e.target.value as MindDocument['theme']))
                  }
                >
                  {Object.entries(themes).map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.name} · {t.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="连线风格"
                  value={doc.viewSettings.edge}
                  onChange={(e) =>
                    useDesk.getState().commit((d) => (d.viewSettings.edge = e.target.value as 'natural'))
                  }
                >
                  <option value="natural">自然曲线</option>
                  <option value="minimal">极简曲线</option>
                  <option value="orthogonal">直角连接</option>
                  <option value="thin">细线连接</option>
                </select>
                <button
                  className="beautify"
                  onClick={() => {
                    useDesk.getState().commit((d) => {
                      d.viewSettings.positions = {}
                      d.nodes.forEach((n) => (n.collapsed = false))
                    })
                    useDesk.getState().setFocus()
                  }}
                >
                  <WandSparkles size={14} />
                  一键美化
                </button>
                <span className="toolbar-spacer" />
                <button className={left ? 'active' : ''} title="切换大纲导航" onClick={() => setLeft(!left)}>
                  <PanelLeft size={17} />
                </button>
                <button
                  className={right ? 'active' : ''}
                  title="切换属性面板"
                  onClick={() => setRight(!right)}
                >
                  <PanelRight size={17} />
                </button>
                <button title="快捷键" onClick={() => setDialog('help')}>
                  <Keyboard size={17} />
                </button>
              </div>
            </>
          )}
          <div className="editor-body">
            {left && !report && (
              <aside className="outline-panel">
                <Outline compact />
              </aside>
            )}
            <div className="editor-main">
              {doc.viewSettings.view === 'outline' && !report ? (
                <Outline />
              ) : doc.viewSettings.view === 'wbs' && !report ? (
                <Tasks />
              ) : (
                <Canvas report={report} />
              )}
            </div>
            {right && !report && <Properties close={() => setRight(false)} />}
          </div>
          {!report && (
            <footer className="editor-status">
              <span>
                <span className="status-online" /> 本机存储 <i /> {doc.nodes.length} 个节点 <i />{' '}
                {doc.relations.length} 个关联
              </span>
              <span>
                Tab 子节点 <kbd>↵</kbd> 同级节点 <kbd>⌘ K</kbd> 命令面板
                <button onClick={() => setDialog('analyze')}>
                  <Sparkles size={12} />
                  结构体检
                </button>
              </span>
            </footer>
          )}
          {report && (
            <button className="exit-report button" onClick={() => setReport(false)}>
              <X size={14} />
              退出汇报 · Esc
            </button>
          )}
        </>
      )}
      {dialog === 'import' && <ImportDialog close={() => setDialog(null)} onCreate={create} />}{' '}
      {dialog === 'export' && doc && <ExportDialog close={() => setDialog(null)} />}{' '}
      {dialog === 'settings' && <SettingsDialog close={() => setDialog(null)} />}{' '}
      {['ai', 'expand', 'analyze'].includes(dialog || '') && (
        <AIDialog
          close={() => setDialog(null)}
          onCreate={create}
          initialMode={dialog === 'ai' ? 'create' : dialog === 'expand' ? 'expand' : 'analyze'}
        />
      )}
      {dialog === 'methods' && (
        <Modal
          title="给复杂问题，一个思考框架"
          subtitle="方法帮助你提问，证据帮助你判断。"
          close={() => setDialog(null)}
        >
          <div className="modal-body method-grid">
            {[
              ['MECE', '检查互斥、完整和粒度'],
              ['5 Whys', '沿原因链追问，以验证收尾'],
              ['RCA', '组织潜在原因、证据与假设'],
              ['WBS', '将目标拆成可验收工作包'],
              ['产品全生命周期', '从研究、上线到持续复盘'],
              ['决策分析', '比较目标、取舍与风险'],
            ].map(([name, desc]) => (
              <button
                key={name}
                onClick={() => {
                  void create(methodDocument(name))
                  setDialog(null)
                }}
              >
                <Network size={20} />
                <strong>{name}</strong>
                <p>{desc}</p>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal title="让想法，跟得上你的速度" subtitle="键盘与鼠标，一起工作。" close={() => setDialog(null)}>
          <div className="modal-body shortcut-list">
            {[
              ['添加子节点', 'Tab'],
              ['添加同级节点', 'Enter'],
              ['编辑所选节点', 'F2 / 双击'],
              ['节点内换行', 'Shift Enter'],
              ['撤销 / 重做', '⌘ Z / ⌘ ⇧ Z'],
              ['复制 / 粘贴子树', '⌘ C / ⌘ V'],
              ['全选 / 搜索', '⌘ A / ⌘ F'],
              ['保存 / 命令面板', '⌘ S / ⌘ K'],
              ['删除所选节点', 'Delete / Backspace'],
              ['框选多个节点', 'Shift + 拖动'],
              ['平移 / 缩放', '触控板 / ⌘ 滚轮'],
              ['手动位置 / 改变父节点', '拖动 / 拖到目标节点'],
            ].map(([l, k]) => (
              <div key={l}>
                <span>{l}</span>
                <kbd>{k}</kbd>
              </div>
            ))}
            <p className="muted">
              手动位置按视图保留。「一键美化」清除位置约束。文本输入时编辑快捷键独立处理，支持中文输入法。
            </p>
          </div>
        </Modal>
      )}
      {dialog === 'commands' && (
        <Modal title="你想做什么？" close={() => setDialog(null)}>
          <div className="modal-body command-list">
            {[
              ['新建空白图纸', () => void create(createDocument())],
              ['从 Markdown / JSON 创建', () => setDialog('import')],
              ['AI 创建图纸', () => setDialog('ai')],
              ['思考方法', () => setDialog('methods')],
              ['设置模型与备份', () => setDialog('settings')],
              ...(doc
                ? [
                    [
                      '一键美化',
                      () =>
                        useDesk.getState().commit((d) => {
                          d.viewSettings.positions = {}
                        }),
                    ],
                    [
                      '展开全部',
                      () => useDesk.getState().commit((d) => d.nodes.forEach((n) => (n.collapsed = false))),
                    ],
                    [
                      '折叠到一级',
                      () =>
                        useDesk
                          .getState()
                          .commit((d) => d.nodes.forEach((n) => (n.collapsed = n.parentId === d.rootId))),
                    ],
                    ['AI 结构体检', () => setDialog('analyze')],
                    ['导出图纸', () => setDialog('export')],
                  ]
                : []),
            ].map(([name, fn]) => (
              <button
                key={String(name)}
                onClick={() => {
                  setDialog(null)
                  ;(fn as () => void)()
                }}
              >
                <Command size={15} />
                {String(name)}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'history' && doc && (
        <Modal
          title="版本快照"
          subtitle="自动保留重要修改前的版本，也可以手动创建。"
          close={() => setDialog(null)}
        >
          <div className="modal-body">
            <button
              className="button"
              onClick={async () => {
                await useDesk.getState().save()
                setVersions(await api(`/documents/${doc.documentId}/snapshots`, { method: 'POST' }))
              }}
            >
              <Plus size={14} />
              创建当前快照
            </button>
            <button
              className="button"
              onClick={async () => setVersions(await api(`/documents/${doc.documentId}/snapshots`))}
            >
              加载历史
            </button>
            {versions.map((v) => (
              <div className="version-row" key={v.id}>
                <div>
                  <strong>{new Date(v.createdAt).toLocaleString('zh-CN')}</strong>
                  <p>
                    {v.document.nodes.length} 节点 · {v.document.title}
                  </p>
                </div>
                <button
                  className="button"
                  onClick={() => {
                    useDesk.getState().commit((d) => Object.assign(d, v.document))
                    setDialog(null)
                  }}
                >
                  恢复此版本
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {context && doc && (
        <>
          <div className="context-dismiss" onClick={() => setContext(null)} />
          <div
            className="context-menu"
            style={{
              left: Math.min(context.x, window.innerWidth - 220),
              top: Math.min(context.y, window.innerHeight - 330),
            }}
          >
            {[
              ['添加子节点', () => useDesk.getState().add()],
              ['添加同级节点', () => useDesk.getState().add(true)],
              ['编辑主题', () => useDesk.getState().edit(context.id)],
              ['AI 深入分析', () => setDialog('expand')],
              ['复制整个分支', () => void useDesk.getState().copy().catch(useDesk.getState().setError)],
              ['聚焦此分支', () => useDesk.getState().setFocus(context.id)],
              [
                '提升层级',
                () => {
                  const n = doc.nodes.find((n) => n.id === context.id),
                    parent = doc.nodes.find((p) => p.id === n?.parentId)
                  if (parent?.parentId)
                    useDesk.getState().commit((d) => moveNode(d, context.id, parent.parentId!))
                },
              ],
              ['删除节点', () => useDesk.getState().remove()],
            ].map(([name, fn]) => (
              <button
                key={String(name)}
                onClick={() => {
                  ;(fn as () => void)()
                  setContext(null)
                }}
              >
                {String(name)}
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={() => useDesk.setState({ error: '' })}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
function ArrowRightIcon() {
  return <ChevronRight size={14} />
}
