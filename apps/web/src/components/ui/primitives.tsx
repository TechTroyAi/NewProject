'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Separator({ className, vertical, ...props }: React.HTMLAttributes<HTMLDivElement> & { vertical?: boolean }) {
  return (
    <div
      role="separator"
      className={cn('shrink-0 bg-line/10', vertical ? 'h-full w-px' : 'h-px w-full', className)}
      {...props}
    />
  )
}

export function Progress({ value = 0, className, indicatorClass }: { value?: number; className?: string; indicatorClass?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-raised', className)}>
      <div
        className={cn('h-full rounded-full bg-accent transition-[width] duration-300', indicatorClass)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Avatar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid size-7 shrink-0 place-items-center rounded-full bg-raised text-[11px] font-bold text-muted', className)}>
      {children}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  id,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  className?: string
  id?: string
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-raised',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] size-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1', className)} role="tablist">
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  active,
  onSelect,
  children,
  className,
}: {
  value: string
  active?: boolean
  onSelect?: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      role="tab"
      aria-selected={!!active}
      onClick={() => onSelect?.(value)}
      className={cn(
        'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
        active ? 'bg-raised text-fg' : 'text-muted hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Tooltip({ label, children, side = 'top' }: { label: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[side]
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-line/12 bg-raised px-2 py-1 text-[11px] text-fg opacity-0 shadow-pop transition-opacity duration-150 group-hover/tt:opacity-100',
          pos,
        )}
      >
        {label}
      </span>
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {icon && (
        <div className="grid size-11 place-items-center rounded-2xl border border-line/10 bg-raised text-faint">
          {icon}
        </div>
      )}
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
