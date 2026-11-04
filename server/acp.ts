import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

export class UnsupportedAcpError extends Error {}

export async function readAcpUsage(cliPath: string, kiroHome: string): Promise<unknown> {
  const child = spawn(cliPath, ['acp', '--agent-engine=v3'], {
    cwd: tmpdir(), env: { ...process.env, KIRO_HOME: kiroHome },
    stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
  });
  let buffer = '';
  let nextId = 0;
  let phase: 'initialize' | 'usage' = 'initialize';
  let settled = false;
  let timer: NodeJS.Timeout;
  return new Promise((resolve, reject) => {
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error); else resolve(value);
    };
    const request = (method: string, params: object) => {
      const id = ++nextId;
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      return id;
    };
    let expectedId = 1;
    child.on('error', (error) => finish(error));
    child.on('exit', () => finish(phase === 'initialize'
      ? new UnsupportedAcpError('Kiro CLI does not support V3 ACP')
      : new Error('Kiro ACP exited before returning usage')));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 1024 * 1024) return finish(new Error('Kiro ACP response too large'));
      let end: number;
      while (!settled && (end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let message: Record<string, unknown>;
        try { message = JSON.parse(line); } catch { return finish(new Error('Kiro ACP returned invalid JSON')); }
        if (message.id !== expectedId) continue;
        if (message.error) {
          const error = message.error as { code?: number; message?: string };
          return finish(error.code === -32601 || phase === 'initialize'
            ? new UnsupportedAcpError(error.message || 'Kiro ACP method unavailable')
            : new Error(error.message || 'Kiro ACP usage request failed'));
        }
        if (phase === 'initialize') {
          phase = 'usage';
          expectedId = request('_kiro/account/getUsage', {});
        } else {
          const result = message.result as { success?: boolean; message?: string } | undefined;
          if (result?.success === false) return finish(new Error(result.message || 'Kiro ACP usage request failed'));
          return finish(undefined, message.result);
        }
      }
    });
    timer = setTimeout(() => finish(new Error('Kiro ACP usage query timed out')), 20_000);
    request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'paseo-kiro-usage', version: '0.1.0' },
    });
  });
}
