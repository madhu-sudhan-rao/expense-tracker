import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './Icons'

const stack: object[] = []

interface SheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  headerAction?: ReactNode
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children, footer, headerAction }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  // Keep the latest onClose without re-running the open effect (which would steal focus).
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const token = {}
    stack.push(token)
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most sheet reacts to Escape.
      if (e.key === 'Escape' && stack[stack.length - 1] === token) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    panel.current?.focus()
    return () => {
      stack.splice(stack.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      if (stack.length === 0) document.body.classList.remove('no-scroll')
      prevFocus?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={panel} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <div className="sheet-header-actions">
            {headerAction}
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
