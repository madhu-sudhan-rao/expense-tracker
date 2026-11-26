import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAccounts } from '../lib/hooks'
import type { Account, PayVia } from '../lib/types'
import { AccountLogo, UpiMark, viaOptionsFor } from './brand'
import { AccountSheet } from './AccountSheet'

/** Pick where money came from / went to. Archived accounts are hidden unless already selected. */
export function AccountPicker({
  value,
  onChange,
  label = 'Paid from',
  current,
}: {
  value: string | null
  onChange: (id: string | null) => void
  label?: string
  /** The account currently on the record (shown even if archived). */
  current?: Account
}) {
  const accounts = useAccounts()
  const [adding, setAdding] = useState(false)
  const list = [...(accounts ?? [])]
  if (current && current.archived && !list.some((a) => a.id === current.id)) list.unshift(current)

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chip-row" role="radiogroup" aria-label={label}>
        {list.map((a) => (
          <button
            type="button"
            key={a.id}
            role="radio"
            aria-checked={value === a.id}
            className={`chip account-chip ${value === a.id ? 'active' : ''}`}
            onClick={() => onChange(value === a.id ? null : a.id)}
          >
            <AccountLogo account={a} size="xs" />
            <span className="account-chip-text">
              {a.name}
              {a.last4 && <small>••{a.last4}</small>}
            </span>
          </button>
        ))}
        <button type="button" className="chip add-chip" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add
        </button>
      </div>
      {adding && <AccountSheet onClose={() => setAdding(false)} onSaved={(id) => onChange(id)} />}
    </div>
  )
}

export function ViaPicker({
  account,
  value,
  onChange,
}: {
  account?: Account
  value: PayVia | null
  onChange: (v: PayVia | null) => void
}) {
  return (
    <div className="field">
      <span className="field-label">Via</span>
      <div className="chip-row" role="radiogroup" aria-label="Paid via">
        {viaOptionsFor(account).map(({ value: v, label, Icon }) => (
          <button
            type="button"
            key={v}
            role="radio"
            aria-checked={value === v}
            aria-label={label}
            className={`chip ${value === v ? 'active' : ''}`}
            onClick={() => onChange(value === v ? null : v)}
          >
            {v === 'upi' ? <UpiMark height={18} /> : Icon && <><Icon size={16} /> {label}</>}
          </button>
        ))}
      </div>
    </div>
  )
}
