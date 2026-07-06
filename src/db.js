// Customer storage — Node's built-in SQLite (no native build, single file).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'customers.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    due_date   TEXT    NOT NULL,
    email      TEXT,
    lang       TEXT    NOT NULL DEFAULT 'en',
    order_ref  TEXT,
    notes      TEXT,
    created_at TEXT    NOT NULL
  )
`);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function list() {
  return db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
}
function get(id) {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}
function create(c) {
  const name = (c.name || '').trim();
  if (!name) throw new Error('Name is required');
  if (!isDate(c.due_date)) throw new Error('Valid due date (YYYY-MM-DD) is required');
  const lang = c.lang === 'de' ? 'de' : 'en';
  const info = db.prepare(
    `INSERT INTO customers (name, due_date, email, lang, order_ref, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, c.due_date, c.email || null, lang, c.order_ref || null, c.notes || null,
        new Date().toISOString());
  return get(Number(info.lastInsertRowid));
}
function remove(id) {
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id);
}

module.exports = { list, get, create, remove };
