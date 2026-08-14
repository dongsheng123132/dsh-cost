import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const child = spawn(process.execPath, ['mcp-server.mjs'], { cwd: process.cwd(), shell: false, stdio: ['pipe', 'pipe', 'inherit'] })
let output = ''
child.stdout.setEncoding('utf8')
child.stdout.on('data', chunk => { output += chunk })
const request = value => child.stdin.write(`${JSON.stringify(value)}\n`)
request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
request({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
request({
  jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
    name: 'cost_check',
    arguments: {
      usageRows: [{ provider: 'local', model: 'm', inputTokens: 1_000_000, outputTokens: 0 }],
      priceBook: { currency: 'USD', prices: [{ provider: 'local', model: 'm', inputPerMillion: 1 }] },
      budget: 0.5
    }
  }
})
child.stdin.end()
await new Promise((resolve, reject) => {
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`MCP exited ${code}`)))
  child.on('error', reject)
})
const messages = output.trim().split(/\r?\n/).map(JSON.parse)
assert.equal(messages[0].result.serverInfo.name, 'dsh-cost')
assert.deepEqual(messages[1].result.tools.map(({ name }) => name), ['cost_report', 'cost_check'])
assert.equal(messages[2].result.structuredContent.allowed, false)
assert.equal(messages[2].result.structuredContent.report.knownCost, 1)
process.stdout.write(`${JSON.stringify({ ok: true, tools: messages[1].result.tools.map(({ name }) => name), knownCost: 1, allowed: false })}\n`)
