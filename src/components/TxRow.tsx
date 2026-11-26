import { formatMoney } from '../lib/money'
import type { Account, Category, Transaction } from '../lib/types'
import { openTxForm } from './TxSheet'
import { RepeatIcon } from './Icons'
import { AccountLogo, IconTile, viaLabel } from './brand'

export function TxRow({
  tx,
  category,
  account,
  currency,
  showDate,
}: {
  tx: Transaction
  category?: Category
  account?: Account
  currency: string
  showDate?: string
}) {
  const source = [account?.name, viaLabel(tx.via)].filter(Boolean).join(' · ')
  const name = tx.title?.trim()
  const sub = [showDate, name ? category?.name : null, source, tx.note].filter(Boolean).join(' · ')
  return (
    <button className="tx-row" onClick={() => openTxForm({ tx })}>
      <IconTile icon={category?.icon ?? 'tag'} color={category?.color ?? '#888'} size="md" />
      <span className="tx-main">
        <span className="tx-title">
          <span className="tx-title-text">{name || category?.name || 'Unknown'}</span>
          {tx.recurringId && <RepeatIcon size={13} className="tx-badge" aria-label="Recurring" />}
        </span>
        {sub && <span className="tx-sub">{sub}</span>}
      </span>
      <span className="tx-right">
        <span className={`tx-amount ${tx.type}`}>
          {formatMoney(tx.type === 'expense' ? -tx.amount : tx.amount, currency, { sign: true })}
        </span>
        {account && <AccountLogo account={account} size="xs" />}
      </span>
    </button>
  )
}
