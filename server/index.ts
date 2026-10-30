import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { z } from 'zod'
import { Store, LibrarySchema } from './database.ts'
import { aiConfig, saveConfig, publicConfig, models, generate } from './ai.ts'
import { validateDocument } from '../packages/core/src/document.ts'
const directory = resolve(process.env.MIND_DESK_DATA || 'data'),
  store = new Store(directory)
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  const url = new URL(req.url || '/', `http://${req.headers.host}`),
    path = url.pathname
  const send = (body: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }
  try {
    if (
      path.startsWith('/api/') &&
      req.method !== 'GET' &&
      req.headers.origin &&
      !/^http:\/\/(127\.0\.0\.1|localhost):(4319|4320)$/.test(req.headers.origin)
    )
      return send({ error: '不允许的来源' }, 403)
    let raw = ''
    for await (const part of req) {
      raw += part.toString()
      if (Buffer.byteLength(raw) > 12 * 1024 * 1024) return send({ error: '文件超过 12MB 限制' }, 413)
    }
    const body: unknown = raw ? JSON.parse(raw) : {}
    if (path === '/api/health') return send({ app: 'mind-desk', version: '0.1.0', dataDirectory: directory })
    if (path === '/api/documents' && req.method === 'GET') return send(store.list())
    if (path === '/api/documents' && req.method === 'POST') return send(store.save(validateDocument(body)))
    const match = path.match(/^\/api\/documents\/([^/]+)(?:\/(metadata|snapshots))?$/)
    if (match) {
      const id = decodeURIComponent(match[1]),
        row = store.get(id)
      if (!row) return send({ error: '图纸不存在' }, 404)
      if (match[2] === 'snapshots') {
        if (req.method === 'POST') store.snapshot(id)
        return send(store.snapshots(id))
      }
      if (match[2] === 'metadata') return send(store.save(row.document, LibrarySchema.parse(body)))
      if (req.method === 'PUT') {
        const doc = validateDocument(body)
        if (doc.documentId !== id) throw new Error('documentId 不匹配')
        return send(store.save(doc))
      }
      return send(row)
    }
    if (path === '/api/folders') {
      if (req.method === 'POST') {
        const b = z.object({ name: z.string().trim().min(1).max(100) }).parse(body)
        store.db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(b.name)
      }
      return send(store.folders())
    }
    if (path === '/api/backup') return send(store.backup())
    if (path === '/api/restore' && req.method === 'POST') {
      store.restore(body)
      return send({ ok: true })
    }
    if (path === '/api/ai/config') {
      if (req.method === 'PUT') return send(saveConfig(directory, body))
      return send(publicConfig(aiConfig(directory)))
    }
    if (path === '/api/ai/models') return send(await models(aiConfig(directory)))
    if (path === '/api/ai/generate' && req.method === 'POST') {
      const input = z
          .object({
            mode: z.string(),
            prompt: z.string().max(100000),
            document: z.unknown().optional(),
            nodeId: z.string().optional(),
          })
          .parse(body),
        controller = new AbortController()
      res.on('close', () => controller.abort())
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      res.write(JSON.stringify({ status: 'generating', characters: 0 }) + '\n')
      try {
        const result = await generate(aiConfig(directory), input, controller.signal, (n) => {
          if (!res.destroyed) res.write(JSON.stringify({ status: 'generating', characters: n }) + '\n')
        })
        if (!res.destroyed) res.end(JSON.stringify({ result }) + '\n')
      } catch (e) {
        if (!res.destroyed)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'AI 请求失败' }) + '\n')
      }
      return
    }
    if (path.startsWith('/api/')) return send({ error: 'API 不存在' }, 404)
    const file = resolve('dist', '.' + decodeURIComponent(path === '/' ? '/index.html' : path))
    if (!file.startsWith(resolve('dist') + '/')) return send({ error: '无效路径' }, 400)
    const target = existsSync(file) ? file : resolve('dist/index.html')
    if (!existsSync(target)) return send({ error: '请先运行 npm run build 或 npm run dev' }, 404)
    res.writeHead(200, {
      'Content-Type':
        (
          {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
          } as Record<string, string>
        )[extname(target)] || 'application/octet-stream',
    })
    res.end(readFileSync(target))
  } catch (e) {
    send({ error: e instanceof Error ? e.message : '操作失败' }, 400)
  }
})
server.listen(Number(process.env.PORT || 4320), '127.0.0.1', () =>
  console.log(`Mind Desk http://127.0.0.1:${process.env.PORT || 4320} · ${directory}`),
)
process.on('SIGTERM', () =>
  server.close(() => {
    store.close()
    process.exit(0)
  }),
)
