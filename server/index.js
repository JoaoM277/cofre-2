require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const financeRoutes = require('./routes/finance');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Segurança de cabeçalhos HTTP ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
       ...helmet.contentSecurityPolicy.getDefaultDirectives(),
       "script-src": ["'self'"],
       // A interface usa atributos onclick nos elementos renderizados pelo app.
       // Libera apenas esses atributos, mantendo blocos <script> inline bloqueados.
       "script-src-attr": ["'unsafe-inline'"],
       // As fontes (Newsreader/Inter/IBM Plex Mono) vêm do Google Fonts: a
       // folha de estilo é servida por fonts.googleapis.com e os arquivos
       // de fonte em si por fonts.gstatic.com — os dois precisam estar
       // liberados, senão o navegador bloqueia o @import silenciosamente
       // e a interface cai para a fonte padrão do sistema.
       "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "connect-src": ["'self'"]
    }
  }
}));

// ---- CORS ----
// Se o frontend for servido pelo mesmo domínio (recomendado, é o padrão aqui),
// isso praticamente não entra em ação. Se separar front/back, defina ALLOWED_ORIGIN.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: allowedOrigin || true,
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ---- Rotas da API ----
app.use('/api/auth', authRoutes);
app.use('/api', financeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Frontend estático ----
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ---- Tratamento de erro genérico (evita vazar stack trace ao cliente) ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Cofre rodando em http://localhost:${PORT}`);
});
