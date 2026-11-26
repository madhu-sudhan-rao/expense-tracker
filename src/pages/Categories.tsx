import { useState } from 'react'
import { useCategories } from '../lib/hooks'
import { saveCategory } from '../lib/ops'
import type { Category, TxType } from '../lib/types'
import { ColorPicker, IconPicker, Field, Segmented } from '../components/ui'
import { Sheet } from '../components/Sheet'
import { ChevronLeft, PlusIcon } from '../components/Icons'
import { toast } from '../components/Toast'
import { IconTile } from '../components/brand'

export function CategoriesPage() {
  const [type, setType] = useState<TxType>('expense')
  const cats = useCategories(type, true)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const active = (cats ?? []).filter((c) => !c.archived)
  const archived = (cats ?? []).filter((c) => c.archived)

  return (
    <div className="page">
      <header className="page-header">
        <a href="#/more" className="back-link">
          <ChevronLeft size={20} /> More
        </a>
        <button className="btn primary icon-label" onClick={() => setEditing('new')}>
          <PlusIcon size={18} /> <span>New</span>
        </button>
      </header>
      <h1 className="page-title">Categories</h1>
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Expense', tone: 'expense' },
          { value: 'income', label: 'Income', tone: 'income' },
        ]}
      />
      <section className="card flush">
        <ul className="menu">
          {active.map((c) => (
            <CatItem key={c.id} c={c} onClick={() => setEditing(c)} />
          ))}
        </ul>
      </section>
      {archived.length > 0 && (
        <>
          <h2 className="section-label">Archived</h2>
          <section className="card flush">
            <ul className="menu">
              {archived.map((c) => (
                <CatItem key={c.id} c={c} onClick={() => setEditing(c)} />
              ))}
            </ul>
          </section>
        </>
      )}
      {editing && <CategorySheet category={editing === 'new' ? undefined : editing} type={type} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CatItem({ c, onClick }: { c: Category; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick}>
        <IconTile icon={c.icon} color={c.color} size="sm" />
        <span>{c.name}</span>
        {c.isSystem && <span className="muted small">Used by goals</span>}
      </button>
    </li>
  )
}

function CategorySheet({ category, type, onClose }: { category?: Category; type: TxType; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'tag')
  const [color, setColor] = useState(category?.color ?? '#3b82f6')
  const system = !!category?.isSystem

  async function save() {
    if (!name.trim()) return
    await saveCategory({ id: category?.id, name: name.trim(), icon, color, type: category?.type ?? type })
    toast('Category saved')
    onClose()
  }
  async function toggleArchive() {
    if (!category) return
    await saveCategory({ ...category, archived: !category.archived })
    toast(category.archived ? 'Category restored' : 'Category archived')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <div className="btn-row">
          {category && !system && (
            <button className="btn ghost" onClick={toggleArchive}>
              {category.archived ? 'Restore' : 'Archive'}
            </button>
          )}
          <button className="btn primary grow" onClick={save} disabled={!name.trim()}>
            Save
          </button>
        </div>
      }
    >
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="cat-preview">
          <IconTile icon={icon} color={color} size="lg" />
        </div>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!category} maxLength={40} disabled={system} />
        </Field>
        <div className="field">
          <span className="field-label">Icon</span>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
        <div className="field">
          <span className="field-label">Colour</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {category && !system && (
          <p className="muted small">Archiving hides the category when adding transactions. Past transactions keep it.</p>
        )}
        {system && <p className="muted small">This category is used for goal deposits/withdrawals and can't be renamed or archived.</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
