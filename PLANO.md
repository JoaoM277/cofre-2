# Plano — Evolução do módulo financeiro (Cartões, Faturas, Parcelamentos, Auditoria)

## 1. Arquitetura atual (recap)

- Backend: Express + SQLite (`better-sqlite3`). Duas tabelas: `users` e `user_data`
  (`user_data.data_json` = **um único blob JSON por conta**, sobrescrito inteiro a
  cada `PUT /api/data`).
- Não há tabelas relacionais para transações/cartões/categorias — tudo vive dentro
  desse blob e é manipulado no cliente (`public/app.js`, vanilla JS, sem framework).
- Autenticação: **um login por conta**. "Casal" não são dois logins — são dois
  rótulos (`DATA.settings.people = [{id,name,color}, ...]`) usados como `personId`
  em lançamentos, dentro da MESMA sessão autenticada.

Esse último ponto é importante para a auditoria (seção 5).

## 2. Novas entidades no blob (`DATA`)

Continuo no modelo schema-less (não crio tabelas relacionais novas para dados
financeiros — seria uma reescrita completa do backend, fora do escopo pedido, e
o backend atual não tem nenhuma dessas tabelas hoje). Ganho consistência via
funções de migração (`migrateFinance`, no mesmo espírito de `migrateCategories`
que já existe).

```
accounts: [{ id, name, kind, personId, color, status, created_at, updated_at }]
cards:    [{ id, name, personId, limit, closingDay, dueDay, status, color, created_at, updated_at }]  // + campos novos
purchases:[{ id, cardId, description, categoryId, personId, totalAmount, installmentsCount,
             date, status:'ativa'|'cancelada', canceledAt, created_at, updated_at }]
invoices: { "cardId-mKey": { paid, paidAt, paidAccountId, paidTransactionId } }  // substitui cardBills; nunca guarda valor manual
transactions: [...existentes..., paymentMethod, cardId, purchaseId, installmentNumber,
               installmentCount, kind:'compra'|'pagamento_fatura', accountId, deletedAt]
```

**Por que não duplicar dado**: o valor da fatura NUNCA é armazenado — é sempre
`soma das transactions daquele cardId + mês-fatura`. `invoices` guarda só o
*estado* (paga/quem pagou/de qual conta), nunca o valor.

**Parcelamento como entidade relacionada** (`purchases`): uma compra parcelada
gera 1 registro em `purchases` (a "compra original") + N registros em
`transactions` (uma por parcela, cada uma com sua própria data-fatura,
`installmentNumber/installmentCount` para exibir "3/12"). Isso cumpre o pedido
sem criar um livro-razão paralelo: `transactions` continua sendo a fonte única
que alimenta Entradas&Saídas, Orçamentos e Gráficos.

**Parcelas "fora do cartão"** (aba **Parcelas** já existente) continuam como
estão — são compromissos de parcelamento sem cartão associado (ex.: financiado
direto com a loja). O pedido de parcelamento do item 2 é especificamente do
fluxo "forma de pagamento = cartão de crédito", então criei um caminho
separado (`purchases`) em vez de sobrecarregar `installments` com um
significado diferente do que ele já tem. Deixo isso explícito na tela.

## 3. Regra de fechamento → mês da fatura

```
se dia(data_da_compra) > card.closingDay:
    mês_fatura(parcela 1) = mês(data_da_compra) + 1
senão:
    mês_fatura(parcela 1) = mês(data_da_compra)
mês_fatura(parcela N) = mês_fatura(parcela 1) + (N-1)
```

Confere com o exemplo do enunciado: Nubank fecha dia 11, vence dia 18; compra em
22/08 (dia 22 > 11) → primeira parcela vai para a fatura de setembro (fecha
11/09, vence 18/09) — bate com o cenário descrito no item 25.

## 4. Limite do cartão (accrual, não "fatura atual apenas")

> "Uma compra de R$1.000 em 10x deve comprometer o limite conforme o valor
> total da compra" (item 6)

```
usado(cartão) = Σ, para cada purchase ativa desse cartão,
                (totalAmount − soma das parcelas já PAGAS via fatura paga)
disponível = limite − usado
```

Ou seja: o valor cheio é comprometido no instante da compra; cada fatura paga
libera exatamente a fatia daquela parcela. Isso é o comportamento real de
cartão de crédito e é o que o item 6 pede.

