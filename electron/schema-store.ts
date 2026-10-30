import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SCHEMA, validateSchema } from './form-schema';
import type { FormSchema } from './form-schema';

export class SchemaStore {
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file, { timeout: 1000 });
    try {
      const version = this.db.prepare('PRAGMA user_version').get()!.user_version;
      if (version !== 0 && version !== 1) throw new Error('Unsupported schema database version');
      if (version === 0) {
        if (this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().length) {
          throw new Error('Refusing to initialize an unrelated database');
        }
        this.db.exec(`BEGIN IMMEDIATE;
          CREATE TABLE schema_revisions (
            id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0),
            schema_json TEXT NOT NULL CHECK(json_valid(schema_json)),
            PRIMARY KEY (id, revision)
          ) STRICT;
          PRAGMA user_version = 1;
          COMMIT;`);
      }
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      this.remember(DEFAULT_SCHEMA);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  list(): FormSchema[] {
    return this.db.prepare(`SELECT id, revision, schema_json FROM schema_revisions AS s
      WHERE revision = (SELECT MAX(revision) FROM schema_revisions WHERE id = s.id)
      ORDER BY id`).all().map((row) => {
        const schema = validateSchema(JSON.parse(String(row.schema_json)));
        if (schema.id !== row.id || schema.revision !== row.revision) throw new Error('Corrupt schema identity or revision');
        return schema;
      });
  }

  remember(input: FormSchema) {
    const schema = validateSchema(input);
    const row = this.db.prepare('SELECT schema_json FROM schema_revisions WHERE id = ? AND revision = ?').get(schema.id, schema.revision);
    if (row) {
      if (JSON.stringify(validateSchema(JSON.parse(String(row.schema_json)))) !== JSON.stringify(schema)) {
        throw new Error('This schema revision already exists with different definitions');
      }
      return;
    }
    this.db.prepare('INSERT INTO schema_revisions (id, revision, schema_json) VALUES (?, ?, ?)')
      .run(schema.id, schema.revision, JSON.stringify(schema));
  }

  save(input: unknown): FormSchema {
    const schema = validateSchema(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT MAX(revision) AS revision FROM schema_revisions WHERE id = ?').get(schema.id)!;
      if (row.revision !== null && row.revision !== schema.revision) throw new Error('The form changed. Reload its latest revision before editing.');
      if (row.revision === null && schema.revision !== 1) throw new Error('A new form must start at revision 1');
      const next = { ...schema, revision: row.revision === null ? 1 : schema.revision + 1 };
      this.remember(next);
      this.db.exec('COMMIT');
      return next;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  importFrom(file: string) {
    const source = new DatabaseSync(file, { readOnly: true });
    try {
      if (source.prepare('PRAGMA user_version').get()!.user_version !== 1) throw new Error('Unsupported legacy schema database');
      const rows = source.prepare('SELECT schema_json FROM schema_revisions ORDER BY id, revision').all();
      this.db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of rows) this.remember(validateSchema(JSON.parse(String(row.schema_json))));
        this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    } finally { source.close(); }
  }

  close() { this.db.close(); }
}
