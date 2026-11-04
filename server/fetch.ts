import type { UsageReport } from '@getpaseo/plugin/server/usage';
import { readAcpUsage, UnsupportedAcpError } from './acp.ts';
import { parseAcpUsage } from './acp-usage.ts';
import { readKiroUsage } from './probe.ts';
import { parseKiroUsage } from './usage.ts';

export async function fetchKiroUsage(cliPath: string, kiroHome: string): Promise<UsageReport> {
  try {
    return parseAcpUsage(await readAcpUsage(cliPath, kiroHome));
  } catch (error) {
    if (!(error instanceof UnsupportedAcpError)) throw error;
    return parseKiroUsage(await readKiroUsage(cliPath, kiroHome));
  }
}
