import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { User } from "./auth.ts";
import type { MyVotes } from "./votes.ts";
import type { Results } from "./admin.ts";
import { CATEGORIES, type Entry, type GalleryEntry } from "./entries.ts";
import { t, type Lang } from "./i18n.ts";

type Body = HtmlEscapedString | Promise<HtmlEscapedString>;

const CSS = `
:root { --bg:#0d0716; --bg2:#1d0f2e; --panel:rgba(29,15,46,.78); --line:rgba(255,122,26,.3); --field:#140a22; --field-line:#4a3366; --text:#f3e9ff; --muted:#b9a6d1; --accent:#ff7a1a; --glow:#ffb347; --accent-ink:#1a0b00; --danger:#ff6b6b; }
* { box-sizing:border-box; }
body { margin:0; color:var(--text); font:16px/1.5 "Fredoka",system-ui,sans-serif; background:radial-gradient(ellipse at 50% 0%, var(--bg2) 0%, var(--bg) 65%) fixed, var(--bg); }
a { color:var(--glow); }
.wrap { max-width:640px; margin:0 auto; padding:16px; }
header { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
header a { color:var(--muted); }
/* Creepster only on headings we write; names and emails stay in Fredoka for legibility. */
h1, section > h2, .winners > h2 { font-family:"Creepster",cursive; font-weight:400; letter-spacing:.04em; }
h1, h2 { color:var(--accent); }
h1 { font-size:clamp(2rem,9vw,2.8rem); line-height:1.05; margin:28px 0 12px; text-shadow:0 0 18px rgba(255,122,26,.6), 0 3px 0 #3a1400; }
h3 { font-weight:600; color:var(--glow); }
.panel { background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:20px clamp(16px,4vw,28px); margin:16px 0; backdrop-filter:blur(4px); }
label { display:block; font-weight:600; margin-bottom:6px; }
input { width:100%; font-size:1.1rem; padding:12px; border-radius:8px; border:1px solid #5a4632; background:#0e0b08; color:var(--text); }
input.code { letter-spacing:.4em; text-align:center; font-size:1.6rem; }
button { width:100%; margin-top:12px; padding:14px; font-size:1.05rem; font-weight:700; border:0; border-radius:8px; background:var(--accent); color:var(--accent-ink); cursor:pointer; }
button.link { background:none; color:var(--muted); text-decoration:underline; font-weight:400; padding:8px; width:auto; }
.help { color:var(--muted); font-size:.9rem; margin:6px 0 0; }
.error { color:var(--danger); font-weight:600; }
h2 { font-size:1.3rem; font-weight:600; margin:8px 0 8px; }
.winners > h2 { font-size:1.8rem; }
label { margin-top:14px; }
textarea { width:100%; font:inherit; padding:12px; border-radius:8px; border:1px solid #5a4632; background:#0e0b08; color:var(--text); }
input[type=file] { font-size:1rem; padding:10px; }
label.check { display:flex; gap:10px; align-items:flex-start; font-weight:400; }
label.check input { width:auto; margin-top:4px; }
fieldset { border:0; padding:0; margin:14px 0 0; }
legend { font-weight:600; padding:0; }
button.danger { background:transparent; color:var(--danger); border:1px solid var(--danger); }
.notice { background:#1f3a1f; color:#c8f0c8; padding:12px; border-radius:8px; }
.notice.warn { background:#4a3b12; color:#ffd77a; }
.badge { display:inline-block; padding:4px 12px; border-radius:999px; font-weight:600; font-size:.9rem; }
.badge.pending { background:#4a3b12; color:#ffd77a; }
.badge.approved { background:#1f3a1f; color:#9be29b; }
.badge.rejected { background:#4a1717; color:#ff9e9e; }
.thumbs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
.thumbs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; display:block; }
nav.main { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 0; }
nav.main a { background:var(--panel); color:var(--text); text-decoration:none; padding:8px 14px; border-radius:999px; font-weight:600; }
nav.admin { display:flex; gap:16px; flex-wrap:wrap; margin:16px 0; }
nav.admin a { color:var(--muted); }
nav.admin a.current { color:var(--accent); font-weight:600; }
nav.admin + * { margin-top:0; }
select { width:100%; font-size:1rem; padding:10px; border-radius:8px; border:1px solid #5a4632; background:#0e0b08; color:var(--text); }
table { width:100%; border-collapse:collapse; font-size:.9rem; display:block; overflow-x:auto; }
td, th { text-align:left; padding:6px 8px; border-bottom:1px solid var(--field-line); vertical-align:top; }
.flag { display:inline-block; background:#4a3b12; color:#ffd77a; border-radius:999px; padding:0 8px; font-size:.8rem; }
button.small { width:auto; margin:0; padding:4px 10px; font-size:.85rem; }
.winners { border:2px solid var(--accent); box-shadow:0 0 30px rgba(255,122,26,.25); }
.code-big { font-size:2.6rem; font-weight:600; color:var(--glow); letter-spacing:.15em; text-align:center; margin:12px 0; font-variant-numeric:tabular-nums; }
.winners ol { font-size:1.15rem; padding-left:1.4em; margin:8px 0 0; }
.winners a { color:var(--text); font-weight:600; }
.gallery { display:grid; gap:16px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:12px; }
.card img.cover { width:100%; max-height:70vh; object-fit:cover; border-radius:12px; display:block; }
.card h3 { font-size:1.1rem; margin:12px 0 4px; }
section > h2 { font-size:clamp(1.6rem,7vw,2.2rem); margin:32px 0 12px; }
footer { color:var(--muted); font-size:.85rem; text-align:center; margin:40px 0 16px; }
`;

