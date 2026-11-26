import { alive, db, stamp } from './db'
import { occurrenceDate, today } from './dates'
import {
  SAVINGS_CATEGORY_ID,
  SAVINGS_WITHDRAWAL_CATEGORY_ID,
  type Budget,
  type Category,
  type Goal,
  type GoalEntry,
  type GoalEntryType,
  type Account,
  type Recurring,
  type Settings,
  type Transaction,
} from './types'

const now = () => Date.now()

// ---------- Settings ----------

export const DEFAULT_SETTINGS: Settings = { currency: null, theme: 'system', lastBackupAt: null, onboarded: false }

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.meta.put({ key, value })
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.meta.toArray()
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows) s[r.key] = r.value
  return s as unknown as Settings
}

// ---------- Transactions ----------

export type TxInput = Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'date'> &
  Partial<Pick<Transaction, 'accountId' | 'via' | 'title' | 'note' | 'recurringId'>>

export async function addTransaction(input: TxInput) {
  const tx = stamp({ accountId: null, via: null, title: '', note: '', goalEntryId: null, recurringId: null, ...input }) as Transaction
  await db.transactions.add(tx)
  return tx.id
}

export async function updateTransaction(id: string, changes: Partial<TxInput>) {
  await db.transaction('rw', db.transactions, db.goalEntries, async () => {
    const tx = await db.transactions.get(id)
    if (!tx) return
    await db.transactions.update(id, { ...changes, updatedAt: now() })
    // Keep a linked goal entry in sync (amount/date/note only; category stays locked).
    if (tx.goalEntryId) {
      const sync: Partial<GoalEntry> = { updatedAt: now() }
      if (changes.amount !== undefined) sync.amount = changes.amount
      if (changes.date !== undefined) sync.date = changes.date
      // Don't copy the auto-generated "To goal: …" label into the goal's own history note.
      if (changes.note !== undefined) sync.note = /^(To|From) goal: /.test(changes.note) ? '' : changes.note
      await db.goalEntries.update(tx.goalEntryId, sync)
    }
  })
}

/** Soft-deletes a transaction (and its linked goal entry). Returns an undo function. */
export async function deleteTransaction(id: string) {
  const t = now()
  let entryId: string | null = null
  await db.transaction('rw', db.transactions, db.goalEntries, async () => {
    const tx = await db.transactions.get(id)
    if (!tx) return
    entryId = tx.goalEntryId ?? null
    await db.transactions.update(id, { deletedAt: t, updatedAt: t })
    if (entryId) await db.goalEntries.update(entryId, { deletedAt: t, updatedAt: t })
  })
  return async () => {
    await db.transaction('rw', db.transactions, db.goalEntries, async () => {
      await db.transactions.update(id, { deletedAt: null, updatedAt: now() })
      if (entryId) await db.goalEntries.update(entryId, { deletedAt: null, updatedAt: now() })
    })
  }
}

// ---------- Goals ----------

export type GoalInput = Pick<Goal, 'name' | 'targetAmount' | 'savingIn' | 'deadline' | 'icon' | 'color'>

export async function createGoal(input: GoalInput) {
  const goal = stamp({ ...input, status: 'active' }) as Goal
  await db.goals.add(goal)
  return goal.id
}

export async function updateGoal(id: string, changes: Partial<Goal>) {
  await db.transaction('rw', db.goals, db.goalEntries, db.transactions, async () => {
    const prev = await db.goals.get(id)
    await db.goals.update(id, { ...changes, updatedAt: now() })
    // Linked transactions are named after the goal; keep them in step on rename.
    if (prev && changes.name && changes.name !== prev.name) {
      const entries = await db.goalEntries.where('goalId').equals(id).toArray()
      for (const e of entries) {
        const tx = await db.transactions.get(e.transactionId)
        if (tx && tx.title === prev.name) await db.transactions.update(tx.id, { title: changes.name, updatedAt: now() })
      }
    }
  })
}

