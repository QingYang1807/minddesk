import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateDocument } from '../packages/core/src/document.ts'
import type { MindDocument } from '../packages/core/src/document.ts'
import { z } from 'zod'
export const LibrarySchema = z.object({
  favorite: z.boolean().default(false),
  folder: z.string().default(''),
  tags: z.array(z.string()).default([]),
  deleted: z.boolean().default(false),
})
export class Store {
  db: DatabaseSync
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true })
    this.db = new DatabaseSync(resolve(directory, 'mind-desk.sqlite'))
    this.db.exec(
      `PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO migrations VALUES(1); CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,document TEXT NOT NULL,metadata TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT,document_id TEXT NOT NULL,document TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS folders(name TEXT PRIMARY KEY);`,
    )
  }
  list() {
    return this.db
      .prepare('SELECT document,metadata FROM documents ORDER BY updated_at DESC')
      .all()
      .map((r) => ({
        document: JSON.parse(String(r.document)) as MindDocument,
        metadata: LibrarySchema.parse(JSON.parse(String(r.metadata))),
      }))
  }
  get(id: string) {
    const row = this.db.prepare('SELECT document,metadata FROM documents WHERE id=?').get(id)
    return row
      ? {
          document: JSON.parse(String(row.document)) as MindDocument,
          metadata: LibrarySchema.parse(JSON.parse(String(row.metadata))),
        }
      : undefined
  }
  save(doc: MindDocument, metadata?: z.infer<typeof LibrarySchema>) {
    const previous = this.get(doc.documentId)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (previous && JSON.stringify(previous.document) !== JSON.stringify(doc)) {
        const last = this.db
          .prepare('SELECT created_at FROM snapshots WHERE document_id=? ORDER BY id DESC LIMIT 1')
          .get(doc.documentId)
        if (!last || Date.now() - Date.parse(String(last.created_at)) > 60000)
          this.db
            .prepare('INSERT INTO snapshots(document_id,document,created_at) VALUES(?,?,?)')
            .run(doc.documentId, JSON.stringify(previous.document), new Date().toISOString())
      }
      this.db
        .prepare(
          'INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document,metadata=excluded.metadata,updated_at=excluded.updated_at',
        )
        .run(
          doc.documentId,
          JSON.stringify(doc),
          JSON.stringify(metadata || previous?.metadata || LibrarySchema.parse({})),
          doc.updatedAt,
        )
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
    return this.get(doc.documentId)
  }
  snapshot(id: string) {
    const row = this.get(id)
    if (!row) throw new Error('图纸不存在')
    this.db
      .prepare('INSERT INTO snapshots(document_id,document,created_at) VALUES(?,?,?)')
      .run(id, JSON.stringify(row.document), new Date().toISOString())
  }
  snapshots(id: string) {
    return this.db
      .prepare('SELECT * FROM snapshots WHERE document_id=? ORDER BY id DESC LIMIT 30')
      .all(id)
      .map((r) => ({ id: r.id, document: JSON.parse(String(r.document)), createdAt: r.created_at }))
  }
  folders() {
    return this.db
      .prepare('SELECT name FROM folders ORDER BY name')
      .all()
      .map((r) => String(r.name))
  }
  backup() {
    return {
      format: 'mind-desk-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      documents: this.list(),
      folders: this.folders(),
      snapshots: this.db.prepare('SELECT * FROM snapshots').all(),
    }
  }
  restore(input: unknown) {
    const parsed = z
      .object({
        format: z.literal('mind-desk-backup'),
        version: z.literal(1),
        documents: z.array(z.object({ document: z.unknown(), metadata: LibrarySchema })),
        folders: z.array(z.string()),
        snapshots: z
          .array(z.object({ document_id: z.string(), document: z.string(), created_at: z.string() }))
          .default([]),
      })
      .parse(input)
    const docs = parsed.documents.map((r) => ({ ...r, document: validateDocument(r.document) }))
    parsed.snapshots.forEach((s) => validateDocument(JSON.parse(s.document)))
    if (new Set(docs.map((r) => r.document.documentId)).size !== docs.length)
      throw new Error('备份包含重复图纸 ID')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.exec('DELETE FROM documents; DELETE FROM snapshots; DELETE FROM folders;')
      docs.forEach((r) =>
        this.db
          .prepare('INSERT INTO documents VALUES(?,?,?,?)')
          .run(
            r.document.documentId,
            JSON.stringify(r.document),
            JSON.stringify(r.metadata),
            r.document.updatedAt,
          ),
      )
      parsed.folders.forEach((f) => this.db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(f))
      parsed.snapshots.forEach((s) =>
        this.db
          .prepare('INSERT INTO snapshots(document_id,document,created_at) VALUES(?,?,?)')
          .run(s.document_id, s.document, s.created_at),
      )
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }
  close() {
    this.db.close()
  }
}
