import { toneFromUsedPct, windowFromUsedPct, type UsageReport } from '@getpaseo/plugin/server/usage';

const AMOUNT = '([\\d,]+(?:\\.\\d+)?)';
const creditsPattern = new RegExp(`\\bCredits\\s*\\(\\s*${AMOUNT}\\s+of\\s+${AMOUNT}\\s+covered in plan\\s*\\)`, 'i');

function resetDate(output: string, now: Date): string | undefined {
  const match = output.match(/\bresets on\s+(?:(\d{4})-)?(\d{1,2})[/-](\d{1,2})\b/i);
  if (!match) return undefined;
  let year = match[1] ? Number(match[1]) : now.getFullYear();
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  let date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (!match[1] && date.getTime() < todayUtc) date = new Date(Date.UTC(++year, month - 1, day));
  return date.toISOString();
}

export function parseKiroUsage(output: string, now = new Date()): UsageReport {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const credits = clean.match(creditsPattern);
  if (!credits) return { status: 'error', error: 'Kiro did not return recognizable usage data' };

  const used = Number(credits[1].replaceAll(',', ''));
  const limit = Number(credits[2].replaceAll(',', ''));
  if (!Number.isFinite(used) || !Number.isFinite(limit) || used < 0 || limit <= 0) {
    return { status: 'error', error: 'Kiro returned invalid credit values' };
  }

  const planLabel = clean.match(/Estimated Usage[^\n]*\|\s*(KIRO\s+[^\n|]+)/i)?.[1]?.trim();
  const usedPct = used / limit * 100;
  const resetsAt = resetDate(clean, now);
  const bonus = clean.match(new RegExp(`Bonus credits:\\s*${AMOUNT}\\s*(?:/|of)\\s*${AMOUNT}\\s+credits used(?:[^\\n]*?expires in\\s+(\\d+)\\s+days?)?`, 'i'));
  const bonusUsed = bonus ? Number(bonus[1].replaceAll(',', '')) : null;
  const bonusLimit = bonus ? Number(bonus[2].replaceAll(',', '')) : null;
  const hasBonus = bonusUsed !== null && bonusLimit !== null && Number.isFinite(bonusUsed) && Number.isFinite(bonusLimit) && bonusUsed >= 0 && bonusLimit > 0;
  return {
    status: 'available',
    ...(planLabel ? { planLabel } : {}),
    windows: [windowFromUsedPct({
      id: 'monthly', label: 'Monthly', shortLabel: 'mo', summary: true,
      utilizationPct: usedPct, ...(resetsAt ? { resetsAt } : {}),
    })],
    balances: [{
      id: 'plan-credits', label: 'Plan credits', used,
      remaining: Math.max(0, Math.round((limit - used) * 100) / 100), limit,
      unit: 'credits', ...(resetsAt ? { resetsAt } : {}), tone: toneFromUsedPct(usedPct),
    }, ...(hasBonus ? [{
      id: 'bonus-credits', label: 'Bonus credits', used: bonusUsed,
      remaining: Math.max(0, Math.round((bonusLimit - bonusUsed) * 100) / 100),
      limit: bonusLimit, unit: 'credits' as const,
      tone: toneFromUsedPct(bonusUsed / bonusLimit * 100),
    }] : [])],
    ...(hasBonus && bonus?.[3] ? { details: [{
      id: 'bonus-expiry', label: 'Bonus expires', value: `In ${bonus[3]} days`,
    }] } : {}),
  };
}
