import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-xl border border-line/12 bg-raised/60 px-3 text-[13px] text-fg outline-none transition',
        'placeholder:text-faint focus:border-accent/60 focus:bg-raised focus:shadow-[0_0_0_3px_rgb(var(--accent)/.12)]',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-xl border border-line/12 bg-raised/60 px-3 py-2.5 text-[13px] leading-relaxed text-fg outline-none transition',
        'placeholder:text-faint focus:border-accent/60 focus:bg-raised focus:shadow-[0_0_0_3px_rgb(var(--accent)/.12)]',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-[11px] font-medium uppercase tracking-wider text-faint', className)} {...props} />
  ),
)
Label.displayName = 'Label'
