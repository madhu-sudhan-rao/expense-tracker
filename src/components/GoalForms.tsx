import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { alive, db } from '../lib/db'
import { useAccountMap, useCurrency } from '../lib/hooks'
import { amountToInput, formatMoney, parseAmount } from '../lib/money'
import { addGoalEntry, createGoal, deleteGoalEntry, updateGoal, updateGoalEntry } from '../lib/ops'
import { today } from '../lib/dates'
import type { Goal, GoalEntry, GoalEntryType, PayVia } from '../lib/types'
import { AccountPicker, ViaPicker } from './AccountPicker'
import { fitVia, usesVia } from './brand'
import { Sheet } from './Sheet'
import { AmountField, ColorPicker, Field, IconPicker } from './ui'
import { TrashIcon } from './Icons'
import { toast } from './Toast'

export function GoalFormSheet({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const currency = useCurrency()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? amountToInput(goal.targetAmount) : '')
  const [savingIn, setSavingIn] = useState(goal?.savingIn ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [color, setColor] = useState(goal?.color ?? '#10b981')
  const [error, setError] = useState('')

  const savingInSuggestions = useLiveQuery(async () => {
    const goals = (await db.goals.toArray()).filter(alive)
    const set = new Set(goals.map((g) => g.savingIn).filter(Boolean))
    for (const a of (await db.accounts.toArray()).filter((a) => alive(a) && !a.archived && a.kind === 'bank')) set.add(a.name)
    for (const s of ['Savings account', 'Fixed deposit', 'Mutual fund', 'Recurring deposit', 'Cash', 'Stocks', 'Gold']) set.add(s)
    return [...set]
  }, [])

  async function save() {
    const amt = parseAmount(target)
    if (!name.trim()) return setError('Give the goal a name')
    if (!amt || amt <= 0) return setError('Enter the amount needed')
    const data = { name: name.trim(), targetAmount: amt, savingIn: savingIn.trim(), deadline: deadline || null, icon, color }
    if (goal) {
      await updateGoal(goal.id, data)
      toast('Goal updated')
    } else {
      const id = await createGoal(data)
      toast('Goal created')
      location.hash = `/goals/${id}`
    }
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <button className="btn primary block" onClick={save}>
          {goal ? 'Save changes' : 'Create goal'}
        </button>
      }
    >
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Goal name">
          <input value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder="e.g. Emergency fund, New bike" autoFocus={!goal} maxLength={60} />
        </Field>
        <AmountField label="Amount needed" value={target} onChange={(v) => { setTarget(v); setError('') }} currency={currency} />
        <Field label="Saving in" hint="Where the money is kept">
          <input value={savingIn} onChange={(e) => setSavingIn(e.target.value)} placeholder="e.g. Savings account, FD, Mutual fund" list="saving-in-list" maxLength={60} />
          <datalist id="saving-in-list">
            {(savingInSuggestions ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Target date (optional)">
          <input type="date" value={deadline} min={goal ? undefined : today()} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Icon</span>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
        <div className="field">
          <span className="field-label">Colour</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

export function GoalEntrySheet({
  goal,
  balance,
  type,
  entry,
  onClose,
}: {
  goal: Goal
  balance: number
  type: GoalEntryType
  entry?: GoalEntry
  onClose: () => void
}) {
  const currency = useCurrency()
  const accountMap = useAccountMap()
  const linkedTx = useLiveQuery(() => (entry ? db.transactions.get(entry.transactionId) : undefined), [entry?.transactionId])
  const [amount, setAmount] = useState(entry ? amountToInput(entry.amount) : '')
  const [date, setDate] = useState(entry?.date ?? today())
  const [note, setNote] = useState(entry?.note ?? '')
  const [accountId, setAccountId] = useState<string | null | undefined>(undefined)
  const [via, setVia] = useState<PayVia | null | undefined>(undefined)
  const [error, setError] = useState('')
  const accValue = accountId === undefined ? (linkedTx?.accountId ?? null) : accountId
  const account = accValue ? accountMap.get(accValue) : undefined
  const viaValue = fitVia(account, via === undefined ? (linkedTx?.via ?? 'upi') : via)

  const isDeposit = type === 'deposit'
  // When editing a withdrawal, its own amount is already subtracted from the balance.
  const available = balance + (entry && !isDeposit ? entry.amount : 0)

  async function save() {
    const amt = parseAmount(amount)
    if (!amt || amt <= 0) return setError('Enter an amount')
    if (!isDeposit && amt > available) return setError(`You can take back at most ${formatMoney(available, currency)}`)
    if (isDeposit && entry && balance - entry.amount + amt < 0)
      return setError('Money has already been taken back from this goal, so the deposit can’t be lowered that far.')
    const data = { type, amount: amt, date, note: note.trim(), accountId: accValue, via: viaValue }
    if (entry) await updateGoalEntry(entry.id, data)
    else await addGoalEntry(goal.id, data)
    toast(entry ? 'Saved' : isDeposit ? `Added to ${goal.name}` : `Taken back from ${goal.name}`)
    onClose()
  }

  async function remove() {
    if (!entry) return
    const undo = await deleteGoalEntry(entry.id)
    onClose()
    toast('Entry deleted', { label: 'Undo', run: undo })
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${entry ? 'Edit' : ''} ${isDeposit ? 'Add money' : 'Take money back'}`.trim()}
      headerAction={
        entry && (
          <button className="icon-btn danger" onClick={remove} aria-label="Delete entry">
            <TrashIcon />
          </button>
        )
      }
      footer={
        <button className={`btn block ${isDeposit ? 'primary' : 'warn'}`} onClick={save}>
          {entry ? 'Save changes' : isDeposit ? 'Add money' : 'Take back'}
        </button>
      }
    >
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className="muted small">
          <strong>{goal.name}</strong>
          {goal.savingIn && <> · {goal.savingIn}</>} · Balance {formatMoney(balance, currency)}
        </p>
        <AmountField value={amount} onChange={(v) => { setAmount(v); setError('') }} currency={currency} autoFocus={!entry} tone={isDeposit ? 'expense' : 'income'} />
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <AccountPicker
          label={isDeposit ? 'Paid from' : 'Received in'}
          value={accValue}
          onChange={(id) => {
            setAccountId(id)
            setVia(id && usesVia(accountMap.get(id)) ? 'upi' : null)
          }}
          current={linkedTx?.accountId ? accountMap.get(linkedTx.accountId) : undefined}
        />
        {usesVia(account) && <ViaPicker account={account} value={viaValue} onChange={setVia} />}
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
        </Field>
        <p className="muted small">
          {isDeposit
            ? 'This is also recorded as an expense under “Savings”.'
            : 'This is also recorded as income under “Savings withdrawal”.'}
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
