// Storage — Node's built-in SQLite (no native build, single file).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
    token      TEXT,
    source     TEXT,
    created_at TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    pass_hash  TEXT    NOT NULL,
    salt       TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'staff',
    created_at TEXT    NOT NULL
  );
`);
// Migrations for databases created before these columns existed.
for (const col of ['token TEXT', 'source TEXT']) {
  try { db.exec(`ALTER TABLE customers ADD COLUMN ${col}`); } catch { /* already there */ }
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// ---- Customers -------------------------------------------------------------
function list() { return db.prepare('SELECT * FROM customers ORDER BY id DESC').all(); }
function get(id) { return db.prepare('SELECT * FROM customers WHERE id = ?').get(id); }
function getByToken(token) {
  return token ? db.prepare('SELECT * FROM customers WHERE token = ?').get(token) : undefined;
}
function create(c) {
  const name = (c.name || '').trim();
  if (!name) throw new Error('Name is required');
  if (!isDate(c.due_date)) throw new Error('Valid due date (YYYY-MM-DD) is required');
  const lang = c.lang === 'de' ? 'de' : 'en';
  const token = crypto.randomBytes(12).toString('hex');
  const info = db.prepare(
    `INSERT INTO customers (name, due_date, email, lang, order_ref, notes, token, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, c.due_date, c.email || null, lang, c.order_ref || null, c.notes || null,
        token, c.source || 'manual', new Date().toISOString());
  return get(Number(info.lastInsertRowid));
}
function remove(id) { return db.prepare('DELETE FROM customers WHERE id = ?').run(id); }

// ---- Users -----------------------------------------------------------------
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function listUsers() {
  return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
}
function createUser({ username, password, role }) {
  username = (username || '').trim().toLowerCase();
  if (!username) throw new Error('Username is required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new Error('That username already exists');
  const { salt, hash } = hashPassword(password);
  db.prepare('INSERT INTO users (username, pass_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, hash, salt, role === 'admin' ? 'admin' : 'staff', new Date().toISOString());
  return db.prepare('SELECT id, username, role FROM users WHERE username = ?').get(username);
}
function removeUser(id) { return db.prepare('DELETE FROM users WHERE id = ?').run(id); }
function verifyUser(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').trim().toLowerCase());
  if (!u) return null;
  const { hash } = hashPassword(password, u.salt);
  const ok = hash.length === u.pass_hash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(u.pass_hash));
  return ok ? { id: u.id, username: u.username, role: u.role } : null;
}
function countUsers() { return db.prepare('SELECT COUNT(*) c FROM users').get().c; }

module.exports = {
  list, get, getByToken, create, remove,
  listUsers, createUser, removeUser, verifyUser, countUsers
};
