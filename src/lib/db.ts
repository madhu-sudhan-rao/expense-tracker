import Dexie, { type EntityTable, type Transaction as DexieTx } from 'dexie'
import { EMOJI_TO_ICON } from './icons'
import {
  CASH_ACCOUNT_ID,
  SAVINGS_CATEGORY_ID,
  SAVINGS_WITHDRAWAL_CATEGORY_ID,
  type Account,
  type Budget,
  type Category,
  type Goal,
  type GoalEntry,
  type PaymentMethod,
  type Recurring,
  type Transaction,
  type TxType,
} from './types'

export interface MetaRow {
  key: string
  value: unknown
}

export const db = new Dexie('finance-tracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  paymentMethods: EntityTable<PaymentMethod, 'id'>
  accounts: EntityTable<Account, 'id'>
  goals: EntityTable<Goal, 'id'>
  goalEntries: EntityTable<GoalEntry, 'id'>
  budgets: EntityTable<Budget, 'id'>
  recurring: EntityTable<Recurring, 'id'>
  meta: EntityTable<MetaRow, 'key'>
}

db.version(1).stores({
  transactions: 'id, date, type, categoryId, goalEntryId, recurringId, updatedAt',
  categories: 'id, type, updatedAt',
  paymentMethods: 'id, updatedAt',
  goals: 'id, status, updatedAt',
  goalEntries: 'id, goalId, date, transactionId, updatedAt',
  budgets: 'id, categoryId, updatedAt',
  recurring: 'id, updatedAt',
  meta: 'key',
})

// v2: emoji icons → icon keys; payment methods → accounts (+ "via" for UPI etc.).
db.version(2)
  .stores({
    transactions: 'id, date, type, categoryId, accountId, goalEntryId, recurringId, updatedAt',
    accounts: 'id, kind, updatedAt',
  })
  .upgrade(async (tx) => {
    const toKey = (icon: string) => EMOJI_TO_ICON[icon] ?? (/^[a-z0-9-]+$/.test(icon) ? icon : 'tag')
    await tx.table('categories').toCollection().modify((c: Category) => {
      c.icon = toKey(c.icon)
    })
    await tx.table('goals').toCollection().modify((g: Goal) => {
      g.icon = toKey(g.icon)
    })

    await tx.table('accounts').add(cashAccount())
    // Only methods actually used by a transaction or recurring rule need carrying over.
    const used = new Set<string>()
    for (const t of ['transactions', 'recurring'])
      await tx.table(t).each((r: { paymentMethodId?: string | null }) => r.paymentMethodId && used.add(r.paymentMethodId))
    const methods: PaymentMethod[] = (await tx.table('paymentMethods').toArray()).filter((m) => used.has(m.id))
    // Map each old method to an account and/or a "via".
    const map = new Map<string, { accountId: string | null; via: Transaction['via'] }>()
    let order = 1
    for (const m of methods) {
      const n = m.name.toLowerCase()
      if (n === 'cash') map.set(m.id, { accountId: CASH_ACCOUNT_ID, via: null })
      else if (n === 'upi') map.set(m.id, { accountId: null, via: 'upi' })
      else if (n === 'debit card') map.set(m.id, { accountId: null, via: 'swipe' })
      else if (n === 'bank transfer') map.set(m.id, { accountId: null, via: 'netbanking' })
      else {
        // Custom or "Credit card" methods become accounts so old entries keep their label.
        const acc = stampRow({
          kind: n.includes('credit') ? 'card' : 'bank',
          name: m.name,
          institution: 'other',
          institutionName: '',
          order: order++,
          archived: n === 'credit card' ? true : !!m.archived,
        }) as Account
        await tx.table('accounts').add(acc)
        map.set(m.id, { accountId: acc.id, via: null })
      }
    }
    const migrate = (r: { paymentMethodId?: string | null; accountId?: string | null; via?: Transaction['via'] }) => {
      const m = r.paymentMethodId ? map.get(r.paymentMethodId) : undefined
      r.accountId = m?.accountId ?? null
      r.via = m?.via ?? null
    }
    await tx.table('transactions').toCollection().modify(migrate)
    await tx.table('recurring').toCollection().modify(migrate)
    // Existing users already went through setup.
    const currency = await tx.table('meta').get('currency')
    if (currency?.value) await tx.table('meta').put({ key: 'onboarded', value: true })
  })

