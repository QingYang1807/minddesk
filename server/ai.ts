import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { DocumentSchema, validateDocument } from '../packages/core/src/document.ts'
export const ConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai']).default('ollama'),
  baseUrl: z.url().default('http://127.0.0.1:11434'),
  model: z.string().default(''),
  apiKey: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.5),
  allowCloud: z.boolean().default(false),
})
import { SuggestionSchema, applySuggestions } from '../packages/core/src/suggestions.ts'

export function aiConfig(directory: string) {
  const path = resolve(directory, 'ai-settings.json')
  return existsSync(path)
    ? ConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : ConfigSchema.parse({})
}
export function saveConfig(directory: string, input: unknown) {
  const next = ConfigSchema.parse(input),
    old = aiConfig(directory)
  if (next.apiKey === '__KEEP__') next.apiKey = old.apiKey
  writeFileSync(resolve(directory, 'ai-settings.json'), JSON.stringify(next), { mode: 0o600 })
  return publicConfig(next)
}
export function publicConfig(c: z.infer<typeof ConfigSchema>) {
  return { ...c, apiKey: '', hasKey: !!c.apiKey }
}
function endpoint(config: z.infer<typeof ConfigSchema>, path: string) {
  const url = new URL(config.baseUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Base URL 必须为 HTTP(S) 且不能包含凭据')
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !config.allowCloud)
    throw new Error('请先在设置中允许将内容发送至外部模型服务')
  return config.baseUrl.replace(/\/$/, '') + path
}
export async function models(config: z.infer<typeof ConfigSchema>) {
  const response = await fetch(endpoint(config, config.provider === 'ollama' ? '/api/tags' : '/models'), {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`模型连接失败：HTTP ${response.status}`)
  const body = (await response.json()) as { models?: { name: string }[]; data?: { id: string }[] }
  return config.provider === 'ollama'
    ? (body.models || []).map((m) => m.name)
    : (body.data || []).map((m) => m.id)
}
export async function generate(
  config: z.infer<typeof ConfigSchema>,
  input: { mode: string; prompt: string; document?: unknown; nodeId?: string },
  signal: AbortSignal,
  onProgress: (count: number) => void,
) {
  if (!config.model) throw new Error('请先选择模型')
  const system = `你是 Mind Desk 专业结构化思考助手。只返回 JSON，不要 Markdown 代码围栏。不编造事实、证据或验证结论。所有推测标注假设。${input.mode === 'create' ? `返回完整 Mind Desk 文档，符合此 JSON Schema: ${JSON.stringify(z.toJSONSchema(DocumentSchema))}。生成稳定唯一 ID 和当前 ISO 时间，schemaVersion 必须是 "1.0"。` : `返回 {"suggestions":[{"kind":"add|update|remove|move","nodeId":"已有节点ID（修改/删除/移动）","parentId":"已有父节点ID（新增/移动）","text":"文本","note":"说明","reason":"具体理由","classification":"hypothesis|suggestion|fact"}]}。仅针对提供的节点或子树进行${input.mode}，指出具体节点，给出可以逐项应用的建议；不要擅自把假设当事实。`}`
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(input) },
  ]
  const url = endpoint(config, config.provider === 'ollama' ? '/api/chat' : '/chat/completions')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      ...(config.provider === 'ollama'
        ? { format: 'json', options: { temperature: config.temperature } }
        : { temperature: config.temperature, response_format: { type: 'json_object' } }),
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
  })
  if (!response.ok) throw new Error(`模型请求失败：HTTP ${response.status}`)
  if (!response.body) throw new Error('模型返回空响应')
  const reader = response.body.getReader(),
    decoder = new TextDecoder()
  let buffer = '',
    content = ''
  while (true) {
    const part = await reader.read()
    if (part.done) break
    buffer += decoder.decode(part.value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const raw = config.provider === 'ollama' ? line : line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!raw || raw === '[DONE]') continue
      const data = JSON.parse(raw) as {
        error?: string
        message?: { content?: string }
        choices?: { delta?: { content?: string } }[]
      }
      if (data.error) throw new Error('模型流返回错误')
      content += data.message?.content || data.choices?.[0]?.delta?.content || ''
      onProgress(content.length)
    }
  }
  const parsed: unknown = JSON.parse(content.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, ''))
  if (input.mode === 'create') return validateDocument(parsed)
  const result = z.object({ suggestions: z.array(SuggestionSchema).max(100) }).parse(parsed)
  applySuggestions(validateDocument(input.document), result.suggestions)
  return result
}
