import type { ReactNode } from 'react'
import { useRoute } from '../lib/hooks'
import { openTxForm } from './TxSheet'
import {
  HomeIcon,
  ListIcon,
  MoreIcon,
  PlusIcon,
  RepeatIcon,
  SettingsIcon,
  TargetIcon,
  BudgetIcon,
  BankIcon,
} from './Icons'

const MOBILE_NAV = [
  { path: '/', label: 'Home', Icon: HomeIcon },
  { path: '/transactions', label: 'Transactions', Icon: ListIcon },
  { path: '/goals', label: 'Goals', Icon: TargetIcon },
  { path: '/more', label: 'More', Icon: MoreIcon },
]

const DESKTOP_NAV = [
  { path: '/', label: 'Home', Icon: HomeIcon },
  { path: '/transactions', label: 'Transactions', Icon: ListIcon },
  { path: '/goals', label: 'Goals', Icon: TargetIcon },
  { path: '/budgets', label: 'Budgets', Icon: BudgetIcon },
  { path: '/recurring', label: 'Recurring', Icon: RepeatIcon },
  { path: '/accounts', label: 'Accounts', Icon: BankIcon },
  { path: '/more', label: 'Settings', Icon: SettingsIcon },
]

const MORE_CHILDREN = ['/budgets', '/recurring', '/categories', '/accounts', '/more']

function isActive(route: string, path: string, mobile: boolean) {
  if (path === '/') return route === '/'
  if (mobile && path === '/more') return MORE_CHILDREN.some((p) => route.startsWith(p))
  if (!mobile && path === '/more') return ['/more', '/categories'].some((p) => route.startsWith(p))
  return route.startsWith(path)
}

export function Layout({ children }: { children: ReactNode }) {
  const route = useRoute()
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/icon-192.png" alt="" width={28} height={28} />
          <span>Finance</span>
        </div>
        <button className="btn primary block add-btn" onClick={() => openTxForm()}>
          <PlusIcon size={20} /> Add transaction
        </button>
        <nav aria-label="Main">
          {DESKTOP_NAV.map(({ path, label, Icon }) => (
            <a key={path} href={`#${path}`} className={isActive(route, path, false) ? 'active' : ''}>
              <Icon /> {label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="content">{children}</main>

      <button className="fab" onClick={() => openTxForm()} aria-label="Add transaction">
        <PlusIcon size={28} />
      </button>

      <nav className="bottom-nav" aria-label="Main">
        {MOBILE_NAV.map(({ path, label, Icon }) => (
          <a key={path} href={`#${path}`} className={isActive(route, path, true) ? 'active' : ''}>
            <Icon />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
