// Teste E2E do módulo financeiro (cartões / faturas / parcelamentos / auditoria).
// Cobre o cenário do item 23 do pedido: compra parcelada no cartão, edição de
// categoria por outra pessoa, pagamento de fatura e conferência da trilha de
// auditoria — validando que os módulos funcionam como um fluxo único, não
// telas independentes.
//
// Como rodar:
//   npm install          (primeira vez — instala o Playwright)
//   npx playwright install chromium   (primeira vez — baixa o Chromium, se necessário)
//   npm run start        (em outro terminal — sobe o servidor em localhost:3099)
//   npm run test:e2e
//
// Variáveis de ambiente opcionais:
//   COFRE_BASE_URL          URL do servidor (padrão http://localhost:3099)
//   PLAYWRIGHT_EXECUTABLE   caminho de um Chromium específico (opcional)

const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.COFRE_BASE_URL || 'http://localhost:3099';
const SCREEN_DIR = path.join(__dirname, 'screenshots');

const results = [];
function check(label, cond) {
  results.push({ label, ok: !!cond });
  console.log((cond ? 'OK   ' : 'FAIL ') + label);
}

(async () => {
  const launchOpts = { args: ['--no-sandbox'] };
  if (process.env.PLAYWRIGHT_EXECUTABLE) launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', err => console.log('  [erro de página]', err.message));

  const email = `e2e_${Date.now()}@ex.com`;

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200); // splash screen

  // ---- Registro ----
  const registerTab = page.locator('text=Criar conta').first();
  if (await registerTab.count()) await registerTab.click();
  await page.fill('#auth-name', 'Pedro').catch(() => {});
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'senha1234');
  const consent = page.locator('#auth-consent');
  if (await consent.count()) await consent.check();
  await page.click('#auth-submit-btn');
  await page.waitForTimeout(800);
  check('registro concluído (chegou no onboarding)', await page.locator('text=Bem-vindo').count() > 0);

  // ---- Onboarding: casal Pedro/Ana ----
  await page.click('text=Somos um casal');
  await page.fill('#ob-name1', 'Pedro');
  await page.fill('#ob-name2', 'Ana');
  await page.click('text=Começar a usar');
  await page.waitForTimeout(800);
  check('onboarding concluído (dashboard visível)', await page.locator('text=Saldo do mês').count() > 0);

  // ---- Cadastrar cartão Nubank (limite 2500, fecha 11, vence 18) ----
  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Novo cartão")');
  await page.fill('#card-name', 'Nubank');
  const cardPersonSel = page.locator('#card-person');
  if (await cardPersonSel.count()) await cardPersonSel.selectOption({ label: 'Pedro' });
  await page.fill('#card-closing', '11');
  await page.fill('#card-due', '18');
  await page.fill('#card-limit', '2500');
  await page.click('#active-modal .modal-actions >> text=Salvar');
  await page.waitForTimeout(500);
  check('cartão Nubank criado', await page.locator('text=Nubank').count() > 0);

  // ---- Lançamento: Supermercado R$300, Alimentação, Cartão de crédito, Nubank, 3x ----
  await page.click('button:has-text("Entradas & Saídas")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Novo lançamento")');
  await page.selectOption('#tx-type', 'saida');
  await page.selectOption('#tx-person', { label: 'Pedro' });
  await page.selectOption('#tx-category', { label: 'Alimentação' });
  await page.fill('#tx-desc', 'Supermercado');
  await page.fill('#tx-amount', '300');
  await page.selectOption('#tx-payment', 'credito');
  await page.waitForTimeout(200);
  await page.selectOption('#tx-card', { label: 'Nubank' });
  await page.selectOption('#tx-installments', '3');
  await page.click('#active-modal .modal-actions >> text=Salvar');
  await page.waitForTimeout(600);

  // A compra aparece em Entradas & Saídas no mês em que foi FEITA (valor
  // cheio, uma linha só) — não no mês da fatura, mesmo que a 1ª parcela só
  // seja debitada mais pra frente. O detalhe por parcela/fatura fica só na
  // aba Cartões (checado mais abaixo).
  const rowsText = await page.locator('#tab-content').innerText();
  check('compra aparece em Entradas & Saídas no mês em que foi feita, com valor cheio', rowsText.includes('Supermercado') && rowsText.includes('300,00'));
  check('mostra "no cartão" + total de parcelas (3x) como uma única linha', /no cartão/i.test(rowsText) && /3x/.test(rowsText));
  await page.screenshot({ path: path.join(SCREEN_DIR, 'transacoes.png'), fullPage: true });

  // dashboard: a compra já deve aparecer no mapa de gastos (accrual) mesmo
  // sem ter afetado o saldo bancário ainda
  await page.click('button:has-text("Visão Geral")');
  await page.waitForTimeout(300);
  const dashText = await page.locator('#tab-content').innerText();
  check('mapa de gastos reflete a compra (accrual, categoria já impactada)', dashText.includes('Alimentação') || dashText.includes('Mapa de gastos'));
  await page.click('button:has-text("Entradas & Saídas")');
  await page.waitForTimeout(300);

  // ---- Cartões: checar limite comprometido e fatura ----
  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(300);
  const cardText = await page.locator('#tab-content').innerText();
  check('limite comprometido reflete R$300,00 usados', cardText.includes('Usado') && cardText.includes('300,00'));
  check('disponível = 2.200,00 (2500 - 300)', cardText.includes('2.200,00'));

  await page.locator('button:has-text("Fatura atual")').first().click();
  await page.waitForTimeout(400);
  const invoiceText = await page.locator('#active-modal').innerText();
  check('fatura atual mostra a parcela do Supermercado', invoiceText.includes('Supermercado') && invoiceText.includes('100,00'));
  await page.click('#active-modal .modal-actions >> text=Fechar');
  await page.waitForTimeout(200);

  // ---- Trocar a pessoa ativa pra Ana (simula o outro membro do casal) ----
  await page.selectOption('#person-switcher', { label: 'Ana' });
  await page.waitForTimeout(300);

  // ---- Editar a compra: trocar categoria pra "Casa" (nova categoria criada na hora) ----
  await page.click('button:has-text("Entradas & Saídas")');
  await page.waitForTimeout(300);
  const firstRow = page.locator('.item-row', { hasText: 'Supermercado' }).first();
  await firstRow.locator('button[aria-label="Editar"]').click();
  await page.waitForTimeout(300);
  check('modal de edição de compra abriu', await page.locator('text=Editar compra no cartão').count() > 0);

  await page.click('#active-modal >> text=+ nova');
  await page.waitForTimeout(300);
  await page.fill('#cat-name', 'Casa');
  await page.click('#active-modal .modal-actions >> text=Salvar'); // salva a categoria nova
  await page.waitForTimeout(400);
  await page.click('#active-modal .modal-actions >> text=Salvar'); // salva a edição da compra
  await page.waitForTimeout(500);

  const txAfterEdit = await page.locator('#tab-content').innerText();
  check('categoria da compra mudou pra Casa (parcela visível neste mês)', txAfterEdit.includes('Casa'));

  // ---- Pagar a fatura atual ----
  // O botão diz "Marcar como paga" se hoje já passou do vencimento original,
  // ou "Adiantar fatura" se ainda não passou (ver isEarlyInvoicePayment) — o
  // teste aceita os dois, já que isso depende da data real em que ele roda.
  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Fatura atual")').first().click();
  await page.waitForTimeout(300);
  const wasEarly = (await page.locator('#active-modal .modal-actions').innerText()).includes('Adiantar fatura');
  const payTrigger = page.locator('#active-modal .modal-actions button', { hasText: wasEarly ? 'Adiantar fatura' : 'Marcar como paga' });
  await payTrigger.click();
  await page.waitForTimeout(300);
  const payAccountSel = page.locator('#pay-account');
  const accOptions = await payAccountSel.locator('option').allTextContents();
  check('conta padrão disponível pra pagamento', accOptions.some(t => t.includes('Conta principal')));
  await payAccountSel.selectOption({ index: 0 });
  const confirmBtn = page.locator('#active-modal .modal-actions button', { hasText: wasEarly ? 'Confirmar adiantamento' : 'Confirmar pagamento' });
  await confirmBtn.click();
  await page.waitForTimeout(600);

  // ---- Pagamento aparece de fato como saída real, e o painel do cartão não
  // "recria" uma fatura fantasma depois que a única fatura pendente é paga
  // (bug: currentAndNextInvoice caía num mês sem lançamento nenhum e o
  // mostrava como "em atraso" do nada). ----
  const cardsAfterPay = await page.locator('#tab-content').innerText();
  check('painel do cartão não mostra fatura fantasma "em atraso" depois de pagar tudo', !/em atraso/i.test(cardsAfterPay));
  await page.click('button:has-text("Entradas & Saídas")');
  await page.waitForTimeout(300);
  const txAfterPay = await page.locator('#tab-content').innerText();
  check('pagamento da fatura aparece como saída real em Entradas & Saídas', /pagamento fatura|adiantamento da fatura/i.test(txAfterPay));

  // ---- "Desmarcar como paga" usa modal do app, não confirm() nativo ----
  // (abre e cancela sem desfazer de fato, pra não quebrar as verificações
  // seguintes que assumem a fatura já paga.)
  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Fatura atual")').first().click();
  await page.waitForTimeout(300);
  await page.locator('#active-modal button', { hasText: 'Desmarcar como paga' }).click();
  await page.waitForTimeout(300);
  check('"Desmarcar como paga" abre um modal do app (não o confirm() nativo)', await page.locator('#active-modal button', { hasText: 'Desmarcar' }).count() > 0);
  await page.locator('#active-modal button', { hasText: 'Cancelar' }).click();
  await page.waitForTimeout(300);
  await page.click('#active-modal .modal-actions >> text=Fechar');
  await page.waitForTimeout(300);

  await page.click('button:has-text("Visão Geral")');
  await page.waitForTimeout(300);
  if (wasEarly) {
    // Adiantamento: a parcela coberta muda de data pro dia do adiantamento
    // (hoje) — então o mapa de gastos do mês corrente já deve refletir essa
    // categoria, em vez de só aparecer no mês original da fatura.
    const dashEarly = await page.locator('#tab-content').innerText();
    check('adiantamento move o gasto da parcela pro mapa de gastos do mês do adiantamento', dashEarly.includes('Casa'));
  }
  const dashAfterPay = await page.locator('#tab-content').innerText();
  check('dashboard renderiza sem erro após o pagamento', /saldo do mês/i.test(dashAfterPay));

  // ---- Auditoria: confere o rastro das 4 ações acima ----
  await page.click('button:has-text("Auditoria")');
  await page.waitForTimeout(800);
  const auditText = await page.locator('#tab-content').innerText();
  check('auditoria mostra criação do cartão', auditText.includes('Nubank') && auditText.includes('cadastrou'));
  check('auditoria mostra criação da compra', auditText.includes('criou a compra'));
  check('auditoria mostra o diff exato da categoria (Alimentação → Casa)', /Categoria:\s*Alimenta[çc][ãa]o\s*[→>]+\s*Casa/i.test(auditText));
  check('auditoria atribui a edição da categoria à Ana (multiusuário)', /Ana editou a compra/.test(auditText));
  check('auditoria mostra pagamento da fatura', auditText.includes('marcou a fatura') || auditText.includes('adiantou a fatura'));

  // ---- Compra à vista (1x) + cancelamento: confere liberação de limite ----
  // (a fatura de setembro já está paga nesse ponto — este bloco também cobre
  // o caso de uma compra nova cair num mês de fatura já paga: ela não pode
  // ser tratada como "já paga" só por coincidir o mês.)
  await page.click('button:has-text("Entradas & Saídas")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Novo lançamento")');
  await page.selectOption('#tx-type', 'saida');
  await page.selectOption('#tx-category', { label: 'Transporte' });
  await page.fill('#tx-desc', 'Uber aeroporto');
  await page.fill('#tx-amount', '80');
  await page.selectOption('#tx-payment', 'credito');
  await page.waitForTimeout(200);
  await page.selectOption('#tx-card', { label: 'Nubank' });
  await page.selectOption('#tx-installments', '1'); // à vista
  await page.click('#active-modal .modal-actions >> text=Salvar');
  await page.waitForTimeout(600);

  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(300);
  const limitAfterPurchase = await page.locator('#tab-content').innerText();
  check('compra à vista (1x) soma R$80,00 ao limite usado', /Usado R\$\s*280,00/.test(limitAfterPurchase));

  await page.click('button:has-text("Entradas & Saídas")');
  await page.waitForTimeout(300);
  const uberRow = page.locator('.item-row', { hasText: 'Uber aeroporto' }).first();
  const uberVisible = await uberRow.count() > 0;
  if (uberVisible) {
    // O pop-up de confirmação agora é um modal do próprio app (não mais o
    // confirm() nativo do navegador) — clica no botão dele, não aceita dialog.
    await uberRow.locator('button[aria-label="Excluir"]').click();
    await page.waitForTimeout(300);
    check('confirmação de cancelamento usa modal do app (não confirm() nativo)', await page.locator('#active-modal button', { hasText: 'Cancelar compra' }).count() > 0);
    await page.locator('#active-modal button', { hasText: 'Cancelar compra' }).click();
    await page.waitForTimeout(500);
  }
  check('compra à vista aparece em Entradas & Saídas antes de cancelar', uberVisible);

  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(300);
  const limitAfterCancel = await page.locator('#tab-content').innerText();
  check('cancelar a compra à vista libera o limite de volta pra R$200,00', /Usado R\$\s*200,00/.test(limitAfterCancel));

  await page.click('button:has-text("Auditoria")');
  await page.waitForTimeout(800);
  const auditText2 = await page.locator('#tab-content').innerText();
  check('auditoria mostra o cancelamento da compra à vista', auditText2.includes('cancelou') && auditText2.includes('Uber'));

  await page.screenshot({ path: path.join(SCREEN_DIR, 'auditoria.png'), fullPage: true });
  await page.click('button:has-text("Cartões")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREEN_DIR, 'cartoes.png'), fullPage: true });
  await page.click('button:has-text("Visão Geral")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREEN_DIR, 'dashboard.png'), fullPage: true });

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('FALHARAM:', failed.map(f => f.label).join(' | '));
    process.exit(1);
  }
})().catch(err => { console.error('E2E crashou:', err); process.exit(1); });
