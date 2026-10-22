import { setCookie } from "hono/cookie";
import { getResults } from "../admin.ts";
import { loadRules } from "../content.ts";
import { listApproved } from "../entries.ts";
import { errorText, formatDateTime, t } from "../i18n.ts";
import { seededShuffle } from "../shuffle.ts";
import { homePage, landingPage, rulesPage } from "../views.ts";
import { castVote, myVotes, votingOpen } from "../votes.ts";
import { LANG_COOKIE, YEAR_S, type App, type RouteCtx } from "./context.ts";

export function publicRoutes(app: App, { deps, cookieOpts, phaseNow, render }: RouteCtx) {
  const { db, cfg } = deps;

  app.get("/healthz", (c) => c.json({ ok: true, phase: phaseNow() }));

  app.get("/lang/:lang", (c) => {
    const lang = c.req.param("lang");
    if (lang === "fr" || lang === "en") setCookie(c, LANG_COOKIE, lang, { ...cookieOpts, maxAge: YEAR_S });
    const back = c.req.header("referer");
    return c.redirect(back?.startsWith(cfg.origin + "/") ? back.slice(cfg.origin.length) : "/");
  });

  app.get("/", (c) => {
    const lang = c.get("lang");
    if (phaseNow() !== "landing") return c.redirect("/gallery");
    return render(c, landingPage(lang, formatDateTime(cfg.openAt, lang, cfg.tz), loadRules(cfg.contentDir, lang)));
  });

  app.get("/gallery", (c) => {
    const lang = c.get("lang");
    const s = t(lang);
    const phase = phaseNow();
    if (phase === "landing") return c.redirect("/");
    const text = { open: s.phaseOpen, voting: s.phaseVoting, closed: s.phaseClosed, results: s.phaseResults }[phase];
    const user = c.get("user");
    const entries = seededShuffle(listApproved(db), c.get("deviceId"));
    const err = c.req.query("e");
    return render(
      c,
      homePage(lang, {
        phaseText: text,
        user,
        showEntryLink: votingOpen(phase),
        entries,
        votingOpen: votingOpen(phase),
        myVotes: user ? myVotes(db, user.email) : {},
        results: phase === "results" ? getResults(db) : null,
        notice: c.req.query("voted") ? s.voted : undefined,
        error: err === "voting_closed" || err === "not_votable" ? errorText(lang, err) : undefined,
      }),
    );
  });

  app.post("/vote", async (c) => {
    const user = c.get("user");
    if (!user) return c.redirect("/login");
    const form = await c.req.parseBody();
    const entryId = Number(form.entry);
    const res = castVote(db, phaseNow(), user.email, entryId, {
      deviceId: c.get("deviceId"),
      ip: c.get("ip"),
      ua: c.req.header("user-agent") ?? "",
      now: deps.now().getTime(),
    });
    return c.redirect(res.ok ? `/gallery?voted=1#e${entryId}` : `/gallery?e=${res.reason}`);
  });

  app.get("/rules", (c) => render(c, rulesPage(c.get("lang"), loadRules(cfg.contentDir, c.get("lang")))));
}
