import { useState } from 'react'
import { useCategories, useCategoryMap, useCurrency, useRecurring } from '../lib/hooks'
import { describeFrequency, formatDate, today } from '../lib/dates'
import { amountToInput, formatMoney, parseAmount } from '../lib/money'
import { deleteRecurring, nextDue, processRecurring, saveRecurring } from '../lib/ops'
import { SAVINGS_CATEGORY_ID, SAVINGS_WITHDRAWAL_CATEGORY_ID, type Frequency, type PayVia, type Recurring, type TxType } from '../lib/types'
import { AmountField, CategoryGrid, Empty, Field, PageHeader, Segmented } from '../components/ui'
import { Sheet } from '../components/Sheet'
import { PlusIcon, TrashIcon } from '../components/Icons'
import { toast } from '../components/Toast'
import { fitVia, IconTile, usesVia } from '../components/brand'
import { AccountPicker, ViaPicker } from '../components/AccountPicker'
import { useAccountMap } from '../lib/hooks'
import { Repeat } from 'lucide-react'

export function RecurringPage() {
  const currency = useCurrency()
  const rules = useRecurring()
  const cats = useCategoryMap()
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)

  const sorted = [...(rules ?? [])].sort((a, b) => (nextDue(a) ?? '9999').localeCompare(nextDue(b) ?? '9999'))
  const monthlyOut = (rules ?? [])
    .filter((r) => r.type === 'expense' && !r.paused && nextDue(r))
    .reduce((s, r) => s + monthlyEquivalent(r), 0)

  return (
    <div className="page">
      <PageHeader title="Recurring">
        <button className="btn primary icon-label" onClick={() => setEditing('new')}>
          <PlusIcon size={18} /> <span>New</span>
        </button>
      </PageHeader>

      {monthlyOut > 0 && (
        <section className="card">
          <span className="muted small">Recurring expenses, per month (approx.)</span>
          <strong className="big-number">{formatMoney(monthlyOut, currency)}</strong>
        </section>
      )}

      {rules && sorted.length === 0 ? (
        <Empty icon={Repeat} title="No recurring transactions">
          <p>Rent, salary, subscriptions, EMIs… add them once and they'll be logged automatically or you'll get a reminder.</p>
          <button className="btn small primary" onClick={() => setEditing('new')}>
            Add recurring
          </button>
        </Empty>
      ) : (
        <div className="card flush">
          <div className="tx-list">
            {sorted.map((r) => {
              const c = cats.get(r.categoryId)
              const nd = nextDue(r)
              return (
                <button key={r.id} className="tx-row" onClick={() => setEditing(r)}>
                  <IconTile icon={c?.icon ?? 'tag'} color={c?.color ?? '#888'} />
                  <span className="tx-main">
                    <span className="tx-title">{r.title || r.note || c?.name}</span>
                    <span className="tx-sub">
                      {describeFrequency(r.frequency, r.interval)} · {r.mode === 'auto' ? 'Auto-add' : 'Remind'} ·{' '}
                      {r.paused ? 'Paused' : nd ? `next ${formatDate(nd)}` : 'Ended'}
                    </span>
                  </span>
                  <span className={`tx-amount ${r.type}`}>
                    {formatMoney(r.type === 'expense' ? -r.amount : r.amount, currency, { sign: true })}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <p className="muted small center">
        Auto-add items are created when you open the app, including any you missed while it was closed.
      </p>

      {editing && <RecurringSheet rule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function monthlyEquivalent(r: Recurring) {
  const per = { daily: 30.44, weekly: 4.35, monthly: 1, yearly: 1 / 12 }[r.frequency]
  return Math.round((r.amount * per) / r.interval)
}

function RecurringSheet({ rule, onClose }: { rule?: Recurring; onClose: () => void }) {
  const currency = useCurrency()
  const [type, setType] = useState<TxType>(rule?.type ?? 'expense')
  const [amount, setAmount] = useState(rule ? amountToInput(rule.amount) : '')
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '')
  const [accountId, setAccountId] = useState<string | null>(rule?.accountId ?? null)
  const [via, setVia] = useState<PayVia | null>(rule ? (rule.via ?? null) : 'upi')
  const [title, setTitle] = useState(rule?.title ?? '')
  const accountMap = useAccountMap()
  const account = accountId ? accountMap.get(accountId) : undefined
  const [note, setNote] = useState(rule?.note ?? '')
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly')
  const [interval, setIntervalStr] = useState(String(rule?.interval ?? 1))
  const [startDate, setStartDate] = useState(rule?.startDate ?? today())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [mode, setMode] = useState<'auto' | 'remind'>(rule?.mode ?? 'auto')
  const [paused, setPaused] = useState(rule?.paused ?? false)
  const [error, setError] = useState('')

  const cats = (useCategories(type) ?? []).filter((c) => c.id !== SAVINGS_CATEGORY_ID && c.id !== SAVINGS_WITHDRAWAL_CATEGORY_ID)

  async function save() {
    const amt = parseAmount(amount)
    const iv = Math.max(1, Math.min(365, parseInt(interval) || 1))
    if (!amt || amt <= 0) return setError('Enter an amount')
    if (!categoryId || !cats.some((c) => c.id === categoryId)) return setError('Pick a category')
    if (endDate && endDate < startDate) return setError('End date is before the start date')
    await saveRecurring(
      {
        type,
        amount: amt,
        categoryId,
        accountId,
        via: fitVia(account, via),
        title: title.trim(),
        note: note.trim(),
        frequency,
        interval: iv,
        startDate,
        endDate: endDate || null,
        mode,
        paused,
      },
      rule?.id,
    )
    const added = await processRecurring()
    toast(added ? `Saved · ${added} past transaction${added > 1 ? 's' : ''} added` : 'Saved')
    onClose()
  }

  async function remove() {
    if (!rule || !confirm('Delete this recurring item? Transactions already added are kept.')) return
    await deleteRecurring(rule.id)
    toast('Recurring item deleted')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={rule ? 'Edit recurring' : 'New recurring'}
      headerAction={
        rule && (
          <button className="icon-btn danger" onClick={remove} aria-label="Delete">
            <TrashIcon />
          </button>
        )
      }
      footer={
        <button className="btn primary block" onClick={save}>
          Save
        </button>
      }
    >
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Segmented
          value={type}
          onChange={(v) => { setType(v); setCategoryId('') }}
          options={[
            { value: 'expense', label: 'Expense', tone: 'expense' },
            { value: 'income', label: 'Income', tone: 'income' },
          ]}
        />
        <AmountField value={amount} onChange={(v) => { setAmount(v); setError('') }} currency={currency} tone={type} autoFocus={!rule} />
        <Field label="Name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rent, Netflix, Salary (optional)" maxLength={80} />
        </Field>
        <div className="field">
          <span className="field-label">Category</span>
          <CategoryGrid categories={cats} value={categoryId} onChange={(id) => { setCategoryId(id); setError('') }} />
        </div>
        <div className="field-row">
          <Field label="Repeats">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Every">
            <input inputMode="numeric" value={interval} onChange={(e) => setIntervalStr(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Starts / first date">
            <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
          </Field>
          <Field label="Ends (optional)">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="field">
          <span className="field-label">When it's due</span>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'auto', label: 'Add automatically' },
              { value: 'remind', label: 'Remind me' },
            ]}
          />
        </div>
        <AccountPicker
          label={type === 'expense' ? 'Paid from' : 'Received in'}
          value={accountId}
          onChange={(id) => {
            setAccountId(id)
            setVia(id && usesVia(accountMap.get(id)) ? 'upi' : null)
          }}
          current={rule?.accountId ? accountMap.get(rule.accountId) : undefined}
        />
        {usesVia(account) && <ViaPicker account={account} value={fitVia(account, via)} onChange={setVia} />}
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
        </Field>
        {rule && (
          <label className="check">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Paused
          </label>
        )}
        {!rule && startDate < today() && mode === 'auto' && (
          <p className="muted small">Past occurrences since {formatDate(startDate)} will be added when you save.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
