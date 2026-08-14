import { readFile } from 'node:fs/promises'

const required = ['package.json', '.codex-plugin/plugin.json', '.mcp.json', 'mcp-server.mjs', 'index.js', 'lib/ledger.mjs', 'cordis.patch.yml', 'prices.example.json', 'README.md', 'README.zh-CN.md', 'SECURITY.md']
const files = Object.fromEntries(await Promise.all(required.map(async file => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])))
const pkg = JSON.parse(files['package.json'])
const plugin = JSON.parse(files['.codex-plugin/plugin.json'])
const mcp = JSON.parse(files['.mcp.json'])
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('missing DSH bundle patch')
if (pkg.name !== plugin.name || pkg.version !== plugin.version || plugin.mcpServers !== './.mcp.json') throw new Error('package/plugin identity or MCP path mismatch')
if (!mcp.mcpServers?.['dsh-cost']) throw new Error('MCP declaration missing')
if (['preinstall', 'install', 'postinstall', 'prepare'].some(name => pkg.scripts?.[name])) throw new Error('install lifecycle scripts are forbidden')
if (!files['cordis.patch.yml'].includes('name: dsh-cost')) throw new Error('bundle does not mount dsh-cost')
for (const tool of ['dsh_cost_report', 'dsh_cost_check']) {
  if (!files['index.js'].includes(`name: '${tool}'`)) throw new Error(`missing tool ${tool}`)
}
if (/api[_-]?key|authorization/i.test(files['prices.example.json'])) throw new Error('price book must not contain credentials')
if (/export\s+default\b/.test(files['index.js'])) throw new Error('namespace DSH plugins must not default-export apply because Loader would discard inject metadata')
console.log(JSON.stringify({ ok: true, bundle: pkg.dsh.bundle.patch, tools: 2, installScripts: 0, mcp: true, namespaceLoaderSafe: true }))
