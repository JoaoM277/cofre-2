const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmt = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d) =>
  d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const CATEGORIES_SAIDA = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Cartão de Crédito",
  "Dízimo",
  "Outros",
];
const CATEGORIES_ENTRADA = [
  "Salário",
  "Freelance/Aulas",
  "Rendimento",
  "Presente",
  "Outros",
];

// ---------------- Marca / logomarca ----------------
// Um dial de fechadura de baú — a mesma peça reaparece no dashboard como o
// "mostrador" de saúde financeira, então a marca e o dado real falam a
// mesma língua visual.
function brandMarkSvg(size) {
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

// ---------------- Dicas do Cofre ----------------
// Educação financeira em porções pequenas, no tom de um amigo que entende
// do assunto — não um manual. Uma por aba, escolhida por contexto (não
// aleatória), pra sempre ensinar algo relevante ao que a pessoa está vendo.
const TIPS = {
  dashboard: [
    "Regra prática: separe suas saídas em essenciais (moradia, alimentação), variáveis (lazer, compras) e prioridades (dívidas, poupança). Se as essenciais passarem de 50% da renda, é hora de rever contratos fixos antes de cortar prazeres pequenos.",
    'Olhar o saldo do mês é bom, mas o que muda seu ano é o hábito: registrar todo lançamento no dia em que ele acontece evita o "estouro invisível" do fim do mês.',
  ],
  transacoes: [
    'Lance até os gastos pequenos. É o "café de R$ 8 todo dia" que mais foge do controle mental — e o que mais aparece quando você olha os números de verdade.',
    "Categorizar com consistência importa mais que categorizar com perfeição. Escolha uma categoria e mantenha — é isso que faz os orçamentos por categoria funcionarem de verdade.",
  ],
  orcamentos: [
    "Um orçamento não é uma prisão, é um teto combinado com você mesmo(a) antes do mês começar — assim a decisão difícil já foi tomada com a cabeça fria.",
    "Comece orçando só 2 ou 3 categorias onde você mais se surpreende no fim do mês. Orçar tudo de uma vez costuma cansar e fazer o hábito morrer na 2ª semana.",
  ],
  parcelas: [
    'Parcelar não é "não pagar agora" — é comprometer o seu eu do mês que vem. Antes de fechar uma parcela nova, some tudo que já está comprometido nos próximos meses.',
    "Regra informal saudável: parcelas não devem ultrapassar 30% da sua renda mensal. Passou disso, qualquer imprevisto vira bola de neve.",
  ],
  cartao: [
    "O cartão de crédito não é dinheiro extra, é uma data futura de pagamento. Trate a fatura como uma conta fixa que já existe, mesmo antes dela chegar.",
    "Fechou a fatura e ela veio maior que o esperado? Separe o que foi parcelado (previsível) do que foi gasto no crédito à vista (evitável) — são dois problemas diferentes.",
  ],
  caixinhas: [
    'Caixinhas com nome e valor definido funcionam melhor que "poupança genérica" — o cérebro guarda dinheiro com mais disciplina quando sabe exatamente para quê.',
    "Automatize o pequeno hábito: separar uma quantia fixa toda semana, mesmo pequena, cria mais constância do que um valor grande esporádico.",
  ],
  dizimo: [
    'Separar o dízimo assim que a entrada acontece — antes de qualquer gasto — evita a sensação de "sobrar pouco pra doar" no fim do mês.',
    "Definir isso como um compromisso automático (igual a uma conta fixa) tira a decisão emocional do momento e mantém a constância.",
  ],
  lembretes: [
    "Vencimentos esquecidos costumam custar mais em juros e multas do que qualquer economia feita durante o mês. Poucos minutos revisando lembretes evitam isso.",
    'Agrupar todos os vencimentos num só lugar (em vez de espalhados em apps e papéis) é o que realmente reduz a ansiedade de "será que esqueci de algo".',
  ],
  ia: [
    "A Conselheira usa os seus números reais do mês — quanto mais completo o registro de entradas e saídas, mais útil a resposta dela vai ser.",
    'Pergunte de forma específica: "onde posso cortar 200 reais este mês" tende a gerar uma resposta mais prática do que "como estão minhas finanças".',
  ],
};
let tipIndexByTab = {};
function getTip(tabId) {
  const list = TIPS[tabId];
  if (!list || list.length === 0) return null;
  if (tipIndexByTab[tabId] == null)
    tipIndexByTab[tabId] = Math.floor(Math.random() * list.length);
  return list[tipIndexByTab[tabId]];
}
function renderTipCard(tabId) {
  const tip = getTip(tabId);
  if (!tip) return "";
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
function celebrateJar(jarId) {
  const jarEl = document.getElementById(`jarcard-${jarId}`);
  if (!jarEl) return;
  const burst = document.createElement("div");
  burst.className = "confetti-burst";
  const colors = ["#B8863C", "#3F7D63", "#A6432F", "#8C6428"];
  for (let i = 0; i < 16; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    const angle = Math.random() * Math.PI + Math.PI; // espalha pra cima
    const dist = 60 + Math.random() * 50;
    piece.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    piece.style.setProperty("--rot", `${(Math.random() * 360) | 0}deg`);
    piece.style.background = colors[i % colors.length];
    burst.appendChild(piece);
  }
  jarEl.appendChild(burst);
  requestAnimationFrame(() => {
    burst
      .querySelectorAll(".confetti-piece")
      .forEach((p) => p.classList.add("go"));
  });
  setTimeout(() => burst.remove(), 1000);
}

function safeMonthDate(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

let DATA = null;
let SESSION = null; // {id, email, name, role}
let TAB = "dashboard";
let CURRENT_MONTH = new Date();
let SAVING = false;
let SAVE_ERROR = "";
let IA_MESSAGES = [];
let IA_LOADING = false;
let AUTH_MODE = "login";
let AUTH_ERROR = "";
let ADMIN_CLIENTS = [];

// ---------------- API helper ----------------
// Todas as chamadas usam credentials:'include' para enviar o cookie httpOnly de sessão,
// e um header custom (checado no servidor) como mitigação simples de CSRF.
async function api(path, options = {}) {
  const opts = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "CofreApp",
    },
    credentials: "include",
  };
  if (options.body) opts.body = JSON.stringify(options.body);
  const res = await fetch("/api" + path, opts);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {}
  if (!res.ok) {
    const err = new Error((json && json.error) || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---------------- Persistência de dados financeiros ----------------
async function loadClientData() {
  const res = await api("/data");
  return res.data || DEFAULT_DATA();
}
function DEFAULT_DATA() {
  return {
    settings: null,
    transactions: [],
    installments: [],
    cards: [],
    cardBills: {},
    caixinhas: [],
    titheStatus: {},
    reminders: [],
    budgets: [],
  };
}
async function saveData() {
  SAVING = true;
  updateSaveIndicator();
  try {
    await api("/data", { method: "PUT", body: DATA });
    SAVE_ERROR = "";
  } catch (e) {
    console.error("Erro ao salvar", e);
    SAVE_ERROR =
      "Não foi possível salvar suas últimas alterações. Verifique a conexão.";
  }
  SAVING = false;
  setTimeout(updateSaveIndicator, 300);
}
function persist() {
  saveData();
  render();
}
function updateSaveIndicator() {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  if (SAVE_ERROR) {
    el.innerHTML = `<span style="color:var(--garnet)">⚠ ${esc(SAVE_ERROR)}</span>`;
    return;
  }
  el.textContent = SAVING ? "salvando…" : "sincronizado";
}

function getPeople() {
  if (!DATA || !DATA.settings) return [];
  if (DATA.settings.mode === "single") return [DATA.settings.people[0]];
  return DATA.settings.people;
}
function personName(id) {
  const p = (DATA.settings?.people || []).find((p) => p.id === id);
  return p ? p.name : "—";
}

function getUpcomingReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 15);
  const items = [];
  DATA.reminders
    .filter((r) => !r.done)
    .forEach((r) => {
      const d = new Date(r.date + "T00:00:00");
      if (d >= today && d <= horizon)
        items.push({ title: r.title, date: d, amount: null });
    });
  DATA.installments.forEach((inst) => {
    if (inst.paid >= inst.count) return;
    const first = new Date(inst.firstDueDate + "T00:00:00");
    const due = safeMonthDate(
      first.getFullYear(),
      first.getMonth() + inst.paid,
      first.getDate(),
    );
    if (due >= today && due <= horizon)
      items.push({
        title: `Parcela: ${inst.description} (${inst.paid + 1}/${inst.count})`,
        date: due,
        amount: inst.monthlyAmount,
      });
  });
  DATA.cards.forEach((card) => {
    let due = safeMonthDate(today.getFullYear(), today.getMonth(), card.dueDay);
    if (due < today)
      due = safeMonthDate(
        today.getFullYear(),
        today.getMonth() + 1,
        card.dueDay,
      );
    if (due >= today && due <= horizon) {
      const mk = monthKey(due);
      const bill = DATA.cardBills[`${card.id}-${mk}`];
      if (!bill || !bill.paid)
        items.push({
          title: `Fatura: ${card.name}`,
          date: due,
          amount: bill ? bill.amount : null,
        });
    }
  });
  items.sort((a, b) => a.date - b.date);
  return items.map((it) => {
    const daysLeft = Math.round((it.date - today) / 86400000);
    let badge = "due-ok",
      label = `em ${daysLeft}d`;
    if (daysLeft <= 0) {
      badge = "due-late";
      label = "hoje/atrasado";
    } else if (daysLeft <= 3) {
      badge = "due-soon";
      label = `em ${daysLeft}d`;
    }
    return {
      ...it,
      badge,
      badgeLabel: label,
      dateLabel: it.date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
    };
  });
}

// ---------------- Modal helpers ----------------
function openModal(html) {
  closeModal();
  const wrap = document.createElement("div");
  wrap.className = "modal-overlay";
  wrap.id = "active-modal";
  wrap.onclick = (e) => {
    if (e.target === wrap) closeModal();
  };
  wrap.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(wrap);
}
function closeModal() {
  const m = document.getElementById("active-modal");
  if (m) m.remove();
}
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

// ================= AUTH SCREENS =================
function renderAuthGate() {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-hero">
        ${brandMarkSvg(44)}
        <div class="brand" style="justify-content:center; padding:0;">Cofre<span class="accent">.</span></div>
        <p>Suas finanças, guardadas com cuidado — sozinho(a) ou a dois.</p>
      </div>
      <div class="card" style="margin-top:20px;">
        <div class="auth-tabs">
          <div class="auth-tab ${AUTH_MODE === "login" ? "active" : ""}" data-action="setAuthMode" data-value="login">Entrar</div>
          <div class="auth-tab ${AUTH_MODE === "register" ? "active" : ""}" data-action="setAuthMode" data-value="register">Criar conta</div>
        </div>
        <div class="error-msg">${esc(AUTH_ERROR)}</div>
        ${
          AUTH_MODE === "register"
            ? `
        <div class="form-grid full"><div class="field"><label>Seu nome</label><input id="auth-name" placeholder="Como podemos te chamar"></div></div>
        `
            : ""
        }
        <div class="form-grid full"><div class="field"><label>E-mail</label><input id="auth-email" type="email" placeholder="voce@email.com"></div></div>
        <div class="form-grid full"><div class="field"><label>Senha</label><input id="auth-password" type="password" placeholder="${AUTH_MODE === "register" ? "mínimo 8 caracteres" : "sua senha"}"></div></div>
        <button class="btn" style="width:100%; margin-top:6px;" id="auth-submit-btn" data-action="submitAuth">${AUTH_MODE === "login" ? "Entrar" : "Criar minha conta"}</button>
        <div class="hint">Suas credenciais nunca ficam guardadas no navegador: a senha é validada no servidor (hash bcrypt) e a sessão usa um cookie seguro, inacessível via JavaScript.</div>
      </div>
    </div>
  `;
}
function setAuthMode(m) {
  AUTH_MODE = m;
  AUTH_ERROR = "";
  renderAuthGate();
}

async function submitRegister() {
  const btn = document.getElementById("auth-submit-btn");
  btn.disabled = true;
  const name = val("auth-name");
  const email = val("auth-email");
  const password = val("auth-password");
  try {
    const res = await api("/auth/register", {
      method: "POST",
      body: { name, email, password },
    });
    SESSION = res.user;
    DATA = DEFAULT_DATA();
    TAB = "dashboard";
    render();
  } catch (e) {
    AUTH_ERROR = e.message || "Não foi possível criar a conta.";
    renderAuthGate();
  }
}
async function submitLogin() {
  const btn = document.getElementById("auth-submit-btn");
  btn.disabled = true;
  const email = val("auth-email");
  const password = val("auth-password");
  try {
    const res = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    SESSION = res.user;
    DATA = await loadClientData();
    TAB = "dashboard";
    render();
  } catch (e) {
    AUTH_ERROR = e.message || "Não foi possível entrar.";
    renderAuthGate();
  }
}
async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (e) {}
  SESSION = null;
  DATA = null;
  IA_MESSAGES = [];
  AUTH_ERROR = "";
  AUTH_MODE = "login";
  render();
}

// ---------------- Onboarding (primeira vez de cada conta) ----------------
let onboardMode = "single";
let onboardNames = ["", ""];
function renderOnboarding() {
  onboardNames[0] = onboardNames[0] || SESSION?.name || "";
  return `
  <div style="max-width:480px; margin:60px auto;">
    <div class="brand" style="padding:0 0 18px;">${brandMarkSvg(26)}Cofre<span class="accent">.</span></div>
    <div class="card">
      <h3 style="margin-bottom:6px;">Bem-vindo(a), ${esc(SESSION.name)}!</h3>
      <div class="sub" style="margin-bottom:18px;">Antes de começar, conte um pouco sobre como você vai usar o Cofre.</div>
      <label>Como você vai usar o app?</label>
      <div class="mode-toggle">
        <div class="mode-option ${onboardMode === "single" ? "selected" : ""}" data-action="setOnboardMode" data-value="single">Sou solteiro(a)</div>
        <div class="mode-option ${onboardMode === "couple" ? "selected" : ""}" data-action="setOnboardMode" data-value="couple">Somos um casal</div>
      </div>
      <div class="form-grid full">
        <div class="field"><label>Seu nome</label><input id="ob-name1" value="${esc(onboardNames[0])}" data-input="onboardName1"></div>
      </div>
      ${
        onboardMode === "couple"
          ? `
      <div class="form-grid full">
        <div class="field"><label>Nome do(a) parceiro(a)</label><input id="ob-name2" value="${esc(onboardNames[1])}" data-input="onboardName2"></div>
      </div>`
          : ""
      }
      <button class="btn" style="width:100%; margin-top:10px;" data-action="finishOnboarding">Começar a usar</button>
    </div>
  </div>`;
}
function setOnboardMode(m) {
  onboardMode = m;
  render();
}
function finishOnboarding() {
  const name1 = (onboardNames[0] || "Você").trim() || "Você";
  const name2 = (onboardNames[1] || "Parceiro(a)").trim() || "Parceiro(a)";
  DATA.settings = {
    mode: onboardMode,
    people: [
      { id: "p1", name: name1, color: "#3CAE8C" },
      { id: "p2", name: name2, color: "#D4A24C" },
    ],
  };
  persist();
}

function renderSettingsModal() {
  const s = DATA.settings;
  openModal(`
    <h3>Configurações</h3>
    <label>Modo de uso</label>
    <div class="mode-toggle">
      <div class="mode-option ${s.mode === "single" ? "selected" : ""}" id="set-mode-single" data-action="setSettingsMode" data-value="single">Solteiro(a)</div>
      <div class="mode-option ${s.mode === "couple" ? "selected" : ""}" id="set-mode-couple" data-action="setSettingsMode" data-value="couple">Casal</div>
    </div>
    <div class="form-grid full"><div class="field"><label>Seu nome</label><input id="set-name1" value="${esc(s.people[0].name)}"></div></div>
    <div class="form-grid full" id="set-name2-wrap" style="${s.mode === "single" ? "display:none" : ""}">
      <div class="field"><label>Nome do(a) parceiro(a)</label><input id="set-name2" value="${esc(s.people[1].name)}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="saveSettings">Salvar</button>
    </div>
  `);
}
function setSettingsMode(m) {
  const singleBtn = document.getElementById("set-mode-single");
  const coupleBtn = document.getElementById("set-mode-couple");
  singleBtn.classList.toggle("selected", m === "single");
  coupleBtn.classList.toggle("selected", m === "couple");
  singleBtn.closest(".modal").dataset.mode = m;
  document.getElementById("set-name2-wrap").style.display =
    m === "single" ? "none" : "";
}
function saveSettings() {
  const modalEl = document.getElementById("set-mode-single").closest(".modal");
  const mode = modalEl.dataset.mode || DATA.settings.mode;
  DATA.settings.mode = mode;
  DATA.settings.people[0].name =
    val("set-name1").trim() || DATA.settings.people[0].name;
  if (mode === "couple")
    DATA.settings.people[1].name =
      val("set-name2").trim() || DATA.settings.people[1].name;
  closeModal();
  persist();
}

// ---------------- Nav ----------------
function getNav() {
  const nav = [
    { id: "dashboard", label: "Visão Geral", icon: "◆" },
    { id: "transacoes", label: "Entradas & Saídas", icon: "⇅" },
    { id: "orcamentos", label: "Orçamentos", icon: "▥" },
    { id: "parcelas", label: "Parcelas", icon: "▤" },
    { id: "cartao", label: "Cartão", icon: "▭" },
    { id: "caixinhas", label: "Caixinhas", icon: "●" },
    { id: "dizimo", label: "Dízimo", icon: "✦" },
    { id: "lembretes", label: "Lembretes", icon: "⏰" },
    { id: "ia", label: "Conselheira IA", icon: "✧" },
  ];
  if (SESSION && SESSION.role === "admin")
    nav.push({ id: "admin", label: "Painel Admin", icon: "⌂" });
  return nav;
}
function switchTab(t) {
  TAB = t;
  render();
}
function changeMonth(delta) {
  CURRENT_MONTH = new Date(
    CURRENT_MONTH.getFullYear(),
    CURRENT_MONTH.getMonth() + delta,
    1,
  );
  render();
}

// ---------------- Main render ----------------
function render() {
  const root = document.getElementById("root");
  if (!SESSION) {
    renderAuthGate();
    return;
  }
  if (!DATA.settings) {
    root.innerHTML = renderOnboarding();
    return;
  }

  const NAV = getNav();
  const showMonthPicker = [
    "dashboard",
    "transacoes",
    "cartao",
    "dizimo",
    "orcamentos",
  ].includes(TAB);
  const navHtml = NAV.map(
    (n) =>
      `<button class="nav-btn ${TAB === n.id ? "active" : ""}" data-action="switchTab" data-value="${n.id}"><span class="nav-icon">${n.icon}</span>${n.label}</button>`,
  ).join("");

  root.innerHTML = `
    <div class="app">
      <div class="sidebar">
        <div class="brand">${brandMarkSvg(24)}Cofre<span class="accent">.</span></div>
        ${navHtml}
        <button class="nav-btn" data-action="renderSettingsModal"><span class="nav-icon">⚙</span>Configurações</button>
        <button class="nav-btn" data-action="logout"><span class="nav-icon">↩</span>Sair</button>
        <div style="margin-top:auto; padding-top:14px; font-size:11px; color:#5c6d61; line-height:1.6;">
          <div>${esc(SESSION.name)} ${SESSION.role === "admin" ? '<span class="role-badge">admin</span>' : ""}</div>
          <div id="save-indicator">sincronizado</div>
        </div>
      </div>
      <div class="main">
        <div class="topbar">
          <h1>${NAV.find((n) => n.id === TAB)?.label || ""}</h1>
          ${
            showMonthPicker
              ? `
          <div class="month-picker">
            <button data-action="changeMonth" data-value="-1">‹</button>
            <div class="label">${monthLabel(CURRENT_MONTH)}</div>
            <button data-action="changeMonth" data-value="1">›</button>
          </div>`
              : ""
          }
        </div>
        <div id="tab-content"></div>
      </div>
    </div>
  `;
  const content = document.getElementById("tab-content");
  const mKey = monthKey(CURRENT_MONTH);
  if (TAB === "dashboard") content.innerHTML = renderDashboard(mKey);
  else if (TAB === "transacoes") content.innerHTML = renderTransacoes(mKey);
  else if (TAB === "orcamentos") content.innerHTML = renderOrcamentos(mKey);
  else if (TAB === "parcelas") content.innerHTML = renderParcelas();
  else if (TAB === "cartao") content.innerHTML = renderCartao(mKey);
  else if (TAB === "caixinhas") content.innerHTML = renderCaixinhas();
  else if (TAB === "dizimo") content.innerHTML = renderDizimo(mKey);
  else if (TAB === "lembretes") content.innerHTML = renderLembretes();
  else if (TAB === "ia") content.innerHTML = renderConselheira();
  else if (TAB === "admin") {
    content.innerHTML = '<div class="empty">Carregando...</div>';
    loadAndRenderAdmin();
  }
}

// ---------------- Dashboard ----------------
function renderGauge(saldo, entradas) {
  const rate = entradas > 0 ? saldo / entradas : saldo < 0 ? -0.3 : 0;
  const clamped = Math.max(-0.3, Math.min(0.4, rate));
  const angle = ((clamped - -0.3) / (0.4 - -0.3)) * 160 - 80; // -80..80

  let status, detail;
  if (rate < 0) {
    status = "Apertado";
    detail = `As saídas passaram as entradas em ${fmt(Math.abs(saldo))} neste mês. Vale olhar as categorias que mais pesaram antes do próximo mês começar.`;
  } else if (rate < 0.1) {
    status = "Atenção";
    detail = `Você fechou o mês no positivo, mas guardando pouco (${Math.round(rate * 100)}% da renda). Um orçamento por categoria pode abrir espaço.`;
  } else if (rate < 0.25) {
    status = "Equilibrado";
    detail = `Sobrou ${fmt(saldo)} este mês — cerca de ${Math.round(rate * 100)}% da renda. Uma boa base para reforçar uma caixinha.`;
  } else {
    status = "Tranquilo";
    detail = `Sobrou ${fmt(saldo)}, ${Math.round(rate * 100)}% da renda do mês. Ótimo momento para acelerar uma meta de poupança.`;
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
          <div class="gauge-status" style="color:${rate < 0 ? "var(--garnet)" : rate < 0.1 ? "var(--brass-deep)" : "var(--verdigris)"}">${status}</div>
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
const SPENDING_COLORS = [
  "#B8863C",
  "#3F7D63",
  "#A6432F",
  "#4A6FA5",
  "#8C6428",
  "#6B5B95",
  "#C97B4A",
];
function renderSpendingMap(monthTx) {
  const saidas = monthTx.filter((t) => t.type === "saida");
  const total = saidas.reduce((s, t) => s + Number(t.amount), 0);

  if (total <= 0) {
    return `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;"><h2 style="font-size:16.5px;">Mapa de gastos</h2></div>
      <div class="empty"><span class="empty-title">Ainda sem gastos este mês</span>Assim que você registrar a primeira saída, este mapa mostra pra onde o dinheiro está indo.</div>
    </div>`;
  }

  const byCat = {};
  saidas.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
  });
  let entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const MAX_SLICES = 6;
  let shown = entries.slice(0, MAX_SLICES);
  const rest = entries.slice(MAX_SLICES);
  if (rest.length) {
    shown.push(["Outros", rest.reduce((s, [, v]) => s + v, 0)]);
  }

  let cum = 0;
  const gradientParts = shown.map(([cat, amt], i) => {
    const pct = (amt / total) * 100;
    const start = cum;
    cum += pct;
    return `${SPENDING_COLORS[i % SPENDING_COLORS.length]} ${start}% ${cum}%`;
  });
  const gradient = `conic-gradient(${gradientParts.join(", ")})`;
  const top = shown[0];
  const topHasBudget = top && DATA.budgets.some((b) => b.category === top[0]);

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
          ${shown
            .map(([cat, amt], i) => {
              const pct = Math.round((amt / total) * 100);
              return `
            <div class="spending-legend-row">
              <span class="spending-dot" style="background:${SPENDING_COLORS[i % SPENDING_COLORS.length]}"></span>
              <div class="spending-legend-info">
                <div class="spending-legend-top"><span class="spending-legend-name">${esc(cat)}</span><span class="spending-legend-amount">${fmt(amt)}</span></div>
                <div class="progress-track" style="margin-top:4px;"><div class="progress-fill" style="width:${pct}%; background:${SPENDING_COLORS[i % SPENDING_COLORS.length]};"></div></div>
              </div>
              <span class="spending-legend-pct">${pct}%</span>
            </div>`;
            })
            .join("")}
        </div>
      </div>
      ${top ? `<div class="hint">"${esc(top[0])}" concentra a maior fatia do mês (${Math.round((top[1] / total) * 100)}%).${topHasBudget ? "" : " Ainda não há um teto pra essa categoria — pode valer a pena criar um na aba Orçamentos."}</div>` : ""}
    </div>
  `;
}

function renderDashboard(mKey) {
  const monthTx = DATA.transactions.filter((t) => t.date.startsWith(mKey));
  const entradas = monthTx
    .filter((t) => t.type === "entrada")
    .reduce((s, t) => s + Number(t.amount), 0);
  const saidas = monthTx
    .filter((t) => t.type === "saida")
    .reduce((s, t) => s + Number(t.amount), 0);
  const saldo = entradas - saidas;
  const people = getPeople();
  const titheOwed = people.reduce((sum, p) => {
    const inc = monthTx
      .filter(
        (t) =>
          t.type === "entrada" && (people.length === 1 || t.personId === p.id),
      )
      .reduce((s, t) => s + Number(t.amount), 0);
    const paid = DATA.titheStatus[`${p.id}-${mKey}`];
    return sum + (paid ? 0 : inc * 0.1);
  }, 0);
  const upcoming = getUpcomingReminders();
  const budgetsOver = DATA.budgets.filter((b) => {
    const spent = monthTx
      .filter((t) => t.type === "saida" && t.category === b.category)
      .reduce((s, t) => s + Number(t.amount), 0);
    return spent > b.amount;
  }).length;

  return `
    <section style="margin-bottom:24px;">
      ${renderSpendingMap(monthTx)}
    </section>
    ${renderTipCard("dashboard")}
    <section style="margin-bottom:24px;">
      ${renderGauge(saldo, entradas)}
    </section>
    <div class="grid grid-3" style="margin-bottom:32px;">
      <div class="card"><div class="stat-label">Entradas do mês</div><div class="stat-value" style="color:var(--verdigris)">${fmt(entradas)}</div></div>
      <div class="card"><div class="stat-label">Saídas do mês</div><div class="stat-value" style="color:var(--garnet)">${fmt(saidas)}</div></div>
      <div class="card"><div class="stat-label">Dízimo pendente</div><div class="stat-value" style="color:var(--brass-deep)">${fmt(titheOwed)}</div></div>
    </div>
    <section>
      <div class="section-head">
        <div><h2>Orçamentos do mês</h2><div class="sub">${budgetsOver > 0 ? budgetsOver + " categoria(s) estouraram o orçamento" : "Nenhum orçamento estourado"}</div></div>
        <button class="btn secondary small" data-action="switchTab" data-value="orcamentos">Gerenciar</button>
      </div>
      <div class="row-list">
        ${
          DATA.budgets.length === 0
            ? '<div class="empty"><span class="empty-title">Nenhum teto definido ainda</span>Escolha uma categoria que costuma te surpreender e defina um limite pra ela.</div>'
            : DATA.budgets
                .slice(0, 4)
                .map((b) => renderBudgetRow(b, monthTx))
                .join("")
        }
      </div>
    </section>
    <section>
      <div class="section-head">
        <div><h2>Próximos vencimentos</h2><div class="sub">Parcelas, cartão e lembretes dos próximos 15 dias</div></div>
        <button class="btn secondary small" data-action="switchTab" data-value="lembretes">Ver todos</button>
      </div>
      <div class="row-list">
        ${
          upcoming.length === 0
            ? '<div class="empty"><span class="empty-title">Tudo em dia ✦</span>Nenhum vencimento nos próximos 15 dias.</div>'
            : upcoming
                .slice(0, 6)
                .map(
                  (r) => `
          <div class="item-row">
            <div class="item-left">
              <span class="due-badge ${r.badge}">${r.badgeLabel}</span>
              <div><div class="item-desc">${esc(r.title)}</div><div class="item-meta">${r.dateLabel}</div></div>
            </div>
            <div class="item-amount">${r.amount != null ? fmt(r.amount) : ""}</div>
          </div>`,
                )
                .join("")
        }
      </div>
    </section>
    <section>
      <div class="section-head">
        <div><h2>Caixinhas</h2><div class="sub">Progresso dos objetivos de poupança</div></div>
        <button class="btn secondary small" data-action="switchTab" data-value="caixinhas">Gerenciar</button>
      </div>
      <div class="jar-grid">
        ${
          DATA.caixinhas.length === 0
            ? '<div class="empty"><span class="empty-title">Nenhuma caixinha ainda</span>Que tal começar com um objetivo pequeno e concreto, tipo uma viagem de fim de semana?</div>'
            : DATA.caixinhas
                .slice(0, 3)
                .map((c) => renderJarCard(c, true))
                .join("")
        }
      </div>
    </section>
  `;
}

// ---------------- Transações ----------------
let txFilterPerson = "all",
  txFilterType = "all";
function renderTransacoes(mKey) {
  const people = getPeople();
  const monthTx = DATA.transactions
    .filter((t) => t.date.startsWith(mKey))
    .filter((t) => txFilterPerson === "all" || t.personId === txFilterPerson)
    .filter((t) => txFilterType === "all" || t.type === txFilterType)
    .sort((a, b) => b.date.localeCompare(a.date));

  return `
    ${renderTipCard("transacoes")}
    <div class="section-head">
      <div class="sub" style="display:flex; gap:8px;">
        <select data-change="txFilterType" style="width:120px;">
          <option value="all" ${txFilterType === "all" ? "selected" : ""}>Tipo: Todos</option>
          <option value="entrada" ${txFilterType === "entrada" ? "selected" : ""}>Entradas</option>
          <option value="saida" ${txFilterType === "saida" ? "selected" : ""}>Saídas</option>
        </select>
        ${
          people.length > 1
            ? `
        <select data-change="txFilterPerson" style="width:130px;">
          <option value="all" ${txFilterPerson === "all" ? "selected" : ""}>Todos</option>
          ${people.map((p) => `<option value="${p.id}" ${txFilterPerson === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>`
            : ""
        }
      </div>
      <button class="btn" data-action="openTxForm">+ Novo lançamento</button>
    </div>
    <div class="row-list">
      ${
        monthTx.length === 0
          ? '<div class="empty"><span class="empty-title">Nada por aqui ainda</span>Registre o primeiro lançamento do mês — mesmo os pequenos contam.</div>'
          : monthTx
              .map(
                (t) => `
        <div class="item-row">
          <div class="item-left">
            <span class="item-tag ${t.type === "entrada" ? "tag-entrada" : "tag-saida"}">${t.type === "entrada" ? "Entrada" : "Saída"}</span>
            <div>
              <div class="item-desc">${esc(t.description)}</div>
              <div class="item-meta">${esc(t.category)} ${people.length > 1 ? "· " + esc(personName(t.personId)) : ""} · ${new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="item-amount" style="color:${t.type === "entrada" ? "var(--verdigris)" : "var(--garnet)"}">${t.type === "entrada" ? "+" : "-"}${fmt(t.amount)}</div>
            <button class="icon-btn" data-action="removeTx" data-id="${t.id}">✕</button>
          </div>
        </div>`,
              )
              .join("")
      }
    </div>
  `;
}
function openTxForm() {
  const people = getPeople();
  openModal(`
    <h3>Novo lançamento</h3>
    <div class="form-grid">
      <div class="field"><label>Tipo</label>
        <select id="tx-type" data-change="updateTxCategoryOptions">
          <option value="saida">Saída</option><option value="entrada">Entrada</option>
        </select>
      </div>
      <div class="field"><label>Responsável</label>
        <select id="tx-person">${people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="form-grid">
      <div class="field"><label>Categoria</label><select id="tx-category">${CATEGORIES_SAIDA.map((c) => `<option>${c}</option>`).join("")}</select></div>
      <div class="field"><label>Data</label><input type="date" id="tx-date" value="${new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="form-grid full"><div class="field"><label>Descrição</label><input id="tx-desc" placeholder="Ex: Supermercado, Salário..."></div></div>
    <div class="form-grid full"><div class="field"><label>Valor (R$)</label><input type="number" step="0.01" id="tx-amount" placeholder="0,00"></div></div>
    <div class="error-msg" id="tx-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="addTx">Salvar</button>
    </div>
  `);
}
function updateTxCategoryOptions() {
  const type = val("tx-type");
  const cats = type === "entrada" ? CATEGORIES_ENTRADA : CATEGORIES_SAIDA;
  document.getElementById("tx-category").innerHTML = cats
    .map((c) => `<option>${c}</option>`)
    .join("");
}
function addTx() {
  const desc = val("tx-desc").trim();
  const amount = Number(val("tx-amount"));
  const errEl = document.getElementById("tx-error");
  if (!desc) {
    if (errEl) errEl.textContent = "Informe uma descrição.";
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    if (errEl) errEl.textContent = "Informe um valor maior que zero.";
    return;
  }
  const dateStr = val("tx-date") || new Date().toISOString().slice(0, 10);
  DATA.transactions.push({
    id: uid(),
    type: val("tx-type"),
    personId: val("tx-person"),
    category: val("tx-category"),
    description: desc,
    amount,
    date: dateStr,
  });
  closeModal();
  persist();
}
function removeTx(id) {
  DATA.transactions = DATA.transactions.filter((t) => t.id !== id);
  persist();
}

// ---------------- Orçamentos ----------------
function renderBudgetRow(b, monthTx) {
  const spent = monthTx
    .filter((t) => t.type === "saida" && t.category === b.category)
    .reduce((s, t) => s + Number(t.amount), 0);
  const pct = Math.min(100, Math.round((spent / Math.max(b.amount, 1)) * 100));
  const over = spent > b.amount;
  const fillColor = over
    ? "var(--garnet)"
    : pct >= 80
      ? "var(--brass)"
      : "var(--verdigris)";
  return `
    <div class="card" style="padding:14px 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
        <div>
          <div class="item-desc">${esc(b.category)} ${over ? '<span style="color:var(--garnet); font-size:11.5px; font-weight:700;">· ESTOUROU</span>' : ""}</div>
          <div class="item-meta">${fmt(spent)} de ${fmt(b.amount)} (${pct}%)</div>
        </div>
        <button class="icon-btn" data-action="removeBudget" data-id="${b.id}">✕</button>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%; background:${fillColor};"></div></div>
      ${over ? `<div class="item-meta" style="color:var(--garnet); margin-top:6px;">Passou ${fmt(spent - b.amount)} do combinado neste mês.</div>` : ""}
    </div>
  `;
}
function renderOrcamentos(mKey) {
  const monthTx = DATA.transactions.filter((t) => t.date.startsWith(mKey));
  const usedCategories = DATA.budgets.map((b) => b.category);
  const available = CATEGORIES_SAIDA.filter((c) => !usedCategories.includes(c));
  const totalBudget = DATA.budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = DATA.budgets.reduce(
    (s, b) =>
      s +
      monthTx
        .filter((t) => t.type === "saida" && t.category === b.category)
        .reduce((s2, t) => s2 + Number(t.amount), 0),
    0,
  );
  return `
    ${renderTipCard("orcamentos")}
    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="card"><div class="stat-label">Orçado no mês</div><div class="stat-value">${fmt(totalBudget)}</div></div>
      <div class="card"><div class="stat-label">Gasto no mês</div><div class="stat-value" style="color:${totalSpent > totalBudget && totalBudget > 0 ? "var(--garnet)" : "var(--ink)"}">${fmt(totalSpent)}</div></div>
      <div class="card"><div class="stat-label">Categorias sem orçamento</div><div class="stat-value">${available.length}</div></div>
    </div>
    <div class="section-head">
      <div class="sub">Defina um valor limite por categoria — o app compara automaticamente com seus lançamentos.</div>
      <button class="btn" data-action="openBudgetForm" ${available.length === 0 ? "disabled" : ""}>+ Novo orçamento</button>
    </div>
    <div class="row-list">
      ${
        DATA.budgets.length === 0
          ? '<div class="empty"><span class="empty-title">Nenhum teto ainda</span>Comece com uma categoria só — "Alimentação" costuma ser um bom primeiro teste.</div>'
          : DATA.budgets.map((b) => renderBudgetRow(b, monthTx)).join("")
      }
    </div>
  `;
}
function openBudgetForm() {
  const usedCategories = DATA.budgets.map((b) => b.category);
  const available = CATEGORIES_SAIDA.filter((c) => !usedCategories.includes(c));
  if (available.length === 0) return;
  openModal(`
    <h3>Novo orçamento</h3>
    <div class="form-grid full"><div class="field"><label>Categoria</label><select id="budget-category">${available.map((c) => `<option>${c}</option>`).join("")}</select></div></div>
    <div class="form-grid full"><div class="field"><label>Valor limite mensal (R$)</label><input type="number" step="0.01" id="budget-amount" placeholder="Ex: 1000"></div></div>
    <div class="error-msg" id="budget-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="addBudget">Salvar</button>
    </div>
  `);
}
function addBudget() {
  const category = val("budget-category");
  const amount = Number(val("budget-amount"));
  const errEl = document.getElementById("budget-error");
  if (!category) {
    if (errEl) errEl.textContent = "Escolha uma categoria.";
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    if (errEl) errEl.textContent = "Informe um valor limite maior que zero.";
    return;
  }
  DATA.budgets.push({ id: uid(), category, amount });
  closeModal();
  persist();
}
function removeBudget(id) {
  DATA.budgets = DATA.budgets.filter((b) => b.id !== id);
  persist();
}

// ---------------- Parcelas ----------------
function renderParcelas() {
  const people = getPeople();
  const ativas = DATA.installments.filter((i) => i.paid < i.count).length;
  return `
    ${renderTipCard("parcelas")}
    <div class="section-head">
      <div class="sub">Compras parceladas em andamento — ${ativas} ativas</div>
      <button class="btn" data-action="openInstallmentForm">+ Nova parcela</button>
    </div>
    <div class="row-list">
      ${
        DATA.installments.length === 0
          ? '<div class="empty"><span class="empty-title">Nenhuma parcela cadastrada</span>Cadastre suas compras parceladas pra ver o compromisso total dos próximos meses.</div>'
          : DATA.installments
              .map((inst) => {
                const pct = Math.round((inst.paid / inst.count) * 100);
                const done = inst.paid >= inst.count;
                return `
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
              <div>
                <div class="item-desc">${esc(inst.description)} ${done ? '<span style="color:var(--verdigris); font-size:12px;">· quitado</span>' : ""}</div>
                <div class="item-meta">${people.length > 1 ? esc(personName(inst.personId)) + " · " : ""}${esc(inst.category)} · ${inst.paid}/${inst.count} parcelas de ${fmt(inst.monthlyAmount)}</div>
              </div>
              <div style="display:flex; gap:6px; align-items:flex-start;">
                ${!done ? `<button class="btn small" data-action="markInstallmentPaid" data-id="${inst.id}">Marcar paga</button>` : ""}
                ${inst.paid > 0 ? `<button class="btn secondary small" data-action="undoInstallmentPaid" data-id="${inst.id}">Desfazer</button>` : ""}
                <button class="btn danger" data-action="removeInstallment" data-id="${inst.id}">Excluir</button>
              </div>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="item-meta" style="margin-top:6px;">Total: ${fmt(inst.totalAmount)} · Restante: ${fmt(inst.monthlyAmount * (inst.count - inst.paid))}</div>
          </div>`;
              })
              .join("")
      }
    </div>
  `;
}
function openInstallmentForm() {
  const people = getPeople();
  openModal(`
    <h3>Nova compra parcelada</h3>
    <div class="form-grid full"><div class="field"><label>Descrição</label><input id="inst-desc" placeholder="Ex: Notebook, Móveis..."></div></div>
    <div class="form-grid">
      ${people.length > 1 ? `<div class="field"><label>Responsável</label><select id="inst-person">${people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>` : `<input type="hidden" id="inst-person" value="${people[0]?.id || "p1"}">`}
      <div class="field"><label>Categoria</label><select id="inst-category">${CATEGORIES_SAIDA.map((c) => `<option>${c}</option>`).join("")}</select></div>
    </div>
    <div class="form-grid cols-3">
      <div class="field"><label>Valor total (R$)</label><input type="number" step="0.01" id="inst-total"></div>
      <div class="field"><label>Nº de parcelas</label><input type="number" min="1" id="inst-count" value="2"></div>
      <div class="field"><label>1º vencimento</label><input type="date" id="inst-date" value="${new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="error-msg" id="inst-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="addInstallment">Salvar</button>
    </div>
  `);
}
function addInstallment() {
  const desc = val("inst-desc").trim();
  const total = Number(val("inst-total"));
  const count = Math.floor(Number(val("inst-count")));
  const errEl = document.getElementById("inst-error");
  if (!desc) {
    if (errEl) errEl.textContent = "Informe uma descrição.";
    return;
  }
  if (isNaN(total) || total <= 0) {
    if (errEl) errEl.textContent = "O valor total precisa ser maior que zero.";
    return;
  }
  if (isNaN(count) || count <= 0) {
    if (errEl)
      errEl.textContent = "O número de parcelas precisa ser pelo menos 1.";
    return;
  }
  const monthlyAmount = total / count;
  const personEl = document.getElementById("inst-person");
  DATA.installments.push({
    id: uid(),
    description: desc,
    personId: personEl ? personEl.value : "p1",
    totalAmount: total,
    count,
    paid: 0,
    monthlyAmount,
    firstDueDate: val("inst-date"),
    category: val("inst-category"),
  });
  closeModal();
  persist();
}
function markInstallmentPaid(id) {
  DATA.installments = DATA.installments.map((i) =>
    i.id === id ? { ...i, paid: Math.min(i.paid + 1, i.count) } : i,
  );
  persist();
}
function undoInstallmentPaid(id) {
  DATA.installments = DATA.installments.map((i) =>
    i.id === id ? { ...i, paid: Math.max(i.paid - 1, 0) } : i,
  );
  persist();
}
function removeInstallment(id) {
  DATA.installments = DATA.installments.filter((i) => i.id !== id);
  persist();
}

// ---------------- Cartão ----------------
function renderCartao(mKey) {
  const people = getPeople();
  return `
    ${renderTipCard("cartao")}
    <div class="section-head">
      <div class="sub">Faturas do mês selecionado</div>
      <button class="btn" data-action="openCardForm">+ Novo cartão</button>
    </div>
    <div class="row-list">
      ${
        DATA.cards.length === 0
          ? '<div class="empty"><span class="empty-title">Nenhum cartão cadastrado</span>Cadastre o cartão pra acompanhar a fatura mês a mês, sem surpresa no fechamento.</div>'
          : DATA.cards
              .map((card) => {
                const key = `${card.id}-${mKey}`;
                const bill = DATA.cardBills[key] || { amount: 0, paid: false };
                return `
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <div class="item-desc">${esc(card.name)}</div>
                <div class="item-meta">${people.length > 1 ? esc(personName(card.personId)) + " · " : ""}fecha dia ${card.closingDay} · vence dia ${card.dueDay}</div>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="number" step="0.01" placeholder="Valor da fatura" value="${bill.amount || ""}" style="width:130px;" data-card-id="${card.id}" data-month="${mKey}" data-action="setBillAmount">
                <button class="btn small ${bill.paid ? "secondary" : ""}" data-action="toggleBillPaid" data-id="${card.id}" data-value="${mKey}">${bill.paid ? "Paga ✓" : "Marcar paga"}</button>
                <button class="btn danger" data-action="removeCard" data-id="${card.id}">Excluir</button>
              </div>
            </div>
          </div>`;
              })
              .join("")
      }
    </div>
  `;
}
function openCardForm() {
  const people = getPeople();
  openModal(`
    <h3>Novo cartão</h3>
    <div class="form-grid full"><div class="field"><label>Nome do cartão</label><input id="card-name" placeholder="Ex: Nubank, Inter..."></div></div>
    <div class="form-grid cols-3">
      ${people.length > 1 ? `<div class="field"><label>Responsável</label><select id="card-person">${people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>` : `<input type="hidden" id="card-person" value="${people[0]?.id || "p1"}">`}
      <div class="field"><label>Dia fechamento</label><input type="number" min="1" max="31" id="card-closing" value="20"></div>
      <div class="field"><label>Dia vencimento</label><input type="number" min="1" max="31" id="card-due" value="27"></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="addCard">Salvar</button>
    </div>
  `);
}
function addCard() {
  const name = val("card-name");
  if (!name) return;
  const personEl = document.getElementById("card-person");
  DATA.cards.push({
    id: uid(),
    name,
    personId: personEl ? personEl.value : "p1",
    closingDay: Number(val("card-closing")),
    dueDay: Number(val("card-due")),
  });
  closeModal();
  persist();
}
function removeCard(id) {
  DATA.cards = DATA.cards.filter((c) => c.id !== id);
  persist();
}
function setBillAmount(cardId, mKey, value) {
  if (value === "" || value == null) return;
  const num = Number(value);
  if (isNaN(num) || num < 0) return;
  const key = `${cardId}-${mKey}`;
  DATA.cardBills[key] = {
    ...(DATA.cardBills[key] || {}),
    amount: num,
    paid: (DATA.cardBills[key] || {}).paid || false,
  };
  persist();
}
function toggleBillPaid(cardId, mKey) {
  const key = `${cardId}-${mKey}`;
  const cur = DATA.cardBills[key] || { amount: 0, paid: false };
  DATA.cardBills[key] = { ...cur, paid: !cur.paid };
  persist();
}

// ---------------- Caixinhas ----------------
function renderJarCard(c, readOnly) {
  const pct = Math.min(
    100,
    Math.round((c.current / Math.max(c.goal, 1)) * 100),
  );
  const complete = c.current >= c.goal && c.goal > 0;
  return `
    <div class="jar-card ${complete ? "jar-complete" : ""}" id="jarcard-${c.id}">
      ${complete ? '<div class="jar-complete-badge">Meta batida ✦</div>' : ""}
      <div class="jar-visual"><div class="jar-pct ${pct >= 45 ? "jar-pct-on-fill" : ""}">${pct}%</div><div class="jar-fill" style="height:${pct}%"></div></div>
      <div class="jar-name">${esc(c.emoji)} ${esc(c.name)}</div>
      <div class="jar-nums"><span class="cur">${fmt(c.current)}</span><span class="goal">meta ${fmt(c.goal)}</span></div>
      ${
        readOnly
          ? ""
          : `
      <div class="jar-actions">
        <input type="number" step="0.01" placeholder="valor" id="jar-add-${c.id}">
        <button class="btn small" data-action="addJarFunds" data-id="${c.id}">+ Add</button>
        <button class="icon-btn" data-action="removeJar" data-id="${c.id}">✕</button>
      </div>`
      }
    </div>
  `;
}
function renderCaixinhas() {
  const totalSaved = DATA.caixinhas.reduce((s, c) => s + c.current, 0);
  return `
    ${renderTipCard("caixinhas")}
    <div class="section-head">
      <div class="sub">Total guardado em caixinhas: <strong style="color:var(--brass-deep)">${fmt(totalSaved)}</strong></div>
      <button class="btn" data-action="openCaixinhaForm">+ Nova caixinha</button>
    </div>
    <div class="jar-grid">
      ${
        DATA.caixinhas.length === 0
          ? '<div class="empty"><span class="empty-title">Nenhuma caixinha ainda</span>Dê um nome e um valor a um objetivo — o cofre cuida de mostrar o progresso.</div>'
          : DATA.caixinhas.map((c) => renderJarCard(c, false)).join("")
      }
    </div>
  `;
}
function openCaixinhaForm() {
  openModal(`
    <h3>Nova caixinha</h3>
    <div class="form-grid">
      <div class="field"><label>Nome do objetivo</label><input id="jar-name" placeholder="Ex: Viagem, Reserva..."></div>
      <div class="field"><label>Emoji</label><input id="jar-emoji" value="💰" maxlength="2"></div>
    </div>
    <div class="form-grid full"><div class="field"><label>Valor objetivo (R$)</label><input type="number" step="0.01" id="jar-goal" placeholder="Ex: 5000"></div></div>
    <div class="error-msg" id="jar-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn gold" data-action="addCaixinha">Criar caixinha</button>
    </div>
  `);
}
function addCaixinha() {
  const name = val("jar-name").trim();
  const goal = Number(val("jar-goal"));
  const errEl = document.getElementById("jar-error");
  if (!name) {
    if (errEl) errEl.textContent = "Dê um nome para a caixinha.";
    return;
  }
  if (isNaN(goal) || goal <= 0) {
    if (errEl) errEl.textContent = "Informe uma meta maior que zero.";
    return;
  }
  DATA.caixinhas.push({
    id: uid(),
    name,
    goal,
    current: 0,
    emoji: val("jar-emoji") || "💰",
  });
  closeModal();
  persist();
}
function addJarFunds(id) {
  const inputEl = document.getElementById(`jar-add-${id}`);
  if (!inputEl) return;
  const value = Number(inputEl.value);
  if (inputEl.value === "" || isNaN(value) || value === 0) return;
  const before = DATA.caixinhas.find((c) => c.id === id);
  const wasComplete = before
    ? before.current >= before.goal && before.goal > 0
    : false;
  DATA.caixinhas = DATA.caixinhas.map((c) =>
    c.id === id ? { ...c, current: Math.max(0, c.current + value) } : c,
  );
  const after = DATA.caixinhas.find((c) => c.id === id);
  const nowComplete = after
    ? after.current >= after.goal && after.goal > 0
    : false;
  render();
  saveData();
  if (nowComplete && !wasComplete) celebrateJar(id);
}
function removeJar(id) {
  DATA.caixinhas = DATA.caixinhas.filter((c) => c.id !== id);
  persist();
}

// ---------------- Dízimo ----------------
function renderDizimo(mKey) {
  const monthTx = DATA.transactions.filter(
    (t) => t.date.startsWith(mKey) && t.type === "entrada",
  );
  const people = getPeople();
  return `
    ${renderTipCard("dizimo")}
    <div class="sub" style="margin-bottom:16px;">Cálculo automático de 10% sobre as entradas registradas no mês.</div>
    <div class="grid ${people.length > 1 ? "grid-2" : ""}" style="${people.length === 1 ? "max-width:420px;" : ""}">
      ${people
        .map((p) => {
          const income = monthTx
            .filter((t) => people.length === 1 || t.personId === p.id)
            .reduce((s, t) => s + Number(t.amount), 0);
          const tithe = income * 0.1;
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
          <div style="font-size:24px; font-weight:700; color:${paid ? "var(--verdigris)" : "var(--brass-deep)"}; font-family:'Newsreader',serif; margin-bottom:14px;">${fmt(tithe)}</div>
          <button class="btn ${paid ? "secondary" : "gold"}" data-action="toggleTithe" data-id="${p.id}" data-value="${mKey}">${paid ? "✓ Dízimo entregue" : "Marcar como entregue"}</button>
        </div>`;
        })
        .join("")}
    </div>
  `;
}
function toggleTithe(personId, mKey) {
  const key = `${personId}-${mKey}`;
  DATA.titheStatus[key] = !DATA.titheStatus[key];
  persist();
}

// ---------------- Lembretes ----------------
function renderLembretes() {
  const upcoming = getUpcomingReminders();
  const customReminders = DATA.reminders
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return `
    ${renderTipCard("lembretes")}
    <section>
      <div class="section-head"><div><h2>Automáticos</h2><div class="sub">Gerados a partir de parcelas, cartões e dízimo (próximos 15 dias)</div></div></div>
      <div class="row-list">
        ${
          upcoming.length === 0
            ? '<div class="empty"><span class="empty-title">Nada por vir nos próximos 15 dias</span>Assim que houver parcela, fatura ou dízimo próximos do vencimento, eles aparecem aqui.</div>'
            : upcoming
                .map(
                  (r) => `
          <div class="item-row">
            <div class="item-left"><span class="due-badge ${r.badge}">${r.badgeLabel}</span><div><div class="item-desc">${esc(r.title)}</div><div class="item-meta">${r.dateLabel}</div></div></div>
            <div class="item-amount">${r.amount != null ? fmt(r.amount) : ""}</div>
          </div>`,
                )
                .join("")
        }
      </div>
    </section>
    <section>
      <div class="section-head">
        <div><h2>Personalizados</h2><div class="sub">Lembretes avulsos que você adicionar</div></div>
        <button class="btn" data-action="openReminderForm">+ Novo lembrete</button>
      </div>
      <div class="row-list">
        ${
          customReminders.length === 0
            ? '<div class="empty"><span class="empty-title">Sem lembretes por aqui</span>Cadastre algo fora da rotina do app, tipo IPTU ou renovação de seguro.</div>'
            : customReminders
                .map(
                  (r) => `
          <div class="item-row">
            <div class="item-left">
              <input type="checkbox" ${r.done ? "checked" : ""} data-action="toggleReminder" data-id="${r.id}" style="width:auto;">
              <div><div class="item-desc" style="text-decoration:${r.done ? "line-through" : "none"}; opacity:${r.done ? 0.5 : 1}">${esc(r.title)}</div><div class="item-meta">${new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")}</div></div>
            </div>
            <button class="icon-btn" data-action="removeReminder" data-id="${r.id}">✕</button>
          </div>`,
                )
                .join("")
        }
      </div>
    </section>
  `;
}
function openReminderForm() {
  openModal(`
    <h3>Novo lembrete</h3>
    <div class="form-grid full"><div class="field"><label>Título</label><input id="rem-title" placeholder="Ex: Pagar IPTU, Renovar seguro..."></div></div>
    <div class="form-grid full"><div class="field"><label>Data</label><input type="date" id="rem-date" value="${new Date().toISOString().slice(0, 10)}"></div></div>
    <div class="error-msg" id="rem-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="addReminder">Salvar</button>
    </div>
  `);
}
function addReminder() {
  const title = val("rem-title").trim();
  const errEl = document.getElementById("rem-error");
  if (!title) {
    if (errEl) errEl.textContent = "Informe um título para o lembrete.";
    return;
  }
  const date = val("rem-date") || new Date().toISOString().slice(0, 10);
  DATA.reminders.push({ id: uid(), title, date, done: false });
  closeModal();
  persist();
}
function toggleReminder(id) {
  DATA.reminders = DATA.reminders.map((r) =>
    r.id === id ? { ...r, done: !r.done } : r,
  );
  persist();
}
function removeReminder(id) {
  DATA.reminders = DATA.reminders.filter((r) => r.id !== id);
  persist();
}

// ---------------- Conselheira IA ----------------
const IA_SUGGESTIONS = [
  "Como está minha saúde financeira este mês?",
  "Onde posso cortar gastos?",
  "Algum orçamento está perto de estourar?",
  "Dicas para acelerar o pagamento das parcelas",
];
function renderConselheira() {
  return `
    ${renderTipCard("ia")}
    <div class="sub" style="margin-bottom:16px;">Converse com a IA sobre os seus dados financeiros reais para receber sugestões práticas. As perguntas e o resumo dos dados são processados pelo servidor — a chave de API nunca fica no navegador.</div>
    <div class="chat-box" id="ia-chat" style="margin-bottom:14px; min-height:200px;">
      ${
        IA_MESSAGES.length === 0
          ? '<span style="color:var(--ink-soft)">Faça uma pergunta ou escolha uma sugestão abaixo.</span>'
          : IA_MESSAGES.map(
              (m) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:11px; color:var(--ink-soft); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">${m.role === "user" ? "Você" : "Conselheira"}</div>
          <div>${esc(m.text)}</div>
        </div>`,
            ).join("")
      }
      ${IA_LOADING ? '<div style="color:var(--ink-soft); font-style:italic;">Analisando os dados...</div>' : ""}
    </div>
    <div style="margin-bottom:14px;">
      ${IA_SUGGESTIONS.map((s) => `<span class="suggestion-chip" data-action="askIA" data-value="${esc(s)}">${s}</span>`).join("")}
    </div>
    <div style="display:flex; gap:8px;">
      <input id="ia-input" placeholder="Pergunte algo sobre suas finanças..." data-input="iaQuestion">
      <button class="btn" id="ia-ask-btn" ${IA_LOADING ? "disabled" : ""} data-action="askIA" data-id="ia-input">Perguntar</button>
    </div>
  `;
}
async function askIA(question) {
  if (!question || IA_LOADING) return;
  const mKey = monthKey(CURRENT_MONTH);
  IA_MESSAGES.push({ role: "user", text: question });
  IA_LOADING = true;
  render();
  try {
    const res = await api("/ai/ask", {
      method: "POST",
      body: { question, monthKey: mKey },
    });
    IA_MESSAGES.push({ role: "assistant", text: res.text });
  } catch (e) {
    IA_MESSAGES.push({
      role: "assistant",
      text: e.message || "Não consegui falar com a IA agora.",
    });
  }
  IA_LOADING = false;
  render();
}

// ---------------- Painel Admin ----------------
async function loadAndRenderAdmin() {
  try {
    const res = await api("/admin/clients");
    ADMIN_CLIENTS = res.clients;
  } catch (e) {
    ADMIN_CLIENTS = [];
  }
  if (TAB === "admin") {
    const content = document.getElementById("tab-content");
    if (content) content.innerHTML = renderAdmin();
  }
}
function renderAdmin() {
  const clients = ADMIN_CLIENTS.slice().sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  return `
    <div class="sub" style="margin-bottom:16px;">Gerencie as contas cadastradas neste app. Cada conta tem seus próprios dados financeiros, isolados no banco de dados do servidor por ID de usuário.</div>
    <div class="section-head">
      <div class="sub">${clients.length} conta(s) cadastrada(s)</div>
      <button class="btn" data-action="openAdminCreateForm">+ Cadastrar novo cliente</button>
    </div>
    <div class="row-list">
      ${clients
        .map(
          (c) => `
        <div class="item-row">
          <div class="item-left">
            <div>
              <div class="item-desc">${esc(c.name)} ${c.role === "admin" ? '<span class="role-badge">admin</span>' : ""}</div>
              <div class="item-meta">${esc(c.email)} · criado em ${new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
            </div>
          </div>
          ${c.id !== SESSION.id ? `<button class="btn danger" data-action="adminDeleteClient" data-id="${c.id}">Remover</button>` : `<span class="item-meta">você</span>`}
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="hint">Autenticação real no servidor: senhas com hash bcrypt, sessão via cookie httpOnly, e cada conta só acessa seus próprios dados — validado pelo backend, não apenas pela interface.</div>
  `;
}
function openAdminCreateForm() {
  openModal(`
    <h3>Cadastrar novo cliente</h3>
    <div class="form-grid full"><div class="field"><label>Nome do cliente</label><input id="admin-name" placeholder="Nome completo"></div></div>
    <div class="form-grid full"><div class="field"><label>E-mail</label><input id="admin-email" type="email" placeholder="cliente@email.com"></div></div>
    <div class="form-grid full"><div class="field"><label>Senha provisória</label><input id="admin-password" type="text" placeholder="Mínimo 8 caracteres"></div></div>
    <div class="error-msg" id="admin-error"></div>
    <div class="modal-actions">
      <button class="btn secondary" data-action="closeModal">Cancelar</button>
      <button class="btn" data-action="adminCreateClient">Cadastrar</button>
    </div>
  `);
}
async function adminCreateClient() {
  const name = val("admin-name");
  const email = val("admin-email");
  const password = val("admin-password");
  const errEl = document.getElementById("admin-error");
  try {
    await api("/admin/clients", {
      method: "POST",
      body: { name, email, password },
    });
    closeModal();
    await loadAndRenderAdmin();
  } catch (e) {
    if (errEl)
      errEl.textContent = e.message || "Não foi possível cadastrar o cliente.";
  }
}
async function adminDeleteClient(id) {
  if (
    !confirm(
      "Remover esta conta? Isso apaga permanentemente os dados financeiros dela.",
    )
  )
    return;
  try {
    await api("/admin/clients/" + id, { method: "DELETE" });
    await loadAndRenderAdmin();
  } catch (e) {
    alert(e.message || "Não foi possível remover o cliente.");
  }
}

function applyDelegatedEventHandlers() {
  document.removeEventListener("click", handleDelegatedClick);
  document.removeEventListener("change", handleDelegatedChange);
  document.addEventListener("click", handleDelegatedClick);
  document.addEventListener("change", handleDelegatedChange);
}

function handleDelegatedClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id || null;
  const value = target.dataset.value ?? target.dataset.id ?? null;

  switch (action) {
    case "setAuthMode":
      setAuthMode(value);
      return;
    case "submitAuth":
      if (AUTH_MODE === "login") submitLogin();
      else submitRegister();
      return;
    case "setOnboardMode":
      setOnboardMode(value);
      return;
    case "finishOnboarding":
      finishOnboarding();
      return;
    case "setSettingsMode":
      setSettingsMode(value);
      return;
    case "closeModal":
      closeModal();
      return;
    case "saveSettings":
      saveSettings();
      return;
    case "switchTab":
      switchTab(value);
      return;
    case "renderSettingsModal":
      renderSettingsModal();
      return;
    case "logout":
      logout();
      return;
    case "changeMonth":
      changeMonth(Number(value));
      return;
    case "openTxForm":
      openTxForm();
      return;
    case "removeTx":
      removeTx(id);
      return;
    case "openBudgetForm":
      openBudgetForm();
      return;
    case "removeBudget":
      removeBudget(id);
      return;
    case "openInstallmentForm":
      openInstallmentForm();
      return;
    case "markInstallmentPaid":
      markInstallmentPaid(id);
      return;
    case "undoInstallmentPaid":
      undoInstallmentPaid(id);
      return;
    case "removeInstallment":
      removeInstallment(id);
      return;
    case "openCardForm":
      openCardForm();
      return;
    case "toggleBillPaid":
      toggleBillPaid(id, value);
      return;
    case "removeCard":
      removeCard(id);
      return;
    case "setBillAmount":
      setBillAmount(target.dataset.cardId, target.dataset.month, target.value);
      return;
    case "addJarFunds":
      addJarFunds(id);
      return;
    case "removeJar":
      removeJar(id);
      return;
    case "openCaixinhaForm":
      openCaixinhaForm();
      return;
    case "addCaixinha":
      addCaixinha();
      return;
    case "toggleTithe":
      toggleTithe(id, value);
      return;
    case "openReminderForm":
      openReminderForm();
      return;
    case "toggleReminder":
      toggleReminder(id);
      return;
    case "removeReminder":
      removeReminder(id);
      return;
    case "addReminder":
      addReminder();
      return;
    case "askIA":
      if (target.dataset.id) {
        const input = document.getElementById(target.dataset.id);
        askIA(input ? input.value : "");
      } else {
        askIA(value || "");
      }
      return;
    case "openAdminCreateForm":
      openAdminCreateForm();
      return;
    case "adminDeleteClient":
      adminDeleteClient(Number(id));
      return;
    case "adminCreateClient":
      adminCreateClient();
      return;
    case "addTx":
      addTx();
      return;
    case "addBudget":
      addBudget();
      return;
    case "addInstallment":
      addInstallment();
      return;
    case "addCard":
      addCard();
      return;
    default:
      return;
  }
}

function handleDelegatedChange(event) {
  const target = event.target;
  const action = target.dataset.change;
  if (!action) return;

  switch (action) {
    case "txFilterType":
      txFilterType = target.value;
      render();
      return;
    case "txFilterPerson":
      txFilterPerson = target.value;
      render();
      return;
    case "updateTxCategoryOptions":
      updateTxCategoryOptions();
      return;
    default:
      return;
  }
}

// ---------------- Init ----------------
(async function init() {
  applyDelegatedEventHandlers();
  try {
    const me = await api("/auth/me");
    SESSION = me.user;
    DATA = await loadClientData();
  } catch (e) {
    SESSION = null;
  }
  render();
})();