## 5. Saldo bancário (cash) × Orçamentos/Gráficos (accrual) — o ponto mais importante

> "O saldo da conta bancária não deve ser reduzido como se a fatura já tivesse
> sido paga" (item 5) mas "o orçamento da categoria é atualizado" e "os
> gráficos são atualizados" no mesmo instante (item 5).

Isso exige que a MESMA transação alimente dois números diferentes de formas
diferentes. Resolvido com duas regras de filtro simples, sem duplicar dado:

- **Saldo do mês (dashboard)** = entradas − saídas, **excluindo** saídas com
  `paymentMethod==='credito'` (a compra no cartão não sai do banco agora).
  A saída real do banco só acontece na transação `kind:'pagamento_fatura'`
  criada ao pagar a fatura (essa sim conta no saldo, no mês em que o
  pagamento acontece).
- **Categorias / Mapa de gastos / Orçamentos / Orçado×Realizado** = todas as
  saídas com `categoryId` preenchido, **independente da forma de pagamento**.
  A transação de pagamento de fatura é criada com `categoryId:null`
  (é uma transferência entre "o que devo" e "meu banco", não um gasto novo de
  categoria) — então ela nunca aparece duplicada nos gráficos.

Isso evita a contabilização em dobro citada no item 5 sem precisar de um
"modo de visualização" separado — é uma única fonte (`transactions`), dois
filtros.

## 6. Auditoria — decisão de arquitetura mais sensível

Duas exigências do pedido colidem com a arquitetura atual:

1. "A auditoria não deve ser apagável/alterável por usuários comuns" (item 19).
2. Hoje **tudo** (inclusive o histórico) vive num blob que o cliente reescreve
   por inteiro a cada `PUT /api/data`. Se a auditoria morasse dentro desse
   blob, qualquer bug no cliente (ou um `PUT` malicioso) apagaria o
   histórico inteiro — o oposto do pedido.

**Decisão**: a auditoria vira uma **tabela SQL própria no servidor**
(`audit_log`), com endpoints dedicados:

- `POST /api/audit` — só insere (append-only).
- `GET /api/audit` — só lista, com filtros.
- **Não existe** endpoint de update/delete para ela. Nem o painel admin tem
  um. Isso é o que efetivamente torna a auditoria "não apagável pelo
  usuário comum": não é uma questão de permissão de UI, é que a capacidade
  de apagar/alterar **não existe na API**.
- `user_id` (dono dos dados) e `created_at` (quando) são **sempre** tirados
  da sessão JWT e do relógio do servidor — o cliente não escolhe esses dois
  campos. Isso é o que dá confiança real ao "quando" e ao "de qual conta".

**Limitação honesta sobre o "quem"**: como o app usa **um único login por
casal** (não são duas contas autenticadas), o servidor não tem como provar
criptograficamente se foi "Pedro" ou "Ana" na mesma sessão — ele só vê o
`personId` que a interface enviou (o mesmo rótulo já usado em toda a
aplicação, ex. em lançamentos). Implementei um seletor "Você é: Pedro / Ana"
na barra lateral (lembrado por navegador via `localStorage`, não por conta)
que define quem aparece como autor nas próximas ações. **Isso não é uma
prova de identidade** — é a mesma malha de confiança que o app já usa para
"quem fez o lançamento". Deixar isso funcionando de forma criptograficamente
verificável exigiria login individual por pessoa (duas contas), que é uma
mudança de arquitetura de autenticação bem maior e fora do escopo deste
pedido — foi uma escolha consciente para não "criar um sistema paralelo de
autenticação" (item 19 pede exatamente o contrário disso).

## 7. Exclusão lógica (soft delete)

Aplicado a `transactions` e `purchases` (os registros "financeiros" citados
no item 16) via `deletedAt`. Toda agregação (dashboard, orçamentos, gráficos,
fatura) filtra `!deletedAt`. O registro de auditoria da exclusão guarda uma
cópia dos dados (descrição/valor/categoria/cartão) no momento da exclusão,
então o histórico é rastreável mesmo com o item escondido da lista viva.
Cartões/contas/categorias mantêm o padrão que já existia para categorias
(bloqueia exclusão física se houver uso; permite excluir se não houver).

## 8. O que fica fora do escopo (declarado explicitamente)

