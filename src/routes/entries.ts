import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { bodyLimit } from "hono/body-limit";
import { deleteEntry, getEntryByOwner, photoOwner, saveEntry, validateFields } from "../entries.ts";
import { errorText, t, type ErrorKey } from "../i18n.ts";
import type { Phase } from "../phase.ts";
import { deletePhotoFiles, isPhotoName, MAX_PHOTO_BYTES, MAX_PHOTOS, processPhoto, storePhoto } from "../photos.ts";
import { entryPage } from "../views.ts";
import type { App, RouteCtx } from "./context.ts";

export function entryRoutes(app: App, { deps, photosDir, phaseNow, render }: RouteCtx) {
  const { db } = deps;
  const canEdit = (p: Phase) => p === "open";
  const canWithdraw = (p: Phase) => p === "open" || p === "voting";

  app.use("/me/*", async (c, next) => (c.get("user") ? next() : c.redirect("/login")));

  app.get("/me/entry", (c) => {
    const lang = c.get("lang");
    const phase = phaseNow();
    const s = t(lang);
    const notice = c.req.query("saved") ? s.saved : c.req.query("withdrawn") ? s.withdrawn : undefined;
    const entry = getEntryByOwner(db, c.get("user")!.email);
    return render(c, entryPage(lang, { entry, canEdit: canEdit(phase), canWithdraw: canWithdraw(phase), notice }));
  });

  app.post("/me/entry", bodyLimit({ maxSize: MAX_PHOTOS * MAX_PHOTO_BYTES + 1024 * 1024 }), async (c) => {
    const lang = c.get("lang");
    const owner = c.get("user")!.email;
    const phase = phaseNow();
    const entry = getEntryByOwner(db, owner);
    const form = await c.req.parseBody({ all: true });
    const values = { name: String(form.name ?? "").trim(), caption: String(form.caption ?? "").trim() };
    const fail = (key: ErrorKey) =>
      render(
        c,
        entryPage(lang, { entry, canEdit: canEdit(phase), canWithdraw: canWithdraw(phase), values, error: errorText(lang, key) }),
        400,
      );

    if (!canEdit(phase)) return fail("submissions_closed");
    const fieldError = validateFields(values.name, values.caption, form.consent === "1");
    if (fieldError) return fail(fieldError);

    const files = [form.photos].flat().filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_PHOTOS) return fail("too_many_photos");
    if (files.length === 0 && !entry) return fail("photos_required");

    // Process every photo before storing any, so a bad file leaves nothing behind.
    const processed = [];
    for (const f of files) {
      const res = await processPhoto(new Uint8Array(await f.arrayBuffer()));
      if (!res.ok) return fail(res.error);
      processed.push(res);
    }
    const stored = [];
    for (const p of processed) stored.push(await storePhoto(photosDir, p.full, p.thumb));

    const { replaced } = saveEntry(db, {
      owner,
      name: values.name,
      caption: values.caption,
      photos: stored.length ? stored : null,
      now: deps.now().getTime(),
    });
    await deletePhotoFiles(photosDir, replaced);
    return c.redirect("/me/entry?saved=1");
  });

  app.post("/me/entry/withdraw", async (c) => {
    const lang = c.get("lang");
    const phase = phaseNow();
    const entry = getEntryByOwner(db, c.get("user")!.email);
    if (!entry) return c.redirect("/me/entry");
    const form = await c.req.parseBody();
    const error = !canWithdraw(phase) ? "withdraw_closed" : form.confirm !== "1" ? "withdraw_confirm" : null;
    if (error) {
      return render(
        c,
        entryPage(lang, { entry, canEdit: canEdit(phase), canWithdraw: canWithdraw(phase), error: errorText(lang, error) }),
        400,
      );
    }
    await deletePhotoFiles(photosDir, deleteEntry(db, entry.id));
    return c.redirect("/me/entry?withdrawn=1");
  });

  app.get("/photos/:name", async (c) => {
    const name = c.req.param("name");
    if (!isPhotoName(name)) return c.notFound();
    const owner = photoOwner(db, name);
    const user = c.get("user");
    const allowed =
      owner &&
      ((owner.status === "approved" && phaseNow() !== "landing") || user?.email === owner.ownerEmail || user?.isAdmin);
    if (!allowed) return c.notFound();
    try {
      const buf = await readFile(join(photosDir, name));
      return c.body(new Uint8Array(buf), 200, { "Content-Type": "image/webp", "Cache-Control": "private, max-age=300" });
    } catch {
      return c.notFound();
    }
  });
}
