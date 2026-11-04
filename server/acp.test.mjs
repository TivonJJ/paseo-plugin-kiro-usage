import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readAcpUsage, UnsupportedAcpError } from './acp.ts';

async function fakeCli(body, run) {
  const dir = await mkdtemp(join(tmpdir(), 'kiro-acp-test-'));
  try {
    const cli = join(dir, 'kiro-cli');
    await writeFile(cli, `#!/usr/bin/env node\n${body}`);
    await chmod(cli, 0o700);
    await run(cli, dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('queries V3 usage even when the extension is not advertised', async () => {
  await fakeCli(`process.stdin.setEncoding('utf8'); let input = ''; process.stdin.on('data', chunk => { input += chunk; let end; while ((end = input.indexOf('\\n')) >= 0) { const line = input.slice(0, end); input = input.slice(end + 1); const request = JSON.parse(line); const result = request.method === 'initialize' ? { agentCapabilities: { _meta: { kiro: { extensionMethods: [] } } } } : { success: true, data: { planName: 'PRO', usageBreakdowns: [] } }; process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\\n'); } });`, async (cli, home) => {
    const result = await readAcpUsage(cli, home);
    assert.equal(result.data.planName, 'PRO');
  });
});

test('recognizes a missing V3 method for legacy fallback', async () => {
  await fakeCli(`process.stdin.setEncoding('utf8'); let input = ''; process.stdin.on('data', chunk => { input += chunk; let end; while ((end = input.indexOf('\\n')) >= 0) { const request = JSON.parse(input.slice(0, end)); input = input.slice(end + 1); const response = request.method === 'initialize' ? { result: { agentCapabilities: {} } } : { error: { code: -32601, message: 'Method not found' } }; process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...response }) + '\\n'); } });`, async (cli, home) => {
    await assert.rejects(readAcpUsage(cli, home), UnsupportedAcpError);
  });
});

test('does not classify an authentication failure as unsupported', async () => {
  await fakeCli(`process.stdin.setEncoding('utf8'); let input = ''; process.stdin.on('data', chunk => { input += chunk; let end; while ((end = input.indexOf('\\n')) >= 0) { const request = JSON.parse(input.slice(0, end)); input = input.slice(end + 1); const result = request.method === 'initialize' ? { agentCapabilities: {} } : { success: false, message: 'Authentication failed' }; process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\\n'); } });`, async (cli, home) => {
    await assert.rejects(readAcpUsage(cli, home), /Authentication failed/);
  });
});
