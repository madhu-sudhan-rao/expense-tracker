import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { BANKS, brandFor, NETWORKS, WALLETS } from '../lib/institutions'
import { saveAccount, setAccountArchived } from '../lib/ops'
import type { Account, AccountKind } from '../lib/types'
import { Sheet } from './Sheet'
import { Field, Segmented } from './ui'
import { AccountLogo, BrandMark, NetworkMark } from './brand'
import { toast } from './Toast'

type EditableKind = Exclude<AccountKind, 'cash'>

const KIND_LABEL: Record<EditableKind, string> = { bank: 'Bank account', card: 'Credit card', wallet: 'Wallet' }

async function resizeImage(file: File, size = 96): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const scale = Math.min(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function AccountSheet({
  account,
  initialKind = 'bank',
  onClose,
  onSaved,
}: {
  account?: Account
  initialKind?: EditableKind
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const isCash = account?.kind === 'cash'
  const [kind, setKind] = useState<EditableKind>(account && account.kind !== 'cash' ? account.kind : initialKind)
  const [institution, setInstitution] = useState(account?.institution ?? '')
  const [institutionName, setInstitutionName] = useState(account?.institutionName ?? '')
  const [name, setName] = useState(account?.name ?? '')
  const [nameTouched, setNameTouched] = useState(!!account)
  const [last4, setLast4] = useState(account?.last4 ?? '')
  const [subtype, setSubtype] = useState<'savings' | 'current'>(account?.subtype ?? 'savings')
  const [network, setNetwork] = useState(account?.network ?? '')
  const [logo, setLogo] = useState<string | null>(account?.logo ?? null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const brands = kind === 'wallet' ? WALLETS : BANKS
  const instDisplay = institution === 'other' ? institutionName.trim() : (brandFor(institution)?.name ?? '')

  function suggestedName(inst: string, instName: string, k = kind, st = subtype) {
    const b = brandFor(inst)
    const base = inst === 'other' ? instName.trim() : (b?.short && b.short.length <= 5 ? b.short : b?.name.split(' ')[0]) ?? ''
    if (!base) return ''
    if (k === 'bank') return `${base} ${st === 'current' ? 'Current' : 'Savings'}`
    if (k === 'card') return `${base} Credit Card`
    return inst === 'other' ? base : (b?.name ?? base)
  }

  function pickInstitution(key: string) {
    setInstitution(key)
    setError('')
    if (!nameTouched) setName(suggestedName(key, institutionName))
  }

  async function save() {
    if (!isCash) {
      if (!institution) return setError(kind === 'wallet' ? 'Pick a wallet' : 'Pick a bank')
      if (institution === 'other' && !institutionName.trim()) return setError('Enter the bank or wallet name')
      if (last4 && !/^\d{4}$/.test(last4)) return setError('Last 4 digits should be 4 numbers')
    }
    const finalName = name.trim() || suggestedName(institution, institutionName) || KIND_LABEL[kind]
    const id = await saveAccount({
      id: account?.id,
      kind: isCash ? 'cash' : kind,
      name: finalName,
      institution: isCash ? 'cash' : institution,
      institutionName: institution === 'other' ? institutionName.trim() : '',
      last4: isCash ? '' : last4,
      subtype: kind === 'bank' && !isCash ? subtype : null,
      network: kind === 'card' && !isCash ? network || null : null,
      logo,
      archived: account?.archived ?? false,
    })
    toast(account ? 'Account updated' : `${KIND_LABEL[kind]} added`)
    onSaved?.(id)
    onClose()
  }

  async function toggleArchive() {
    if (!account) return
    await setAccountArchived(account.id, !account.archived)
    toast(account.archived ? 'Account restored' : 'Account removed — past entries keep it')
    onClose()
  }

  const preview: Account = {
    id: 'preview',
    createdAt: 0,
    updatedAt: 0,
    kind: isCash ? 'cash' : kind,
    name,
    institution,
    institutionName,
    logo,
    order: 0,
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={account ? 'Edit account' : `Add ${KIND_LABEL[kind].toLowerCase()}`}
      footer={
        <div className="btn-row">
          {account && !isCash && (
            <button className={`btn ${account.archived ? '' : 'ghost danger'}`} onClick={toggleArchive}>
              {account.archived ? 'Restore' : 'Remove'}
            </button>
          )}
          <button className="btn primary grow" onClick={save}>
            {account ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        {!account && (
          <Segmented<EditableKind>
            value={kind}
            onChange={(k) => {
              setKind(k)
              setInstitution('')
              if (!nameTouched) setName('')
            }}
            ariaLabel="Account type"
            options={[
              { value: 'bank', label: 'Bank' },
              { value: 'card', label: 'Credit card' },
              { value: 'wallet', label: 'Wallet' },
            ]}
          />
        )}

        {!isCash && (
          <div className="field">
            <span className="field-label">{kind === 'wallet' ? 'Wallet' : kind === 'card' ? 'Card issued by' : 'Bank'}</span>
            <div className="brand-grid" role="radiogroup">
              {brands.map((b) => (
                <button
                  type="button"
                  key={b.key}
                  role="radio"
                  aria-checked={institution === b.key}
                  className={`brand-option ${institution === b.key ? 'active' : ''}`}
                  onClick={() => pickInstitution(b.key)}
                >
                  <BrandMark brand={b} size="sm" />
                  <span>{b.name}</span>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={institution === 'other'}
                className={`brand-option ${institution === 'other' ? 'active' : ''}`}
                onClick={() => pickInstitution('other')}
              >
                <BrandMark name={institutionName || 'Other'} size="sm" />
                <span>Other</span>
              </button>
            </div>
          </div>
        )}

        {institution === 'other' && (
          <Field label={kind === 'wallet' ? 'Wallet name' : 'Bank name'}>
            <input
              value={institutionName}
              onChange={(e) => {
                setInstitutionName(e.target.value)
                if (!nameTouched) setName(suggestedName('other', e.target.value))
              }}
              placeholder={kind === 'wallet' ? 'e.g. Freecharge' : 'e.g. South Indian Bank'}
              maxLength={40}
            />
          </Field>
        )}

        {kind === 'bank' && !isCash && (
          <div className="field">
            <span className="field-label">Account type</span>
            <Segmented
              value={subtype}
              onChange={(v) => {
                setSubtype(v)
                if (!nameTouched) setName(suggestedName(institution, institutionName, kind, v))
              }}
              options={[
                { value: 'savings', label: 'Savings' },
                { value: 'current', label: 'Current' },
              ]}
            />
          </div>
        )}

        {kind === 'card' && !isCash && (
          <div className="field">
            <span className="field-label">Network</span>
            <div className="chip-row wrap">
              {NETWORKS.map((n) => (
                <button
                  type="button"
                  key={n.key}
                  className={`chip ${network === n.key ? 'active' : ''}`}
                  onClick={() => setNetwork(network === n.key ? '' : n.key)}
                  aria-pressed={network === n.key}
                >
                  <NetworkMark network={n.key} /> {n.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field-row">
          <Field label="Nickname">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameTouched(true)
              }}
              placeholder={suggestedName(institution, institutionName) || 'e.g. Salary account'}
              maxLength={40}
            />
          </Field>
          {!isCash && kind !== 'wallet' && (
            <Field label="Last 4 digits">
              <input
                inputMode="numeric"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Optional"
              />
            </Field>
          )}
        </div>

        <div className="field">
          <span className="field-label">Logo</span>
          <div className="logo-row">
            <AccountLogo account={preview} size="lg" />
            <div className="logo-actions">
              <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={16} /> {logo ? 'Change logo' : 'Upload logo'}
              </button>
              {logo && (
                <button type="button" className="btn small ghost" onClick={() => setLogo(null)}>
                  <X size={16} /> Use default
                </button>
              )}
              <span className="muted small">{logo ? 'Custom logo' : instDisplay ? 'Optional — use your bank’s own logo' : ''}</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) setLogo(await resizeImage(f))
              }}
            />
          </div>
        </div>

        {account && !isCash && !account.archived && (
          <p className="muted small">Removing hides this account when adding new entries. Past entries keep showing it.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