- **Saldo por conta individual** (ex. "Conta corrente: R$ 3.200, Sicoob: R$
  800"): o pedido menciona contas só como origem do pagamento da fatura
  (item 9). Não existe hoje nenhum saldo inicial/reconciliação de conta no
  app — construir isso é um módulo de "extrato bancário" à parte. Implemento
  o cadastro de contas e o uso delas no pagamento de fatura, mas o "saldo do
  mês" do dashboard continua sendo o saldo agregado único que já existia,
  não um saldo por conta.
- **Autenticação individual por pessoa** (ver seção 6).

## 9. Ordem de implementação

Backend (tabela de auditoria + validação) → migração de dados no cliente →
formulário de lançamento dinâmico → painel de cartões/fatura/pagamento →
contas → separação accrual/cash nos agregados → aba Auditoria → estilos →
testes ponta a ponta do cenário do item 23 + casos de borda do item 22.

## 10. Status final — o que foi implementado

Tudo acima foi implementado ponta a ponta (banco → API → regras de negócio →
frontend → auditoria) e validado com um teste E2E automatizado
(`tests/e2e-modulo-financeiro.spec.js`, ver `npm run test:e2e`) que reproduz o
cenário completo do item 23 (compra parcelada, mudança de fechamento, edição
de categoria por outra pessoa, pagamento de fatura, auditoria) mais os casos
de borda de compra à vista e cancelamento de compra no cartão.

**Duas decisões que vale registrar** (não estavam 100% explícitas no pedido
original, então documento a escolha feita):

- **Em qual mês uma parcela de cartão "conta" pro orçamento/categoria/gráfico**:
  optei por contar cada parcela no mês da **fatura** em que ela cai (não no
  mês da compra). Uma compra de R$300 em 3x lançada em agosto aparece como
  R$100 no orçamento de Alimentação de setembro, R$100 em outubro e R$100 em
  novembro — não R$300 de uma vez em agosto. Isso evita que uma compra
  parcelada infle o orçamento do mês da compra e é como a maioria dos apps de
  finanças brasileiros trata isso (o orçamento reflete o que vai pesar na
  fatura de cada mês). O **limite comprometido**, por outro lado, continua
  sendo debitado no valor cheio no ato da compra (item 6) — são dois
  conceitos diferentes e cada um segue a regra que o pedido descreveu para ele.
- **Fatura paga adiantado + compra nova no mesmo ciclo**: se você marcar uma
  fatura como paga antes do fechamento real do ciclo e lançar mais uma compra
  que ainda cai no mesmo mês de fatura, essa compra nova **não** é tratada
  como já paga — ela some do "usado" só quando essa fatura específica (agora
  reaberta, na prática) for paga de novo. Guardo quais transações cada
  pagamento efetivamente cobriu (`invoices[chave].paidTxIds`) exatamente pra
  evitar subestimar o limite comprometido nesse cenário.

**Bugs encontrados e corrigidos durante a revisão final** (item 25 pediu essa
varredura explicitamente):

1. Trocar a forma de pagamento no formulário de lançamento (ex. Dinheiro →
   Cartão de crédito) resetava a categoria já escolhida pro primeiro item da
   lista, silenciosamente. Corrigido preservando a seleção ao reconstruir as
   opções.
2. Criar uma categoria nova a partir de "+ nova" dentro de qualquer modal
   (lançamento, orçamento, compra) fechava o modal pai sem devolver o
   controle a ele, perdendo o que já tinha sido preenchido. Corrigido com uma
   pilha simples de modais (o pai fica oculto, não é destruído, enquanto o
   filho está aberto).
3. O bug de "fatura paga adiantado" descrito acima — uma compra nova caindo
   no mês de uma fatura já paga era contada como já paga e escapava do
   limite comprometido.

Ficou de fora do escopo, por decisão consciente (não por esquecimento): saldo
por conta bancária individual e autenticação separada por pessoa — ambos
documentados na seção 8.

## 11. Revisão pós-entrega — compra no cartão aparecendo no mês certo

Depois da entrega inicial, uma conversa com o usuário identificou um ponto
real de confusão na primeira versão: como cada parcela era datada pelo
vencimento da própria fatura, uma compra feita em agosto só aparecia em
Entradas & Saídas em setembro/outubro/novembro (uma linha de R$100 em cada
mês) — nunca em agosto, que foi quando a compra de fato aconteceu. Isso
contraria a razão de ser do extrato: o usuário quer entender, no mês em que
gastou, que gastou.

**Decisão**: separar duas perguntas que antes usavam a mesma regra —

- **"Em que mês eu vejo essa compra no extrato?"** → agora é o mês da
  **compra**, com o valor **cheio** (R$300, uma linha só, não R$100 x3). A
  linha é marcada visualmente como "no cartão · ainda não debitado" e fica
  fora do total de saída real do mês — é uma visão de *consciência de gasto*,
  não de caixa. O detalhe parcela a parcela (o que cai em cada fatura) some
  do extrato e passa a existir só dentro da aba Cartões → Fatura, que já
  tinha esse detalhe.
- **"Em que mês essa compra pesa no orçamento por categoria?"** → **continua
  dividida pela fatura** (R$100 em cada uma das 3 faturas), exatamente como
  descrito na seção 5. O usuário confirmou explicitamente que quer manter
  essa regra assim — pensar no orçamento como "quanto vai pesar no meu bolso
  cada mês" é diferente de "quanto eu decidi gastar agora", e as duas visões
  podem (e devem) discordar em timing sem que isso seja um bug.

Nada mudou no cálculo do limite comprometido, na regra de fechamento/mês da
fatura, no pagamento de fatura ou na auditoria — só a forma como o extrato
agrupa e data as parcelas de uma mesma compra. `transactions` continua tendo
uma linha por parcela internamente (é o que a fatura e o limite usam); o que
mudou foi só a leitura para exibição em Entradas & Saídas, que agora agrupa
por `purchaseId` e usa a data/valor do registro em `purchases` em vez de
cada parcela individual.

## 12. Bug real encontrado nessa mesma revisão — fatura fantasma após pagar adiantado

Testando o cenário de pagar a fatura antes do vencimento (ex.: fatura de
setembro fecha 27/08, vence 5/09, paga em 30/08), dois sintomas apareciam
juntos:

1. O pagamento (saída real) não era encontrado pelo usuário em Entradas &
   Saídas.
2. Depois de pagar a única fatura pendente de um cartão, o painel voltava a
   mostrar uma "fatura atual" — só que de um mês sem nenhum lançamento,
   marcada **"Em atraso"**, com R$ 0,00. A fatura recém-paga reaparecia como
   "próxima fatura", sem indicar que já estava paga.

**Causa raiz** (achada reproduzindo o cenário, não só por inspeção): a
função `currentAndNextInvoice(card)` — que decide o que o painel do cartão
mostra em "Fatura atual"/"Próxima fatura" — quando não sobrava nenhuma
fatura pendente, caía direto no mês corrente do **calendário real**
(`monthKey(new Date())`), mesmo que esse mês não tivesse absolutamente
nenhuma compra. Como esse mês "fantasma" já tinha passado do dia de
vencimento do cartão, `invoiceStatus` calculava "Em atraso" pra uma fatura
que nunca existiu de fato. Em seguida, o cálculo de "próxima fatura" (que
buscava a posição da chave atual dentro da lista de meses com lançamento)
podia recomeçar do zero e devolver justamente o mês que tinha acabado de
ser pago, sem qualquer indicação de que já estava quitado.

O sintoma 1 (pagamento "sumido") não era um bug de verdade — a transação de
pagamento sempre foi datada com o dia real do pagamento (`dateStr(new
Date())`), então ela sempre apareceu no mês correto em Entradas & Saídas.
O problema era de navegação: a aba Cartões tinha um seletor de mês no topo
que **não fazia nada** (o painel de cada cartão já resolve sozinho qual é
a fatura atual/próxima, independente do mês selecionado ali) — dava a
entender que era possível "procurar" uma fatura de outro mês navegando por
ele, o que levava a olhar Entradas & Saídas no mês errado depois.

**Correções aplicadas**:

- `currentAndNextInvoice`: "fatura atual" agora é sempre a mais antiga
  entre as faturas realmente pendentes (`paid:false`) e o ciclo corrente do
  calendário (`calendarInvoiceKey`, mesma regra de fechamento usada pra
  bucketar uma compra nova) — nunca mais um mês aleatório sem lançamento.
  "Próxima fatura" passou a ser sempre o mês seguinte ao atual, sem
  depender de índice numa lista que podia não conter a chave escolhida.
  Uma fatura paga não some da tela (o ciclo ainda pode receber compra nova
  antes de fechar de verdade), mas agora aparece com o rótulo **"Paga"** e
  o valor real, nunca "Em atraso"/R$0,00 fantasma.
- Removido o seletor de mês (não funcional) do topo da aba Cartões.
- `confirmPayInvoice` agora também leva o mês selecionado globalmente
  (`CURRENT_MONTH`) pro dia real do pagamento, então trocar de aba depois de
  pagar (Entradas & Saídas, Visão Geral) já mostra o resultado sem precisar
  navegar manualmente pra descobrir em qual mês ele caiu.

Coberto por dois novos checks no E2E (`tests/e2e-modulo-financeiro.spec.js`):
nenhuma fatura "Em atraso" fantasma aparece depois de quitar tudo, e o
pagamento aparece como saída real em Entradas & Saídas sem precisar navegar.

## 13. Adiantamento de fatura — o gasto muda de mês, a nomenclatura não

Depois da correção acima, o usuário trouxe um ponto mais específico: a
convenção de nome da fatura (pelo mês de **vencimento** — "fatura de
setembro" é a que vence em setembro, mesmo fechando em agosto, igual
Nubank/Itaú) fica como está. O que precisava mudar é outra coisa: se essa
fatura de setembro for **paga adiantada** (antes do dia 5, o vencimento
real — por exemplo dia 30 de agosto, depois que ela já fechou dia 27), o
gasto correspondente deve valer como **gasto de agosto** no Mapa de gastos
e nos Orçamentos, não como gasto de setembro — mesmo a fatura continuando
se chamando "fatura de setembro".

**Diferença importante em relação à seção 11**: lá, a regra é sobre a
compra em si (o extrato mostra ela no mês em que foi feita, sempre, pago
adiantado ou não). Aqui é sobre a categorização por mês da fatura paga —
que, por decisão do usuário (seção 11), fica atrelada ao mês da fatura
*exceto* neste caso específico: adiantamento muda essa regra só pra
aquele pagamento.

**O que foi implementado**:

- Nova função `isEarlyInvoicePayment(card, mKey)`: hoje é "antes" desse
  mês-fatura se a data atual for anterior ao dia de vencimento
  (`invoiceDueDate`) — fechar antes não conta como adiantamento, só pagar
  antes do vencimento conta.
- O botão que antes sempre dizia "Marcar como paga" agora diz **"Adiantar
  fatura"** sempre que `isEarlyInvoicePayment` for verdadeiro (no detalhe
  da fatura e no modal de confirmação, que também explica o que vai
  acontecer com a data do gasto).
