import React, { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

export function ThreatChart() {
  // 24 hours of synthetic activity
  const data = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 24 }, (_, i) => {
      const h = new Date(now.getTime() - (23 - i) * 3600 * 1000)
      const hour = h.getHours()
      // scam calls peak in evening (6-10pm) — realistic for India
      const base = 5 + Math.sin((hour / 24) * Math.PI * 2 - 1.2) * 8
      const scam = Math.max(1, Math.round(base + Math.random() * 6))
      const blocked = Math.max(0, scam - Math.round(Math.random() * 2))
      return {
        hour: hour.toString().padStart(2, '0') + ':00',
        scam,
        blocked,
      }
    })
  }, [])

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp size={14} className="text-accent-cyan" />
            Threat activity · 24h
          </h3>
          <div className="text-xs text-ink-muted mt-0.5">Scams detected vs auto-blocked</div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-threat" /> Detected
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-safe" /> Blocked
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scamG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="blockG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#1E293B" vertical={false} />
            <XAxis
              dataKey="hour"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#1E293B' }}
              interval={3}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: '#0F1629',
                border: '1px solid #2A3654',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: '#94A3B8', fontSize: 11 }}
              cursor={{ stroke: '#22D3EE', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="scam"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#scamG)"
              animationDuration={700}
            />
            <Area
              type="monotone"
              dataKey="blocked"
              stroke="#22C55E"
              strokeWidth={2}
              fill="url(#blockG)"
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
