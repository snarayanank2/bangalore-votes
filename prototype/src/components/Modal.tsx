import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Overlay that never changes the URL — core to the product (Register/Login,
 * Flag misinformation, Cast issue vote are all modals per the IA). Closes on
 * Esc and on backdrop click; returns focus to whatever triggered it on close.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      triggerRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    // §7.9: scrim rgba(26,26,26,0.5) — bg-ink/50 IS that value now that --ink is #1a1a1a. Below
    // `md` the shell is a bottom-anchored, full-width top-sheet (rounded top corners only, flush
    // with the viewport bottom); at `md`+ it centers as a constrained, fully rounded dialog.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-md bg-white p-6 shadow-modal focus:outline-none md:max-w-lg md:rounded-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="font-heading text-2xl font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] rounded-sm text-ink hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