- Em `confirmPayInvoice`, quando é adiantamento: as parcelas cobertas por
  aquele pagamento (`cardTransactionsForMonth(cardId, mKey)`) têm o campo
  `date` movido pro dia real do pagamento — é esse campo que
  `renderDashboard`/`renderOrcamentos` usam pra decidir em qual mês o
  gasto "conta". O campo `invoiceMonthKey` de cada parcela **não muda**
  (continua sendo a identidade da fatura pra limite/auditoria/fatura
  fechada) — só a data de exibição/categorização é que se move.
  Pagamento no prazo normal não altera nada disso.
- A descrição da transação de pagamento também deixou de citar só o nome
  do mês da fatura sem contexto (`"Pagamento fatura Nubank · setembro de
  2026"` aparecendo dentro da lista de agosto era confuso) — agora, quando
  é adiantamento, ela diz `"Adiantamento da fatura Nubank (venceria em
  setembro de 2026)"`.
- `undoInvoicePayment` (desmarcar como paga) devolve a data original de
  cada parcela coberta — recalculada via `invoiceDueDate(card, mKey)`, sem
  guardar a data antiga em nenhum campo à parte, pra não duplicar fonte de
  verdade.

Validado reproduzindo o cenário exato do usuário (fecha dia 11/27, vence
dia 18/5, paga antes do vencimento) e com 2 novos checks no E2E: o botão
mostra "Adiantar fatura" e o mapa de gastos do mês do adiantamento reflete
a categoria da compra. Suíte completa: 25/25.

