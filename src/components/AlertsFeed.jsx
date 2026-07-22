import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, MapPin, Languages, Clock, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getAlerts, _simulateAlert } from '@/lib/api'
import { timeAgo, cn } from '@/lib/utils'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// An alert counts as "live" if it arrived in the last 30 seconds
function isLive(a) {
  return Date.now() - new Date(a.time).getTime() < 30000
}

export function AlertsFeed() {
  const [alerts, setAlerts] = useState([])
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      if (USE_MOCK && Math.random() > 0.5) _simulateAlert()
      const data = await getAlerts()
      if (!cancelled) setAlerts((data || []).slice(0, 12))
    }
    tick()
    const t = setInterval(tick, 4000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const liveCount = alerts.filter(isLive).length

  return (
    <div className="card p-5 h-full flex flex-col min-h-[520px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Radio size={14} className="text-threat" />
            Live Alerts Feed
          </h3>
          <div className="text-xs text-ink-muted mt-0.5">
            {liveCount} live · {alerts.length} in window
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-threat">
          <span className="relative h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-threat animate-pulse-dot" />
            <span className="absolute inset-0 rounded-full bg-threat" />
          </span>
          STREAMING
        </div>
      </div>

      <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-2">
        <AnimatePresence initial={false}>
          {alerts.map((a) => {
            const live = isLive(a)
            const pct = Math.round((a.confidence || 0) * 100)
            return (
              <motion.button
                key={a.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25 }}
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-all',
                  'hover:bg-surface-hover',
                  live
                    ? 'border-threat/40 bg-threat/5 shadow-glow-threat'
                    : 'border-border bg-surface/40',
                )}
              >
                {/* Top row: LIVE pill · confidence · meta */}
                <div className="flex items-center gap-3 flex-wrap">
                  {live && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-threat text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-dot" />
                      LIVE
                    </span>
                  )}

                  <span className={cn(
                    'text-sm font-bold font-mono tabular',
                    pct >= 95 ? 'text-threat' : 'text-warn',
                  )}>
                    {pct}%
                  </span>

                  <div className="ml-auto flex items-center gap-3 text-[11px] text-ink-muted font-mono">
                    <span className="flex items-center gap-1"><MapPin size={10} /> {a.location}</span>
                    <span className="hidden sm:flex items-center gap-1"><Languages size={10} /> {a.language}</span>
                    <span className="hidden sm:flex items-center gap-1"><Clock size={10} /> {timeAgo(a.time)}</span>
                    <ChevronRight
                      size={14}
                      className={cn(
                        'transition-transform text-ink-dim',
                        expanded === a.id && 'rotate-90',
                      )}
                    />
                  </div>
                </div>

                {/* Tactic chips — the heart of the new card */}
                {a.active_tactics?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.active_tactics.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-warn/10 border border-warn/30 text-warn"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded panel */}
                <AnimatePresence>
                  {expanded === a.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                        <Meta label="User" value={a.user_id} mono />
                        <Meta label="First seen" value={new Date(a.time).toLocaleTimeString()} />
                        <Meta label="Alert ID" value={a.id} mono />
                        <Meta label="Confidence" value={pct + '%'} mono />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Badge tone="red">Auto-warn dispatched</Badge>
                        <Badge tone="amber">Family notified</Badge>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            )
          })}
        </AnimatePresence>

        {alerts.length === 0 && (
          <div className="h-40 flex items-center justify-center text-sm text-ink-muted text-center px-6">
            No alerts yet — the feed fills up as real scam calls get detected.
          </div>
        )}
      </div>
    </div>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <div className="uppercase tracking-wider text-[9px] text-ink-dim">{label}</div>
      <div className={cn('text-ink mt-0.5', mono && 'font-mono')}>{value}</div>
    </div>
  )
}
