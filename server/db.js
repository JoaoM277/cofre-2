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

  -- ---------------------------------------------------------------------
  -- Auditoria — deliberadamente FORA do blob de user_data. O blob inteiro
  -- é reescrito a cada PUT /api/data; se a auditoria vivesse lá dentro,
  -- um bug (ou um PUT malicioso) no cliente apagaria o histórico junto.
  -- Por viver numa tabela própria, sem NENHUM endpoint de update/delete
  -- exposto (nem para admin), o registro é append-only de verdade: a
  -- garantia de "não apagável" vem da ausência da capacidade na API, não
  -- de uma checagem de permissão que poderia ser furada.
  --
  -- user_id e created_at são sempre preenchidos pelo servidor (sessão JWT
  -- + relógio do servidor) — o cliente não escolhe esses dois campos, o
  -- que é o que dá confiabilidade real ao "quem" (no nível de conta) e ao
  -- "quando". Os demais campos (actor_person_*, action, module, description,
  -- changes_json) descrevem o que aconteceu do ponto de vista da interface;
  -- ver PLANO.md seção 6 para a limitação honesta sobre atribuição por
  -- pessoa quando o casal compartilha um único login.
  -- ---------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_person_id TEXT,
    actor_person_name TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    description TEXT NOT NULL,
    changes_json TEXT,
    card_id TEXT,
    account_id TEXT,
    category_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(user_id, created_at DESC);

  -- ---------------------------------------------------------------------
  -- Feedback — igual à auditoria, uma tabela própria fora do blob de
  -- user_data (não faria sentido um feedback viver dentro dos dados
  -- financeiros de uma conta, já que quem precisa ver TODOS os feedbacks,
  -- de TODAS as contas, é o admin — o blob de user_data é sempre isolado
  -- por conta e nunca é lido entre contas).
  --
  -- user_id e created_at são sempre preenchidos pelo servidor (sessão JWT
  -- + relógio do servidor), nunca pelo cliente. O "nome" é um campo livre
  -- e opcional que a pessoa escolhe mostrar NESSE feedback (pode divergir
  -- do nome da própria conta, ou ficar em branco) — o vínculo real com a
  -- conta continua garantido por user_id, mesmo quando o nome fica vazio.
  -- ---------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    name TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
`);

module.exports = db;
