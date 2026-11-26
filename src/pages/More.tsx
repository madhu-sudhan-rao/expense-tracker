import { useRef, useState } from 'react'
import { useSettings } from '../lib/hooks'
import { allCurrencies } from '../lib/money'
import { setSetting } from '../lib/ops'
import { exportCsv, exportJson, importJson, resetAll } from '../lib/backup'
import type { Theme } from '../lib/types'
import { PageHeader, Segmented } from '../components/ui'
import { Sheet } from '../components/Sheet'
import { CurrencyPicker } from '../components/CurrencyPicker'
import { AlertIcon, BankIcon, ThemeIcon, ChevronRight, DownloadIcon, RepeatIcon, TagIcon, UploadIcon, BudgetIcon } from '../components/Icons'
import { toast } from '../components/Toast'

export function MorePage() {
  const settings = useSettings()
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const [importText, setImportText] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!settings) return null
  const cur = allCurrencies().find((c) => c.code === settings.currency)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setImportText(await f.text())
  }

  async function runImport(mode: 'merge' | 'replace') {
    if (!importText) return
    if (mode === 'replace' && !confirm('Replace ALL data on this device with the backup? This cannot be undone.')) return
    try {
      const r = await importJson(importText, mode)
      toast(`Imported: ${r.added} added, ${r.updated} updated`)
      setImportText(null)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="page">
      <PageHeader title="More" />

      <section className="card flush mobile-only">
        <ul className="menu">
          <li>
            <a href="#/budgets"><BudgetIcon /> <span>Budgets</span> <ChevronRight size={18} /></a>
          </li>
          <li>
            <a href="#/recurring"><RepeatIcon /> <span>Recurring</span> <ChevronRight size={18} /></a>
          </li>
        </ul>
      </section>

      <h2 className="section-label">Settings</h2>
      <section className="card flush">
        <ul className="menu">
          <li>
            <button onClick={() => setPickingCurrency(true)}>
              <span className="menu-emoji">{cur?.symbol ?? '¤'}</span>
              <span>Currency</span>
              <span className="muted small">{cur ? `${cur.name} (${cur.code})` : settings.currency}</span>
              <ChevronRight size={18} />
            </button>
          </li>
          <li>
            <a href="#/categories"><TagIcon /> <span>Categories</span> <ChevronRight size={18} /></a>
          </li>
          <li>
            <a href="#/accounts"><BankIcon /> <span>Accounts & cards</span> <ChevronRight size={18} /></a>
          </li>
          <li className="menu-static">
            <ThemeIcon />
            <span>Theme</span>
            <Segmented<Theme>
              value={settings.theme}
              onChange={(t) => setSetting('theme', t)}
              ariaLabel="Theme"
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </li>
        </ul>
      </section>

      <h2 className="section-label">Backup</h2>
      <section className="card flush">
        <ul className="menu">
          <li>
            <button onClick={() => exportJson().then(() => toast('Backup downloaded'))}>
              <DownloadIcon /> <span>Export backup (JSON)</span>
              <span className="muted small">
                {settings.lastBackupAt ? `Last: ${new Date(settings.lastBackupAt).toLocaleDateString()}` : 'Never'}
              </span>
            </button>
          </li>
          <li>
            <button onClick={() => fileRef.current?.click()}>
              <UploadIcon /> <span>Import backup</span>
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          </li>
          <li>
            <button onClick={() => exportCsv().then(() => toast('CSV downloaded'))}>
              <DownloadIcon /> <span>Export transactions (CSV)</span>
            </button>
          </li>
        </ul>
      </section>
      <p className="muted small pad">
        Your data is stored only in this browser on this device. Export a backup regularly, and use Import to move data
        between your phone and computer.
      </p>

      <h2 className="section-label">Danger zone</h2>
      <section className="card flush">
        <ul className="menu">
          <li>
            <button
              className="danger"
              onClick={() => {
                if (confirm('Delete ALL data on this device? Export a backup first if you might need it.') && confirm('Are you sure? This cannot be undone.'))
                  resetAll()
              }}
            >
              <AlertIcon /> <span>Erase all data</span>
            </button>
          </li>
        </ul>
      </section>

      <Sheet open={pickingCurrency} onClose={() => setPickingCurrency(false)} title="Currency">
        <p className="muted small">Changes only how amounts are shown — amounts aren't converted.</p>
        <CurrencyPicker
          value={settings.currency}
          onSelect={(c) => {
            setSetting('currency', c)
            setPickingCurrency(false)
            toast('Currency updated')
          }}
        />
      </Sheet>

      <Sheet open={importText !== null} onClose={() => setImportText(null)} title="Import backup">
        <p>How should the backup be imported?</p>
        <div className="stack">
          <button className="btn block" onClick={() => runImport('merge')}>
            <strong>Merge</strong>
            <span className="muted small">Add new items, update changed ones, keep everything else</span>
          </button>
          <button className="btn block danger" onClick={() => runImport('replace')}>
            <strong>Replace</strong>
            <span className="muted small">Erase this device's data and use the backup</span>
          </button>
        </div>
      </Sheet>
    </div>
  )
}
