const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { issueToken, clearToken, requireAuth, requireXhrHeader } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Limita tentativas de login/registro por IP para dificultar força bruta.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
});

function defaultData() {
  return {
    settings: null,
    categories: [],
    transactions: [],
    installments: [],
    cards: [],
    accounts: [],
    purchases: [],
    invoices: {},
    caixinhas: [],
    titheStatus: {},
    reminders: [],
    budgets: [],
    fixedDebts: [],
    fixedDebtPayments: {}
  };
}

// Monta o objeto de sessão/resposta a partir de uma linha de `users`,
// resolvendo o "cofre compartilhado": householdId é o id de quem realmente
// é dono dos dados (o próprio, se for titular; o do titular, se for
// cônjuge — ver server/db.js). `spouse` só é preenchido pro titular, com
// os dados do cônjuge se já existir um cadastrado.
function buildUserPayload(row) {
  const householdId = row.household_id || row.id;
  const isSpouse = !!row.household_id;
  let spouse = null;
  let householdRootEmail = null;
  if (!isSpouse) {
    const s = db.prepare('SELECT email, name FROM users WHERE household_id = ?').get(row.id);
    if (s) spouse = { email: s.email, name: s.name };
  } else {
    const root = db.prepare('SELECT email FROM users WHERE id = ?').get(row.household_id);
    if (root) householdRootEmail = root.email;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, householdId, isSpouse, spouse, householdRootEmail };
}

