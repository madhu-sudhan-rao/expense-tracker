import { useMemo, useState } from 'react'
import { useBudgets, useCategories, useCurrency, useMonthTransactions } from '../lib/hooks'
import { currentMonth } from '../lib/dates'
import { amountToInput, currencySymbol, formatMoney, parseAmount } from '../lib/money'
import { setBudget } from '../lib/ops'
import { SAVINGS_CATEGORY_ID, type Category } from '../lib/types'
import { MonthSwitcher, PageHeader, Progress } from '../components/ui'
import { Sheet } from '../components/Sheet'
import { toast } from '../components/Toast'
import { IconTile } from '../components/brand'

export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth())
  const currency = useCurrency()
  const cats = useCategories('expense')
  const budgets = useBudgets()
  const txs = useMonthTransactions(month)
  const [editing, setEditing] = useState<Category | null>(null)

  const spentBy = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of txs ?? []) if (t.type === 'expense') m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount)
    return m
  }, [txs])
  const limitBy = useMemo(() => new Map((budgets ?? []).map((b) => [b.categoryId, b.monthlyLimit])), [budgets])

  const rows = (cats ?? [])
    .filter((c) => c.id !== SAVINGS_CATEGORY_ID)
    .map((c) => ({ c, spent: spentBy.get(c.id) ?? 0, limit: limitBy.get(c.id) ?? 0 }))
  const withBudget = rows.filter((r) => r.limit > 0).sort((a, b) => b.spent / b.limit - a.spent / a.limit)
  const without = rows.filter((r) => r.limit === 0)
  const totalLimit = withBudget.reduce((s, r) => s + r.limit, 0)
  const totalSpent = withBudget.reduce((s, r) => s + r.spent, 0)

  return (
    <div className="page">
      <PageHeader title="Budgets">
        <MonthSwitcher month={month} onChange={setMonth} />
      </PageHeader>

      {totalLimit > 0 && (
        <section className="card">
          <div className="budget-top">
            <strong>Total budgeted</strong>
            <span>
              {formatMoney(totalSpent, currency)} / {formatMoney(totalLimit, currency)}
            </span>
          </div>
          <Progress value={totalSpent} max={totalLimit} color={totalSpent > totalLimit ? 'var(--expense)' : 'var(--accent)'} />
          <p className="muted small">
            {totalSpent <= totalLimit
              ? `${formatMoney(totalLimit - totalSpent, currency)} left this month`
              : `${formatMoney(totalSpent - totalLimit, currency)} over budget`}
          </p>
        </section>
      )}

      {withBudget.length > 0 && (
        <section className="card flush">
          <ul className="budget-rows">
            {withBudget.map(({ c, spent, limit }) => {
              const ratio = spent / limit
              const tone = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : ''
              return (
                <li key={c.id}>
                  <button onClick={() => setEditing(c)}>
                    <div className="budget-top">
                      <span className="with-icon">
                        <IconTile icon={c.icon} color={c.color} size="xs" /> {c.name}
                      </span>
                      <span className={tone || 'muted'}>
                        {formatMoney(spent, currency, { hideZeroDecimals: true })} / {formatMoney(limit, currency, { hideZeroDecimals: true })}
                      </span>
                    </div>
                    <Progress value={spent} max={limit} color={ratio >= 1 ? 'var(--expense)' : ratio >= 0.8 ? 'var(--warn)' : c.color} />
                    <span className={`small ${tone || 'muted'}`}>
                      {ratio >= 1
                        ? `Over by ${formatMoney(spent - limit, currency)}`
                        : ratio >= 0.8
                          ? `${Math.round(ratio * 100)}% used — ${formatMoney(limit - spent, currency)} left`
                          : `${formatMoney(limit - spent, currency)} left`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="card flush">
        <h2 className="card-title pad">{withBudget.length ? 'No budget set' : 'Set a monthly limit for a category'}</h2>
        <ul className="budget-rows compact">
          {without.map(({ c, spent }) => (
            <li key={c.id}>
              <button onClick={() => setEditing(c)}>
                <div className="budget-top">
                  <span className="with-icon">
                    <IconTile icon={c.icon} color={c.color} size="xs" /> {c.name}
                  </span>
                  <span className="muted small">
                    {spent > 0 && `${formatMoney(spent, currency)} spent · `}
                    <span className="link">Set limit</span>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="muted small center">Limits repeat every month. Savings (goal deposits) aren't counted.</p>

      {editing && (
        <BudgetSheet category={editing} limit={limitBy.get(editing.id) ?? 0} currency={currency} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function BudgetSheet({ category, limit, currency, onClose }: { category: Category; limit: number; currency: string; onClose: () => void }) {
  const [value, setValue] = useState(limit ? amountToInput(limit) : '')
  async function save() {
    const amt = value.trim() ? parseAmount(value) : null
    if (value.trim() && (amt === null || amt < 0)) return
    await setBudget(category.id, amt)
    toast(amt ? 'Budget saved' : 'Budget removed')
    onClose()
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={category.name}
      footer={
        <div className="btn-row">
          {limit > 0 && (
            <button className="btn ghost danger" onClick={() => setBudget(category.id, null).then(() => { toast('Budget removed'); onClose() })}>
              Remove
            </button>
          )}
          <button className="btn primary grow" onClick={save}>
            Save
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="tx-form">
        <label className="amount-field">
          <span className="sr-only">Monthly limit</span>
          <span className="amount-symbol">{currencySymbol(currency)}</span>
          <input autoFocus inputMode="decimal" placeholder="0" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} />
        </label>
        <p className="muted small center">Monthly limit</p>
      </form>
    </Sheet>
  )
}
