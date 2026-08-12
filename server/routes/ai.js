const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireXhrHeader } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Limita o uso da IA por usuário para evitar custo/abuso descontrolado.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  message: { error: 'Muitas perguntas em pouco tempo. Aguarde alguns minutos.' }
});

function fmt(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildSummary(data, monthKey) {
  const monthTx = (data.transactions || []).filter(t => t.date && t.date.startsWith(monthKey));
  const entradas = monthTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const saidas = monthTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);
  const porCategoria = {};
  monthTx.filter(t => t.type === 'saida').forEach(t => { porCategoria[t.category] = (porCategoria[t.category] || 0) + Number(t.amount); });

  const parcelasAtivas = (data.installments || []).filter(i => i.paid < i.count)
    .map(i => `${i.description}: ${i.paid}/${i.count} pagas, restam ${fmt(i.monthlyAmount * (i.count - i.paid))}`);

  const caixinhas = (data.caixinhas || []).map(c => `${c.name}: ${fmt(c.current)} de ${fmt(c.goal)} (${Math.round((c.current / Math.max(c.goal, 1)) * 100)}%)`);

  const cartoes = (data.cards || []).map(c => {
    const bill = (data.cardBills || {})[`${c.id}-${monthKey}`];
    return `${c.name}: fatura ${bill ? fmt(bill.amount) : 'não informada'}${bill && bill.paid ? ' (paga)' : ''}`;
  });

  const orcamentos = (data.budgets || []).map(b => {
    const spent = monthTx.filter(t => t.type === 'saida' && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
    return `${b.category}: gastou ${fmt(spent)} de um orçamento de ${fmt(b.amount)}${spent > b.amount ? ' (ESTOUROU)' : ''}`;
  });

  const modo = data.settings?.mode === 'single' ? 'pessoa solteira' : 'casal';

  return `Resumo financeiro (${modo}, mês ${monthKey}):
- Entradas totais: ${fmt(entradas)}
- Saídas totais: ${fmt(saidas)}
- Saldo: ${fmt(entradas - saidas)}
- Gastos por categoria: ${Object.entries(porCategoria).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ') || 'nenhum'}
- Orçamentos: ${orcamentos.join('; ') || 'nenhum orçamento definido'}
- Parcelas ativas: ${parcelasAtivas.join('; ') || 'nenhuma'}
- Caixinhas: ${caixinhas.join('; ') || 'nenhuma'}
- Faturas de cartão: ${cartoes.join('; ') || 'nenhum cartão cadastrado'}`;
}

router.post('/ask', aiLimiter, requireXhrHeader, async (req, res) => {
  const question = String(req.body.question || '').trim().slice(0, 800);
  const monthKey = String(req.body.monthKey || '').slice(0, 7);
  if (!question) return res.status(400).json({ error: 'Faça uma pergunta.' });
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return res.status(400).json({ error: 'Mês inválido.' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'A Conselheira IA não está configurada neste servidor (falta ANTHROPIC_API_KEY no .env).' });
  }

  const row = db.prepare('SELECT data_json FROM user_data WHERE user_id = ?').get(req.user.id);
  const data = row ? JSON.parse(row.data_json) : {};
  const summary = buildSummary(data, monthKey);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Você é uma consultora financeira pessoal e acolhedora, especialista em finanças pessoais e de casais no Brasil. Responda em português do Brasil, de forma direta, prática e curta (no máximo 5-6 frases ou uma lista curta). Use os dados abaixo para embasar sua resposta.\n\n${summary}\n\nPergunta: ${question}`
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erro da API Anthropic:', response.status, errText);
      return res.status(502).json({ error: 'Não foi possível falar com a IA agora. Tente novamente em instantes.' });
    }

    const json = await response.json();
    const text = (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || 'Não consegui gerar uma resposta agora.';
    res.json({ text });
  } catch (e) {
    console.error('Erro ao chamar IA:', e);
    res.status(502).json({ error: 'Não foi possível falar com a IA agora. Tente novamente em instantes.' });
  }
});

module.exports = router;
