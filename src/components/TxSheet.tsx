import { useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useAccountMap, useCategories, useCurrency } from '../lib/hooks'
import { amountToInput, parseAmount } from '../lib/money'
import { addTransaction, deleteTransaction, saveRecurring, updateTransaction } from '../lib/ops'
import { today } from '../lib/dates'
import { SAVINGS_CATEGORY_ID, SAVINGS_WITHDRAWAL_CATEGORY_ID, type Frequency, type PayVia, type Transaction, type TxType } from '../lib/types'
import { Sheet } from './Sheet'
import { AmountField, CategoryGrid, Field, Segmented } from './ui'
import { AccountPicker, ViaPicker } from './AccountPicker'
import { fitVia, usesVia } from './brand'
import { PiggyBank } from 'lucide-react'
import { TrashIcon } from './Icons'
import { toast } from './Toast'

// ----- global open/close store -----
type OpenState = { tx?: Transaction; type?: TxType } | null
let state: OpenState = null
const subs = new Set<() => void>()
export function openTxForm(s: { tx?: Transaction; type?: TxType } = {}) {
  state = s
  subs.forEach((f) => f())
}
function closeTxForm() {
  state = null
  subs.forEach((f) => f())
}

export function TxSheetHost() {
  const s = useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => state,
  )
  if (!s) return null
  return <TxForm key={s.tx?.id ?? 'new'} initial={s} />
}

const LAST_ACCOUNT_KEY = 'ft:lastAccount'

function TxForm({ initial }: { initial: NonNullable<OpenState> }) {
  const editing = initial.tx
  const currency = useCurrency()
  const [type, setType] = useState<TxType>(editing?.type ?? initial.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? amountToInput(editing.amount) : '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '')
  const [date, setDate] = useState(editing?.date ?? today())
  const [accountId, setAccountId] = useState<string | null>(
    editing ? (editing.accountId ?? null) : localStorage.getItem(LAST_ACCOUNT_KEY),
  )
  const [via, setVia] = useState<PayVia | null>(editing ? (editing.via ?? null) : 'upi')
  const [title, setTitle] = useState(editing?.title ?? '')
  const accountMap = useAccountMap()
  const account = accountId ? accountMap.get(accountId) : undefined
  // Ignore a remembered account that was removed since.
  const validAccount = account && !account.deletedAt && (!account.archived || editing?.accountId === account.id)
  const effectiveAccountId = validAccount ? accountId : null
  const effectiveVia = validAccount ? fitVia(account, via) : null
  function pickAccount(id: string | null) {
    setAccountId(id)
    // Banks and cards default to UPI; cash and wallets have no "via".
    setVia(id && usesVia(accountMap.get(id)) ? 'upi' : null)
  }
  const [note, setNote] = useState(editing?.note ?? '')
  const [repeat, setRepeat] = useState<Frequency | ''>('')
  const [error, setError] = useState('')

  const allCats = useCategories(type)
  const linkedGoal = useLiveQuery(async () => {
    if (!editing?.goalEntryId) return null
    const e = await db.goalEntries.get(editing.goalEntryId)
    return e ? ((await db.goals.get(e.goalId)) ?? null) : null
  }, [editing?.goalEntryId])
  const isLinked = !!editing?.goalEntryId
  const categories = (allCats ?? []).filter(
    (c) => isLinked || (c.id !== SAVINGS_CATEGORY_ID && c.id !== SAVINGS_WITHDRAWAL_CATEGORY_ID),
  )

  async function save() {
    const value = parseAmount(amount)
    if (!value || value <= 0) return setError('Enter an amount')
    if (!categoryId) return setError('Pick a category')
    const data = { type, amount: value, categoryId, date, accountId: effectiveAccountId, via: effectiveVia, title: title.trim(), note: note.trim() }
    if (editing) {
      await updateTransaction(editing.id, data)
      toast('Saved')
    } else {
      let recurringId: string | null = null
      if (repeat) {
        recurringId = await saveRecurring({
          type,
          amount: value,
          categoryId,
          accountId: effectiveAccountId,
          via: effectiveVia,
          title: title.trim(),
          note: note.trim(),
          frequency: repeat,
          interval: 1,
          startDate: date,
          endDate: null,
          mode: 'auto',
        })
        // The first occurrence is this transaction.
        await db.recurring.update(recurringId, { count: 1 })
      }
      await addTransaction({ ...data, recurringId })
      toast(type === 'expense' ? 'Expense added' : 'Income added')
    }
    if (effectiveAccountId) localStorage.setItem(LAST_ACCOUNT_KEY, effectiveAccountId)
    closeTxForm()
  }

  async function remove() {
    if (!editing) return
    const undo = await deleteTransaction(editing.id)
    closeTxForm()
    toast('Transaction deleted', { label: 'Undo', run: undo })
  }

  return (
    <Sheet
      open
      onClose={closeTxForm}
      title={editing ? 'Edit transaction' : 'Add transaction'}
      headerAction={
        editing && (
          <button className="icon-btn danger" onClick={remove} aria-label="Delete transaction">
            <TrashIcon />
          </button>
        )
      }
      footer={
        <button className="btn primary block" onClick={save}>
          {editing ? 'Save changes' : `Add ${type}`}
        </button>
      }
    >
      <form
        className="tx-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {!isLinked && (
          <Segmented
            value={type}
            onChange={(v) => {
              setType(v)
              setCategoryId('')
            }}
            ariaLabel="Type"
            options={[
              { value: 'expense', label: 'Expense', tone: 'expense' },
              { value: 'income', label: 'Income', tone: 'income' },
            ]}
          />
        )}
        <AmountField value={amount} onChange={(v) => { setAmount(v); setError('') }} currency={currency} autoFocus={!editing} tone={type} />
        <Field label="Name">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'expense' ? 'e.g. Lunch with team (optional)' : 'e.g. November salary (optional)'}
            maxLength={80}
            enterKeyHint="next"
          />
        </Field>

        {isLinked ? (
          <p className="linked-note">
            <PiggyBank size={16} /> Linked to goal <strong>{linkedGoal?.name ?? '…'}</strong>. Amount, date and note stay in sync with the goal history.
          </p>
        ) : (
          <div className="field">
            <span className="field-label">Category</span>
            <CategoryGrid categories={categories} value={categoryId} onChange={(id) => { setCategoryId(id); setError('') }} />
          </div>
        )}

        <div className="field-row">
          <Field label="Date">
            <input type="date" value={date} max="9999-12-31" onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          {!editing && (
            <Field label="Repeat">
              <select value={repeat} onChange={(e) => setRepeat(e.target.value as Frequency | '')}>
                <option value="">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
          )}
        </div>

        <AccountPicker
          label={type === 'expense' ? 'Paid from' : 'Received in'}
          value={effectiveAccountId}
          onChange={pickAccount}
          current={editing?.accountId ? accountMap.get(editing.accountId) : undefined}
        />
        {usesVia(account) && validAccount && <ViaPicker account={account} value={effectiveVia} onChange={setVia} />}

        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
