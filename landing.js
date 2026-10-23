// Landing page behaviour. The app sets the button state on <body> for the current phase:
//   data-submit / data-gallery = a path (button live), "closed", or absent (coming soon)
//   data-lang = the language the app picked for this visitor
// Served as a file because the app's CSP blocks inline scripts.

const I18N = {
  en: { pageTitle: "Halloween at the Douglas 2026", footer: "Happy Halloween!", closed: "(Closed)" },
  fr: { pageTitle: "Halloween au Douglas 2026", footer: "Joyeuse Halloween !", closed: "(Fermé)" }
};

const state = document.body.dataset;

function detectLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q && I18N[q]) return q;
  try {
    const saved = localStorage.getItem("lang");
    if (saved && I18N[saved]) return saved;
  } catch (e) {}
  if (I18N[state.lang]) return state.lang;
  const prefs = navigator.languages || [navigator.language || "en"];
  for (const p of prefs) {
    const code = (p || "").slice(0, 2).toLowerCase();
    if (I18N[code]) return code;
  }
  return "en";
}

function setLang(lang, persist) {
  const t = I18N[lang];
  document.documentElement.lang = lang;
  document.title = t.pageTitle;
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t[el.dataset.i18n]);
  document.querySelectorAll("[data-lang-block]").forEach(el => el.hidden = el.dataset.langBlock !== lang);
  document.querySelectorAll(".lang button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  if (persist) {
    try { localStorage.setItem("lang", lang); } catch (e) {}
    // Keep the app's pages (gallery, login…) in the same language.
    fetch("/lang/" + lang, { redirect: "manual" }).catch(() => {});
  }
}

document.querySelectorAll("[data-link]").forEach(a => {
  const value = state[a.dataset.link];
  if (value && value !== "closed") {
    a.href = value;
    a.querySelector("small").remove();
    return;
  }
  if (value === "closed") {
    const lang = a.closest("[data-lang-block]").dataset.langBlock;
    a.querySelector("small").textContent = I18N[lang].closed;
  }
  a.setAttribute("aria-disabled", "true");
  a.addEventListener("click", e => e.preventDefault());
});

document.querySelectorAll(".lang button").forEach(b =>
  b.addEventListener("click", () => setLang(b.dataset.lang, true)));

setLang(detectLang(), false);
