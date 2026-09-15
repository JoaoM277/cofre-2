const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin, requireXhrHeader } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

router.get('/clients', (req, res) => {
  // householdRootEmail só vem preenchido pra linhas de cônjuge (ver
  // server/db.js) — dá pro admin enxergar que duas linhas são, na
  // verdade, um único cofre compartilhado por dois logins.
  const rows = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.created_at,
           root.email AS householdRootEmail
    FROM users u
    LEFT JOIN users root ON root.id = u.household_id
    ORDER BY u.created_at ASC
  `).all();
  res.json({ clients: rows });
});

router.post('/clients', requireXhrHeader, async (req, res) => {
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

  const passwordHash = await bcrypt.hash(password, 12);
  const info = db.prepare(
    'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(email, name, passwordHash, 'client');

  db.prepare('INSERT INTO user_data (user_id, data_json) VALUES (?, ?)').run(
    info.lastInsertRowid,
    JSON.stringify({
      settings: null, categories: [], transactions: [], installments: [], cards: [],
      accounts: [], purchases: [], invoices: {}, caixinhas: [], titheStatus: {}, reminders: [], budgets: [],
      fixedDebts: [], fixedDebtPayments: {}
    })
  );

  res.status(201).json({ client: { id: info.lastInsertRowid, email, name, role: 'client' } });
});

router.delete('/clients/:id', requireXhrHeader, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode remover a própria conta enquanto estiver logado com ela.' });
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Cliente não encontrado.' });

  // ON DELETE CASCADE em user_data cuida de apagar os dados financeiros junto.
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
