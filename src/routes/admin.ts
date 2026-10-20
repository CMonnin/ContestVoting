import type { Context } from "hono";
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
} from "../admin.ts";
import { ta, type AdminError, type AdminNotice } from "../adminI18n.ts";
import { entriesPage, queuePage, settingsPage, votesPage, type Flash } from "../adminViews.ts";
import { getSetting, setSetting } from "../db.ts";
import { deleteEntry } from "../entries.ts";
import type { Lang } from "../i18n.ts";
import { isPhase } from "../phase.ts";
import { deletePhotoFiles } from "../photos.ts";
import type { App, Env, RouteCtx } from "./context.ts";

export function adminRoutes(app: App, { deps, photosDir, phaseNow, render }: RouteCtx) {
  const { db, cfg } = deps;

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
}
