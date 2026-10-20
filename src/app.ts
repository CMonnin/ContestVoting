import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import {
  approveEntry,
  getResults,
  listEntries,
  logAdmin,
  publishResults,
  ranking,
  recentLog,
  rejectEntry,
  setExtraDomains,
  unpublishResults,
  voidVote,
  voteAudit,
} from "./admin.ts";
import { ta, type AdminError, type AdminNotice } from "./adminI18n.ts";
import { entriesPage, queuePage, settingsPage, votesPage, type Flash } from "./adminViews.ts";
import { getSessionUser, type AuthDeps } from "./auth.ts";
import { getSetting, setSetting } from "./db.ts";
import { deleteEntry, listApproved } from "./entries.ts";
import { detectLang, errorText, formatDateTime, t, type Lang } from "./i18n.ts";
import { computePhase, isPhase, type Phase } from "./phase.ts";
import { deletePhotoFiles } from "./photos.ts";
import { loadRules } from "./content.ts";
import { seededShuffle } from "./shuffle.ts";
import { authRoutes } from "./routes/auth.ts";
import { entryRoutes } from "./routes/entries.ts";
import {
  DEVICE_COOKIE,
  LANG_COOKIE,
  SESSION_COOKIE,
  YEAR_S,
  type App,
  type Env,
  type RouteCtx,
} from "./routes/context.ts";
import { castVote, myVote, votingOpen } from "./votes.ts";
import { homePage, landingPage, layout, rulesPage } from "./views.ts";

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

