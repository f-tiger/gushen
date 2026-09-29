import test from "node:test";
import assert from "node:assert/strict";
import { completedDateCutoff, completedRows } from "./completed-session.mjs";
test("summer excludes the live bar and waits one hour after regular close", () => {
  assert.equal(
    completedDateCutoff(new Date("2026-09-29T20:59:59Z")),
    "2026-09-28",
  );
  assert.equal(
    completedDateCutoff(new Date("2026-09-29T21:00:00Z")),
    "2026-09-29",
  );
});
test("winter, midnight and DST use New York local time", () => {
  assert.equal(
    completedDateCutoff(new Date("2026-01-12T21:59:59Z")),
    "2026-01-11",
  );
  assert.equal(
    completedDateCutoff(new Date("2026-01-12T22:00:00Z")),
    "2026-01-12",
  );
  assert.equal(
    completedDateCutoff(new Date("2026-09-30T01:00:00Z")),
    "2026-09-29",
  );
  assert.equal(
    completedDateCutoff(new Date("2026-03-09T21:00:00Z")),
    "2026-03-09",
  );
});
test("same filtering rejects unfinished or invalid bars in fetched and fallback data", () => {
  const rows = [
    ["2026-09-25", 100],
    ["2026-09-28", 101],
    ["2026-09-29", 102],
    ["2026-09-24", null],
    ["2026-09-23", 0],
  ];
  assert.deepEqual(completedRows(rows, "2026-09-28"), rows.slice(0, 2));
  assert.deepEqual(
    completedRows(rows, completedDateCutoff(new Date("2026-09-27T18:00:00Z"))),
    rows.slice(0, 1),
  );
});