export function layout(lang: Lang, user: User | null, body: Body): Body {
  const s = t(lang);
  const other = lang === "fr" ? "en" : "fr";
  return html`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${s.title}</title>
<link href="/fonts/fonts.css" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  <a href="/lang/${other}">${s.switchLang}</a>
  ${user
    ? html`<form method="post" action="/logout" style="margin:0">
        <span class="help">${s.loggedInAs} ${user.email}</span>
        <button class="link" type="submit">${s.logout}</button>
      </form>`
    : ""}
</header>
<nav class="main">
  <a href="/">${s.home}</a>
  <a href="/gallery">${s.gallery}</a>
  ${user ? html`<a href="/me/entry">${s.myEntry}</a>` : ""}
  ${user?.isAdmin ? html`<a href="/admin">Admin</a>` : ""}
  ${user ? "" : html`<a href="/login">${s.login}</a>`}
</nav>
${body}
<footer>🎃 ${s.poweredBy}</footer>
</div>
</body>
</html>`;
}

export function homePage(
  lang: Lang,
  opts: {
    phaseText: string;
    user: User | null;
    showEntryLink: boolean;
    entries: GalleryEntry[];
    votingOpen: boolean;
    myVotes: MyVotes;
    results: Results | null;
    notice?: string;
    error?: string;
  },
): Body {
  const s = t(lang);
  const voteControl = (e: GalleryEntry) => {
    if (!opts.votingOpen || !opts.user) return "";
    const mine = opts.myVotes[e.category];
    if (mine === e.id) return html`<p class="badge approved">${s.yourVote}</p>`;
    return html`<form method="post" action="/vote"><input type="hidden" name="entry" value="${e.id}"><button type="submit">${mine ? s.changeVote : s.vote}</button></form>`;
  };
  const card = (e: GalleryEntry) => html`<article class="card" id="e${e.id}">
  <a href="/photos/${e.photos[0].file}"><img class="cover" src="/photos/${e.photos[0].thumb}" alt="${e.name}"></a>
  ${e.photos.length > 1
    ? html`<div class="thumbs">${e.photos.slice(1).map((p) => html`<a href="/photos/${p.file}"><img src="/photos/${p.thumb}" alt=""></a>`)}</div>`
    : ""}
  <h3>${e.name}</h3>
  ${e.caption ? html`<p>${e.caption}</p>` : ""}
  ${voteControl(e)}
</article>`;
  return html`<h1>🎃 ${s.title}</h1>
${opts.notice ? html`<p class="notice" role="status">${opts.notice}</p>` : ""}
${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}
${opts.results
    ? html`<div class="panel winners">
  <h2>${s.winners}</h2>
  ${CATEGORIES.map((c) => {
    const inCat = opts.results!.filter((r) => r.category === c);
    return inCat.length
      ? html`<h3>${s.categories[c]}</h3><ol>${inCat.map(
          (r) => html`<li><a href="#e${r.id}">${r.name}</a> — ${s.votesCount.replace("{n}", String(r.votes))}</li>`,
        )}</ol>`
      : "";
  })}
</div>`
    : ""}
<div class="panel">
  <p><strong>${opts.phaseText}</strong></p>
  ${opts.votingOpen ? html`<p>${s.votePerCategory}</p>` : ""}
  ${opts.user
    ? opts.showEntryLink ? html`<p><a href="/me/entry">${s.myEntry}</a></p>` : ""
    : html`${opts.votingOpen ? html`<p>${s.loginToVote}</p>` : ""}<p><a href="/login">${s.login}</a></p>`}
</div>
${opts.entries.length === 0
    ? html`<p class="help">${s.galleryEmpty}</p>`
    : CATEGORIES.map((c) => {
        const inCat = opts.entries.filter((e) => e.category === c);
        return inCat.length
          ? html`<section id="${c}"><h2>${s.categories[c]}</h2><div class="gallery">${inCat.map(card)}</div></section>`
          : "";
      })}`;
}

export type EntryFormValues = { name: string; category: string; caption: string };

