import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { getSessionUser, type AuthDeps } from "./auth.ts";
import { getSetting } from "./db.ts";
import { detectLang, errorText } from "./i18n.ts";
import { computePhase, type Phase } from "./phase.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import {
  DEVICE_COOKIE,
  LANG_COOKIE,
  SESSION_COOKIE,
  YEAR_S,
  type App,
  type Env,
  type RouteCtx,
} from "./routes/context.ts";
import { entryRoutes } from "./routes/entries.ts";
import { publicRoutes } from "./routes/public.ts";
import { layout } from "./views.ts";

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

  publicRoutes(app, ctx);
  authRoutes(app, ctx);
  entryRoutes(app, ctx);
  adminRoutes(app, ctx);

  return app;
}
