import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { alive, db } from './db'
import { getSettings, DEFAULT_SETTINGS } from './ops'
import { monthRange, type MonthKey } from './dates'
import type { Account, Category, Goal, GoalEntry, Settings, TxType } from './types'

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, [], undefined)
}

export function useCurrency() {
  return useSettings()?.currency ?? DEFAULT_SETTINGS.currency ?? 'USD'
}

export function useCategories(type?: TxType, includeArchived = false) {
  return useLiveQuery(async () => {
    const all = (await db.categories.toArray()).filter(alive)
    return all
      .filter((c) => (!type || c.type === type) && (includeArchived || !c.archived))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }, [type, includeArchived])
}

/** All categories (including archived/deleted) keyed by id, for labelling historical transactions. */
export function useCategoryMap() {
  const all = useLiveQuery(() => db.categories.toArray(), [])
  return useMemo(() => new Map<string, Category>((all ?? []).map((c) => [c.id, c])), [all])
}

export function useAccounts(includeArchived = false) {
  return useLiveQuery(async () => {
    const all = (await db.accounts.toArray()).filter(alive)
    const kindOrder = { bank: 0, card: 1, wallet: 2, cash: 3 }
    return all
      .filter((a) => includeArchived || !a.archived)
      .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.order - b.order)
  }, [includeArchived])
}

/** All accounts (including archived/deleted) keyed by id, for labelling historical transactions. */
export function useAccountMap() {
  const all = useLiveQuery(() => db.accounts.toArray(), [])
  return useMemo(() => new Map<string, Account>((all ?? []).map((a) => [a.id, a])), [all])
}

export function useTransactionsInRange(from: string, to: string) {
  return useLiveQuery(
    async () =>
      (await db.transactions.where('date').between(from, to, true, true).toArray())
        .filter(alive)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [from, to],
  )
}

export function useMonthTransactions(month: MonthKey) {
  const [from, to] = monthRange(month)
  return useTransactionsInRange(from, to)
}

export function useGoals() {
  return useLiveQuery(async () => {
    const [goals, entries] = await Promise.all([db.goals.toArray(), db.goalEntries.toArray()])
    const balances = new Map<string, number>()
    for (const e of entries) {
      if (!alive(e)) continue
      balances.set(e.goalId, (balances.get(e.goalId) ?? 0) + (e.type === 'deposit' ? e.amount : -e.amount))
    }
    return goals
      .filter(alive)
      .map((g) => ({ ...g, balance: balances.get(g.id) ?? 0 }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [])
}

export type GoalWithBalance = Goal & { balance: number }

export function useGoalEntries(goalId: string) {
  return useLiveQuery(
    async () =>
      (await db.goalEntries.where('goalId').equals(goalId).toArray())
        .filter(alive)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt) as GoalEntry[],
    [goalId],
  )
}

export function useBudgets() {
  return useLiveQuery(async () => (await db.budgets.toArray()).filter(alive), [])
}

export function useRecurring() {
  return useLiveQuery(async () => (await db.recurring.toArray()).filter(alive), [])
}

// ---------- Tiny hash router ----------

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash)
  const path = hash.replace(/^#/, '') || '/'
  return path.split('?')[0]
}

export function navigate(path: string) {
  location.hash = path
}

// ---------- Misc ----------

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const handler = () => setMatches(m.matches)
    m.addEventListener('change', handler)
    return () => m.removeEventListener('change', handler)
  }, [query])
  return matches
}
