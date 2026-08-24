const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireXhrHeader } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGE = 500;
const MAX_NAME = 120;

// POST /api/feedback — qualquer conta autenticada pode enviar. user_id e
// created_at vêm sempre da sessão/relógio do servidor (ver comentário em
// server/db.js) — o cliente nunca escolhe esses dois campos.
router.post('/', requireXhrHeader, (req, res) => {
  const b = req.body || {};
  const rating = Number(b.rating);
  const message = String(b.message || '').trim();
  const nameRaw = b.name != null ? String(b.name).trim() : '';

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Escolha uma nota de 1 a 5.' });
  }
  if (!message) return res.status(400).json({ error: 'Escreva uma mensagem antes de enviar.' });
  if (message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: `A mensagem não pode passar de ${MAX_MESSAGE} caracteres.` });
  }
  if (nameRaw.length > MAX_NAME) {
    return res.status(400).json({ error: `O nome não pode passar de ${MAX_NAME} caracteres.` });
  }

  db.prepare(`
    INSERT INTO feedback (user_id, rating, name, message)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, rating, nameRaw || null, message);

  res.status(201).json({ ok: true });
});

// GET /api/feedback/admin — lista TODOS os feedbacks, de todas as contas.
// Só admin: feedback não é um dado "da própria conta" isolado como o
// resto do app, é dirigido a quem administra o produto.
router.get('/admin', requireAdmin, (req, res) => {
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const rows = db.prepare(`
    SELECT f.id, f.rating, f.name, f.message, f.created_at AS createdAt,
           u.name AS accountName, u.email AS accountEmail
    FROM feedback f
    JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS n FROM feedback').get().n;

  res.json({ feedback: rows, total, limit, offset });
});

module.exports = router;
