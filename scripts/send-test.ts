// Deliverability test (T2): send a sample login email to real inboxes via the configured SMTP.
// Usage: node --env-file=.env scripts/send-test.ts alice@mcgill.ca bob@ssss.gouv.qc.ca ...
// Each recipient reports: arrival time vs the "sent at" line, and inbox vs junk.
// With --verify: only connect and log in to the SMTP server, send nothing (works before DNS is set up).
import { loadConfig } from "../src/config.ts";
import { codeEmail, createMailer, smtpTransport } from "../src/mail.ts";

const cfg = loadConfig();

if (process.argv.includes("--verify")) {
  if (!cfg.smtp) {
    console.error("no SMTP configured (MAIL_TRANSPORT=console or SMTP_* missing)");
    process.exit(1);
  }
  try {
    await smtpTransport(cfg.smtp).verify();
    console.log(`ok    connected and logged in to ${cfg.smtp.host}:${cfg.smtp.port}`);
  } catch (e) {
    console.log(`FAIL  ${cfg.smtp.host}:${cfg.smtp.port}  ${(e as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

const recipients = process.argv.slice(2);
if (recipients.length === 0) {
  console.error("usage: node --env-file=.env scripts/send-test.ts [--verify] <email> [email...]");
  process.exit(1);
}

const mailer = createMailer(cfg);

for (const to of recipients) {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const mail = codeEmail(to, code, cfg.baseUrl);
  const sentAt = new Date().toISOString();
  mail.text += `\n\n[TEST] sent at ${sentAt}. Please reply with the time it arrived and whether it was in Junk.`;
  try {
    await mailer.send(mail);
    console.log(`ok    ${sentAt}  ${to}  code=${code}`);
  } catch (e) {
    console.log(`FAIL  ${sentAt}  ${to}  ${(e as Error).message}`);
  }
}
