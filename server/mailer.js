const nodemailer = require('nodemailer');

// Transporte é criado uma única vez e reaproveitado entre requisições
// (criar um por e-mail seria desperdício de conexão SMTP).
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return transporter;
}

// Em dev, sem GMAIL_USER/GMAIL_APP_PASSWORD configurados, o link só é
// logado no console — dá pra testar o fluxo de reset inteiro sem precisar
// de uma conta Gmail de verdade. Em produção, a ausência das credenciais
// vira erro (barra o envio, não o boot do servidor).
async function sendPasswordResetEmail(to, link) {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('E-mail não configurado (GMAIL_USER/GMAIL_APP_PASSWORD ausentes).');
    }
    console.log(`[dev] Link de redefinição de senha para ${to}: ${link}`);
    return;
  }
  await t.sendMail({
    from: `Cofre <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Redefinição de senha — Cofre',
    text: `Alguém (esperamos que você) pediu para redefinir a senha da sua conta no Cofre.\n\nClique no link abaixo para escolher uma nova senha. Ele é válido por 30 minutos:\n${link}\n\nSe você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.`,
    html: `
      <p>Alguém (esperamos que você) pediu para redefinir a senha da sua conta no <strong>Cofre</strong>.</p>
      <p>Clique no link abaixo para escolher uma nova senha. Ele é válido por 30 minutos:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>
    `
  });
}

module.exports = { sendPasswordResetEmail };
