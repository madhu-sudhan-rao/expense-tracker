import { useState } from 'react'
import { Building2, CreditCard, Wallet } from 'lucide-react'
import { useAccounts } from '../lib/hooks'
import type { Account, AccountKind } from '../lib/types'
import { AccountLogo, accountSubtitle, NetworkMark } from '../components/brand'
import { AccountSheet } from '../components/AccountSheet'
import { ChevronLeft, ChevronRight } from '../components/Icons'

const GROUPS: { kind: AccountKind; title: string }[] = [
  { kind: 'bank', title: 'Bank accounts' },
  { kind: 'card', title: 'Credit cards' },
  { kind: 'wallet', title: 'Wallets' },
  { kind: 'cash', title: 'Cash' },
]

export function AccountRow({ a, onClick }: { a: Account; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className={a.archived ? 'dim' : ''}>
        <AccountLogo account={a} size="md" />
        <span className="account-row-main">
          <span className="account-row-name">
            {a.name}
            {a.last4 && <span className="muted"> ••{a.last4}</span>}
          </span>
          <span className="muted small">{accountSubtitle(a)}</span>
        </span>
        {a.kind === 'card' && <NetworkMark network={a.network} />}
        <ChevronRight size={18} />
      </button>
    </li>
  )
}

export function AddAccountButtons({ onAdd }: { onAdd: (k: 'bank' | 'card' | 'wallet') => void }) {
  return (
    <div className="add-account-grid">
      <button className="btn" onClick={() => onAdd('bank')}>
        <Building2 size={18} /> Bank account
      </button>
      <button className="btn" onClick={() => onAdd('card')}>
        <CreditCard size={18} /> Credit card
      </button>
      <button className="btn" onClick={() => onAdd('wallet')}>
        <Wallet size={18} /> Wallet
      </button>
    </div>
  )
}

export function AccountsList({ showArchived }: { showArchived: boolean }) {
  const accounts = useAccounts(true)
  const [editing, setEditing] = useState<Account | null>(null)
  const [adding, setAdding] = useState<'bank' | 'card' | 'wallet' | null>(null)
  const active = (accounts ?? []).filter((a) => !a.archived)
  const archived = (accounts ?? []).filter((a) => a.archived)

  return (
    <>
      {GROUPS.map(({ kind, title }) => {
        const list = active.filter((a) => a.kind === kind)
        if (list.length === 0) return null
        return (
          <section key={kind} className="account-group">
            <h2 className="section-label">{title}</h2>
            <div className="card flush">
              <ul className="menu account-menu">
                {list.map((a) => (
                  <AccountRow key={a.id} a={a} onClick={() => setEditing(a)} />
                ))}
              </ul>
            </div>
          </section>
        )
      })}

      <h2 className="section-label">Add</h2>
      <AddAccountButtons onAdd={setAdding} />

      {showArchived && archived.length > 0 && (
        <section className="account-group">
          <h2 className="section-label">Removed</h2>
          <div className="card flush">
            <ul className="menu account-menu">
              {archived.map((a) => (
                <AccountRow key={a.id} a={a} onClick={() => setEditing(a)} />
              ))}
            </ul>
          </div>
          <p className="muted small pad">Removed accounts still show on past entries. Open one to restore it.</p>
        </section>
      )}

      {editing && <AccountSheet account={editing} onClose={() => setEditing(null)} />}
      {adding && <AccountSheet initialKind={adding} onClose={() => setAdding(null)} />}
    </>
  )
}

export function AccountsPage() {
  return (
    <div className="page narrow">
      <header className="page-header">
        <a href="#/more" className="back-link mobile-only">
          <ChevronLeft size={20} /> More
        </a>
      </header>
      <h1 className="page-title">Accounts & cards</h1>
      <p className="muted small">Pick these as the source when you add an expense or income.</p>
      <AccountsList showArchived />
    </div>
  )
}
