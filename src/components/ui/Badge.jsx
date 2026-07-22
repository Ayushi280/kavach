import React from 'react'
import { cn } from '@/lib/utils'

const TONES = {
  neutral: 'bg-surface border-border text-ink-muted',
  cyan: 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan',
  blue: 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue',
  red: 'bg-threat/10 border-threat/30 text-threat',
  green: 'bg-safe/10 border-safe/30 text-safe',
  amber: 'bg-warn/10 border-warn/30 text-warn',
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
