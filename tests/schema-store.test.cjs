const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { SchemaStore } = require('../dist-electron/schema-store.js');
const { DEFAULT_SCHEMA, validateSchema } = require('../dist-electron/form-schema.js');

test('SQLite persists only immutable form revisions across reopen and detects stale edits', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-schema-db-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'data', 'forms.sqlite');
  const first = new SchemaStore(file);
  const original = first.list()[0];
  assert.deepEqual(original, validateSchema(DEFAULT_SCHEMA));
  const edited = first.save({ ...original, name: 'Review 🕯', fields: original.fields.map((field) => field.id === 'symbol' ? { ...field, label: 'Instrument', key: 'instrument' } : field) });
  assert.equal(edited.revision, 2);
  first.close();
  const reopened = new SchemaStore(file);
  const other = new SchemaStore(file);
  try {
    assert.deepEqual(reopened.list()[0], edited);
    assert.throws(() => reopened.save(original), /changed/);
    assert.equal(reopened.save(edited).revision, 3);
    assert.throws(() => other.save(edited), /changed/);
    assert.throws(() => reopened.remember({ ...original, name: 'Conflicting history' }), /different/);
    assert.equal(reopened.list()[0].revision, 3);
    const db = new DatabaseSync(file);
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
      assert.deepEqual(tables, ['schema_revisions']);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_revisions').get().count, 3);
      const row = db.prepare('SELECT schema_json FROM schema_revisions WHERE revision = 1').get();
      assert.deepEqual(validateSchema(JSON.parse(row.schema_json)), original);
      assert.equal(Object.hasOwn(JSON.parse(row.schema_json), 'values'), false);
    } finally { db.close(); }
  } finally { reopened.close(); other.close(); }
});

test('invalid schemas cannot change existing revisions', () => {
  const store = new SchemaStore(':memory:');
  try {
    const original = store.list();
    assert.throws(() => store.save({ ...original[0], fields: [] }));
    assert.throws(() => store.save({ ...original[0], id: 'new_form', revision: 9 }));
    assert.deepEqual(store.list(), original);
  } finally { store.close(); }
});

test('future or unrelated databases are rejected without rewriting their contents', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-db-version-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const version of [0, 99]) {
    const file = path.join(root, `${version}.sqlite`);
    const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE existing(value TEXT); INSERT INTO existing VALUES ('keep'); PRAGMA user_version = ${version}`);
    db.close();
    assert.throws(() => new SchemaStore(file));
    const check = new DatabaseSync(file);
    try {
      assert.equal(check.prepare('PRAGMA user_version').get().user_version, version);
      assert.equal(check.prepare('SELECT value FROM existing').get().value, 'keep');
    } finally { check.close(); }
  }
});
