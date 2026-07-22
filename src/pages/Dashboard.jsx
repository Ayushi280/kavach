import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Ban, Users, Activity, RefreshCw, MapPin,
} from 'lucide-react'
import { StatCard } from '@/components/StatCard'
import { AlertsFeed } from '@/components/AlertsFeed'
import { FraudGraph } from '@/components/FraudGraph'
import { ThreatChart } from '@/components/ThreatChart'
import { HoneypotPanel } from '@/components/HoneypotPanel'
import { Badge } from '@/components/ui/Badge'
import { getStats } from '@/lib/api'

const HOTSPOTS = [
  { city: 'Delhi', count: 84, share: 0.24 },
  { city: 'Mumbai', count: 61, share: 0.18 },
  { city: 'Bengaluru', count: 42, share: 0.12 },
  { city: 'Hyderabad', count: 31, share: 0.09 },
  { city: 'Chennai', count: 28, share: 0.08 },
  { city: 'Kolkata', count: 22, share: 0.06 },
]

export default function Dashboard() {
  const [stats, setStats] = useState({
    active_threats: 0,
    blocked_today: 0,
    victims_protected: 0,
    total_checks: 0,
  })
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    let cancelled = false
    async function tick() {
      const s = await getStats()
      if (!cancelled && s) setStats(s)
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
            Cyber Cell · Command
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Live Threat Console
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="cyan">All systems nominal</Badge>
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
        <StatCard
          label="Active threats"
          value={stats.active_threats}
          tone="red"
          icon={Shield}
          live
        />
        <StatCard
          label="Scams blocked today"
          value={stats.blocked_today}
          tone="green"
          icon={Ban}
          hint="+12% vs yesterday"
        />
        <StatCard
          label="Victims protected"
          value={stats.victims_protected}
          tone="cyan"
          icon={Users}
          hint="cumulative · this month"
        />
        <StatCard
          label="Total checks"
          value={stats.total_checks}
          tone="blue"
          icon={Activity}
          hint="messages + calls analyzed"
        />
      </div>

      {/* Main grid: alerts + graph */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <AlertsFeed />
        <FraudGraph />
      </div>

      {/* Bottom row: chart + hotspots */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <ThreatChart />
        </div>
        <HotspotList />
      </div>

      {/* Evidence capture (passive mule-account intel) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <HoneypotPanel />
      </div>
    </div>
  )
}

function HotspotList() {
  return (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MapPin size={14} className="text-accent-cyan" />
            Origin hotspots
          </h3>
          <div className="text-xs text-ink-muted mt-0.5">Cities where fraud calls originate</div>
        </div>
        <Badge tone="amber">Top 6</Badge>
      </div>

      <div className="space-y-3">
        {HOTSPOTS.map((h, i) => (
          <motion.div
            key={h.city}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <div className="flex justify-between items-center text-sm mb-1.5">
              <span className="text-ink flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-dim tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {h.city}
              </span>
              <span className="text-ink-muted font-mono tabular text-xs">{h.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${h.share * 100 * 3.5}%` }}
                transition={{ delay: 0.05 * i + 0.1, duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue rounded-full"
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border text-[11px] text-ink-muted">
        Full crime map — <span className="text-accent-cyan">planned</span> (Leaflet/Mapbox)
      </div>
    </div>
  )
}
