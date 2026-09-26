import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) {
    transporter = null;
    return transporter;
  }

  const port = parseInt(process.env["SMTP_PORT"] ?? "587", 10);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function isMailerConfigured(): boolean {
  return getTransporter() !== null;
}

/**
 * E-posta gönderir. SMTP yapılandırılmamışsa `false` döner (çağıran taraf
 * geliştirme ortamında bağlantıyı loglayabilir).
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  await t.sendMail({
    from: process.env["EMAIL_FROM"] ?? process.env["SMTP_USER"],
    to: params.to,
    subject: params.subject,
    text: params.text,
    ...(params.html ? { html: params.html } : {}),
  });
  return true;
}
