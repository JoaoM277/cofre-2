const express = require('express');
const db = require('../db');
const { requireAuth, requireXhrHeader } = require('../middleware/auth');

const router = express.Router();

const MAX_JSON_SIZE = 2 * 1024 * 1024; // 2MB por conta é bastante folga para este uso

// Validação estrutural mínima do "bundle" antes de salvar — evita gravar
// lixo caso o cliente envie algo inesperado (defesa em profundidade; o
// express.json() já limita o tamanho do payload no nível do servidor).
function isValidBundle(data) {
  if (!data || typeof data !== 'object') return false;
  const arrayFields = [
    'categories', 'transactions', 'installments', 'cards', 'caixinhas', 'reminders', 'budgets',
    // accounts/purchases: novas entidades do módulo de cartões/faturas (ver PLANO.md).
    'accounts', 'purchases'
  ];
  for (const f of arrayFields) {
    if (!Array.isArray(data[f])) return false;
  }
  if (typeof data.titheStatus !== 'object') return false;
  // invoices substitui o antigo cardBills (mesmo formato de mapa "cardId-mKey" -> estado,
  // mas sem valor manual — ver PLANO.md seção 2). Aceita qualquer um dos dois nomes
  // presentes como objeto, pra não travar uma migração em andamento no cliente.
  if (typeof data.invoices !== 'object' && typeof data.cardBills !== 'object') return false;
  if (data.settings !== null && typeof data.settings !== 'object') return false;
  return true;
}

router.get('/data', requireAuth, (req, res) => {
  const row = db.prepare('SELECT data_json FROM user_data WHERE user_id = ?').get(req.user.id);
  if (!row) return res.json({ data: null });
  res.json({ data: JSON.parse(row.data_json) });
});

router.put('/data', requireAuth, requireXhrHeader, (req, res) => {
  const data = req.body;
  const serialized = JSON.stringify(data || {});
  if (serialized.length > MAX_JSON_SIZE) {
    return res.status(413).json({ error: 'Dados excedem o tamanho máximo permitido.' });
  }
  if (!isValidBundle(data)) {
    return res.status(400).json({ error: 'Formato de dados inválido.' });
  }
  db.prepare(
    `INSERT INTO user_data (user_id, data_json, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`
  ).run(req.user.id, serialized);
  res.json({ ok: true });
});

module.exports = router;
