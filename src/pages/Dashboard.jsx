import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Ban, Users, Activity, RefreshCw, PhoneCall, CreditCard, Landmark, Inbox,
} from 'lucide-react'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/Badge'
import { getStats, getAlerts } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

export default function Dashboard() {
  const [stats, setStats] = useState({
    active_threats: 0,
    blocked_today: 0,
    victims_protected: 0,
    total_checks: 0,
  })
  const [incidents, setIncidents] = useState([])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    let cancelled = false
    async function tick() {
      const [s, a] = await Promise.all([getStats(), getAlerts()])
      if (cancelled) return
      if (s) setStats(s)
      if (Array.isArray(a)) setIncidents(a)
    }
    tick()
    const t = setInterval(tick, 5000)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => {
      cancelled = true
      clearInterval(t)
      clearInterval(clock)
    }
  }, [])

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-10 py-6 lg:py-10">
      {/* Header bar */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-2">
            <span className="relative h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-safe animate-pulse-dot" />
              <span className="absolute inset-0 rounded-full bg-safe" />
            </span>
            Cyber Cell &middot; Command
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Live Threat Console
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="cyan">Live data</Badge>
          <div className="font-mono text-xs text-ink-muted tabular">
            {now.toLocaleTimeString('en-IN', { hour12: false })} IST
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-ink-muted hover:text-ink flex items-center gap-1"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active threats" value={stats.active_threats} tone="red" icon={Shield} live />
        <StatCard label="Scams blocked today" value={stats.blocked_today} tone="green" icon={Ban} />
        <StatCard label="Victims protected" value={stats.victims_protected} tone="cyan" icon={Users} hint="distinct users" />
        <StatCard label="Total checks" value={stats.total_checks} tone="blue" icon={Activity} hint="messages + calls analyzed" />
      </div>

      {/* Reported incidents - the real intelligence table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="relative h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-threat animate-pulse-dot" />
                <span className="absolute inset-0 rounded-full bg-threat" />
              </span>
              Reported fraud incidents
            </h3>
            <div className="text-xs text-ink-muted mt-0.5">
              Every detected scam call - the caller's number (reported by the victim) and the
              mule-account details Kavach captured from the call.
            </div>
          </div>
          <Badge tone="cyan">{incidents.length} logged</Badge>
        </div>

        {incidents.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center gap-2 text-ink-muted">
            <Inbox size={28} className="opacity-50" />
            <div className="text-sm">No incidents yet.</div>
            <div className="text-xs max-w-sm">
              Run a scam through Live Protection or the Scam Detector - real detections appear
              here instantly, with any captured UPI / account numbers.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 eyebrow font-medium">Time</th>
                  <th className="p-3 eyebrow font-medium">Caller number</th>
                  <th className="p-3 eyebrow font-medium">Tactics</th>
                  <th className="p-3 eyebrow font-medium">Captured mule accounts</th>
                  <th className="p-3 eyebrow font-medium w-20">Conf.</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {incidents.map((it) => {
                    const upis = it.upi_ids || []
                    const accts = it.account_numbers || []
                    const hasIntel = upis.length > 0 || accts.length > 0
                    return (
                      <motion.tr
                        key={it.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-b border-border/60 last:border-0 align-top"
                      >
                        <td className="p-3 text-ink-muted whitespace-nowrap text-xs">
                          {timeAgo(it.time)}
                        </td>
                        <td className="p-3">
                          {it.scammer_phone ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink">
                              <PhoneCall size={11} className="text-accent-cyan" />
                              {it.scammer_phone}
                            </span>
                          ) : (
                            <span className="text-ink-dim text-xs italic">not reported</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(it.active_tactics || []).map((t) => (
                              <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-warn/10 border border-warn/30 text-warn">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {hasIntel ? (
                            <div className="flex flex-wrap gap-1.5">
                              {upis.map((u) => (
                                <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-threat/10 border border-threat/30 text-threat">
                                  <CreditCard size={10} /> {u}
                                </span>
                              ))}
                              {accts.map((a) => (
                                <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-threat/10 border border-threat/30 text-threat">
                                  <Landmark size={10} /> {a}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-ink-dim text-xs italic">none captured</span>
                          )}
                        </td>
                        <td className="p-3 font-mono tabular text-xs text-ink">
                          {Math.round((it.confidence || 0) * 100)}%
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
