import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LatestRead, PendingAction } from '../extension/components/async-state.js';

test('pending writes cannot re-enter and failures release the lock', async () => {
  const action = new PendingAction();
  let release!: () => void;
  let calls = 0;
  const first = action.run(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); throw Error('failed'); });
  assert.equal(action.pending, true);
  assert.equal(await action.run(async () => { calls++; }), undefined);
  assert.equal(calls, 1);
  release();
  await assert.rejects(first, /failed/);
  assert.equal(action.pending, false);
  assert.equal(await action.run(async () => 'saved'), 'saved');
});
test('new reads and disposal invalidate earlier completions', () => {
  const reads = new LatestRead();
  const first = reads.begin();
  const second = reads.begin();
  assert.equal(first(), false);
  assert.equal(second(), true);
  reads.invalidate();
  assert.equal(second(), false);
});
