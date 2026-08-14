#!/usr/bin/env node
import readline from 'node:readline'
import { buildCostReportFromUsageRows } from './lib/ledger.mjs'

const usageRow = {
  type: 'object',
  required: ['provider', 'model'],
  properties: {
    provider: { type: 'string' },
    model: { type: 'string' },
    inputTokens: { type: 'number', minimum: 0 },
    outputTokens: { type: 'number', minimum: 0 },
    cacheReadTokens: { type: 'number', minimum: 0 },
    cacheWriteTokens: { type: 'number', minimum: 0 },
    missingUsage: { type: 'boolean' }
  },
  additionalProperties: false
}
const price = {
  type: 'object',
  required: ['provider', 'model'],
  properties: {
    provider: { type: 'string' },
    model: { type: 'string' },
    inputPerMillion: { type: 'number', minimum: 0 },
    outputPerMillion: { type: 'number', minimum: 0 },
    cacheReadPerMillion: { type: 'number', minimum: 0 },
    cacheWritePerMillion: { type: 'number', minimum: 0 }
  },
  additionalProperties: false
}
const common = {
  usageRows: { type: 'array', maxItems: 10000, items: usageRow },
  priceBook: {
    type: 'object',
    required: ['prices'],
    properties: {
      currency: { type: 'string', pattern: '^[A-Z]{3}$' },
      prices: { type: 'array', items: price }
    },
    additionalProperties: false
  },
  budget: { type: 'number', minimum: 0 }
}
const tools = [
  {
    name: 'cost_report',
    description: 'Build a deterministic cost report from sanitized usage rows and a caller-owned price book; raw prompts and session bodies are not accepted.',
    inputSchema: { type: 'object', required: ['usageRows', 'priceBook'], properties: common, additionalProperties: false }
  },
  {
    name: 'cost_check',
    description: 'Evaluate a budget from sanitized usage rows, failing closed by default when usage or price evidence is incomplete.',
    inputSchema: { type: 'object', required: ['usageRows', 'priceBook', 'budget'], properties: { ...common, failClosed: { type: 'boolean' } }, additionalProperties: false }
  }
]

function call(name, args) {
  const report = buildCostReportFromUsageRows(args.usageRows, args.priceBook, { budget: args.budget })
  if (name === 'cost_report') return report
  if (name === 'cost_check') {
    const failClosed = args.failClosed ?? true
    return {
      allowed: report.budget.state === 'within' || (!failClosed && report.budget.state === 'unknown'),
      failClosed,
      report
    }
  }
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: 'METHOD_NOT_FOUND' })
}

const send = value => process.stdout.write(`${JSON.stringify(value)}\n`)
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  if (!line.trim()) continue
  let request
  try { request = JSON.parse(line) } catch { continue }
  if (request.id === undefined) continue
  try {
    if (request.method === 'initialize') {
      send({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'dsh-cost', version: '0.2.0' } } })
    } else if (request.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: request.id, result: { tools } })
    } else if (request.method === 'tools/call') {
      const result = call(request.params?.name, request.params?.arguments ?? {})
      send({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } })
    } else {
      send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } })
    }
  } catch (error) {
    send({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error.message, data: { code: error.code ?? 'ERROR' } } })
  }
}
