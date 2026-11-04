import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fetchKiroUsage } from './fetch.ts';

async function withCli(acpResponse, run) {
  const dir = await mkdtemp(join(tmpdir(), 'kiro-fetch-test-'));
  try {
    const cli = join(dir, 'kiro-cli');
    await writeFile(cli, `#!/usr/bin/env node
if (process.argv[2] === 'chat') { process.stdout.write('Estimated Usage | resets on 2026-12-01 | KIRO PRO\\nCredits (40 of 100 covered in plan)\\n'); process.exit(0); }
process.stdin.setEncoding('utf8'); let input = ''; process.stdin.on('data', chunk => { input += chunk; let end; while ((end = input.indexOf('\\n')) >= 0) { const request = JSON.parse(input.slice(0, end)); input = input.slice(end + 1); const response = request.method === 'initialize' ? { result: { agentCapabilities: {} } } : ${JSON.stringify(acpResponse)}; process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...response }) + '\\n'); } });`);
    await chmod(cli, 0o700);
    await run(cli, dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('uses V2 only when V3 usage method is unavailable', async () => {
  await withCli({ error: { code: -32601, message: 'Method not found' } }, async (cli, home) => {
    const report = await fetchKiroUsage(cli, home);
    assert.equal(report.status, 'available');
    assert.equal(report.balances[0].used, 40);
  });
});

test('does not mask a V3 authentication error with V2 data', async () => {
  await withCli({ result: { success: false, message: 'Authentication failed' } }, async (cli, home) => {
    await assert.rejects(fetchKiroUsage(cli, home), /Authentication failed/);
  });
});
