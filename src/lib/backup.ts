import { alive, db, stamp, SYNC_TABLES, type SyncTable } from './db'
import { EMOJI_TO_ICON } from './icons'
import { SCALE } from './money'
import { setSetting } from './ops'
import { today } from './dates'
import { CASH_ACCOUNT_ID, type Account, type PayVia, type SyncFields } from './types'

const VIA_LABEL: Record<PayVia, string> = { upi: 'UPI', swipe: 'Swipe', netbanking: 'Net banking', cheque: 'Cheque' }

const APP_ID = 'finance-tracker'
const BACKUP_VERSION = 2

interface BackupFile {
  app: string
  version: number
  exportedAt: string
  settings: Record<string, unknown>
  data: Record<SyncTable, SyncFields[]>
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportJson() {
  const data = {} as BackupFile['data']
  for (const t of SYNC_TABLES) data[t] = (await db.table(t).toArray()) as SyncFields[]
  const settings: Record<string, unknown> = {}
  for (const row of await db.meta.toArray()) if (row.key !== 'lastBackupAt') settings[row.key] = row.value
  const file: BackupFile = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    data,
  }
  download(`finance-backup-${today()}.json`, JSON.stringify(file), 'application/json')
  await setSetting('lastBackupAt', Date.now())
}

export interface ImportResult {
  added: number
  updated: number
}

export async function importJson(text: string, mode: 'merge' | 'replace'): Promise<ImportResult> {
  let file: BackupFile
  try {
    file = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (file?.app !== APP_ID || typeof file.data !== 'object') throw new Error('This is not a backup from this app.')
  if (file.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app.')
  if (file.version < 2) upgradeV1(file)
  normalizeVia(file)

  let added = 0
  let updated = 0
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.meta], async () => {
    if (mode === 'replace') {
      for (const t of SYNC_TABLES) await db.table(t).clear()
    }
    for (const t of SYNC_TABLES) {
      const rows = file.data[t] ?? []
      const table = db.table<SyncFields, string>(t)
      for (const row of rows) {
        if (!row?.id) continue
        const existing = mode === 'merge' ? await table.get(row.id) : undefined
        if (!existing) {
          await table.add(row)
          added++
        } else if ((row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          await table.put(row)
          updated++
        }
      }
    }
    if (!(await db.accounts.get(CASH_ACCOUNT_ID))) {
      await db.accounts.add(stamp({ kind: 'cash', name: 'Cash', institution: 'cash', order: 0, archived: false }, CASH_ACCOUNT_ID) as Account)
    }
    if (mode === 'replace' || !(await db.meta.get('currency'))?.value) {
      for (const [key, value] of Object.entries(file.settings ?? {})) await db.meta.put({ key, value })
    }
  })
  return { added, updated }
}

/** Older backups may use the removed "debit_card" via. */
function normalizeVia(file: BackupFile) {
  const data = file.data as unknown as Record<string, Record<string, unknown>[]>
  for (const r of [...(data.transactions ?? []), ...(data.recurring ?? [])]) if (r.via === 'debit_card') r.via = 'swipe'
}

/** v1 backups used emoji icons and payment methods instead of accounts. */
function upgradeV1(file: BackupFile) {
  const data = file.data as unknown as Record<string, Record<string, unknown>[]>
  const fixIcon = (r: Record<string, unknown>) => {
    if (typeof r.icon === 'string') r.icon = EMOJI_TO_ICON[r.icon] ?? 'tag'
  }
  data.categories?.forEach(fixIcon)
  data.goals?.forEach(fixIcon)
  const methods = new Map((data.paymentMethods ?? []).map((m) => [m.id as string, String(m.name).toLowerCase()]))
  const via: Record<string, PayVia> = { upi: 'upi', 'debit card': 'swipe', 'bank transfer': 'netbanking' }
  for (const t of [...(data.transactions ?? []), ...(data.recurring ?? [])]) {
    const name = methods.get(t.paymentMethodId as string)
    t.accountId = name === 'cash' ? CASH_ACCOUNT_ID : null
    t.via = (name && via[name]) || null
  }
  file.settings = { ...file.settings, onboarded: true }
}

function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCsv() {
  const [txs, cats, accounts, entries, goals] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
    db.goalEntries.toArray(),
    db.goals.toArray(),
  ])
  const catName = new Map(cats.map((c) => [c.id, c.name]))
  const accName = new Map(accounts.map((a) => [a.id, a.last4 ? `${a.name} ••${a.last4}` : a.name]))
  const goalName = new Map(goals.map((g) => [g.id, g.name]))
  const entryGoal = new Map(entries.map((e) => [e.id, goalName.get(e.goalId) ?? '']))

  const rows = txs
    .filter(alive)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((t) => [
      t.date,
      t.type,
      catName.get(t.categoryId) ?? '',
      (t.amount / SCALE).toFixed(2),
      t.accountId ? (accName.get(t.accountId) ?? '') : '',
      t.title ?? '',
      t.via ? (VIA_LABEL[t.via] ?? '') : '',
      t.note ?? '',
      t.goalEntryId ? (entryGoal.get(t.goalEntryId) ?? '') : '',
    ])
  const header = ['Date', 'Type', 'Category', 'Amount', 'Account', 'Name', 'Via', 'Note', 'Goal']
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  download(`transactions-${today()}.csv`, '﻿' + csv, 'text/csv')
}

export async function resetAll() {
  await db.delete()
  location.reload()
}
