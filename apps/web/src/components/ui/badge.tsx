import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[.07em]',
  {
    variants: {
      tone: {
        default: 'bg-raised text-muted',
        note: 'bg-note/15 text-note',
        series: 'bg-series/15 text-series',
        chapter: 'bg-chapter/15 text-chapter',
        wiki: 'bg-wiki/15 text-wiki',
        accent: 'bg-accent/15 text-accent',
        good: 'bg-good/15 text-good',
        warn: 'bg-warn/15 text-warn',
        bad: 'bg-bad/15 text-bad',
      },
    },
    defaultVariants: { tone: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
