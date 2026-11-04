'use client'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

function useMounted() {
  const [m, setM] = React.useState(false)
  React.useEffect(() => setM(true), [])
  return m
}

/* ─── Modal ──────────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const mounted = useMounted()
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full animate-scale-in rounded-2xl border border-line/12 bg-surface shadow-pop',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
          className,
        )}
      >
        {(title || description) && (
          <div className="border-b border-line/8 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
                {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-fg"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line/8 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ─── Dropdown menu ──────────────────────────────────────────── */
export function Dropdown({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  align?: 'start' | 'end'
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const mounted = useMounted()

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = React.useCallback(() => setOpen(false), [])
  const body = typeof children === 'function' ? children(close) : children

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {mounted && open && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 min-w-[190px] animate-scale-in overflow-hidden rounded-xl border border-line/12 bg-surface p-1 shadow-pop',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {body}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({
  children,
  onSelect,
  icon,
  danger,
  shortcut,
}: {
  children: React.ReactNode
  onSelect?: () => void
  icon?: React.ReactNode
  danger?: boolean
  shortcut?: string
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12.5px] transition',
        danger ? 'text-bad hover:bg-bad/12' : 'text-fg/85 hover:bg-raised',
      )}
    >
      {icon && <span className="text-faint [&_svg]:size-3.5">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="kbd">{shortcut}</span>}
    </button>
  )
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-line/8" />
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[.09em] text-faint">{children}</div>
}