router.post('/register', authLimiter, requireXhrHeader, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  // Cofre compartilhado (item 1): no registro já dá pra escolher "Casal" e
  // cadastrar o e-mail do cônjuge — ele nasce como um login de verdade,
  // usando a MESMA senha (item 2). Totalmente opcional: pode ficar em
  // branco aqui e ser adicionado depois em Configurações (POST /spouse).
  const mode = req.body.mode === 'couple' ? 'couple' : 'single';
  const spouseEmail = mode === 'couple' ? String(req.body.spouseEmail || '').trim().toLowerCase() : '';

  if (!name || name.length > 120) return res.status(400).json({ error: 'Informe um nome válido.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.` });
  }
  if (spouseEmail) {
    if (!EMAIL_RE.test(spouseEmail)) return res.status(400).json({ error: 'Informe um e-mail válido para o(a) cônjuge.' });
    if (spouseEmail === email) return res.status(400).json({ error: 'O e-mail do(a) cônjuge precisa ser diferente do seu.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
  if (spouseEmail) {
    const spouseExisting = db.prepare('SELECT id FROM users WHERE email = ?').get(spouseEmail);
    if (spouseExisting) return res.status(409).json({ error: 'Já existe uma conta com o e-mail informado para o(a) cônjuge.' });
  }

  const isFirstUser = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  const role = isFirstUser ? 'admin' : 'client';
  const passwordHash = await bcrypt.hash(password, 12);

  // Transação: titular + (opcionalmente) cônjuge nascem juntos, ou nenhum
  // dos dois — nunca um titular "órfão" sem o cônjuge que ele pediu.
  const userId = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(email, name, passwordHash, role);
    const id = info.lastInsertRowid;

    db.prepare('INSERT INTO user_data (user_id, data_json) VALUES (?, ?)')
      .run(id, JSON.stringify(defaultData()));

    if (spouseEmail) {
      // Mesmo hash do titular (mesma senha, mesmo instante) — nunca
      // trafega/derivamos senha em texto puro entre contas. Nome
      // provisório: o wizard de onboarding (finishOnboarding) sincroniza
      // com o nome real assim que a pessoa preenche "Nome do(a) parceiro(a)".
      db.prepare(
        'INSERT INTO users (email, name, password_hash, role, household_id) VALUES (?, ?, ?, ?, ?)'
      ).run(spouseEmail, 'Cônjuge', passwordHash, 'client', id);
    }
    return id;
  })();

  const row = db.prepare('SELECT id, email, name, role, household_id FROM users WHERE id = ?').get(userId);
  const user = buildUserPayload(row);
  issueToken(res, user);
  res.status(201).json({ user });
});

router.post('/login', authLimiter, requireXhrHeader, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const row = db.prepare(
    'SELECT id, email, name, role, password_hash, failed_attempts, locked_until, household_id FROM users WHERE email = ?'
  ).get(email);

  // Mensagem genérica propositalmente (não revela se o e-mail existe ou não).
  const genericError = () => res.status(401).json({ error: 'E-mail ou senha incorretos.' });

  if (!row) return genericError();

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return res.status(423).json({ error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.` });
  }

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    const attempts = row.failed_attempts + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
    }
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
      .run(lockedUntil ? 0 : attempts, lockedUntil, row.id);
    return genericError();
  }

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(row.id);

  const user = buildUserPayload(row);
  issueToken(res, user);
  res.json({ user });
});

router.post('/logout', requireXhrHeader, (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  // Reconsulta o banco (em vez de devolver só o payload do JWT) pra
  // refletir mudanças recentes — ex.: cônjuge que acabou de ser
  // adicionado/removido, ou uma conta cujo login foi revogado nesse meio
  // tempo (aqui a linha nem existe mais e a sessão é encerrada).
  const row = db.prepare('SELECT id, email, name, role, household_id FROM users WHERE id = ?').get(req.user.id);
  if (!row) { clearToken(res); return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' }); }
  res.json({ user: buildUserPayload(row) });
});

// ---- Cofre compartilhado: gestão do login do(a) cônjuge (item 3) ----
// Só o titular pode chamar essas duas rotas — um login de cônjuge não pode
// gerenciar outro cônjuge nem se auto-remover por aqui (ver PLANO.md: o
// servidor nunca confia numa afirmação do cliente sobre "quem manda";
// aqui a checagem é sobre a própria identidade autenticada).
function requireHouseholdRoot(req, res, next) {
  if (req.user.householdId !== req.user.id) {
    return res.status(403).json({ error: 'Somente o titular da conta pode gerenciar o acesso do(a) cônjuge.' });
  }
  next();
}

router.post('/spouse', requireAuth, requireHouseholdRoot, requireXhrHeader, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim().slice(0, 120) || 'Cônjuge';

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (email === req.user.email) return res.status(400).json({ error: 'O e-mail do(a) cônjuge precisa ser diferente do seu.' });

  const existingSpouse = db.prepare('SELECT id, email FROM users WHERE household_id = ?').get(req.user.id);
  const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(email, existingSpouse ? existingSpouse.id : -1);
  if (emailTaken) return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });

  const myHash = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id).password_hash;

  if (existingSpouse) {
    if (existingSpouse.email !== email) {
      // Trocar o e-mail é, na prática, criar um login novo — recopia a
      // senha atual do titular (mesmo bootstrap de sempre) em vez de
      // manter a senha (possivelmente já alterada) do login antigo.
      db.prepare('UPDATE users SET email = ?, name = ?, password_hash = ? WHERE id = ?')
        .run(email, name, myHash, existingSpouse.id);
    } else {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, existingSpouse.id);
    }
  } else {
    db.prepare('INSERT INTO users (email, name, password_hash, role, household_id) VALUES (?, ?, ?, ?, ?)')
      .run(email, name, myHash, 'client', req.user.id);
  }
  res.json({ ok: true, spouse: { email, name } });
});

router.delete('/spouse', requireAuth, requireHouseholdRoot, requireXhrHeader, (req, res) => {
  // Só derruba o login do(a) cônjuge — os dados financeiros nunca
  // estiveram na linha dele(a) (ver server/db.js), então nada se perde.
  db.prepare('DELETE FROM users WHERE household_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ---- Alterar senha (item 3) — sempre a própria linha, nunca a do
// household inteiro. É isso que torna a senha do cônjuge independente da
// do titular depois do bootstrap inicial (mesma senha só na criação). ----
router.post('/change-password', authLimiter, requireAuth, requireXhrHeader, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.` });
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  const match = await bcrypt.compare(currentPassword, row.password_hash);
  if (!match) return res.status(401).json({ error: 'Senha atual incorreta.' });

  const newHash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
