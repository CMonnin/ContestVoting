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
body { margin:0; color:var(--text); font:17px/1.6 "Fredoka",system-ui,sans-serif; background:radial-gradient(ellipse at 50% 0%, var(--bg2) 0%, var(--bg) 65%) fixed, var(--bg); }
a { color:var(--glow); }
.wrap { max-width:640px; margin:0 auto; padding:16px; }
header { display:flex; flex-direction:column; align-items:flex-end; gap:6px; text-align:right; }
header a.lang { padding:6px 16px; border-radius:999px; background:rgba(20,10,32,.75); border:1px solid rgba(255,122,26,.35); color:var(--text); text-decoration:none; font-weight:600; letter-spacing:.05em; }
header form { display:flex; align-items:center; justify-content:flex-end; gap:4px; flex-wrap:wrap; }
h1, h2, h3 { font-family:"Creepster",cursive; font-weight:400; letter-spacing:.04em; }
h1, h2 { color:var(--accent); }
h1 { font-size:clamp(2.6rem,11.5vw,3.6rem); line-height:1; margin:24px 0 16px; text-shadow:0 0 18px rgba(255,122,26,.6), 0 3px 0 #3a1400; }
h3 { font-size:1.5rem; line-height:1.15; margin:18px 0 8px; color:var(--glow); }
.panel { background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:20px clamp(16px,4vw,28px); margin:16px 0; backdrop-filter:blur(4px); }
.panel > :first-child { margin-top:0; }
.panel > :last-child, .card > :last-child { margin-bottom:0; }
label { display:block; font-weight:600; font-size:1.05rem; margin-bottom:6px; }
input, textarea, select { font-family:inherit; }
input { width:100%; font-size:1.1rem; padding:12px; border-radius:10px; border:1px solid var(--field-line); background:var(--field); color:var(--text); }
input:focus, textarea:focus, select:focus { outline:2px solid var(--glow); outline-offset:1px; border-color:transparent; }
input.code { letter-spacing:.4em; text-align:center; font-size:1.6rem; }
button { width:100%; margin-top:12px; padding:14px 26px; font:600 1.1rem "Fredoka",system-ui,sans-serif; border:0; border-radius:999px; background:var(--accent); color:var(--accent-ink); cursor:pointer; box-shadow:0 0 18px rgba(255,122,26,.25); }
button:focus-visible, a:focus-visible { outline:2px solid var(--glow); outline-offset:2px; }
button.link { background:none; box-shadow:none; color:var(--muted); text-decoration:underline; font-weight:400; font-size:1rem; padding:8px; width:auto; }
.help { color:var(--muted); font-size:.95rem; margin:6px 0 0; }
.error { color:var(--danger); font-weight:600; }
h2 { font-size:1.8rem; line-height:1.1; margin:4px 0 10px; }
.winners > h2 { font-size:2.2rem; }
label { margin-top:14px; }
textarea { width:100%; font:inherit; padding:12px; border-radius:10px; border:1px solid var(--field-line); background:var(--field); color:var(--text); }
input[type=file] { font-size:1rem; padding:10px; }
label.check { display:flex; gap:10px; align-items:flex-start; font-weight:400; }
label.check input { width:1.3em; height:1.3em; flex:none; margin:2px 0 0; accent-color:var(--accent); }
fieldset label.check { margin-top:8px; padding:14px 16px; border:1px solid var(--field-line); border-radius:12px; background:var(--field); font-size:1.1rem; cursor:pointer; }
fieldset label.check:has(input:checked) { border-color:var(--accent); background:rgba(255,122,26,.12); }
input[type=file]::file-selector-button { margin-right:12px; padding:8px 16px; border:0; border-radius:999px; background:var(--glow); color:var(--accent-ink); font:600 1rem "Fredoka",system-ui,sans-serif; cursor:pointer; }
fieldset { border:0; padding:0; margin:14px 0 0; }
legend { font-weight:600; font-size:1.05rem; padding:0; }
button.danger { background:transparent; box-shadow:none; color:var(--danger); border:1px solid var(--danger); }
.notice { background:#1f3a1f; color:#c8f0c8; padding:12px 16px; border-radius:12px; }
.notice.warn { background:#4a3b12; color:#ffd77a; }
.badge { display:inline-block; padding:4px 12px; border-radius:999px; font-weight:600; font-size:.9rem; }
.badge.pending { background:#4a3b12; color:#ffd77a; }
.badge.approved { background:#1f3a1f; color:#9be29b; }
.badge.rejected { background:#4a1717; color:#ff9e9e; }
.thumbs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
.thumbs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; display:block; }
nav.main { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 0; }
nav.main a { background:var(--panel); border:1px solid var(--line); color:var(--text); text-decoration:none; padding:10px 18px; border-radius:999px; font-weight:600; font-size:1.05rem; }
nav.admin { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0; }
nav.admin a { padding:8px 14px; border-radius:999px; border:1px solid var(--field-line); color:var(--muted); text-decoration:none; font-weight:600; }
nav.admin a.current { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }
nav.admin + * { margin-top:0; }
select { width:100%; font-size:1rem; padding:10px; border-radius:10px; border:1px solid var(--field-line); background:var(--field); color:var(--text); }
table { width:100%; border-collapse:collapse; font-size:.9rem; display:block; overflow-x:auto; }
td, th { text-align:left; padding:6px 8px; border-bottom:1px solid var(--field-line); vertical-align:top; }
.flag { display:inline-block; background:#4a3b12; color:#ffd77a; border-radius:999px; padding:0 8px; font-size:.8rem; }
button.small { width:auto; margin:0; padding:4px 10px; font-size:.85rem; }
.winners { border:2px solid var(--accent); box-shadow:0 0 30px rgba(255,122,26,.25); }
.code-big { font-size:2.6rem; font-weight:600; color:var(--glow); letter-spacing:.15em; text-align:center; margin:12px 0; font-variant-numeric:tabular-nums; }
.winners ol { font-size:1.15rem; padding-left:1.4em; margin:8px 0 0; }
.winners a { color:var(--text); font-weight:600; }
.gallery { display:grid; gap:16px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:12px 12px 16px; }
.card.voted { border:2px solid #6fd06f; box-shadow:0 0 24px rgba(111,208,111,.25); }
.card .badge { display:block; text-align:center; margin:14px 0 0; padding:13px; font-size:1.1rem; }
.card p { margin:6px 4px 0; }
.card h3 { margin-left:4px; margin-right:4px; }
button.secondary { background:transparent; color:var(--glow); border:1.5px solid var(--glow); box-shadow:none; }
.btn { display:inline-block; margin-top:4px; padding:12px 24px; border-radius:999px; text-decoration:none; font-weight:600; font-size:1.05rem; color:var(--accent-ink); background:var(--accent); box-shadow:0 0 18px rgba(255,122,26,.25); }
.card img.cover { width:100%; height:auto; max-height:75vh; object-fit:contain; border-radius:12px; display:block; background:var(--field); }
.card h3 { font-size:1.9rem; line-height:1.1; margin:14px 0 6px; }
section > h2 { font-size:clamp(2.4rem,11vw,3rem); margin:36px 0 14px; text-shadow:0 0 14px rgba(255,122,26,.5), 0 3px 0 #3a1400; }
/* Night scene, flying bats, fog and footer: copied from the organizers' index.html. */
.wrap { position:relative; z-index:1; }
.sky { position:fixed; top:3vh; left:4vw; width:220px; height:200px; z-index:0; transform-origin:top left; pointer-events:none; }
.moon { position:absolute; top:35px; left:55px; width:110px; height:110px; border-radius:50%; z-index:1; background:radial-gradient(circle at 35% 35%, #fff8d6, #f2d27a 60%, #c99a3a); box-shadow:0 0 60px 20px rgba(255,210,120,.25); animation:moonglow 8s ease-in-out infinite; }
@keyframes moonglow { 0%, 30%, 75%, 100% { box-shadow:0 0 60px 20px rgba(255,210,120,.25); } 45%, 60% { box-shadow:0 0 90px 34px rgba(255,210,120,.4); } }
.obat { position:absolute; top:0; left:0; width:var(--w,26px); z-index:3; offset-path:path("M15,50 a95,36 0 1,0 190,0 a95,36 0 1,0 -190,0"); offset-rotate:0deg; offset-distance:calc(var(--p) * 100%); animation:orbit var(--dur) linear infinite; animation-delay:calc(var(--p) * var(--dur) * -1); }
.obat.wide { offset-path:path("M-15,40 a125,46 0 1,0 250,0 a125,46 0 1,0 -250,0"); }
.obat.rev { animation-direction:reverse; }
.obat svg { width:100%; fill:#000; animation:flap .3s ease-in-out infinite alternate; }
@keyframes orbit {
  0% { offset-distance:0%; transform:none; opacity:.9; z-index:3; }
  25% { offset-distance:25%; transform:scale(1.3); opacity:1; }
  49% { z-index:3; }
  50% { offset-distance:50%; transform:none; opacity:.9; }
  51% { z-index:0; }
  75% { offset-distance:75%; transform:scale(.6); opacity:.55; }
  99% { z-index:0; }
  100% { offset-distance:100%; transform:none; opacity:.9; z-index:3; }
}
.wolf { position:absolute; left:62px; top:92px; width:74px; z-index:2; overflow:visible; }
.wolf .head { transform-box:fill-box; transform-origin:70% 100%; animation:howl 8s ease-in-out infinite; }
@keyframes howl { 0%, 30%, 75%, 100% { transform:rotate(-32deg); } 40%, 65% { transform:rotate(12deg); } }
.wolf .jaw { transform-box:fill-box; transform-origin:100% 100%; animation:jaw 8s ease-in-out infinite; }
@keyframes jaw { 0%, 36%, 70%, 100% { transform:rotate(0); } 42%, 64% { transform:rotate(-22deg); } }
.wolf .wave { fill:none; stroke:#f3e9ff; stroke-width:1.4; stroke-linecap:round; opacity:0; animation:wave 8s ease-out infinite; }
.wolf .wave:nth-of-type(2) { animation-delay:.35s; }
.wolf .wave:nth-of-type(3) { animation-delay:.7s; }
@keyframes wave { 0%, 40% { opacity:0; transform:translate(0,0) scale(.6); } 46% { opacity:.8; } 60% { opacity:0; transform:translate(-8px,-10px) scale(1.3); } 100% { opacity:0; } }
.bat { position:fixed; z-index:0; width:46px; opacity:.8; animation:fly 18s linear infinite; pointer-events:none; }
.bat svg { width:100%; fill:#000; animation:flap .35s ease-in-out infinite alternate; transform-origin:center; }
.bat.b1 { top:18vh; animation-duration:22s; animation-delay:-4s; }
.bat.b2 { top:32vh; width:30px; animation-duration:16s; animation-delay:-10s; }
.bat.b3 { top:10vh; width:36px; animation-duration:26s; animation-delay:-15s; }
@keyframes fly { 0% { transform:translate(-10vw,0); } 25% { transform:translate(25vw,-4vh); } 50% { transform:translate(55vw,3vh); } 75% { transform:translate(85vw,-3vh); } 100% { transform:translate(115vw,0); } }
@keyframes flap { from { transform:none; } to { transform:scaleY(.45); } }
.fog { position:fixed; left:-50%; bottom:-10vh; width:200%; height:40vh; z-index:0; pointer-events:none; background:radial-gradient(ellipse at center, rgba(200,180,230,.12), transparent 60%); animation:drift 30s ease-in-out infinite alternate; }
@keyframes drift { from { transform:translateX(-10%); } to { transform:translateX(10%); } }
h1 { animation:flicker 5s infinite; }
@keyframes flicker { 0%, 92%, 100% { opacity:1; } 93% { opacity:.4; } 94% { opacity:1; } 96% { opacity:.6; } 97% { opacity:1; } }
footer { text-align:center; margin:40px 0 16px; }
.farewell { display:flex; align-items:center; justify-content:center; gap:clamp(8px,2.25vw,18px); }
.farewell span { font-family:"Creepster",cursive; letter-spacing:.05em; font-size:clamp(20px,5.25vw,34px); color:var(--accent); text-shadow:0 0 16px rgba(255,122,26,.55), 0 3px 0 #3a1400; }
.jack { width:clamp(30px,6.75vw,48px); flex:none; animation:bob 3s ease-in-out infinite; overflow:visible; }
.jack:last-child { animation-delay:-1.5s; }
.jack .face { fill:#ffd84a; filter:drop-shadow(0 0 4px #ffb347); animation:candle 2.4s infinite; }
@keyframes bob { 0%, 100% { transform:translateY(0) rotate(-4deg); } 50% { transform:translateY(-6px) rotate(4deg); } }
@keyframes candle { 0%, 100% { opacity:1; } 20% { opacity:.75; } 23% { opacity:1; } 60% { opacity:.85; } 63% { opacity:.6; } 66% { opacity:1; } }
.graveyard { display:block; width:75%; height:auto; margin:14px auto 0; fill:#000; background:radial-gradient(ellipse 65% 130% at 50% 100%, #ffd27a, var(--accent) 40%, rgba(255,122,26,.45) 65%, transparent 85%); -webkit-mask-image:linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image:linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
/* Keep the page clear of the moon until the content column is wide of it. */
@media (max-width:1170px) { .wrap { padding-top:96px; } }
/* On phones the header sits beside the shrunken moon and the nav starts below it. */
@media (max-width:600px) { .sky { top:4px; left:4px; transform:scale(.6); opacity:.75; } .wrap { padding-top:16px; } header { min-height:104px; padding-left:132px; } }
@media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation:none !important; transition-duration:.01ms !important; } }
`;

const BAT = `<svg viewBox="0 0 64 28"><path d="M32 8c2-4 3-6 3-6l1 4c3-1 4 0 4 0s-2 3-2 5c6-6 18-8 26-4-6 1-9 6-9 6s-5-3-9 1c-3-2-7 0-7 3-3-2-5 1-7 5-2-4-4-7-7-5 0-3-4-5-7-3-4-4-9-1-9-1s-3-5-9-6c8-4 20-2 26 4 0-2-2-5-2-5s1-1 4 0l1-4s1 2 3 6z"/></svg>`;

const ORBIT = [
  ["", "0", "9s", "26px"],
  ["", "0.33", "9s", "22px"],
  ["", "0.66", "9s", "18px"],
  [" wide rev", "0.1", "14s", "30px"],
  [" wide rev", "0.6", "14s", "20px"],
  [" wide", "0.4", "11s", "16px"],
];

/** Moon, howling werewolf, bats and fog from the landing page; purely decorative. */
const SCENE = `<div class="sky" aria-hidden="true">
  <div class="moon"></div>
  ${ORBIT.map(([cls, p, dur, w]) => `<div class="obat${cls}" style="--p:${p};--dur:${dur};--w:${w}">${BAT}</div>`).join("\n  ")}
  <svg class="wolf" viewBox="0 0 80 96">
    <path d="M0 96 L4 84 L14 79 L30 82 L44 76 L60 80 L72 78 L80 96 Z" fill="#05020a"/>
    <path fill="#000" d="M30 81 L33 70 L29 62 L31 52 L27 44 L30 36 L28 30 L33 31 L34 25 L38 29 L41 23 L44 28 L48 24 L50 30
      L54 33 L52 40 L55 48 L52 56 L56 64 L66 66 L74 62 L70 70 L58 72 L50 70 L52 81 L46 81 L46 72 L42 70 L38 72 L36 81 Z"/>
    <path fill="#000" d="M30 38 L22 48 L20 58 L16 62 L19 62 L18 66 L21 63 L22 66 L23 61 L25 50 L32 44 Z"/>
    <path fill="#000" d="M50 36 L56 46 L58 55 L62 59 L59 59 L60 63 L57 60 L56 63 L55 58 L52 48 L47 42 Z"/>
    <g class="head">
      <path fill="#000" d="M34 32 L35 21 L28 11 L27 8 L29 7 L38 13 L40 5 L44 12 L48 5 L49 15 L52 22 L53 32 Z"/>
      <path class="jaw" fill="#000" d="M37 23 L29 13 L31 12 L39 20 Z"/>
      <path class="wave" d="M22 0 q-4 -4 -2 -9"/>
      <path class="wave" d="M18 2 q-7 -6 -3 -14"/>
      <path class="wave" d="M14 4 q-10 -8 -4 -19"/>
    </g>
  </svg>
</div>
${["b1", "b2", "b3"].map((b) => `<div class="bat ${b}" aria-hidden="true">${BAT}</div>`).join("\n")}
<div class="fog" aria-hidden="true"></div>`;

const JACK = `<svg class="jack" viewBox="0 0 64 60" aria-hidden="true">
  <path d="M30 10 q-1-7 5-10 l2 3 q-4 2-3 7z" fill="#3c6b2a"/>
  <ellipse cx="20" cy="35" rx="16" ry="22" fill="#e8641a"/>
  <ellipse cx="44" cy="35" rx="16" ry="22" fill="#e8641a"/>
  <ellipse cx="32" cy="35" rx="15" ry="24" fill="#ff7a1a"/>
  <path class="face" d="M17 28 l7-9 7 9z M33 28 l7-9 7 9z M29 37 l3-5 3 5z M14 41 q18 14 36 0 l-5 1 -2 4 -4-3 -4 4 -4-4 -4 4 -4-4 -4 3 -2-4z"/>
</svg>`;

const GRAVEYARD = `<svg class="graveyard" viewBox="0 0 900 70" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <path d="M0 70 V58 Q120 40 260 52 T520 48 T760 50 T900 46 V70Z"/>
  <path d="M70 52 V30 a14 14 0 0 1 28 0 V50z M180 50 V22 h-8 v-6 h8 v-8 h6 v8 h8 v6 h-8 v28z M300 52 V34 a11 11 0 0 1 22 0 V52z
    M600 50 V26 a16 16 0 0 1 32 0 V49z M700 50 V20 h-9 v-6 h9 v-9 h6 v9 h9 v6 h-9 v30z M820 48 V36 a10 10 0 0 1 20 0 V47z"/>
  <path d="M400 50 V26 M430 50 V26 M460 50 V26 M490 50 V26 M390 32 H500 M390 42 H500" stroke="#000" stroke-width="3" fill="none"/>
  <path d="M400 24 l-3 4 h6z M430 24 l-3 4 h6z M460 24 l-3 4 h6z M490 24 l-3 4 h6z"/>
</svg>`;

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
<style>${raw(CSS)}</style>
</head>
<body>
${raw(SCENE)}
<div class="wrap">
<header>
  <a class="lang" href="/lang/${other}">${s.switchLang}</a>
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
<footer>
  <div class="farewell">${raw(JACK)}<span>${s.poweredBy}</span>${raw(JACK)}</div>
  ${raw(GRAVEYARD)}
</footer>
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
    return html`<form method="post" action="/vote"><input type="hidden" name="entry" value="${e.id}"><button class="${mine ? "secondary" : ""}" type="submit">${mine ? s.changeVote : s.vote}</button></form>`;
  };
  const card = (e: GalleryEntry) => html`<article class="card${opts.myVotes[e.category] === e.id ? " voted" : ""}" id="e${e.id}">
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
    ? opts.showEntryLink ? html`<p><a class="btn" href="/me/entry">${s.myEntry}</a></p>` : ""
    : html`${opts.votingOpen ? html`<p>${s.loginToVote}</p>` : ""}<p><a class="btn" href="/login?next=/gallery">${s.login}</a></p>`}
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

/** Where login lands when no page asked for it. */
export const DEFAULT_NEXT = "/gallery";

export function loginPage(lang: Lang, opts: { email?: string; error?: string; next?: string } = {}): Body {
  const s = t(lang);
  const next = opts.next ?? DEFAULT_NEXT;
  return html`<h1>${s.login}</h1>
<form class="panel" method="post" action="/login">
  <input type="hidden" name="next" value="${next}">
  <label for="email">${s.emailLabel}</label>
  <input id="email" name="email" type="email" inputmode="email" autocomplete="email" required value="${opts.email ?? ""}">
  <p class="help">${s.emailHelp}</p>
  ${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}
  <button type="submit">${s.sendCode}</button>
</form>
<p style="text-align:center"><a class="help" href="/login/verify?next=${encodeURIComponent(next)}">${s.haveCode}</a></p>`;
}

/** `email` null: the person already has a code (e.g. from an admin) and types their email here. */
export function verifyPage(lang: Lang, email: string | null, error?: string, next = DEFAULT_NEXT): Body {
  const s = t(lang);
  const again = `/login?next=${encodeURIComponent(next)}`;
  return html`<h1>${s.login}</h1>
<form class="panel" method="post" action="/login/verify">
  <input type="hidden" name="next" value="${next}">
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
  <input type="hidden" name="next" value="${next}">
  <button class="link" type="submit">${s.resend}</button>
  <a class="help" href="${again}">${s.otherEmail}</a>
</form>`
    : html`<p style="text-align:center"><a class="help" href="${again}">${s.sendCode}</a></p>`}`;
}
