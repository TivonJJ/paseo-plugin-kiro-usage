import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { PluginServerContext } from '@getpaseo/plugin/server';
import { hashAccountKey } from '@getpaseo/plugin/server/usage';
import { z } from 'zod';
import { readKiroUsage } from './server/probe';
import { parseKiroUsage } from './server/usage';

const input = z.object({ kiroHome: z.string().min(1), cliPath: z.string().min(1) }).strict();

function findCli(pathValue: string | undefined): string | null {
  const candidates = [
    process.env.KIRO_CLI_PATH,
    join(homedir(), '.local', 'bin', 'kiro-cli'),
    ...(pathValue ?? '').split(delimiter).filter(Boolean).map((directory) => join(directory, 'kiro-cli')),
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}

export default function contribute(server: PluginServerContext) {
  server.registerUsageSource({
    id: 'kiro-usage',
    label: 'Kiro',
    input,
    discover: async (scope) => {
      if (scope.kind === 'session' && scope.provider !== 'kiro') return [];
      // A session authenticated with a private API key cannot be re-created by a later
      // usage fetch unless the daemon itself has the same key. Avoid a wrong account card.
      if (scope.kind === 'session' && scope.env.KIRO_API_KEY && scope.env.KIRO_API_KEY !== process.env.KIRO_API_KEY) return [];
      const env = scope.kind === 'session' ? scope.env : process.env;
      const cliPath = findCli(env.PATH);
      if (!cliPath) return [];
      const kiroHome = env.KIRO_HOME || process.env.KIRO_HOME || join(homedir(), '.kiro');
      return [{
        key: hashAccountKey(kiroHome),
        label: 'Kiro',
        harness: 'Kiro CLI',
        input: { kiroHome, cliPath },
      }];
    },
    fetch: async (value) => {
      const { kiroHome, cliPath } = input.parse(value);
      try {
        return parseKiroUsage(await readKiroUsage(cliPath, kiroHome));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return {
          status: 'error' as const,
          error: code === 'ENOENT' ? 'Kiro CLI not found'
            : code === 'ETIMEDOUT' ? 'Kiro usage query timed out'
            : 'Kiro usage query failed; check kiro-cli /usage locally',
        };
      }
    },
  });
  return () => {};
}
