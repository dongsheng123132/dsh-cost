# dsh-cost

作者 / 维护者：贺去病（贺方升 / Dosen）· [hequbing.com](https://www.hequbing.com)

[![CI](https://github.com/dongsheng123132/dsh-cost/actions/workflows/check.yml/badge.svg)](https://github.com/dongsheng123132/dsh-cost/actions/workflows/check.yml)
[![MIT 许可证](https://img.shields.io/github/license/dongsheng123132/dsh-cost)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Awesome DSH Plugins](https://img.shields.io/badge/Awesome_DSH-%E5%B7%B2%E9%AA%8C%E8%AF%81%E5%AE%9E%E9%AA%8C-0969da)](https://github.com/dongsheng123132/awesome-dsh-plugins/blob/main/README.zh-CN.md#2origin-%E6%8F%92%E4%BB%B6%E5%AE%9E%E9%AA%8C%E5%AE%A4)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的证据优先 token 成本账本与预算检查器。

`dsh-cost` 折叠 DSH 的持久会话日志：把每条已提交的 `assistant/message.usage` 归属到当时生效的 `request/header` provider/model 路由，再套用用户自己维护的价格表。缺 usage、缺价格都会明确暴露，绝不把残缺证据包装成“总成本”。

## 安装

```bash
dsh plugin --profile <name> add github:dongsheng123132/dsh-cost
```

插件提供两个工具：

- `dsh_cost_report`：会话持久成本、路由拆分、证据完整性、可选预算状态，以及当前 `ctx.tokenMeter` 压力快照。
- `dsh_cost_check`：显式的 fail-open / fail-closed 预算判断；不冒充自动拦截未来调用。

同一证据核心还通过内置 stdio MCP server 暴露为 `cost_report` 和 `cost_check`。MCP 只接收有界、脱敏的 usage 行（`provider`、`model`、互斥 token 桶，或显式 `missingUsage` 标记），提示词、消息正文、凭据及其他额外字段会被拒绝。正式 Codex 插件清单位于 `.codex-plugin/plugin.json`。

DSH 入口采用只有 `name` / `inject` / `apply` 的 namespace plugin，不提供 default export，从而让真实 Cordis Loader 保留 `tools` 和 `tokenMeter` 注入；结构检查和插件 smoke 会阻止该回归再次出现。

## 价格表

复制 `prices.example.json`，按你自己当前的供应商合同填写价格，再通过插件配置传入绝对路径：

```yaml
- id: dsh-cost
  name: dsh-cost
  config:
    priceBookFile: C:/absolute/path/prices.json
    defaultBudget: 5
```

价格单位是每百万 token。输入、输出、缓存读取、缓存写入是互斥桶；`reasoningTokens` 已属于输出信息，不重复计费。

仓库不内置任何厂商价格：价格会变、账号折扣不同，过期数字比明确标出未定价更危险。

## 离线账本

```bash
dsh-cost --events session-events.json --prices prices.json --budget 5 --fail-closed
```

退出码 `2` 表示已超预算，或在 `--fail-closed` 下因证据不足而无法放行。事件文件可以是数组，也可以是带 `events` 数组的对象。

## 证据边界

- 只依据持久 `assistant/message.usage` 计费。
- 没有供应商 usage 的调用进入 `missingUsageCalls`。
- 价格表没有覆盖的路由进入 `unpricedCalls`。
- 上述任一项非零时，低于预算只能判 `unknown`，不能判 `within`。
- 当前上下文压力取自 DSH 自己的 `ctx.tokenMeter`，不与会话累计消费混为一谈。

## 验证

```bash
npm test
npm run check
npm run smoke:plugin
npm run smoke:mcp
```

已有 DSH 构建和装入本 bundle 的隔离 Web profile 时，可运行 `DSH_CHECKOUT=/path/to/dsh DSH_HOME=/path/to/isolated-home npm run smoke:web-loader`。该 smoke 使用有界且不含凭据的环境启动真实 stock Web profile，并要求观察到 readiness URL。设置 `DSH_CHECKOUT` 后，`npm run smoke:dsh` 还会通过真实 DSH ToolRuntime 枚举并调用两项工具。

MIT
