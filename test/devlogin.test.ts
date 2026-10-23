import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.ts";
import { post, sessionCookie, setup, TEST_ENV } from "./helpers.ts";

const SECRET = "s".repeat(40);
const LANDING = "2026-10-21T12:00:00Z";

test("dev login is off unless DEV_LOGIN_SECRET is set", async () => {
  const ctx = setup();
  assert.equal((await ctx.app.request("https://halloween.test/dev/login")).status, 404);
  const res = await ctx.app.request(post("/dev/login", { email: "admin@example.org", secret: "" }));
  assert.equal(res.status, 404);
  assert.equal(sessionCookie(res), undefined);
});

test("admin + secret logs in without an email, even before opening, and is logged", async () => {
  const ctx = setup(LANDING, { DEV_LOGIN_SECRET: SECRET });
  assert.equal((await ctx.app.request("https://halloween.test/dev/login")).status, 200);
  const res = await ctx.app.request(post("/dev/login", { email: " Admin@Example.org ", secret: SECRET }));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/admin");
  const sid = sessionCookie(res);
  assert.ok(sid);
  assert.equal(ctx.sent.length, 0, "no email");
  const admin = await ctx.app.request("https://halloween.test/admin", { headers: { cookie: `sid=${sid}` } });
  assert.equal(admin.status, 200);
  const log = ctx.db.prepare("SELECT admin_email, action FROM admin_log").all();
  assert.deepEqual(log.map((r) => ({ ...r })), [{ admin_email: "admin@example.org", action: "dev_login" }]);
});

test("wrong secret or non-admin email: same refusal, no session", async () => {
  const ctx = setup(undefined, { DEV_LOGIN_SECRET: SECRET });
  for (const [email, secret] of [
    ["admin@example.org", SECRET.slice(1)],
    ["admin@example.org", ""],
    ["alice@mcgill.ca", SECRET],
    ["tester@mcgill.ca", SECRET],
  ]) {
    const res = await ctx.app.request(post("/dev/login", { email, secret }));
    assert.equal(res.status, 400, `${email} / ${secret.length}`);
    assert.equal(sessionCookie(res), undefined);
    assert.match(await res.text(), /Refus/);
  }
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS n FROM sessions").get()!.n, 0);
});

test("dev login POST from another origin is refused", async () => {
  const ctx = setup(undefined, { DEV_LOGIN_SECRET: SECRET });
  const res = await ctx.app.request(
    post("/dev/login", { email: "admin@example.org", secret: SECRET }, { origin: "https://evil.example" }),
  );
  assert.equal(res.status, 403);
  assert.equal(sessionCookie(res), undefined);
});

test("DEV_LOGIN_SECRET must be long and differ from SESSION_SECRET", () => {
  assert.throws(() => loadConfig({ ...TEST_ENV, DEV_LOGIN_SECRET: "short" }), /at least 32/);
  assert.throws(() => loadConfig({ ...TEST_ENV, DEV_LOGIN_SECRET: TEST_ENV.SESSION_SECRET }), /differ/);
  assert.equal(loadConfig({ ...TEST_ENV, DEV_LOGIN_SECRET: "  " }).devLoginSecret, null);
});
