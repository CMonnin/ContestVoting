import nodemailer from "nodemailer";
import type { Config } from "./config.ts";

export type Mail = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function smtpTransport(smtp: NonNullable<Config["smtp"]>) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

export function createMailer(cfg: Config): Mailer {
  if (cfg.mailTransport === "console" || !cfg.smtp) {
    return {
      async send(mail) {
        console.log(`[mail] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}\n[/mail]`);
      },
    };
  }
  const transport = smtpTransport(cfg.smtp);
  return {
    async send(mail) {
      await transport.sendMail({ from: cfg.mailFrom, ...mail });
    },
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailShell(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:0;background:#0d0716;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0716">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:rgba(29,15,46,.92);border:1px solid rgba(255,122,26,.35);border-radius:18px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#1d0f2e,#2a1540);padding:28px 32px 20px;text-align:center">
<span style="font-family:'Georgia',serif;font-size:32px;color:#ff7a1a;letter-spacing:.03em">&#127875; Halloween</span>
</td></tr>
<tr><td style="padding:28px 32px 32px;color:#f3e9ff;font-size:15px;line-height:1.6">
${body}
</td></tr>
<tr><td style="padding:0 32px 24px;text-align:center;color:#b9a6d1;font-size:12px;line-height:1.5">
Concours de costumes d&rsquo;Halloween du CRD<br>DRC Halloween Costume Contest<br>
<span style="color:#8a7a9e">Propuls&eacute; par / Brought to you by the DNP</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const SIGNATURE = [
  `— Concours de costumes d'Halloween du CRD / DRC Halloween costume contest`,
  `Propulsé par / Brought to you by the DNP`,
];

export function rejectionEmail(to: string, entryName: string, reason: string | null, baseUrl: string): Mail {
  const url = `${baseUrl}/me/entry`;
  return {
    to,
    subject: `Inscription refusée / Entry not approved — ${entryName}`,
    text: [
      `Votre inscription « ${entryName} » n'a pas été approuvée.`,
      ...(reason ? [`Raison : ${reason}`] : []),
      `Vous pouvez la modifier et la soumettre de nouveau : ${url}`,
      ``,
      `Your entry "${entryName}" was not approved.`,
      ...(reason ? [`Reason: ${reason}`] : []),
      `You can edit it and submit it again: ${url}`,
      ``,
      ...SIGNATURE,
    ].join("\n"),
    html: emailShell(`
<p style="margin:0 0 14px;color:#f3e9ff">Votre inscription &laquo;&nbsp;${esc(entryName)}&nbsp;&raquo; n&rsquo;a pas &eacute;t&eacute; approuv&eacute;e.</p>
${reason ? `<p style="margin:0 0 14px;color:#ffb347"><strong>Raison&nbsp;:</strong> ${esc(reason)}</p>` : ""}
<p style="margin:0 0 20px;color:#f3e9ff">Vous pouvez la modifier et la soumettre de nouveau&nbsp;:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="background:#ff7a1a;border-radius:999px;padding:12px 28px">
<a href="${esc(url)}" style="color:#1a0b00;text-decoration:none;font-weight:600;font-size:15px">Modifier / Edit</a>
</td></tr></table>
<hr style="border:none;border-top:1px solid rgba(255,122,26,.25);margin:20px 0">
<p style="margin:0 0 14px;color:#f3e9ff">Your entry &ldquo;${esc(entryName)}&rdquo; was not approved.</p>
${reason ? `<p style="margin:0 0 14px;color:#ffb347"><strong>Reason:</strong> ${esc(reason)}</p>` : ""}
<p style="margin:0;color:#f3e9ff">You can edit it and submit it again: <a href="${esc(url)}" style="color:#ffb347">${esc(url)}</a></p>
`),
  };
}

export function adminAlertEmail(to: string, newEntries: string[], pendingTotal: number, baseUrl: string): Mail {
  const list = newEntries.map((n) => `  • ${n}`).join("\n");
  const listHtml = newEntries.map((n) => `<li style="color:#f3e9ff;margin:4px 0">${esc(n)}</li>`).join("");
  return {
    to,
    subject: `[Halloween] ${pendingTotal} en attente / pending`,
    text: [
      `Nouvelles inscriptions à approuver / New entries to review:`,
      list,
      ``,
      `Total en attente / pending: ${pendingTotal}`,
      `${baseUrl}/admin`,
    ].join("\n"),
    html: emailShell(`
<p style="margin:0 0 14px;color:#f3e9ff;font-weight:600">Nouvelles inscriptions / New entries to review:</p>
<ul style="margin:0 0 16px;padding-left:20px">${listHtml}</ul>
<p style="margin:0 0 20px;color:#ffb347">Total en attente / pending: <strong>${pendingTotal}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ff7a1a;border-radius:999px;padding:12px 28px">
<a href="${esc(baseUrl)}/admin" style="color:#1a0b00;text-decoration:none;font-weight:600;font-size:15px">Review</a>
</td></tr></table>
`),
  };
}

/** Bilingual on purpose: we don't know the recipient's language before they log in. */
export function codeEmail(to: string, code: string, baseUrl: string): Mail {
  const host = new URL(baseUrl).host;
  const spaced = code.replace(/(\d{3})(\d{3})/, "$1 $2");
  return {
    to,
    subject: `${code} — code Halloween DRC / DRC Halloween code`,
    text: [
      `Votre code de connexion pour ${host} : ${code}`,
      `Il expire dans 10 minutes. Si vous n'avez rien demandé, ignorez ce courriel.`,
      ``,
      `Your login code for ${host}: ${code}`,
      `It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
      ``,
      ...SIGNATURE,
    ].join("\n"),
    html: emailShell(`
<p style="margin:0 0 6px;text-align:center;color:#b9a6d1;font-size:14px">Votre code / Your code</p>
<p style="margin:0 0 8px;text-align:center;font-size:42px;font-weight:700;letter-spacing:.2em;color:#ffb347;font-variant-numeric:tabular-nums">${esc(spaced)}</p>
<p style="margin:0 0 24px;text-align:center;color:#b9a6d1;font-size:13px">Expire dans 10 minutes / Expires in 10 minutes</p>
<hr style="border:none;border-top:1px solid rgba(255,122,26,.25);margin:0 0 16px">
<p style="margin:0 0 8px;color:#f3e9ff;font-size:14px">Votre code de connexion pour ${esc(host)}&nbsp;: <strong style="color:#ffb347">${esc(code)}</strong></p>
<p style="margin:0 0 16px;color:#b9a6d1;font-size:13px">Si vous n&rsquo;avez rien demand&eacute;, ignorez ce courriel.</p>
<p style="margin:0 0 8px;color:#f3e9ff;font-size:14px">Your login code for ${esc(host)}: <strong style="color:#ffb347">${esc(code)}</strong></p>
<p style="margin:0;color:#b9a6d1;font-size:13px">If you didn&rsquo;t ask for it, ignore this email.</p>
`),
  };
}
