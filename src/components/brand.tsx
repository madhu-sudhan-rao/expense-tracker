import type { CSSProperties } from 'react'
import { Banknote, Building2, CreditCard, FileText, Globe, Wallet, type LucideIcon } from 'lucide-react'
import type { SimpleIcon } from 'simple-icons'
import { iconFor } from '../lib/icons'
import { brandFor, initialsOf, OTHER_COLOR, type Brand } from '../lib/institutions'
import type { Account, PayVia } from '../lib/types'

type Size = 'xs' | 'sm' | 'md' | 'lg'
const PX: Record<Size, number> = { xs: 22, sm: 32, md: 40, lg: 56 }

/** Category / goal icon: a colour-tinted rounded tile with a line icon. */
export function IconTile({ icon, color, size = 'md' }: { icon: string; color: string; size?: Size }) {
  const Icon = iconFor(icon)
  const px = PX[size]
  return (
    <span className="icon-tile" style={{ width: px, height: px, ['--c' as string]: color } as CSSProperties} aria-hidden="true">
      <Icon size={Math.round(px * 0.5)} strokeWidth={2} />
    </span>
  )
}

function SimpleLogo({ logo, px }: { logo: SimpleIcon; px: number }) {
  return (
    <svg viewBox="0 0 24 24" width={Math.round(px * 0.58)} height={Math.round(px * 0.58)} aria-hidden="true">
      <path d={logo.path} fill={`#${logo.hex}`} />
    </svg>
  )
}

/** Brand mark: real logo when available, otherwise an initials badge in brand colour. */
export function BrandMark({ brand, name, size = 'md' }: { brand?: Brand; name?: string; size?: Size }) {
  const px = PX[size]
  if (brand?.logo)
    return (
      <span className="brand-tile logo" style={{ width: px, height: px }} aria-hidden="true">
        <SimpleLogo logo={brand.logo} px={px} />
      </span>
    )
  const text = brand?.short ?? initialsOf(name ?? '?')
  const fs = px * (text.length <= 2 ? 0.38 : text.length === 3 ? 0.3 : text.length === 4 ? 0.25 : 0.21)
  return (
    <span
      className="brand-tile initials"
      style={{ width: px, height: px, background: brand?.color ?? OTHER_COLOR, fontSize: fs }}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

const KIND_ICON: Record<Account['kind'], LucideIcon> = { bank: Building2, card: CreditCard, wallet: Wallet, cash: Banknote }

export function AccountLogo({ account, size = 'md' }: { account?: Account; size?: Size }) {
  const px = PX[size]
  if (!account) return <span className="brand-tile empty" style={{ width: px, height: px }} />
  if (account.logo)
    return (
      <span className="brand-tile logo" style={{ width: px, height: px }} aria-hidden="true">
        <img src={account.logo} alt="" />
      </span>
    )
  if (account.kind === 'cash')
    return (
      <span className="icon-tile" style={{ width: px, height: px, ['--c' as string]: '#16a34a' } as CSSProperties} aria-hidden="true">
        <Banknote size={Math.round(px * 0.52)} strokeWidth={2} />
      </span>
    )
  const brand = brandFor(account.institution)
  if (brand || account.institutionName) return <BrandMark brand={brand} name={account.institutionName || account.name} size={size} />
  const Icon = KIND_ICON[account.kind]
  return (
    <span className="icon-tile" style={{ width: px, height: px, ['--c' as string]: OTHER_COLOR } as CSSProperties} aria-hidden="true">
      <Icon size={Math.round(px * 0.5)} strokeWidth={2} />
    </span>
  )
}

/** Small card-network mark (Visa, Mastercard, RuPay…). */
export function NetworkMark({ network }: { network?: string | null }) {
  const b = brandFor(network)
  if (!b) return null
  if (b.logo)
    return (
      <span className="network-mark" title={b.name}>
        <svg viewBox="0 0 24 24" width="22" height="14" aria-label={b.name}>
          <path d={b.logo.path} fill={`#${b.logo.hex}`} />
        </svg>
      </span>
    )
  return (
    <span className="network-mark text" style={{ color: b.color }} title={b.name}>
      {b.short}
    </span>
  )
}

export function accountLabel(a?: Account) {
  if (!a) return ''
  return a.last4 ? `${a.name} ••${a.last4}` : a.name
}

export function accountSubtitle(a: Account) {
  const b = brandFor(a.institution)
  const inst = b?.name ?? a.institutionName ?? ''
  if (a.kind === 'bank') return [inst, a.subtype === 'current' ? 'Current account' : 'Savings account'].filter(Boolean).join(' · ')
  if (a.kind === 'card') return [inst, brandFor(a.network)?.name, 'Credit card'].filter(Boolean).join(' · ')
  if (a.kind === 'wallet') return [inst, 'Wallet'].filter(Boolean).join(' · ')
  return 'Cash in hand'
}

// ---------- "Via" (how a bank account or card was used) ----------

/** UPI-style mark: two chevrons (saffron + green) and the wordmark. */
export function UpiMark({ height = 16 }: { height?: number }) {
  return (
    <svg viewBox="0 0 46 20" height={height} aria-label="UPI" role="img">
      <path d="M3 2 9 10 3 18h4l6-8-6-8z" fill="#F7931E" />
      <path d="M9 2l6 8-6 8h4l6-8-6-8z" fill="#097A44" />
      <text x="21" y="15.2" fontFamily="system-ui, sans-serif" fontWeight="800" fontStyle="italic" fontSize="13" fill="currentColor">
        UPI
      </text>
    </svg>
  )
}

export const VIA_OPTIONS: { value: PayVia; label: string; Icon?: LucideIcon }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'swipe', label: 'Swipe', Icon: CreditCard },
  { value: 'netbanking', label: 'Net banking', Icon: Globe },
  { value: 'cheque', label: 'Cheque', Icon: FileText },
]

export const viaLabel = (v?: PayVia | null) =>
  VIA_OPTIONS.find((o) => o.value === v)?.label ?? ((v as string) === 'debit_card' ? 'Swipe' : '')

/** Bank accounts and cards are used "via" something; cash and wallets aren't. */
export const usesVia = (a?: Account) => a?.kind === 'bank' || a?.kind === 'card'

export function viaOptionsFor(a?: Account) {
  if (a?.kind === 'card') return VIA_OPTIONS.filter((o) => o.value === 'upi' || o.value === 'swipe')
  return VIA_OPTIONS
}

/** Keep a via only if it fits the account; UPI is the default for banks and cards. */
export function fitVia(a: Account | undefined, v: PayVia | null | undefined): PayVia | null {
  if (!usesVia(a)) return null
  return v && viaOptionsFor(a).some((o) => o.value === v) ? v : null
}