// v3: "Debit card" via became "Swipe"; recurring "note" (used as its name) became "title".
db.version(3).upgrade(async (tx) => {
  const fixVia = (r: { via?: string | null }) => {
    if (r.via === 'debit_card') r.via = 'swipe'
  }
  await tx.table('transactions').toCollection().modify(fixVia)
  await tx.table('recurring').toCollection().modify((r: Recurring) => {
    fixVia(r)
    if (!r.title && r.note) {
      r.title = r.note
      r.note = ''
    }
  })
})

export const SYNC_TABLES = [
  'transactions',
  'categories',
  'accounts',
  'goals',
  'goalEntries',
  'budgets',
  'recurring',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export const uid = () => crypto.randomUUID()

function stampRow<T extends object>(data: T, id?: string) {
  const now = Date.now()
  return { ...data, id: id ?? uid(), createdAt: now, updatedAt: now, deletedAt: null }
}
export const stamp = stampRow

function cashAccount(): Account {
  return stampRow({ kind: 'cash', name: 'Cash', institution: 'cash', order: 0, archived: false }, CASH_ACCOUNT_ID) as Account
}

const EXPENSE_DEFAULTS: [string, string, string][] = [
  ['Food & Dining', 'utensils', '#f97316'],
  ['Groceries', 'shopping-cart', '#65a30d'],
  ['Transport', 'bus', '#0ea5e9'],
  ['Fuel', 'fuel', '#64748b'],
  ['Shopping', 'shopping-bag', '#ec4899'],
  ['Bills & Utilities', 'lightbulb', '#ca8a04'],
  ['Rent', 'house', '#8b5cf6'],
  ['Health', 'heart-pulse', '#ef4444'],
  ['Entertainment', 'clapperboard', '#a855f7'],
  ['Education', 'graduation-cap', '#3b82f6'],
  ['Travel', 'plane', '#06b6d4'],
  ['Subscriptions', 'repeat', '#6366f1'],
  ['Gifts', 'gift', '#f43f5e'],
  ['Personal care', 'scissors', '#d946ef'],
  ['Other', 'package', '#78716c'],
]

const INCOME_DEFAULTS: [string, string, string][] = [
  ['Salary', 'briefcase', '#16a34a'],
  ['Freelance', 'laptop', '#0d9488'],
  ['Business', 'store', '#2563eb'],
  ['Interest', 'percent', '#0891b2'],
  ['Refund', 'undo', '#65a30d'],
  ['Gift', 'gift', '#db2777'],
  ['Other', 'coins', '#78716c'],
]

function makeCategories(list: [string, string, string][], type: TxType): Category[] {
  return list.map(([name, icon, color], i) => stampRow({ name, icon, color, type, order: i }) as Category)
}

async function seed(tx: DexieTx) {
  const categories: Category[] = [
    ...makeCategories(EXPENSE_DEFAULTS, 'expense'),
    stampRow(
      { name: 'Savings', icon: 'piggy-bank', color: '#10b981', type: 'expense', order: 100, isSystem: true },
      SAVINGS_CATEGORY_ID,
    ) as Category,
    ...makeCategories(INCOME_DEFAULTS, 'income'),
    stampRow(
      { name: 'Savings withdrawal', icon: 'piggy-bank', color: '#10b981', type: 'income', order: 100, isSystem: true },
      SAVINGS_WITHDRAWAL_CATEGORY_ID,
    ) as Category,
  ]
  await tx.table('categories').bulkAdd(categories)
  await tx.table('accounts').add(cashAccount())
}

db.on('populate', seed)

export const alive = <T extends { deletedAt?: number | null }>(r: T) => !r.deletedAt
