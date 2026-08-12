const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'cofre.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// -----------------------------------------------------------------------
// Esquema. Cada usuário autenticado tem seu próprio registro em `users`
// (com a senha em hash) e um único blob JSON em `user_data` guardando as
// informações financeiras (transações, caixinhas, parcelas, etc).
//
// O isolamento entre clientes é garantido no SERVIDOR: toda consulta a
// `user_data` é filtrada por user_id extraído do token JWT validado,
// nunca por um valor que o cliente possa manipular (diferente da versão
// 100% client-side anterior, onde a "separação" dependia só do nome da
// chave usada no storage).
// -----------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin','client')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
