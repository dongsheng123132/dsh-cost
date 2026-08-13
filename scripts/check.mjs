import { readFile } from 'node:fs/promises'

const required = ['package.json', 'index.js', 'lib/ledger.mjs', 'cordis.patch.yml', 'prices.example.json', 'README.md', 'README.zh-CN.md']
const files = Object.fromEntries(await Promise.all(required.map(async file => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])))
const pkg = JSON.parse(files['package.json'])
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('missing DSH bundle patch')
if (pkg.scripts?.prepare || pkg.scripts?.postinstall) throw new Error('install lifecycle scripts are forbidden')
if (!files['cordis.patch.yml'].includes('name: dsh-cost')) throw new Error('bundle does not mount dsh-cost')
for (const tool of ['dsh_cost_report', 'dsh_cost_check']) {
  if (!files['index.js'].includes(`name: '${tool}'`)) throw new Error(`missing tool ${tool}`)
}
if (/api[_-]?key|authorization/i.test(files['prices.example.json'])) throw new Error('price book must not contain credentials')
console.log(JSON.stringify({ ok: true, bundle: pkg.dsh.bundle.patch, tools: 2, installScripts: 0 }))

