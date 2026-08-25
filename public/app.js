const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const fmt = (n) => (Number(n)||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
// Formata como YYYY-MM-DD usando o calendário local — evita o bug clássico
// de toISOString() (que converte pra UTC e pode "voltar" um dia perto da
// meia-noite em fusos negativos como o do Brasil). Usado em qualquer data
// calculada a partir de outra data (faturas, vencimentos etc.).
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monthKeyToDate = (mKey) => { const [y,m] = mKey.split('-').map(Number); return new Date(y, m-1, 1); };
const monthLabel = (d) => d.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* =====================================================================
   CATEGORIAS — estrutura central e única do sistema.
   Orçamentos, Saídas, Parcelas e gráficos referenciam sempre o mesmo
   category.id. Não existem cadastros paralelos: criar uma categoria em
   qualquer lugar a torna disponível em todos os outros.
   ===================================================================== */

// Paleta ordenada por distância visual: cores vizinhas na lista são bem
// diferentes entre si, então atribuir na ordem já garante contraste. Os
// primeiros tons conversam com a identidade do app (latão, verdigris,
// granada) e os seguintes abrem o leque sem destoar do conjunto.
const CATEGORY_PALETTE = [
  '#B8863C', // latão
  '#3F7D63', // verdigris
  '#A6432F', // granada
  '#4A6FA5', // azul-ardósia
  '#6B5B95', // ameixa
  '#C97B4A', // terracota
  '#5B8C5A', // oliva
  '#8C6428', // latão escuro
  '#98506B', // vinho rosado
  '#2F7D8C', // petróleo
  '#8A7A3F', // mostarda seca
  '#7A4E8C', // roxo profundo
  '#B05A4E', // tijolo
  '#4F7A96', // aço azulado
  '#6E7F3F', // musgo
  '#9C5C2E'  // âmbar queimado
];

// Categorias sugeridas no primeiro uso. São apenas um ponto de partida —
// o usuário pode renomear, desativar ou criar as suas próprias.
const SEED_CATEGORIES_SAIDA = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Cartão de Crédito','Dízimo','Outros'];
const SEED_CATEGORIES_ENTRADA = ['Salário','Freelance/Aulas','Rendimento','Presente','Outros'];

function nowIso(){ return new Date().toISOString(); }

// Escolhe automaticamente a cor da nova categoria: pega a primeira cor da
// paleta ainda não usada por nenhuma categoria ativa. Se todas já estiverem
// em uso, reaproveita a menos frequente (mantendo as repetições espaçadas).
function pickCategoryColor(existing){
  const inUse = {};
  (existing||[]).forEach(c=>{ if(c.color) inUse[c.color] = (inUse[c.color]||0)+1; });
  const free = CATEGORY_PALETTE.find(c=>!inUse[c]);
  if(free) return free;
  let best = CATEGORY_PALETTE[0], bestCount = Infinity;
  CATEGORY_PALETTE.forEach(c=>{ const n = inUse[c]||0; if(n<bestCount){ bestCount=n; best=c; } });
  return best;
}

function makeCategory(name, kind, existing, description){
  return {
    id: uid(),
    name: String(name||'').trim(),
    description: String(description||'').trim(),
    icon: '',
    color: pickCategoryColor(existing),
    kind: kind === 'entrada' ? 'entrada' : 'saida',
    status: 'ativa',
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function allCategories(kind){
  const list = (DATA && DATA.categories) ? DATA.categories : [];
  return kind ? list.filter(c=>c.kind===kind) : list;
}
function activeCategories(kind){
  return allCategories(kind).filter(c=>c.status==='ativa');
}
function getCategory(id){
  return (DATA && DATA.categories ? DATA.categories : []).find(c=>c.id===id) || null;
}
function categoryName(id){
  const c = getCategory(id);
  return c ? c.name : 'Sem categoria';
}
// A cor vem sempre do cadastro central, nunca é definida por módulo — é isso
// que mantém a mesma categoria com a mesma cor no gráfico, na lista e no filtro.
function categoryColor(id){
  const c = getCategory(id);
  return c && c.color ? c.color : '#9C8F7A';
}
// Categorias inativas continuam aparecendo em listas históricas (para não
// apagar o passado), mas não são oferecidas em novos cadastros.
function categoryOptionsHtml(kind, selectedId){
  const actives = activeCategories(kind);
  const sel = getCategory(selectedId);
  const list = (sel && sel.status!=='ativa') ? [...actives, sel] : actives;
  return list.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${esc(c.name)}${c.status!=='ativa'?' (inativa)':''}</option>`).join('');
}

// ---------------- Migração ----------------
// Versões antigas guardavam a categoria como texto solto em cada lançamento.
// Aqui esses textos viram registros da tabela central e os lançamentos passam
// a referenciar category_id, sem perder nenhum histórico.
function migrateCategories(data){
  if(!Array.isArray(data.categories)) data.categories = [];
  const findByName = (name, kind) => data.categories.find(c=>c.name.toLowerCase()===String(name).toLowerCase() && c.kind===kind);
  const ensure = (name, kind) => {
    const clean = String(name||'').trim() || 'Outros';
    let found = findByName(clean, kind);
    if(!found){
      found = makeCategory(clean, kind, data.categories);
      data.categories.push(found);
    }
    return found.id;
  };

  if(data.categories.length===0){
    SEED_CATEGORIES_SAIDA.forEach(n=> data.categories.push(makeCategory(n,'saida',data.categories)));
    SEED_CATEGORIES_ENTRADA.forEach(n=> data.categories.push(makeCategory(n,'entrada',data.categories)));
  }

  (data.transactions||[]).forEach(t=>{
    if(!t.categoryId){
      t.categoryId = ensure(t.category, t.type==='entrada'?'entrada':'saida');
      delete t.category;
    }
  });
  (data.budgets||[]).forEach(b=>{
    if(!b.categoryId){
      b.categoryId = ensure(b.category, 'saida');
      delete b.category;
    }
  });
  (data.installments||[]).forEach(i=>{
    if(!i.categoryId){
      i.categoryId = ensure(i.category, 'saida');
      delete i.category;
    }
  });
  return data;
}

// ---------------- Marca / logomarca ----------------
// Um dial de fechadura de baú — a mesma peça reaparece no dashboard como o
// "mostrador" de saúde financeira, então a marca e o dado real falam a
// mesma língua visual.
function brandMarkSvg(size){
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" stroke="var(--brass)" stroke-width="2.5"/>
    <circle cx="20" cy="20" r="4.2" fill="var(--brass)"/>
    <line x1="20" y1="20" x2="20" y2="7" stroke="var(--brass)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="20" cy="6" r="2" fill="var(--brass)"/>
    <circle cx="34" cy="20" r="1.6" fill="var(--brass)" opacity="0.55"/>
    <circle cx="6" cy="20" r="1.6" fill="var(--brass)" opacity="0.55"/>
    <circle cx="20" cy="34" r="1.6" fill="var(--brass)" opacity="0.55"/>
  </svg>`;
}

// ---------------- Ícones (linha única, estilo consistente) ----------------
// Pequeno conjunto de ícones lineares desenhado no mesmo espírito de
// bibliotecas como a Lucide (stroke uniforme, cantos arredondados, grid
// 24x24) — sem depender de nenhuma biblioteca externa (a CSP do app só
// libera scripts do próprio domínio).
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.6"/><rect x="14" y="3" width="7" height="5" rx="1.6"/><rect x="14" y="12" width="7" height="9" rx="1.6"/><rect x="3" y="16" width="7" height="5" rx="1.6"/>',
  swap: '<path d="M4 7h13M17 7l-3.5-3.5M17 7l-3.5 3.5"/><path d="M20 17H7M7 17l3.5-3.5M7 17l3.5 3.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
  layers: '<path d="M12 3.5 3 8l9 4.5 9-4.5-9-4.5Z"/><path d="M3 13l9 4.5 9-4.5"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>',
  jar: '<path d="M8 3h8v3.4a2 2 0 0 0 .55 1.38L18 10.3A3 3 0 0 1 19 12.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6.5a3 3 0 0 1 1-2.2l1.45-2.52A2 2 0 0 0 8 6.4V3Z"/><path d="M6.3 14.5h11.4"/>',
  heart: '<path d="M12 20.5s-7.6-4.6-9.9-9.3C.6 7.7 2.4 4 6 4c2.1 0 3.6 1.2 6 3.6C14.4 5.2 15.9 4 18 4c3.6 0 5.4 3.7 3.9 7.2-2.3 4.7-9.9 9.3-9.9 9.3Z"/>',
  bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13.5 6 9.5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  sparkles: '<path d="M12 3.5 13.3 8l4.5 1.3-4.5 1.3L12 15l-1.3-4.4L6.2 9.3l4.5-1.3L12 3.5Z"/><path d="M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>',
  shield: '<path d="M12 3.5 19 6.2v5.3c0 4.5-3 7-7 9-4-2-7-4.5-7-9V6.2L12 3.5Z"/><path d="m9 12 2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2.5 12h3M18.5 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronLeft: '<path d="M14.5 5 8 12l6.5 7"/>',
  chevronRight: '<path d="M9.5 5 16 12l-6.5 7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4.5H7.5"/><path d="M12 8v4.5l3 2"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="M16 12.2h2.2"/><path d="M3 9.5h18"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  alertCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r="0.9" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  star: '<path d="M12 3.5 14.6 9l6 .9-4.3 4.3 1 6.1L12 17.3l-5.3 2.9 1-6L3.4 9.9l6-.9L12 3.5Z"/>',
  message: '<path d="M4 5.5A2.3 2.3 0 0 1 6.3 3.2h11.4A2.3 2.3 0 0 1 20 5.5v8A2.3 2.3 0 0 1 17.7 15.8H10l-4.5 4v-4H6.3A2.3 2.3 0 0 1 4 13.5v-8Z"/>',
  chevronDown: '<path d="M5 8.5 12 15l7-6.5"/>',
  download: '<path d="M12 3.5v11"/><path d="M7.5 10 12 14.5 16.5 10"/><path d="M4.5 17.5v2A2 2 0 0 0 6.5 21.5h11a2 2 0 0 0 2-2v-2"/>'
};
function icon(name, size){
  const s = size || 18;
  const body = ICON_PATHS[name] || '';
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// ---------------- Toasts flutuantes (componente genérico) ----------------
// Um único mecanismo, reaproveitado por dois avisos diferentes (instalar o
// PWA e conhecer a área de feedback): anexado direto no <body> — igual ao
// modal (ver openModal) — pra sobreviver aos innerHTML de render() em vez
// de ser redesenhado (e perdido) a cada troca de aba. Empilha vários toasts
// sem eles se sobreporem, com fade-in/out suave (--dur-base/--ease-out, os
// mesmos tokens de transição usados no resto do app).
function pushFloatingToast(id, html, opts){
  opts = opts || {};
  removeFloatingToast(id, true);
  const el = document.createElement('div');
  el.id = id;
  el.className = 'floating-toast' + (opts.clickable ? ' clickable' : '');
  el.innerHTML = html;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  repositionFloatingToasts();
  return el;
}
function removeFloatingToast(id, immediate){
  const el = document.getElementById(id);
  if(!el) return;
  if(immediate){ el.remove(); repositionFloatingToasts(); return; }
  el.classList.remove('show');
  setTimeout(() => { el.remove(); repositionFloatingToasts(); }, 220);
}
function repositionFloatingToasts(){
  const toasts = Array.from(document.querySelectorAll('.floating-toast'));
  let offset = 20;
  toasts.forEach(t => {
    t.style.bottom = offset + 'px';
    offset += t.offsetHeight + 12;
  });
}

// ---------------- Instalar como PWA ----------------
// O Chrome/Android (e desktop Chrome/Edge) dispara `beforeinstallprompt`
// quando o app é instalável — o listener fica registrado desde o carregamento
// do script (antes até do login) pra não perder o evento caso ele chegue
// cedo. No iOS/Safari esse evento não existe: lá a única forma de instalar é
// manual (Compartilhar → Adicionar à Tela de Início), então mostramos as
// instruções via alertDialog() em vez do prompt nativo.
const PWA_TOAST_KEY = 'cofre_pwa_install_dismissed_v1';
let DEFERRED_INSTALL_PROMPT = null;
let PWA_TOAST_SHOWN_THIS_SESSION = false;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  DEFERRED_INSTALL_PROMPT = e;
  maybeShowPwaInstallToast();
});
window.addEventListener('appinstalled', () => {
  DEFERRED_INSTALL_PROMPT = null;
  try{ localStorage.setItem(PWA_TOAST_KEY, '1'); }catch(e){}
  removeFloatingToast('pwa-toast');
});
function isStandaloneDisplay(){
  try{
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }catch(e){ return false; }
}
function isIOSDevice(){
  const ua = navigator.userAgent || '';
  const iOSByUA = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const iPadOS13 = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSByUA || iPadOS13;
}
function maybeShowPwaInstallToast(){
  if(PWA_TOAST_SHOWN_THIS_SESSION) return;
  if(!SESSION || !DATA || !DATA.settings) return; // só depois de logado e com onboarding feito
  if(isStandaloneDisplay()) return; // já instalado/rodando como app
  let dismissed = false;
  try{ dismissed = localStorage.getItem(PWA_TOAST_KEY) === '1'; }catch(e){}
  if(dismissed) return;
  const canPromptNative = !!DEFERRED_INSTALL_PROMPT;
  const ios = isIOSDevice();
  if(!canPromptNative && !ios) return; // nada a oferecer aqui (sem suporte, ou navegador ainda não liberou o evento)
  PWA_TOAST_SHOWN_THIS_SESSION = true;
  const html = `
    <div class="notice-icon">${icon('download', 16)}</div>
    <div class="notice-body">
      <div class="notice-title">Instale o Cofre no seu aparelho</div>
      <div class="notice-text">${ios ? 'Adicione à tela de início pra abrir como um app, direto do Safari.' : 'Adicione à tela inicial pra abrir direto, sem precisar do navegador.'}</div>
    </div>
    <button class="btn small" onclick="${canPromptNative ? 'triggerPwaInstall()' : 'showIosInstallInstructions()'}">${canPromptNative ? 'Instalar' : 'Como instalar'}</button>
    <button class="notice-close" aria-label="Fechar aviso" onclick="dismissPwaInstallToast()">${icon('x', 13)}</button>
  `;
  pushFloatingToast('pwa-toast', html);
}
function dismissPwaInstallToast(){
  try{ localStorage.setItem(PWA_TOAST_KEY, '1'); }catch(e){}
  removeFloatingToast('pwa-toast');
}
async function triggerPwaInstall(){
  if(!DEFERRED_INSTALL_PROMPT){ dismissPwaInstallToast(); return; }
  const promptEvent = DEFERRED_INSTALL_PROMPT;
  DEFERRED_INSTALL_PROMPT = null;
  try{ promptEvent.prompt(); await promptEvent.userChoice; }catch(e){}
  dismissPwaInstallToast();
}
function showIosInstallInstructions(){
  dismissPwaInstallToast();
  alertDialog('Toque no ícone de compartilhamento (o quadrado com uma seta pra cima) na barra do Safari e depois em "Adicionar à Tela de Início".', {title: 'Instalar o Cofre', okLabel: 'Entendi'});
}

// ---------------- Aviso minimalista: nova área de feedback ----------------
// Some sozinho depois de alguns segundos (fade-out) e, uma vez visto ou
// fechado, não aparece de novo (localStorage) — diferente do banner fixo
// da aba Cartões (renderFeedbackBanner), que fica até ser dispensado ali.
// Os dois são independentes de propósito: este é só um "avisou, sumiu"; o
// banner é o lembrete recorrente enquanto a pessoa não interage com ele.
const FEEDBACK_TOAST_KEY = 'cofre_feedback_toast_seen_v1';
let FEEDBACK_TOAST_SHOWN_THIS_SESSION = false;
function maybeShowFeedbackToast(){
  if(FEEDBACK_TOAST_SHOWN_THIS_SESSION) return;
  if(TAB === 'feedback') return; // já está lá, não faz sentido anunciar
  let seen = false;
  try{ seen = localStorage.getItem(FEEDBACK_TOAST_KEY) === '1'; }catch(e){}
  if(seen) return;
  FEEDBACK_TOAST_SHOWN_THIS_SESSION = true;
  try{ localStorage.setItem(FEEDBACK_TOAST_KEY, '1'); }catch(e){}
  const html = `
    <div class="notice-icon">${icon('message', 15)}</div>
    <div class="notice-body" onclick="goToFeedbackFromToast()">
      <div class="notice-text">Sua opinião é importante! Conheça nossa nova área de feedback.</div>
    </div>
    <button class="notice-close" aria-label="Fechar aviso" onclick="removeFloatingToast('feedback-toast')">${icon('x', 13)}</button>
  `;
  pushFloatingToast('feedback-toast', html, {clickable: true});
  setTimeout(() => removeFloatingToast('feedback-toast'), 4800);
}
function goToFeedbackFromToast(){
  removeFloatingToast('feedback-toast', true);
  switchTab('feedback');
}

// ---------------- Splash screen ----------------
// Tela de abertura curta: mostra a marca e uma frase sobre organização
// financeira enquanto a sessão é verificada. Nunca segura o app além do
// necessário — some assim que o carregamento termina, respeitando uma
// duração mínima só para não "piscar" em conexões muito rápidas.
const SPLASH_PHRASES = [
  { text: 'Organização traz clareza.' },
  { text: 'Pequenas decisões constroem grandes futuros.' },
  { text: 'Prosperidade começa com propósito.' },
  { text: 'Cuide do seu hoje. Construa o seu amanhã.' },
  { text: 'Com sabedoria se edifica a casa.', ref: 'Provérbios 24:3' }
];
const SPLASH_MIN_MS = 900;
let SPLASH_START = Date.now();
function initSplash(){
  const el = document.getElementById('splash');
  if(!el) return;
  const phrase = SPLASH_PHRASES[Math.floor(Math.random()*SPLASH_PHRASES.length)];
  el.innerHTML = `
    ${brandMarkSvg(64).replace('brand-mark','brand-mark splash-mark')}
    <div class="splash-word">Cofre<span class="accent">.</span></div>
    <div class="splash-phrase">${esc(phrase.text)}${phrase.ref?`<span class="ref">${esc(phrase.ref)}</span>`:''}</div>
  `;
}
function hideSplash(){
  const el = document.getElementById('splash');
  if(!el) return;
  const elapsed = Date.now() - SPLASH_START;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(()=>{
    el.classList.add('splash-hide');
    setTimeout(()=> el.remove(), 550);
  }, wait);
}
initSplash();

// ---------------- Dicas do Cofre ----------------
// Educação financeira em porções pequenas, no tom de um amigo que entende
// do assunto — não um manual. Uma por aba, escolhida por contexto (não
// aleatória), pra sempre ensinar algo relevante ao que a pessoa está vendo.
const TIPS = {
  dashboard: [
    'Regra prática: separe suas saídas em essenciais (moradia, alimentação), variáveis (lazer, compras) e prioridades (dívidas, poupança). Se as essenciais passarem de 50% da renda, é hora de rever contratos fixos antes de cortar prazeres pequenos.',
    'Olhar o saldo do mês é bom, mas o que muda seu ano é o hábito: registrar todo lançamento no dia em que ele acontece evita o "estouro invisível" do fim do mês.'
  ],
  transacoes: [
    'Lance até os gastos pequenos. É o "café de R$ 8 todo dia" que mais foge do controle mental — e o que mais aparece quando você olha os números de verdade.',
    'Categorizar com consistência importa mais que categorizar com perfeição. Escolha uma categoria e mantenha — é isso que faz os orçamentos por categoria funcionarem de verdade.'
  ],
  orcamentos: [
    'Um orçamento não é uma prisão, é um teto combinado com você mesmo(a) antes do mês começar — assim a decisão difícil já foi tomada com a cabeça fria.',
    'Comece orçando só 2 ou 3 categorias onde você mais se surpreende no fim do mês. Orçar tudo de uma vez costuma cansar e fazer o hábito morrer na 2ª semana.'
  ],
  parcelas: [
    'Parcelar não é "não pagar agora" — é comprometer o seu eu do mês que vem. Antes de fechar uma parcela nova, some tudo que já está comprometido nos próximos meses.',
    'Regra informal saudável: parcelas não devem ultrapassar 30% da sua renda mensal. Passou disso, qualquer imprevisto vira bola de neve.'
  ],
  cartao: [
    'O cartão de crédito não é dinheiro extra, é uma data futura de pagamento. Trate a fatura como uma conta fixa que já existe, mesmo antes dela chegar.',
    'Fechou a fatura e ela veio maior que o esperado? Separe o que foi parcelado (previsível) do que foi gasto no crédito à vista (evitável) — são dois problemas diferentes.'
  ],
  caixinhas: [
    'Caixinhas com nome e valor definido funcionam melhor que "poupança genérica" — o cérebro guarda dinheiro com mais disciplina quando sabe exatamente para quê.',
    'Automatize o pequeno hábito: separar uma quantia fixa toda semana, mesmo pequena, cria mais constância do que um valor grande esporádico.'
  ],
  dizimo: [
    'Separar o dízimo assim que a entrada acontece — antes de qualquer gasto — evita a sensação de "sobrar pouco pra doar" no fim do mês.',
    'Definir isso como um compromisso automático (igual a uma conta fixa) tira a decisão emocional do momento e mantém a constância.'
  ],
  lembretes: [
    'Vencimentos esquecidos costumam custar mais em juros e multas do que qualquer economia feita durante o mês. Poucos minutos revisando lembretes evitam isso.',
    'Agrupar todos os vencimentos num só lugar (em vez de espalhados em apps e papéis) é o que realmente reduz a ansiedade de "será que esqueci de algo".'
  ],
  ia: [
    'A Conselheira usa os seus números reais do mês — quanto mais completo o registro de entradas e saídas, mais útil a resposta dela vai ser.',
    'Pergunte de forma específica: "onde posso cortar 200 reais este mês" tende a gerar uma resposta mais prática do que "como estão minhas finanças".'
  ]
};
let tipIndexByTab = {};
function getTip(tabId){
  const list = TIPS[tabId];
  if(!list || list.length===0) return null;
  if(tipIndexByTab[tabId]==null) tipIndexByTab[tabId] = Math.floor(Math.random()*list.length);
  return list[tipIndexByTab[tabId]];
}
function renderTipCard(tabId){
  const tip = getTip(tabId);
  if(!tip) return '';
  return `
    <div class="tip-card">
      <div class="tip-icon">💡</div>
      <div>
        <div class="tip-label">Dica do Cofre</div>
        <div class="tip-text">${esc(tip)}</div>
      </div>
    </div>
  `;
}

// ---------------- Celebração (uma só, orquestrada) ----------------
// Dispara só no momento em que uma caixinha é concluída — não em toda
// interação — pra ser um marco que a pessoa sente, não ruído visual.
function celebrateJar(jarId){
  const jarEl = document.getElementById(`jarcard-${jarId}`);
  if(!jarEl) return;
  const burst = document.createElement('div');
  burst.className = 'confetti-burst';
  const colors = ['#B8863C','#3F7D63','#A6432F','#8C6428'];
  for(let i=0;i<16;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const angle = (Math.random()*Math.PI) + Math.PI; // espalha pra cima
    const dist = 60 + Math.random()*50;
    piece.style.setProperty('--dx', `${Math.cos(angle)*dist}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle)*dist}px`);
    piece.style.setProperty('--rot', `${(Math.random()*360)|0}deg`);
    piece.style.background = colors[i % colors.length];
    burst.appendChild(piece);
  }
  jarEl.appendChild(burst);
  requestAnimationFrame(()=>{
    burst.querySelectorAll('.confetti-piece').forEach(p=>p.classList.add('go'));
  });
  setTimeout(()=>burst.remove(), 1000);
}


function safeMonthDate(year, monthIndex, day){
  const lastDay = new Date(year, monthIndex+1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

let DATA = null;
let SESSION = null; // {id, email, name, role}
let TAB = 'dashboard';
let CURRENT_MONTH = new Date();
let SAVING = false;
let SAVE_ERROR = '';
let IA_MESSAGES = [];
let IA_LOADING = false;
let AUTH_MODE = 'login';
let AUTH_ERROR = '';
let ADMIN_CLIENTS = [];
let FEEDBACK_RATING = 0;
let FEEDBACK_SENT = false;
let FEEDBACK_ERROR = '';
let FEEDBACK_ADMIN_LIST = [];
let FEEDBACK_EXPANDED = {};
let FEEDBACK_NAME_TOUCHED = false;
let FEEDBACK_NAME_DRAFT = '';

// ---------------- API helper ----------------
// Todas as chamadas usam credentials:'include' para enviar o cookie httpOnly de sessão,
// e um header custom (checado no servidor) como mitigação simples de CSRF.
async function api(path, options={}){
  const opts = {
    method: options.method || 'GET',
    headers: {'Content-Type':'application/json', 'X-Requested-With':'CofreApp'},
    credentials: 'include'
  };
  if(options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch('/api'+path, opts);
  let json = null;
  try{ json = await res.json(); }catch(e){}
  if(!res.ok){
    const err = new Error((json && json.error) || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---------------- Persistência de dados financeiros ----------------
async function loadClientData(){
  const res = await api('/data');
  return migrateFinance(migrateCategories(res.data || DEFAULT_DATA()));
}
function DEFAULT_DATA(){
  return {
    settings:null, categories:[], transactions:[], installments:[],
    cards:[], accounts:[], purchases:[], invoices:{},
    caixinhas:[], titheStatus:{}, reminders:[], budgets:[]
  };
}

/* =====================================================================
   MÓDULO DE CARTÕES / FATURAS / PARCELAMENTOS / AUDITORIA
   Ver PLANO.md na raiz do projeto para as decisões de arquitetura por
   trás do que está aqui — em especial a separação entre saldo bancário
   (cash) e categorias/gráficos (accrual), e por que a auditoria é uma
   tabela própria no servidor em vez de viver dentro deste blob.
   ===================================================================== */

const PAYMENT_METHODS = [
  {id:'dinheiro', label:'Dinheiro'},
  {id:'pix', label:'PIX'},
  {id:'debito', label:'Débito'},
  {id:'credito', label:'Cartão de crédito'},
  {id:'transferencia', label:'Transferência'},
  {id:'outro', label:'Outro'}
];
function paymentMethodLabel(id){ const p = PAYMENT_METHODS.find(p=>p.id===id); return p ? p.label : 'Outro'; }

const ACCOUNT_KINDS = [
  {id:'corrente', label:'Conta corrente'},
  {id:'poupanca', label:'Poupança'},
  {id:'carteira', label:'Carteira'},
  {id:'outro', label:'Outro'}
];
function accountKindLabel(id){ const k = ACCOUNT_KINDS.find(k=>k.id===id); return k ? k.label : 'Outro'; }

const INSTALLMENT_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12];

// ---------------- Migração (parcelamentos/cartões/contas/auditoria) ----------------
// Mesma filosofia de migrateCategories: preenche o que falta sem apagar o
// que já existe, pra contas antigas continuarem funcionando sem perder
// histórico. Idempotente — pode rodar em toda carga sem efeito colateral.
function migrateFinance(data){
  if(!Array.isArray(data.accounts)) data.accounts = [];
  if(!Array.isArray(data.purchases)) data.purchases = [];
  if(!data.invoices || typeof data.invoices !== 'object'){
    // cardBills era o formato antigo (valor da fatura digitado à mão).
    // Migra só o estado "paga" — o valor passa a ser sempre calculado.
    data.invoices = {};
    if(data.cardBills && typeof data.cardBills === 'object'){
      Object.keys(data.cardBills).forEach(k=>{
        data.invoices[k] = {paid: !!data.cardBills[k].paid};
      });
    }
  }
  delete data.cardBills;

  // Conta padrão: sem pelo menos uma, o fluxo de "pagar fatura" fica
  // travado logo de cara. Segue o mesmo espírito do seed de categorias.
  if(data.accounts.length===0){
    data.accounts.push({
      id:'acc-default', name:'Conta principal', kind:'corrente',
      personId:(data.settings?.people?.[0]?.id)||'p1', status:'ativa',
      color: pickCategoryColor(data.accounts), created_at:nowIso(), updated_at:nowIso()
    });
  }

  (data.cards||[]).forEach(c=>{
    if(c.limit==null) c.limit = 0;
    if(!c.status) c.status = 'ativa';
    if(!c.color) c.color = pickCategoryColor(data.cards);
    if(!c.created_at) c.created_at = nowIso();
    if(!c.updated_at) c.updated_at = nowIso();
  });

  (data.transactions||[]).forEach(t=>{
    if(t.paymentMethod===undefined) t.paymentMethod = 'dinheiro';
    if(t.cardId===undefined) t.cardId = null;
    if(t.purchaseId===undefined) t.purchaseId = null;
    if(t.installmentNumber===undefined) t.installmentNumber = null;
    if(t.installmentCount===undefined) t.installmentCount = null;
    if(t.invoiceMonthKey===undefined) t.invoiceMonthKey = null;
    if(t.kind===undefined) t.kind = 'compra';
    if(t.accountId===undefined) t.accountId = null;
    if(t.deletedAt===undefined) t.deletedAt = null;
  });

  return data;
}

function nonDeletedTx(){ return (DATA.transactions||[]).filter(t=>!t.deletedAt); }

// ---------------- Contas ----------------
function activeAccounts(){ return (DATA.accounts||[]).filter(a=>a.status==='ativa'); }
function getAccount(id){ return (DATA.accounts||[]).find(a=>a.id===id) || null; }
function accountName(id){ const a = getAccount(id); return a ? a.name : '—'; }
function accountUsage(id){
  return nonDeletedTx().filter(t=>t.accountId===id).length;
}

// ---------------- Cartões ----------------
function getCard(id){ return (DATA.cards||[]).find(c=>c.id===id) || null; }
function activeCards(){ return (DATA.cards||[]).filter(c=>c.status==='ativa'); }
function getPurchase(id){ return (DATA.purchases||[]).find(p=>p.id===id) || null; }

function addMonthsToKey(mKey, n){
  const [y,m] = mKey.split('-').map(Number);
  return monthKey(new Date(y, (m-1)+n, 1));
}

// Regra de fechamento: compra depois do dia de fechamento entra na fatura
// do mês seguinte. A parcela N (0-based) simplesmente soma N meses à
// fatura da primeira parcela. Ver PLANO.md seção 3.
function invoiceMonthForInstallment(card, purchaseDateStr, installmentIndex){
  const d = new Date(purchaseDateStr+'T00:00:00');
  let baseKey = monthKey(d);
  if(d.getDate() > card.closingDay) baseKey = addMonthsToKey(baseKey, 1);
  return addMonthsToKey(baseKey, installmentIndex);
}
function invoiceClosingDate(card, mKey){
  const [y,m] = mKey.split('-').map(Number);
  return safeMonthDate(y, m-1, card.closingDay);
}
function invoiceDueDate(card, mKey){
  const [y,m] = mKey.split('-').map(Number);
  return safeMonthDate(y, m-1, card.dueDay);
}
function cardTransactionsForMonth(cardId, mKey){
  return nonDeletedTx().filter(t=>t.cardId===cardId && t.kind==='compra' && t.invoiceMonthKey===mKey);
}
// O valor da fatura NUNCA é digitado — é sempre a soma dos lançamentos
// daquele cartão que caem naquele mês-fatura (item 1 e item 4 do pedido).
function invoiceTotal(cardId, mKey){
  return cardTransactionsForMonth(cardId, mKey).reduce((s,t)=>s+Number(t.amount),0);
}
function invoiceRecord(cardId, mKey){
  return (DATA.invoices||{})[`${cardId}-${mKey}`] || {paid:false};
}
function invoiceStatus(card, mKey){
  const rec = invoiceRecord(card.id, mKey);
  if(rec.paid) return 'paga';
  const today = new Date(); today.setHours(0,0,0,0);
  if(today > invoiceDueDate(card, mKey)) return 'atrasada';
  if(today >= invoiceClosingDate(card, mKey)) return 'fechada';
  return 'aberta';
}
const INVOICE_STATUS_LABEL = {aberta:'Aberta', fechada:'Fechada', paga:'Paga', atrasada:'Em atraso'};
// "Adiantar" (em vez de "pagar/marcar como paga") sempre que o pagamento
// acontecer ANTES do vencimento original daquela fatura — mesmo que ela já
// tenha fechado (fechar e vencer são dias diferentes; adiantamento é
// qualquer pagamento feito antes do dia de vencimento).
function isEarlyInvoicePayment(card, mKey){
  const today = new Date(); today.setHours(0,0,0,0);
  return today < invoiceDueDate(card, mKey);
}

function listCardInvoiceMonthKeys(cardId){
  const keys = new Set();
  nonDeletedTx().filter(t=>t.cardId===cardId && t.kind==='compra').forEach(t=>keys.add(t.invoiceMonthKey));
  return Array.from(keys).sort();
}
// Mês-fatura "natural" de hoje pelo calendário: se hoje já passou do dia de
// fechamento deste mês, o ciclo corrente já é o do mês seguinte (mesma regra
// de invoiceMonthForInstallment, só que sem depender de uma compra existir).
function calendarInvoiceKey(card, today){
  today = today || new Date();
  let key = monthKey(today);
  if(today.getDate() > card.closingDay) key = addMonthsToKey(key, 1);
  return key;
}
// "Fatura atual" = a mais antiga fatura ainda em aberto (não paga — pode ser
// de um mês anterior, fatura atrasada) OU, se não houver nenhuma pendente, o
// ciclo corrente do calendário (mesmo que ele ainda não tenha nenhum
// lançamento). "Próxima fatura" é sempre o mês seguinte ao atual.
// Importante: uma vez que a única fatura pendente é paga, ela NUNCA deve
// "voltar" disfarçada de fatura atual/próxima — por isso currentKey só
// considera chaves com invoiceRecord(...).paid===false, nunca reaproveita uma
// chave paga como fallback (era o bug: sem nenhuma pendente, currentKey caía
// direto no mês corrente do calendário — que podia ser o mesmo mês que tinha
// acabado de ser pago em outro cenário — e o cálculo de "próxima" via índice
// na lista de meses com lançamento podia recomeçar do zero e reexibir a
// fatura recém-paga como se fosse a próxima a vencer).
function currentAndNextInvoice(card){
  const keys = listCardInvoiceMonthKeys(card.id);
  const openKeys = keys.filter(k=>!invoiceRecord(card.id,k).paid);
  const calendarKey = calendarInvoiceKey(card, new Date());
  const currentKey = [...openKeys, calendarKey].sort()[0];
  const nextKey = addMonthsToKey(currentKey, 1);
  return {currentKey, nextKey};
}
// Uma parcela só conta como "paga" se ela existia no momento em que a fatura
// foi marcada como paga (invoices[key].paidTxIds, gravado em confirmPayInvoice)
// — nunca só por cair no mesmo mês de uma fatura já paga. Sem essa checagem,
// uma compra lançada DEPOIS de pagar a fatura adiantado (mas antes do
// fechamento real do ciclo) seria erroneamente tratada como já paga,
// subestimando o limite comprometido do cartão. Dados antigos migrados de
// cardBills não têm paidTxIds — nesse caso cai no comportamento anterior
// (mês inteiro considerado pago) para não quebrar histórico pré-existente.
function isInstallmentPaid(t){
  const rec = invoiceRecord(t.cardId, t.invoiceMonthKey);
  if(!rec.paid) return false;
  if(Array.isArray(rec.paidTxIds)) return rec.paidTxIds.includes(t.id);
  return true; // fatura paga migrada de dados antigos, sem snapshot de parcelas
}
// Limite comprometido: o valor TOTAL da compra é reservado no ato (item 6),
// e cada fatura paga libera exatamente a fatia daquela parcela. Parcelas
// futuras canceladas (soft-deleted) não continuam comprometendo limite.
function cardUsedLimit(cardId){
  const purchases = (DATA.purchases||[]).filter(p=>p.cardId===cardId);
  let used = 0;
  purchases.forEach(p=>{
    const insts = nonDeletedTx().filter(t=>t.purchaseId===p.id);
    const totalActive = insts.reduce((s,t)=>s+Number(t.amount),0);
    const paidAmount = insts.filter(isInstallmentPaid).reduce((s,t)=>s+Number(t.amount),0);
    used += Math.max(0, totalActive - paidAmount);
  });
  return used;
}
function cardAvailableLimit(cardId){
  const card = getCard(cardId);
  if(!card) return 0;
  return Math.max(0, (card.limit||0) - cardUsedLimit(cardId));
}

// Um lançamento "pesa" no saldo bancário do mês a não ser que seja a perna
// de uma compra no cartão ainda não paga — essa só pesa quando a fatura é
// de fato paga (kind:'pagamento_fatura'). Ver PLANO.md seção 5.
function isCashImpacting(t){
  return !(t.paymentMethod==='credito' && t.kind==='compra');
}
// O pagamento da fatura é só a liquidação em dinheiro de compras que já
// foram contadas na categoria/orçamento/gráfico quando aconteceram — contá-lo
// de novo ali seria duplicar o gasto. Ele SÓ deve aparecer na visão de caixa
// (isCashImpacting), nunca na visão por categoria.
function isCategoryRelevant(t){
  return t.kind !== 'pagamento_fatura';
}

// ---------------- Auditoria (cliente) ----------------
// Quem age (Pedro/Ana) é declarado pelo próprio cliente através deste
// seletor — o login é único por conta, então o servidor não tem como saber
// sozinho qual pessoa está com o celular na mão agora (ver PLANO.md seção 6).
// O que É confiável e vem sempre do servidor: a conta (sessão) e o horário.
function getActivePersonId(){
  const people = getPeople();
  if(people.length===0) return null;
  if(people.length===1) return people[0].id;
  let id = null;
  try{ id = localStorage.getItem('cofre_active_person'); }catch(e){}
  if(!id || !people.some(p=>p.id===id)) id = people[0].id;
  return id;
}
function setActivePerson(id){
  try{ localStorage.setItem('cofre_active_person', id); }catch(e){}
  render();
}
function personSwitcherHtml(){
  const people = getPeople();
  if(people.length<=1) return '';
  const activeId = getActivePersonId();
  return `
    <div class="field" style="margin-top:10px;">
      <label style="font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#5c6d61;">Você é</label>
      <select id="person-switcher" onchange="setActivePerson(this.value)" style="font-size:12.5px;">
        ${people.map(p=>`<option value="${p.id}" ${p.id===activeId?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
    </div>
  `;
}
// Envia um evento de auditoria. Nunca deve travar a ação principal do
// usuário — se a rede falhar, a mutação em si já foi salva normalmente,
// só o rastro de auditoria fica faltando (e isso é logado no console).
async function logAudit(action, module_, entityType, entityId, description, changes, extra){
  extra = extra || {};
  try{
    const personId = getActivePersonId();
    await api('/audit', {method:'POST', body:{
      actorPersonId: personId,
      actorPersonName: personId ? personName(personId) : (SESSION && SESSION.name) || '—',
      action, module: module_, entityType,
      entityId: entityId!=null ? String(entityId) : null,
      description,
      changes: (changes && changes.length) ? changes : undefined,
      cardId: extra.cardId || null,
      accountId: extra.accountId || null,
      categoryId: extra.categoryId || null
    }});
  }catch(e){
    console.error('Falha ao registrar auditoria', e);
  }
}
// Compara campos de "antes" e "depois" e monta a lista de mudanças no
// formato que a auditoria espera ({field, from, to}), pulando o que não mudou.
function diffChanges(before, after, fields){
  const out = [];
  fields.forEach(f=>{
    const a = before ? before[f.key] : undefined;
    const b = after ? after[f.key] : undefined;
    const na = a==null ? '' : String(a);
    const nb = b==null ? '' : String(b);
    if(na !== nb){
      out.push({field:f.label, from: f.fmt?f.fmt(a):(a==null?'—':String(a)), to: f.fmt?f.fmt(b):(b==null?'—':String(b))});
    }
  });
  return out;
}

async function saveData(){
  SAVING = true; updateSaveIndicator();
  try{
    await api('/data', {method:'PUT', body:DATA});
    SAVE_ERROR = '';
  }catch(e){
    console.error('Erro ao salvar', e);
    SAVE_ERROR = 'Não foi possível salvar suas últimas alterações. Verifique a conexão.';
  }
  SAVING = false;
  setTimeout(updateSaveIndicator, 300);
}
function persist(){ saveData(); render(); }
function updateSaveIndicator(){
  const el = document.getElementById('save-indicator');
  if(!el) return;
  if(SAVE_ERROR){ el.innerHTML = `<span style="color:var(--garnet)">⚠ ${esc(SAVE_ERROR)}</span>`; return; }
  el.textContent = SAVING ? 'salvando…' : 'sincronizado';
}

function getPeople(){
  if(!DATA || !DATA.settings) return [];
  if(DATA.settings.mode === 'single') return [DATA.settings.people[0]];
  return DATA.settings.people;
}
function personName(id){ const p=(DATA.settings?.people||[]).find(p=>p.id===id); return p? p.name : '—'; }

function getUpcomingReminders(){
  const today = new Date(); today.setHours(0,0,0,0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate()+15);
  const items = [];
  DATA.reminders.filter(r=>!r.done).forEach(r=>{
    const d = new Date(r.date+'T00:00:00');
    if(d>=today && d<=horizon) items.push({title:r.title, date:d, amount:null});
  });
  DATA.installments.forEach(inst=>{
    if(inst.paid >= inst.count) return;
    const first = new Date(inst.firstDueDate+'T00:00:00');
    const due = safeMonthDate(first.getFullYear(), first.getMonth()+inst.paid, first.getDate());
    if(due>=today && due<=horizon) items.push({title:`Parcela: ${inst.description} (${inst.paid+1}/${inst.count})`, date:due, amount:inst.monthlyAmount});
  });
  activeCards().forEach(card=>{
    let due = safeMonthDate(today.getFullYear(), today.getMonth(), card.dueDay);
    if(due < today) due = safeMonthDate(today.getFullYear(), today.getMonth()+1, card.dueDay);
    if(due>=today && due<=horizon){
      const mk = monthKey(due);
      const rec = invoiceRecord(card.id, mk);
      if(!rec.paid) items.push({title:`Fatura: ${card.name}`, date:due, amount: invoiceTotal(card.id, mk)});
    }
  });
  items.sort((a,b)=>a.date-b.date);
  return items.map(it=>{
    const daysLeft = Math.round((it.date-today)/86400000);
    let badge='due-ok', label=`em ${daysLeft}d`;
    if(daysLeft<=0){ badge='due-late'; label='hoje/atrasado'; }
    else if(daysLeft<=3){ badge='due-soon'; label=`em ${daysLeft}d`; }
    return {...it, badge, badgeLabel:label, dateLabel: it.date.toLocaleDateString('pt-BR', {day:'2-digit',month:'short'})};
  });
}

// ---------------- Modal helpers ----------------
// Pilha simples de modais: quando um formulário abre outro por cima (ex:
// "+ nova categoria" dentro do lançamento), o pai fica escondido em vez de
// destruído — assim os campos já preenchidos não se perdem quando o filho
// fecha e devolve o controle pra ele (ver openCategoryForm).
let MODAL_STACK = [];
function openModal(html, opts){
  const stack = !!(opts && opts.stack);
  const prev = document.getElementById('active-modal');
  if(prev){
    if(stack){ prev.removeAttribute('id'); prev.style.display='none'; MODAL_STACK.push(prev); }
    else { prev.remove(); MODAL_STACK.forEach(m=>m.remove()); MODAL_STACK = []; }
  }
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay';
  wrap.id = 'active-modal';
  wrap.onclick = (e) => { if(e.target===wrap) closeModal(); };
  wrap.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(wrap);
}
function closeModal(){
  const m = document.getElementById('active-modal');
  if(m) m.remove();
  const parent = MODAL_STACK.pop();
  if(parent){ parent.id = 'active-modal'; parent.style.display = ''; }
}
function val(id){ const el = document.getElementById(id); return el ? el.value : ''; }

// Confirmação/aviso estilizados — substituem confirm()/alert() nativos do
// navegador, que aparecem como uma barra/flag do sistema completamente fora
// do visual do app. Empilham por cima do modal atual quando já existe um
// aberto (ex.: excluir a partir de dentro do formulário de edição), pra
// devolver esse modal se o usuário cancelar, e desfazem os dois níveis se
// confirmar — cada callback chama closeModal() de novo, como já fazia antes
// (a pilha suporta isso naturalmente).
let CONFIRM_DIALOG_CALLBACKS = {};
function confirmDialog(message, onConfirm, opts){
  opts = opts || {};
  const id = uid();
  CONFIRM_DIALOG_CALLBACKS[id] = onConfirm;
  const stack = !!document.getElementById('active-modal');
  openModal(`
    <h3>${esc(opts.title || 'Confirmar ação')}</h3>
    <div class="sub" style="margin:8px 0 20px;">${esc(message)}</div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="cancelConfirmDialog('${id}')">${esc(opts.cancelLabel || 'Cancelar')}</button>
      <button class="btn ${opts.danger ? 'danger' : ''}" onclick="runConfirmDialog('${id}')">${esc(opts.confirmLabel || 'Confirmar')}</button>
    </div>
  `, {stack});
}
function runConfirmDialog(id){
  const cb = CONFIRM_DIALOG_CALLBACKS[id];
  delete CONFIRM_DIALOG_CALLBACKS[id];
  closeModal();
  if(cb) cb();
}
function cancelConfirmDialog(id){
  delete CONFIRM_DIALOG_CALLBACKS[id];
  closeModal();
}
function alertDialog(message, opts){
  opts = opts || {};
  const stack = !!document.getElementById('active-modal');
  openModal(`
    <h3>${esc(opts.title || 'Aviso')}</h3>
    <div class="sub" style="margin:8px 0 20px;">${esc(message)}</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">${esc(opts.okLabel || 'Entendi')}</button>
    </div>
  `, {stack});
}

// ---------------- Banner de feedback (aba Cartões) ----------------
// Substituiu o antigo toast de canto sobre o módulo financeiro (que já
// cumpriu o papel dele). Fica no topo da aba Cartões, no formato
// banner/card pedido, com um botão que já leva pra aba Feedback. Some ao
// clicar no X ou ao usar o botão — guardado em localStorage pra não voltar
// depois de visto (mesmo esquema do antigo toast e do seletor de pessoa).
const FEEDBACK_BANNER_KEY = 'cofre_feedback_banner_dismissed_v1';
function feedbackBannerDismissed(){
  try{ return localStorage.getItem(FEEDBACK_BANNER_KEY) === '1'; }catch(e){ return false; }
}
function dismissFeedbackBanner(){
  try{ localStorage.setItem(FEEDBACK_BANNER_KEY, '1'); }catch(e){}
  const el = document.querySelector('.feedback-banner');
  if(el) el.remove();
}
function goToFeedbackFromBanner(){
  try{ localStorage.setItem(FEEDBACK_BANNER_KEY, '1'); }catch(e){}
  switchTab('feedback');
}
function renderFeedbackBanner(){
  if(feedbackBannerDismissed()) return '';
  return `
    <div class="card feedback-banner">
      <div class="notice-icon">${icon('star',18)}</div>
      <div class="notice-body">
        <div class="notice-title">Agora contamos com uma área de feedback</div>
        <div class="notice-text">Poderia nos dizer como está sendo sua experiência?</div>
      </div>
      <button class="btn small" onclick="goToFeedbackFromBanner()">Deixar feedback</button>
      <button class="notice-close" aria-label="Fechar aviso" onclick="dismissFeedbackBanner()">${icon('x',14)}</button>
    </div>
  `;
}

// ---------------- Feedback (cliente) ----------------
function renderFeedbackForm(){
  if(FEEDBACK_SENT){
    return `
      <div class="card feedback-success">
        <div class="feedback-success-icon">${icon('check',30)}</div>
        <h3>Feedback enviado</h3>
        <div class="sub" style="margin:8px 0 20px;">Muito obrigado! Sua opinião ajuda a melhorar o Cofre.</div>
        <button class="btn" onclick="resetFeedbackForm()">Enviar outro feedback</button>
      </div>
    `;
  }
  return `
    <div class="card" style="max-width:520px;">
      <div class="sub" style="margin-bottom:18px;">Conte como está sendo sua experiência com o Cofre — o que está funcionando bem e o que podia melhorar.</div>
      <div class="field" style="margin-bottom:14px;">
        <label>Sua nota</label>
        <div class="star-rating" id="fb-stars">
          ${[1,2,3,4,5].map(n=>`<button type="button" class="star-btn ${n<=FEEDBACK_RATING?'filled':''}" data-n="${n}" onclick="setFeedbackRating(${n})" aria-label="Nota ${n} de 5">${icon('star',26)}</button>`).join('')}
        </div>
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>Nome <span class="sub" style="font-weight:400;">(opcional)</span></label>
        <input id="fb-name" maxlength="120" placeholder="Como podemos te chamar?" value="${esc(FEEDBACK_NAME_TOUCHED ? FEEDBACK_NAME_DRAFT : getFeedbackAutoName())}" oninput="updateFeedbackNameDraft()">
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>Mensagem</label>
        <textarea id="fb-message" maxlength="500" rows="5" placeholder="Escreva sua avaliação, sugestão ou o que quiser compartilhar..." oninput="updateFeedbackCounter()"></textarea>
        <div class="field-hint" id="fb-counter">0/500</div>
      </div>
      <div class="error-msg" id="fb-error"></div>
      <button class="btn" onclick="submitFeedback()">Enviar feedback</button>
    </div>
  `;
}
// O app não tem uso anônimo (toda tela fica atrás de login), então "usuário
// logado" aqui é sempre garantido — o nome vem de quem está marcado como
// ativo no seletor "Você é" (mesmo dado já usado pra atribuir a auditoria,
// ver getActivePersonId/personSwitcherHtml), com o nome da conta (SESSION)
// como respaldo pra contas sem pessoas cadastradas ainda. O campo continua
// editável: quem quiser mandar com outro nome (ou vazio) só apagar/trocar.
function getFeedbackAutoName(){
  if(DATA && DATA.settings){
    const people = getPeople();
    if(people.length){
      const name = personName(getActivePersonId());
      if(name && name !== '—') return name;
    }
  }
  return (SESSION && SESSION.name) || '';
}
function updateFeedbackNameDraft(){
  FEEDBACK_NAME_TOUCHED = true;
  FEEDBACK_NAME_DRAFT = val('fb-name');
}
function setFeedbackRating(n){
  FEEDBACK_RATING = n;
  const wrap = document.getElementById('fb-stars');
  if(!wrap) return;
  wrap.querySelectorAll('.star-btn').forEach(btn=>{
    const v = Number(btn.getAttribute('data-n'));
    btn.classList.toggle('filled', v<=n);
  });
}
function updateFeedbackCounter(){
  const el = document.getElementById('fb-message');
  const counter = document.getElementById('fb-counter');
  if(el && counter) counter.textContent = `${el.value.length}/500`;
}
async function submitFeedback(){
  const errEl = document.getElementById('fb-error');
  const name = val('fb-name').trim();
  const message = val('fb-message').trim();
  if(errEl) errEl.textContent = '';
  if(!FEEDBACK_RATING){ if(errEl) errEl.textContent = 'Escolha uma nota de 1 a 5.'; return; }
  if(!message){ if(errEl) errEl.textContent = 'Escreva uma mensagem antes de enviar.'; return; }
  if(message.length > 500){ if(errEl) errEl.textContent = 'A mensagem não pode passar de 500 caracteres.'; return; }
  try{
    await api('/feedback', {method:'POST', body:{rating:FEEDBACK_RATING, name: name || undefined, message}});
    FEEDBACK_SENT = true;
    FEEDBACK_RATING = 0;
    render();
  }catch(e){
    if(errEl) errEl.textContent = e.message || 'Não foi possível enviar seu feedback. Tente novamente.';
  }
}
function resetFeedbackForm(){
  FEEDBACK_SENT = false;
  FEEDBACK_RATING = 0;
  FEEDBACK_NAME_TOUCHED = false;
  FEEDBACK_NAME_DRAFT = '';
  render();
}

// ---------------- Feedbacks (admin) ----------------
async function loadAndRenderFeedbackAdmin(){
  try{
    const res = await api('/feedback/admin?limit=300');
    FEEDBACK_ADMIN_LIST = res.feedback || [];
  }catch(e){
    FEEDBACK_ADMIN_LIST = [];
  }
  if(TAB==='feedbacks-admin'){
    const content = document.getElementById('tab-content');
    if(content) content.innerHTML = renderFeedbackAdmin();
  }
}
function toggleFeedbackExpanded(id){
  FEEDBACK_EXPANDED[id] = !FEEDBACK_EXPANDED[id];
  const content = document.getElementById('tab-content');
  if(content) content.innerHTML = renderFeedbackAdmin();
}
function renderFeedbackAdmin(){
  return `
    <div class="sub" style="margin-bottom:14px;">Feedbacks enviados por todas as contas. Toque num item para ver a nota e a mensagem completa.</div>
    <div class="row-list list-grouped">
      ${FEEDBACK_ADMIN_LIST.length===0 ? '<div class="empty"><span class="empty-title">Nenhum feedback ainda</span>Assim que alguém enviar, aparece aqui.</div>' :
        FEEDBACK_ADMIN_LIST.map(f=>renderFeedbackAdminRow(f)).join('')}
    </div>
  `;
}
function renderFeedbackAdminRow(f){
  const d = new Date(String(f.createdAt).replace(' ','T')+'Z');
  const when = isNaN(d.getTime()) ? f.createdAt : d.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
  const expanded = !!FEEDBACK_EXPANDED[f.id];
  const displayName = f.name || f.accountName || 'Anônimo';
  return `
    <div class="item-row feedback-admin-row" style="flex-direction:column; align-items:stretch; cursor:pointer;" onclick="toggleFeedbackExpanded(${f.id})">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="item-left">
          <div>
            <div class="item-desc"><strong>${esc(displayName)}</strong></div>
            <div class="item-meta">${when}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="star-rating-mini">${[1,2,3,4,5].map(n=>`<span class="${n<=f.rating?'filled':''}">${icon('star',14)}</span>`).join('')}</span>
          <span class="feedback-chevron ${expanded?'open':''}">${icon('chevronDown',16)}</span>
        </div>
      </div>
      ${expanded?`
      <div class="feedback-admin-detail">
        <div class="item-meta">${esc(f.accountName||'')} · ${esc(f.accountEmail||'')}</div>
        <div class="feedback-admin-message">${esc(f.message)}</div>
      </div>`:''}
    </div>
  `;
}

// ================= AUTH SCREENS =================
function renderAuthGate(){
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-hero">
        ${brandMarkSvg(44)}
        <div class="brand" style="justify-content:center; padding:0;">Cofre<span class="accent">.</span></div>
        <p>Suas finanças, guardadas com cuidado — sozinho(a) ou a dois.</p>
      </div>
      <div class="card" style="margin-top:20px;">
        <div class="auth-tabs">
          <div class="auth-tab ${AUTH_MODE==='login'?'active':''}" onclick="setAuthMode('login')">Entrar</div>
          <div class="auth-tab ${AUTH_MODE==='register'?'active':''}" onclick="setAuthMode('register')">Criar conta</div>
        </div>
        <div class="error-msg">${esc(AUTH_ERROR)}</div>
        ${AUTH_MODE==='register' ? `
        <div class="form-grid full"><div class="field"><label>Seu nome</label><input id="auth-name" placeholder="Como podemos te chamar"></div></div>
        ` : ''}
        <div class="form-grid full"><div class="field"><label>E-mail</label><input id="auth-email" type="email" placeholder="voce@email.com"></div></div>
        <div class="form-grid full"><div class="field"><label>Senha</label><input id="auth-password" type="password" placeholder="${AUTH_MODE==='register'?'mínimo 8 caracteres':'sua senha'}"></div></div>
        ${AUTH_MODE==='register' ? `
        <div class="consent-row">
          <input type="checkbox" id="auth-consent">
          <label for="auth-consent">Li e estou de acordo com os <a onclick="event.preventDefault(); openTermsModal()">Termos de Uso e a Política de Privacidade</a>, e entendo como o Cofre trata meus dados pessoais e financeiros conforme a LGPD.</label>
        </div>
        ` : ''}
        <button class="btn" style="width:100%; margin-top:6px;" id="auth-submit-btn" onclick="${AUTH_MODE==='login'?'submitLogin()':'submitRegister()'}">${AUTH_MODE==='login'?'Entrar':'Criar minha conta'}</button>
        <div class="hint">Suas credenciais nunca ficam guardadas no navegador: a senha é validada no servidor (hash bcrypt) e a sessão usa um cookie seguro, inacessível via JavaScript.</div>
      </div>
    </div>
  `;
}
function setAuthMode(m){ AUTH_MODE = m; AUTH_ERROR=''; renderAuthGate(); }

function openTermsModal(){
  openModal(`
    <h3>Termos de Uso &amp; Privacidade (LGPD)</h3>
    <div class="sub" style="margin-bottom:12px; line-height:1.6;">
      O Cofre guarda apenas os dados que você mesmo(a) cadastra para controlar suas finanças
      (lançamentos, categorias, caixinhas, cartões e lembretes). Esses dados ficam vinculados
      à sua conta, isolados por usuário no banco de dados do servidor, e nunca são
      compartilhados com terceiros ou usados para fins de publicidade. Sua senha nunca é
      armazenada em texto puro — apenas um hash criptográfico dela. Você pode solicitar a
      exclusão da sua conta e dos dados associados a qualquer momento, conforme previsto pela
      Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
    </div>
    <div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Fechar</button></div>
  `);
}
async function submitRegister(){
  const consentEl = document.getElementById('auth-consent');
  if(consentEl && !consentEl.checked){
    // Evita renderAuthGate() aqui de propósito: um full re-render limparia o
    // que a pessoa já preencheu. Mostra o erro no lugar, sem apagar o formulário.
    const errEl = document.querySelector('.auth-wrap .error-msg');
    if(errEl) errEl.textContent = 'Confirme que leu e concorda com os Termos e a Política de Privacidade para continuar.';
    const row = consentEl.closest('.consent-row');
    if(row){ row.style.borderColor = 'var(--garnet)'; }
    return;
  }
  const btn = document.getElementById('auth-submit-btn'); btn.disabled = true;
  const name = val('auth-name');
  const email = val('auth-email');
  const password = val('auth-password');
  try{
    const res = await api('/auth/register', {method:'POST', body:{name, email, password}});
    SESSION = res.user;
    DATA = migrateFinance(migrateCategories(DEFAULT_DATA()));
    TAB = 'dashboard';
    render();
  }catch(e){
    AUTH_ERROR = e.message || 'Não foi possível criar a conta.';
    renderAuthGate();
  }
}
async function submitLogin(){
  const btn = document.getElementById('auth-submit-btn'); btn.disabled = true;
  const email = val('auth-email');
  const password = val('auth-password');
  try{
    const res = await api('/auth/login', {method:'POST', body:{email, password}});
    SESSION = res.user;
    DATA = await loadClientData();
    TAB = 'dashboard';
    render();
  }catch(e){
    AUTH_ERROR = e.message || 'Não foi possível entrar.';
    renderAuthGate();
  }
}
async function logout(){
  try{ await api('/auth/logout', {method:'POST'}); }catch(e){}
  SESSION = null; DATA = null; IA_MESSAGES=[]; AUTH_ERROR=''; AUTH_MODE='login';
  render();
}

// ---------------- Onboarding (primeira vez de cada conta) ----------------
let onboardMode = 'single';
let onboardNames = ['', ''];
function renderOnboarding(){
  onboardNames[0] = onboardNames[0] || (SESSION?.name || '');
  return `
  <div style="max-width:480px; margin:60px auto;">
    <div class="brand" style="padding:0 0 18px;">${brandMarkSvg(26)}Cofre<span class="accent">.</span></div>
    <div class="card">
      <h3 style="margin-bottom:6px;">Bem-vindo(a), ${esc(SESSION.name)}!</h3>
      <div class="sub" style="margin-bottom:18px;">Antes de começar, conte um pouco sobre como você vai usar o Cofre.</div>
      <label>Como você vai usar o app?</label>
      <div class="mode-toggle">
        <div class="mode-option ${onboardMode==='single'?'selected':''}" onclick="setOnboardMode('single')">Sou solteiro(a)</div>
        <div class="mode-option ${onboardMode==='couple'?'selected':''}" onclick="setOnboardMode('couple')">Somos um casal</div>
      </div>
      <div class="form-grid full">
        <div class="field"><label>Seu nome</label><input id="ob-name1" value="${esc(onboardNames[0])}" oninput="onboardNames[0]=this.value"></div>
      </div>
      ${onboardMode==='couple' ? `
      <div class="form-grid full">
        <div class="field"><label>Nome do(a) parceiro(a)</label><input id="ob-name2" value="${esc(onboardNames[1])}" oninput="onboardNames[1]=this.value"></div>
      </div>` : ''}
      <button class="btn" style="width:100%; margin-top:10px;" onclick="finishOnboarding()">Começar a usar</button>
    </div>
  </div>`;
}
function setOnboardMode(m){ onboardMode = m; render(); }
function finishOnboarding(){
  const name1 = (onboardNames[0]||'Você').trim() || 'Você';
  const name2 = (onboardNames[1]||'Parceiro(a)').trim() || 'Parceiro(a)';
  DATA.settings = {
    mode: onboardMode,
    people: [{id:'p1', name:name1, color:'#3CAE8C'}, {id:'p2', name:name2, color:'#D4A24C'}]
  };
  persist();
}

function renderSettingsModal(){
  const s = DATA.settings;
  openModal(`
    <h3>Configurações</h3>
    <label>Modo de uso</label>
    <div class="mode-toggle">
      <div class="mode-option ${s.mode==='single'?'selected':''}" id="set-mode-single" onclick="setSettingsMode('single')">Solteiro(a)</div>
      <div class="mode-option ${s.mode==='couple'?'selected':''}" id="set-mode-couple" onclick="setSettingsMode('couple')">Casal</div>
    </div>
    <div class="form-grid full"><div class="field"><label>Seu nome</label><input id="set-name1" value="${esc(s.people[0].name)}"></div></div>
    <div class="form-grid full" id="set-name2-wrap" style="${s.mode==='single'?'display:none':''}">
      <div class="field"><label>Nome do(a) parceiro(a)</label><input id="set-name2" value="${esc(s.people[1].name)}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="saveSettings()">Salvar</button>
    </div>
  `);
}
function setSettingsMode(m){
  const singleBtn = document.getElementById('set-mode-single');
  const coupleBtn = document.getElementById('set-mode-couple');
  singleBtn.classList.toggle('selected', m==='single');
  coupleBtn.classList.toggle('selected', m==='couple');
  singleBtn.closest('.modal').dataset.mode = m;
  document.getElementById('set-name2-wrap').style.display = m==='single' ? 'none' : '';
}
function saveSettings(){
  const modalEl = document.getElementById('set-mode-single').closest('.modal');
  const mode = modalEl.dataset.mode || DATA.settings.mode;
  DATA.settings.mode = mode;
  DATA.settings.people[0].name = val('set-name1').trim() || DATA.settings.people[0].name;
  if(mode==='couple') DATA.settings.people[1].name = val('set-name2').trim() || DATA.settings.people[1].name;
  closeModal();
  persist();
}

// ---------------- Nav ----------------
function getNav(){
  const nav = [
    {id:'dashboard', label:'Visão Geral', icon:'dashboard'},
    {id:'transacoes', label:'Entradas & Saídas', icon:'swap'},
    {id:'orcamentos', label:'Orçamentos', icon:'target'},
    {id:'parcelas', label:'Parcelas', icon:'layers'},
    {id:'cartao', label:'Cartões', icon:'card'},
    {id:'caixinhas', label:'Caixinhas', icon:'jar'},
    {id:'dizimo', label:'Dízimo', icon:'heart'},
    {id:'lembretes', label:'Lembretes', icon:'bell'},
    {id:'auditoria', label:'Auditoria', icon:'history'},
    {id:'ia', label:'Conselheira IA', icon:'sparkles'},
    {id:'feedback', label:'Feedback', icon:'star'},
  ];
  if(SESSION && SESSION.role==='admin'){
    nav.push({id:'admin', label:'Painel Admin', icon:'shield'});
    nav.push({id:'feedbacks-admin', label:'Feedbacks', icon:'message'});
  }
  return nav;
}
function changeMonth(delta){ CURRENT_MONTH = new Date(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth()+delta, 1); render(); }

// ---------------- Main render ----------------
let SIDEBAR_OPEN = false;
function switchTab(t){ TAB = t; SIDEBAR_OPEN = false; render(); }
function toggleSidebar(){ SIDEBAR_OPEN = !SIDEBAR_OPEN; applySidebarState(); }
function closeSidebar(){ if(!SIDEBAR_OPEN) return; SIDEBAR_OPEN = false; applySidebarState(); }
function applySidebarState(){
  const sb = document.getElementById('app-sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  if(sb) sb.classList.toggle('open', SIDEBAR_OPEN);
  if(bd) bd.classList.toggle('show', SIDEBAR_OPEN);
}
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSidebar(); });

function render(){
  const root = document.getElementById('root');
  if(!SESSION){ renderAuthGate(); return; }
  if(!DATA.settings){ root.innerHTML = renderOnboarding(); return; }

  const NAV = getNav();
  // "cartao" fica de fora: o painel de cada cartão já navega sozinho pra
  // "fatura atual"/"próxima fatura" (currentAndNextInvoice) — um seletor de
  // mês ali do lado não mudava nada na tela e só confundia (parecia que dava
  // pra "procurar" uma fatura de outro mês navegando por ele).
  const showMonthPicker = ['dashboard','transacoes','dizimo','orcamentos'].includes(TAB);
  const navHtml = NAV.map(n => `<button class="nav-btn ${TAB===n.id?'active':''}" onclick="switchTab('${n.id}')"><span class="nav-icon">${icon(n.icon)}</span>${n.label}</button>`).join('');

  root.innerHTML = `
    <div class="app">
      <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="closeSidebar()"></div>
      <div class="sidebar" id="app-sidebar">
        <div class="sidebar-top">
          <div class="brand">${brandMarkSvg(24)}Cofre<span class="accent">.</span></div>
          <button class="sidebar-close" onclick="closeSidebar()" aria-label="Fechar menu">${icon('x')}</button>
        </div>
        ${navHtml}
        <button class="nav-btn" onclick="renderSettingsModal()"><span class="nav-icon">${icon('settings')}</span>Configurações</button>
        <button class="nav-btn" onclick="logout()"><span class="nav-icon">${icon('logout')}</span>Sair</button>
        <div style="margin-top:auto; padding-top:14px; font-size:11px; color:#5c6d61; line-height:1.6;">
          <div>${esc(SESSION.name)} ${SESSION.role==='admin'?'<span class="role-badge">admin</span>':''}</div>
          <div id="save-indicator">sincronizado</div>
          ${personSwitcherHtml()}
        </div>
      </div>
      <div class="main">
        <div class="topbar">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="hamburger-btn" onclick="toggleSidebar()" aria-label="Abrir menu">${icon('menu')}</button>
            <h1>${NAV.find(n=>n.id===TAB)?.label || ''}</h1>
          </div>
          ${showMonthPicker ? `
          <div class="month-picker">
            <button onclick="changeMonth(-1)" aria-label="Mês anterior">${icon('chevronLeft',15)}</button>
            <div class="label">${monthLabel(CURRENT_MONTH)}</div>
            <button onclick="changeMonth(1)" aria-label="Próximo mês">${icon('chevronRight',15)}</button>
          </div>` : ''}
        </div>
        <div id="tab-content"></div>
      </div>
    </div>
  `;
  const content = document.getElementById('tab-content');
  const mKey = monthKey(CURRENT_MONTH);
  if(TAB==='dashboard') content.innerHTML = renderDashboard(mKey);
  else if(TAB==='transacoes') content.innerHTML = renderTransacoes(mKey);
  else if(TAB==='orcamentos') content.innerHTML = renderOrcamentos(mKey);
  else if(TAB==='parcelas') content.innerHTML = renderParcelas();
  else if(TAB==='cartao') content.innerHTML = renderCartao(mKey);
  else if(TAB==='caixinhas') content.innerHTML = renderCaixinhas();
  else if(TAB==='dizimo') content.innerHTML = renderDizimo(mKey);
  else if(TAB==='lembretes') content.innerHTML = renderLembretes();
  else if(TAB==='auditoria'){ content.innerHTML = '<div class="empty">Carregando...</div>'; loadAndRenderAudit(); }
  else if(TAB==='ia') content.innerHTML = renderConselheira();
  else if(TAB==='feedback') content.innerHTML = renderFeedbackForm();
  else if(TAB==='feedbacks-admin'){ content.innerHTML = '<div class="empty">Carregando...</div>'; loadAndRenderFeedbackAdmin(); }
  else if(TAB==='admin'){ content.innerHTML = '<div class="empty">Carregando...</div>'; loadAndRenderAdmin(); }

  maybeShowFeedbackToast();
  maybeShowPwaInstallToast();
}

// ---------------- Dashboard ----------------
function renderGauge(saldo, entradas){
  const rate = entradas>0 ? saldo/entradas : (saldo<0 ? -0.3 : 0);
  const clamped = Math.max(-0.3, Math.min(0.4, rate));
  const angle = ((clamped - (-0.3)) / (0.4 - (-0.3))) * 160 - 80; // -80..80

  let status, detail;
  if(rate < 0){
    status = 'Apertado';
    detail = `As saídas passaram as entradas em ${fmt(Math.abs(saldo))} neste mês. Vale olhar as categorias que mais pesaram antes do próximo mês começar.`;
  } else if(rate < 0.1){
    status = 'Atenção';
    detail = `Você fechou o mês no positivo, mas guardando pouco (${Math.round(rate*100)}% da renda). Um orçamento por categoria pode abrir espaço.`;
  } else if(rate < 0.25){
    status = 'Equilibrado';
    detail = `Sobrou ${fmt(saldo)} este mês — cerca de ${Math.round(rate*100)}% da renda. Uma boa base para reforçar uma caixinha.`;
  } else {
    status = 'Tranquilo';
    detail = `Sobrou ${fmt(saldo)}, ${Math.round(rate*100)}% da renda do mês. Ótimo momento para acelerar uma meta de poupança.`;
  }

  return `
    <div class="card">
      <div class="gauge-wrap">
        <svg class="gauge-svg" viewBox="0 0 180 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 14 90 A 76 76 0 0 1 166 90" fill="none" stroke="var(--garnet)" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
          <path d="M 40 32 A 76 76 0 0 1 140 32" fill="none" stroke="var(--brass)" stroke-width="10" stroke-linecap="round" opacity="0.4"/>
          <path d="M 96 14 A 76 76 0 0 1 166 90" fill="none" stroke="var(--verdigris)" stroke-width="10" stroke-linecap="round" opacity="0.4"/>
          <line class="gauge-needle" x1="90" y1="90" x2="90" y2="20" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" style="transform:rotate(${angle}deg)"/>
          <circle cx="90" cy="90" r="6" fill="var(--ink)"/>
        </svg>
        <div class="gauge-caption">
          <div class="gauge-status" style="color:${rate<0?'var(--garnet)':(rate<0.1?'var(--brass-deep)':'var(--verdigris)')}">${status}</div>
          <div class="gauge-detail">${detail}</div>
        </div>
      </div>
    </div>
  `;
}

// ---------------- Mapa de gastos ----------------
// A primeira coisa que a pessoa vê ao entrar: pra onde o dinheiro do mês
// está indo, sem precisar caçar em nenhuma aba. É o "retrato cru" antes
// de qualquer análise ou dica.
function renderSpendingMap(monthTx){
  const saidas = monthTx.filter(t=>t.type==='saida');
  const total = saidas.reduce((s,t)=>s+Number(t.amount),0);

  if(total<=0){
    return `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;"><h2 style="font-size:16.5px;">Mapa de gastos</h2></div>
      <div class="empty"><span class="empty-title">Ainda sem gastos este mês</span>Assim que você registrar a primeira saída, este mapa mostra pra onde o dinheiro está indo.</div>
    </div>`;
  }

  // Agrupa por category_id — a cor de cada fatia vem do cadastro central,
  // então o mesmo tom aparece aqui, na lista de saídas e nos orçamentos.
  const byCat = {};
  saidas.forEach(t=>{ byCat[t.categoryId] = (byCat[t.categoryId]||0) + Number(t.amount); });
  let entries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  const MAX_SLICES = 6;
  let shown = entries.slice(0, MAX_SLICES).map(([id,amt])=>({id, name:categoryName(id), color:categoryColor(id), amt}));
  const rest = entries.slice(MAX_SLICES);
  if(rest.length){
    shown.push({id:null, name:'Demais categorias', color:'#9C8F7A', amt:rest.reduce((s,[,v])=>s+v,0)});
  }

  let cum = 0;
  const gradientParts = shown.map(s=>{
    const pct = (s.amt/total)*100;
    const start = cum;
    cum += pct;
    return `${s.color} ${start}% ${cum}%`;
  });
  const gradient = `conic-gradient(${gradientParts.join(', ')})`;
  const top = shown[0];
  const topHasBudget = top && top.id && DATA.budgets.some(b=>b.categoryId===top.id);

  return `
    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <div><h2 style="font-size:16.5px;">Mapa de gastos</h2><div class="sub">Onde o dinheiro do mês está indo — a realidade antes de qualquer análise.</div></div>
      </div>
      <div class="spending-map">
        <div class="spending-donut-wrap">
          <div class="spending-donut" style="background:${gradient}"></div>
          <div class="spending-donut-hole">
            <div class="spending-donut-total">${fmt(total)}</div>
            <div class="spending-donut-label">gasto no mês</div>
          </div>
        </div>
        <div class="spending-legend">
          ${shown.map(s=>{
            const pct = Math.round((s.amt/total)*100);
            return `
            <div class="spending-legend-row">
              <span class="spending-dot" style="background:${s.color}"></span>
              <div class="spending-legend-info">
                <div class="spending-legend-top"><span class="spending-legend-name">${esc(s.name)}</span><span class="spending-legend-amount">${fmt(s.amt)}</span></div>
                <div class="progress-track" style="margin-top:4px;"><div class="progress-fill" style="width:${pct}%; background:${s.color};"></div></div>
              </div>
              <span class="spending-legend-pct">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      ${top ? `<div class="hint">"${esc(top.name)}" concentra a maior fatia do mês (${Math.round((top.amt/total)*100)}%).${topHasBudget?'':' Ainda não há um teto pra essa categoria — pode valer a pena criar um na aba Orçamentos.'}</div>` : ''}
    </div>
  `;
}

// Resumo compacto dos orçamentos no dashboard: mostra os mais próximos do
// limite primeiro, que é a informação acionável de relance.
function renderDashboardBudgets(monthTx){
  const spentByCat = {};
  monthTx.filter(t=>t.type==='saida').forEach(t=>{
    spentByCat[t.categoryId] = (spentByCat[t.categoryId]||0) + Number(t.amount);
  });
  const rows = DATA.budgets.map(b=>{
    const spent = spentByCat[b.categoryId]||0;
    return {
      name: categoryName(b.categoryId),
      color: categoryColor(b.categoryId),
      orcado: b.amount,
      realizado: spent,
      saldo: b.amount - spent,
      pct: b.amount>0 ? (spent/b.amount)*100 : 0,
      over: spent > b.amount
    };
  }).sort((a,b)=>b.pct-a.pct).slice(0,4);

  return rows.map(r=>{
    const width = Math.min(100, Math.round(r.pct));
    const fill = r.over ? 'var(--garnet)' : (r.pct>=80 ? 'var(--brass)' : r.color);
    return `
    <div class="card" style="padding:14px 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
        <div>
          <div class="item-desc"><span class="cat-dot" style="background:${r.color}"></span>${esc(r.name)} ${r.over?'<span class="over-tag">acima do limite</span>':''}</div>
          <div class="item-meta">${fmt(r.realizado)} de ${fmt(r.orcado)} (${Math.round(r.pct)}%)</div>
        </div>
        <div class="item-amount" style="color:${r.saldo<0?'var(--garnet)':'var(--verdigris)'}">${fmt(r.saldo)}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${width}%; background:${fill};"></div></div>
    </div>`;
  }).join('');
}

function renderDashboard(mKey){
  // Duas visões da mesma lista, de propósito (ver PLANO.md seção 5):
  // - monthTx (accrual): tudo que "conta" pra categoria/orçamento/gráfico,
  //   incluindo compras no cartão ainda não pagas — é o retrato do que foi
  //   decidido gastar.
  // - cashTx (caixa): só o que de fato entrou/saiu da conta bancária —
  //   compra no cartão não paga fica de fora até a fatura ser quitada.
  const rawMonthTx = nonDeletedTx().filter(t => t.date.startsWith(mKey));
  const monthTx = rawMonthTx.filter(isCategoryRelevant);
  const cashTx = rawMonthTx.filter(isCashImpacting);
  const entradas = cashTx.filter(t=>t.type==='entrada').reduce((s,t)=>s+Number(t.amount),0);
  const saidas = cashTx.filter(t=>t.type==='saida').reduce((s,t)=>s+Number(t.amount),0);
  const saldo = entradas - saidas;
  const people = getPeople();
  const titheOwed = people.reduce((sum,p)=>{
    const inc = cashTx.filter(t=>t.type==='entrada' && (people.length===1 || t.personId===p.id)).reduce((s,t)=>s+Number(t.amount),0);
    const paid = DATA.titheStatus[`${p.id}-${mKey}`];
    return sum + (paid ? 0 : inc*0.1);
  },0);
  const upcoming = getUpcomingReminders();
  const budgetsOver = DATA.budgets.filter(b=>{
    const spent = monthTx.filter(t=>t.type==='saida'&&t.categoryId===b.categoryId).reduce((s,t)=>s+Number(t.amount),0);
    return spent > b.amount;
  }).length;

  return `
    <div class="hero-balance">
      <div>
        <div class="stat-label">Saldo do mês</div>
        <div class="stat-hero" style="color:${saldo<0?'var(--garnet)':'var(--verdigris)'}">${fmt(saldo)}</div>
        <div class="sub" style="margin-top:2px;">Considera só o que já saiu de fato da conta — compras no cartão entram quando a fatura é paga.</div>
      </div>
      <div class="hero-balance-secondary">
        <div class="mini-stat"><div class="mini-stat-label">Entradas</div><div class="mini-stat-value" style="color:var(--verdigris)">${fmt(entradas)}</div></div>
        <div class="mini-stat"><div class="mini-stat-label">Saídas</div><div class="mini-stat-value" style="color:var(--garnet)">${fmt(saidas)}</div></div>
        <div class="mini-stat"><div class="mini-stat-label">Dízimo pendente</div><div class="mini-stat-value" style="color:var(--brass-deep)">${fmt(titheOwed)}</div></div>
      </div>
    </div>
    <section style="margin-bottom:24px;">
      ${renderSpendingMap(monthTx)}
    </section>
    ${renderTipCard('dashboard')}
    <section style="margin-bottom:32px;">
      ${renderGauge(saldo, entradas)}
    </section>
    <section>
      <div class="section-head">
        <div><h2>Orçamentos do mês</h2><div class="sub">${budgetsOver>0? budgetsOver+' categoria(s) estouraram o orçamento' : 'Nenhum orçamento estourado'}</div></div>
        <button class="btn secondary small" onclick="switchTab('orcamentos')">Gerenciar</button>
      </div>
      <div class="row-list">
        ${DATA.budgets.length===0 ? '<div class="empty"><span class="empty-title">Nenhum teto definido ainda</span>Escolha uma categoria que costuma te surpreender e defina um limite pra ela.</div>' :
          renderDashboardBudgets(monthTx)}
      </div>
    </section>
    <section>
      <div class="section-head">
        <div><h2>Próximos vencimentos</h2><div class="sub">Parcelas, cartão e lembretes dos próximos 15 dias</div></div>
        <button class="btn secondary small" onclick="switchTab('lembretes')">Ver todos</button>
      </div>
      <div class="row-list list-grouped">
        ${upcoming.length===0 ? '<div class="empty"><span class="empty-title">Tudo em dia ✦</span>Nenhum vencimento nos próximos 15 dias.</div>' :
          upcoming.slice(0,6).map(r=>`
          <div class="item-row">
            <div class="item-left">
              <span class="due-badge ${r.badge}">${r.badgeLabel}</span>
              <div><div class="item-desc">${esc(r.title)}</div><div class="item-meta">${r.dateLabel}</div></div>
            </div>
            <div class="item-amount">${r.amount!=null?fmt(r.amount):''}</div>
          </div>`).join('')}
      </div>
    </section>
    <section>
      <div class="section-head">
        <div><h2>Caixinhas</h2><div class="sub">Progresso dos objetivos de poupança</div></div>
        <button class="btn secondary small" onclick="switchTab('caixinhas')">Gerenciar</button>
      </div>
      <div class="jar-grid">
        ${DATA.caixinhas.length===0 ? '<div class="empty"><span class="empty-title">Nenhuma caixinha ainda</span>Que tal começar com um objetivo pequeno e concreto, tipo uma viagem de fim de semana?</div>' :
          DATA.caixinhas.slice(0,3).map(c=>renderJarCard(c, true)).join('')}
      </div>
    </section>
  `;
}

// ---------------- Transações ----------------
let txFilterPerson = 'all', txFilterType = 'all';
// Compras no cartão viram UMA linha por compra (não uma por parcela), datada
// e valorada pela compra em si (não pela fatura) — é a visão "o que eu
// decidi gastar", separada da visão de fatura/parcela que continua existindo
// só dentro da aba Cartões. Ver PLANO.md seção 5-bis.
function txListForMonth(mKey){
  const plain = nonDeletedTx()
    .filter(t=> !(t.paymentMethod==='credito' && t.kind==='compra'))
    .filter(t=> t.date.startsWith(mKey));
  const cardRows = (DATA.purchases||[])
    .filter(p=> !p.deletedAt && p.date.startsWith(mKey))
    .map(p=>{
      const insts = nonDeletedTx().filter(t=>t.purchaseId===p.id);
      if(insts.length===0) return null; // todas as parcelas foram excluídas/canceladas
      return {
        id: insts[0].id, type:'saida', personId:p.personId, categoryId:p.categoryId,
        description:p.description, amount:p.amount, date:p.date,
        paymentMethod:'credito', cardId:p.cardId, purchaseId:p.id,
        installmentCount:p.installmentCount, isCardPurchase:true
      };
    }).filter(Boolean);
  return [...plain, ...cardRows];
}
function renderTransacoes(mKey){
  const people = getPeople();
  const monthTx = txListForMonth(mKey)
    .filter(t=> txFilterPerson==='all'||t.personId===txFilterPerson)
    .filter(t=> txFilterType==='all'||t.type===txFilterType)
    .sort((a,b)=> b.date.localeCompare(a.date));

  return `
    ${renderTipCard('transacoes')}
    <div class="section-head">
      <div class="sub" style="display:flex; gap:8px;">
        <select onchange="txFilterType=this.value; render()" style="width:120px;">
          <option value="all" ${txFilterType==='all'?'selected':''}>Tipo: Todos</option>
          <option value="entrada" ${txFilterType==='entrada'?'selected':''}>Entradas</option>
          <option value="saida" ${txFilterType==='saida'?'selected':''}>Saídas</option>
        </select>
        ${people.length>1 ? `
        <select onchange="txFilterPerson=this.value; render()" style="width:130px;">
          <option value="all" ${txFilterPerson==='all'?'selected':''}>Todos</option>
          ${people.map(p=>`<option value="${p.id}" ${txFilterPerson===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
        </select>` : ''}
      </div>
      <button class="btn" onclick="openTxForm()">+ Novo lançamento</button>
    </div>
    <div class="row-list list-grouped">
      ${monthTx.length===0 ? '<div class="empty"><span class="empty-title">Nada por aqui ainda</span>Registre o primeiro lançamento do mês — mesmo os pequenos contam.</div>' :
        monthTx.map(t=>{
          const card = t.cardId ? getCard(t.cardId) : null;
          const paymentBit = t.type==='saida' ? (
            card ? `· ${esc(card.name)}${t.installmentCount>1?` ${t.installmentCount}x`:''}` : `· ${paymentMethodLabel(t.paymentMethod)}`
          ) : '';
          return `
        <div class="item-row">
          <div class="item-left">
            <span class="item-tag ${t.type==='entrada'?'tag-entrada':'tag-saida'}">${t.type==='entrada'?'Entrada':'Saída'}</span>
            <div>
              <div class="item-desc">${esc(t.description)} ${t.isCardPurchase?'<span class="pending-badge" title="Compromete o limite agora; só sai da conta quando a fatura for paga">no cartão · ainda não debitado</span>':''}</div>
              <div class="item-meta"><span class="cat-chip"><span class="cat-dot" style="background:${categoryColor(t.categoryId)}"></span>${esc(categoryName(t.categoryId))}</span> ${people.length>1?'· '+esc(personName(t.personId)):''} · ${new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR')} ${paymentBit}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="item-amount" style="color:${t.type==='entrada'?'var(--verdigris)':(t.isCardPurchase?'var(--ink-soft)':'var(--garnet)')}">${t.type==='entrada'?'+':'-'}${fmt(t.amount)}</div>
            <button class="icon-btn" onclick="openTxForm('${t.id}')" aria-label="Editar">${icon('edit',15)}</button>
            <button class="icon-btn" onclick="removeTx('${t.id}')" aria-label="Excluir">${icon('x',15)}</button>
          </div>
        </div>`;
        }).join('')}
    </div>
  `;
}
function openTxForm(editId){
  const people = getPeople();
  const cards = activeCards();
  const editingTx = editId ? nonDeletedTx().find(t=>t.id===editId) : null;
  const editingPurchase = editingTx && editingTx.purchaseId ? (DATA.purchases||[]).find(p=>p.id===editingTx.purchaseId && !p.deletedAt) : null;

  if(editingPurchase){
    // Compra no cartão: só descrição/responsável/categoria podem mudar depois
    // de criada. Valor, cartão e parcelamento ficam travados — mexer neles
    // exigiria refazer o cálculo de todas as faturas já geradas; mais seguro
    // excluir e lançar de novo quando isso for realmente necessário (item 10).
    openModal(`
      <h3>Editar compra no cartão</h3>
      <div class="sub" style="margin-bottom:14px;">${esc(getCard(editingPurchase.cardId)?.name||'Cartão')} · ${fmt(editingPurchase.amount)} em ${editingPurchase.installmentCount}x. Valor, cartão e parcelamento não podem ser alterados — exclua e lance novamente se precisar mudar isso.</div>
      <div class="form-grid">
        <div class="field"><label>Responsável</label>
          <select id="tx-person">${people.map(p=>`<option value="${p.id}" ${p.id===editingPurchase.personId?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Categoria <button type="button" class="inline-link" onclick="openCategoryForm('saida','tx-category')">+ nova</button></label>
          <select id="tx-category">${categoryOptionsHtml('saida', editingPurchase.categoryId)}</select>
        </div>
      </div>
      <div class="form-grid full"><div class="field"><label>Descrição</label><input id="tx-desc" value="${esc(editingPurchase.description)}"></div></div>
      <input type="hidden" id="tx-edit-purchase-id" value="${editingPurchase.id}">
      <div class="error-msg" id="tx-error"></div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" onclick="saveTx()">Salvar</button>
      </div>
    `);
    return;
  }

  const t = editingTx;
  const type0 = t ? t.type : 'saida';
  openModal(`
    <h3>${t?'Editar lançamento':'Novo lançamento'}</h3>
    <input type="hidden" id="tx-edit-id" value="${t?t.id:''}">
    <div class="form-grid">
      <div class="field"><label>Tipo</label>
        <select id="tx-type" onchange="updateTxFormDynamic()">
          <option value="saida" ${type0==='saida'?'selected':''}>Saída</option>
          <option value="entrada" ${type0==='entrada'?'selected':''}>Entrada</option>
        </select>
      </div>
      <div class="field"><label>Responsável</label>
        <select id="tx-person">${people.map(p=>`<option value="${p.id}" ${t&&t.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <label>Categoria <button type="button" class="inline-link" id="tx-category-new" onclick="openCategoryForm('${type0}','tx-category')">+ nova</button></label>
        <select id="tx-category">${categoryOptionsHtml(type0, t?t.categoryId:null)}</select>
      </div>
      <div class="field"><label>Data</label><input type="date" id="tx-date" value="${t?t.date:dateStr(new Date())}"></div>
    </div>
    <div class="form-grid full"><div class="field"><label>Descrição</label><input id="tx-desc" value="${t?esc(t.description):''}" placeholder="Ex: Supermercado, Salário..."></div></div>
    <div class="form-grid full"><div class="field"><label>Valor (R$)</label><input type="number" step="0.01" id="tx-amount" value="${t?t.amount:''}" placeholder="0,00"></div></div>
    <div class="form-grid full" id="tx-payment-block">
      <div class="field"><label>Forma de pagamento</label>
        <select id="tx-payment" onchange="updateTxFormDynamic()">
          ${PAYMENT_METHODS.map(pm=>`<option value="${pm.id}" ${t&&t.paymentMethod===pm.id?'selected':''}>${pm.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-grid" id="tx-card-block" style="display:none;">
      <div class="field"><label>Cartão</label>
        <select id="tx-card">
          ${cards.length===0?'<option value="">Nenhum cartão ativo</option>':cards.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Parcelamento</label>
        <select id="tx-installments" onchange="updateTxInstallmentCustom()">
          ${INSTALLMENT_OPTIONS.map(n=>`<option value="${n}">${n===1?'À vista (1x)':n+'x'}</option>`).join('')}
          <option value="custom">Personalizado…</option>
        </select>
        <input type="number" min="1" max="60" id="tx-installments-custom" placeholder="Nº de parcelas" style="display:none; margin-top:6px;">
      </div>
    </div>
    <div class="sub" id="tx-no-card-hint" style="display:none; margin-top:-6px;">Nenhum cartão ativo cadastrado — vá em Cartões antes de lançar uma compra no crédito.</div>
    <div class="error-msg" id="tx-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="saveTx()">Salvar</button>
    </div>
  `);
  updateTxFormDynamic();
}
function updateTxFormDynamic(){
  const type = val('tx-type');
  const catSel = document.getElementById('tx-category');
  // Reconstrói as opções (mudar entrada/saída troca o universo de categorias
  // válidas), mas preserva a categoria já escolhida — esta função também
  // dispara ao trocar só a forma de pagamento, que não deveria "esquecer"
  // a categoria que a pessoa já tinha selecionado.
  if(catSel){
    const prevVal = catSel.value;
    catSel.innerHTML = categoryOptionsHtml(type, prevVal);
  }
  const link = document.getElementById('tx-category-new');
  if(link) link.setAttribute('onclick', `openCategoryForm('${type}','tx-category')`);

  const paymentBlock = document.getElementById('tx-payment-block');
  const cardBlock = document.getElementById('tx-card-block');
  const hint = document.getElementById('tx-no-card-hint');
  if(!paymentBlock) return; // modal de edição de compra não tem esses blocos
  if(type==='entrada'){
    paymentBlock.style.display='none';
    cardBlock.style.display='none';
    if(hint) hint.style.display='none';
    return;
  }
  paymentBlock.style.display='';
  const method = val('tx-payment');
  const showCard = method==='credito';
  cardBlock.style.display = showCard ? '' : 'none';
  if(hint) hint.style.display = (showCard && activeCards().length===0) ? '' : 'none';
}
function updateTxInstallmentCustom(){
  const custom = document.getElementById('tx-installments-custom');
  if(custom) custom.style.display = val('tx-installments')==='custom' ? '' : 'none';
}
function saveTx(){
  if(document.getElementById('tx-edit-purchase-id')) return saveTxEditPurchase(val('tx-edit-purchase-id'));

  const errEl = document.getElementById('tx-error');
  const editId = val('tx-edit-id') || null;
  const type = val('tx-type');
  const personId = val('tx-person');
  const categoryId = val('tx-category');
  const desc = val('tx-desc').trim();
  const amount = Number(val('tx-amount'));
  const dtStr = val('tx-date') || dateStr(new Date());
  const paymentMethod = type==='entrada' ? 'dinheiro' : (val('tx-payment')||'dinheiro');

  if(!desc){ if(errEl) errEl.textContent='Informe uma descrição.'; return; }
  if(isNaN(amount) || amount<=0){ if(errEl) errEl.textContent='Informe um valor maior que zero.'; return; }
  if(!categoryId){ if(errEl) errEl.textContent='Escolha uma categoria.'; return; }

  if(type==='saida' && paymentMethod==='credito'){
    const cardId = val('tx-card');
    if(!cardId){ if(errEl) errEl.textContent='Escolha um cartão (cadastre um antes de continuar, se necessário).'; return; }
    let n = val('tx-installments');
    n = n==='custom' ? Number(val('tx-installments-custom')) : Number(n);
    if(!Number.isInteger(n) || n<1 || n>60){ if(errEl) errEl.textContent='Informe uma quantidade de parcelas válida (1 a 60).'; return; }

    if(editId){
      // Uma transação simples virando compra no cartão: mais simples e seguro
      // excluir a antiga (soft-delete) e criar a compra do zero.
      softDeleteTx(editId, {silent:true});
    }
    createCardPurchase({cardId, personId, categoryId, description:desc, amount, date:dtStr, installmentCount:n});
    closeModal();
    return;
  }

  if(editId){
    const t = nonDeletedTx().find(x=>x.id===editId);
    if(!t){ closeModal(); return; }
    const before = {type:t.type, personId:t.personId, categoryId:t.categoryId, description:t.description, amount:t.amount, date:t.date, paymentMethod:t.paymentMethod};
    const after = {type, personId, categoryId, description:desc, amount, date:dtStr, paymentMethod};
    const changes = diffChanges(before, after, [
      {key:'type', label:'Tipo', fmt:v=>v==='entrada'?'Entrada':'Saída'},
      {key:'personId', label:'Responsável', fmt:v=>personName(v)},
      {key:'categoryId', label:'Categoria', fmt:v=>categoryName(v)},
      {key:'description', label:'Descrição'},
      {key:'amount', label:'Valor', fmt:v=>fmt(v)},
      {key:'date', label:'Data'},
      {key:'paymentMethod', label:'Forma de pagamento', fmt:v=>paymentMethodLabel(v)}
    ]);
    Object.assign(t, after);
    closeModal();
    persist();
    if(changes.length) logAudit('editou','transacoes','lancamento',t.id, `editou "${desc}"`, changes, {categoryId});
    return;
  }

  const newTx = {
    id:uid(), type, personId, categoryId, description:desc, amount, date:dtStr,
    paymentMethod, cardId:null, purchaseId:null, installmentNumber:null, installmentCount:null,
    invoiceMonthKey:null, kind:'compra', accountId:null, deletedAt:null
  };
  DATA.transactions.push(newTx);
  closeModal();
  persist();
  logAudit('criou','transacoes','lancamento', newTx.id,
    `criou ${type==='entrada'?'uma entrada':'uma saída'}: ${desc} (${fmt(amount)})`,
    null, {categoryId});
}
function saveTxEditPurchase(purchaseId){
  const purchase = (DATA.purchases||[]).find(p=>p.id===purchaseId && !p.deletedAt);
  const errEl = document.getElementById('tx-error');
  if(!purchase){ closeModal(); return; }
  const desc = val('tx-desc').trim();
  const personId = val('tx-person');
  const categoryId = val('tx-category');
  if(!desc){ if(errEl) errEl.textContent='Informe uma descrição.'; return; }

  const before = {description:purchase.description, personId:purchase.personId, categoryId:purchase.categoryId};
  const changes = diffChanges(before, {description:desc, personId, categoryId}, [
    {key:'description', label:'Descrição'},
    {key:'personId', label:'Responsável', fmt:v=>personName(v)},
    {key:'categoryId', label:'Categoria', fmt:v=>categoryName(v)}
  ]);

  purchase.description = desc;
  purchase.personId = personId;
  purchase.categoryId = categoryId;
  purchase.updated_at = nowIso();
  nonDeletedTx().filter(t=>t.purchaseId===purchaseId).forEach(t=>{
    t.description = desc; t.personId = personId; t.categoryId = categoryId;
  });

  closeModal();
  persist();
  if(changes.length) logAudit('editou','cartoes','compra',purchaseId, `editou a compra "${desc}"`, changes, {cardId:purchase.cardId, categoryId});
}
// Cria a compra (registro-pai) + N parcelas (transações), cada uma já
// atribuída à fatura correta pelo dia de fechamento do cartão (item 3/4).
function createCardPurchase({cardId, personId, categoryId, description, amount, date, installmentCount}){
  const card = getCard(cardId);
  if(!card) return;
  const purchaseId = uid();
  const cents = Math.round(Number(amount)*100);
  const baseCents = Math.floor(cents/installmentCount);
  let remainder = cents - baseCents*installmentCount;

  DATA.purchases.push({
    id:purchaseId, cardId, personId, categoryId, description, amount:Number(amount),
    date, installmentCount, created_at:nowIso(), updated_at:nowIso(), deletedAt:null
  });

  for(let i=0;i<installmentCount;i++){
    let instCents = baseCents;
    if(remainder>0){ instCents += 1; remainder -= 1; } // distribui o resto de centavos nas primeiras parcelas
    const invoiceMonthKey = invoiceMonthForInstallment(card, date, i);
    const due = invoiceDueDate(card, invoiceMonthKey);
    DATA.transactions.push({
      id:uid(), type:'saida', personId, categoryId, description,
      amount: instCents/100, date: dateStr(due),
      paymentMethod:'credito', cardId, purchaseId,
      installmentNumber:i+1, installmentCount, invoiceMonthKey,
      kind:'compra', accountId:null, deletedAt:null
    });
  }

  persist();
  const label = installmentCount>1 ? `${fmt(amount)} em ${installmentCount}x no ${card.name}` : `${fmt(amount)} no ${card.name}`;
  logAudit('criou','cartoes','compra', purchaseId, `criou a compra "${description}" — ${label}`, null, {cardId, categoryId});
}
function softDeleteTx(id, opts){
  opts = opts||{};
  const t = (DATA.transactions||[]).find(x=>x.id===id);
  if(!t) return;
  t.deletedAt = nowIso();
  if(!opts.silent) persist();
}
function removeTx(id){
  const t = nonDeletedTx().find(x=>x.id===id);
  if(!t) return;
  if(t.purchaseId){ removeCardPurchase(t.purchaseId); return; }
  confirmDialog(`Excluir "${t.description}"? Fica registrado na auditoria.`, ()=>{
    softDeleteTx(id);
    logAudit('excluiu','transacoes','lancamento', id, `excluiu "${t.description}" (${fmt(t.amount)})`, null, {categoryId:t.categoryId});
  }, {title:'Excluir lançamento', confirmLabel:'Excluir', danger:true});
}
// Cancela uma compra parcelada preservando o histórico já pago (item 10):
// parcelas cujas faturas já foram pagas nunca são apagadas.
function removeCardPurchase(purchaseId){
  const purchase = (DATA.purchases||[]).find(p=>p.id===purchaseId && !p.deletedAt);
  if(!purchase) return;
  const insts = nonDeletedTx().filter(t=>t.purchaseId===purchaseId);
  const paid = insts.filter(isInstallmentPaid);
  const unpaid = insts.filter(t=>!isInstallmentPaid(t));
  if(unpaid.length===0){
    alertDialog('Todas as parcelas dessa compra já foram pagas — não é possível cancelar. O histórico fica preservado na fatura.', {title:'Não é possível cancelar'});
    return;
  }
  const msg = paid.length>0
    ? `Cancelar as ${unpaid.length} parcela(s) ainda não pagas de "${purchase.description}"? As ${paid.length} já pagas continuam no histórico.`
    : `Cancelar a compra "${purchase.description}" (${purchase.installmentCount}x)? Isso remove todas as parcelas.`;
  confirmDialog(msg, ()=>{
    unpaid.forEach(t=>{ t.deletedAt = nowIso(); });
    if(paid.length===0) purchase.deletedAt = nowIso();
    purchase.updated_at = nowIso();

    persist();
    logAudit('excluiu','cartoes','compra', purchaseId, `cancelou ${paid.length>0?unpaid.length+' parcela(s) de ':''}"${purchase.description}"`, null, {cardId:purchase.cardId, categoryId:purchase.categoryId});
  }, {title:'Cancelar compra no cartão', confirmLabel:'Cancelar compra', danger:true});
}

// ---------------- Orçamentos ----------------
// Orçamento = quanto planejei gastar. Saída = quanto realmente gastei.
// A categoria é o elo entre os dois, então tudo aqui é calculado cruzando
// budgets e transactions pelo mesmo category_id.

// Filtros da tela (respeitados por indicadores, gráfico e tabela).
let budgetFilterCategory = 'all';
let budgetFilterStatus = 'all';   // all | dentro | acima | sem-lancamento
let budgetFilterView = 'ambos';   // ambos | orcado | realizado

function setBudgetFilter(field, value){
  if(field==='category') budgetFilterCategory = value;
  else if(field==='status') budgetFilterStatus = value;
  else if(field==='view') budgetFilterView = value;
  render();
}

// Monta as linhas de comparação Orçado x Realizado já com os filtros aplicados.
function buildBudgetRows(monthTx){
  const spentByCat = {};
  monthTx.filter(t=>t.type==='saida').forEach(t=>{
    spentByCat[t.categoryId] = (spentByCat[t.categoryId]||0) + Number(t.amount);
  });

  let rows = DATA.budgets.map(b=>{
    const spent = spentByCat[b.categoryId] || 0;
    const saldo = b.amount - spent;
    const pct = b.amount>0 ? (spent/b.amount)*100 : 0;
    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      name: categoryName(b.categoryId),
      color: categoryColor(b.categoryId),
      orcado: b.amount,
      realizado: spent,
      saldo,
      pct,
      over: spent > b.amount
    };
  });

  if(budgetFilterCategory!=='all') rows = rows.filter(r=>r.categoryId===budgetFilterCategory);
  if(budgetFilterStatus==='acima') rows = rows.filter(r=>r.over);
  else if(budgetFilterStatus==='dentro') rows = rows.filter(r=>!r.over);
  else if(budgetFilterStatus==='sem-lancamento') rows = rows.filter(r=>r.realizado===0);

  return rows.sort((a,b)=>b.orcado-a.orcado);
}

// Gráfico de barras agrupadas: para cada categoria, uma barra do planejado
// e outra do realizado, na mesma escala, lado a lado.
function renderBudgetChart(rows){
  if(rows.length===0) return '';
  const max = Math.max(...rows.map(r=>Math.max(r.orcado, r.realizado)), 1);
  const showOrcado = budgetFilterView==='ambos' || budgetFilterView==='orcado';
  const showRealizado = budgetFilterView==='ambos' || budgetFilterView==='realizado';

  return `
    <div class="card" style="margin-bottom:24px;">
      <div class="section-head" style="margin-bottom:6px;">
        <div><h2 style="font-size:16.5px;">Orçado × Realizado</h2><div class="sub">Comparação entre o que você planejou e o que de fato gastou.</div></div>
        <div class="chart-legend">
          ${showOrcado?'<span class="chart-legend-item"><span class="chart-swatch swatch-planned"></span>Orçado</span>':''}
          ${showRealizado?'<span class="chart-legend-item"><span class="chart-swatch swatch-actual"></span>Realizado</span>':''}
        </div>
      </div>
      <div class="bar-chart">
        ${rows.map(r=>`
          <div class="bar-group">
            <div class="bar-group-head">
              <span class="bar-group-name"><span class="cat-dot" style="background:${r.color}"></span>${esc(r.name)}</span>
              <span class="bar-group-delta ${r.over?'is-over':''}">${r.over?'+':''}${fmt(Math.abs(r.saldo))} ${r.over?'acima':'disponível'}</span>
            </div>
            ${showOrcado?`
            <div class="bar-line">
              <div class="bar-track"><div class="bar-fill bar-planned" style="width:${(r.orcado/max)*100}%"></div></div>
              <span class="bar-value">${fmt(r.orcado)}</span>
            </div>`:''}
            ${showRealizado?`
            <div class="bar-line">
              <div class="bar-track"><div class="bar-fill bar-actual ${r.over?'is-over':''}" style="width:${(r.realizado/max)*100}%; ${r.over?'':`background:${r.color}`}"></div></div>
              <span class="bar-value">${fmt(r.realizado)}</span>
            </div>`:''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderOrcamentos(mKey){
  const monthTx = nonDeletedTx().filter(t=>t.date.startsWith(mKey)).filter(isCategoryRelevant);
  const rows = buildBudgetRows(monthTx);

  const totalOrcado = rows.reduce((s,r)=>s+r.orcado,0);
  const totalRealizado = rows.reduce((s,r)=>s+r.realizado,0);
  const saldoDisponivel = totalOrcado - totalRealizado;
  const acimaCount = rows.filter(r=>r.over).length;
  const pctUsado = totalOrcado>0 ? Math.round((totalRealizado/totalOrcado)*100) : 0;

  const budgetedIds = DATA.budgets.map(b=>b.categoryId);
  const available = activeCategories('saida').filter(c=>!budgetedIds.includes(c.id));
  const hasAnyBudget = DATA.budgets.length>0;

  return `
    ${renderTipCard('orcamentos')}

    <div class="section-head" style="margin-bottom:18px;">
      <div>
        <h2>Orçamentos</h2>
        <div class="sub">Planeje quanto pretende gastar em cada categoria.</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn secondary" onclick="openCategoryManager()">Gerenciar categorias</button>
        <button class="btn secondary" onclick="openCategoryForm('saida')">+ Nova categoria</button>
        <button class="btn" onclick="openBudgetForm()" ${available.length===0?'disabled':''}>+ Novo orçamento</button>
      </div>
    </div>

    <div class="grid grid-4" style="margin-bottom:20px;">
      <div class="card"><div class="stat-label">Total orçado</div><div class="stat-value">${fmt(totalOrcado)}</div></div>
      <div class="card"><div class="stat-label">Total realizado</div><div class="stat-value" style="color:${totalRealizado>totalOrcado&&totalOrcado>0?'var(--garnet)':'var(--ink)'}">${fmt(totalRealizado)}</div></div>
      <div class="card"><div class="stat-label">Saldo disponível</div><div class="stat-value" style="color:${saldoDisponivel<0?'var(--garnet)':'var(--verdigris)'}">${fmt(saldoDisponivel)}</div></div>
      <div class="card">
        <div class="stat-label">Orçamento utilizado</div>
        <div class="stat-value" style="color:${pctUsado>100?'var(--garnet)':'var(--ink)'}">${pctUsado}%</div>
        <div class="progress-track" style="margin-top:8px;"><div class="progress-fill" style="width:${Math.min(100,pctUsado)}%; background:${pctUsado>100?'var(--garnet)':(pctUsado>=80?'var(--brass)':'var(--verdigris)')};"></div></div>
        <div class="item-meta" style="margin-top:6px;">${acimaCount>0?`${acimaCount} categoria(s) acima do limite`:'Nenhuma categoria estourada'}</div>
      </div>
    </div>

    ${hasAnyBudget ? `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Categoria</label>
        <select onchange="setBudgetFilter('category', this.value)">
          <option value="all" ${budgetFilterCategory==='all'?'selected':''}>Todas</option>
          ${DATA.budgets.map(b=>`<option value="${b.categoryId}" ${budgetFilterCategory===b.categoryId?'selected':''}>${esc(categoryName(b.categoryId))}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Situação</label>
        <select onchange="setBudgetFilter('status', this.value)">
          <option value="all" ${budgetFilterStatus==='all'?'selected':''}>Todas</option>
          <option value="dentro" ${budgetFilterStatus==='dentro'?'selected':''}>Dentro do limite</option>
          <option value="acima" ${budgetFilterStatus==='acima'?'selected':''}>Acima do limite</option>
          <option value="sem-lancamento" ${budgetFilterStatus==='sem-lancamento'?'selected':''}>Sem lançamentos</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Exibir</label>
        <select onchange="setBudgetFilter('view', this.value)">
          <option value="ambos" ${budgetFilterView==='ambos'?'selected':''}>Orçado e realizado</option>
          <option value="orcado" ${budgetFilterView==='orcado'?'selected':''}>Somente orçado</option>
          <option value="realizado" ${budgetFilterView==='realizado'?'selected':''}>Somente realizado</option>
        </select>
      </div>
      <div class="filter-note">Período: ${monthLabel(CURRENT_MONTH)} — use as setas no topo para trocar de mês.</div>
    </div>` : ''}

    ${renderBudgetChart(rows)}

    ${!hasAnyBudget
      ? '<div class="empty"><span class="empty-title">Nenhum teto ainda</span>Comece com uma categoria só — "Alimentação" costuma ser um bom primeiro teste.</div>'
      : (rows.length===0
        ? '<div class="empty"><span class="empty-title">Nada corresponde a esses filtros</span>Ajuste os filtros acima para ver seus orçamentos.</div>'
        : `
      <div class="budget-table">
        <div class="budget-row budget-head">
          <span>Categoria</span><span>Orçamento</span><span>Gasto atual</span><span>Saldo</span><span></span>
        </div>
        ${rows.map(r=>`
          <div class="budget-row ${r.over?'is-over':''}">
            <span class="budget-cat"><span class="cat-dot" style="background:${r.color}"></span>${esc(r.name)}${r.over?'<span class="over-tag">acima do limite</span>':''}</span>
            <span class="budget-num">${fmt(r.orcado)}</span>
            <span class="budget-num">${fmt(r.realizado)}</span>
            <span class="budget-num ${r.saldo<0?'neg':'pos'}">${fmt(r.saldo)}</span>
            <span class="budget-actions">
              <button class="icon-btn" title="Editar" onclick="openBudgetForm('${r.budgetId}')">✎</button>
              <button class="icon-btn" title="Remover" onclick="removeBudget('${r.budgetId}')">✕</button>
            </span>
          </div>
        `).join('')}
      </div>`)}
  `;
}

function openBudgetForm(budgetId){
  const editing = budgetId ? DATA.budgets.find(b=>b.id===budgetId) : null;
  const budgetedIds = DATA.budgets.filter(b=>!editing||b.id!==editing.id).map(b=>b.categoryId);
  const available = activeCategories('saida').filter(c=>!budgetedIds.includes(c.id));
  if(!editing && available.length===0) return;

  openModal(`
    <h3>${editing?'Editar orçamento':'Novo orçamento'}</h3>
    <div class="form-grid full">
      <div class="field">
        <label>Categoria <button type="button" class="inline-link" onclick="openCategoryForm('saida','budget-category')">+ nova</button></label>
        <select id="budget-category">${available.map(c=>`<option value="${c.id}" ${editing&&editing.categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-grid full"><div class="field"><label>Valor limite mensal (R$)</label><input type="number" step="0.01" id="budget-amount" placeholder="Ex: 1000" value="${editing?editing.amount:''}"></div></div>
    <div class="error-msg" id="budget-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="saveBudget(${editing?`'${editing.id}'`:'null'})">Salvar</button>
    </div>
  `);
}
function saveBudget(budgetId){
  const categoryId = val('budget-category');
  const amount = Number(val('budget-amount'));
  const errEl = document.getElementById('budget-error');
  if(!categoryId){ if(errEl) errEl.textContent='Escolha uma categoria.'; return; }
  if(isNaN(amount) || amount<=0){ if(errEl) errEl.textContent='Informe um valor limite maior que zero.'; return; }
  if(budgetId){
    const before = DATA.budgets.find(b=>b.id===budgetId);
    const changes = before ? diffChanges(before, {categoryId, amount}, [
      {key:'categoryId', label:'Categoria', fmt:v=>categoryName(v)},
      {key:'amount', label:'Valor limite', fmt:v=>fmt(v)}
    ]) : [];
    DATA.budgets = DATA.budgets.map(b=> b.id===budgetId ? {...b, categoryId, amount} : b);
    closeModal(); persist();
    if(changes.length) logAudit('editou','orcamentos','orcamento', budgetId, `editou o orçamento de ${categoryName(categoryId)}`, changes, {categoryId});
  } else {
    const newBudget = {id:uid(), categoryId, amount};
    DATA.budgets.push(newBudget);
    closeModal(); persist();
    logAudit('criou','orcamentos','orcamento', newBudget.id, `criou o orçamento de ${categoryName(categoryId)} (${fmt(amount)})`, null, {categoryId});
  }
}
function removeBudget(id){
  const b = DATA.budgets.find(x=>x.id===id);
  DATA.budgets = DATA.budgets.filter(x=>x.id!==id);
  persist();
  if(b) logAudit('excluiu','orcamentos','orcamento', id, `excluiu o orçamento de ${categoryName(b.categoryId)}`, null, {categoryId:b.categoryId});
}

// ---------------- Cadastro de categorias ----------------
// A cor não é escolhida pelo usuário: o sistema atribui automaticamente um
// tom distinto dos já usados e o mantém fixo para aquela categoria em todo
// o app (orçamentos, saídas, gráficos e filtros).
function openCategoryForm(kind, targetSelectId, categoryId){
  const editing = categoryId ? getCategory(categoryId) : null;
  const k = editing ? editing.kind : (kind || 'saida');
  openModal(`
    <h3>${editing?'Editar categoria':'Nova categoria'}</h3>
    <div class="form-grid full"><div class="field"><label>Nome da categoria</label><input id="cat-name" placeholder="Ex: Marketing, Igreja, Estudos..." value="${editing?esc(editing.name):''}"></div></div>
    <div class="form-grid full"><div class="field"><label>Descrição (opcional)</label><input id="cat-desc" placeholder="Para que serve essa categoria" value="${editing?esc(editing.description||''):''}"></div></div>
    ${editing?`
    <div class="form-grid full"><div class="field"><label>Status</label>
      <select id="cat-status">
        <option value="ativa" ${editing.status==='ativa'?'selected':''}>Ativa</option>
        <option value="inativa" ${editing.status!=='ativa'?'selected':''}>Inativa</option>
      </select>
    </div></div>`:''}
    <div class="cat-color-note">
      <span class="cat-dot" style="background:${editing?editing.color:pickCategoryColor(allCategories())}"></span>
      A cor é definida automaticamente pelo sistema e acompanha essa categoria em todo o app.
    </div>
    <div class="error-msg" id="cat-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="saveCategory('${k}', ${targetSelectId?`'${targetSelectId}'`:'null'}, ${editing?`'${editing.id}'`:'null'})">Salvar</button>
    </div>
  `, {stack: !!targetSelectId});
}
function saveCategory(kind, targetSelectId, categoryId){
  const name = val('cat-name').trim();
  const description = val('cat-desc').trim();
  const errEl = document.getElementById('cat-error');
  if(!name){ if(errEl) errEl.textContent='Informe o nome da categoria.'; return; }
  const duplicate = allCategories(kind).find(c=>c.name.toLowerCase()===name.toLowerCase() && c.id!==categoryId);
  if(duplicate){ if(errEl) errEl.textContent='Já existe uma categoria com esse nome.'; return; }

  let newId = categoryId;
  if(categoryId){
    const status = val('cat-status') || 'ativa';
    const before = getCategory(categoryId);
    const changes = before ? diffChanges(before, {name, description, status}, [
      {key:'name', label:'Nome'}, {key:'description', label:'Descrição'},
      {key:'status', label:'Status', fmt:v=>v==='ativa'?'Ativa':'Inativa'}
    ]) : [];
    DATA.categories = DATA.categories.map(c=> c.id===categoryId ? {...c, name, description, status, updated_at:nowIso()} : c);
    if(changes.length) logAudit('editou','categorias','categoria', categoryId, `editou a categoria "${name}"`, changes, {categoryId});
  } else {
    const created = makeCategory(name, kind, DATA.categories, description);
    DATA.categories.push(created);
    newId = created.id;
    logAudit('criou','categorias','categoria', newId, `criou a categoria "${name}"`, null, {categoryId:newId});
  }

  closeModal();
  saveData();
  // Se veio de um formulário aberto, repõe as opções e já deixa a nova selecionada.
  if(targetSelectId){
    const sel = document.getElementById(targetSelectId);
    if(sel){
      sel.innerHTML = categoryOptionsHtml(kind, newId);
      sel.value = newId;
      return;
    }
  }
  render();
}

function openCategoryManager(){
  const rows = allCategories().slice().sort((a,b)=>{
    if(a.kind!==b.kind) return a.kind==='saida'?-1:1;
    return a.name.localeCompare(b.name,'pt-BR');
  });
  openModal(`
    <h3>Categorias</h3>
    <div class="sub" style="margin-bottom:14px;">As mesmas categorias valem para Saídas e Orçamentos. Categorias com lançamentos não são apagadas — apenas desativadas, preservando o histórico.</div>
    <div class="cat-manager">
      ${rows.map(c=>{
        const used = countCategoryUsage(c.id);
        return `
        <div class="cat-manager-row">
          <span class="cat-manager-name">
            <span class="cat-dot" style="background:${c.color}"></span>
            <span>
              ${esc(c.name)}${c.status!=='ativa'?'<span class="inactive-tag">inativa</span>':''}
              <span class="cat-manager-meta">${c.kind==='entrada'?'entrada':'saída'} · ${used} lançamento(s)</span>
            </span>
          </span>
          <span class="cat-manager-actions">
            <button class="icon-btn" title="Editar" onclick="openCategoryForm(null,null,'${c.id}')">✎</button>
            ${c.status==='ativa'
              ? `<button class="icon-btn" title="Desativar" onclick="setCategoryStatus('${c.id}','inativa')">⦸</button>`
              : `<button class="icon-btn" title="Reativar" onclick="setCategoryStatus('${c.id}','ativa')">↺</button>`}
            ${used===0 ? `<button class="icon-btn" title="Excluir" onclick="deleteCategory('${c.id}')">✕</button>` : ''}
          </span>
        </div>`;
      }).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Fechar</button>
      <button class="btn" onclick="openCategoryForm('saida')">+ Nova categoria</button>
    </div>
  `);
}
function countCategoryUsage(id){
  const t = nonDeletedTx().filter(x=>x.categoryId===id).length;
  const b = DATA.budgets.filter(x=>x.categoryId===id).length;
  const i = DATA.installments.filter(x=>x.categoryId===id).length;
  return t + b + i;
}
function setCategoryStatus(id, status){
  const cat = getCategory(id);
  DATA.categories = DATA.categories.map(c=> c.id===id ? {...c, status, updated_at:nowIso()} : c);
  saveData();
  openCategoryManager();
  render();
  if(cat) logAudit(status==='ativa'?'ativou':'desativou','categorias','categoria', id, `${status==='ativa'?'reativou':'desativou'} a categoria "${cat.name}"`, null, {categoryId:id});
}
// Só permite exclusão física quando não há nenhum vínculo. Havendo histórico,
// o caminho é a desativação (soft delete).
function deleteCategory(id){
  if(countCategoryUsage(id)>0) return;
  confirmDialog('Excluir esta categoria? Ela não possui lançamentos vinculados.', ()=>{
    DATA.categories = DATA.categories.filter(c=>c.id!==id);
    saveData();
    openCategoryManager();
    render();
  }, {title:'Excluir categoria', confirmLabel:'Excluir', danger:true});
}

// ---------------- Parcelas ----------------
function renderParcelas(){
  const people = getPeople();
  const ativas = DATA.installments.filter(i=>i.paid<i.count).length;
  return `
    ${renderTipCard('parcelas')}
    <div class="section-head">
      <div class="sub">Compras parceladas em andamento — ${ativas} ativas</div>
      <button class="btn" onclick="openInstallmentForm()">+ Nova parcela</button>
    </div>
    <div class="row-list">
      ${DATA.installments.length===0 ? '<div class="empty"><span class="empty-title">Nenhuma parcela cadastrada</span>Cadastre suas compras parceladas pra ver o compromisso total dos próximos meses.</div>' :
        DATA.installments.map(inst=>{
          const pct = Math.round((inst.paid/inst.count)*100);
          const done = inst.paid>=inst.count;
          return `
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
              <div>
                <div class="item-desc">${esc(inst.description)} ${done?'<span style="color:var(--verdigris); font-size:12px;">· quitado</span>':''}</div>
                <div class="item-meta">${people.length>1?esc(personName(inst.personId))+' · ':''}<span class="cat-chip"><span class="cat-dot" style="background:${categoryColor(inst.categoryId)}"></span>${esc(categoryName(inst.categoryId))}</span> · ${inst.paid}/${inst.count} parcelas de ${fmt(inst.monthlyAmount)}</div>
              </div>
              <div style="display:flex; gap:6px; align-items:flex-start;">
                ${!done?`<button class="btn small" onclick="markInstallmentPaid('${inst.id}')">Marcar paga</button>`:''}
                ${inst.paid>0?`<button class="btn secondary small" onclick="undoInstallmentPaid('${inst.id}')">Desfazer</button>`:''}
                <button class="btn danger" onclick="removeInstallment('${inst.id}')">Excluir</button>
              </div>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="item-meta" style="margin-top:6px;">Total: ${fmt(inst.totalAmount)} · Restante: ${fmt(inst.monthlyAmount*(inst.count-inst.paid))}</div>
          </div>`;
        }).join('')}
    </div>
  `;
}
function openInstallmentForm(){
  const people = getPeople();
  openModal(`
    <h3>Nova compra parcelada</h3>
    <div class="form-grid full"><div class="field"><label>Descrição</label><input id="inst-desc" placeholder="Ex: Notebook, Móveis..."></div></div>
    <div class="form-grid">
      ${people.length>1?`<div class="field"><label>Responsável</label><select id="inst-person">${people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`:`<input type="hidden" id="inst-person" value="${people[0]?.id||'p1'}">`}
      <div class="field"><label>Categoria <button type="button" class="inline-link" onclick="openCategoryForm('saida','inst-category')">+ nova</button></label><select id="inst-category">${categoryOptionsHtml('saida')}</select></div>
    </div>
    <div class="form-grid cols-3">
      <div class="field"><label>Valor total (R$)</label><input type="number" step="0.01" id="inst-total"></div>
      <div class="field"><label>Nº de parcelas</label><input type="number" min="1" id="inst-count" value="2"></div>
      <div class="field"><label>1º vencimento</label><input type="date" id="inst-date" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="error-msg" id="inst-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="addInstallment()">Salvar</button>
    </div>
  `);
}
function addInstallment(){
  const desc = val('inst-desc').trim();
  const total = Number(val('inst-total'));
  const count = Math.floor(Number(val('inst-count')));
  const errEl = document.getElementById('inst-error');
  if(!desc){ if(errEl) errEl.textContent='Informe uma descrição.'; return; }
  if(isNaN(total) || total<=0){ if(errEl) errEl.textContent='O valor total precisa ser maior que zero.'; return; }
  if(isNaN(count) || count<=0){ if(errEl) errEl.textContent='O número de parcelas precisa ser pelo menos 1.'; return; }
  const monthlyAmount = total/count;
  const personEl = document.getElementById('inst-person');
  const categoryId = val('inst-category');
  const newInst = {id:uid(), description:desc, personId: personEl?personEl.value:'p1', totalAmount:total, count, paid:0, monthlyAmount, firstDueDate:val('inst-date'), categoryId};
  DATA.installments.push(newInst);
  closeModal(); persist();
  logAudit('criou','parcelas','parcelamento', newInst.id, `criou o parcelamento "${desc}" (${count}x de ${fmt(monthlyAmount)})`, null, {categoryId});
}
function markInstallmentPaid(id){
  const inst = DATA.installments.find(i=>i.id===id);
  if(!inst) return;
  DATA.installments = DATA.installments.map(i=>i.id===id?{...i, paid:Math.min(i.paid+1,i.count)}:i);
  persist();
  logAudit('pagou','parcelas','parcelamento', id, `marcou uma parcela de "${inst.description}" como paga`, null, {categoryId:inst.categoryId});
}
function undoInstallmentPaid(id){
  const inst = DATA.installments.find(i=>i.id===id);
  if(!inst) return;
  DATA.installments = DATA.installments.map(i=>i.id===id?{...i, paid:Math.max(i.paid-1,0)}:i);
  persist();
  logAudit('estornou','parcelas','parcelamento', id, `desfez o pagamento de uma parcela de "${inst.description}"`, null, {categoryId:inst.categoryId});
}
function removeInstallment(id){
  const inst = DATA.installments.find(i=>i.id===id);
  if(!inst) return;
  confirmDialog(`Cancelar o parcelamento "${inst.description}"?`, ()=>{
    DATA.installments = DATA.installments.filter(i=>i.id!==id);
    persist();
    logAudit('excluiu','parcelas','parcelamento', id, `cancelou o parcelamento "${inst.description}"`, null, {categoryId:inst.categoryId});
  }, {title:'Cancelar parcelamento', confirmLabel:'Cancelar parcelamento', danger:true});
}

// ---------------- Cartão ----------------
function renderCartao(mKey){
  const people = getPeople();
  const cards = DATA.cards||[];
  return `
    ${renderFeedbackBanner()}
    ${renderTipCard('cartao')}
    <div class="section-head">
      <div class="sub">Um painel por cartão — a fatura é sempre calculada a partir dos lançamentos, nunca digitada.</div>
      <div style="display:flex; gap:8px;">
        <button class="btn secondary" onclick="openAccountsManager()">${icon('wallet',15)} Contas</button>
        <button class="btn" onclick="openCardForm()">+ Novo cartão</button>
      </div>
    </div>
    <div class="grid grid-2">
      ${cards.length===0?'<div class="empty"><span class="empty-title">Nenhum cartão cadastrado</span>Cadastre um cartão pra começar a lançar compras no crédito com fatura automática.</div>':
        cards.map(card=>renderCardPanelTile(card)).join('')}
    </div>
  `;
}
function renderCardPanelTile(card){
  const people = getPeople();
  const used = cardUsedLimit(card.id);
  const avail = cardAvailableLimit(card.id);
  const pct = card.limit>0 ? Math.min(100, Math.round((used/card.limit)*100)) : 0;
  const {currentKey, nextKey} = currentAndNextInvoice(card);
  const curStatus = invoiceStatus(card, currentKey);
  const curTotal = invoiceTotal(card.id, currentKey);
  const nextTotal = invoiceTotal(card.id, nextKey);
  const inactive = card.status!=='ativa';
  return `
    <div class="card card-panel ${inactive?'card-inactive':''}" style="border-left:4px solid ${card.color||'#9C8F7A'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <div class="item-desc">${esc(card.name)} ${inactive?'<span class="over-tag">inativo</span>':''}</div>
          <div class="item-meta">${people.length>1?esc(personName(card.personId))+' · ':''}fecha dia ${card.closingDay} · vence dia ${card.dueDay}</div>
        </div>
        <button class="icon-btn" onclick="openCardForm('${card.id}')" aria-label="Editar cartão">${icon('edit',15)}</button>
      </div>
      <div style="margin-top:14px;">
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%; background:${pct>=90?'var(--garnet)':(pct>=70?'var(--brass)':'var(--verdigris)')};"></div></div>
        <div class="item-meta" style="margin-top:5px; display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <span>Limite ${fmt(card.limit)}</span>
          <span>Usado ${fmt(used)}</span>
          <span>Disponível ${fmt(avail)}</span>
        </div>
      </div>
      <div class="grid" style="margin-top:14px; gap:8px;">
        <button class="btn secondary small" style="justify-content:space-between; display:flex;" onclick="openInvoiceDetail('${card.id}','${currentKey}')">
          <span>Fatura atual · ${monthLabel(monthKeyToDate(currentKey))}</span>
          <span><strong>${fmt(curTotal)}</strong> · ${INVOICE_STATUS_LABEL[curStatus]}</span>
        </button>
        <button class="btn secondary small" style="justify-content:space-between; display:flex;" onclick="openInvoiceDetail('${card.id}','${nextKey}')">
          <span>Próxima fatura · ${monthLabel(monthKeyToDate(nextKey))}</span>
          <span>${fmt(nextTotal)}</span>
        </button>
      </div>
    </div>
  `;
}
function openCardForm(editId){
  const people = getPeople();
  const card = editId ? getCard(editId) : null;
  openModal(`
    <h3>${card?'Editar cartão':'Novo cartão'}</h3>
    <input type="hidden" id="card-edit-id" value="${card?card.id:''}">
    <div class="form-grid full"><div class="field"><label>Nome do cartão</label><input id="card-name" value="${card?esc(card.name):''}" placeholder="Ex: Nubank, Inter..."></div></div>
    <div class="form-grid cols-3">
      ${people.length>1?`<div class="field"><label>Responsável</label><select id="card-person">${people.map(p=>`<option value="${p.id}" ${card&&card.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>`:`<input type="hidden" id="card-person" value="${people[0]?.id||'p1'}">`}
      <div class="field"><label>Dia fechamento</label><input type="number" min="1" max="31" id="card-closing" value="${card?card.closingDay:20}"></div>
      <div class="field"><label>Dia vencimento</label><input type="number" min="1" max="31" id="card-due" value="${card?card.dueDay:27}"></div>
    </div>
    <div class="form-grid full"><div class="field"><label>Limite (R$)</label><input type="number" step="0.01" id="card-limit" value="${card?card.limit:''}" placeholder="Ex: 2500"></div></div>
    ${card?`<div class="form-grid full"><div class="field"><label>Status</label>
      <select id="card-status">
        <option value="ativa" ${card.status==='ativa'?'selected':''}>Ativo</option>
        <option value="inativa" ${card.status==='inativa'?'selected':''}>Inativo</option>
      </select>
    </div></div>`:''}
    <div class="error-msg" id="card-error"></div>
    <div class="modal-actions">
      ${card?`<button class="btn danger" onclick="removeCard('${card.id}')">Excluir</button>`:''}
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="saveCard()">Salvar</button>
    </div>
  `);
}
function saveCard(){
  const errEl = document.getElementById('card-error');
  const name = val('card-name').trim();
  const closingDay = Number(val('card-closing'));
  const dueDay = Number(val('card-due'));
  const limit = Number(val('card-limit'))||0;
  if(!name){ if(errEl) errEl.textContent='Informe o nome do cartão.'; return; }
  if(!closingDay || closingDay<1 || closingDay>31 || !dueDay || dueDay<1 || dueDay>31){
    if(errEl) errEl.textContent='Informe dias de fechamento e vencimento válidos (1 a 31).'; return;
  }
  const personEl = document.getElementById('card-person');
  const personId = personEl ? personEl.value : (getPeople()[0]?.id||'p1');
  const editId = val('card-edit-id');

  if(editId){
    const card = getCard(editId);
    if(!card){ closeModal(); return; }
    const before = {name:card.name, closingDay:card.closingDay, dueDay:card.dueDay, limit:card.limit, status:card.status};
    const statusEl = document.getElementById('card-status');
    const after = {name, closingDay, dueDay, limit, status: statusEl?statusEl.value:card.status};
    const changes = diffChanges(before, after, [
      {key:'name', label:'Nome'},
      {key:'closingDay', label:'Dia de fechamento'},
      {key:'dueDay', label:'Dia de vencimento'},
      {key:'limit', label:'Limite', fmt:v=>fmt(v)},
      {key:'status', label:'Status', fmt:v=>v==='ativa'?'Ativo':'Inativo'}
    ]);
    Object.assign(card, after, {personId, updated_at:nowIso()});
    closeModal();
    persist();
    if(changes.length) logAudit('editou','cartoes','cartao',card.id, `editou o cartão "${name}"`, changes, {cardId:card.id});
    return;
  }

  const newCard = {
    id:uid(), name, personId, closingDay, dueDay, limit, status:'ativa',
    color: pickCategoryColor(DATA.cards), created_at:nowIso(), updated_at:nowIso()
  };
  DATA.cards.push(newCard);
  closeModal();
  persist();
  logAudit('criou','cartoes','cartao', newCard.id, `cadastrou o cartão "${name}"`, null, {cardId:newCard.id});
}
function removeCard(id){
  const card = getCard(id);
  if(!card) return;
  const hasUsage = (DATA.purchases||[]).some(p=>p.cardId===id && !p.deletedAt);
  if(hasUsage){
    confirmDialog(`"${card.name}" já tem compras lançadas. Em vez de excluir, o cartão vai ser marcado como inativo (o histórico continua intacto). Continuar?`, ()=>{
      card.status = 'inativa';
      card.updated_at = nowIso();
      closeModal();
      persist();
      logAudit('desativou','cartoes','cartao', id, `desativou o cartão "${card.name}"`, null, {cardId:id});
    }, {title:'Desativar cartão', confirmLabel:'Desativar'});
    return;
  }
  confirmDialog(`Excluir o cartão "${card.name}"?`, ()=>{
    DATA.cards = DATA.cards.filter(c=>c.id!==id);
    closeModal();
    persist();
    logAudit('excluiu','cartoes','cartao', id, `excluiu o cartão "${card.name}"`, null, {cardId:id});
  }, {title:'Excluir cartão', confirmLabel:'Excluir', danger:true});
}

// ---------------- Detalhe e pagamento de fatura ----------------
function openInvoiceDetail(cardId, mKey){
  const card = getCard(cardId);
  if(!card) return;
  const people = getPeople();
  const items = cardTransactionsForMonth(cardId, mKey).sort((a,b)=>a.date.localeCompare(b.date));
  const total = items.reduce((s,t)=>s+Number(t.amount),0);
  const status = invoiceStatus(card, mKey);
  const rec = invoiceRecord(cardId, mKey);
  const early = !rec.paid && isEarlyInvoicePayment(card, mKey);

  openModal(`
    <h3>Fatura ${esc(card.name)} · ${monthLabel(monthKeyToDate(mKey))}</h3>
    <div class="sub" style="margin-bottom:4px;">Fecha dia ${card.closingDay} · vence dia ${card.dueDay} · <span class="invoice-badge invoice-${status}">${INVOICE_STATUS_LABEL[status]}</span></div>
    <div class="stat-hero" style="font-size:26px; margin:10px 0 16px;">${fmt(total)}</div>
    <div class="row-list list-grouped" style="max-height:320px; overflow-y:auto;">
      ${items.length===0?'<div class="empty"><span class="empty-title">Nenhum lançamento nesta fatura</span></div>':
        items.map(t=>`
        <div class="item-row">
          <div class="item-left">
            <div>
              <div class="item-desc">${esc(t.description)} ${t.installmentCount>1?`<span class="over-tag" style="background:var(--brass-tint); color:var(--brass-deep);">${t.installmentNumber}/${t.installmentCount}</span>`:''}</div>
              <div class="item-meta"><span class="cat-chip"><span class="cat-dot" style="background:${categoryColor(t.categoryId)}"></span>${esc(categoryName(t.categoryId))}</span> ${people.length>1?'· '+esc(personName(t.personId)):''} · ${new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
          <div class="item-amount" style="color:var(--garnet)">${fmt(t.amount)}</div>
        </div>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Fechar</button>
      ${rec.paid
        ? `<button class="btn secondary" onclick="undoInvoicePayment('${cardId}','${mKey}')">Desmarcar como paga</button>`
        : `<button class="btn" onclick="openPayInvoiceModal('${cardId}','${mKey}')" ${total<=0?'disabled':''}>${early?'Adiantar fatura':'Marcar como paga'}</button>`}
    </div>
  `);
}
function openPayInvoiceModal(cardId, mKey){
  const card = getCard(cardId);
  const total = invoiceTotal(cardId, mKey);
  const accounts = activeAccounts();
  const early = isEarlyInvoicePayment(card, mKey);
  openModal(`
    <h3>${early?'Adiantar':'Pagar'} fatura ${esc(card.name)}</h3>
    <div class="sub" style="margin-bottom:14px;">${early
      ? `Isso registra a saída real de ${fmt(total)} hoje, antes do vencimento (${invoiceDueDate(card,mKey).toLocaleDateString('pt-BR')}) — o gasto passa a contar no mês em que você está adiantando, não no mês original da fatura.`
      : `Isso registra a saída real de ${fmt(total)} na conta escolhida — é o único momento em que essa compra afeta seu saldo bancário.`}</div>
    <div class="form-grid full">
      <div class="field"><label>Conta de origem</label>
        <select id="pay-account">
          ${accounts.length===0?'<option value="">Nenhuma conta cadastrada</option>':accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="error-msg" id="pay-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="openInvoiceDetail('${cardId}','${mKey}')">Voltar</button>
      <button class="btn" onclick="confirmPayInvoice('${cardId}','${mKey}')">${early?'Confirmar adiantamento':'Confirmar pagamento'}</button>
    </div>
  `);
}
function confirmPayInvoice(cardId, mKey){
  const errEl = document.getElementById('pay-error');
  const accountId = val('pay-account');
  if(!accountId){ if(errEl) errEl.textContent='Escolha a conta de onde o valor vai sair.'; return; }
  const card = getCard(cardId);
  const total = invoiceTotal(cardId, mKey);
  if(!card || total<=0) return;
  const early = isEarlyInvoicePayment(card, mKey);
  const todayStr = dateStr(new Date());

  const paymentTx = {
    id:uid(), type:'saida', personId:getActivePersonId()||card.personId, categoryId:null,
    description: early
      ? `Adiantamento da fatura ${card.name} (venceria em ${monthLabel(monthKeyToDate(mKey))})`
      : `Pagamento fatura ${card.name} · ${monthLabel(monthKeyToDate(mKey))}`,
    amount: total, date: todayStr,
    paymentMethod:'transferencia', cardId, purchaseId:null,
    installmentNumber:null, installmentCount:null, invoiceMonthKey:mKey,
    kind:'pagamento_fatura', accountId, deletedAt:null
  };
  DATA.transactions.push(paymentTx);
  // paidTxIds fixa QUAIS parcelas este pagamento cobriu — uma compra lançada
  // depois (mesmo caindo no mesmo mês de fatura) não deve ser considerada
  // paga por este pagamento (ver isInstallmentPaid).
  const coveredTxs = cardTransactionsForMonth(cardId, mKey);
  const coveredIds = coveredTxs.map(t=>t.id);
  // Adiantamento: o gasto passa a "valer" no mês em que ele foi de fato
  // adiantado, não no mês original da fatura — então as parcelas cobertas
  // por este pagamento mudam de data pra hoje, e com isso saem do mapa de
  // gastos/orçamento do mês original e entram no do mês do adiantamento.
  // Pagamento no prazo normal não mexe nisso (mantém a data da fatura).
  if(early) coveredTxs.forEach(t=>{ t.date = todayStr; });
  DATA.invoices[`${cardId}-${mKey}`] = {paid:true, paidAt:nowIso(), accountId, paymentTxId:paymentTx.id, paidTxIds:coveredIds};

  // O pagamento sempre entra na Entradas & Saídas do dia real em que foi
  // feito (paymentTx.date), que pode ser um mês diferente do mês-fatura
  // (pagar adiantado, por exemplo). Leva o seletor de mês junto pra esse
  // mesmo dia — senão o usuário fica sem ver o próprio pagamento até
  // navegar manualmente pra descobrir em qual mês ele caiu.
  CURRENT_MONTH = new Date();
  closeModal();
  persist();
  logAudit('pagou','cartoes','fatura', `${cardId}-${mKey}`,
    early
      ? `adiantou a fatura de ${esc(card.name)} (venceria em ${monthLabel(monthKeyToDate(mKey))}) — ${fmt(total)} via ${accountName(accountId)}`
      : `marcou a fatura de ${esc(card.name)} (${monthLabel(monthKeyToDate(mKey))}) como paga — ${fmt(total)} via ${accountName(accountId)}`,
    null, {cardId, accountId});
}
function undoInvoicePayment(cardId, mKey){
  const card = getCard(cardId);
  const key = `${cardId}-${mKey}`;
  const rec = invoiceRecord(cardId, mKey);
  if(!rec.paid) return;
  confirmDialog(`Desmarcar a fatura de ${card?card.name:''} como paga? Isso desfaz a saída bancária registrada e o valor volta a comprometer o limite do cartão.`, ()=>{
    if(rec.paymentTxId) softDeleteTx(rec.paymentTxId, {silent:true});
    // Se o pagamento tinha sido um adiantamento, as parcelas cobertas tiveram a
    // data movida pro dia do adiantamento (ver confirmPayInvoice) — desfazer
    // o pagamento devolve cada uma pra data original da fatura (recalculada,
    // nunca guardada à parte, pra não duplicar fonte de verdade).
    if(card && Array.isArray(rec.paidTxIds)){
      const dueStr = dateStr(invoiceDueDate(card, mKey));
      rec.paidTxIds.forEach(id=>{
        const t = (DATA.transactions||[]).find(x=>x.id===id);
        if(t) t.date = dueStr;
      });
    }
    DATA.invoices[key] = {paid:false};
    closeModal();
    persist();
    logAudit('estornou','cartoes','fatura', key, `desmarcou a fatura de ${card?card.name:''} (${monthLabel(monthKeyToDate(mKey))}) como paga`, null, {cardId, accountId:rec.accountId||null});
  }, {title:'Desmarcar fatura como paga', confirmLabel:'Desmarcar', danger:true});
}

// ---------------- Contas bancárias ----------------
function openAccountsManager(){
  const accounts = DATA.accounts||[];
  const people = getPeople();
  openModal(`
    <h3>Contas</h3>
    <div class="sub" style="margin-bottom:12px;">De onde o dinheiro sai quando você paga uma fatura ou registra uma saída em dinheiro/PIX/débito.</div>
    <div class="row-list list-grouped" style="max-height:280px; overflow-y:auto;">
      ${accounts.length===0?'<div class="empty"><span class="empty-title">Nenhuma conta cadastrada</span></div>':
        accounts.map(a=>`
        <div class="item-row">
          <div class="item-left">
            <div>
              <div class="item-desc">${esc(a.name)} ${a.status!=='ativa'?'<span class="over-tag">inativa</span>':''}</div>
              <div class="item-meta">${accountKindLabel(a.kind)}${people.length>1?' · '+esc(personName(a.personId)):''}</div>
            </div>
          </div>
          <button class="icon-btn" onclick="openAccountForm('${a.id}')" aria-label="Editar">${icon('edit',15)}</button>
        </div>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Fechar</button>
      <button class="btn" onclick="openAccountForm()">+ Nova conta</button>
    </div>
  `);
}
function openAccountForm(editId){
  const account = editId ? getAccount(editId) : null;
  const people = getPeople();
  openModal(`
    <h3>${account?'Editar conta':'Nova conta'}</h3>
    <input type="hidden" id="acc-edit-id" value="${account?account.id:''}">
    <div class="form-grid full"><div class="field"><label>Nome da conta</label><input id="acc-name" value="${account?esc(account.name):''}" placeholder="Ex: Conta corrente, Sicoob, Nubank..."></div></div>
    <div class="form-grid">
      <div class="field"><label>Tipo</label>
        <select id="acc-kind">${ACCOUNT_KINDS.map(k=>`<option value="${k.id}" ${account&&account.kind===k.id?'selected':''}>${k.label}</option>`).join('')}</select>
      </div>
      ${people.length>1?`<div class="field"><label>Responsável</label><select id="acc-person">${people.map(p=>`<option value="${p.id}" ${account&&account.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>`:`<input type="hidden" id="acc-person" value="${people[0]?.id||'p1'}">`}
    </div>
    ${account?`<div class="form-grid full"><div class="field"><label>Status</label>
      <select id="acc-status">
        <option value="ativa" ${account.status==='ativa'?'selected':''}>Ativa</option>
        <option value="inativa" ${account.status==='inativa'?'selected':''}>Inativa</option>
      </select>
    </div></div>`:''}
    <div class="error-msg" id="acc-error"></div>
    <div class="modal-actions">
      ${account?`<button class="btn danger" onclick="removeAccount('${account.id}')">Excluir</button>`:''}
      <button class="btn secondary" onclick="openAccountsManager()">Voltar</button>
      <button class="btn" onclick="saveAccount()">Salvar</button>
    </div>
  `);
}
function saveAccount(){
  const errEl = document.getElementById('acc-error');
  const name = val('acc-name').trim();
  if(!name){ if(errEl) errEl.textContent='Informe o nome da conta.'; return; }
  const kind = val('acc-kind');
  const personEl = document.getElementById('acc-person');
  const personId = personEl ? personEl.value : (getPeople()[0]?.id||'p1');
  const editId = val('acc-edit-id');

  if(editId){
    const account = getAccount(editId);
    if(!account){ openAccountsManager(); return; }
    const statusEl = document.getElementById('acc-status');
    const before = {name:account.name, kind:account.kind, status:account.status};
    const after = {name, kind, status: statusEl?statusEl.value:account.status};
    const changes = diffChanges(before, after, [
      {key:'name', label:'Nome'},
      {key:'kind', label:'Tipo', fmt:v=>accountKindLabel(v)},
      {key:'status', label:'Status', fmt:v=>v==='ativa'?'Ativa':'Inativa'}
    ]);
    Object.assign(account, after, {personId, updated_at:nowIso()});
    saveData();
    openAccountsManager();
    if(changes.length) logAudit('editou','contas','conta', account.id, `editou a conta "${name}"`, changes, {accountId:account.id});
    return;
  }

  const newAccount = {
    id:uid(), name, kind, personId, status:'ativa',
    color: pickCategoryColor(DATA.accounts), created_at:nowIso(), updated_at:nowIso()
  };
  DATA.accounts.push(newAccount);
  saveData();
  openAccountsManager();
  logAudit('criou','contas','conta', newAccount.id, `cadastrou a conta "${name}"`, null, {accountId:newAccount.id});
}
function removeAccount(id){
  const account = getAccount(id);
  if(!account) return;
  const usage = accountUsage(id);
  if(usage>0){
    confirmDialog(`"${account.name}" já tem movimentações vinculadas. Em vez de excluir, ela vai ser marcada como inativa. Continuar?`, ()=>{
      account.status = 'inativa';
      account.updated_at = nowIso();
      saveData();
      openAccountsManager();
      logAudit('desativou','contas','conta', id, `desativou a conta "${account.name}"`, null, {accountId:id});
    }, {title:'Desativar conta', confirmLabel:'Desativar'});
    return;
  }
  confirmDialog(`Excluir a conta "${account.name}"?`, ()=>{
    DATA.accounts = DATA.accounts.filter(a=>a.id!==id);
    saveData();
    openAccountsManager();
    logAudit('excluiu','contas','conta', id, `excluiu a conta "${account.name}"`, null, {accountId:id});
  }, {title:'Excluir conta', confirmLabel:'Excluir', danger:true});
}

// ---------------- Auditoria ----------------
// Tela de HISTÓRICO DE AÇÕES — diferente da tela de Entradas & Saídas, que
// mostra o estado atual. Aqui o objetivo é "quem fez o quê e quando",
// puxado da tabela append-only do servidor (nunca do blob local).
const AUDIT_ACTION_LABELS = {criou:'Criou', editou:'Editou', excluiu:'Excluiu', pagou:'Pagou', estornou:'Estornou', ativou:'Ativou', desativou:'Desativou'};
const AUDIT_MODULE_LABELS = {transacoes:'Lançamentos', cartoes:'Cartões', contas:'Contas', orcamentos:'Orçamentos', categorias:'Categorias', parcelas:'Parcelas', caixinhas:'Caixinhas', lembretes:'Lembretes'};
let AUDIT_EVENTS = [];
let AUDIT_FILTERS = {personId:'all', action:'all', module:'all', period:'mes', customFrom:'', customTo:''};

function auditPeriodRange(period, customFrom, customTo){
  const now = new Date();
  const startOfDay = d => `${dateStr(d)} 00:00:00`;
  const endOfDay = d => `${dateStr(d)} 23:59:59`;
  if(period==='hoje') return {from:startOfDay(now), to:endOfDay(now)};
  if(period==='7dias'){ const d=new Date(now); d.setDate(d.getDate()-6); return {from:startOfDay(d), to:endOfDay(now)}; }
  if(period==='mes'){ const d=new Date(now.getFullYear(), now.getMonth(), 1); return {from:startOfDay(d), to:endOfDay(now)}; }
  if(period==='mes-anterior'){
    const start = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {from:startOfDay(start), to:endOfDay(end)};
  }
  if(period==='custom'){
    if(!customFrom || !customTo) return {from:null, to:null};
    return {from:`${customFrom} 00:00:00`, to:`${customTo} 23:59:59`};
  }
  return {from:null, to:null};
}
async function loadAndRenderAudit(){
  const {from, to} = auditPeriodRange(AUDIT_FILTERS.period, AUDIT_FILTERS.customFrom, AUDIT_FILTERS.customTo);
  const params = new URLSearchParams();
  if(AUDIT_FILTERS.personId!=='all') params.set('personId', AUDIT_FILTERS.personId);
  if(AUDIT_FILTERS.action!=='all') params.set('action', AUDIT_FILTERS.action);
  if(AUDIT_FILTERS.module!=='all') params.set('module', AUDIT_FILTERS.module);
  if(from) params.set('from', from);
  if(to) params.set('to', to);
  params.set('limit','150');
  try{
    const res = await api('/audit?'+params.toString());
    AUDIT_EVENTS = res.events||[];
  }catch(e){
    AUDIT_EVENTS = [];
  }
  if(TAB==='auditoria'){
    const content = document.getElementById('tab-content');
    if(content) content.innerHTML = renderAuditoria();
  }
}
function setAuditFilter(key, value){
  AUDIT_FILTERS[key] = value;
  if(key==='period' && value!=='custom'){ AUDIT_FILTERS.customFrom=''; AUDIT_FILTERS.customTo=''; }
  const content = document.getElementById('tab-content');
  if(content) content.innerHTML = '<div class="empty">Carregando...</div>';
  loadAndRenderAudit();
}
function setAuditCustomRange(){
  AUDIT_FILTERS.customFrom = val('audit-from');
  AUDIT_FILTERS.customTo = val('audit-to');
  if(AUDIT_FILTERS.customFrom && AUDIT_FILTERS.customTo) loadAndRenderAudit();
}
function renderAuditoria(){
  const people = getPeople();
  const f = AUDIT_FILTERS;
  return `
    <div class="sub" style="margin-bottom:14px;">Histórico de quem fez o quê no Cofre. Diferente de Entradas &amp; Saídas (que mostra o estado atual), aqui é o rastro — inclusive do que já foi excluído.</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
      ${people.length>1?`
      <select onchange="setAuditFilter('personId', this.value)">
        <option value="all" ${f.personId==='all'?'selected':''}>Pessoa: Todas</option>
        ${people.map(p=>`<option value="${p.id}" ${f.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>`:''}
      <select onchange="setAuditFilter('period', this.value)">
        <option value="hoje" ${f.period==='hoje'?'selected':''}>Hoje</option>
        <option value="7dias" ${f.period==='7dias'?'selected':''}>Últimos 7 dias</option>
        <option value="mes" ${f.period==='mes'?'selected':''}>Este mês</option>
        <option value="mes-anterior" ${f.period==='mes-anterior'?'selected':''}>Mês anterior</option>
        <option value="custom" ${f.period==='custom'?'selected':''}>Personalizado</option>
      </select>
      <select onchange="setAuditFilter('module', this.value)">
        <option value="all" ${f.module==='all'?'selected':''}>Módulo: Todos</option>
        ${Object.entries(AUDIT_MODULE_LABELS).map(([k,l])=>`<option value="${k}" ${f.module===k?'selected':''}>${l}</option>`).join('')}
      </select>
      <select onchange="setAuditFilter('action', this.value)">
        <option value="all" ${f.action==='all'?'selected':''}>Ação: Todas</option>
        ${Object.entries(AUDIT_ACTION_LABELS).map(([k,l])=>`<option value="${k}" ${f.action===k?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    ${f.period==='custom'?`
    <div class="form-grid" style="margin-bottom:16px; max-width:360px;">
      <div class="field"><label>De</label><input type="date" id="audit-from" value="${f.customFrom}" onchange="setAuditCustomRange()"></div>
      <div class="field"><label>Até</label><input type="date" id="audit-to" value="${f.customTo}" onchange="setAuditCustomRange()"></div>
    </div>`:''}
    <div class="row-list list-grouped">
      ${AUDIT_EVENTS.length===0 ? '<div class="empty"><span class="empty-title">Nada por aqui neste período</span>Ajuste os filtros ou tente um intervalo maior.</div>' :
        AUDIT_EVENTS.map(ev=>renderAuditEvent(ev)).join('')}
    </div>
  `;
}
function renderAuditEvent(ev){
  const d = new Date(String(ev.createdAt).replace(' ','T')+'Z');
  const when = isNaN(d.getTime()) ? ev.createdAt : d.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
  return `
    <div class="item-row" style="align-items:flex-start;">
      <div class="item-left" style="align-items:flex-start;">
        <span class="item-tag audit-tag-${ev.action}">${AUDIT_ACTION_LABELS[ev.action]||ev.action}</span>
        <div>
          <div class="item-desc"><strong>${esc(ev.actorPersonName)}</strong> ${esc(ev.description)}</div>
          <div class="item-meta">${AUDIT_MODULE_LABELS[ev.module]||ev.module} · ${when}</div>
          ${ev.changes && ev.changes.length ? `
          <div class="audit-diff">
            ${ev.changes.map(c=>`<span class="audit-diff-chip">${esc(c.field)}: ${esc(c.from)} → ${esc(c.to)}</span>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ---------------- Caixinhas ----------------
function renderJarCard(c, readOnly){
  const pct = Math.min(100, Math.round((c.current/Math.max(c.goal,1))*100));
  const complete = c.current >= c.goal && c.goal>0;
  return `
    <div class="jar-card ${complete?'jar-complete':''}" id="jarcard-${c.id}">
      ${complete?'<div class="jar-complete-badge">Meta batida ✦</div>':''}
      <div class="jar-visual"><div class="jar-pct ${pct>=45?'jar-pct-on-fill':''}">${pct}%</div><div class="jar-fill" style="height:${pct}%"></div></div>
      <div class="jar-name">${esc(c.emoji)} ${esc(c.name)}</div>
      <div class="jar-nums"><span class="cur">${fmt(c.current)}</span><span class="goal">meta ${fmt(c.goal)}</span></div>
      ${readOnly?'':`
      <div class="jar-actions">
        <input type="number" step="0.01" placeholder="valor" id="jar-add-${c.id}">
        <button class="btn small" onclick="addJarFunds('${c.id}')">+ Add</button>
        <button class="icon-btn" onclick="removeJar('${c.id}')">✕</button>
      </div>`}
    </div>
  `;
}
function renderCaixinhas(){
  const totalSaved = DATA.caixinhas.reduce((s,c)=>s+c.current,0);
  return `
    ${renderTipCard('caixinhas')}
    <div class="section-head">
      <div class="sub">Total guardado em caixinhas: <strong style="color:var(--brass-deep)">${fmt(totalSaved)}</strong></div>
      <button class="btn" onclick="openCaixinhaForm()">+ Nova caixinha</button>
    </div>
    <div class="jar-grid">
      ${DATA.caixinhas.length===0?'<div class="empty"><span class="empty-title">Nenhuma caixinha ainda</span>Dê um nome e um valor a um objetivo — o cofre cuida de mostrar o progresso.</div>':
        DATA.caixinhas.map(c=>renderJarCard(c,false)).join('')}
    </div>
  `;
}
function openCaixinhaForm(){
  openModal(`
    <h3>Nova caixinha</h3>
    <div class="form-grid">
      <div class="field"><label>Nome do objetivo</label><input id="jar-name" placeholder="Ex: Viagem, Reserva..."></div>
      <div class="field"><label>Emoji</label><input id="jar-emoji" value="💰" maxlength="2"></div>
    </div>
    <div class="form-grid full"><div class="field"><label>Valor objetivo (R$)</label><input type="number" step="0.01" id="jar-goal" placeholder="Ex: 5000"></div></div>
    <div class="error-msg" id="jar-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn gold" onclick="addCaixinha()">Criar caixinha</button>
    </div>
  `);
}
function addCaixinha(){
  const name = val('jar-name').trim();
  const goal = Number(val('jar-goal'));
  const errEl = document.getElementById('jar-error');
  if(!name){ if(errEl) errEl.textContent='Dê um nome para a caixinha.'; return; }
  if(isNaN(goal) || goal<=0){ if(errEl) errEl.textContent='Informe uma meta maior que zero.'; return; }
  DATA.caixinhas.push({id:uid(), name, goal, current:0, emoji:val('jar-emoji')||'💰'});
  closeModal(); persist();
}
function addJarFunds(id){
  const inputEl = document.getElementById(`jar-add-${id}`);
  if(!inputEl) return;
  const value = Number(inputEl.value);
  if(inputEl.value==='' || isNaN(value) || value===0) return;
  const before = DATA.caixinhas.find(c=>c.id===id);
  const wasComplete = before ? (before.current >= before.goal && before.goal>0) : false;
  DATA.caixinhas = DATA.caixinhas.map(c=> c.id===id ? {...c, current:Math.max(0,c.current+value)} : c);
  const after = DATA.caixinhas.find(c=>c.id===id);
  const nowComplete = after ? (after.current >= after.goal && after.goal>0) : false;
  render();
  saveData();
  if(nowComplete && !wasComplete) celebrateJar(id);
}
function removeJar(id){ DATA.caixinhas = DATA.caixinhas.filter(c=>c.id!==id); persist(); }

// ---------------- Dízimo ----------------
function renderDizimo(mKey){
  const monthTx = nonDeletedTx().filter(t=>t.date.startsWith(mKey) && t.type==='entrada');
  const people = getPeople();
  return `
    ${renderTipCard('dizimo')}
    <div class="sub" style="margin-bottom:16px;">Cálculo automático de 10% sobre as entradas registradas no mês.</div>
    <div class="grid ${people.length>1?'grid-2':''}" style="${people.length===1?'max-width:420px;':''}">
      ${people.map(p=>{
        const income = monthTx.filter(t=> people.length===1 || t.personId===p.id).reduce((s,t)=>s+Number(t.amount),0);
        const tithe = income*0.1;
        const key = `${p.id}-${mKey}`;
        const paid = DATA.titheStatus[key];
        return `
        <div class="card">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <span class="dot" style="background:${p.color}"></span><strong>${esc(p.name)}</strong>
          </div>
          <div class="item-meta">Entradas do mês</div>
          <div style="font-size:20px; font-weight:700; margin-bottom:10px;">${fmt(income)}</div>
          <div class="item-meta">Dízimo (10%)</div>
          <div style="font-size:24px; font-weight:700; color:${paid?'var(--verdigris)':'var(--brass-deep)'}; font-family:'Newsreader',serif; margin-bottom:14px;">${fmt(tithe)}</div>
          <button class="btn ${paid?'secondary':'gold'}" onclick="toggleTithe('${p.id}','${mKey}')">${paid?'✓ Dízimo entregue':'Marcar como entregue'}</button>
        </div>`;
      }).join('')}
    </div>
  `;
}
function toggleTithe(personId, mKey){
  const key = `${personId}-${mKey}`;
  DATA.titheStatus[key] = !DATA.titheStatus[key];
  persist();
}

// ---------------- Lembretes ----------------
function renderLembretes(){
  const upcoming = getUpcomingReminders();
  const customReminders = DATA.reminders.slice().sort((a,b)=>a.date.localeCompare(b.date));
  return `
    ${renderTipCard('lembretes')}
    <section>
      <div class="section-head"><div><h2>Automáticos</h2><div class="sub">Gerados a partir de parcelas, cartões e dízimo (próximos 15 dias)</div></div></div>
      <div class="row-list list-grouped">
        ${upcoming.length===0?'<div class="empty"><span class="empty-title">Nada por vir nos próximos 15 dias</span>Assim que houver parcela, fatura ou dízimo próximos do vencimento, eles aparecem aqui.</div>':
          upcoming.map(r=>`
          <div class="item-row">
            <div class="item-left"><span class="due-badge ${r.badge}">${r.badgeLabel}</span><div><div class="item-desc">${esc(r.title)}</div><div class="item-meta">${r.dateLabel}</div></div></div>
            <div class="item-amount">${r.amount!=null?fmt(r.amount):''}</div>
          </div>`).join('')}
      </div>
    </section>
    <section>
      <div class="section-head">
        <div><h2>Personalizados</h2><div class="sub">Lembretes avulsos que você adicionar</div></div>
        <button class="btn" onclick="openReminderForm()">+ Novo lembrete</button>
      </div>
      <div class="row-list list-grouped">
        ${customReminders.length===0?'<div class="empty"><span class="empty-title">Sem lembretes por aqui</span>Cadastre algo fora da rotina do app, tipo IPTU ou renovação de seguro.</div>':
          customReminders.map(r=>`
          <div class="item-row">
            <div class="item-left">
              <input type="checkbox" ${r.done?'checked':''} onchange="toggleReminder('${r.id}')" style="width:auto;">
              <div><div class="item-desc" style="text-decoration:${r.done?'line-through':'none'}; opacity:${r.done?0.5:1}">${esc(r.title)}</div><div class="item-meta">${new Date(r.date+'T00:00:00').toLocaleDateString('pt-BR')}</div></div>
            </div>
            <button class="icon-btn" onclick="removeReminder('${r.id}')">✕</button>
          </div>`).join('')}
      </div>
    </section>
  `;
}
function openReminderForm(){
  openModal(`
    <h3>Novo lembrete</h3>
    <div class="form-grid full"><div class="field"><label>Título</label><input id="rem-title" placeholder="Ex: Pagar IPTU, Renovar seguro..."></div></div>
    <div class="form-grid full"><div class="field"><label>Data</label><input type="date" id="rem-date" value="${new Date().toISOString().slice(0,10)}"></div></div>
    <div class="error-msg" id="rem-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="addReminder()">Salvar</button>
    </div>
  `);
}
function addReminder(){
  const title = val('rem-title').trim();
  const errEl = document.getElementById('rem-error');
  if(!title){ if(errEl) errEl.textContent='Informe um título para o lembrete.'; return; }
  const date = val('rem-date') || new Date().toISOString().slice(0,10);
  DATA.reminders.push({id:uid(), title, date, done:false});
  closeModal(); persist();
}
function toggleReminder(id){ DATA.reminders = DATA.reminders.map(r=>r.id===id?{...r, done:!r.done}:r); persist(); }
function removeReminder(id){ DATA.reminders = DATA.reminders.filter(r=>r.id!==id); persist(); }

// ---------------- Conselheira IA ----------------
const IA_SUGGESTIONS = [
  'Como está minha saúde financeira este mês?',
  'Onde posso cortar gastos?',
  'Algum orçamento está perto de estourar?',
  'Dicas para acelerar o pagamento das parcelas'
];
function renderConselheira(){
  return `
    ${renderTipCard('ia')}
    <div class="sub" style="margin-bottom:16px;">Converse com a IA sobre os seus dados financeiros reais para receber sugestões práticas. As perguntas e o resumo dos dados são processados pelo servidor — a chave de API nunca fica no navegador.</div>
    <div class="chat-box" id="ia-chat" style="margin-bottom:14px; min-height:200px;">
      ${IA_MESSAGES.length===0?'<span style="color:var(--ink-soft)">Faça uma pergunta ou escolha uma sugestão abaixo.</span>':
        IA_MESSAGES.map(m=>`
        <div style="margin-bottom:14px;">
          <div style="font-size:11px; color:var(--ink-soft); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">${m.role==='user'?'Você':'Conselheira'}</div>
          <div>${esc(m.text)}</div>
        </div>`).join('')}
      ${IA_LOADING?'<div style="color:var(--ink-soft); font-style:italic;">Analisando os dados...</div>':''}
    </div>
    <div style="margin-bottom:14px;">
      ${IA_SUGGESTIONS.map(s=>`<span class="suggestion-chip" onclick="askIA(${JSON.stringify(s)})">${s}</span>`).join('')}
    </div>
    <div style="display:flex; gap:8px;">
      <input id="ia-input" placeholder="Pergunte algo sobre suas finanças..." onkeydown="if(event.key==='Enter') askIA(document.getElementById('ia-input').value)">
      <button class="btn" id="ia-ask-btn" ${IA_LOADING?'disabled':''} onclick="askIA(document.getElementById('ia-input').value)">Perguntar</button>
    </div>
  `;
}
async function askIA(question){
  if(!question || IA_LOADING) return;
  const mKey = monthKey(CURRENT_MONTH);
  IA_MESSAGES.push({role:'user', text:question});
  IA_LOADING = true;
  render();
  try{
    const res = await api('/ai/ask', {method:'POST', body:{question, monthKey:mKey}});
    IA_MESSAGES.push({role:'assistant', text:res.text});
  }catch(e){
    IA_MESSAGES.push({role:'assistant', text: e.message || 'Não consegui falar com a IA agora.'});
  }
  IA_LOADING = false;
  render();
}

// ---------------- Painel Admin ----------------
async function loadAndRenderAdmin(){
  try{
    const res = await api('/admin/clients');
    ADMIN_CLIENTS = res.clients;
  }catch(e){
    ADMIN_CLIENTS = [];
  }
  if(TAB==='admin'){
    const content = document.getElementById('tab-content');
    if(content) content.innerHTML = renderAdmin();
  }
}
function renderAdmin(){
  const clients = ADMIN_CLIENTS.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at));
  return `
    <div class="sub" style="margin-bottom:16px;">Gerencie as contas cadastradas neste app. Cada conta tem seus próprios dados financeiros, isolados no banco de dados do servidor por ID de usuário.</div>
    <div class="section-head">
      <div class="sub">${clients.length} conta(s) cadastrada(s)</div>
      <button class="btn" onclick="openAdminCreateForm()">+ Cadastrar novo cliente</button>
    </div>
    <div class="row-list list-grouped">
      ${clients.map(c=>`
        <div class="item-row">
          <div class="item-left">
            <div>
              <div class="item-desc">${esc(c.name)} ${c.role==='admin'?'<span class="role-badge">admin</span>':''}</div>
              <div class="item-meta">${esc(c.email)} · criado em ${new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
          ${c.id!==SESSION.id ? `<button class="btn danger" onclick="adminDeleteClient(${c.id})">Remover</button>` : `<span class="item-meta">você</span>`}
        </div>
      `).join('')}
    </div>
    <div class="hint">Autenticação real no servidor: senhas com hash bcrypt, sessão via cookie httpOnly, e cada conta só acessa seus próprios dados — validado pelo backend, não apenas pela interface.</div>
  `;
}
function openAdminCreateForm(){
  openModal(`
    <h3>Cadastrar novo cliente</h3>
    <div class="form-grid full"><div class="field"><label>Nome do cliente</label><input id="admin-name" placeholder="Nome completo"></div></div>
    <div class="form-grid full"><div class="field"><label>E-mail</label><input id="admin-email" type="email" placeholder="cliente@email.com"></div></div>
    <div class="form-grid full"><div class="field"><label>Senha provisória</label><input id="admin-password" type="text" placeholder="Mínimo 8 caracteres"></div></div>
    <div class="error-msg" id="admin-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="adminCreateClient()">Cadastrar</button>
    </div>
  `);
}
async function adminCreateClient(){
  const name = val('admin-name');
  const email = val('admin-email');
  const password = val('admin-password');
  const errEl = document.getElementById('admin-error');
  try{
    await api('/admin/clients', {method:'POST', body:{name, email, password}});
    closeModal();
    await loadAndRenderAdmin();
  }catch(e){
    if(errEl) errEl.textContent = e.message || 'Não foi possível cadastrar o cliente.';
  }
}
async function adminDeleteClient(id){
  if(!confirm('Remover esta conta? Isso apaga permanentemente os dados financeiros dela.')) return;
  try{
    await api('/admin/clients/'+id, {method:'DELETE'});
    await loadAndRenderAdmin();
  }catch(e){
    alert(e.message || 'Não foi possível remover o cliente.');
  }
}

// ---------------- Init ----------------
(async function init(){
  try{
    const me = await api('/auth/me');
    SESSION = me.user;
    DATA = await loadClientData();
  }catch(e){
    SESSION = null;
  }
  render();
  hideSplash();
})();
