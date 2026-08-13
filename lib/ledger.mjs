const ROUTE_PART = /^[^\s/][^\s]{0,255}$/
const PRICE_FIELDS = [
  'inputPerMillion',
  'outputPerMillion',
  'cacheReadPerMillion',
  'cacheWritePerMillion'
]

function finiteNonNegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`)
  }
  return value
}

export function validatePriceBook(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.prices)) {
    throw new Error('price book must contain a prices array')
  }
  const currency = value.currency ?? 'USD'
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error('currency must be a three-letter uppercase code')
  }
  const seen = new Set()
  const prices = value.prices.map((price, index) => {
    for (const field of ['provider', 'model']) {
      if (typeof price?.[field] !== 'string' || !ROUTE_PART.test(price[field])) {
        throw new Error(`prices[${index}].${field} is invalid`)
      }
    }
    const route = `${price.provider}/${price.model}`
    if (seen.has(route)) throw new Error(`duplicate price route: ${route}`)
    seen.add(route)
    return Object.fromEntries([
      ['provider', price.provider],
      ['model', price.model],
      ...PRICE_FIELDS.map(field => [field, finiteNonNegative(price[field] ?? 0, `prices[${index}].${field}`)])
    ])
  })
  return { currency, prices }
}

function usageCost(usage, price) {
  const inputTokens = finiteNonNegative(usage.inputTokens, 'usage.inputTokens')
  const outputTokens = finiteNonNegative(usage.outputTokens, 'usage.outputTokens')
  const cacheReadTokens = finiteNonNegative(usage.cacheReadTokens ?? 0, 'usage.cacheReadTokens')
  const cacheWriteTokens = finiteNonNegative(usage.cacheWriteTokens ?? 0, 'usage.cacheWriteTokens')
  return (
    inputTokens * price.inputPerMillion
    + outputTokens * price.outputPerMillion
    + cacheReadTokens * price.cacheReadPerMillion
    + cacheWriteTokens * price.cacheWritePerMillion
  ) / 1_000_000
}

function rounded(value) {
  return Math.round(value * 100_000_000) / 100_000_000
}

export function buildCostReport(events, rawPriceBook, { budget } = {}) {
  if (!Array.isArray(events)) throw new Error('events must be an array')
  const priceBook = validatePriceBook(rawPriceBook)
  if (budget !== undefined) finiteNonNegative(budget, 'budget')
  const prices = new Map(priceBook.prices.map(price => [`${price.provider}/${price.model}`, price]))
  const routes = new Map()
  let activeRoute = null
  let knownCost = 0
  let pricedCalls = 0
  let missingUsageCalls = 0
  let unpricedCalls = 0

  for (const event of events) {
    if (event?.type === 'request/header') {
      const config = event.data?.header?.config
      activeRoute = typeof config?.provider === 'string' && typeof config?.model === 'string'
        ? { provider: config.provider, model: config.model }
        : null
      continue
    }
    if (event?.type !== 'assistant/message') continue
    const routeId = activeRoute ? `${activeRoute.provider}/${activeRoute.model}` : 'unknown/unknown'
    const route = routes.get(routeId) ?? {
      provider: activeRoute?.provider ?? null,
      model: activeRoute?.model ?? null,
      calls: 0,
      pricedCalls: 0,
      cost: 0
    }
    route.calls += 1
    if (!event.data?.usage) {
      missingUsageCalls += 1
    } else {
      const price = prices.get(routeId)
      if (!price) {
        unpricedCalls += 1
      } else {
        const cost = usageCost(event.data.usage, price)
        knownCost += cost
        route.cost += cost
        route.pricedCalls += 1
        pricedCalls += 1
      }
    }
    routes.set(routeId, route)
  }

  const complete = missingUsageCalls === 0 && unpricedCalls === 0
  const budgetState = budget === undefined
    ? null
    : knownCost >= budget
      ? 'over'
      : complete
        ? 'within'
        : 'unknown'
  return {
    currency: priceBook.currency,
    knownCost: rounded(knownCost),
    complete,
    calls: [...routes.values()].reduce((sum, route) => sum + route.calls, 0),
    pricedCalls,
    missingUsageCalls,
    unpricedCalls,
    routes: [...routes.values()].map(route => ({ ...route, cost: rounded(route.cost) })),
    budget: budget === undefined ? null : { limit: budget, state: budgetState }
  }
}

