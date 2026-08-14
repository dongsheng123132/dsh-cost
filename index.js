import { readFileSync } from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildCostReport, validatePriceBook } from './lib/ledger.mjs'

export const name = 'dsh-cost'
export const inject = ['tools', 'tokenMeter']

function renderJson(_args, value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function loadPriceBook(config = {}) {
  if (config.priceBook) return validatePriceBook(config.priceBook)
  if (config.priceBookFile) {
    return validatePriceBook(JSON.parse(readFileSync(config.priceBookFile, 'utf8')))
  }
  return { currency: 'USD', prices: [] }
}

function currentAgent(execution) {
  if (!execution.agent?.session) throw new Error('dsh-cost requires an agent session')
  return execution.agent
}

export function createDefinitions(ctx, config = {}) {
  const priceBook = loadPriceBook(config)
  return [
    defineTool({
      name: 'dsh_cost_report',
      description: 'Report durable provider usage cost for the current DSH session. Unknown usage or prices are explicit; known cost is never presented as a complete total when evidence is missing.',
      parameters: {
        budget: { type: 'number', description: 'Optional non-negative budget in the price-book currency.' }
      },
      output: { schema: { type: 'json' }, render: renderJson },
      async execute(args, execution) {
        const agent = currentAgent(execution)
        const report = buildCostReport(agent.session.events, priceBook, {
          budget: args.budget ?? config.defaultBudget
        })
        return {
          ...report,
          sessionId: agent.session.header.id,
          pressure: ctx.tokenMeter.measure(agent.session)
        }
      }
    }),
    defineTool({
      name: 'dsh_cost_check',
      description: 'Evaluate whether the current DSH session is within a budget. Returns allowed=false when over budget, and also when evidence is incomplete with failClosed enabled. This is an explicit check, not an automatic pre-call interceptor.',
      parameters: {
        budget: { type: 'number', required: true, description: 'Non-negative budget in the price-book currency.' },
        failClosed: { type: 'boolean', description: 'Default true: incomplete evidence refuses the budget check.' }
      },
      output: { schema: { type: 'json' }, render: renderJson },
      async execute(args, execution) {
        const agent = currentAgent(execution)
        const report = buildCostReport(agent.session.events, priceBook, { budget: args.budget })
        const failClosed = args.failClosed ?? true
        return {
          allowed: report.budget.state === 'within' || (!failClosed && report.budget.state === 'unknown'),
          failClosed,
          report
        }
      }
    })
  ]
}

export function apply(ctx, config = {}) {
  for (const definition of createDefinitions(ctx, config)) ctx.tools.register(definition)
}
