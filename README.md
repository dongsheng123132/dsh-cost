# dsh-cost

Evidence-first token cost ledger and budget checks for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

`dsh-cost` folds the durable DSH session log. It attributes each committed `assistant/message.usage` record to the active `request/header` provider/model route, then applies a user-owned price book. Missing usage and missing prices remain explicit: partial evidence never becomes a reassuring fake total.

## Install

```bash
dsh plugin --profile <name> add github:dongsheng123132/dsh-cost
```

The bundle mounts two tools:

- `dsh_cost_report` — durable session cost, route breakdown, evidence completeness, optional budget status, and the current `ctx.tokenMeter` pressure snapshot.
- `dsh_cost_check` — explicit fail-open/fail-closed budget decision. It does not claim to intercept future calls automatically.

## Price book

Copy `prices.example.json`, replace the zero placeholders with prices from your own current provider contract, and pass its path as plugin config:

```yaml
- id: dsh-cost
  name: dsh-cost
  config:
    priceBookFile: C:/absolute/path/prices.json
    defaultBudget: 5
```

Prices are per million tokens. Input, output, cache-read and cache-write buckets are disjoint. `reasoningTokens` is informational inside output usage and is not added again.

No vendor prices are baked in: prices change, account discounts differ, and a stale number is worse than an explicit unpriced route.

## Offline ledger

```bash
dsh-cost --events session-events.json --prices prices.json --budget 5 --fail-closed
```

Exit code `2` means over budget, or unknown when `--fail-closed` is active. The events file may be a raw array or an object with an `events` array.

## Evidence boundary

- Cost is computed only from durable `assistant/message.usage` records.
- Calls without provider usage stay `missingUsageCalls`.
- Routes absent from the price book stay `unpricedCalls`.
- A below-budget answer is `unknown`, not `within`, while either count is non-zero.
- Current context pressure comes from DSH's own `ctx.tokenMeter`; it is not confused with lifetime spend.

## Verify

```bash
npm test
npm run check
npm run smoke:plugin
```

MIT

