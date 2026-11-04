import { toneFromUsedPct, windowFromUsedPct, type UsageBalance, type UsageReport } from '@getpaseo/plugin/server/usage';

type Pool = { resourceType?: unknown; displayName?: unknown; used?: unknown; limit?: unknown; hasLimit?: unknown };

function validPool(value: unknown): value is Pool & { used: number; limit: number } {
  if (!value || typeof value !== 'object') return false;
  const pool = value as Pool;
  return typeof pool.used === 'number' && Number.isFinite(pool.used) && pool.used >= 0
    && typeof pool.limit === 'number' && Number.isFinite(pool.limit) && pool.limit > 0
    && pool.hasLimit !== false;
}

export function parseAcpUsage(result: unknown): UsageReport {
  if (!result || typeof result !== 'object') return { status: 'error', error: 'Kiro ACP returned invalid usage data' };
  const data = (result as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return { status: 'error', error: 'Kiro ACP returned invalid usage data' };
  const usage = data as Record<string, unknown>;
  const pools = Array.isArray(usage.usageBreakdowns) ? usage.usageBreakdowns.filter(validPool) : [];
  if (!pools.length) return { status: 'error', error: 'Kiro ACP returned no usable credit balances' };
  const reset = typeof usage.billingCycleReset === 'string' ? new Date(usage.billingCycleReset) : null;
  const resetsAt = reset && !Number.isNaN(reset.getTime()) ? reset.toISOString() : undefined;
  const balances: UsageBalance[] = pools.map((pool: Pool & { used: number; limit: number }, index: number) => {
    const usedPct = pool.used / pool.limit * 100;
    return {
      id: index === 0 ? 'plan-credits' : `plan-${typeof pool.resourceType === 'string' ? pool.resourceType.toLowerCase() : index}`,
      label: typeof pool.displayName === 'string' ? pool.displayName : 'Plan credits',
      used: pool.used, remaining: Math.max(0, Math.round((pool.limit - pool.used) * 100) / 100),
      limit: pool.limit, unit: 'credits', ...(resetsAt ? { resetsAt } : {}), tone: toneFromUsedPct(usedPct),
    };
  });
  const bonus = Array.isArray(usage.bonusCredits) ? usage.bonusCredits.find(validPool) : validPool(usage.bonusCredits) ? usage.bonusCredits : null;
  if (bonus && validPool(bonus)) balances.push({
    id: 'bonus-credits', label: 'Bonus credits', used: bonus.used,
    remaining: Math.max(0, Math.round((bonus.limit - bonus.used) * 100) / 100),
    limit: bonus.limit, unit: 'credits', tone: toneFromUsedPct(bonus.used / bonus.limit * 100),
  });
  const primary = pools[0] as Pool & { used: number; limit: number };
  return {
    status: 'available',
    ...(typeof usage.planName === 'string' ? { planLabel: usage.planName } : {}),
    windows: [windowFromUsedPct({ id: 'monthly', label: 'Monthly', shortLabel: 'mo', summary: true,
      utilizationPct: primary.used / primary.limit * 100, ...(resetsAt ? { resetsAt } : {}) })],
    balances,
  };
}
