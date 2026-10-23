import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db.ts";
import type { Category } from "./entries.ts";
import { processPhoto, storePhoto } from "./photos.ts";

const SEED_DIR = "images/test-entries";

const CATEGORY_MAP: Record<string, Category> = {
  individual: "individual",
  indvidual: "individual", // common typo
  team: "group",
  group: "group",
};

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function entryName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Seed the DB with test entries from images/test-entries/{individual,team}/.
 * Each image file becomes one pre-approved entry. Idempotent: skips entries
 * whose synthetic owner email already exists.
 */
export async function seedTestEntries(db: Db, siteDir: string, photosDir: string): Promise<void> {
  const seedRoot = join(siteDir, SEED_DIR);
  if (!existsSync(seedRoot)) return;

  const subdirs = readdirSync(seedRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (subdirs.length === 0) return;

  let seeded = 0;
  for (const sub of subdirs) {
    const category = CATEGORY_MAP[sub.name.toLowerCase()];
    if (!category) {
      console.log(`[seed] ignoring unknown subfolder: ${sub.name}`);
      continue;
    }

    const dir = join(seedRoot, sub.name);
    const files = readdirSync(dir).filter((f) => {
      const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
      return IMAGE_EXT.has(ext);
    });

    for (const file of files) {
      const name = entryName(file);
      const owner = `test-${file.replace(/[^a-z0-9]/gi, "-").toLowerCase()}@test.invalid`;

      const existing = db.prepare("SELECT 1 FROM entries WHERE owner_email = ?").get(owner);
      if (existing) continue;

      const buf = readFileSync(join(dir, file));
      const result = await processPhoto(new Uint8Array(buf));
      if (!result.ok) {
        console.log(`[seed] skipping ${sub.name}/${file}: ${result.error}`);
        continue;
      }

      const photo = await storePhoto(photosDir, result.full, result.thumb);
      const now = Date.now();
      const id = Number(
        db
          .prepare(
            "INSERT INTO entries (owner_email, name, category, caption, status, consent_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'approved', ?, ?, ?)",
          )
          .run(owner, name, category, "", now, now, now).lastInsertRowid,
      );
      db.prepare("INSERT INTO photos (entry_id, position, file, thumb) VALUES (?, 0, ?, ?)").run(id, photo.file, photo.thumb);
      seeded++;
      console.log(`[seed] ${category}: ${name}`);
    }
  }

  if (seeded > 0) console.log(`[seed] added ${seeded} test entries`);
}
