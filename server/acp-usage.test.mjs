import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAcpUsage } from './acp-usage.ts';

test('maps structured V3 plan and bonus credits', () => {
  const report = parseAcpUsage({
    success: true,
    data: {
      planName: 'KIRO PRO', billingCycleReset: '2026-12-01T00:00:00Z',
      usageBreakdowns: [{ resourceType: 'CREDIT', displayName: 'Credits', used: 25.5, limit: 100, hasLimit: true }],
      bonusCredits: [{ used: 2, limit: 10 }],
    },
  });
  assert.equal(report.status, 'available');
  assert.equal(report.planLabel, 'KIRO PRO');
  assert.equal(report.windows[0]?.usedPct, 25.5);
  assert.equal(report.balances?.[0]?.remaining, 74.5);
  assert.equal(report.balances?.[0]?.resetsAt, '2026-12-01T00:00:00.000Z');
  assert.equal(report.balances?.[1]?.remaining, 8);
});

test('rejects a changed V3 payload instead of showing invented usage', () => {
  assert.deepEqual(parseAcpUsage({ success: true, data: { usageBreakdowns: [] } }), {
    status: 'error', error: 'Kiro ACP returned no usable credit balances',
  });
});
