import React, { useEffect, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { cn, formatNumber } from '@/lib/utils'

function useCountUp(target, duration = 1.2) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => formatNumber(Math.floor(v)))
  useEffect(() => {
    const controls = animate(mv, target, { duration, ease: 'easeOut' })
    return controls.stop
  }, [target, duration, mv])
  return rounded
}

export function StatCard({
  label,
  value,
  suffix,
  prefix,
  icon: Icon,
  tone = 'cyan',
  hint,
  live = false,
}) {
  const rounded = useCountUp(value)

  const toneMap = {
    cyan: 'text-accent-cyan',
    blue: 'text-accent-blue',
    red: 'text-threat',
    green: 'text-safe',
    amber: 'text-warn',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-5 relative overflow-hidden group"
    >
      {/* Corner accent */}
      <div className="absolute top-0 right-0 h-16 w-16 opacity-20 group-hover:opacity-40 transition-opacity">
        <div className={cn('absolute top-3 right-3 h-1 w-8', tone === 'red' ? 'bg-threat' : 'bg-accent-cyan')} />
        <div className={cn('absolute top-3 right-3 w-1 h-8', tone === 'red' ? 'bg-threat' : 'bg-accent-cyan')} />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="eyebrow">{label}</div>
        {Icon && <Icon size={16} className={cn(toneMap[tone], 'opacity-70')} />}
      </div>

      <div className="flex items-baseline gap-1">
        {prefix && <span className={cn('text-lg font-medium', toneMap[tone])}>{prefix}</span>}
        <motion.span
          className={cn('font-mono tabular text-4xl font-semibold tracking-tight text-ink')}
        >
          {rounded}
        </motion.span>
        {suffix && <span className="text-ink-muted text-sm">{suffix}</span>}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
        {live && (
          <span className="inline-flex items-center gap-1.5">
            <span className="relative h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-threat animate-pulse-dot" />
              <span className="absolute inset-0 rounded-full bg-threat" />
            </span>
            <span className="text-threat font-medium">LIVE</span>
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </motion.div>
  )
}
