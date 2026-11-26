import { useSyncExternalStore } from 'react'

interface ToastState {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

let current: ToastState | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(message: string, action?: ToastState['action']) {
  current = { id: Date.now(), message, action }
  clearTimeout(timer)
  timer = setTimeout(dismiss, action ? 5000 : 2500)
  emit()
}

function dismiss() {
  current = null
  emit()
}

export function Toaster() {
  const t = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
  if (!t) return null
  return (
    <div className="toast" role="status" key={t.id}>
      <span>{t.message}</span>
      {t.action && (
        <button
          onClick={() => {
            t.action!.run()
            dismiss()
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  )
}
