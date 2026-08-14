import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const checkout = process.env.DSH_CHECKOUT
if (!checkout) throw new Error('DSH_CHECKOUT must point to a built DeepSeek Harness checkout')
const pluginEntry = process.env.PLUGIN_ENTRY
const plugin = pluginEntry ? await import(pathToFileURL(resolve(pluginEntry)).href) : await import('../index.js')
const importBuilt = relative => import(pathToFileURL(resolve(checkout, relative)).href)
const { Context } = await importBuilt('vendor/cordis/lib/index.js')
const { default: SystemPrompt } = await importBuilt('packages/core/system-prompt/lib/index.js')
const { default: ToolRuntime } = await importBuilt('packages/core/tools/lib/index.js')
const { TokenMeter } = await importBuilt('packages/llm/token-meter/lib/index.js')

const ctx = new Context()
try {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(TokenMeter)
  await ctx.plugin(plugin, { priceBook: { currency: 'USD', prices: [{ provider: 'local', model: 'm', inputPerMillion: 1 }] } })
  const tools = ctx.get('tools')
  const names = tools.schemas().filter(({ name }) => name.startsWith('dsh_cost_')).map(({ name }) => name)
  assert.deepEqual(names, ['dsh_cost_report', 'dsh_cost_check'])
  const agent = {
    session: {
      header: { id: 'cost-runtime-smoke' },
      events: [
        { type: 'request/header', data: { header: { config: { provider: 'local', model: 'm' } } } },
        { type: 'assistant/message', data: { usage: { inputTokens: 1_000_000, outputTokens: 0 } } }
      ]
    }
  }
  const result = await tools.execute({ signal: new AbortController().signal, callId: 'cost-runtime', name: 'dsh_cost_check', arguments: { budget: 0.5, failClosed: true }, agent })
  assert.equal(result.isError, false)
  assert.equal(result.value.allowed, false)
  assert.equal(result.value.report.knownCost, 1)
  process.stdout.write(`${JSON.stringify({ ok: true, dshTools: names, knownCost: 1, allowed: false })}\n`)
} finally {
  await ctx.fiber.dispose()
}
