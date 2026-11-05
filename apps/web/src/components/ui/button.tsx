'use client'
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[.985]',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-fg shadow-sm hover:brightness-110',
        secondary: 'bg-raised text-fg border border-line/10 hover:bg-raised/80 hover:border-line/20',
        outline: 'border border-line/15 bg-transparent text-fg hover:bg-raised/60',
        ghost: 'text-muted hover:bg-raised/70 hover:text-fg',
        subtle: 'bg-accent/12 text-accent hover:bg-accent/20',
        danger: 'bg-bad/15 text-bad hover:bg-bad/25',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 text-[13px]',
        sm: 'h-8 px-3 text-[12px]',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'

export { buttonVariants }
