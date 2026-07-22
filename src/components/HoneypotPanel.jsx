import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bug, CreditCard, Landmark, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { honeypotDemo } from '@/lib/api'
import { cn } from '@/lib/utils'

export function HoneypotPanel() {
  const [data, setData] = useState(null)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    let cancelled = false
    honeypotDemo().then((d) => { if (!cancelled) setData(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bug size={14} className="text-accent-cyan" />
            Evidence Capture
          </h3>
          <div className="text-xs text-ink-muted mt-0.5">
            Mule-account details the scammer reveals on the call — captured passively
          </div>
        </div>
        <Badge tone="cyan">Passive capture</Badge>
      </div>

      {!data ? (
        <div className="h-24 flex items-center justify-center text-sm text-ink-muted">Loading…</div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <div className="eyebrow mb-2 flex items-center gap-1.5">
                <CreditCard size={11} /> Extracted UPI IDs
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.extracted?.upi_ids || []).map((u) => (
                  <motion.span
                    key={u}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-2.5 py-1 rounded-md bg-threat/10 border border-threat/30 text-threat font-mono text-[11px]"
                  >
                    {u}
                  </motion.span>
                ))}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2 flex items-center gap-1.5">
                <Landmark size={11} /> Extracted account numbers
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.extracted?.account_numbers || []).map((a) => (
                  <motion.span
                    key={a}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-2.5 py-1 rounded-md bg-warn/10 border border-warn/30 text-warn font-mono text-[11px]"
                  >
                    {a}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="mt-4 text-xs text-ink-muted hover:text-ink flex items-center gap-1"
          >
            <ChevronDown size={12} className={cn('transition-transform', showTranscript && 'rotate-180')} />
            {showTranscript ? 'Hide' : 'Show'} captured transcript
          </button>

          {showTranscript && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 space-y-2 overflow-hidden"
            >
              {(data.transcript || []).map((t, i) => (
                <div key={i} className="text-[11px] space-y-1.5">
                  <div className="p-2 rounded-lg bg-threat/5 border border-threat/20 text-ink">
                    <span className="text-threat font-semibold">Scammer:</span> {t.scammer}
                  </div>
                  <div className="p-2 rounded-lg bg-surface/50 border border-border text-ink-muted">
                    <span className="text-accent-cyan font-semibold">Victim (kept listening):</span> {t.honeypot}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          <div className="mt-4 pt-3 border-t border-border text-[10px] text-ink-muted">
            These identifiers feed the Fraud Network Graph as mule-account nodes.
          </div>
        </>
      )}
    </div>
  )
}
