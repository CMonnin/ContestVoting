import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { deleteSession, requestCode, verifyCode } from "../auth.ts";
import { errorText } from "../i18n.ts";
import { loginPage, verifyPage } from "../views.ts";
import { SESSION_COOKIE, type App, type RouteCtx } from "./context.ts";

export function authRoutes(app: App, { deps, cookieOpts, phaseNow, render }: RouteCtx) {
  app.get("/login", (c) => (c.get("user") ? c.redirect("/") : render(c, loginPage(c.get("lang")))));

  app.post("/login", async (c) => {
    const lang = c.get("lang");
    const form = await c.req.parseBody();
    const email = String(form.email ?? "");
    const res = await requestCode(deps, email, c.get("ip"), phaseNow() !== "landing");
    if (res.ok) return render(c, verifyPage(lang, res.email));
    const msg = errorText(lang, res.reason, res.reason === "cooldown" ? { s: res.retryAfterSec } : {});
    // A cooldown on resend should keep the user on the code screen.
    if (res.reason === "cooldown") return render(c, verifyPage(lang, email.trim().toLowerCase(), msg), 429);
    const status = res.reason === "email_limit" || res.reason === "ip_limit" ? 429 : 400;
    return render(c, loginPage(lang, { email, error: msg }), status);
  });

  app.get("/login/verify", (c) => (c.get("user") ? c.redirect("/") : render(c, verifyPage(c.get("lang"), null))));

  app.post("/login/verify", async (c) => {
    const lang = c.get("lang");
    const form = await c.req.parseBody();
    const email = String(form.email ?? "");
    const res = verifyCode(deps, email, String(form.code ?? ""), {
      deviceId: c.get("deviceId"),
      ip: c.get("ip"),
      ua: c.req.header("user-agent") ?? "",
    });
    if (res.ok) {
      setCookie(c, SESSION_COOKIE, res.token, { ...cookieOpts, expires: res.expiresAt });
      return c.redirect("/");
    }
    if (res.reason === "wrong") {
      return render(c, verifyPage(lang, email, errorText(lang, "wrong", { n: res.attemptsLeft })), 400);
    }
    return render(c, loginPage(lang, { email, error: errorText(lang, res.reason) }), 400);
  });

  app.post("/logout", (c) => {
    deleteSession(deps.db, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/");
  });
}
