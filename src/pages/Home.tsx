import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  useBudgets,
  useCategoryMap,
  useCurrency,
  useGoals,
  useMonthTransactions,
  useAccountMap,
  useRecurring,
  useSettings,
} from '../lib/hooks'
import { currentMonth, formatDate, today } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { confirmDue, nextDue, skipDue } from '../lib/ops'
import { exportJson } from '../lib/backup'
import { Empty, MonthSwitcher, Progress } from '../components/ui'
import { TxRow } from '../components/TxRow'
import { openTxForm } from '../components/TxSheet'
import { toast } from '../components/Toast'
import { ArrowDownIcon, ArrowUpIcon, BackupIcon } from '../components/Icons'
import { IconTile } from '../components/brand'
import { Receipt } from 'lucide-react'

export function HomePage() {
  const [month, setMonth] = useState(currentMonth())
  const currency = useCurrency()
  const txs = useMonthTransactions(month)
  const cats = useCategoryMap()
  const accounts = useAccountMap()
  const goals = useGoals()
  const budgets = useBudgets()
  const recurring = useRecurring()
  const settings = useSettings()

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    const byCat = new Map<string, number>()
    for (const t of txs ?? []) {
      if (t.type === 'income') income += t.amount
      else {
        expense += t.amount
        byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount)
      }
    }
    return { income, expense, byCat }
  }, [txs])

  const pie = useMemo(
    () =>
      [...totals.byCat.entries()]
        .map(([id, value]) => ({ id, value, name: cats.get(id)?.name ?? '?', color: cats.get(id)?.color ?? '#888', icon: cats.get(id)?.icon ?? '' }))
        .sort((a, b) => b.value - a.value),
    [totals, cats],
  )

  const budgetRows = useMemo(
    () =>
      (budgets ?? [])
        .map((b) => ({ b, spent: totals.byCat.get(b.categoryId) ?? 0, cat: cats.get(b.categoryId) }))
        .filter((r) => r.cat && !r.cat.deletedAt)
        .sort((a, b) => b.spent / b.b.monthlyLimit - a.spent / a.b.monthlyLimit),
    [budgets, totals, cats],
  )

  const due = (recurring ?? [])
    .filter((r) => r.mode === 'remind' && !r.paused)
    .map((r) => ({ r, date: nextDue(r) }))
    .filter((x): x is { r: typeof x.r; date: string } => !!x.date && x.date <= today())

  const activeGoals = (goals ?? []).filter((g) => g.status === 'active').slice(0, 3)
  const net = totals.income - totals.expense
  const backupStale =
    (txs?.length ?? 0) > 0 && (!settings?.lastBackupAt || Date.now() - settings.lastBackupAt > 30 * 86400000)

  return (
    <div className="page home">
      <header className="page-header">
        <h1 className="desktop-only">Overview</h1>
        <MonthSwitcher month={month} onChange={setMonth} />
      </header>

      <section className="summary">
        <div className="summary-card income">
          <span className="summary-label">
            <ArrowDownIcon size={16} /> Income
          </span>
          <strong>{formatMoney(totals.income, currency)}</strong>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">
            <ArrowUpIcon size={16} /> Expense
          </span>
          <strong>{formatMoney(totals.expense, currency)}</strong>
        </div>
        <div className={`summary-card net ${net < 0 ? 'negative' : ''}`}>
          <span className="summary-label">Net</span>
          <strong>{formatMoney(net, currency, { sign: true })}</strong>
        </div>
      </section>

      {due.length > 0 && (
        <section className="card">
          <h2 className="card-title">Due now</h2>
          <ul className="due-list">
            {due.map(({ r, date }) => {
              const c = cats.get(r.categoryId)
              return (
                <li key={r.id}>
                  <IconTile icon={c?.icon ?? 'tag'} color={c?.color ?? '#888'} />
                  <span className="tx-main">
                    <span className="tx-title">{r.title || r.note || c?.name}</span>
                    <span className="tx-sub">
                      {formatMoney(r.amount, currency)} · due {formatDate(date)}
                    </span>
                  </span>
                  <span className="due-actions">
                    <button className="btn small ghost" onClick={() => skipDue(r)}>Skip</button>
                    <button
                      className="btn small primary"
                      onClick={async () => {
                        await confirmDue(r)
                        toast('Added')
                      }}
                    >
                      Add
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {backupStale && (
        <section className="card notice">
          <span>
            <BackupIcon size={18} /> Your data lives only on this device.{' '}
            {settings?.lastBackupAt ? "It's been over 30 days since your last backup." : "You haven't backed up yet."}
          </span>
          <button className="btn small" onClick={() => exportJson().then(() => toast('Backup downloaded'))}>
            Back up now
          </button>
        </section>
      )}

      <div className="home-grid">
        <section className="card">
          <h2 className="card-title">Spending by category</h2>
          {pie.length === 0 ? (
            <Empty icon={Receipt} title="No expenses this month">
              <button className="btn small primary" onClick={() => openTxForm()}>Add expense</button>
            </Empty>
          ) : (
            <div className="donut-wrap">
              <div className="donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                      {pie.map((p) => (
                        <Cell key={p.id} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <small>Spent</small>
                  <strong>{formatMoney(totals.expense, currency, { compact: totals.expense >= 10000000 })}</strong>
                </div>
              </div>
              <ul className="legend">
                {pie.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <span className="dot" style={{ background: p.color }} />
                    <span className="legend-name">
                      <IconTile icon={p.icon} color={p.color} size="xs" /> {p.name}
                    </span>
                    <span className="legend-pct">{Math.round((p.value / totals.expense) * 100)}%</span>
                    <span className="legend-amt">{formatMoney(p.value, currency)}</span>
                  </li>
                ))}
                {pie.length > 6 && <li className="muted small">+{pie.length - 6} more</li>}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Budgets</h2>
            <a href="#/budgets" className="link">Manage</a>
          </div>
          {budgetRows.length === 0 ? (
            <p className="muted small">Set monthly limits per category to see how you're tracking.</p>
          ) : (
            <ul className="budget-list">
              {budgetRows.slice(0, 5).map(({ b, spent, cat }) => {
                const ratio = spent / b.monthlyLimit
                return (
                  <li key={b.id}>
                    <div className="budget-top">
                      <span className="with-icon">
                        <IconTile icon={cat!.icon} color={cat!.color} size="xs" /> {cat!.name}
                      </span>
                      <span className={ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : 'muted'}>
                        {formatMoney(spent, currency, { hideZeroDecimals: true })} / {formatMoney(b.monthlyLimit, currency, { hideZeroDecimals: true })}
                      </span>
                    </div>
                    <Progress value={spent} max={b.monthlyLimit} color={ratio >= 1 ? 'var(--expense)' : ratio >= 0.8 ? 'var(--warn)' : cat!.color} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Goals</h2>
            <a href="#/goals" className="link">See all</a>
          </div>
          {activeGoals.length === 0 ? (
            <p className="muted small">
              No active goals. <a href="#/goals" className="link">Create one</a>
            </p>
          ) : (
            <ul className="goal-mini-list">
              {activeGoals.map((g) => (
                <li key={g.id}>
                  <a href={`#/goals/${g.id}`}>
                    <div className="budget-top">
                      <span className="with-icon">
                        <IconTile icon={g.icon} color={g.color} size="xs" /> {g.name}
                      </span>
                      <span className="muted">{Math.min(100, Math.round((g.balance / g.targetAmount) * 100))}%</span>
                    </div>
                    <Progress value={g.balance} max={g.targetAmount} color={g.color} />
                    <div className="goal-mini-amounts muted small">
                      {formatMoney(g.balance, currency, { hideZeroDecimals: true })} of {formatMoney(g.targetAmount, currency, { hideZeroDecimals: true })}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Recent</h2>
            <a href="#/transactions" className="link">See all</a>
          </div>
          {txs && txs.length === 0 ? (
            <p className="muted small">No transactions this month.</p>
          ) : (
            <div className="tx-list">
              {(txs ?? []).slice(0, 5).map((t) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  category={cats.get(t.categoryId)}
                  account={t.accountId ? accounts.get(t.accountId) : undefined}
                  currency={currency}
                  showDate={formatDate(t.date)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