## 14. Confirmações estilizadas (sem `confirm()`/`alert()` do navegador)

Todo `confirm()`/`alert()` nativo do módulo financeiro (excluir lançamento,
cancelar compra/parcelamento no cartão, excluir/desativar cartão, excluir/
desativar conta, desmarcar fatura como paga) foi trocado por um modal do
próprio app — mesma casca visual dos outros modais, com botão "Cancelar" e
um botão de ação (vermelho/outline quando é destrutivo, via a classe `.btn
danger` que já existia).

Implementado com dois helpers genéricos (`confirmDialog(mensagem,
onConfirm, opts)` e `alertDialog(mensagem, opts)`), reaproveitando a pilha
de modais que já existia (seção do bug #2 do item 25 original): se a
confirmação for aberta por cima de um formulário já aberto (ex.: "Excluir"
dentro de "Editar cartão"), o formulário fica escondido atrás em vez de
ser destruído — cancelar devolve pra ele, confirmar fecha os dois níveis
(cada função continua chamando `closeModal()` no fim, como já fazia; a
pilha resolve sozinha). Quando não há modal por trás (ex.: excluir um
lançamento direto da lista), abre um modal avulso.

Ficou de fora, deliberadamente: os dois `confirm()`/`alert()` do Painel
Admin (remover conta de cliente) — é uma tela separada, de uso raro e só
por admin, fora do escopo do módulo financeiro.

## 15. Aviso de novidade (toast, não fixo) — substituído pelo banner da seção 16

Um aviso simples aparecia uma vez, no canto inferior direito, contando
sobre o módulo de Cartões/Faturas/Auditoria — sumia sozinho depois de 9s
ou ao clicar no X, e nunca mais aparecia depois disso (controlado por uma
chave em `localStorage`). Esse toast foi removido e trocado pelo banner de
feedback (seção 16), que pediu o mesmo tipo de aviso "uma vez só, dispensável"
mas agora fixo no fluxo da página em vez de flutuante — ver seção 16 para
o mecanismo atual.

## 16. Sistema de feedback

Pedido: uma área pra qualquer usuário mandar uma avaliação (nota + nome
opcional + mensagem) pro time, um painel exclusivo de admin pra ler tudo
o que chegou, e um banner na aba Cartões convidando pra essa área — no
lugar do toast da seção 15.

**Banco (`server/db.js`).** Tabela `feedback` própria, fora do blob de
`user_data`, no mesmo espírito da `audit_log` (seção 6): quem precisa
enxergar os feedbacks é o admin, olhando TODAS as contas de uma vez — não
faz sentido um dado assim viver isolado dentro dos dados financeiros de
uma única conta. `user_id` e `created_at` são sempre preenchidos pelo
servidor (sessão JWT + relógio do servidor), nunca pelo cliente — mesma
garantia de confiabilidade da auditoria. O campo `name` é livre e opcional:
é o nome que a pessoa escolhe *mostrar naquele feedback*, podendo divergir
do nome da conta ou ficar em branco; o vínculo real com a conta continua
garantido por `user_id`. Sem rotas de update/delete — igual à auditoria,
é histórico append-only por ausência de capacidade na API, não por checagem
de permissão.

**Rotas (`server/routes/feedback.js`).** `POST /api/feedback` — qualquer
conta autenticada, valida nota (inteiro 1–5), mensagem (obrigatória, até
500 caracteres) e nome (opcional, até 120). `GET /api/feedback/admin` — só
admin (`requireAdmin`), lista todos os feedbacks com o nome/email da conta
que enviou, paginado (limit/offset).

**Tela de feedback (cliente).** Nova aba "Feedback", visível pra qualquer
conta. Nota por estrelas (1–5, clique direto marca sem precisar re-renderizar
a tela inteira — evita perder o que já foi digitado nos outros campos),
nome opcional, mensagem com `maxlength=500` e contador de caracteres ao
vivo. Ao enviar com sucesso, mostra uma tela de confirmação com botão pra
"Enviar outro feedback".

**Painel de feedbacks (admin).** Nova aba "Feedbacks", só aparece pra quem
tem `role==='admin'` (mesmo `if` que já controlava a aba "Painel Admin").
Lista inicialmente só data/hora e nome de quem enviou, mais a nota em
estrelas — a mensagem completa só aparece ao clicar no item (accordion:
clique de novo fecha).

**Banner (aba Cartões).** Substituiu o toast da seção 15: agora é um card
fixo no topo da aba Cartões (não flutuante), com o texto pedido e um botão
"Deixar feedback" que já leva pra aba Feedback. Some ao clicar no botão ou
no X, guardado em `localStorage` (`cofre_feedback_banner_dismissed_v1`)
pra não voltar depois de visto — mesmo padrão do antigo toast e do
seletor de pessoa.

**Testado (`tests/e2e-modulo-financeiro.spec.js`):** banner aparece na aba
Cartões; botão do banner leva pro formulário; contador de caracteres e
seleção de estrelas funcionam; envio mostra a tela de confirmação; banner
some depois de usado; painel admin lista nome+data sem expor a mensagem
até o clique; clicar no item expande e mostra a mensagem completa. 35/35
checks passando (27 anteriores + 8 novos).

## 17. Nome automático no feedback, aviso de instalar como PWA, alerta minimalista

Três melhorias sobre o módulo de feedback da seção 16, reaproveitando o que
já existia (sessão/autenticação, PWA já configurado desde o início do
projeto, e o próprio componente de card usado no banner da seção 16) em
vez de criar mecanismos novos.

**1. Nome automático no formulário de feedback.** O app não tem uso
anônimo — toda tela fica atrás de login — então "identificar o usuário
logado" aqui significa reaproveitar o dado que já é a fonte de verdade
pra "quem está usando agora": o seletor "Você é" (`getActivePersonId`/
`personName`, o mesmo que atribui a auditoria — seção 6), com o nome da
conta (`SESSION.name`) como respaldo pra contas sem pessoas cadastradas.
O campo `#fb-name` já chega preenchido, mas continua editável e opcional
— digitar nele (`updateFeedbackNameDraft`) marca um "foi mexido" que
sobrevive a re-renders da tela (mesma preocupação de não perder o que a
pessoa já digitou que apareceu antes nas estrelas), e o valor volta a ser
automático só depois de "Enviar outro feedback" (`resetFeedbackForm`).

**2. Aviso de instalar como PWA.** O projeto já tinha manifest, ícones e
service worker prontos desde o início (só faltava convidar a pessoa a
usar) — nada disso mudou. O que foi adicionado: um listener de
`beforeinstallprompt` registrado assim que o script carrega (antes até do
login, pra não perder o evento se ele chegar cedo), guardando o evento
pra disparar o prompt nativo do navegador sob demanda. Card no canto
inferior direito ("Instale o Cofre no seu aparelho") com botão "Instalar"
quando o navegador suporta o prompt nativo (Chrome/Edge/Android); no
iOS/Safari, que não dispara esse evento, o botão vira "Como instalar" e
abre as instruções manuais (Compartilhar → Adicionar à Tela de Início)
usando o `alertDialog()` já existente (seção 14) em vez de um componente
novo. Nunca aparece se o app já está rodando instalado (`display-mode:
standalone`), e não volta a incomodar depois de instalado
(`appinstalled`) ou dispensado (`localStorage`).

**3. Alerta minimalista da área de feedback.** Volta a existir um toast de
canto (o mesmo tipo de componente que tinha sido removido na seção 15 em
favor do banner fixo) — mas agora convivendo com o banner, não no lugar
dele: o toast é o "avisou, sumiu" (some sozinho em ~5s com fade, ou ao
clicar no X, e nunca mais aparece depois de visto — chave própria em
`localStorage`, independente da do banner), enquanto o banner da aba
Cartões continua sendo o lembrete que fica até a pessoa interagir com
ele. Os dois avisos (PWA e feedback) usam o mesmo componente genérico de
toast flutuante (`pushFloatingToast`/`removeFloatingToast`, anexado direto
no `<body>` como os modais — ver seção sobre modal stack — pra não ser
apagado a cada `render()`), que empilha automaticamente quando os dois
aparecem juntos, sem se sobrepor.

**Testado:** nome do formulário vem preenchido com a pessoa ativa (testado
tanto com conta "sozinho(a)" quanto com casal, inclusive depois de trocar
quem está usando o app pelo seletor "Você é"); toast de feedback aparece
ao abrir o app, some ao fechar e não reaparece depois; toast de instalação
aparece ao simular o `beforeinstallprompt` do navegador, o botão
"Instalar" aciona o `prompt()` nativo corretamente e o aviso some depois
de usado. 42/42 checks passando (35 anteriores + 7 novos).
