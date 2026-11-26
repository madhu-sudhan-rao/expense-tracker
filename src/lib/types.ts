// All amounts are integers in hundredths of the currency unit (e.g. paise, cents).
// A fixed scale (not the currency's own minor unit) keeps data valid if the currency is changed later.

export type TxType = 'expense' | 'income'

export interface SyncFields {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface Transaction extends SyncFields {
  type: TxType
  amount: number
  categoryId: string
  date: string // YYYY-MM-DD (local)
  /** Optional name, e.g. "Lunch with team". Falls back to the category name. */
  title?: string
  /** Where the money came from / went to (bank account, card, cash, wallet). */
  accountId?: string | null
  /** How a bank account was used (UPI, debit card…). Only for bank accounts. */
  via?: PayVia | null
  /** @deprecated v1 field, kept so old records still load. */
  paymentMethodId?: string | null
  note?: string
  goalEntryId?: string | null
  recurringId?: string | null
}

export interface Category extends SyncFields {
  name: string
  type: TxType
  icon: string
  color: string
  isSystem?: boolean
  archived?: boolean
  order: number
}

/** @deprecated replaced by Account in v2 */
export interface PaymentMethod extends SyncFields {
  name: string
  icon: string
  archived?: boolean
  order: number
}

export type AccountKind = 'bank' | 'card' | 'wallet' | 'cash'
export type PayVia = 'upi' | 'swipe' | 'netbanking' | 'cheque'

export interface Account extends SyncFields {
  kind: AccountKind
  /** Nickname shown in the app, e.g. "HDFC Salary". */
  name: string
  /** Bank / wallet key from institutions.ts, or 'other'. */
  institution: string
  /** Name typed by the user when institution is 'other'. */
  institutionName?: string
  last4?: string
  /** Bank: savings | current. */
  subtype?: 'savings' | 'current' | null
  /** Card network key (visa, mastercard, rupay…). */
  network?: string | null
  /** Optional user-uploaded logo (small PNG data URL). */
  logo?: string | null
  archived?: boolean
  order: number
}

export type GoalStatus = 'active' | 'achieved' | 'archived'

export interface Goal extends SyncFields {
  name: string
  targetAmount: number
  savingIn: string
  deadline?: string | null
  icon: string
  color: string
  status: GoalStatus
}

export type GoalEntryType = 'deposit' | 'withdrawal'

export interface GoalEntry extends SyncFields {
  goalId: string
  type: GoalEntryType
  amount: number
  date: string
  note?: string
  transactionId: string
}

export interface Budget extends SyncFields {
  categoryId: string
  monthlyLimit: number
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurring extends SyncFields {
  type: TxType
  amount: number
  categoryId: string
  accountId?: string | null
  via?: PayVia | null
  paymentMethodId?: string | null
  title?: string
  note?: string
  frequency: Frequency
  interval: number
  startDate: string
  endDate?: string | null
  mode: 'auto' | 'remind'
  /** Number of occurrences already handled (added or skipped). */
  count: number
  paused?: boolean
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  currency: string | null
  theme: Theme
  lastBackupAt: number | null
  onboarded: boolean
}

export const SAVINGS_CATEGORY_ID = 'cat-savings'
export const SAVINGS_WITHDRAWAL_CATEGORY_ID = 'cat-savings-withdrawal'
export const CASH_ACCOUNT_ID = 'acc-cash'