/** Deletes a goal, its history, and the linked transactions. */
export async function deleteGoal(id: string) {
  const t = now()
  await db.transaction('rw', db.goals, db.goalEntries, db.transactions, async () => {
    const entries = await db.goalEntries.where('goalId').equals(id).toArray()
    for (const e of entries) {
      await db.goalEntries.update(e.id, { deletedAt: t, updatedAt: t })
      await db.transactions.update(e.transactionId, { deletedAt: t, updatedAt: t })
    }
    await db.goals.update(id, { deletedAt: t, updatedAt: t })
  })
}

export function goalBalance(entries: GoalEntry[]) {
  return entries.filter(alive).reduce((sum, e) => sum + (e.type === 'deposit' ? e.amount : -e.amount), 0)
}

export interface GoalEntryInput {
  type: GoalEntryType
  amount: number
  date: string
  note?: string
  accountId?: string | null
  via?: Transaction['via']
}

/**
 * Adds money to / takes money from a goal. Deposits are recorded as an expense in "Savings";
 * withdrawals as income in "Savings withdrawal". Both sides are linked.
 */
export async function addGoalEntry(goalId: string, input: GoalEntryInput) {
  await db.transaction('rw', db.goals, db.goalEntries, db.transactions, async () => {
    const goal = await db.goals.get(goalId)
    if (!goal) throw new Error('Goal not found')
    const entry = stamp({
      goalId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      note: input.note ?? '',
      transactionId: '',
    }) as GoalEntry
    const tx = stamp({
      type: input.type === 'deposit' ? 'expense' : 'income',
      amount: input.amount,
      categoryId: input.type === 'deposit' ? SAVINGS_CATEGORY_ID : SAVINGS_WITHDRAWAL_CATEGORY_ID,
      date: input.date,
      title: goal.name,
      note: input.note ?? '',
      accountId: input.accountId ?? null,
      via: input.via ?? null,
      goalEntryId: entry.id,
      recurringId: null,
    }) as Transaction
    entry.transactionId = tx.id
    await db.goalEntries.add(entry)
    await db.transactions.add(tx)
  })
}

export async function updateGoalEntry(id: string, changes: Partial<GoalEntryInput>) {
  await db.transaction('rw', db.goalEntries, db.transactions, async () => {
    const entry = await db.goalEntries.get(id)
    if (!entry) return
    const { accountId, via, ...entryChanges } = changes
    await db.goalEntries.update(id, { ...entryChanges, updatedAt: now() })
    const txChanges: Partial<Transaction> = { updatedAt: now() }
    if (changes.amount !== undefined) txChanges.amount = changes.amount
    if (changes.date !== undefined) txChanges.date = changes.date
    if (changes.note !== undefined) txChanges.note = changes.note
    if (accountId !== undefined) txChanges.accountId = accountId
    if (via !== undefined) txChanges.via = via
    await db.transactions.update(entry.transactionId, txChanges)
  })
}

export async function deleteGoalEntry(id: string) {
  const entry = await db.goalEntries.get(id)
  if (!entry) return async () => {}
  return deleteTransaction(entry.transactionId)
}

// ---------- Categories & payment methods ----------

export async function saveCategory(c: Partial<Category> & Pick<Category, 'name' | 'type' | 'icon' | 'color'>) {
  if (c.id) {
    await db.categories.update(c.id, { ...c, updatedAt: now() })
    return c.id
  }
  const count = await db.categories.where('type').equals(c.type).count()
  const cat = stamp({ ...c, order: count, archived: false }) as Category
  await db.categories.add(cat)
  return cat.id
}

export type AccountInput = Omit<Account, keyof import('./types').SyncFields | 'order'> & { id?: string }

export async function saveAccount(a: AccountInput) {
  if (a.id) {
    await db.accounts.update(a.id, { ...a, updatedAt: now() })
    return a.id
  }
  const count = await db.accounts.count()
  const acc = stamp({ ...a, order: count, archived: false }) as Account
  await db.accounts.add(acc)
  return acc.id
}

