import { test } from "node:test";
import assert from "node:assert/strict";
import { JobCoordinator } from "../extension/core/jobs.js";
import type { Job } from "../extension/core/types.js";
test("worker restart marks an interrupted job unverified and never replays deletion", async () => {
  let saved: Job = {
    id: "old",
    status: "running",
    completed: 0,
    total: 2,
    outcomes: [],
  };
  const coordinator = new JobCoordinator(
    {
      read: async () => saved,
      write: async (job) => {
        saved = job;
      },
    },
    {
      removeData: async () => {
        throw Error("Must not replay");
      },
      removeBookmark: async () => {
        throw Error("Must not replay");
      },
      removeFolder: async () => {
        throw Error("Must not replay");
      },
    },
  );
  assert.equal((await coordinator.get())?.status, "unverified");
  assert.equal(saved.outcomes[0].status, "unverified");
});

test("a failed initial status write does not permanently lock cleanup", async () => {
  let fail = true;
  const coordinator = new JobCoordinator(
    {
      read: async () => undefined,
      write: async () => {
        if (fail) throw Error("Storage unavailable");
      },
    },
    {
      removeData: async () => {},
      removeBookmark: async () => {},
      removeFolder: async () => {},
    },
  );
  const plan = {
    sites: [],
    folders: [{ id: "folder", depth: 1 }],
    options: {
      cookies: false,
      savedData: false,
      cache: false,
      workers: false,
      bookmarks: true,
    },
  };
  await assert.rejects(coordinator.start(plan));
  fail = false;
  await assert.doesNotReject(coordinator.start(plan));
});

test("running job persists initiating and reviewed bookmark IDs without changing deletion scope", async () => {
  let saved: Job | undefined;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const removed: string[] = [];
  const coordinator = new JobCoordinator({
    read: async () => saved,
    write: async job => { saved = structuredClone(job); },
  }, {
    removeData: async () => { await pending; },
    removeBookmark: async id => { removed.push(id); },
    removeFolder: async () => {},
  });
  const plan = {
    sites: [{ id: "example.test", host: "example.test", origins: ["https://example.test"], urls: ["https://example.test/a"], cookies: [], bookmarks: [
      { id: "copy", title: "Copy", url: "https://example.test/a", path: "Saved" },
    ] }],
    options: { cookies: false, savedData: true, cache: false, workers: false, bookmarks: true },
    folders: [],
  };
  const started = await coordinator.start(plan, ["base", "base"]);
  assert.deepEqual(started.busyBookmarkIds, ["base", "copy"]);
  assert.deepEqual(saved?.busyBookmarkIds, ["base", "copy"]);
  assert.deepEqual(plan.sites[0].bookmarks.map(bookmark => bookmark.id), ["copy"]);
  release();
  for (let i = 0; i < 20 && (await coordinator.get())?.status === "running"; i++)
    await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(removed, ["copy"], "Display-only initiating IDs never become deletion targets");
});

test("dismissing a finished job is remembered across reads", async () => {
  let saved: Job = { id: "done", status: "finished", completed: 1, total: 1, outcomes: [] };
  const operations = {
    removeData: async () => {},
    removeBookmark: async () => {},
    removeFolder: async () => {},
  };
  const coordinator = new JobCoordinator(
    { read: async () => saved, write: async (job) => { saved = structuredClone(job); } },
    operations,
  );
  await coordinator.dismiss("other");
  assert.equal(saved.dismissed, undefined, "Only the current job can be dismissed");
  await coordinator.dismiss("done");
  assert.equal(saved.dismissed, true);
  const reloaded = new JobCoordinator({ read: async () => saved, write: async () => {} }, operations);
  assert.equal((await reloaded.get())?.dismissed, true);
});
