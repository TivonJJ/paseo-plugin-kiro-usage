import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readKiroUsage } from './probe.ts';

test('queries usage through V2 without invoking an agent prompt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kiro-usage-test-'));
  try {
    const cli = join(dir, 'kiro-cli');
    await writeFile(cli, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    await chmod(cli, 0o700);
    const output = await readKiroUsage(cli, dir);
    assert.deepEqual(output.trim().split('\n'), ['chat', '--v2', '--no-interactive', '/usage']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
