import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { Toaster, toast } from './components/Toast'
import { TxSheetHost } from './components/TxSheet'
import { CurrencyPicker } from './components/CurrencyPicker'
import { useRoute, useSettings } from './lib/hooks'
import { processRecurring, setSetting } from './lib/ops'
import { HomePage } from './pages/Home'
import { TransactionsPage } from './pages/Transactions'
import { GoalsPage } from './pages/Goals'
import { GoalDetailPage } from './pages/GoalDetail'
import { BudgetsPage } from './pages/Budgets'
import { RecurringPage } from './pages/Recurring'
import { MorePage } from './pages/More'
import { CategoriesPage } from './pages/Categories'
import { AccountsList, AccountsPage } from './pages/Accounts'

function useTheme(theme: string | undefined) {
  useEffect(() => {
    const root = document.documentElement
    if (!theme || theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
}

function useRecurringProcessor(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const run = () =>
      processRecurring().then((n) => {
        if (n > 0) toast(`${n} recurring transaction${n > 1 ? 's' : ''} added`)
      })
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled])
}

function Router() {
  const route = useRoute()
  useEffect(() => {
    document.querySelector('.content')?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [route])

  const goal = route.match(/^\/goals\/([^/]+)/)
  if (goal) return <GoalDetailPage id={decodeURIComponent(goal[1])} />
  switch (route) {
    case '/transactions':
      return <TransactionsPage />
    case '/goals':
      return <GoalsPage />
    case '/budgets':
      return <BudgetsPage />
    case '/recurring':
      return <RecurringPage />
    case '/more':
      return <MorePage />
    case '/categories':
      return <CategoriesPage />
    case '/accounts':
      return <AccountsPage />
    default:
      return <HomePage />
  }
}

function Welcome() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="welcome">
      <div className="welcome-card">
        <img className="welcome-logo" src="/icon-192.png" alt="" width={64} height={64} />
        <span className="muted small">Step 1 of 2</span>
        <h1>Welcome</h1>
        <p className="muted">Track expenses, income and savings goals. Everything stays on this device.</p>
        <h2>Choose your currency</h2>
        <CurrencyPicker value={picked} onSelect={setPicked} />
        <button className="btn primary block" disabled={!picked} onClick={() => picked && setSetting('currency', picked)}>
          Continue
        </button>
        <p className="muted small">You can change this later in Settings.</p>
      </div>
    </div>
  )
}

function OnboardAccounts() {
  return (
    <div className="welcome">
      <div className="welcome-card wide">
        <span className="muted small">Step 2 of 2</span>
        <h1>Your accounts & cards</h1>
        <p className="muted">
          Add the bank accounts, credit cards and wallets you spend from. You'll pick one as the source for each entry.
        </p>
        <div className="onboard-list">
          <AccountsList showArchived={false} />
        </div>
        <button className="btn primary block" onClick={() => setSetting('onboarded', true)}>
          Done
        </button>
        <p className="muted small">You can add or remove accounts anytime from More → Accounts & cards.</p>
      </div>
    </div>
  )
}

export default function App() {
  const settings = useSettings()
  useTheme(settings?.theme)
  useRecurringProcessor(!!settings?.currency)

  if (!settings) return null
  if (!settings.currency) return <Welcome />
  if (!settings.onboarded)
    return (
      <>
        <OnboardAccounts />
        <Toaster />
      </>
    )

  return (
    <>
      <Layout>
        <Router />
      </Layout>
      <TxSheetHost />
      <Toaster />
    </>
  )
}
