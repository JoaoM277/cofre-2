const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'cofre_token';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  // Falha alto e cedo: um segredo fraco/ausente compromete toda a autenticação.
  throw new Error('JWT_SECRET ausente ou fraco. Defina um valor forte em .env antes de iniciar o servidor.');
}

function issueToken(res, user) {
  const token = jwt.sign(
    // householdId identifica QUAL cofre de dados esse login enxerga — pro
    // titular é o próprio id, pro cônjuge é o id do titular (ver
    // server/db.js e server/routes/auth.js). `sub`/`email`/`name` continuam
    // sendo a identidade individual de QUEM está logado, usada na auditoria.
    { sub: user.id, email: user.email, role: user.role, name: user.name, householdId: user.householdId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // inacessível via JavaScript no navegador (mitiga roubo por XSS)
    secure: process.env.NODE_ENV === 'production', // exige HTTPS em produção
    sameSite: 'lax', // mitigação de CSRF para a maioria dos casos
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearToken(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Fallback pra tokens emitidos antes do householdId existir — trata
    // como titular do próprio cofre (era o único comportamento possível
    // antes desta mudança), sem forçar ninguém a relogar.
    req.user = {
      id: payload.sub, email: payload.email, role: payload.role, name: payload.name,
      householdId: payload.householdId || payload.sub
    };
    next();
  } catch (e) {
    clearToken(res);
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// Proteção leve contra CSRF: exige um header custom que requisições
// simples de formulário/HTML cross-site não conseguem definir.
function requireXhrHeader(req, res, next) {
  if (req.get('X-Requested-With') !== 'CofreApp') {
    return res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
  }
  next();
}

module.exports = { COOKIE_NAME, issueToken, clearToken, requireAuth, requireAdmin, requireXhrHeader };
