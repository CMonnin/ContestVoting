import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { deleteSession, normalizeEmail, requestCode, verifyCode } from "../auth.ts";
import { errorText } from "../i18n.ts";
import { DEFAULT_NEXT, loginPage, verifyPage } from "../views.ts";
import { SESSION_COOKIE, type App, type RouteCtx } from "./context.ts";

/** Only same-site paths: "/x" yes; "//evil.com", "/\\evil.com" or "https://…" no. */
export const safeNext = (v: unknown): string =>
  typeof v === "string" && /^\/(?![\/\\])/.test(v) && !/[\\\s]/.test(v) ? v : DEFAULT_NEXT;

/** Send someone to log in, then back to where they were going. */
export const loginFor = (path: string) => `/login?next=${encodeURIComponent(path)}`;

export function authRoutes(app: App, { deps, cookieOpts, phaseNow, render }: RouteCtx) {
  app.get("/login", (c) => {
    const next = safeNext(c.req.query("next"));
    return c.get("user") ? c.redirect(next) : render(c, loginPage(c.get("lang"), { next }));
  });

  app.post("/login", async (c) => {
    const lang = c.get("lang");
    const form = await c.req.parseBody();
    const email = String(form.email ?? "");
    const next = safeNext(form.next);
    const res = await requestCode(deps, email, c.get("ip"), phaseNow() !== "landing");
    if (res.ok) return render(c, verifyPage(lang, res.email, undefined, next));
    const msg = errorText(lang, res.reason, res.reason === "cooldown" ? { s: res.retryAfterSec } : {});
    // A cooldown on resend should keep the user on the code screen.
    if (res.reason === "cooldown") return render(c, verifyPage(lang, normalizeEmail(email), msg, next), 429);
    const status = res.reason === "email_limit" || res.reason === "ip_limit" ? 429 : 400;
    return render(c, loginPage(lang, { email, error: msg, next }), status);
  });

  app.get("/login/verify", (c) => {
    const next = safeNext(c.req.query("next"));
    return c.get("user") ? c.redirect(next) : render(c, verifyPage(c.get("lang"), null, undefined, next));
  });

  app.post("/login/verify", async (c) => {
    const lang = c.get("lang");
    const form = await c.req.parseBody();
    const email = String(form.email ?? "");
    const next = safeNext(form.next);
    const res = verifyCode(deps, email, String(form.code ?? ""), {
      deviceId: c.get("deviceId"),
      ip: c.get("ip"),
      ua: c.req.header("user-agent") ?? "",
    });
    if (res.ok) {
      setCookie(c, SESSION_COOKIE, res.token, { ...cookieOpts, expires: res.expiresAt });
      return c.redirect(next);
    }
    if (res.reason === "wrong") {
      return render(c, verifyPage(lang, email, errorText(lang, "wrong", { n: res.attemptsLeft }), next), 400);
    }
    return render(c, loginPage(lang, { email, error: errorText(lang, res.reason), next }), 400);
  });

  app.post("/logout", (c) => {
    deleteSession(deps.db, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/");
  });
}
