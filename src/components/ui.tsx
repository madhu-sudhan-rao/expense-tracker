import { useEffect, useRef, type ReactNode } from 'react'
import { currentMonth, formatMonth, shiftMonth, type MonthKey } from '../lib/dates'
import { currencySymbol } from '../lib/money'
import type { LucideIcon } from 'lucide-react'
import type { Category } from '../lib/types'
import { ICON_KEYS, ICONS } from '../lib/icons'
import { IconTile } from './brand'
import { ChevronLeft, ChevronRight } from './Icons'

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  const isCurrent = month === currentMonth()
  return (
    <div className="month-switcher">
      <button className="icon-btn" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <ChevronLeft />
      </button>
      <button className="month-label" onClick={() => onChange(currentMonth())} title="Go to current month">
        {formatMonth(month)}
      </button>
      <button
        className="icon-btn"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Next month"
        disabled={isCurrent}
      >
        <ChevronRight />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: ReactNode; tone?: 'expense' | 'income' }[]
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`${value === o.value ? 'active' : ''} ${o.tone ?? ''}`}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function AmountField({
  value,
  onChange,
  currency,
  autoFocus,
  tone,
  label = 'Amount',
}: {
  value: string
  onChange: (v: string) => void
  currency: string
  autoFocus?: boolean
  tone?: 'expense' | 'income'
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 50)
  }, [autoFocus])
  return (
    <label className={`amount-field ${tone ?? ''}`}>
      <span className="sr-only">{label}</span>
      <span className="amount-symbol">{currencySymbol(currency)}</span>
      <input
        ref={ref}
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        enterKeyHint="done"
        autoComplete="off"
      />
    </label>
  )
}

export function CategoryGrid({
  categories,
  value,
  onChange,
}: {
  categories: Category[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="cat-grid" role="radiogroup" aria-label="Category">
      {categories.map((c) => (
        <button
          type="button"
          key={c.id}
          role="radio"
          aria-checked={value === c.id}
          className={`cat-chip ${value === c.id ? 'active' : ''}`}
          style={{ ['--c' as string]: c.color }}
          onClick={() => onChange(c.id)}
        >
          <IconTile icon={c.icon} color={c.color} size="sm" />
          <span className="cat-name">{c.name}</span>
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, max, color, warn }: { value: number; max: number; color?: string; warn?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`progress ${warn ? 'warn' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  )
}

export const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#16a34a', '#10b981', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c',
]

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Colour">
      {PALETTE.map((c) => (
        <button
          type="button"
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          className={value === c ? 'active' : ''}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (key: string) => void; color: string }) {
  return (
    <div className="icon-picker" role="radiogroup" aria-label="Icon" style={{ ['--c' as string]: color }}>
      {ICON_KEYS.map((key) => {
        const Icon = ICONS[key]
        return (
          <button
            type="button"
            key={key}
            role="radio"
            aria-checked={value === key}
            aria-label={key.replace(/-/g, ' ')}
            className={value === key ? 'active' : ''}
            onClick={() => onChange(key)}
          >
            <Icon size={20} strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}
