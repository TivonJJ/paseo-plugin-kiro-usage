import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function readKiroUsage(cliPath: string, kiroHome: string): Promise<string> {
  const { stdout } = await execFileAsync(cliPath, ['chat', '--v2', '--no-interactive', '/usage'], {
    cwd: tmpdir(),
    env: { ...process.env, KIRO_HOME: kiroHome },
    timeout: 20_000,
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  return stdout;
}
