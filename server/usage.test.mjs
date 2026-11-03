import assert from 'node:assert/strict';
import test from 'node:test';
import { parseKiroUsage } from './usage.ts';

test('maps plan credits and reset date to a Paseo usage report', () => {
  const report = parseKiroUsage(`Estimated Usage | resets on 2026-12-01 | KIRO PRO+
Credits (1470.38 of 2000 covered in plan), 73.5%
Overages: Disabled`, new Date('2026-11-03T00:00:00Z'));

  assert.equal(report.status, 'available');
  assert.equal(report.planLabel, 'KIRO PRO+');
  assert.deepEqual(report.balances?.[0], {
    id: 'plan-credits', label: 'Plan credits', used: 1470.38,
    remaining: 529.62, limit: 2000, unit: 'credits',
    resetsAt: '2026-12-01T00:00:00.000Z', tone: 'warning',
  });
  assert.equal(report.windows[0]?.id, 'monthly');
  assert.equal(report.windows[0]?.usedPct, 73.519);
});

test('parses legacy month and day reset in the next year', () => {
  const report = parseKiroUsage(`Estimated Usage | resets on 01/01 | KIRO PRO
Credits (250.37 of 1000 covered in plan)`, new Date('2026-11-03T00:00:00Z'));
  assert.equal(report.status, 'available');
  assert.equal(report.balances?.[0]?.resetsAt, '2027-01-01T00:00:00.000Z');
});

test('keeps a reset date that is today in the current year', () => {
  const report = parseKiroUsage(`Estimated Usage | resets on 11/03 | KIRO FREE
Credits (5 of 50 covered in plan)`, new Date('2026-11-03T12:00:00Z'));
  assert.equal(report.status, 'available');
  assert.equal(report.balances?.[0]?.resetsAt, '2026-11-03T00:00:00.000Z');
});

test('does not accept a V3 model answer as usage', () => {
  const report = parseKiroUsage("I can't show usage or quota data.");
  assert.deepEqual(report, { status: 'error', error: 'Kiro did not return recognizable usage data' });
});

test('adds bonus credits as a separate balance', () => {
  const report = parseKiroUsage(`Estimated Usage | resets on 2026-12-01 | KIRO PRO
Credits (250 of 1000 covered in plan)
Bonus credits: 25.5/100 credits used, expires in 18 days`);
  assert.equal(report.status, 'available');
  assert.deepEqual(report.balances?.[1], {
    id: 'bonus-credits', label: 'Bonus credits', used: 25.5,
    remaining: 74.5, limit: 100, unit: 'credits', tone: 'ok',
  });
  assert.deepEqual(report.details?.[0], {
    id: 'bonus-expiry', label: 'Bonus expires', value: 'In 18 days',
  });
});
