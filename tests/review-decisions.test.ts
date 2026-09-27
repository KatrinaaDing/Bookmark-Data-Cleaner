import { test } from "node:test";
import assert from "node:assert/strict";
import { ExtraBookmarkDecisions } from "../extension/core/review-decisions.js";
import type { BookmarkRef } from "../extension/core/types.js";

const bookmark = (id: string, unmodifiable = false): BookmarkRef => ({
  id,
  title: id,
  url: `https://example.test/${id}`,
  path: "Bookmarks",
  ...(unmodifiable ? { unmodifiable: true } : {}),
});
const impact = (duplicates: BookmarkRef[], relatedBookmarks: BookmarkRef[] = []) => ({
  duplicates,
  relatedBookmarks,
  relatedSites: [],
});

test("exact-URL copies are selected by default, except managed copies", () => {
  const decisions = new ExtraBookmarkDecisions();
  decisions.reconcile(impact([bookmark("copy"), bookmark("managed", true)], [bookmark("related")]), true);
  assert.deepEqual([...decisions.selected], ["copy"]);
  assert.ok(decisions.isCandidate("related"));
  assert.equal(decisions.isCandidate("other"), false);
});

test("explicit choices persist across preparations while the bookmark stays a candidate", () => {
  const decisions = new ExtraBookmarkDecisions();
  decisions.reconcile(impact([bookmark("copy")], [bookmark("related")]), true);
  decisions.choose("copy", false);
  decisions.choose("related", true);
  decisions.reconcile(impact([bookmark("copy")], [bookmark("related")]), true);
  assert.deepEqual([...decisions.selected], ["related"]);

  // Leaving the candidate list forgets the choice; returning uses the default again.
  decisions.reconcile(impact([]), true);
  decisions.reconcile(impact([bookmark("copy")]), true);
  assert.deepEqual([...decisions.selected], ["copy"]);
});

test("keeping bookmarks requests and selects no extras", () => {
  const decisions = new ExtraBookmarkDecisions();
  decisions.reconcile(impact([bookmark("copy")]), true);
  assert.deepEqual([...decisions.requested(false)], []);
  decisions.reconcile(impact([bookmark("copy")]), false);
  assert.equal(decisions.selected.size, 0);
});

test("matches reports whether a preparation used the resulting selection", () => {
  const decisions = new ExtraBookmarkDecisions();
  const requested = decisions.requested(true);
  decisions.reconcile(impact([bookmark("copy")]), true);
  assert.equal(decisions.matches(requested), false);
  assert.equal(decisions.matches(decisions.requested(true)), true);
});
