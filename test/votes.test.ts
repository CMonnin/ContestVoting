import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../src/db.ts";
import { saveEntry } from "../src/entries.ts";
import { castVote, myVotes } from "../src/votes.ts";

function db() {
  const d = openDb(":memory:");
  const add = (owner: string, status: string, category = "individual") =>
    Number(
      d
        .prepare("INSERT INTO entries (owner_email, name, category, status, consent_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, 0)")
        .run(owner, owner, category, status).lastInsertRowid,
    );
  return {
    d,
    approved: add("a@x", "approved"),
    other: add("b@x", "approved"),
    pending: add("c@x", "pending"),
    group: add("g@x", "approved", "group"),
  };
}

const meta = { deviceId: "dev", ip: "1.1.1.1", ua: "ua", now: 1 };
const count = (d: ReturnType<typeof db>["d"]) => (d.prepare("SELECT COUNT(*) AS n FROM votes").get() as { n: number }).n;

test("one vote per voter per category; voting again in a category replaces it", () => {
  const { d, approved, other } = db();
  assert.deepEqual(castVote(d, "open", "v@x", approved, meta), { ok: true });
  assert.deepEqual(myVotes(d, "v@x"), { individual: approved });
  assert.deepEqual(castVote(d, "voting", "v@x", other, { ...meta, now: 2 }), { ok: true });
  assert.deepEqual(myVotes(d, "v@x"), { individual: other });
  assert.equal(count(d), 1);
});

test("a vote in each category: both kept", () => {
  const { d, approved, group } = db();
  castVote(d, "open", "v@x", approved, meta);
  castVote(d, "open", "v@x", group, meta);
  assert.deepEqual(myVotes(d, "v@x"), { individual: approved, group });
  assert.equal(count(d), 2);
});

test("only approved entries, only while voting is open", () => {
  const { d, approved, pending } = db();
  assert.deepEqual(castVote(d, "open", "v@x", pending, meta), { ok: false, reason: "not_votable" });
  assert.deepEqual(castVote(d, "open", "v@x", 999, meta), { ok: false, reason: "not_votable" });
  for (const phase of ["landing", "closed", "results"] as const) {
    assert.deepEqual(castVote(d, phase, "v@x", approved, meta), { ok: false, reason: "voting_closed" });
  }
  assert.deepEqual(myVotes(d, "v@x"), {});
});

test("self-votes are allowed", () => {
  const { d, approved } = db();
  assert.deepEqual(castVote(d, "open", "a@x", approved, meta), { ok: true });
});

test("moving an entry to the other category drops its votes; other edits keep them", () => {
  const { d, approved } = db();
  castVote(d, "open", "v@x", approved, meta);
  const edit = (category: "individual" | "group") =>
    saveEntry(d, { owner: "a@x", name: "renamed", category, caption: "", photos: null, now: 2 });
  edit("individual");
  assert.equal(count(d), 1, "same category: vote stays");
  edit("group");
  assert.equal(count(d), 0);
});
