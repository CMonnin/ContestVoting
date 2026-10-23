import assert from "node:assert/strict";
import { test } from "node:test";
import { setSetting } from "../src/db.ts";
import { setup } from "./helpers.ts";

const ORIGIN = "https://halloween.test";
const body = async (ctx: ReturnType<typeof setup>, lang = "fr-CA") => {
  const page = await (await ctx.app.request(`${ORIGIN}/`, { headers: { "accept-language": lang } })).text();
  return /<body[^>]*>/.exec(page)![0];
};

test("/ is the organizers' landing page, its script and assets served alongside", async () => {
  const ctx = setup("2026-10-21T12:00:00Z");
  const res = await ctx.app.request(`${ORIGIN}/`);
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /Halloween at the Douglas/);
  assert.match(page, /<script src="\/landing.js"><\/script>/);
  assert.doesNotMatch(page, /<script>/, "no inline script (CSP)");
  assert.doesNotMatch(page, /googleapis|gstatic/, "fonts are self-hosted");
  assert.match(res.headers.get("content-security-policy")!, /script-src 'self'/);
  for (const [path, type] of [
    ["/landing.js", /javascript/],
    ["/images/en-1.webp", /image\/webp/],
    ["/fonts/fonts.css", /text\/css/],
    ["/fonts/fredoka-latin.woff2", /font\/woff2/],
  ] as const) {
    const r = await ctx.app.request(`${ORIGIN}${path}`);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get("content-type") ?? "", type, path);
  }
  assert.equal((await ctx.app.request(`${ORIGIN}/images/..%2Fpackage.json`)).status, 404);
});

test("landing buttons follow the phase", async () => {
  const ctx = setup("2026-10-21T12:00:00Z");
  assert.equal(await body(ctx), '<body data-lang="fr">', "before opening: both coming soon");
  assert.equal(await body(ctx, "en"), '<body data-lang="en">');

  ctx.clock.now = new Date("2026-10-30T13:00:00Z"); // 09:00 → open
  assert.equal(await body(ctx), '<body data-lang="fr" data-submit="/me/entry" data-gallery="/gallery">');

  ctx.clock.now = new Date("2026-10-31T13:00:00Z"); // submissions closed, voting on
  assert.equal(await body(ctx), '<body data-lang="fr" data-submit="closed" data-gallery="/gallery">');

  setSetting(ctx.db, "phase_override", "results");
  assert.equal(await body(ctx), '<body data-lang="fr" data-submit="closed" data-gallery="/gallery">');
});