/** "Removing" an account archives it so past transactions keep their label and logo. */
export async function setAccountArchived(id: string, archived: boolean) {
  await db.accounts.update(id, { archived, updatedAt: now() })
}

// ---------- Budgets ----------

export async function setBudget(categoryId: string, monthlyLimit: number | null) {
  const existing = (await db.budgets.where('categoryId').equals(categoryId).toArray()).filter(alive)
  const t = now()
  if (monthlyLimit === null || monthlyLimit <= 0) {
    for (const b of existing) await db.budgets.update(b.id, { deletedAt: t, updatedAt: t })
    return
  }
  if (existing[0]) await db.budgets.update(existing[0].id, { monthlyLimit, updatedAt: t })
  else await db.budgets.add(stamp({ categoryId, monthlyLimit }) as Budget)
}

// ---------- Recurring ----------

export type RecurringInput = Omit<Recurring, keyof import('./types').SyncFields | 'count'>

export async function saveRecurring(input: RecurringInput, id?: string) {
  if (id) {
    const prev = await db.recurring.get(id)
    // If the schedule changed, restart counting from the first occurrence that is still upcoming.
    const scheduleChanged =
      prev &&
      (prev.startDate !== input.startDate || prev.frequency !== input.frequency || prev.interval !== input.interval)
    let count = prev?.count ?? 0
    // Resuming a paused rule (or changing its schedule) skips occurrences that are already in the past.
    if (scheduleChanged || (prev?.paused && !input.paused)) {
      count = 0
      const t = today()
      while (occurrenceDate(input.startDate, input.frequency, input.interval, count) < t) count++
    }
    await db.recurring.update(id, { ...input, count, updatedAt: now() })
    return id
  }
  const r = stamp({ ...input, count: 0 }) as Recurring
  await db.recurring.add(r)
  return r.id
}

export async function deleteRecurring(id: string) {
  await db.recurring.update(id, { deletedAt: now(), updatedAt: now() })
}

export function nextDue(r: Recurring): string | null {
  const d = occurrenceDate(r.startDate, r.frequency, r.interval, r.count)
  if (r.endDate && d > r.endDate) return null
  return d
}

/** Creates any auto-mode transactions that have come due (including ones missed while the app was closed). */
export async function processRecurring() {
  const t = today()
  let created = 0
  await db.transaction('rw', db.recurring, db.transactions, async () => {
    const rules = (await db.recurring.toArray()).filter((r) => alive(r) && r.mode === 'auto' && !r.paused)
    for (const r of rules) {
      let count = r.count
      let guard = 0
      for (;;) {
        const d = occurrenceDate(r.startDate, r.frequency, r.interval, count)
        if (d > t || (r.endDate && d > r.endDate) || guard++ > 1000) break
        await db.transactions.add(
          stamp({
            type: r.type,
            amount: r.amount,
            categoryId: r.categoryId,
            accountId: r.accountId ?? null,
            via: r.via ?? null,
            title: r.title ?? '',
            note: r.note ?? '',
            date: d,
            goalEntryId: null,
            recurringId: r.id,
          }) as Transaction,
        )
        count++
        created++
      }
      if (count !== r.count) await db.recurring.update(r.id, { count, updatedAt: now() })
    }
  })
  return created
}

/** For remind-mode rules: record the due occurrence as a transaction. */
export async function confirmDue(r: Recurring) {
  const d = nextDue(r)
  if (!d) return
  await db.transaction('rw', db.recurring, db.transactions, async () => {
    await addTransaction({
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId,
      accountId: r.accountId ?? null,
      via: r.via ?? null,
      title: r.title ?? '',
      note: r.note ?? '',
      date: d,
      recurringId: r.id,
    })
    await db.recurring.update(r.id, { count: r.count + 1, updatedAt: now() })
  })
}

export async function skipDue(r: Recurring) {
  await db.recurring.update(r.id, { count: r.count + 1, updatedAt: now() })
}
