import type { Frequency } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toDateStr(new Date())

/** "YYYY-MM" */
export type MonthKey = string

export const monthOf = (date: string): MonthKey => date.slice(0, 7)
export const currentMonth = () => monthOf(today())

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthRange(month: MonthKey): [string, string] {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return [`${month}-01`, `${month}-${pad(last)}`]
}

export function formatMonth(month: MonthKey, short = false) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: short ? 'short' : 'long', year: 'numeric' })
}

export function formatDate(date: string, style: 'short' | 'long' = 'short') {
  const d = parseDate(date)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: sameYear && style === 'short' ? undefined : 'numeric',
  })
}

export function dayLabel(date: string) {
  const t = today()
  if (date === t) return 'Today'
  const y = toDateStr(new Date(Date.now() - 86400000))
  if (date === y) return 'Yesterday'
  const d = parseDate(date)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

/** Whole months from `from` until `to` (at least 1 if `to` is today or later; 0 if it has passed). */
export function monthsUntil(from: string, to: string) {
  if (to < from) return 0
  const a = parseDate(from)
  const b = parseDate(to)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  return Math.max(1, months)
}

/** The n-th (0-based) occurrence of a schedule, anchored to the start date to avoid month-end drift. */
export function occurrenceDate(start: string, freq: Frequency, interval: number, n: number): string {
  const s = parseDate(start)
  const step = n * interval
  switch (freq) {
    case 'daily':
      return toDateStr(new Date(s.getFullYear(), s.getMonth(), s.getDate() + step))
    case 'weekly':
      return toDateStr(new Date(s.getFullYear(), s.getMonth(), s.getDate() + step * 7))
    case 'monthly': {
      const y = s.getFullYear()
      const m = s.getMonth() + step
      const last = new Date(y, m + 1, 0).getDate()
      return toDateStr(new Date(y, m, Math.min(s.getDate(), last)))
    }
    case 'yearly': {
      const y = s.getFullYear() + step
      const last = new Date(y, s.getMonth() + 1, 0).getDate()
      return toDateStr(new Date(y, s.getMonth(), Math.min(s.getDate(), last)))
    }
  }
}

export function describeFrequency(freq: Frequency, interval: number) {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[freq]
  if (interval === 1) return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[freq]
  return `Every ${interval} ${unit}s`
}
