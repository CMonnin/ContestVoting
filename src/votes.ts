import type { Db } from "./db.ts";
import type { Category } from "./entries.ts";
import type { Phase } from "./phase.ts";

export const votingOpen = (phase: Phase) => phase === "open" || phase === "voting";

export type VoteResult = { ok: true } | { ok: false; reason: "voting_closed" | "not_votable" };

/**
 * One vote per email per category; voting again in a category replaces the earlier
 * vote there. Only approved entries can receive votes. Device, IP and user agent
 * are kept for the admin audit.
 */
export function castVote(
  db: Db,
  phase: Phase,
  voter: string,
  entryId: number,
  meta: { deviceId: string; ip: string; ua: string; now: number },
): VoteResult {
  if (!votingOpen(phase)) return { ok: false, reason: "voting_closed" };
  const entry = db.prepare("SELECT status, category FROM entries WHERE id = ?").get(entryId) as
    | { status: string; category: Category }
    | undefined;
  if (entry?.status !== "approved") return { ok: false, reason: "not_votable" };
  db.prepare(
    `INSERT INTO votes (voter_email, category, entry_id, device_id, ip, ua, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(voter_email, category) DO UPDATE SET entry_id = excluded.entry_id, device_id = excluded.device_id,
       ip = excluded.ip, ua = excluded.ua, updated_at = excluded.updated_at`,
  ).run(voter, entry.category, entryId, meta.deviceId, meta.ip, meta.ua.slice(0, 300), meta.now);
  return { ok: true };
}

export type MyVotes = Partial<Record<Category, number>>;

export function myVotes(db: Db, voter: string): MyVotes {
  const rows = db.prepare("SELECT category, entry_id FROM votes WHERE voter_email = ?").all(voter) as {
    category: Category;
    entry_id: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.category, r.entry_id]));
}
