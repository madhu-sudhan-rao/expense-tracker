import { useMemo, useState } from 'react'
import { useCategories, useCategoryMap, useCurrency, useMonthTransactions, useAccountMap, useAccounts } from '../lib/hooks'
import { currentMonth, dayLabel } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import type { TxType } from '../lib/types'
import { Empty, Field, MonthSwitcher, PageHeader, Segmented } from '../components/ui'
import { TxRow } from '../components/TxRow'
import { openTxForm } from '../components/TxSheet'
import { FilterIcon, SearchIcon } from '../components/Icons'
import { accountLabel, VIA_OPTIONS } from '../components/brand'
import { SearchX } from 'lucide-react'

export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState<'all' | TxType>('all')
  const [q, setQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [pmId, setPmId] = useState('')
  const [viaF, setViaF] = useState('')
  const [minAmt, setMinAmt] = useState('')
  const [maxAmt, setMaxAmt] = useState('')

  const currency = useCurrency()
  const txs = useMonthTransactions(month)
  const cats = useCategoryMap()
  const accounts = useAccountMap()
  const catList = useCategories(type === 'all' ? undefined : type, true)
  const accList = useAccounts(true)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const min = parseAmount(minAmt)
    const max = parseAmount(maxAmt)
    return (txs ?? []).filter((t) => {
      if (type !== 'all' && t.type !== type) return false
      if (categoryId && t.categoryId !== categoryId) return false
      if (pmId && t.accountId !== pmId) return false
      if (viaF && t.via !== viaF) return false
      if (min !== null && t.amount < min) return false
      if (max !== null && t.amount > max) return false
      if (s) {
        const cat = cats.get(t.categoryId)?.name.toLowerCase() ?? ''
        const pm = t.accountId ? (accounts.get(t.accountId)?.name.toLowerCase() ?? '') : ''
        if (!(t.title ?? '').toLowerCase().includes(s) && !(t.note ?? '').toLowerCase().includes(s) && !cat.includes(s) && !pm.includes(s)) return false
      }
      return true
    })
  }, [txs, type, categoryId, pmId, viaF, minAmt, maxAmt, q, cats, accounts])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const t of filtered) {
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    return [...map.entries()]
  }, [filtered])

  const totals = filtered.reduce(
    (acc, t) => {
      acc[t.type] += t.amount
      return acc
    },
    { income: 0, expense: 0 },
  )
  const activeFilterCount = [categoryId, pmId, viaF, minAmt, maxAmt].filter(Boolean).length

  function clearFilters() {
    setCategoryId('')
    setPmId('')
    setViaF('')
    setMinAmt('')
    setMaxAmt('')
  }

  return (
    <div className="page">
      <PageHeader title="Transactions">
        <MonthSwitcher month={month} onChange={setMonth} />
      </PageHeader>

      <div className="toolbar">
        <div className="search-box grow">
          <SearchIcon size={18} />
          <input placeholder="Search names, notes, categories…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
        <button
          className={`btn icon-label ${showFilters || activeFilterCount ? 'active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <FilterIcon size={18} />
          <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
        </button>
      </div>

      <Segmented
        value={type}
        onChange={(v) => {
          setType(v)
          setCategoryId('')
        }}
        ariaLabel="Type"
        options={[
          { value: 'all', label: 'All' },
          { value: 'expense', label: 'Expenses', tone: 'expense' },
          { value: 'income', label: 'Income', tone: 'income' },
        ]}
      />

      {showFilters && (
        <div className="card filters">
          <div className="field-row">
            <Field label="Category">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">All categories</option>
                {(catList ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {type === 'all' ? ` (${c.type})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account">
              <select value={pmId} onChange={(e) => setPmId(e.target.value)}>
                <option value="">Any</option>
                {(accList ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                    {a.archived ? ' (removed)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Via">
              <select value={viaF} onChange={(e) => setViaF(e.target.value)}>
                <option value="">Any</option>
                {VIA_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <span />
          </div>
          <div className="field-row">
            <Field label="Min amount">
              <input inputMode="decimal" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Max amount">
              <input inputMode="decimal" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} placeholder="Any" />
            </Field>
          </div>
          {activeFilterCount > 0 && (
            <button className="btn small ghost" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="totals-strip">
        <span>
          In <strong className="income">{formatMoney(totals.income, currency)}</strong>
        </span>
        <span>
          Out <strong className="expense">{formatMoney(totals.expense, currency)}</strong>
        </span>
        <span className="muted">{filtered.length} items</span>
      </div>

      {txs && groups.length === 0 ? (
        <Empty icon={SearchX} title={txs.length === 0 ? 'No transactions this month' : 'Nothing matches your filters'}>
          {txs.length === 0 && (
            <button className="btn small primary" onClick={() => openTxForm()}>
              Add transaction
            </button>
          )}
        </Empty>
      ) : (
        groups.map(([date, list]) => {
          const dayNet = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
          return (
            <section key={date} className="day-group">
              <header className="day-header">
                <span>{dayLabel(date)}</span>
                <span className={dayNet < 0 ? 'expense' : 'income'}>{formatMoney(dayNet, currency, { sign: true })}</span>
              </header>
              <div className="tx-list card flush">
                {list.map((t) => (
                  <TxRow
                    key={t.id}
                    tx={t}
                    category={cats.get(t.categoryId)}
                    account={t.accountId ? accounts.get(t.accountId) : undefined}
                    currency={currency}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
