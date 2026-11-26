import { useMemo, useState } from 'react'
import { allCurrencies, isPopularCurrency } from '../lib/money'
import { CheckIcon, SearchIcon } from './Icons'

export function CurrencyPicker({ value, onSelect }: { value: string | null; onSelect: (code: string) => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const all = allCurrencies()
    const s = q.trim().toLowerCase()
    if (!s) return all
    return all.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.symbol.includes(s))
  }, [q])
  const popular = !q ? list.filter((c) => isPopularCurrency(c.code)) : []
  const rest = !q ? list.filter((c) => !isPopularCurrency(c.code)) : list

  const row = (c: (typeof list)[number]) => (
    <li key={c.code}>
      <button type="button" className={`currency-row ${value === c.code ? 'active' : ''}`} onClick={() => onSelect(c.code)}>
        <span className="currency-symbol">{c.symbol}</span>
        <span className="currency-name">
          {c.name}
          <small>{c.code}</small>
        </span>
        {value === c.code && <CheckIcon size={18} />}
      </button>
    </li>
  )

  return (
    <div className="currency-picker">
      <div className="search-box">
        <SearchIcon size={18} />
        <input placeholder="Search currency (e.g. rupee, USD)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="currency-list">
        {popular.length > 0 && <li className="list-label">Popular</li>}
        {popular.map(row)}
        {popular.length > 0 && <li className="list-label">All currencies</li>}
        {rest.map(row)}
        {list.length === 0 && <li className="muted pad">No match</li>}
      </ul>
    </div>
  )
}
