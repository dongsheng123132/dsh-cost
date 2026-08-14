import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCostReport, buildCostReportFromUsageRows, usageRowsToEvents, validatePriceBook } from '../lib/ledger.mjs'

const prices = {
  currency: 'USD',
  prices: [{
    provider: 'local',
    model: 'model-a',
    inputPerMillion: 1,
    outputPerMillion: 2,
    cacheReadPerMillion: 0.1,
    cacheWritePerMillion: 0.5
  }]
}

const header = (provider, model) => ({
  type: 'request/header',
  data: { header: { config: { provider, model } } }
})
const answer = usage => ({ type: 'assistant/message', data: { usage } })

test('price books reject duplicate routes and invalid prices', () => {
  assert.throws(() => validatePriceBook({ prices: [prices.prices[0], prices.prices[0]] }), /duplicate/)
  assert.throws(() => validatePriceBook({ prices: [{ provider: 'x', model: 'y', inputPerMillion: -1 }] }), /non-negative/)
})

test('ledger attributes disjoint usage buckets without double-counting reasoning', () => {
  const report = buildCostReport([
    header('local', 'model-a'),
    answer({ inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 100_000, cacheWriteTokens: 200_000, reasoningTokens: 300_000 })
  ], prices, { budget: 3 })
  assert.equal(report.knownCost, 2.11)
  assert.equal(report.complete, true)
  assert.equal(report.budget.state, 'within')
})

test('missing usage and prices stay visible and make a below-budget result unknown', () => {
  const report = buildCostReport([
    header('local', 'model-a'),
    answer(undefined),
    header('other', 'model-b'),
    answer({ inputTokens: 10, outputTokens: 5 })
  ], prices, { budget: 1 })
  assert.equal(report.complete, false)
  assert.equal(report.missingUsageCalls, 1)
  assert.equal(report.unpricedCalls, 1)
  assert.equal(report.budget.state, 'unknown')
})

test('known spend over budget is decisive even with incomplete evidence', () => {
  const report = buildCostReport([
    header('local', 'model-a'),
    answer({ inputTokens: 2_000_000, outputTokens: 0 }),
    answer(undefined)
  ], prices, { budget: 1 })
  assert.equal(report.budget.state, 'over')
})

test('sanitized usage rows produce the same fail-closed report without accepting raw content', () => {
  const report = buildCostReportFromUsageRows([
    { provider: 'local', model: 'model-a', inputTokens: 1_000_000, outputTokens: 500_000 },
    { provider: 'other', model: 'model-b', missingUsage: true }
  ], prices, { budget: 3 })
  assert.equal(report.knownCost, 2)
  assert.equal(report.complete, false)
  assert.equal(report.missingUsageCalls, 1)
  assert.equal(report.budget.state, 'unknown')
  assert.throws(() => usageRowsToEvents([{ provider: 'local', model: 'model-a', inputTokens: 1, outputTokens: 1, prompt: 'secret body' }]), /not allowed/)
})

test('sanitized usage rows are bounded and reject contradictory missing evidence', () => {
  assert.throws(() => usageRowsToEvents(new Array(10_001).fill({ provider: 'p', model: 'm', missingUsage: true })), /10000/)
  assert.throws(() => usageRowsToEvents([{ provider: 'p', model: 'm', missingUsage: true, inputTokens: 1 }]), /forbidden/)
})