export function createApp(deps: AuthDeps) {
  const { db, cfg } = deps;
  const app: App = new Hono<Env>();

  const phaseNow = (): Phase =>
    computePhase(deps.now(), cfg, getSetting(db, "phase_override"), getSetting(db, "results_published") === "1");

  const cookieOpts: RouteCtx["cookieOpts"] = { path: "/", httpOnly: true, secure: cfg.secureCookies, sameSite: "Lax" };

  app.use(async (c, next) => {
    c.header("Content-Security-Policy", CSP);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Robots-Tag", "noindex");

    // Caddy appends the real client address as the last X-Forwarded-For entry.
    const xff = c.req.header("x-forwarded-for");
    const socketIp = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket
      ?.remoteAddress;
    c.set("ip", (cfg.trustProxy && xff ? xff.split(",").at(-1)!.trim() : socketIp) ?? "unknown");

    let deviceId = getCookie(c, DEVICE_COOKIE);
    if (!deviceId || !/^[\w-]{16,64}$/.test(deviceId)) {
      deviceId = randomBytes(16).toString("base64url");
      setCookie(c, DEVICE_COOKIE, deviceId, { ...cookieOpts, maxAge: YEAR_S });
    }
    c.set("deviceId", deviceId);
    c.set("lang", detectLang(getCookie(c, LANG_COOKIE), c.req.header("accept-language")));
    c.set("user", getSessionUser(deps, getCookie(c, SESSION_COOKIE)));
    await next();
  });

  // CSRF: every state-changing request must come from our own origin.
  app.use(async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD") return next();
    const origin = c.req.header("origin");
    const referer = c.req.header("referer");
    const sameOrigin = origin ? origin === cfg.origin : referer ? referer.startsWith(cfg.origin + "/") : false;
    if (!sameOrigin) return c.text(errorText(c.get("lang"), "origin"), 403);
    return next();
  });

  const render: RouteCtx["render"] = (c, body, status = 200) => c.html(layout(c.get("lang"), c.get("user"), body), status);
  const photosDir = join(cfg.dataDir, "photos");
  const ctx: RouteCtx = { deps, photosDir, cookieOpts, phaseNow, render };

  app.get("/healthz", (c) => c.json({ ok: true, phase: phaseNow() }));

  app.get("/lang/:lang", (c) => {
    const lang = c.req.param("lang");
    if (lang === "fr" || lang === "en") setCookie(c, LANG_COOKIE, lang, { ...cookieOpts, maxAge: YEAR_S });
    const back = c.req.header("referer");
    return c.redirect(back?.startsWith(cfg.origin + "/") ? back.slice(cfg.origin.length) : "/");
  });

  app.get("/", (c) => {
    const lang = c.get("lang");
    const s = t(lang);
    const phase = phaseNow();
    if (phase === "landing") {
      return render(c, landingPage(lang, formatDateTime(cfg.openAt, lang, cfg.tz), loadRules(cfg.contentDir, lang)));
    }
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
        myVote: user ? myVote(db, user.email) : null,
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
    return c.redirect(res.ok ? `/?voted=1#e${entryId}` : `/?e=${res.reason}`);
  });

  app.get("/rules", (c) => render(c, rulesPage(c.get("lang"), loadRules(cfg.contentDir, c.get("lang")))));

  authRoutes(app, ctx);

  entryRoutes(app, ctx);

  // ---- Admin ----------------------------------------------------------------

  const adminGuard = async (c: Context<Env>, next: () => Promise<void>) => {
    const user = c.get("user");
    if (!user) return c.redirect("/login");
    if (!user.isAdmin) return c.notFound();
    await next();
  };
  app.use("/admin", adminGuard);
  app.use("/admin/*", adminGuard);

  const fmtTime = (lang: Lang) => (ms: number) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", {
      timeZone: cfg.tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(ms);

  const flashOf = (c: Context<Env>): Flash => {
    const a = ta(c.get("lang"));
    const n = c.req.query("n");
    const e = c.req.query("e");
    return {
      notice: n && n in a.notice ? (n as AdminNotice) : undefined,
      error: e && e in a.err ? (e as AdminError) : undefined,
    };
  };

  /** Redirect back to the admin page the form was on, carrying a flash message. */
  const back = (c: Context<Env>, flash: { n?: AdminNotice; e?: AdminError }, fallback = "/admin") => {
    const ref = c.req.header("referer");
    const path = ref?.startsWith(cfg.origin + "/admin") ? new URL(ref).pathname : fallback;
    const q = flash.n ? `n=${flash.n}` : `e=${flash.e}`;
    return c.redirect(`${path}?${q}`);
  };

  const admin = (c: Context<Env>) => c.get("user")!.email;
  const entryId = (c: Context<Env>) => Number(c.req.param("id"));

  app.get("/admin", (c) =>
    render(c, queuePage(c.get("lang"), listEntries(db, "pending"), flashOf(c), fmtTime(c.get("lang")))),
  );

  app.get("/admin/entries", (c) => render(c, entriesPage(c.get("lang"), listEntries(db), flashOf(c))));

  app.post("/admin/entries/:id/approve", (c) =>
    back(c, approveEntry(deps, admin(c), entryId(c)) ? { n: "approved" } : { e: "not_found" }),
  );

  app.post("/admin/entries/:id/reject", async (c) => {
    const form = await c.req.parseBody();
    const ok = await rejectEntry(deps, admin(c), entryId(c), String(form.reason ?? ""));
    return back(c, ok ? { n: "rejected" } : { e: "not_found" });
  });

  app.post("/admin/entries/:id/remove", async (c) => {
    const form = await c.req.parseBody();
    if (form.confirm !== "1") return back(c, { e: "confirm" }, "/admin/entries");
    const id = entryId(c);
    const entry = listEntries(db).find((e) => e.id === id);
    if (!entry) return back(c, { e: "not_found" }, "/admin/entries");
    await deletePhotoFiles(photosDir, deleteEntry(db, id));
    logAdmin(db, admin(c), "remove", String(id), `${entry.name} (${entry.ownerEmail})`, deps.now().getTime());
    return back(c, { n: "removed" }, "/admin/entries");
  });

  app.get("/admin/votes", (c) =>
    render(c, votesPage(c.get("lang"), ranking(db), voteAudit(db), flashOf(c), fmtTime(c.get("lang")))),
  );

  app.post("/admin/votes/void", async (c) => {
    const form = await c.req.parseBody();
    return back(c, voidVote(deps, admin(c), String(form.voter ?? "")) ? { n: "voided" } : { e: "not_found" }, "/admin/votes");
  });

  app.get("/admin/settings", (c) => {
    const phase = phaseNow();
    return render(
      c,
      settingsPage(
        c.get("lang"),
        {
          phase,
          override: getSetting(db, "phase_override"),
          baseDomains: cfg.allowedDomains,
          extraDomains: getSetting(db, "extra_domains") ?? "",
          ranked: ranking(db),
          results: getResults(db),
          published: getSetting(db, "results_published") === "1",
          canPublish: phase === "closed" || phase === "results",
          log: recentLog(db),
        },
        flashOf(c),
        fmtTime(c.get("lang")),
      ),
    );
  });

  app.post("/admin/settings/phase", async (c) => {
    const form = await c.req.parseBody();
    const value = String(form.override ?? "");
    const override = isPhase(value) ? value : null;
    setSetting(db, "phase_override", override);
    logAdmin(db, admin(c), "phase_override", null, override ?? "auto", deps.now().getTime());
    return back(c, { n: "saved" }, "/admin/settings");
  });

  app.post("/admin/settings/domains", async (c) => {
    const form = await c.req.parseBody();
    const res = setExtraDomains(deps, admin(c), String(form.domains ?? ""));
    return back(c, res === "invalid" ? { e: "invalid_domains" } : { n: "saved" }, "/admin/settings");
  });

  app.post("/admin/results/publish", async (c) => {
    const phase = phaseNow();
    if (phase !== "closed" && phase !== "results") return back(c, { e: "voting_open" }, "/admin/settings");
    const form = await c.req.parseBody();
    const ids = [form.place1, form.place2, form.place3].map((v) => String(v ?? "")).filter(Boolean).map(Number);
    const res = publishResults(deps, admin(c), ids);
    return back(c, res === "ok" ? { n: "published" } : { e: "invalid_results" }, "/admin/settings");
  });

  app.post("/admin/results/unpublish", (c) => {
    unpublishResults(deps, admin(c));
    return back(c, { n: "unpublished" }, "/admin/settings");
  });

  return app;
}
