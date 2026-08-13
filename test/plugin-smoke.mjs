import assert from 'node:assert/strict'
import { createDefinitions } from '../index.js'

const registered = []
const ctx = {
  tokenMeter: { measure: () => ({ logRevision: 2, totalTokens: 12, surfaceTokens: 8, nodes: [], baseline: { kind: 'estimated', tokens: 12 }, surfaceDeltaTokens: 0 }) },
  tools: { register: tool => registered.push(tool) }
}
const config = {
  priceBook: {
    currency: 'USD',
    prices: [{ provider: 'local', model: 'm', inputPerMillion: 1, outputPerMillion: 2 }]
  }
}
const tools = createDefinitions(ctx, config)
assert.deepEqual(tools.map(tool => tool.name), ['dsh_cost_report', 'dsh_cost_check'])
const execution = {
  agent: {
    session: {
      header: { id: 'session-1' },
      events: [
        { type: 'request/header', data: { header: { config: { provider: 'local', model: 'm' } } } },
        { type: 'assistant/message', data: { usage: { inputTokens: 1_000_000, outputTokens: 0 } } }
      ]
    }
  }
}
const report = await tools[0].execute({ budget: 2 }, execution)
assert.equal(report.knownCost, 1)
assert.equal(report.budget.state, 'within')
const check = await tools[1].execute({ budget: 0.5, failClosed: true }, execution)
assert.equal(check.allowed, false)
console.log(JSON.stringify({ ok: true, tools: tools.map(tool => tool.name), knownCost: report.knownCost }))

