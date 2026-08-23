const express = require('express');
const db = require('../db');
const { requireAuth, requireXhrHeader } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Vocabulários fechados — mantém o filtro e a exibição consistentes, e
// evita que um valor aleatório enviado pelo cliente vire lixo na coluna.
const ACTIONS = new Set([
  'criou', 'editou', 'excluiu', 'pagou', 'estornou', 'ativou', 'desativou'
]);
const MODULES = new Set([
  'transacoes', 'cartoes', 'contas', 'orcamentos', 'categorias', 'parcelas', 'caixinhas', 'lembretes'
]);

const MAX_DESCRIPTION = 500;
const MAX_CHANGES_JSON = 4000;

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

// POST /api/audit — só insere. Não existe PUT/PATCH/DELETE nesta rota de
// propósito (ver comentário em server/db.js).
router.post('/', requireXhrHeader, (req, res) => {
  const b = req.body || {};
  const action = String(b.action || '').trim();
  const module_ = String(b.module || '').trim();
  const entityType = String(b.entityType || '').trim().slice(0, 60);
  const description = String(b.description || '').trim();

  if (!ACTIONS.has(action)) return res.status(400).json({ error: 'Ação de auditoria inválida.' });
  if (!MODULES.has(module_)) return res.status(400).json({ error: 'Módulo de auditoria inválido.' });
  if (!entityType) return res.status(400).json({ error: 'Tipo de registro é obrigatório.' });
  if (!description || description.length > MAX_DESCRIPTION) {
    return res.status(400).json({ error: 'Descrição inválida.' });
  }

  let changesJson = null;
  if (b.changes != null) {
    if (!Array.isArray(b.changes)) return res.status(400).json({ error: 'Formato de alterações inválido.' });
    const ok = b.changes.every(c => isPlainObject(c) && 'field' in c);
    if (!ok) return res.status(400).json({ error: 'Formato de alterações inválido.' });
    changesJson = JSON.stringify(b.changes);
    if (changesJson.length > MAX_CHANGES_JSON) return res.status(400).json({ error: 'Alterações excedem o tamanho máximo.' });
  }

  const actorPersonId = b.actorPersonId != null ? String(b.actorPersonId).slice(0, 60) : null;
  const actorPersonName = String(b.actorPersonName || req.user.name || '—').trim().slice(0, 120) || '—';
  const entityId = b.entityId != null ? String(b.entityId).slice(0, 60) : null;
  const cardId = b.cardId != null ? String(b.cardId).slice(0, 60) : null;
  const accountId = b.accountId != null ? String(b.accountId).slice(0, 60) : null;
  const categoryId = b.categoryId != null ? String(b.categoryId).slice(0, 60) : null;

  db.prepare(`
    INSERT INTO audit_log
      (user_id, actor_person_id, actor_person_name, action, module, entity_type, entity_id,
       description, changes_json, card_id, account_id, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, actorPersonId, actorPersonName, action, module_, entityType, entityId,
    description, changesJson, cardId, accountId, categoryId
  );

  res.status(201).json({ ok: true });
});

// GET /api/audit — lista só os registros DA PRÓPRIA CONTA (isolamento igual
// ao resto do app), com filtros opcionais e paginação simples.
router.get('/', (req, res) => {
  const { personId, action, module: moduleFilter, from, to } = req.query;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const clauses = ['user_id = ?'];
  const params = [req.user.id];

  if (personId) { clauses.push('actor_person_id = ?'); params.push(String(personId)); }
  if (action && ACTIONS.has(action)) { clauses.push('action = ?'); params.push(action); }
  if (moduleFilter && MODULES.has(moduleFilter)) { clauses.push('module = ?'); params.push(moduleFilter); }
  if (from) { clauses.push('created_at >= ?'); params.push(String(from)); }
  if (to) { clauses.push('created_at <= ?'); params.push(String(to)); }

  const rows = db.prepare(`
    SELECT id, actor_person_id AS actorPersonId, actor_person_name AS actorPersonName,
           action, module, entity_type AS entityType, entity_id AS entityId,
           description, changes_json AS changesJson, card_id AS cardId,
           account_id AS accountId, category_id AS categoryId, created_at AS createdAt
    FROM audit_log
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE ${clauses.join(' AND ')}`).get(...params).n;

  res.json({
    events: rows.map(r => ({ ...r, changes: r.changesJson ? JSON.parse(r.changesJson) : null, changesJson: undefined })),
    total,
    limit,
    offset
  });
});

module.exports = router;