export function entryPage(
  lang: Lang,
  opts: {
    entry: Entry | null;
    canEdit: boolean;
    canWithdraw: boolean;
    values?: EntryFormValues;
    error?: string;
    notice?: string;
  },
): Body {
  const s = t(lang);
  const { entry } = opts;
  const values = opts.values ?? { name: entry?.name ?? "", category: entry?.category ?? "", caption: entry?.caption ?? "" };
  return html`<h1>${s.myEntry}</h1>
${opts.notice ? html`<p class="notice" role="status">${opts.notice}</p>` : ""}
${entry
    ? html`<div class="panel">
  <p><span class="badge ${entry.status}">${s.status[entry.status]}</span></p>
  ${entry.status === "rejected"
    ? html`${entry.rejectReason ? html`<p>${s.rejectReason} ${entry.rejectReason}</p>` : ""}<p class="help">${s.rejectedHelp}</p>`
    : ""}
  <h2>${entry.name}</h2>
  <p class="help">${s.categories[entry.category]}</p>
  ${entry.caption ? html`<p>${entry.caption}</p>` : ""}
  <div class="thumbs">${entry.photos.map((p) => html`<a href="/photos/${p.file}"><img src="/photos/${p.thumb}" alt=""></a>`)}</div>
</div>`
    : ""}
${opts.canEdit
    ? html`<form class="panel" method="post" action="/me/entry" enctype="multipart/form-data">
  ${entry ? html`<p class="help">${s.editNote}</p>` : ""}
  <label for="name">${s.nameLabel}</label>
  <input id="name" name="name" maxlength="60" required value="${values.name}">
  <fieldset>
    <legend>${s.categoryLabel}</legend>
    ${CATEGORIES.map(
      (c) => html`<label class="check"><input type="radio" name="category" value="${c}" required ${values.category === c ? "checked" : ""}> ${s.categories[c]}</label>`,
    )}
  </fieldset>
  <label for="caption">${s.captionLabel}</label>
  <textarea id="caption" name="caption" maxlength="200" rows="3">${values.caption}</textarea>
  <label for="photos">${s.photosLabel}</label>
  <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple ${entry ? "" : "required"}>
  <p class="help">${entry ? s.photosHelpEdit : s.photosHelpNew}</p>
  <label class="check"><input type="checkbox" name="consent" value="1" required> ${s.consentLabel}</label>
  ${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}
  <button type="submit">${entry ? s.saveChanges : s.submit}</button>
</form>`
    : html`${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}${entry ? "" : html`<div class="panel"><p>${s.submissionsClosed}</p></div>`}`}
${entry && opts.canWithdraw
    ? html`<form class="panel" method="post" action="/me/entry/withdraw">
  <h2>${s.withdrawTitle}</h2>
  <label class="check"><input type="checkbox" name="confirm" value="1" required> ${s.withdrawConfirm}</label>
  <button class="danger" type="submit">${s.withdraw}</button>
</form>`
    : ""}`;
}

export function loginPage(lang: Lang, opts: { email?: string; error?: string } = {}): Body {
  const s = t(lang);
  return html`<h1>${s.login}</h1>
<form class="panel" method="post" action="/login">
  <label for="email">${s.emailLabel}</label>
  <input id="email" name="email" type="email" inputmode="email" autocomplete="email" required value="${opts.email ?? ""}">
  <p class="help">${s.emailHelp}</p>
  ${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}
  <button type="submit">${s.sendCode}</button>
</form>
<p style="text-align:center"><a class="help" href="/login/verify">${s.haveCode}</a></p>`;
}

/** `email` null: the person already has a code (e.g. from an admin) and types their email here. */
export function verifyPage(lang: Lang, email: string | null, error?: string): Body {
  const s = t(lang);
  return html`<h1>${s.login}</h1>
<form class="panel" method="post" action="/login/verify">
  ${email
    ? html`<p>${s.codeSentTo} <strong>${email}</strong></p>
  <p class="notice warn">📬 ${raw(s.junkHint)}</p>
  <input type="hidden" name="email" value="${email}">`
    : html`<label for="email">${s.emailLabel}</label>
  <input id="email" name="email" type="email" inputmode="email" autocomplete="email" required>`}
  <label for="code">${s.codeLabel}</label>
  <input id="code" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="7" required autofocus>
  <p class="help">${s.codeHelp}</p>
  ${error ? html`<p class="error" role="alert">${error}</p>` : ""}
  <button type="submit">${s.verify}</button>
</form>
${email
    ? html`<form method="post" action="/login" style="text-align:center">
  <input type="hidden" name="email" value="${email}">
  <button class="link" type="submit">${s.resend}</button>
  <a class="help" href="/login">${s.otherEmail}</a>
</form>`
    : html`<p style="text-align:center"><a class="help" href="/login">${s.sendCode}</a></p>`}`;
}
