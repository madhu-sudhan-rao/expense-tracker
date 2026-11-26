import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useCurrency, useGoalEntries } from '../lib/hooks'
import { formatDate, monthsUntil, today } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { deleteGoal, goalBalance, updateGoal } from '../lib/ops'
import type { GoalEntry, GoalEntryType } from '../lib/types'
import { Empty, Progress } from '../components/ui'
import { GoalEntrySheet, GoalFormSheet } from '../components/GoalForms'
import { ArrowDownIcon, ArrowUpIcon, ChevronLeft, EditIcon, TrashIcon } from '../components/Icons'
import { toast } from '../components/Toast'
import { IconTile } from '../components/brand'
import { SearchX } from 'lucide-react'

export function GoalDetailPage({ id }: { id: string }) {
  const currency = useCurrency()
  const goal = useLiveQuery(() => db.goals.get(id), [id])
  const entries = useGoalEntries(id)
  const [editing, setEditing] = useState(false)
  const [entrySheet, setEntrySheet] = useState<{ type: GoalEntryType; entry?: GoalEntry } | null>(null)

  const history = useMemo(() => {
    let running = 0
    const rows = (entries ?? []).map((e) => {
      running += e.type === 'deposit' ? e.amount : -e.amount
      return { e, running }
    })
    return rows.reverse()
  }, [entries])

  if (goal === undefined) return null
  if (!goal || goal.deletedAt)
    return (
      <div className="page">
        <Empty icon={SearchX} title="Goal not found">
          <a className="btn small" href="#/goals">Back to goals</a>
        </Empty>
      </div>
    )

  const balance = goalBalance(entries ?? [])
  const remaining = Math.max(0, goal.targetAmount - balance)
  const deposited = (entries ?? []).filter((e) => e.type === 'deposit').reduce((s, e) => s + e.amount, 0)
  const withdrawn = (entries ?? []).filter((e) => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0)
  const pct = goal.targetAmount > 0 ? Math.round((balance / goal.targetAmount) * 100) : 0
  const months = goal.deadline ? monthsUntil(today(), goal.deadline) : null
  const perMonth = months && months > 0 ? Math.ceil(remaining / months) : null
  const overdue = goal.deadline && goal.deadline < today() && remaining > 0

  async function remove() {
    const n = entries?.length ?? 0
    const msg =
      n > 0
        ? `Delete "${goal!.name}"? This also deletes its ${n} history entr${n === 1 ? 'y' : 'ies'} and the linked transactions. To keep the history, archive it instead.`
        : `Delete "${goal!.name}"?`
    if (!confirm(msg)) return
    await deleteGoal(goal!.id)
    location.hash = '/goals'
    toast('Goal deleted')
  }

  return (
    <div className="page goal-detail" style={{ ['--c' as string]: goal.color }}>
      <header className="page-header">
        <a href="#/goals" className="back-link">
          <ChevronLeft size={20} /> Goals
        </a>
        <div className="page-header-actions">
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit goal">
            <EditIcon />
          </button>
          <button className="icon-btn danger" onClick={remove} aria-label="Delete goal">
            <TrashIcon />
          </button>
        </div>
      </header>

      <section className="card goal-hero">
        <div className="goal-hero-top">
          <IconTile icon={goal.icon} color={goal.color} size="lg" />
          <div>
            <h1>{goal.name}</h1>
            <span className="muted small">
              {[goal.savingIn && `Saving in ${goal.savingIn}`, goal.status !== 'active' && goal.status].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
        <div className="goal-hero-amount">
          <strong>{formatMoney(balance, currency)}</strong>
          <span className="muted">of {formatMoney(goal.targetAmount, currency)}</span>
        </div>
        <Progress value={balance} max={goal.targetAmount} color={goal.color} />
        <div className="goal-hero-pct muted small">
          <span>{pct}% saved</span>
          <span>{remaining > 0 ? `${formatMoney(remaining, currency)} to go` : 'Target reached!'}</span>
        </div>

        <div className="stat-grid">
          <div>
            <span className="muted small">Total added</span>
            <strong>{formatMoney(deposited, currency)}</strong>
          </div>
          <div>
            <span className="muted small">Total taken back</span>
            <strong>{formatMoney(withdrawn, currency)}</strong>
          </div>
          {goal.deadline && (
            <div>
              <span className="muted small">Target date</span>
              <strong className={overdue ? 'expense' : ''}>{formatDate(goal.deadline, 'long')}</strong>
            </div>
          )}
          {perMonth !== null && remaining > 0 && (
            <div>
              <span className="muted small">Needed per month</span>
              <strong>{formatMoney(perMonth, currency)}</strong>
            </div>
          )}
        </div>

        {goal.status === 'active' ? (
          <div className="goal-actions">
            <button className="btn primary" onClick={() => setEntrySheet({ type: 'deposit' })}>
              <ArrowDownIcon size={18} /> Add money
            </button>
            <button className="btn" onClick={() => setEntrySheet({ type: 'withdrawal' })} disabled={balance <= 0}>
              <ArrowUpIcon size={18} /> Take back
            </button>
          </div>
        ) : null}

        <div className="goal-status-actions">
          {goal.status === 'active' && remaining === 0 && (
            <button className="btn small" onClick={() => updateGoal(goal.id, { status: 'achieved' }).then(() => toast('Marked as achieved'))}>
              Mark as achieved
            </button>
          )}
          {goal.status === 'active' && (
            <button className="btn small ghost" onClick={() => updateGoal(goal.id, { status: 'archived' }).then(() => toast('Goal archived'))}>
              Archive
            </button>
          )}
          {goal.status !== 'active' && (
            <button className="btn small" onClick={() => updateGoal(goal.id, { status: 'active' }).then(() => toast('Goal reactivated'))}>
              Make active again
            </button>
          )}
        </div>
      </section>

      <section className="card flush">
        <h2 className="card-title pad">History</h2>
        {history.length === 0 ? (
          <p className="muted small pad">No money added yet.</p>
        ) : (
          <ul className="history">
            {history.map(({ e, running }) => (
              <li key={e.id}>
                <button onClick={() => setEntrySheet({ type: e.type, entry: e })}>
                  <span className={`history-icon ${e.type}`}>{e.type === 'deposit' ? <ArrowDownIcon size={16} /> : <ArrowUpIcon size={16} />}</span>
                  <span className="tx-main">
                    <span className="tx-title">{e.type === 'deposit' ? 'Added' : 'Taken back'}</span>
                    <span className="tx-sub">{[formatDate(e.date), e.note].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="history-amounts">
                    <span className={e.type === 'deposit' ? 'income' : 'expense'}>
                      {e.type === 'deposit' ? '+' : '−'}
                      {formatMoney(e.amount, currency)}
                    </span>
                    <small className="muted">Bal {formatMoney(running, currency)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <GoalFormSheet goal={goal} onClose={() => setEditing(false)} />}
      {entrySheet && (
        <GoalEntrySheet
          goal={goal}
          balance={balance}
          type={entrySheet.type}
          entry={entrySheet.entry}
          onClose={() => setEntrySheet(null)}
        />
      )}
    </div>
  )
}
