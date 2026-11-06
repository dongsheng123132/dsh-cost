# dsh-cost

**Maintainer / Author：He Fangsheng (贺方升 / 贺去病; also known as Dosen) · [hequbing.com](https://www.hequbing.com)**

[![CI](https://github.com/dongsheng123132/dsh-cost/actions/workflows/check.yml/badge.svg)](https://github.com/dongsheng123132/dsh-cost/actions/workflows/check.yml)
[![MIT license](https://img.shields.io/github/license/dongsheng123132/dsh-cost)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Awesome DSH Plugins](https://img.shields.io/badge/Awesome_DSH-verified_lab-0969da)](https://github.com/dongsheng123132/awesome-dsh-plugins#2origin-plugin-lab)

Evidence-first token cost ledger and budget checks for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

`dsh-cost` folds the durable DSH session log. It attributes each committed `assistant/message.usage` record to the active `request/header` provider/model route, then applies a user-owned price book. Missing usage and missing prices remain explicit: partial evidence never becomes a reassuring fake total.

## Install

```bash
dsh plugin --profile <name> add github:dongsheng123132/dsh-cost
```

The bundle mounts two tools:

- `dsh_cost_report` — durable session cost, route breakdown, evidence completeness, optional budget status, and the current `ctx.tokenMeter` pressure snapshot.
- `dsh_cost_check` — explicit fail-open/fail-closed budget decision. It does not claim to intercept future calls automatically.

The same evidence core is available through the bundled stdio MCP server as `cost_report` and `cost_check`. MCP accepts only bounded, sanitized usage rows (`provider`, `model`, disjoint token buckets, or an explicit `missingUsage` marker); it rejects prompts, message bodies, credentials and other extra fields. The formal Codex plugin manifest lives at `.codex-plugin/plugin.json`.

The DSH entry is a namespace plugin (`name` / `inject` / `apply`) with no default export. This preserves both `tools` and `tokenMeter` injection through the real Cordis Loader. Structural and plugin smokes fail if a default export is reintroduced.

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
npm run smoke:mcp
```

For a built DSH checkout and an isolated Web profile containing this bundle, run `DSH_CHECKOUT=/path/to/dsh DSH_HOME=/path/to/isolated-home npm run smoke:web-loader`. The smoke starts the real stock Web profile with a bounded, credential-free environment and requires an actual readiness URL. `npm run smoke:dsh` additionally enumerates and calls both tools through the real DSH ToolRuntime when `DSH_CHECKOUT` is set.

MIT
