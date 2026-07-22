import React from 'react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  primary:
    'bg-accent-blue hover:bg-accent-blue/90 text-white shadow-glow-cyan',
  cyan:
    'bg-accent-cyan hover:bg-accent-cyan/90 text-bg font-semibold shadow-glow-cyan',
  ghost:
    'bg-transparent hover:bg-surface-hover text-ink border border-border hover:border-border-bright',
  outline:
    'bg-transparent hover:bg-surface text-ink border border-border-bright',
  danger:
    'bg-threat hover:bg-threat/90 text-white',
}

const SIZES = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-14 px-8 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
