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
