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
    budgets: []
  };
}

router.post('/register', authLimiter, requireXhrHeader, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || name.length > 120) return res.status(400).json({ error: 'Informe um nome válido.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.` });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });

  const isFirstUser = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  const role = isFirstUser ? 'admin' : 'client';
  const passwordHash = await bcrypt.hash(password, 12);

  const insertUser = db.prepare(
    'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const info = insertUser.run(email, name, passwordHash, role);
  const userId = info.lastInsertRowid;

  db.prepare('INSERT INTO user_data (user_id, data_json) VALUES (?, ?)')
    .run(userId, JSON.stringify(defaultData()));

  const user = { id: userId, email, name, role };
  issueToken(res, user);
  res.status(201).json({ user });
});

router.post('/login', authLimiter, requireXhrHeader, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const row = db.prepare(
    'SELECT id, email, name, role, password_hash, failed_attempts, locked_until FROM users WHERE email = ?'
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

  const user = { id: row.id, email: row.email, name: row.name, role: row.role };
  issueToken(res, user);
  res.json({ user });
});

router.post('/logout', requireXhrHeader, (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
