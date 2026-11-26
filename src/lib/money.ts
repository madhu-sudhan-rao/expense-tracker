export const SCALE = 100

const fmtCache = new Map<string, Intl.NumberFormat>()

function localeFor(currency: string) {
  // Indian grouping (1,00,000) for rupees; otherwise the browser's locale.
  return currency === 'INR' ? 'en-IN' : undefined
}

function formatter(currency: string, compact = false) {
  const key = `${currency}|${compact}`
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(localeFor(currency), {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : undefined,
    })
    fmtCache.set(key, f)
  }
  return f
}

export function fractionDigits(currency: string) {
  return formatter(currency).resolvedOptions().maximumFractionDigits ?? 2
}

export function formatMoney(
  amount: number,
  currency: string,
  opts: { sign?: boolean; compact?: boolean; hideZeroDecimals?: boolean } = {},
) {
  const value = amount / SCALE
  let s: string
  if (opts.hideZeroDecimals && Number.isInteger(value) && !opts.compact) {
    s = new Intl.NumberFormat(localeFor(currency), { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      Math.abs(value),
    )
  } else {
    s = formatter(currency, opts.compact).format(Math.abs(value))
  }
  if (value < 0) return `−${s}`
  if (opts.sign && value > 0) return `+${s}`
  return s
}

export function currencySymbol(currency: string) {
  const part = formatter(currency)
    .formatToParts(0)
    .find((p) => p.type === 'currency')
  return part?.value ?? currency
}

/** Parse user input like "1,234.5" into scaled integer. Returns null when invalid. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '')
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return null
  const n = Math.round(parseFloat(cleaned) * SCALE)
  return Number.isFinite(n) ? n : null
}

/** Scaled integer → plain editable string ("1234.5"). */
export function amountToInput(amount: number) {
  const v = amount / SCALE
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '')
}

const POPULAR = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY', 'SAR', 'CHF']

export interface CurrencyOption {
  code: string
  name: string
  symbol: string
}

let currencyList: CurrencyOption[] | null = null

export function allCurrencies(): CurrencyOption[] {
  if (currencyList) return currencyList
  let codes: string[]
  try {
    codes = Intl.supportedValuesOf('currency')
  } catch {
    codes = POPULAR
  }
  const names = new Intl.DisplayNames(undefined, { type: 'currency' })
  const list = codes.map((code) => ({ code, name: names.of(code) ?? code, symbol: currencySymbol(code) }))
  const rank = (c: string) => {
    const i = POPULAR.indexOf(c)
    return i === -1 ? 999 : i
  }
  list.sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name))
  currencyList = list
  return list
}

export function isPopularCurrency(code: string) {
  return POPULAR.includes(code)
}
