import { useEffect, useRef, useState } from 'react'
import {
  X,
  Upload,
  Download,
  Sparkles,
  LoaderCircle,
  Check,
  Square,
  ArrowRight,
  FileJson,
  FileText,
  Image,
  Settings2,
} from 'lucide-react'
import { z } from 'zod'
import {
  DocumentSchema,
  addNode,
  moveNode,
  removeNodes,
  validateDocument,
  descendants,
} from '../../packages/core/src/document'
import type { MindDocument } from '../../packages/core/src/document'
import { parseText, toMarkdown } from '../../packages/core/src/import'
import { toSvg } from '../../packages/core/src/export'
import { api, useDesk } from '../store'
import { SuggestionSchema, applySuggestions } from '../../packages/core/src/suggestions'
import type { SuggestionType } from '../../packages/core/src/suggestions'
export function download(content: string | Blob, name: string, type = 'application/json') {
  const url = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type }) : content),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export function Preview({ doc }: { doc: MindDocument }) {
  return (
    <img
      className="document-preview"
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(doc))}`}
      alt={doc.title}
    />
  )
}
export function Modal({
  title,
  subtitle,
  children,
  close,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  close: () => void
  wide?: boolean
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="关闭弹窗" onClick={close}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
export function ImportDialog({
  close,
  onCreate,
}: {
  close: () => void
  onCreate: (doc: MindDocument) => Promise<void>
}) {
  const [text, setText] = useState(''),
    [preview, setPreview] = useState<MindDocument | null>(null),
    [error, setError] = useState('')
  return (
    <Modal
      title="从文字，开始一张好图"
      subtitle="支持 Mind Desk JSON、Markdown 标题、列表和纯文本缩进大纲。"
      close={close}
      wide
    >
      <div className="modal-body">
        <div className="import-grid">
          <div>
            <label className="file-drop">
              <Upload size={18} />
              <span>选择本地文件</span>
              <input
                type="file"
                accept=".json,.md,.txt,.markdown"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setText(await f.text())
                    setPreview(null)
                  }
                }}
              />
            </label>
            <textarea
              className="import-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setPreview(null)
              }}
              placeholder={'# 我的产品计划\n## 用户研究\n- 用户访谈\n  - 关键问题\n## 设计与研发'}
              aria-label="导入内容"
            />
            <p className="muted">内容只在本机处理。预览通过后才会保存。</p>
          </div>
          <div className="preview-box">
            {preview ? (
              <Preview doc={preview} />
            ) : (
              <div className="empty-preview">
                <FileText size={30} />
                <p>让散落的想法，形成结构</p>
                <span>输入内容后点击校验与预览</span>
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
      <footer>
        <button className="button" onClick={close}>
          取消
        </button>
        <button
          className="button"
          onClick={() => {
            try {
              setPreview(parseText(text))
              setError('')
            } catch (e) {
              setError(String(e))
            }
          }}
        >
          校验与预览
        </button>
        <button
          className="button primary"
          disabled={!preview}
          onClick={() => preview && void onCreate(preview).then(close)}
        >
          创建图纸 <ArrowRight size={15} />
        </button>
      </footer>
    </Modal>
  )
}
export function ExportDialog({ close }: { close: () => void }) {
  const doc = useDesk((s) => s.doc)!,
    selected = useDesk((s) => s.selected),
    [format, setFormat] = useState('svg'),
    [scale, setScale] = useState(2),
    [transparent, setTransparent] = useState(false),
    [branch, setBranch] = useState(false),
    [orientation, setOrientation] = useState('auto'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const svg = toSvg(doc, { transparent, rootId: branch ? selected[0] : undefined, orientation })
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const name = doc.title.replace(/[\\/:*?"<>|]/g, '_')
      if (format === 'json') {
        download(JSON.stringify(doc, null, 2), name + '.json')
        return
      }
      if (format === 'md') {
        download(toMarkdown(doc, branch ? selected[0] : undefined), name + '.md', 'text/markdown')
        return
      }
      if (format === 'svg') {
        download(svg, name + '.svg', 'image/svg+xml')
        return
      }
      const image = new window.Image()
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width * scale
      canvas.height = image.height * scale
      if (canvas.width * canvas.height > 120000000)
        throw new Error('图像过大，请选择较低倍率或导出指定分支 / SVG')
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)
      ctx.drawImage(image, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 生成失败'))), 'image/png'),
      )
      download(blob, name + '.png')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="把清晰的思考，带到下一场讨论"
      subtitle="完整图纸边界 · 保留节点与连线 · 本地导出"
      close={close}
      wide
    >
      <div className="modal-body export-grid">
        <div
          className="export-preview"
          style={{
            background: transparent
              ? 'repeating-conic-gradient(#eee 0% 25%,white 0% 50%) 0/16px 16px'
              : undefined,
          }}
        >
          <img src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)} alt="导出预览" />
        </div>
        <div>
          <label className="field">
            <span>文件格式</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="svg">SVG · 矢量图形</option>
              <option value="png">PNG · 高清图片</option>
              <option value="json">Mind Desk JSON · 完整数据</option>
              <option value="md">Markdown · 内容大纲</option>
            </select>
          </label>
          <label className="field">
            <span>清晰度</span>
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              <option value={1}>1x 原始分辨率</option>
              <option value={2}>2x 高清</option>
              <option value={3}>3x 超清</option>
            </select>
          </label>
          <label className="field">
            <span>版式</span>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
              <option value="auto">自适应图纸</option>
              <option value="landscape">横向 16:9 最小比例</option>
              <option value="portrait">纵向 A 系列最小比例</option>
            </select>
          </label>
          <label className="check-field">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            透明背景
          </label>
          <label className="check-field">
            <input type="checkbox" checked={branch} onChange={(e) => setBranch(e.target.checked)} />
            仅导出所选分支
          </label>
          <p className="muted">JSON 始终保留完整文档。Markdown 以层级文字表达，不包含全部节点属性。</p>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
      <footer>
        <button className="button" onClick={close}>
          取消
        </button>
        <button className="button primary" disabled={busy} onClick={() => void run()}>
          <Download size={15} />
          {busy ? '生成中…' : '导出文件'}
        </button>
      </footer>
    </Modal>
  )
}
type Config = {
  provider: 'ollama' | 'openai'
  baseUrl: string
  model: string
  apiKey: string
  temperature: number
  allowCloud: boolean
  hasKey?: boolean
}
export function SettingsDialog({ close }: { close: () => void }) {
  const [config, setConfig] = useState<Config>({
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: '',
      apiKey: '',
      temperature: 0.5,
      allowCloud: false,
    }),
    [models, setModels] = useState<string[]>([]),
    [status, setStatus] = useState(''),
    [location, setLocation] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    void api<Config>('/ai/config').then((c) => setConfig({ ...c, apiKey: c.hasKey ? '__KEEP__' : '' }))
    void api<{ dataDirectory: string }>('/health').then((r) => setLocation(r.dataDirectory))
  }, [])
  const save = async () => {
    await api('/ai/config', { method: 'PUT', body: JSON.stringify(config) })
    setStatus('配置已保存。密钥仅保存在本机后端。')
  }
  return (
    <Modal title="工作台设置" subtitle="模型与你的数据，都由你掌握。" close={close}>
      <div className="modal-body">
        <span className="eyebrow">AI PROVIDER</span>
        <div className="segmented">
          <button
            className={config.provider === 'ollama' ? 'active' : ''}
            onClick={() =>
              setConfig({ ...config, provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '' })
            }
          >
            Ollama 本地模型
          </button>
          <button
            className={config.provider === 'openai' ? 'active' : ''}
            onClick={() => setConfig({ ...config, provider: 'openai', baseUrl: 'https://api.openai.com/v1' })}
          >
            OpenAI 兼容
          </button>
        </div>
        <label className="field">
          <span>Base URL</span>
          <input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} />
        </label>
        {config.provider === 'openai' && (
          <label className="field">
            <span>API Key {config.hasKey ? '· 已配置' : ''}</span>
            <input
              type="password"
              autoComplete="off"
              value={config.apiKey === '__KEEP__' ? '' : config.apiKey}
              placeholder={config.hasKey ? '留空保留已保存的密钥' : ''}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value || '__KEEP__' })}
            />
          </label>
        )}
        <label className="field">
          <span>模型名称</span>
          <input
            list="model-list"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="先测试连接，或手动填写模型名称"
          />
          <datalist id="model-list">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        {models.length > 0 && (
          <select
            className="model-picker"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          >
            <option value="">选择可用模型…</option>
            {models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        )}
        <label className="field">
          <span>温度 {config.temperature}</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature}
            onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={config.allowCloud}
            onChange={(e) => setConfig({ ...config, allowCloud: e.target.checked })}
          />
          允许发送内容至非本机模型服务
        </label>
        <p className="muted">启用后，提示词与所选图纸内容将发送到你配置的服务。默认只允许本机地址。</p>
        <div className="inline-actions">
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await save()
                const result = await api<string[]>('/ai/models')
                setModels(result)
                setStatus(`连接成功 · ${result.length} 个模型`)
              } catch (e) {
                setStatus(String(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <LoaderCircle size={14} className="spin" /> : <Settings2 size={14} />}测试连接 / 获取模型
          </button>
        </div>
        {status && <div className="notice">{status}</div>}
        <hr />
        <span className="eyebrow">LOCAL DATA</span>
        <p className="data-path">{location}</p>
        <div className="inline-actions">
          <button
            className="button"
            onClick={async () =>
              download(JSON.stringify(await api('/backup'), null, 2), 'mind-desk-backup.json')
            }
          >
            备份整库
          </button>
          <label className="button">
            恢复备份
            <input
              hidden
              type="file"
              accept=".json"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  const value: unknown = JSON.parse(await f.text())
                  await useDesk.getState().save()
                  await api('/restore', { method: 'POST', body: JSON.stringify(value) })
                  useDesk.setState({ doc: null, past: [], future: [], selected: [] })
                  await useDesk.getState().load()
                  setStatus('备份恢复完成')
                } catch (error) {
                  setStatus(String(error))
                }
              }}
            />
          </label>
        </div>
        <p className="muted">恢复会替换当前图纸库。请先备份。密钥不包含在备份中。</p>
      </div>
      <footer>
        <button className="button" onClick={close}>
          关闭
        </button>
        <button className="button primary" onClick={() => void save().catch((e) => setStatus(String(e)))}>
          保存设置
        </button>
      </footer>
    </Modal>
  )
}
export function AIDialog({
  close,
  onCreate,
  initialMode = 'create',
}: {
  close: () => void
  onCreate: (d: MindDocument) => Promise<void>
  initialMode?: string
}) {
  const doc = useDesk((s) => s.doc),
    selected = useDesk((s) => s.selected),
    [mode, setMode] = useState(initialMode),
    [analysis, setAnalysis] = useState('自由脑暴'),
    [prompt, setPrompt] = useState(''),
    [busy, setBusy] = useState(false),
    [count, setCount] = useState(0),
    [preview, setPreview] = useState<MindDocument | null>(null),
    [suggestions, setSuggestions] = useState<SuggestionType[]>([]),
    [accepted, setAccepted] = useState<number[]>([]),
    [error, setError] = useState(''),
    controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const run = async () => {
    setBusy(true)
    setError('')
    setPreview(null)
    setSuggestions([])
    setCount(0)
    controller.current = new AbortController()
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: `分析模式：${analysis}。${prompt || '请深入分析所选节点，给出具体且可验证的改进建议。'}`,
          document: mode === 'create' ? undefined : doc,
          nodeId: mode === 'create' ? undefined : selected[0],
        }),
        signal: controller.current.signal,
      })
      if (!response.ok) throw new Error((await response.json()).error)
      const reader = response.body!.getReader(),
        decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const p = await reader.read()
        if (p.done) break
        buffer += decoder.decode(p.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        lines.filter(Boolean).forEach((line) => {
          const data = JSON.parse(line) as { error?: string; characters?: number; result?: unknown }
          if (data.error) throw new Error(data.error)
          if (data.characters !== undefined) setCount(data.characters)
          if (data.result) {
            if (mode === 'create') setPreview(validateDocument(data.result))
            else {
              const value = z.object({ suggestions: z.array(SuggestionSchema) }).parse(data.result)
              setSuggestions(value.suggestions)
              setAccepted(value.suggestions.map((_, i) => i))
            }
          }
        })
      }
    } catch (e) {
      setError(e instanceof Error && e.name === 'AbortError' ? '已取消，原图纸保持完整。' : String(e))
    } finally {
      setBusy(false)
    }
  }
  const apply = () => {
    try {
      if (preview) {
        void onCreate(preview).then(close)
        return
      }
      if (!doc) return
      const next = applySuggestions(
        doc,
        suggestions.filter((_, i) => accepted.includes(i)),
      )
      useDesk.getState().commit((d) => Object.assign(d, next))
      close()
    } catch (e) {
      setError(String(e))
    }
  }
  return (
    <Modal
      title="给思考，多一个视角"
      subtitle="AI 帮你展开可能性。所有结果先预览，由你决定。"
      close={close}
      wide
    >
      <div className="modal-body">
        <div className="ai-banner">
          <div className="ai-symbol">
            <Sparkles size={24} />
          </div>
          <div>
            <strong>你的思考伙伴</strong>
            <p>从一个主题出发，构建结构、发现遗漏、深入追问。</p>
          </div>
          <span className="badge">真实模型连接</span>
        </div>
        <div className="ai-controls">
          <label className="field">
            <span>操作</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="create">创建新图纸</option>
              {doc && (
                <>
                  <option value="expand">扩展所选节点</option>
                  <option value="analyze">结构体检 / 识别遗漏</option>
                  <option value="tasks">拆解任务与验收标准</option>
                  <option value="root-cause">追问根因与验证方案</option>
                  <option value="rewrite">提炼总结与改写</option>
                  <option value="risks">潜在风险与依赖</option>
                </>
              )}
            </select>
          </label>
          <label className="field">
            <span>思考模式</span>
            <select value={analysis} onChange={(e) => setAnalysis(e.target.value)}>
              {['自由脑暴', 'MECE 问题拆解', '产品规划', '根因分析', '任务拆解', '决策分析'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          className="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：梳理一个 AI 企业背调产品，从需求验证到正式上线的完整研发计划…"
          aria-label="AI 需求"
        />
        {mode !== 'create' && (
          <p className="muted">
            作用范围：{doc?.nodes.find((n) => n.id === selected[0])?.text || '当前图纸'}。应用后可用 ⌘Z 撤销。
          </p>
        )}
        {busy && (
          <div className="notice">
            <LoaderCircle size={16} className="spin" /> 正在接收模型输出 · {count.toLocaleString()} 字符
          </div>
        )}
        {preview && (
          <div className="ai-result">
            <span className="badge success">
              <Check size={12} />
              结构校验通过 · {preview.nodes.length} 节点
            </span>
            <Preview doc={preview} />
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((s, i) => (
              <label className="suggestion" key={i}>
                <input
                  type="checkbox"
                  checked={accepted.includes(i)}
                  onChange={(e) =>
                    setAccepted(e.target.checked ? [...accepted, i] : accepted.filter((v) => v !== i))
                  }
                />
                <div>
                  <span className="badge">
                    {{ add: '新增', update: '修改', remove: '删除', move: '移动' }[s.kind]}
                  </span>{' '}
                  <span className="muted">
                    {{ fact: '事实（需核实）', hypothesis: '假设', suggestion: '建议' }[s.classification]}
                  </span>
                  <strong>{s.text || doc?.nodes.find((n) => n.id === s.nodeId)?.text}</strong>
                  <p>{s.reason}</p>
                  <small>
                    对应节点：{doc?.nodes.find((n) => n.id === (s.nodeId || s.parentId))?.text || '所选节点'}
                  </small>
                  <button
                    className="text-button"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      if (s.nodeId) useDesk.getState().select([s.nodeId])
                    }}
                  >
                    定位
                  </button>
                </div>
              </label>
            ))}
          </div>
        )}
        {error && (
          <div className="error-message">
            {error}
            <p>请在设置中检查服务地址、模型和授权。已有内容未被修改。</p>
          </div>
        )}
      </div>
      <footer>
        <span className="footer-note">结果可能有误，请核实事实与证据。</span>
        {busy ? (
          <button className="button" onClick={() => controller.current?.abort()}>
            <Square size={13} />
            取消请求
          </button>
        ) : (
          <button className="button" onClick={() => void run()} disabled={!prompt && mode === 'create'}>
            <Sparkles size={15} />
            开始生成
          </button>
        )}
        <button className="button primary" disabled={!preview && !accepted.length} onClick={apply}>
          {preview ? '保存为新图纸' : '应用所选建议'}
          <ArrowRight size={15} />
        </button>
      </footer>
    </Modal>
  )
}
