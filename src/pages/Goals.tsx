import { useState } from 'react'
import { useCurrency, useGoals } from '../lib/hooks'
import { formatDate } from '../lib/dates'
import { formatMoney } from '../lib/money'
import type { GoalStatus } from '../lib/types'
import { Empty, PageHeader, Progress, Segmented } from '../components/ui'
import { GoalFormSheet } from '../components/GoalForms'
import { PlusIcon } from '../components/Icons'
import { IconTile } from '../components/brand'
import { Target } from 'lucide-react'

export function GoalsPage() {
  const currency = useCurrency()
  const goals = useGoals()
  const [status, setStatus] = useState<GoalStatus>('active')
  const [creating, setCreating] = useState(false)

  const list = (goals ?? []).filter((g) => g.status === status)
  const totalSaved = (goals ?? []).filter((g) => g.status === 'active').reduce((s, g) => s + g.balance, 0)
  const totalTarget = (goals ?? []).filter((g) => g.status === 'active').reduce((s, g) => s + g.targetAmount, 0)

  return (
    <div className="page">
      <PageHeader title="Goals">
        <button className="btn primary icon-label" onClick={() => setCreating(true)}>
          <PlusIcon size={18} /> <span>New goal</span>
        </button>
      </PageHeader>

      {totalTarget > 0 && (
        <section className="card goals-total">
          <div>
            <span className="muted small">Saved across active goals</span>
            <strong>{formatMoney(totalSaved, currency)}</strong>
          </div>
          <span className="muted">of {formatMoney(totalTarget, currency, { hideZeroDecimals: true })}</span>
        </section>
      )}

      <Segmented
        value={status}
        onChange={setStatus}
        ariaLabel="Goal status"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'achieved', label: 'Achieved' },
          { value: 'archived', label: 'Archived' },
        ]}
      />

      {goals && list.length === 0 ? (
        <Empty icon={Target} title={status === 'active' ? 'No goals yet' : `No ${status} goals`}>
          {status === 'active' && (
            <>
              <p>Save towards something — a trip, a gadget, an emergency fund.</p>
              <button className="btn small primary" onClick={() => setCreating(true)}>
                Create a goal
              </button>
            </>
          )}
        </Empty>
      ) : (
        <div className="goal-grid">
          {list.map((g) => {
            const pct = g.targetAmount > 0 ? Math.round((g.balance / g.targetAmount) * 100) : 0
            return (
              <a key={g.id} href={`#/goals/${g.id}`} className="card goal-card" style={{ ['--c' as string]: g.color }}>
                <div className="goal-card-top">
                  <IconTile icon={g.icon} color={g.color} size="md" />
                  <div className="goal-card-title">
                    <strong>{g.name}</strong>
                    <span className="muted small">
                      {[g.savingIn, g.deadline && `by ${formatDate(g.deadline)}`].filter(Boolean).join(' · ') || ' '}
                    </span>
                  </div>
                  <span className="goal-pct">{Math.min(pct, 999)}%</span>
                </div>
                <Progress value={g.balance} max={g.targetAmount} color={g.color} />
                <div className="goal-card-amounts">
                  <span>{formatMoney(g.balance, currency)}</span>
                  <span className="muted">of {formatMoney(g.targetAmount, currency, { hideZeroDecimals: true })}</span>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {creating && <GoalFormSheet onClose={() => setCreating(false)} />}
    </div>
  )
}
