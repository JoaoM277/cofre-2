# Cofre — Finanças Pessoais (versão cliente/servidor)

Reescrita do app com uma separação real entre **frontend** (`public/`) e
**backend** (`server/`). Diferente da versão anterior (que rodava só no
navegador, dentro de um artefato do Claude.ai, usando uma API de storage do
próprio ambiente), esta versão é um servidor Node.js + Express de verdade,
com banco de dados próprio (SQLite) e autenticação no servidor.

## Por que isso é mais seguro

| Antes (só cliente)                                                  | Agora (cliente + servidor)                                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Senha "hasheada" no navegador (SHA-256 simples)                     | Senha com hash **bcrypt** (custo 12) no servidor, nunca sai do backend                                   |
| "Isolamento" entre clientes dependia só do nome da chave de storage | Isolamento garantido pelo servidor: toda consulta é filtrada por `user_id` extraído de um token validado |
| Sessão sem expiração/local nenhum de verdade                        | Sessão via **cookie httpOnly** (inacessível a JavaScript/XSS), expira em 7 dias                          |
| Sem proteção a força bruta                                          | Login com **rate limiting** por IP + bloqueio temporário após 5 tentativas erradas                       |
| Chave da IA não existia no client (usava o proxy do Claude.ai)      | Chave da API fica **só no `.env` do servidor**, nunca trafega até o navegador                            |
| Sem proteção contra CSRF                                            | Cookie `SameSite=Lax` + header customizado exigido em toda escrita                                       |
| Storage dependia da API de artefato do Claude.ai (podia falhar)     | Banco de dados SQLite próprio, independente de qualquer plataforma externa                               |

## Estrutura

```
cofre-app/
  server/
    index.js          # servidor Express, middlewares de segurança
    db.js              # conexão SQLite + criação das tabelas
    middleware/auth.js  # JWT em cookie httpOnly, checagem de admin, CSRF
    routes/auth.js      # registro, login, logout, sessão atual
    routes/finance.js   # dados financeiros do usuário logado
    routes/admin.js     # painel admin (listar/criar/remover clientes)
    routes/ai.js         # proxy seguro para a Conselheira IA
  public/
    index.html
    app.js              # todo o frontend (sem framework, JS puro)
    styles.css
  package.json
  .env.example
```

## Como rodar localmente

1. Instale o [Node.js](https://nodejs.org) 18 ou mais recente.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Copie o arquivo de ambiente de exemplo e preencha os valores:
   ```bash
   cp .env.example .env
   ```

   - `JWT_SECRET`: gere um valor aleatório forte, por exemplo:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - `ANTHROPIC_API_KEY`: sua chave de API da Anthropic (necessária só para a
     aba "Conselheira IA"; o resto do app funciona sem ela).
4. Rode o servidor:
   ```bash
   npm start
   ```
5. Abra `http://localhost:3000` no navegador.

A primeira conta criada vira automaticamente administradora e pode acessar
o "Painel Admin" para cadastrar outros clientes com e-mail e senha.

## Publicando para acesso de qualquer lugar

Para os clientes acessarem "de onde estiverem" (como você pediu), o servidor
precisa estar hospedado em algum lugar acessível pela internet — por
exemplo Railway, Render, Fly.io, um VPS, etc. Pontos importantes ao publicar:

- Defina `NODE_ENV=production` — isso ativa o cookie `secure`, exigindo HTTPS.
- Sirva o app sempre atrás de HTTPS (a maioria dessas plataformas já cuida
  disso automaticamente).
- Gere um `JWT_SECRET` novo e forte específico para produção — nunca reuse
  o de desenvolvimento.
- Mantenha o `.env` fora do controle de versão (já está no `.gitignore`).
- Faça backup periódico do arquivo `data/cofre.db`.

## Limitações conhecidas / próximos passos para produção séria

Esta versão já é adequada para uso real com um número pequeno/médio de
clientes de confiança, mas para virar um produto comercial robusto vale
evoluir:

- **Verificação de e-mail** no cadastro (hoje qualquer e-mail é aceito sem confirmação).
- **Recuperação de senha** (fluxo de "esqueci minha senha" por e-mail).
- **Rotação/expiração de sessão mais refinada** (hoje é só expiração fixa de 7 dias).
- **Logs de auditoria** (quem acessou o quê e quando), especialmente para ações do admin.
- **Backups automáticos** do banco de dados e monitoramento/alertas de erro.
- Trocar SQLite por Postgres/MySQL se o número de contas crescer muito
  (SQLite aguenta bem um uso pequeno/médio, mas tem limites de concorrência).
- Testes automatizados (hoje a validação foi manual via `curl`).

## Testes manuais já realizados

Antes da entrega, validei localmente com `curl`:

- Registro cria o primeiro usuário como admin; usuários seguintes como `client`.
- Login com senha errada retorna 401 com mensagem genérica (não revela se o e-mail existe).
- Requisições de escrita sem o header anti-CSRF são bloqueadas (403).
- Um cliente não vê os dados de outro cliente (isolamento por `user_id` confirmado).
- Um cliente comum não consegue acessar rotas `/api/admin/*` (403).
- `/api/health` responde publicamente sem exigir login.
