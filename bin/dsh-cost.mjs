#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildCostReport } from '../lib/ledger.mjs'

function valueAfter(args, flag) {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

const args = process.argv.slice(2)
if (args.includes('--help') || !valueAfter(args, '--events') || !valueAfter(args, '--prices')) {
  console.log('Usage: dsh-cost --events session-events.json --prices prices.json [--budget 1.25] [--fail-closed]')
  process.exit(args.includes('--help') ? 0 : 1)
}

try {
  const eventsValue = JSON.parse(await readFile(resolve(valueAfter(args, '--events')), 'utf8'))
  const prices = JSON.parse(await readFile(resolve(valueAfter(args, '--prices')), 'utf8'))
  const budgetRaw = valueAfter(args, '--budget')
  const budget = budgetRaw === undefined ? undefined : Number(budgetRaw)
  const report = buildCostReport(Array.isArray(eventsValue) ? eventsValue : eventsValue.events, prices, { budget })
  console.log(JSON.stringify(report, null, 2))
  if (report.budget?.state === 'over' || (args.includes('--fail-closed') && report.budget?.state === 'unknown')) {
    process.exitCode = 2
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

